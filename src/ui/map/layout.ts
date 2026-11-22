// Village map layout: where each building sits on the isometric grid.
import type { BuildingId } from '../../game/types';
import { hash } from './iso';

export const GRID = 16;
export const ROAD_X = 8; // north-south road column
export const ROAD_Y = 8; // east-west road row

export interface Plot {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** One plot per building, except houses which use HOUSE_SPOTS (one cottage per level). */
export const PLOTS: Record<Exclude<BuildingId, 'house'>, Plot> = {
  town_hall: { x: 6, y: 6, w: 2, d: 2 },
  tavern: { x: 9, y: 6, w: 2, d: 2 },
  market: { x: 9, y: 9, w: 2, d: 2 },
  warehouse: { x: 6, y: 9, w: 2, d: 2 },
  workshop: { x: 5, y: 2, w: 2, d: 2 },
  apothecary: { x: 2, y: 5, w: 2, d: 2 },
  smithy: { x: 9, y: 2, w: 2, d: 2 },
  lumber_camp: { x: 1, y: 1, w: 3, d: 3 },
  quarry: { x: 12, y: 1, w: 3, d: 3 },
  mine: { x: 13, y: 5, w: 2, d: 2 },
  farm: { x: 1, y: 10, w: 4, d: 4 },
  herb_garden: { x: 5, y: 13, w: 2, d: 2 },
};

export const HOUSE_SPOTS: Plot[] = [
  [12, 10], [14, 10], [10, 12], [12, 12], [14, 12], [10, 14], [12, 14], [14, 14], [7, 12], [2, 15],
].map(([x, y]) => ({ x, y, w: 1, d: 1 }));

export const isRoad = (x: number, y: number) => x === ROAD_X || y === ROAD_Y;

export function allPlots(): Plot[] {
  return [...Object.values(PLOTS), ...HOUSE_SPOTS];
}

const occupied = (() => {
  const set = new Set<string>();
  for (const p of allPlots()) {
    for (let x = p.x; x < p.x + p.w; x++) for (let y = p.y; y < p.y + p.d; y++) set.add(`${x},${y}`);
  }
  return set;
})();

export const isFree = (x: number, y: number) => !occupied.has(`${x},${y}`) && !isRoad(x, y);

export interface Decoration {
  kind: 'tree' | 'pine' | 'rock' | 'bush';
  x: number;
  y: number;
}

/** Trees, rocks and bushes on free tiles; denser at the forest edge near the lumber camp. */
export const DECORATIONS: Decoration[] = (() => {
  const out: Decoration[] = [];
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (!isFree(x, y)) continue;
      const r = hash(x, y, 1);
      const forest = x <= 4 && y <= 4 ? 0.75 : x === 0 || y === 0 ? 0.45 : 0.12;
      const rocky = x >= 11 && y <= 4;
      const ox = 0.25 + hash(x, y, 2) * 0.5;
      const oy = 0.25 + hash(x, y, 3) * 0.5;
      if (r < forest) out.push({ kind: hash(x, y, 4) < 0.5 ? 'pine' : 'tree', x: x + ox, y: y + oy });
      else if (rocky && r < forest + 0.35) out.push({ kind: 'rock', x: x + ox, y: y + oy });
      else if (r > 0.93) out.push({ kind: 'bush', x: x + ox, y: y + oy });
    }
  }
  return out;
})();
