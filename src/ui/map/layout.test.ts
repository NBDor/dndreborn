import { describe, expect, it } from 'vitest';
import { BUILDING_ORDER } from '../../game/data';
import { GRID, HOUSE_SPOTS, PLOTS, allPlots, isRoad } from './layout';
import { BUILDINGS } from '../../game/data';

describe('map layout', () => {
  it('places every building except houses on a plot', () => {
    for (const id of BUILDING_ORDER) if (id !== 'house') expect(PLOTS[id as keyof typeof PLOTS]).toBeDefined();
    expect(HOUSE_SPOTS.length).toBe(BUILDINGS.house.maxLevel);
  });

  it('keeps plots on the grid, off the roads and apart from each other', () => {
    const seen = new Set<string>();
    for (const p of allPlots()) {
      for (let x = p.x; x < p.x + p.w; x++) {
        for (let y = p.y; y < p.y + p.d; y++) {
          expect(x >= 0 && y >= 0 && x < GRID && y < GRID, `${x},${y} on grid`).toBe(true);
          expect(isRoad(x, y), `${x},${y} not road`).toBe(false);
          expect(seen.has(`${x},${y}`), `${x},${y} not shared`).toBe(false);
          seen.add(`${x},${y}`);
        }
      }
    }
  });
});
