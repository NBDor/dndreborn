import { describe, expect, it } from 'vitest';
import { GRID, START_LAYOUT, hasTree, isRiver, plotAt, plotTiles, riverX, tileKey } from './map';

describe('river valley map', () => {
  it('has a two-tile river running the length of the valley', () => {
    for (let y = 0; y < GRID; y++) {
      expect(isRiver(riverX(y), y)).toBe(true);
      expect(riverX(y) + 1).toBeLessThan(GRID);
    }
  });

  it('is wooded to the west and open by the river', () => {
    const westTrees = Array.from({ length: GRID }, (_, y) => hasTree(0, y)).filter(Boolean).length;
    expect(westTrees).toBeGreaterThan(GRID / 2);
    for (let y = 0; y < GRID; y++) expect(hasTree(riverX(y), y)).toBe(false);
  });

  it('starts with a village on dry land and nothing overlapping', () => {
    const seen = new Set<string>();
    for (const t of START_LAYOUT.flatMap(({ type, at }) => plotTiles(plotAt(type, at)))) {
      expect(t.x >= 0 && t.y >= 0 && t.x < GRID && t.y < GRID).toBe(true);
      expect(isRiver(t.x, t.y)).toBe(false);
      expect(seen.has(tileKey(t))).toBe(false);
      seen.add(tileKey(t));
    }
  });
});
