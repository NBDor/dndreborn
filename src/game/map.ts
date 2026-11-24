// The village grid: a river valley with forest to the west and north, and the river along the east.
import { STRUCTURES } from './data';
import type { StructureType, Tile } from './types';

export const GRID = 18;

export interface Plot extends Tile {
  w: number;
  d: number;
}

/** Deterministic noise in [0, 1) for a tile. */
export function noise(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** West edge of the river at row y. The river is two tiles wide and meanders gently. */
export const riverX = (y: number) => 14 + Math.round(Math.sin(y / 2.6) * 1.2);

export const isRiver = (x: number, y: number) => x === riverX(y) || x === riverX(y) + 1;
export const isBank = (x: number, y: number) => !isRiver(x, y) && (isRiver(x + 1, y) || isRiver(x - 1, y));

/** How wooded a tile is, 0..1: dense forest west and north, open land near the river and the village. */
export function woodland(x: number, y: number): number {
  if (isRiver(x, y)) return 0;
  const west = Math.max(0, (6 - x) / 6);
  const north = Math.max(0, (4 - y) / 4);
  return Math.min(1, Math.max(west, north) + (noise(x, y, 7) - 0.5) * 0.3);
}

/** Tiles with standing trees at the start of the game. */
export const hasTree = (x: number, y: number) => woodland(x, y) > 0.35 && noise(x, y, 1) < woodland(x, y);

export const footprint = (type: StructureType) => ({ w: STRUCTURES[type].w, d: STRUCTURES[type].d });
export const plotAt = (type: StructureType, at: Tile): Plot => ({ ...at, ...footprint(type) });

export function plotTiles(p: Plot): Tile[] {
  const out: Tile[] = [];
  for (let x = p.x; x < p.x + p.w; x++) for (let y = p.y; y < p.y + p.d; y++) out.push({ x, y });
  return out;
}

export const tileKey = (t: Tile) => `${t.x},${t.y}`;

/** The founders' village. */
export const START_LAYOUT: { type: StructureType; at: Tile }[] = [
  { type: 'hall', at: { x: 8, y: 7 } },
  { type: 'longhouse', at: { x: 11, y: 7 } },
  { type: 'field', at: { x: 6, y: 12 } },
  { type: 'field', at: { x: 9, y: 12 } },
  { type: 'pen', at: { x: 11, y: 3 } },
];
