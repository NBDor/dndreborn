// Derived values and validation, shared by the engine and the UI. Nothing here changes state.
import {
  CARRY_KG, CHILD_AGE, CLAY_PER_DAY, CLEAR_DAYS, CLEAR_WOOD, COOKING_WOOD, DAYS_PER_SEASON, DAYS_PER_YEAR, ELDER_AGE,
  FOODS, GOAT_FODDER_KG, GOATS_PER_HERDER, GOATS_PER_PEN, GRANARY_KG, GROW_DAYS, HELPER_AGE, ITEMS, JOBS, KCAL_ADULT,
  KCAL_CHILD, KCAL_ELDER, NEIGHBORS, PREY, RECIPES, SEASONS, SEED_KG, STRUCTURES, TECHS, type NeighborDef,
  type SeasonDef,
} from './data';
import { GRID, hasTree, isRiver, plotAt, plotTiles, tileKey, type Plot } from './map';
import type {
  Amounts, ExpeditionKind, GameState, ItemId, JobId, Neighbor, Person, SkillId, Structure, StructureType, TechId, Tile,
} from './types';

// ---------------------------------------------------------------- calendar

export const year = (s: GameState) => Math.floor(s.day / DAYS_PER_YEAR) + 1;
export const dayOfYear = (s: GameState) => s.day % DAYS_PER_YEAR;
export const seasonIndex = (s: GameState) => Math.floor(dayOfYear(s) / DAYS_PER_SEASON);
export const season = (s: GameState): SeasonDef => SEASONS[seasonIndex(s)];
export const dayOfSeason = (s: GameState) => (dayOfYear(s) % DAYS_PER_SEASON) + 1;

// ---------------------------------------------------------------- stores

export const qty = (s: GameState, item: ItemId) => s.inventory[item]?.qty ?? 0;
export const quality = (s: GameState, item: ItemId) => s.inventory[item]?.q ?? 0;

export function storedKcal(s: GameState): number {
  return FOODS.reduce((sum, id) => sum + qty(s, id) * (ITEMS[id].kcal ?? 0), 0);
}

export function hasAmounts(s: GameState, need: Amounts, times = 1): boolean {
  return (Object.entries(need) as [ItemId, number][]).every(([id, n]) => qty(s, id) >= n * times - 1e-9);
}

export function weightOf(a: Amounts): number {
  return (Object.entries(a) as [ItemId, number][]).reduce((sum, [id, n]) => sum + n * ITEMS[id].weight, 0);
}

// ---------------------------------------------------------------- people

export const age = (p: Person, day: number) => (day - p.born) / DAYS_PER_YEAR;
export const isChild = (p: Person, day: number) => age(p, day) < CHILD_AGE;
export const isHelper = (p: Person, day: number) => age(p, day) >= HELPER_AGE && age(p, day) < CHILD_AGE;
export const isElder = (p: Person, day: number) => age(p, day) >= ELDER_AGE;
export const canWorkAge = (p: Person, day: number) => age(p, day) >= HELPER_AGE;

export function kcalNeed(p: Person, day: number): number {
  if (isChild(p, day)) return KCAL_CHILD;
  if (isElder(p, day)) return KCAL_ELDER;
  return KCAL_ADULT;
}

export const isUnwell = (p: Person, day: number) => (p.unwellUntil ?? -1) > day;
export const isAvailable = (p: Person, day: number) => !p.away && !isUnwell(p, day) && canWorkAge(p, day);

export const skill = (p: Person, id: SkillId) => p.skills[id] ?? 0;

/** How much a person gets done in a day at a job, before tools: skill, age and health all count. */
export function workRate(p: Person, day: number, job: JobId): number {
  const sk = JOBS[job].skill;
  const s = sk ? skill(p, sk) : 30;
  let rate = 0.4 + 0.6 * (s / 100);
  if (isHelper(p, day)) rate *= 0.35;
  else if (isElder(p, day)) rate *= 0.7;
  if (p.health < 40) rate *= 0.5 + p.health / 80;
  return rate;
}

export function bestAt(people: Person[], id: SkillId): number {
  return people.reduce((m, p) => Math.max(m, skill(p, id)), 0);
}

export const workers = (s: GameState, job: JobId) => s.people.filter((p) => p.job === job && isAvailable(p, s.day));

// ---------------------------------------------------------------- structures

export const structuresOf = (s: GameState, type: StructureType, builtOnly = true) =>
  s.structures.filter((x) => x.type === type && (!builtOnly || x.built));

export const housing = (s: GameState) =>
  s.structures.reduce((sum, x) => sum + (x.built ? (STRUCTURES[x.type].housing ?? 0) : 0), 0);
export const granaryCapacity = (s: GameState) => structuresOf(s, 'granary').length * GRANARY_KG;
export const penCapacity = (s: GameState) => structuresOf(s, 'pen').length * GOATS_PER_PEN;
export const herdersNeeded = (s: GameState) => Math.ceil(s.goats / GOATS_PER_HERDER);

export const plotOf = (x: Structure): Plot => plotAt(x.type, x.at);

export function occupied(s: GameState, except?: string): Set<string> {
  const set = new Set<string>();
  for (const x of s.structures) if (x.id !== except) for (const t of plotTiles(plotOf(x))) set.add(tileKey(t));
  return set;
}

export const treeStands = (s: GameState, x: number, y: number) => hasTree(x, y) && !s.cleared.includes(`${x},${y}`);

/** Reason a structure cannot go at this spot, or null. */
export function placementBlocker(s: GameState, type: StructureType, at: Tile): string | null {
  const plot = plotAt(type, at);
  if (plot.x < 0 || plot.y < 0 || plot.x + plot.w > GRID || plot.y + plot.d > GRID) return 'Off the map';
  const taken = occupied(s);
  for (const t of plotTiles(plot)) {
    if (isRiver(t.x, t.y)) return 'In the river';
    if (taken.has(tileKey(t))) return 'Space is taken';
  }
  return null;
}

/** Trees that must be felled to build here. */
export function treesOn(s: GameState, type: StructureType, at: Tile): number {
  return plotTiles(plotAt(type, at)).filter((t) => treeStands(s, t.x, t.y)).length;
}

export function buildPlan(s: GameState, type: StructureType, at: Tile) {
  const def = STRUCTURES[type];
  const trees = treesOn(s, type, at);
  return {
    trees,
    days: def.days + def.clay / CLAY_PER_DAY + trees * CLEAR_DAYS,
    wood: def.wood,
    straw: def.straw,
    clearedWood: trees * CLEAR_WOOD,
  };
}

/** Reason the village cannot start this structure at all (ignoring where), or null. */
export function buildBlocker(s: GameState, type: StructureType): string | null {
  const def = STRUCTURES[type];
  if (!def.buildable) return 'Cannot be built';
  if (def.tech && !s.known.includes(def.tech)) return `Needs ${TECHS[def.tech].name}`;
  const missing: string[] = [];
  if (qty(s, 'wood') < def.wood) missing.push(`${Math.ceil(def.wood - qty(s, 'wood'))} kg wood`);
  if (qty(s, 'straw') < def.straw) missing.push(`${Math.ceil(def.straw - qty(s, 'straw'))} kg straw`);
  return missing.length ? `Missing ${missing.join(', ')}` : null;
}

// ---------------------------------------------------------------- knowledge

export type TechStatus = 'known' | 'available' | 'locked' | 'future';

export function techStatus(s: GameState, id: TechId): TechStatus {
  const t = TECHS[id];
  if (s.known.includes(id)) return 'known';
  if (t.future) return 'future';
  if (!t.prereqs.every((p) => s.known.includes(p))) return 'locked';
  if (t.needs && structuresOf(s, t.needs).length === 0) return 'locked';
  return 'available';
}

export const recipesFor = (s: GameState, job: JobId) =>
  RECIPES.filter((r) => r.job === job && (!r.tech || s.known.includes(r.tech)));

// ---------------------------------------------------------------- expeditions and trade

export const neighborDef = (id: string): NeighborDef => NEIGHBORS.find((n) => n.id === id)!;
export const prey = (id: string) => PREY.find((p) => p.id === id)!;

/** What a neighbour will give or take for one unit, in labour-days: scarce things are worth more to them. */
export function neighborValue(n: Neighbor, item: ItemId): number {
  const def = neighborDef(n.id);
  const base = ITEMS[item].value;
  if (def.lacks.includes(item)) return base * 2;
  if (def.makes[item]) return base * 0.8;
  return base;
}

export function expeditionDays(kind: ExpeditionKind, target: string): number {
  if (kind === 'hunt') return prey(target).days;
  const d = neighborDef(target).days;
  return kind === 'flint' ? d * 2 + 1 : d * 2;
}

export function expeditionBlocker(s: GameState, kind: ExpeditionKind, target: string, members: string[], cargo: Amounts = {}): string | null {
  if (members.length === 0) return 'Choose who goes';
  const people = members.map((id) => s.people.find((p) => p.id === id));
  if (people.some((p) => !p || !isAvailable(p, s.day) || isHelper(p, s.day))) return 'Someone is unavailable';
  if (kind === 'hunt') {
    const def = prey(target);
    if (members.length < def.minHunters) return `Needs at least ${def.minHunters} hunters`;
    if (qty(s, 'arrows') < members.length) return `Each hunter needs a bundle of arrows (${Math.floor(qty(s, 'arrows'))} left)`;
  }
  if (kind === 'trade') {
    if (!hasAmounts(s, cargo)) return 'Not enough goods in store';
    const w = weightOf(cargo);
    if (w > members.length * CARRY_KG) return `Too heavy: ${Math.ceil(w)} kg for ${members.length} carrying ${CARRY_KG} kg each`;
  }
  return null;
}

// ---------------------------------------------------------------- summaries for the UI

export type FieldStage = 'unsown' | 'sowing' | 'growing' | 'ripe';

export function fieldStage(f: NonNullable<Structure['field']>, day: number): FieldStage {
  if (f.sownOn === null) return f.sowWork > 0 ? 'sowing' : 'unsown';
  return day - f.sownOn >= GROW_DAYS ? 'ripe' : 'growing';
}

export const dailyKcal = (s: GameState) =>
  s.people.filter((p) => !p.away).reduce((sum, p) => sum + kcalNeed(p, s.day), 0);

/** Days the food in store would last with nothing new coming in. */
export const foodDays = (s: GameState) => storedKcal(s) / Math.max(1, dailyKcal(s));

/** Firewood a whole winter needs, kg. */
export function winterWood(s: GameState): number {
  const houses = Math.min(Math.ceil(s.people.length / 8), s.structures.filter((x) => x.built && STRUCTURES[x.type].housing).length);
  return (s.people.length * COOKING_WOOD + houses * SEASONS[3].heating) * DAYS_PER_SEASON;
}

export interface Warning {
  level: 'bad' | 'warn';
  text: string;
}

/** The headman's worries: what will go wrong soon if nothing changes. */
export function warnings(s: GameState): Warning[] {
  const out: Warning[] = [];
  const se = season(s).id;
  const fields = structuresOf(s, 'field').map((f) => fieldStage(f.field!, s.day));
  const farmers = workers(s, 'farmer').length;
  const days = foodDays(s);

  if (days < 20) out.push({ level: 'bad', text: `Food for only ${Math.floor(days)} days. Gather, hunt, fish or slaughter goats.` });
  else if (days < 45 && se !== 'autumn') out.push({ level: 'warn', text: `Food stores will last about ${Math.floor(days)} days.` });
  if (s.report.hungry) out.push({ level: 'bad', text: 'People are going hungry.' });
  if (se === 'spring' && fields.includes('unsown') && farmers === 0) out.push({ level: 'bad', text: 'Fields lie unsown and nobody is farming. Sowing must finish this spring.' });
  if (se === 'spring' && fields.includes('unsown') && qty(s, 'grain') < SEED_KG) out.push({ level: 'bad', text: 'Not enough seed grain to sow.' });
  if (fields.includes('ripe') && farmers === 0) out.push({ level: 'bad', text: 'Grain is ripe and nobody is harvesting: it is shattering in the field.' });
  if ((se === 'autumn' || se === 'winter') && qty(s, 'wood') < winterWood(s) * (se === 'winter' ? 0.3 : 1)) {
    out.push({ level: se === 'winter' ? 'bad' : 'warn', text: `Firewood is short for winter (about ${Math.round(winterWood(s) / 1000)} t needed). Put people on woodcutting.` });
  }
  const garments = Math.floor(qty(s, 'clothing'));
  if ((se === 'autumn' || se === 'winter') && garments < s.people.length) out.push({ level: se === 'winter' ? 'bad' : 'warn', text: `Only ${garments} warm garments for ${s.people.length} people.` });
  if (s.people.length > housing(s)) out.push({ level: se === 'winter' ? 'bad' : 'warn', text: `${s.people.length - housing(s)} people have no roof. Build a longhouse.` });
  if (s.goats > 0 && workers(s, 'herder').length === 0) out.push({ level: 'warn', text: 'No one is herding: wolves will take the goats.' });
  if (s.goats > penCapacity(s)) out.push({ level: 'warn', text: 'The goat pen is overcrowded.' });
  if (se === 'autumn' && qty(s, 'fodder') < s.goats * GOAT_FODDER_KG * DAYS_PER_SEASON) out.push({ level: 'warn', text: 'Not enough fodder for the herd this winter: cut more or slaughter some goats.' });
  for (const tool of ['axe', 'sickle'] as ItemId[]) if (qty(s, tool) < 1) out.push({ level: 'warn', text: `No ${ITEMS[tool].name.toLowerCase()}s left. The knapper needs flint.` });
  for (const r of RECIPES) {
    const target = s.targets[r.id] ?? 0;
    if ((r.tech && !s.known.includes(r.tech)) || qty(s, r.id) >= target / 2) continue;
    if (workers(s, r.job).length === 0) out.push({ level: 'warn', text: `${ITEMS[r.id].name} running low and no one works as a ${JOBS[r.job].name.toLowerCase()}.` });
  }
  // Knowledge held by a single ageing person.
  for (const sk of ['knapping', 'herding', 'farming', 'hideworking'] as SkillId[]) {
    const experts = s.people.filter((p) => skill(p, sk) >= 50);
    if (experts.length === 1 && age(experts[0], s.day) >= 50) {
      out.push({ level: 'warn', text: `Only ${experts[0].name} (${Math.floor(age(experts[0], s.day))}) really knows ${sk}. Have someone learn by working alongside them.` });
    }
  }
  return out;
}
