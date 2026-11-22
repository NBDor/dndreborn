import { describe, expect, it } from 'vitest';
import { QUESTS, RECIPES, TICKS_PER_DAY } from './data';
import { createInitialState, reduce } from './engine';
import { buildBlocker, buildCost, partyPower, qty, successChance } from './rules';
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
    reduce(s, { type: 'build', building: 'house' });
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
    s = run(s, { type: 'build', building: 'quarry' });
    expect(s.construction?.building).toBe('quarry');
    expect(s.gold).toBe(120 - cost.gold);
    expect(buildBlocker(s, 'house')).toBe('Builders are busy');
    s = ticks(s, s.construction!.endsTick);
    expect(s.buildings.quarry).toBe(1);
    expect(s.construction).toBeNull();
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
});
