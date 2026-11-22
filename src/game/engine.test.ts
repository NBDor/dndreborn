import { describe, expect, it } from 'vitest';
import { DAYS_PER_SEASON, QUESTS, RECIPES, TICKS_PER_DAY } from './data';
import { createInitialState, migrate, reduce } from './engine';
import { DEFAULT_SPOTS } from './map';
import {
  buildBlocker, buildCost, firewoodPerDay, partyPower, placedPlots, placementBlocker, productionPerDay, qty, season,
  successChance,
} from './rules';
import type { Action, Adventurer, GameState } from './types';

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reduce, s);
const ticks = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s = reduce(s, { type: 'tick' });
  return s;
};

const adventurer = (over: Partial<Adventurer> = {}): Adventurer => ({
  id: 'a1', name: 'Test', cls: 'warrior', level: 1, xp: 0, fee: 5, leavesOnDay: 99, status: 'idle', questsCompleted: 0,
  ...over,
});

describe('engine', () => {
  it('is deterministic for a given seed', () => {
    const a = ticks(createInitialState(42), TICKS_PER_DAY * 10);
    const b = ticks(createInitialState(42), TICKS_PER_DAY * 10);
    expect(a).toEqual(b);
  });

  it('does not mutate the previous state', () => {
    const s = createInitialState(1);
    const snapshot = structuredClone(s);
    ticks(s, 30);
    reduce(s, { type: 'build', building: 'house', at: { x: 3, y: 3 } });
    expect(s).toEqual(snapshot);
  });

  it('produces and consumes resources over a day', () => {
    const s = createInitialState(7);
    const after = ticks(s, TICKS_PER_DAY);
    // farm 1 (+4) minus 5 villagers (-5), roughly; a harvest event could add more
    expect(qty(after, 'wood')).toBeGreaterThan(qty(s, 'wood'));
    expect(after.gold).toBeGreaterThan(s.gold - 10);
  });

  it('builds a structure after its construction time', () => {
    let s = createInitialState(3);
    const cost = buildCost('quarry', 1);
    expect(reduce(s, { type: 'build', building: 'quarry' })).toBe(s); // a new building needs a spot
    s = run(s, { type: 'build', building: 'quarry', at: { x: 12, y: 1 } });
    expect(s.construction?.building).toBe('quarry');
    expect(s.gold).toBe(120 - cost.gold);
    expect(buildBlocker(s, 'house')).toBe('Builders are busy');
    s = ticks(s, s.construction!.endsTick);
    expect(s.buildings.quarry).toBe(1);
    expect(s.placements.quarry).toEqual({ x: 12, y: 1 });
    expect(s.construction).toBeNull();
  });

  it('upgrades an existing building in place without a spot', () => {
    let s = createInitialState(3);
    s = run(s, { type: 'build', building: 'farm' });
    expect(s.construction).toMatchObject({ building: 'farm', targetLevel: 2 });
    expect(s.construction?.at).toBeUndefined();
  });

  it('validates building placement', () => {
    const s = createInitialState(3);
    expect(placementBlocker(s, 'quarry', { x: 14, y: 1 })).toBe('Off the map');
    expect(placementBlocker(s, 'smithy', { x: 7, y: 2 })).toBe('Blocks the road');
    expect(placementBlocker(s, 'smithy', { x: 5, y: 5 })).toBe('Space is taken'); // overlaps town hall
    expect(placementBlocker(s, 'smithy', { x: 10, y: 1 })).toBeNull();
    expect(reduce(s, { type: 'build', building: 'quarry', at: { x: 14, y: 1 } })).toBe(s);
  });

  it('adds a cottage at a chosen spot for each house level', () => {
    let s = createInitialState(4);
    s = { ...s, gold: 999, inventory: { ...s.inventory, wood: 999 } };
    s = run(s, { type: 'build', building: 'house', at: { x: 3, y: 14 } });
    expect(placedPlots(s).some((p) => p.underConstruction && p.plot.x === 3 && p.plot.y === 14)).toBe(true);
    expect(placementBlocker(s, 'house', { x: 3, y: 14 })).toBe('Space is taken');
    s = ticks(s, s.construction!.endsTick);
    expect(s.buildings.house).toBe(2);
    expect(s.houses).toHaveLength(2);
    expect(s.houses[1]).toEqual({ x: 3, y: 14 });
  });

  it('rejects invalid actions by returning the same state', () => {
    const s = createInitialState(3);
    expect(reduce(s, { type: 'craft', recipeId: 'planks' })).toBe(s); // no workshop
    expect(reduce(s, { type: 'sell', item: 'wood', qty: 1 })).toBe(s); // no market
    expect(reduce(s, { type: 'build', building: 'town_hall' })).toBe(s); // needs reputation
  });

  it('crafts items at a station', () => {
    let s = createInitialState(3);
    s = { ...s, buildings: { ...s.buildings, workshop: 1 } };
    s = run(s, { type: 'craft', recipeId: 'planks', times: 5 });
    expect(qty(s, 'planks')).toBe(5);
    expect(qty(s, 'wood')).toBe(50);
    const tools = RECIPES.find((r) => r.id === 'tools')!;
    expect(reduce(s, { type: 'craft', recipeId: tools.id })).toBe(s);
  });

  it('trades at the market', () => {
    let s = createInitialState(3);
    s = { ...s, buildings: { ...s.buildings, market: 1 } };
    const gold = s.gold;
    s = run(s, { type: 'sell', item: 'stone', qty: 10 });
    expect(qty(s, 'stone')).toBe(20);
    expect(s.gold).toBeGreaterThan(gold);
  });

  it('sends adventurers on quests and resolves them', () => {
    let s = createInitialState(5);
    s = { ...s, gold: 500, adventurers: [adventurer({ level: 5 })] };
    s = run(s, { type: 'startQuest', templateId: 'cellar_rats', partyIds: ['a1'], supplies: {} });
    expect(s.quests).toHaveLength(1);
    expect(s.adventurers[0].status).toBe('questing');
    expect(s.gold).toBe(495);
    s = ticks(s, TICKS_PER_DAY);
    expect(s.quests).toHaveLength(0);
    // 95% chance; seed 5 is a success
    expect(s.reputation).toBeGreaterThanOrEqual(1);
    expect(s.adventurers[0]?.questsCompleted).toBe(1);
  });

  it('gives warriors double gear bonus and caps chance', () => {
    const war = adventurer();
    const mage = adventurer({ id: 'a2', cls: 'mage' });
    expect(partyPower([war], { iron_sword: 1 })).toBe(4 + 6);
    expect(partyPower([mage], { iron_sword: 1 })).toBe(5 + 3);
    expect(partyPower([mage, war], { iron_sword: 1 })).toBe(5 + 4 + 6);
    const dragon = QUESTS.find((q) => q.id === 'dragon_lair')!;
    expect(successChance(dragon, [war], {})).toBe(0.05);
    expect(successChance(QUESTS[0], [adventurer({ level: 10 })], {})).toBe(0.95);
  });

  it('loses villagers when food runs out', () => {
    let s = createInitialState(9);
    s = { ...s, inventory: { ...s.inventory, food: 0 }, buildings: { ...s.buildings, farm: 0 } };
    s = ticks(s, TICKS_PER_DAY);
    expect(s.population).toBe(4);
  });

  it('cycles seasons that change farm output', () => {
    const s = createInitialState(11);
    s.buildings.farm = 2;
    s.population = 20; // fully staffed
    const at = (d: number) => ({ ...s, tick: (d - 1) * TICKS_PER_DAY });
    expect(season(at(1)).id).toBe('spring');
    expect(season(at(1 + DAYS_PER_SEASON)).id).toBe('summer');
    expect(season(at(1 + DAYS_PER_SEASON * 3)).id).toBe('winter');
    expect(season(at(1 + DAYS_PER_SEASON * 4)).id).toBe('spring');
    expect(productionPerDay(at(1 + DAYS_PER_SEASON)).food).toBeCloseTo(8 * 1.25);
    expect(productionPerDay(at(1 + DAYS_PER_SEASON * 3)).food).toBeCloseTo(8 * 0.35);
  });

  it('burns firewood in winter and loses villagers when it runs out', () => {
    let s = createInitialState(12);
    s = { ...s, tick: DAYS_PER_SEASON * 3 * TICKS_PER_DAY, inventory: { ...s.inventory, food: 500, wood: 0 } };
    s = { ...s, buildings: { ...s.buildings, lumber_camp: 0 } };
    expect(firewoodPerDay(s)).toBeCloseTo(5 * 0.4);
    s = ticks(s, TICKS_PER_DAY);
    expect(s.population).toBe(4);
  });

  it('migrates version 1 saves to the fixed layout', () => {
    const v1 = createInitialState(13) as unknown as Record<string, unknown>;
    delete v1.placements;
    delete v1.houses;
    delete v1.freezing;
    v1.version = 1;
    (v1.buildings as Record<string, number>).house = 3;
    v1.construction = { building: 'market', targetLevel: 1, endsTick: 50 };
    const s = migrate(v1)!;
    expect(s.version).toBe(2);
    expect(s.placements.town_hall).toEqual(DEFAULT_SPOTS.town_hall);
    expect(s.houses).toHaveLength(3);
    expect(s.construction?.at).toEqual(DEFAULT_SPOTS.market);
  });
});
