// Derived values and validation rules, shared by the engine and the UI.
import {
  BASE_HOUSING, BASE_STORAGE, BUILDINGS, BUILDING_ORDER, CLASSES, FOOD_PER_VILLAGER, HOUSING_PER_HOUSE, ITEMS,
  QUESTS, STORAGE_PER_WAREHOUSE, TAX_PER_VILLAGER, TICKS_PER_DAY, TOWN_HALL_REPUTATION, UPKEEP_PER_LEVEL,
  type QuestTemplate, type RecipeDef,
} from './data';
import type { Adventurer, BuildingId, GameState, Inventory, ItemId } from './types';

export interface Cost {
  gold: number;
  items: Inventory;
}

export const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
export const hourOfDay = (s: GameState) => s.tick % TICKS_PER_DAY;

export const qty = (s: GameState, item: ItemId) => s.inventory[item] ?? 0;
export const storageCap = (s: GameState) => BASE_STORAGE + s.buildings.warehouse * STORAGE_PER_WAREHOUSE;
export const housingCap = (s: GameState) => BASE_HOUSING + s.buildings.house * HOUSING_PER_HOUSE;

export function jobsNeeded(s: GameState): number {
  return BUILDING_ORDER.reduce((sum, id) => sum + BUILDINGS[id].workersPerLevel * s.buildings[id], 0);
}

/** Share of jobs that are staffed, 0..1. Production scales with it. */
export function workforce(s: GameState): number {
  const jobs = jobsNeeded(s);
  return jobs === 0 ? 1 : Math.min(1, s.population / jobs);
}

/** Gross production per day, before consumption. */
export function productionPerDay(s: GameState): Inventory {
  const out: Inventory = {};
  const eff = workforce(s);
  for (const id of BUILDING_ORDER) {
    const p = BUILDINGS[id].produces;
    if (p && s.buildings[id] > 0) out[p.item] = (out[p.item] ?? 0) + p.perLevelPerDay * s.buildings[id] * eff;
  }
  return out;
}

export const foodUsePerDay = (s: GameState) => s.population * FOOD_PER_VILLAGER;
export const taxesPerDay = (s: GameState) => s.population * TAX_PER_VILLAGER;
export function upkeepPerDay(s: GameState): number {
  const levels = BUILDING_ORDER.reduce((sum, id) => sum + (id === 'house' ? 0 : s.buildings[id]), 0);
  return levels * UPKEEP_PER_LEVEL;
}

// ---------------------------------------------------------------- buildings

export function maxLevelFor(s: GameState, id: BuildingId): number {
  if (id === 'town_hall') return BUILDINGS.town_hall.maxLevel;
  return Math.min(BUILDINGS[id].maxLevel, s.buildings.town_hall * 2 + 1);
}

export function buildCost(id: BuildingId, targetLevel: number): Cost {
  const def = BUILDINGS[id];
  const scale = Math.pow(def.costGrowth, targetLevel - 1);
  const items: Inventory = {};
  for (const [item, n] of Object.entries(def.baseCost.items) as [ItemId, number][]) {
    items[item] = Math.round(n * scale);
  }
  // Higher tiers need finer materials.
  if (targetLevel >= 3) items.planks = (items.planks ?? 0) + (targetLevel - 2) * 5;
  if (targetLevel >= 4) items.tools = (items.tools ?? 0) + (targetLevel - 3);
  return { gold: Math.round(def.baseCost.gold * scale), items };
}

export function buildHours(id: BuildingId, targetLevel: number): number {
  return Math.round(BUILDINGS[id].buildHours * (1 + (targetLevel - 1) * 0.5));
}

export function missingFor(s: GameState, cost: Cost): string[] {
  const missing: string[] = [];
  if (s.gold < cost.gold) missing.push(`${Math.ceil(cost.gold - s.gold)} gold`);
  for (const [item, n] of Object.entries(cost.items) as [ItemId, number][]) {
    const have = qty(s, item);
    if (have < n) missing.push(`${Math.ceil(n - have)} ${ITEMS[item].name}`);
  }
  return missing;
}

/** Reason the building cannot be started now, or null if it can. */
export function buildBlocker(s: GameState, id: BuildingId): string | null {
  const target = s.buildings[id] + 1;
  if (target > BUILDINGS[id].maxLevel) return 'Max level';
  if (target > maxLevelFor(s, id)) return `Needs Town Hall ${Math.ceil((target - 1) / 2)}`;
  if (id === 'town_hall') {
    const rep = TOWN_HALL_REPUTATION[target] ?? 0;
    if (s.reputation < rep) return `Needs ${rep} reputation`;
  }
  if (s.construction) return 'Builders are busy';
  const missing = missingFor(s, buildCost(id, target));
  return missing.length ? `Missing ${missing.join(', ')}` : null;
}

// ---------------------------------------------------------------- crafting

export function recipeBlocker(s: GameState, r: RecipeDef, times = 1): string | null {
  if (s.buildings[r.station] < r.stationLevel) return `Needs ${BUILDINGS[r.station].name} ${r.stationLevel}`;
  const inputs: Inventory = {};
  for (const [item, n] of Object.entries(r.inputs) as [ItemId, number][]) inputs[item] = n * times;
  const missing = missingFor(s, { gold: 0, items: inputs });
  if (missing.length) return `Missing ${missing.join(', ')}`;
  if (qty(s, r.output) + r.qty * times > storageCap(s)) return 'Storage full';
  return null;
}

// ---------------------------------------------------------------- market

export const buyPrice = (s: GameState, item: ItemId) =>
  Math.ceil(ITEMS[item].value * (1.6 - 0.08 * s.buildings.market));
export const sellPrice = (s: GameState, item: ItemId) =>
  Math.max(1, Math.floor(ITEMS[item].value * (0.5 + 0.08 * s.buildings.market) * 10) / 10);

// ---------------------------------------------------------------- quests

export const questTemplate = (id: string) => QUESTS.find((q) => q.id === id);

export const questUnlocked = (s: GameState, q: QuestTemplate) => s.reputation >= q.minReputation;

export function questDays(q: QuestTemplate, party: Adventurer[]): number {
  return Math.max(1, q.days - (party.some((a) => a.cls === 'ranger') ? 1 : 0));
}

export function adventurerPower(a: Adventurer): number {
  return a.level * CLASSES[a.cls].powerPerLevel;
}

/** Party power including gear. Warriors get gear first and get double from it. */
export function partyPower(party: Adventurer[], supplies: Inventory): number {
  let power = party.reduce((sum, a) => sum + adventurerPower(a), 0);
  const order = [...party].sort((a, b) => Number(b.cls === 'warrior') - Number(a.cls === 'warrior'));
  const gear: [ItemId, number][] = [['iron_sword', 3], ['leather_armor', 2]];
  for (const [item, bonus] of gear) {
    const n = Math.min(supplies[item] ?? 0, party.length);
    for (let i = 0; i < n; i++) power += bonus * (order[i].cls === 'warrior' ? 2 : 1);
  }
  return power;
}

export function successChance(q: QuestTemplate, party: Adventurer[], supplies: Inventory): number {
  if (party.length === 0) return 0;
  const ratio = partyPower(party, supplies) / q.difficulty;
  const rations = Math.min(0.15, (supplies.rations ?? 0) * 0.03);
  const potions = Math.min(0.2, (supplies.healing_potion ?? 0) * 0.04);
  const chance = 0.5 + (ratio - 1) * 0.6 + rations + potions;
  return Math.min(0.95, Math.max(0.05, chance));
}

export const partyFee = (party: Adventurer[]) => party.reduce((sum, a) => sum + a.fee, 0);

export function questBlocker(s: GameState, q: QuestTemplate, party: Adventurer[], supplies: Inventory): string | null {
  if (!questUnlocked(s, q)) return `Needs ${q.minReputation} reputation`;
  if (party.length === 0) return 'Choose at least one adventurer';
  if (party.length > q.maxParty) return `At most ${q.maxParty} adventurers`;
  if (party.some((a) => a.status !== 'idle')) return 'Adventurer unavailable';
  const fee = partyFee(party);
  const missing = missingFor(s, { gold: fee, items: supplies });
  return missing.length ? `Missing ${missing.join(', ')}` : null;
}

export const xpToNext = (a: Adventurer) => a.level * 10;
