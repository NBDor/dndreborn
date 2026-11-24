import { describe, expect, it } from 'vitest';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, GROW_DAYS, HARVEST_DAYS, SEED_KG, SOW_DAYS } from './data';
import { createInitialState, migrate, reduce } from './engine';
import {
  buildBlocker, expeditionBlocker, placementBlocker, qty, season, storedKcal, structuresOf, techStatus, treesOn,
} from './rules';
import { seedReserve } from './sim';
import type { Action, GameState, JobId } from './types';

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reduce, s);
const days = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s = reduce(s, { type: 'tick' });
  return s;
};
const person = (s: GameState, name: string) => s.people.find((p) => p.name === name)!;
const assignAll = (s: GameState, job: JobId, names: string[]) =>
  run(s, ...names.map((n) => ({ type: 'assign', personId: person(s, n).id, job }) as Action));

describe('engine', () => {
  it('is deterministic for a given seed', () => {
    expect(days(createInitialState(42), 200)).toEqual(days(createInitialState(42), 200));
  });

  it('does not mutate the previous state', () => {
    const s = createInitialState(1);
    const snapshot = structuredClone(s);
    days(s, 30);
    reduce(s, { type: 'build', structure: 'field', at: { x: 6, y: 15 } });
    expect(s).toEqual(snapshot);
  });

  it('starts in spring with settlers, two fields, a pen and seed grain', () => {
    const s = createInitialState(1);
    expect(season(s).id).toBe('spring');
    expect(s.people).toHaveLength(16);
    expect(structuresOf(s, 'field')).toHaveLength(2);
    expect(qty(s, 'grain')).toBe(1400);
    expect(s.known).not.toContain('pottery');
  });

  it('feeds people from stores and loses health when food runs out', () => {
    let s = createInitialState(2);
    const kcal = storedKcal(s);
    s = days(s, 1);
    expect(storedKcal(s)).toBeLessThan(kcal);
    expect(s.report.kcalEaten).toBeCloseTo(s.report.kcalNeeded, 0);

    let hungry = createInitialState(2);
    hungry = { ...hungry, inventory: { wood: { qty: 500, q: 0.5 } }, goats: 0 };
    hungry = assignAll(hungry, 'idle', hungry.people.map((p) => p.name).filter((n) => !['Mira', 'Joss', 'Neve', 'Kel'].includes(n)));
    const before = hungry.people[2].health;
    hungry = days(hungry, 5);
    expect(hungry.report.hungry).toBeGreaterThan(0);
    expect(hungry.people[2].health).toBeLessThan(before);
  });

  it('sows in spring, grows for four months and harvests grain and straw', () => {
    let s = createInitialState(3);
    s = assignAll(s, 'farmer', ['Aru', 'Bena', 'Esk', 'Vann', 'Doran']);
    const grain0 = qty(s, 'grain');
    s = days(s, 10);
    const fields = structuresOf(s, 'field');
    expect(fields.every((f) => f.field!.sownOn !== null)).toBe(true);
    expect(qty(s, 'grain')).toBeLessThan(grain0 - 2 * SEED_KG + 1); // seed came out of the store (plus eating)
    const sown = Math.max(...fields.map((f) => f.field!.sownOn!));
    s = days(s, sown + GROW_DAYS + HARVEST_DAYS * 2 - s.day);
    expect(structuresOf(s, 'field').every((f) => f.field!.sownOn === null && f.field!.harvestedOn)).toBe(true);
    expect(qty(s, 'straw')).toBeGreaterThan(400 + 600); // two harvests' worth of straw on top of the start
    expect(SOW_DAYS).toBeGreaterThan(0);
  });

  it('keeps seed grain back from eating', () => {
    const s = createInitialState(4);
    expect(seedReserve(s)).toBe(2 * SEED_KG);
  });

  it('places structures only on free land, and clearing trees costs work but yields wood', () => {
    const s = createInitialState(5);
    expect(placementBlocker(s, 'field', { x: 17, y: 0 })).toBe('Off the map');
    expect(placementBlocker(s, 'granary', { x: 14, y: 8 })).toBe('In the river');
    expect(placementBlocker(s, 'granary', { x: 8, y: 7 })).toBe('Space is taken');
    expect(treesOn(s, 'field', { x: 0, y: 0 })).toBeGreaterThan(0);
    expect(buildBlocker(s, 'kiln')).toBe('Needs Updraft kiln');
    let b = run(s, { type: 'build', structure: 'field', at: { x: 0, y: 0 } });
    const site = b.structures.at(-1)!;
    expect(site.built).toBe(false);
    expect(site.clearedWood).toBeGreaterThan(0);
    b = assignAll(b, 'builder', ['Doran', 'Vann', 'Esk', 'Maro']);
    b = days(b, Math.ceil(site.workNeeded / 2.5) + 2);
    expect(b.structures.at(-1)!.built).toBe(true);
    expect(b.cleared).toContain('0,0');
  });

  it('crafts towards targets: the knapper turns flint into tools', () => {
    let s = createInitialState(6);
    s = run(s, { type: 'setTarget', item: 'arrows', qty: 20 });
    const arrows = qty(s, 'arrows');
    s = days(s, 5);
    expect(qty(s, 'arrows')).toBeGreaterThan(arrows);
    expect(qty(s, 'flint')).toBeLessThan(8);
  });

  it('cannot make pots before pottery is discovered; experiments discover it', () => {
    let s = createInitialState(7);
    expect(techStatus(s, 'pottery')).toBe('available');
    expect(reduce(s, { type: 'assign', personId: person(s, 'Doran').id, job: 'researcher', research: 'kiln' })).toBe(s);
    s = run(s, { type: 'assign', personId: person(s, 'Doran').id, job: 'researcher', research: 'pottery' });
    s = { ...s, inventory: { ...s.inventory, clay: { qty: 1000, q: 0.6 } } };
    s = days(s, 80);
    expect(s.known).toContain('pottery');
    expect(person(s, 'Doran').job).toBe('idle');
  });

  it('sends hunters out and brings them back', () => {
    let s = createInitialState(8);
    const team = ['Maro', 'Esk'].map((n) => person(s, n).id);
    expect(expeditionBlocker(s, 'hunt', 'aurochs', team)).toBe('Needs at least 4 hunters');
    s = run(s, { type: 'expedition', kind: 'hunt', target: 'deer', members: team });
    expect(person(s, 'Maro').away).toBeDefined();
    expect(qty(s, 'arrows')).toBe(6);
    s = days(s, 3);
    expect(person(s, 'Maro').away).toBeUndefined();
    expect(s.expeditions).toHaveLength(0);
  });

  it('trades within carrying limits and learns from neighbours', () => {
    let s = createInitialState(9);
    const team = ['Teska', 'Kessa'].map((n) => person(s, n).id);
    expect(expeditionBlocker(s, 'trade', 'reed', team, { grain: 60 })).toContain('Too heavy');
    s = run(s, { type: 'expedition', kind: 'trade', target: 'reed', members: team, cargo: { grain: 40, sickle: 2 }, wants: ['pot'] });
    s = days(s, 4);
    expect(qty(s, 'pot')).toBeGreaterThan(0);
    expect(s.research.pottery).toBeGreaterThan(0); // they saw the Reed people firing pots
  });

  it('slaughters goats for meat and hides', () => {
    const s = run(createInitialState(10), { type: 'slaughter', count: 2 });
    expect(s.goats).toBe(12);
    expect(qty(s, 'meat')).toBe(28);
    expect(qty(s, 'raw_hide')).toBe(2);
  });

  it('spoils fresh food fast and stored grain slowly', () => {
    let s = createInitialState(11);
    s = run(s, { type: 'slaughter', count: 10 });
    s = { ...s, day: DAYS_PER_SEASON + 5 }; // summer
    const meat = qty(s, 'meat');
    s = days(s, 1);
    expect(s.report.spoiled.meat).toBeGreaterThan(meat * 0.05);
    expect(s.report.spoiled.grain ?? 0).toBeLessThan(qty(s, 'grain') * 0.01);
  });

  it('only loads saves from this era', () => {
    expect(migrate({ version: 2 })).toBeNull();
    const s = createInitialState(1);
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(DAYS_PER_YEAR).toBe(364);
  });
});
