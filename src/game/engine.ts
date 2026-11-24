// The game reducer: (state, action) -> new state. Pure: randomness comes from state.seed.
import {
  DAYS_PER_YEAR, DEFAULT_TARGETS, GOAT_MEAT_KG, HELPER_AGE, NEIGHBORS, START_KNOWN, STRUCTURES,
} from './data';
import { START_LAYOUT, plotAt, plotTiles, tileKey } from './map';
import { Rng } from './rng';
import {
  age, buildBlocker, buildPlan, expeditionBlocker, expeditionDays, placementBlocker, techStatus,
} from './rules';
import { checkDiscoveries, simulateDay } from './sim';
import { add, log, newId, take } from './store';
import type { Action, GameState, ItemId, Person, SkillId, Structure } from './types';

export const SAVE_VERSION = 3;

type Founder = [name: string, sex: 'f' | 'm', age: number, skills: Partial<Record<SkillId, number>>, job: Person['job']];

/** The founding families. Hesk is the only master knapper: if she dies untaught, the craft suffers. */
const FOUNDERS: Founder[] = [
  ['Hesk', 'f', 55, { knapping: 78, gathering: 50, hideworking: 30 }, 'knapper'],
  ['Ostav', 'm', 52, { herding: 65, hunting: 40, farming: 30 }, 'herder'],
  ['Aru', 'f', 34, { farming: 62, building: 30, gathering: 25 }, 'farmer'],
  ['Doran', 'm', 36, { building: 55, woodcutting: 45, hunting: 30 }, 'builder'],
  ['Teska', 'f', 29, { gathering: 55, hideworking: 50, pottery: 5 }, 'gatherer'],
  ['Maro', 'm', 31, { hunting: 60, woodcutting: 35, knapping: 20 }, 'woodcutter'],
  ['Bena', 'f', 25, { farming: 40, herding: 30, gathering: 30 }, 'farmer'],
  ['Vann', 'm', 23, { woodcutting: 40, building: 35, hunting: 20 }, 'builder'],
  ['Kessa', 'f', 20, { hideworking: 30, gathering: 35, farming: 20 }, 'gatherer'],
  ['Esk', 'm', 18, { hunting: 30, farming: 25, building: 15 }, 'farmer'],
  ['Ilo', 'f', 11, { gathering: 10 }, 'gatherer'],
  ['Tobek', 'm', 9, { herding: 5 }, 'herder'],
  ['Mira', 'f', 6, {}, 'idle'],
  ['Joss', 'm', 4, {}, 'idle'],
  ['Neve', 'f', 2, {}, 'idle'],
  ['Kel', 'm', 0.5, {}, 'idle'],
];

export function createInitialState(seed = Date.now() % 2147483647): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    day: 0,
    seed,
    people: [],
    inventory: {},
    goats: 14,
    structures: [],
    cleared: [],
    expeditions: [],
    neighbors: NEIGHBORS.map((n) => ({ id: n.id, name: n.name, trust: n.id === 'chalk' ? 10 : 0, stock: { ...n.makes }, owes: 0, famine: false })),
    known: [...START_KNOWN],
    research: {},
    targets: { ...DEFAULT_TARGETS },
    weather: 'normal',
    report: { kcalNeeded: 0, kcalEaten: 0, hungry: 0, cold: 0, spoiled: {} },
    log: [],
    nextId: 1,
  };
  for (const [name, sex, years, skills, job] of FOUNDERS) {
    s.people.push({ id: newId(s, 'p'), name, sex, born: -Math.round(years * DAYS_PER_YEAR), health: 90, skills: { ...skills }, job });
  }
  for (const { type, at } of START_LAYOUT) {
    const x: Structure = { id: newId(s, 's'), type, at, built: true, work: 0, workNeeded: 0, clearedWood: 0 };
    if (type === 'field') x.field = { sownOn: null, sowWork: 0, weeding: 0, harvestWork: 0, fertility: 1.05 };
    s.structures.push(x);
    for (const t of plotTiles(plotAt(type, at))) s.cleared.push(tileKey(t));
  }
  const start: [ItemId, number, number][] = [
    ['grain', 1400, 0.7], ['straw', 400, 0.6], ['wood', 900, 0.6], ['flint', 8, 0.45], ['nuts', 30, 0.7],
    ['smoked_meat', 80, 0.7], ['fodder', 200, 0.6], ['sickle', 4, 0.55], ['axe', 3, 0.55], ['scraper', 3, 0.5],
    ['arrows', 8, 0.5], ['clothing', 16, 0.5], ['leather', 2, 0.5],
  ];
  for (const [item, n, q] of start) add(s, item, n, q);
  log(s, 'info', 'Sixteen people have come to settle this river valley, with seed grain, goats and what they could carry.');
  log(s, 'info', 'It is early spring: clear fields and sow before summer, or there will be nothing to harvest.');
  return s;
}

export function reduce(prev: GameState, action: Action): GameState {
  const s: GameState = structuredClone(prev);
  const rng = new Rng(s.seed);
  if (!apply(s, action, rng)) return prev;
  s.seed = rng.seed;
  return s;
}

function apply(s: GameState, a: Action, rng: Rng): boolean {
  switch (a.type) {
    case 'tick':
      simulateDay(s, rng);
      return true;

    case 'assign': {
      const p = s.people.find((x) => x.id === a.personId);
      if (!p || p.away || age(p, s.day) < HELPER_AGE) return false;
      if (a.job === 'researcher' && (!a.research || techStatus(s, a.research) !== 'available')) return false;
      p.job = a.job;
      p.research = a.job === 'researcher' ? a.research : undefined;
      return true;
    }

    case 'build': {
      if (buildBlocker(s, a.structure) || placementBlocker(s, a.structure, a.at)) return false;
      const plan = buildPlan(s, a.structure, a.at);
      take(s, 'wood', plan.wood);
      take(s, 'straw', plan.straw);
      s.structures.push({
        id: newId(s, 's'), type: a.structure, at: { x: a.at.x, y: a.at.y }, built: false, work: 0,
        workNeeded: plan.days, clearedWood: plan.clearedWood,
      });
      log(s, 'info', `Work begins on a ${STRUCTURES[a.structure].name.toLowerCase()} (${Math.round(plan.days)} builder-days${plan.trees ? `, ${plan.trees} wooded tiles to clear` : ''}).`);
      return true;
    }

    case 'cancelBuild': {
      const x = s.structures.find((v) => v.id === a.structureId);
      if (!x || x.built) return false;
      const def = STRUCTURES[x.type];
      add(s, 'wood', def.wood / 2, 0.6);
      add(s, 'straw', def.straw / 2, 0.6);
      s.structures = s.structures.filter((v) => v !== x);
      log(s, 'info', `Work on the ${def.name.toLowerCase()} was abandoned; half the materials were saved.`);
      return true;
    }

    case 'setTarget':
      if (a.qty < 0) return false;
      s.targets[a.item] = Math.floor(a.qty);
      return true;

    case 'slaughter': {
      const n = Math.floor(a.count);
      if (n < 1 || n > s.goats) return false;
      s.goats -= n;
      add(s, 'meat', n * GOAT_MEAT_KG, 0.7);
      add(s, 'raw_hide', n, 0.6);
      log(s, 'info', `${n} goat${n > 1 ? 's were' : ' was'} slaughtered: ${n * GOAT_MEAT_KG} kg of meat and ${n} hide${n > 1 ? 's' : ''}.`);
      return true;
    }

    case 'expedition': {
      const cargo = a.cargo ?? {};
      if (expeditionBlocker(s, a.kind, a.target, a.members, cargo)) return false;
      if (a.kind === 'hunt') take(s, 'arrows', a.members.length);
      for (const [item, n] of Object.entries(cargo) as [ItemId, number][]) take(s, item, n);
      const id = newId(s, 'e');
      for (const pid of a.members) s.people.find((p) => p.id === pid)!.away = id;
      s.expeditions.push({
        id, kind: a.kind, target: a.target, members: [...a.members], departed: s.day,
        returns: s.day + expeditionDays(a.kind, a.target), cargo: { ...cargo }, wants: [...(a.wants ?? [])],
      });
      const names = a.members.map((pid) => s.people.find((p) => p.id === pid)!.name).join(', ');
      log(s, 'info', `${names} set out ${a.kind === 'hunt' ? 'to hunt' : a.kind === 'flint' ? 'for flint' : 'to trade'}.`);
      checkDiscoveries(s);
      return true;
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
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Saves from before era 1 (versions 1–2) belong to a different game and are not carried over. */
export function migrate(raw: unknown): GameState | null {
  const s = raw as GameState;
  if (!s || typeof s !== 'object' || s.version !== SAVE_VERSION) return null;
  return s;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
