import { describe, expect, it } from 'vitest';
import { BUILDINGS } from './data';
import { DEFAULT_HOUSE_SPOTS, DEFAULT_SPOTS, GRID, isRoad, plotAt, plotTiles } from './map';
import type { BuildingId } from './types';

describe('default layout', () => {
  it('has a spot per building and per possible cottage', () => {
    expect(DEFAULT_HOUSE_SPOTS.length).toBe(BUILDINGS.house.maxLevel);
  });

  it('keeps default spots on the grid, off the roads and apart', () => {
    const plots = [
      ...Object.entries(DEFAULT_SPOTS).map(([id, at]) => plotAt(id as BuildingId, at)),
      ...DEFAULT_HOUSE_SPOTS.map((at) => plotAt('house', at)),
    ];
    const seen = new Set<string>();
    for (const t of plots.flatMap(plotTiles)) {
      expect(t.x >= 0 && t.y >= 0 && t.x < GRID && t.y < GRID).toBe(true);
      expect(isRoad(t.x, t.y)).toBe(false);
      expect(seen.has(`${t.x},${t.y}`)).toBe(false);
      seen.add(`${t.x},${t.y}`);
    }
  });
});
