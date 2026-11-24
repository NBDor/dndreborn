// Balance check: a reasonable headman keeps the founding village alive and growing for several years.
// The policy is deliberately simple; a failure here means the economy got much harsher.
import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from './engine';
import { age, dayOfSeason, isAvailable, qty, season, structuresOf } from './rules';
import type { Action, GameState, JobId } from './types';

const PLAN: Record<string, Record<string, JobId>> = {
  spring: { Aru: 'farmer', Bena: 'farmer', Esk: 'farmer', Vann: 'farmer', Kessa: 'gatherer', Doran: 'builder', Maro: 'woodcutter', Teska: 'gatherer', Ostav: 'herder', Hesk: 'knapper', Ilo: 'gatherer' },
  summer: { Aru: 'farmer', Bena: 'gatherer', Esk: 'gatherer', Vann: 'builder', Kessa: 'hideworker', Doran: 'builder', Maro: 'woodcutter', Teska: 'gatherer', Ostav: 'herder', Hesk: 'knapper', Ilo: 'gatherer' },
  autumn: { Aru: 'farmer', Bena: 'farmer', Esk: 'farmer', Vann: 'gatherer', Kessa: 'hideworker', Doran: 'woodcutter', Maro: 'woodcutter', Teska: 'gatherer', Ostav: 'herder', Hesk: 'knapper', Ilo: 'gatherer' },
  winter: { Aru: 'gatherer', Bena: 'hideworker', Esk: 'woodcutter', Vann: 'woodcutter', Kessa: 'hideworker', Doran: 'builder', Maro: 'woodcutter', Teska: 'gatherer', Ostav: 'herder', Hesk: 'knapper', Ilo: 'gatherer' },
};
const FIELD_SPOTS = [{ x: 6, y: 15 }, { x: 9, y: 15 }, { x: 3, y: 12 }, { x: 3, y: 15 }, { x: 0, y: 12 }, { x: 0, y: 15 }];

export function playSensibly(seed: number, days: number): GameState {
  let s = createInitialState(seed);
  const act = (a: Action) => { s = reduce(s, a); };
  let fi = 0;
  for (let d = 0; d < days; d++) {
    const se = season(s).id;
    if (dayOfSeason(s) === 1 || d === 0) {
      for (const p of s.people) {
        const job = p.name === 'Tobek' ? 'knapper' : PLAN[se][p.name] ?? (age(p, s.day) >= 7 ? 'gatherer' : 'idle');
        if (p.job !== job && isAvailable(p, s.day)) act({ type: 'assign', personId: p.id, job });
      }
      if (!s.people.some((p) => p.job === 'knapper' && age(p, s.day) >= 12)) {
        const best = s.people.filter((p) => isAvailable(p, s.day) && age(p, s.day) >= 12)
          .sort((a, b) => (b.skills.knapping ?? 0) - (a.skills.knapping ?? 0))[0];
        if (best) act({ type: 'assign', personId: best.id, job: 'knapper' });
      }
      if (se === 'autumn' && s.goats > 16) act({ type: 'slaughter', count: s.goats - 16 });
    }
    if (!s.structures.some((x) => !x.built)) {
      if (structuresOf(s, 'smokerack').length === 0) act({ type: 'build', structure: 'smokerack', at: { x: 11, y: 11 } });
      else if (se === 'spring' && structuresOf(s, 'field').length < 8 && fi < FIELD_SPOTS.length) act({ type: 'build', structure: 'field', at: FIELD_SPOTS[fi++] });
      else if (structuresOf(s, 'granary').length === 0 && qty(s, 'wood') > 800) act({ type: 'build', structure: 'granary', at: { x: 10, y: 10 } });
    }
    if (se === 'autumn' && dayOfSeason(s) === 40) {
      const team = s.people.filter((p) => ['Vann', 'Esk'].includes(p.name) && isAvailable(p, s.day)).map((p) => p.id);
      if (team.length) act({ type: 'expedition', kind: 'flint', target: 'chalk', members: team });
    }
    if (se !== 'spring' && d % 12 === 0) {
      const hunters = s.people.filter((p) => ['Maro', 'Esk', 'Vann'].includes(p.name) && isAvailable(p, s.day)).map((p) => p.id);
      if (hunters.length >= 2) act({ type: 'expedition', kind: 'hunt', target: 'deer', members: hunters });
    }
    act({ type: 'tick' });
  }
  return s;
}

describe('balance', () => {
  it.each([1, 2, 3, 4])('a sensible village survives three years (seed %i)', (seed) => {
    const s = playSensibly(seed, 364 * 3);
    expect(s.people.length).toBeGreaterThanOrEqual(12);
  });
});
