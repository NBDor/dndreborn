// Building art. Each function draws one building into a Painter, relative to its plot's top corner
// (the plot is at tile 0,0), so the same drawing serves the map, the placement ghost and any position.
import type { BuildingId } from '../../game/types';
import type { SeasonId } from '../../game/data';
import { Painter, LIGHT } from './draw';
import { iso, shade, type Pt } from './iso';

export interface BuildingMeta {
  /** Chimney tops that emit smoke, in local coordinates. */
  smoke: Pt[];
  /** Flag pole top, if any. */
  flag?: Pt;
  /** Height above the plot centre for labels. */
  top: number;
}

interface Args {
  P: Painter;
  w: number;
  d: number;
  level: number;
}

const grow = (level: number, k = 0.12) => 1 + k * (Math.max(1, level) - 1);

function foundation(P: Painter, w: number, d: number, color = '#8f7a55') {
  P.ground(0.06, 0.06, w - 0.12, d - 0.12, P.winter ? '#d9d6cf' : color, 0.6);
}

function townHall({ P, w, d, level }: Args): BuildingMeta {
  const m = 0.15, x = m, y = m, W = w - 2 * m, D = d - 2 * m;
  const h = 24 * grow(level);
  const ts = 0.65, th = h + 18 + level * 5;
  const wall = '#b8a98c';
  foundation(P, w, d, '#9b9079');
  P.box(x, y, ts, ts, th, '#cbbfa6');
  P.windows('R', x + ts, y, y + ts, th - 14, 1);
  P.pyramid(x, y, ts, ts, th, 18, '#3f5f8f');
  P.box(x, y, W, D, h, wall);
  P.windows('L', y + D, x, x + W, h * 0.45, 4);
  P.windows('R', x + W, y, y + D, h * 0.45, 4);
  P.door('L', y + D, x + W / 2, 0.28, 13);
  P.gable(x, y, W, D, h, 16, '#8c3b2e', { wall, axis: 'x' });
  return { smoke: [], flag: iso(x + ts / 2, y + ts / 2, th + 18), top: th + 30 };
}

function barrel(P: Painter, x: number, y: number) {
  const [cx, cy] = iso(x, y);
  P.g.rect(cx - 4, cy - 9, 8, 9).fill('#7a4e2a');
  P.g.ellipse(cx, cy - 9, 4, 2).fill(P.winter ? '#eef2f6' : '#9a6a3c');
  P.line([cx - 4, cy - 4.5], [cx + 4, cy - 4.5], '#3d3d3d', 0.8);
}

function tavern({ P, w, d, level }: Args): BuildingMeta {
  const m = 0.2, x = m, y = m, W = w - 2 * m, D = d - 2 * m;
  const h = 30 * grow(level, 0.1);
  const wall = '#d9b57a';
  foundation(P, w, d);
  P.box(x + 0.2, y + 0.15, 0.3, 0.3, h + 22, '#7d6f63', { snow: true });
  P.box(x, y, W, D, h, wall);
  P.line(iso(x, y + D, h / 2), iso(x + W, y + D, h / 2), '#5a3a1e', 1.6);
  P.line(iso(x + W, y, h / 2), iso(x + W, y + D, h / 2), '#5a3a1e', 1.6);
  P.windows('L', y + D, x, x + W, h * 0.62, 3);
  P.windows('R', x + W, y, y + D, h * 0.62, 3);
  P.windows('R', x + W, y, y + D * 0.6, h * 0.15, 2);
  P.door('L', y + D, x + W * 0.55, 0.26, 12);
  P.gable(x, y, W, D, h, 18, '#7b3b22', { wall, axis: 'y' });
  // hanging sign with a mug
  const [sx, sy] = iso(x + W + 0.05, y + D - 0.15, h * 0.7);
  P.line([sx, sy], [sx + 7, sy - 3], '#3b2b1b', 1.2);
  P.g.roundRect(sx + 3, sy - 1, 10, 9, 1).fill('#6b4423');
  P.g.rect(sx + 5.5, sy + 1.5, 4, 4.5).fill('#e0b040');
  P.g.rect(sx + 5.5, sy + 0.8, 4, 1.4).fill('#ffffff');
  barrel(P, x + W + 0.08, y + 0.2);
  barrel(P, x + W + 0.1, y + 0.45);
  P.lantern(iso(x + W * 0.38, y + D + 0.02, 14));
  return { smoke: [iso(x + 0.35, y + 0.3, h + 24)], top: h + 34 };
}

function market({ P, level }: Args): BuildingMeta {
  const cells: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const awnings = ['#c0392b', '#2e86c1', '#d68910', '#7d3c98'];
  foundation(P, 2, 2, '#b8a682');
  cells.slice(0, Math.min(4, level + 1)).forEach(([cx, cy], i) => {
    const x = cx + 0.15, y = cy + 0.15, s = 0.7, top = 18;
    const post = (px: number, py: number) => P.line(iso(px, py, 0), iso(px, py, top), '#5a3a1e', 1.2);
    post(x, y);
    post(x + s, y);
    post(x, y + s);
    P.box(x + 0.05, y + 0.3, s - 0.1, 0.3, 7, '#9a6b3f');
    for (let k = 0; k < 3; k++) P.circle(iso(x + 0.2 + k * 0.17, y + 0.45, 8.5), 1.8, ['#e74c3c', '#f1c40f', '#27ae60'][(k + i) % 3]);
    post(x + s, y + s);
    for (let k = 0; k < 4; k++) {
      const a = x + (s * k) / 4, b = x + (s * (k + 1)) / 4;
      P.poly([iso(a, y, top), iso(b, y, top), iso(b, y + s, top - 3), iso(a, y + s, top - 3)],
        P.winter && k % 2 === 0 ? shade(awnings[i], 0.35) : k % 2 ? '#f3ead8' : awnings[i]);
    }
  });
  return { smoke: [], top: 34 };
}

function warehouse({ P, d, level }: Args): BuildingMeta {
  const x = 0.15, y = 0.15, W = 1.4, D = d - 0.3;
  const h = 22 * grow(level, 0.08);
  const wall = '#8a4b32';
  foundation(P, 2, 2);
  P.box(x, y, W, D, h, wall);
  P.door('L', y + D, x + W / 2, 0.5, 15, '#5a2f1d');
  P.line(iso(x + W / 2 - 0.25, y + D, 0), iso(x + W / 2 + 0.25, y + D, 15), '#3a1d10', 1);
  P.gable(x, y, W, D, h, 16, '#5d5d66', { wall, axis: 'y' });
  for (let i = 0; i < Math.min(4, level); i++) P.box(x + W + 0.08, y + 0.1 + i * 0.4, 0.3, 0.3, 8, '#b08850', { snow: true });
  return { smoke: [], top: h + 28 };
}

function workshop({ P, level }: Args): BuildingMeta {
  const x = 0.2, y = 0.2, W = 1.2, D = 1.1;
  const h = 18 * grow(level);
  const wall = '#a67c52';
  foundation(P, 2, 2);
  P.box(x, y, W, D, h, wall);
  P.windows('R', x + W, y, y + D, h * 0.4, 2);
  P.door('L', y + D, x + W * 0.4, 0.3, 12);
  P.gable(x, y, W, D, h, 14, '#c9a14a', { wall, axis: 'x' });
  P.box(1.55, 0.4, 0.3, 0.9, 3, '#d8b483');
  P.box(1.55, 0.4, 0.3, 0.9, 3, '#caa070', { z: 3, snow: true });
  P.box(0.4, 1.5, 0.8, 0.15, 5, '#8b5a2b');
  return { smoke: [], top: h + 26 };
}

function smithy({ P, w, d, level }: Args): BuildingMeta {
  const m = 0.2, x = m, y = m, W = w - 2 * m, D = d - 2 * m;
  const h = 17 * grow(level);
  const ch = h + 24;
  foundation(P, w, d, '#6f6a62');
  P.box(x + 0.1, y + 0.1, 0.35, 0.35, ch, '#55514d');
  P.box(x, y, W, D, h, '#6d6a66');
  P.glow('L', y + D, x + W * 0.3, 0.5, 0, 12, '#e0701f', '#ff9a3a');
  P.windows('R', x + W, y, y + D, h * 0.45, 2);
  P.gable(x, y, W, D, h, 14, '#3b3f4a', { wall: '#6d6a66', axis: 'y' });
  P.box(x + W * 0.6, y + D + 0.08, 0.22, 0.12, 5, '#2c2c30');
  return { smoke: [iso(x + 0.28, y + 0.28, ch + 2)], top: ch + 10 };
}

function apothecary({ P, level }: Args): BuildingMeta {
  const x = 0.35, y = 0.35, W = 1.2, D = 1.2;
  const h = 26 * grow(level);
  foundation(P, 2, 2);
  P.box(x, y, W, D, h, '#d6c9ad');
  P.windows('L', y + D, x, x + W, h * 0.6, 2);
  P.windows('R', x + W, y, y + D, h * 0.6, 2);
  P.door('L', y + D, x + W * 0.5, 0.2, 11, '#3d5a3a');
  P.pyramid(x, y, W, D, h, 22, '#5b3d7a');
  for (let i = 0; i < 3; i++) P.box(x + W + 0.1, y + 0.15 + i * 0.35, 0.2, 0.2, 4, '#9c5b3a', { top: P.winter ? '#eef2f6' : '#4f8f3a' });
  return { smoke: [], top: h + 30 };
}

function lumberCamp({ P, level }: Args): BuildingMeta {
  foundation(P, 3, 3, '#7d6a48');
  P.box(0.9, 0.8, 1.1, 0.9, 14, '#7a5230');
  P.gable(0.9, 0.8, 1.1, 0.9, 14, 10, '#4f3a26', { wall: '#7a5230', axis: 'x' });
  for (let i = 0; i < Math.min(4, level); i++) logPile(P, 0.35 + (i % 2) * 1.3, 2.1 + Math.floor(i / 2) * 0.45);
  stump(P, 2.5, 1.2);
  stump(P, 2.3, 2.6);
  return { smoke: [iso(1.2, 1.0, 26)], top: 40 };
}

function logPile(P: Painter, x: number, y: number) {
  const logs: [number, number][] = [[0, 2], [0.12, 2], [0.24, 2], [0.06, 7], [0.18, 7]];
  for (const [dy, z] of logs) {
    const a = iso(x, y + dy, z), b = iso(x + 0.8, y + dy, z);
    P.line([a[0], a[1] - 2], [b[0], b[1] - 2], '#8b5a2b', 5);
    P.circle([b[0], b[1] - 2], 2.4, '#d8b483');
  }
  if (P.winter) P.line(iso(x + 0.05, y + 0.12, 13), iso(x + 0.75, y + 0.12, 13), '#f4f7fa', 3);
}

function stump(P: Painter, x: number, y: number) {
  const [cx, cy] = iso(x, y);
  P.g.rect(cx - 3.5, cy - 4, 7, 4).fill('#6b4423');
  P.g.ellipse(cx, cy - 4, 3.5, 1.8).fill(P.winter ? '#f4f7fa' : '#d8b483');
}

function quarry({ P, w, d, level }: Args): BuildingMeta {
  const ring = (k: number) => {
    const m = 0.2 + k * 0.35, z = -k * 6;
    return { x0: m, y0: m, x1: w - m, y1: d - m, z };
  };
  const base = P.winter ? '#c9cdd1' : '#9a968e';
  for (let k = 0; k < 3; k++) {
    const r = ring(k);
    P.poly([iso(r.x0, r.y0, r.z), iso(r.x1, r.y0, r.z), iso(r.x1, r.y1, r.z), iso(r.x0, r.y1, r.z)], shade(base, -k * 0.12));
    if (k < 2) {
      const n = ring(k + 1);
      P.poly([iso(n.x0, n.y0, r.z), iso(n.x1, n.y0, r.z), iso(n.x1, n.y0, n.z), iso(n.x0, n.y0, n.z)], shade('#7d7a73', -k * 0.1));
      P.poly([iso(n.x0, n.y0, r.z), iso(n.x0, n.y1, r.z), iso(n.x0, n.y1, n.z), iso(n.x0, n.y0, n.z)], shade('#6a6761', -k * 0.1));
    }
  }
  for (let i = 0; i < Math.min(5, level + 1); i++) {
    P.box(0.25 + (i % 3) * 0.35, d - 0.45, 0.3, 0.25, 7, '#b5b1a8', { z: i >= 3 ? 7 : 0, snow: true });
  }
  P.box(w - 0.55, 0.25, 0.3, 0.45, 6, '#7a5230');
  return { smoke: [], top: 30 };
}

function mine({ P, w, d, level }: Args): BuildingMeta {
  const x = 0.05, y = 0.05, W = w - 0.1, D = d - 0.1;
  const hill = 30 + level * 2;
  const ex = x + W / 2;
  P.pyramid(x, y, W, D, 0, hill, '#7d6b4f', { oh: 0, snow: true });
  P.poly([iso(ex - 0.22, y + D, 0), iso(ex - 0.22, y + D, 12), iso(ex + 0.22, y + D, 12), iso(ex + 0.22, y + D, 0)], '#1b130d', { stroke: false });
  const frame = [iso(ex - 0.28, y + D, 0), iso(ex - 0.28, y + D, 14), iso(ex + 0.28, y + D, 14), iso(ex + 0.28, y + D, 0)];
  for (let i = 0; i < 3; i++) P.line(frame[i], frame[i + 1], '#8b5a2b', 2.4);
  P.lantern([frame[1][0] - 2, frame[1][1] + 3]);
  P.box(ex - 0.1, y + D + 0.05, 0.3, 0.22, 5, '#5b4a3a', { top: '#3a3530' });
  return { smoke: [], top: hill + 12 };
}

function herbGarden({ P, level }: Args): BuildingMeta {
  foundation(P, 2, 2, '#7d6a48');
  const flowers = ['#e0707a', '#f1c40f', '#b07ad9', '#ffffff'];
  const leaf = P.season === 'winter' ? '#e9ece8' : P.season === 'autumn' ? '#8a7a3a' : '#3e7a3a';
  for (let i = 0; i < Math.min(3, level); i++) {
    const by = 0.2 + i * 0.58;
    P.box(0.15, by, 1.7, 0.38, 4, '#6b4a2f', { top: leaf });
    if (P.season === 'spring' || P.season === 'summer') {
      for (let k = 0; k < 6; k++) P.circle(iso(0.3 + k * 0.27, by + 0.19, 5.5), 1.6, flowers[(k + i) % flowers.length]);
    }
  }
  return { smoke: [], top: 20 };
}

const CROPS: Record<SeasonId, { color: string; h: number } | null> = {
  spring: { color: '#8fcf5a', h: 1.5 },
  summer: { color: '#6fae3a', h: 4 },
  autumn: { color: '#d9b84a', h: 4.5 },
  winter: null,
};

function farm({ P, level }: Args): BuildingMeta {
  const fields = Math.min(4, 1 + Math.floor((level - 1) / 2));
  const cells: [number, number][] = [[0, 0], [2, 0], [0, 2], [2, 2]];
  const crop = CROPS[P.season];
  cells.forEach(([cx, cy], i) => {
    const x = cx + 0.1, y = cy + 0.1, s = 1.8;
    if (i >= fields) {
      P.g.poly([...iso(x, y), ...iso(x + s, y), ...iso(x + s, y + s), ...iso(x, y + s)]).stroke({ width: 1, color: '#ffffff', alpha: 0.25 });
      return;
    }
    P.ground(x, y, s, s, P.winter ? '#e4e0d8' : '#7a5a3a', 1, true);
    for (let r = 0; r < 6; r++) {
      if (crop) P.box(x + 0.1, y + 0.12 + r * 0.28, s - 0.2, 0.14, crop.h, shade(crop.color, i % 2 ? -0.08 : 0));
      else P.line(iso(x + 0.1, y + 0.19 + r * 0.28), iso(x + s - 0.1, y + 0.19 + r * 0.28), '#b9b2a6', 1);
    }
  });
  return { smoke: [], top: 26 };
}

export const COTTAGE_WALLS = ['#e8d8b0', '#d9c7a0', '#efe3c8', '#dccbb0'];
export const COTTAGE_ROOFS = ['#9c4a2f', '#c9a14a', '#6e4b3a', '#8c3b2e', '#5d6b7a'];

export function cottage(P: Painter, index: number): BuildingMeta {
  const x = 0.18, y = 0.22, w = 0.62, d = 0.56, h = 15;
  const wall = COTTAGE_WALLS[index % COTTAGE_WALLS.length];
  P.shadow(0.55, 0.85, 18, 6);
  P.box(x + 0.1, y + 0.08, 0.14, 0.14, h + 14, '#7d6f63', { snow: true });
  P.box(x, y, w, d, h, wall);
  P.windows('R', x + w, y, y + d, 6, 1);
  P.door('L', y + d, x + w * 0.5, 0.16, 9);
  P.gable(x, y, w, d, h, 11, COTTAGE_ROOFS[index % COTTAGE_ROOFS.length], { wall, axis: index % 2 ? 'y' : 'x' });
  return { smoke: P.season === 'winter' || P.season === 'autumn' ? [iso(x + 0.17, y + 0.15, h + 16)] : [], top: 40 };
}

const DRAW: Record<Exclude<BuildingId, 'house'>, (a: Args) => BuildingMeta> = {
  town_hall: townHall, tavern, market, warehouse, workshop, smithy, apothecary,
  lumber_camp: lumberCamp, quarry, mine, herb_garden: herbGarden, farm,
};

export function drawBuilding(P: Painter, id: BuildingId, w: number, d: number, level: number, index = 0): BuildingMeta {
  if (id === 'house') return cottage(P, index);
  return DRAW[id]({ P, w, d, level: Math.max(1, level) });
}

/** Wooden scaffolding over a plot under construction. */
export function drawScaffold(P: Painter, w: number, d: number, h: number) {
  const x = 0.15, y = 0.15, W = Math.max(0.7, w - 0.3), D = Math.max(0.7, d - 0.3);
  const color = '#a0703c';
  P.ground(0.06, 0.06, w - 0.12, d - 0.12, '#8f7a55', 0.5);
  for (const [cx, cy] of [[x, y], [x + W, y], [x, y + D], [x + W, y + D]] as [number, number][]) {
    P.line(iso(cx, cy, 0), iso(cx, cy, h), color, 1.6);
  }
  for (const z of [h * 0.5, h]) {
    const ring = [iso(x, y, z), iso(x + W, y, z), iso(x + W, y + D, z), iso(x, y + D, z), iso(x, y, z)];
    for (let i = 0; i < 4; i++) P.line(ring[i], ring[i + 1], color, 1.6);
  }
  P.line(iso(x, y + D, 0), iso(x + W, y + D, h), color, 1.6);
  P.box(x + W * 0.3, y + D * 0.3, 0.3, 0.3, 6, '#b5b1a8');
}

export { LIGHT };
