// The village grid: size, roads, building footprints and the starting layout.
import type { BuildingId } from './types';

export const GRID = 16;
export const ROAD_X = 8; // north-south road column
export const ROAD_Y = 8; // east-west road row

export interface Tile {
  x: number;
  y: number;
}

export interface Plot extends Tile {
  w: number;
  d: number;
}

export const FOOTPRINTS: Record<BuildingId, { w: number; d: number }> = {
  town_hall: { w: 2, d: 2 },
  house: { w: 1, d: 1 },
  farm: { w: 4, d: 4 },
  lumber_camp: { w: 3, d: 3 },
  quarry: { w: 3, d: 3 },
  mine: { w: 2, d: 2 },
  herb_garden: { w: 2, d: 2 },
  warehouse: { w: 2, d: 2 },
  workshop: { w: 2, d: 2 },
  smithy: { w: 2, d: 2 },
  apothecary: { w: 2, d: 2 },
  tavern: { w: 2, d: 2 },
  market: { w: 2, d: 2 },
};

/** Suggested spots, used for the starting village and for migrating old saves. */
export const DEFAULT_SPOTS: Record<Exclude<BuildingId, 'house'>, Tile> = {
  town_hall: { x: 6, y: 6 },
  tavern: { x: 9, y: 6 },
  market: { x: 9, y: 9 },
  warehouse: { x: 6, y: 9 },
  workshop: { x: 5, y: 2 },
  apothecary: { x: 2, y: 5 },
  smithy: { x: 9, y: 2 },
  lumber_camp: { x: 1, y: 1 },
  quarry: { x: 12, y: 1 },
  mine: { x: 13, y: 5 },
  farm: { x: 1, y: 10 },
  herb_garden: { x: 5, y: 13 },
};

export const DEFAULT_HOUSE_SPOTS: Tile[] = [
  [12, 10], [14, 10], [10, 12], [12, 12], [14, 12], [10, 14], [12, 14], [14, 14], [7, 12], [2, 15],
].map(([x, y]) => ({ x, y }));

export const isRoad = (x: number, y: number) => x === ROAD_X || y === ROAD_Y;

export const plotAt = (id: BuildingId, at: Tile): Plot => ({ ...at, ...FOOTPRINTS[id] });

export function plotTiles(p: Plot): Tile[] {
  const out: Tile[] = [];
  for (let x = p.x; x < p.x + p.w; x++) for (let y = p.y; y < p.y + p.d; y++) out.push({ x, y });
  return out;
}
