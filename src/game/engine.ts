// The game reducer. Pure: (state, action) -> new state. Randomness comes from state.seed.
import { BUILDINGS, CLASSES, DAYS_PER_SEASON, EPITHETS, FIRST_NAMES, ITEMS, RECIPES, TICKS_PER_DAY } from './data';
import { DEFAULT_HOUSE_SPOTS, DEFAULT_SPOTS } from './map';
import { Rng } from './rng';
import {
  buildBlocker, buildCost, buildHours, buyPrice, day, findFreeSpot, firewoodPerDay, foodUsePerDay, housingCap,
  needsPlacement, placementBlocker, productionPerDay, qty, questBlocker, questDays, questTemplate, recipeBlocker,
  season, sellPrice, storageCap, successChance, taxesPerDay, upkeepPerDay, xpToNext,
} from './rules';
import type { Action, Adventurer, AdventurerClass, GameState, Inventory, ItemId, LogKind } from './types';

export const SAVE_VERSION = 2;
const MAX_LOG = 120;

export function createInitialState(seed = Date.now() % 2147483647): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    tick: 8, // start in the morning
    seed,
    gold: 120,
    reputation: 0,
    population: 5,
    inventory: { food: 40, wood: 60, stone: 30 },
    buildings: {
      town_hall: 1, house: 1, farm: 1, lumber_camp: 1, quarry: 0, mine: 0, herb_garden: 0, warehouse: 0,
      workshop: 0, smithy: 0, apothecary: 0, tavern: 1, market: 0,
    },
    placements: {
      town_hall: DEFAULT_SPOTS.town_hall, farm: DEFAULT_SPOTS.farm, lumber_camp: DEFAULT_SPOTS.lumber_camp,
      tavern: DEFAULT_SPOTS.tavern,
    },
    houses: [DEFAULT_HOUSE_SPOTS[0]],
    construction: null,
    adventurers: [],
    quests: [],
    log: [],
    nextId: 1,
    starving: false,
    freezing: false,
  };
  const rng = new Rng(seed);
  const first = spawnAdventurer(s, rng);
  first.level = 1;
  first.fee = 6;
  s.adventurers.push(first);
  s.seed = rng.seed;
  log(s, 'info', 'You have been named steward of a small settlement. Build it into a great village.');
  log(s, 'info', `${first.name} the ${CLASSES[first.cls].name} sits by the tavern fire, looking for work.`);
  return s;
}

function log(s: GameState, kind: LogKind, text: string) {
  s.log.unshift({ id: s.nextId++, day: day(s), kind, text });
  if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
}

function addItem(s: GameState, item: ItemId, n: number): number {
  const cap = storageCap(s);
  const before = qty(s, item);
  const after = Math.max(0, Math.min(cap, before + n));
  s.inventory[item] = after;
  return after - before;
}

function removeItems(s: GameState, items: Inventory, times = 1) {
  for (const [item, n] of Object.entries(items) as [ItemId, number][]) {
    s.inventory[item] = qty(s, item) - n * times;
  }
}

function spawnAdventurer(s: GameState, rng: Rng): Adventurer {
  const cls = rng.pick(Object.keys(CLASSES) as AdventurerClass[]);
  const level = Math.max(1, Math.min(12, 1 + Math.floor(s.reputation / 12) + rng.int(-1, 1)));
  return {
    id: `adv${s.nextId++}`,
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(EPITHETS)}`,
    cls,
    level,
    xp: 0,
    fee: level * 6 + rng.int(0, 6),
    leavesOnDay: day(s) + rng.int(3, 6),
    status: 'idle',
    questsCompleted: 0,
  };
}

export function reduce(prev: GameState, action: Action): GameState {
  const s: GameState = structuredClone(prev);
  const rng = new Rng(s.seed);
  const changed = apply(s, action, rng);
  if (!changed) return prev;
  s.seed = rng.seed;
  return s;
}

/** Mutates the cloned state. Returns false if the action was invalid. */
function apply(s: GameState, action: Action, rng: Rng): boolean {
  switch (action.type) {
    case 'tick':
      tick(s, rng);
      return true;

    case 'build': {
      if (buildBlocker(s, action.building)) return false;
      const place = needsPlacement(s, action.building);
      if (place && (!action.at || placementBlocker(s, action.building, action.at))) return false;
      const target = s.buildings[action.building] + 1;
      const cost = buildCost(action.building, target);
      s.gold -= cost.gold;
      removeItems(s, cost.items);
      s.construction = { building: action.building, targetLevel: target, endsTick: s.tick + buildHours(action.building, target) };
      if (place && action.at) s.construction.at = { x: action.at.x, y: action.at.y };
      const def = BUILDINGS[action.building];
      log(s, 'info', target === 1 ? `Construction of the ${def.name} has begun.` : `Upgrading ${def.name} to level ${target}.`);
      return true;
    }

    case 'cancelBuild': {
      const c = s.construction;
      if (!c) return false;
      const cost = buildCost(c.building, c.targetLevel);
      s.gold += Math.floor(cost.gold / 2);
      for (const [item, n] of Object.entries(cost.items) as [ItemId, number][]) addItem(s, item, Math.floor(n / 2));
      s.construction = null;
      log(s, 'bad', `Construction of the ${BUILDINGS[c.building].name} was abandoned. Half the materials were salvaged.`);
      return true;
    }

    case 'craft': {
      const recipe = RECIPES.find((r) => r.id === action.recipeId);
      const times = Math.max(1, Math.floor(action.times ?? 1));
      if (!recipe || recipeBlocker(s, recipe, times)) return false;
      removeItems(s, recipe.inputs, times);
      addItem(s, recipe.output, recipe.qty * times);
      return true;
    }

    case 'buy': {
      const n = Math.floor(action.qty);
      const price = buyPrice(s, action.item) * n;
      if (s.buildings.market < 1 || n < 1 || s.gold < price) return false;
      if (qty(s, action.item) + n > storageCap(s)) return false;
      s.gold -= price;
      addItem(s, action.item, n);
      return true;
    }

    case 'sell': {
      const n = Math.floor(action.qty);
      if (s.buildings.market < 1 || n < 1 || qty(s, action.item) < n) return false;
      s.inventory[action.item] = qty(s, action.item) - n;
      s.gold += sellPrice(s, action.item) * n;
      return true;
    }

    case 'startQuest': {
      const q = questTemplate(action.templateId);
      if (!q) return false;
      const ids = [...new Set(action.partyIds)];
      const party = ids.map((id) => s.adventurers.find((a) => a.id === id)).filter((a): a is Adventurer => !!a);
      if (party.length !== ids.length) return false;
      const supplies = cleanInventory(action.supplies);
      if (questBlocker(s, q, party, supplies)) return false;
      const fee = party.reduce((sum, a) => sum + a.fee, 0);
      s.gold -= fee;
      removeItems(s, supplies);
      for (const a of party) a.status = 'questing';
      s.quests.push({
        id: `q${s.nextId++}`,
        templateId: q.id,
        partyIds: ids,
        supplies,
        startedTick: s.tick,
        endsTick: s.tick + questDays(q, party) * TICKS_PER_DAY,
        successChance: successChance(q, party, supplies),
      });
      log(s, 'quest', `${party.map((a) => a.name).join(', ')} set out on "${q.name}" for ${fee} gold.`);
      return true;
    }

    case 'dismissAdventurer': {
      const a = s.adventurers.find((x) => x.id === action.adventurerId);
      if (!a || a.status !== 'idle') return false;
      s.adventurers = s.adventurers.filter((x) => x !== a);
      log(s, 'info', `${a.name} was sent on their way.`);
      return true;
    }
  }
}

function cleanInventory(inv: Inventory): Inventory {
  const out: Inventory = {};
  for (const [item, n] of Object.entries(inv) as [ItemId, number][]) {
    const v = Math.floor(n);
    if (v > 0 && item in ITEMS) out[item] = v;
  }
  return out;
}

// ---------------------------------------------------------------- time

function tick(s: GameState, rng: Rng) {
  s.tick += 1;

  // Production and consumption, spread evenly over the day.
  for (const [item, n] of Object.entries(productionPerDay(s)) as [ItemId, number][]) {
    addItem(s, item, n / TICKS_PER_DAY);
  }
  const eaten = foodUsePerDay(s) / TICKS_PER_DAY;
  if (qty(s, 'food') < eaten) {
    s.inventory.food = 0;
    s.starving = true;
  } else {
    s.inventory.food = qty(s, 'food') - eaten;
  }
  const burned = firewoodPerDay(s) / TICKS_PER_DAY;
  if (burned > 0) {
    if (qty(s, 'wood') < burned) {
      s.inventory.wood = 0;
      s.freezing = true;
    } else {
      s.inventory.wood = qty(s, 'wood') - burned;
    }
  }
  s.gold = Math.max(0, s.gold + (taxesPerDay(s) - upkeepPerDay(s)) / TICKS_PER_DAY);

  // Construction.
  const c = s.construction;
  if (c && s.tick >= c.endsTick) {
    s.buildings[c.building] = c.targetLevel;
    if (c.at) {
      if (c.building === 'house') s.houses.push(c.at);
      else s.placements[c.building] = c.at;
    }
    s.construction = null;
    const def = BUILDINGS[c.building];
    log(s, 'good', c.targetLevel === 1 ? `The ${def.name} is complete!` : `${def.name} upgraded to level ${c.targetLevel}.`);
  }

  // Quests.
  for (const q of s.quests.filter((x) => s.tick >= x.endsTick)) resolveQuest(s, q.id, rng);

  if (s.tick % TICKS_PER_DAY === 0) newDay(s, rng);
}

function resolveQuest(s: GameState, questId: string, rng: Rng) {
  const quest = s.quests.find((q) => q.id === questId)!;
  s.quests = s.quests.filter((q) => q.id !== questId);
  const t = questTemplate(quest.templateId)!;
  const party = quest.partyIds.map((id) => s.adventurers.find((a) => a.id === id)).filter((a): a is Adventurer => !!a);
  const success = rng.chance(quest.successChance);
  const today = day(s);

  const hasCleric = party.some((a) => a.cls === 'cleric');
  const potions = quest.supplies.healing_potion ?? 0;
  const armor = Math.min(quest.supplies.leather_armor ?? 0, party.length);

  const lost: string[] = [];
  const hurt: string[] = [];
  party.forEach((a, i) => {
    let injury = (success ? 0.08 : 0.45) - potions * 0.08;
    if (a.cls === 'mage') injury *= 1.5;
    if (hasCleric) injury /= 2;
    injury = Math.max(0.02, injury);
    let death = success ? 0 : 0.12;
    if (i < armor) death /= 2;
    if (hasCleric) death /= 2;

    if (rng.chance(death)) {
      lost.push(a.name);
      s.adventurers = s.adventurers.filter((x) => x.id !== a.id);
      return;
    }
    if (rng.chance(injury)) {
      a.status = 'injured';
      a.recoversOnDay = today + 2;
      hurt.push(a.name);
    } else {
      a.status = 'idle';
    }
    a.leavesOnDay = Math.max(a.leavesOnDay, today + 3);
    if (success) {
      a.questsCompleted += 1;
      a.xp += t.difficulty;
      while (a.xp >= xpToNext(a)) {
        a.xp -= xpToNext(a);
        a.level += 1;
        a.fee = Math.round(a.fee * 1.25 + 3);
        log(s, 'good', `${a.name} reached level ${a.level}.`);
      }
    }
  });

  // Gear comes back on success; on failure each piece has an even chance of being lost.
  for (const item of ['iron_sword', 'leather_armor'] as ItemId[]) {
    const n = quest.supplies[item] ?? 0;
    let back = 0;
    for (let i = 0; i < n; i++) if (success || rng.chance(0.5)) back++;
    if (back) addItem(s, item, back);
  }

  if (success) {
    const rogue = party.some((a) => a.cls === 'rogue');
    const parts: string[] = [];
    for (const l of t.loot) {
      let n = rng.int(l.min, l.max);
      if (l.item === 'gold') {
        if (rogue) n = Math.round(n * 1.25);
        s.gold += n;
        parts.push(`${n} gold`);
      } else {
        const got = addItem(s, l.item, n);
        parts.push(`${Math.round(got)} ${ITEMS[l.item].name}${got < n ? ' (storage full)' : ''}`);
      }
    }
    s.reputation += t.reputation;
    log(s, 'quest', `"${t.name}" succeeded! Brought back ${parts.join(', ')}. Reputation +${t.reputation}.`);
  } else {
    log(s, 'bad', `"${t.name}" failed. The party returned empty-handed.`);
  }
  if (hurt.length) log(s, 'bad', `${hurt.join(', ')} ${hurt.length > 1 ? 'were' : 'was'} injured and must rest.`);
  if (lost.length) log(s, 'bad', `${lost.join(', ')} did not return. They will be remembered.`);
}

function newDay(s: GameState, rng: Rng) {
  const today = day(s);

  // Seasons.
  if ((today - 1) % DAYS_PER_SEASON === 0) {
    const se = season(s);
    log(s, se.id === 'winter' ? 'bad' : 'info', `${se.icon} ${se.name} has come. ${se.description}`);
  }

  // Population.
  if (s.starving || s.freezing) {
    if (s.population > 1) {
      s.population -= 1;
      log(s, 'bad', s.starving
        ? 'Food ran out. A family has left the village in search of a better life.'
        : 'The woodpiles ran dry and the cold set in. A family has left for warmer lands.');
    }
  } else if (s.population < housingCap(s) && qty(s, 'food') > s.population) {
    s.population += 1;
    log(s, 'good', 'A new family has settled in the village.');
  }
  s.starving = false;
  s.freezing = false;

  // Adventurers: recovery, departures, arrivals.
  for (const a of s.adventurers) {
    if (a.status === 'injured' && a.recoversOnDay !== undefined && today >= a.recoversOnDay) {
      a.status = 'idle';
      a.recoversOnDay = undefined;
      a.leavesOnDay = Math.max(a.leavesOnDay, today + 2);
      log(s, 'info', `${a.name} has recovered.`);
    }
  }
  const leaving = s.adventurers.filter((a) => a.status === 'idle' && today >= a.leavesOnDay);
  for (const a of leaving) log(s, 'info', `${a.name} grew restless and left the village.`);
  s.adventurers = s.adventurers.filter((a) => !leaving.includes(a));

  const tavern = s.buildings.tavern;
  if (tavern > 0 && s.adventurers.length < 1 + tavern * 2 && rng.chance(0.35 + tavern * 0.15)) {
    const a = spawnAdventurer(s, rng);
    s.adventurers.push(a);
    log(s, 'info', `${a.name}, a level ${a.level} ${CLASSES[a.cls].name}, arrived at the tavern.`);
  }

  // Random events.
  if (rng.chance(0.12)) {
    const roll = rng.int(0, 3);
    if (roll === 0 && s.buildings.farm > 0) {
      const n = addItem(s, 'food', 8 * s.buildings.farm);
      log(s, 'good', `A bountiful harvest! +${Math.round(n)} food.`);
    } else if (roll === 1) {
      s.reputation += 1;
      log(s, 'good', 'A travelling bard sings of your village in distant towns. Reputation +1.');
    } else if (roll === 2 && qty(s, 'wood') > 20) {
      const n = Math.floor(qty(s, 'wood') * 0.1);
      addItem(s, 'wood', -n);
      log(s, 'bad', `A storm rotted part of the woodpile. -${n} wood.`);
    } else if (roll === 3 && s.gold > 60) {
      const n = Math.floor(s.gold * 0.08);
      s.gold -= n;
      log(s, 'bad', `Thieves slipped into the treasury at night. -${n} gold.`);
    }
  }
}

// ---------------------------------------------------------------- persistence

const SAVE_KEY = 'hearthstead.save';

export function saveGame(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the game still runs, it just won't persist */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** Upgrade an older save to the current format. Returns null if it cannot be read. */
export function migrate(raw: unknown): GameState | null {
  const s = raw as GameState & { version: number };
  if (!s || typeof s !== 'object' || typeof s.version !== 'number') return null;
  if (s.version === 1) {
    // v1 had a fixed layout: give every existing building its old spot.
    s.placements = {};
    for (const [id, at] of Object.entries(DEFAULT_SPOTS) as [keyof typeof DEFAULT_SPOTS, (typeof DEFAULT_SPOTS)['farm']][]) {
      if (s.buildings[id] > 0) s.placements[id] = at;
    }
    s.houses = DEFAULT_HOUSE_SPOTS.slice(0, s.buildings.house);
    s.freezing = false;
    const c = s.construction;
    if (c && needsPlacement(s, c.building)) {
      c.at = c.building === 'house' ? DEFAULT_HOUSE_SPOTS[s.buildings.house] : DEFAULT_SPOTS[c.building];
      if (!c.at || placementBlocker({ ...s, construction: null }, c.building, c.at)) {
        c.at = findFreeSpot({ ...s, construction: null }, c.building) ?? undefined;
      }
      if (!c.at) s.construction = null;
    }
    s.version = 2;
  }
  return s.version === SAVE_VERSION ? s : null;
}
