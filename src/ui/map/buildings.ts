// Era 1 building art. Each function draws into a Painter relative to its plot's top corner (tile 0,0),
// so the same drawing serves the map, the placement ghost and any position.
import type { Graphics } from 'pixi.js';
import type { FieldStage } from '../../game/rules';
import type { StructureType } from '../../game/types';
import { Painter, STROKE } from './draw';
import { iso, shade, type Pt } from './iso';

export interface BuildingMeta {
  /** Points that emit smoke, in local coordinates. */
  smoke: Pt[];
  /** Height above the plot centre for labels. */
  top: number;
}

export interface DrawOpts {
  /** Field crop stage and growth 0..1. */
  stage?: FieldStage;
  growth?: number;
  /** Harvested recently: draw stubble. */
  stubble?: boolean;
  /** Kiln is in use. */
  firing?: boolean;
}

const THATCH = '#b8954e';
const DAUB = '#b9a07a';
const TIMBER = '#6b4a2e';

function ground(P: Painter, w: number, d: number, color: string, alpha = 0.55) {
  P.ground(0.05, 0.05, w - 0.1, d - 0.1, P.winter ? '#dcdad3' : color, alpha);
}

function posts(P: Painter, x: number, y: number, w: number, d: number, h: number, n: number) {
  // timber posts along the visible long wall
  for (let i = 0; i <= n; i++) P.line(iso(x + w, y + (d * i) / n, 0), iso(x + w, y + (d * i) / n, h), TIMBER, 1.3);
}

function longhouse(P: Painter, w: number, d: number): BuildingMeta {
  const x = 0.12, y = 0.1, W = w - 0.24, D = d - 0.2, h = 9;
  ground(P, w, d, '#8a7350');
  P.box(x, y, W, D, h, DAUB);
  posts(P, x, y, W, D, h, 6);
  P.door('L', y + D, x + W / 2, 0.24, 8, '#3b2a1a');
  P.gable(x, y, W, D, h, 24, THATCH, { wall: DAUB, axis: 'y', oh: 0.14 });
  return { smoke: [iso(x + W / 2, y + D * 0.45, h + 26)], top: 44 };
}

function hall(P: Painter, w: number, d: number): BuildingMeta {
  const x = 0.15, y = 0.12, W = w - 0.3, D = d - 0.24, h = 12;
  ground(P, w, d, '#8a7350');
  P.box(x, y, W, D, h, '#bfa47c');
  posts(P, x, y, W, D, h, 8);
  P.door('L', y + D, x + W / 2, 0.36, 10, '#3b2a1a');
  // carved entrance posts painted with red ochre
  for (const px of [x + W / 2 - 0.3, x + W / 2 + 0.3]) {
    P.line(iso(px, y + D + 0.08, 0), iso(px, y + D + 0.08, 22), '#4a3220', 3);
    P.line(iso(px, y + D + 0.08, 14), iso(px, y + D + 0.08, 18), '#a8442a', 3);
  }
  P.gable(x, y, W, D, h, 32, shade(THATCH, -0.05), { wall: '#bfa47c', axis: 'y', oh: 0.16 });
  return { smoke: [iso(x + W / 2, y + D * 0.5, h + 34)], top: 60 };
}

function granary(P: Painter): BuildingMeta {
  const x = 0.2, y = 0.2, W = 0.6, D = 0.6, lift = 8, h = 9;
  ground(P, 1, 1, '#8a7350', 0.4);
  for (const [px, py] of [[x, y + D], [x + W, y + D], [x + W, y]] as [number, number][]) P.line(iso(px, py, 0), iso(px, py, lift), TIMBER, 2);
  P.box(x, y, W, D, h, '#a88d64', { z: lift });
  P.door('L', y + D, x + W / 2, 0.16, 0, '#3b2a1a');
  P.gable(x, y, W, D, lift + h, 14, THATCH, { wall: '#a88d64', axis: 'x', oh: 0.1 });
  return { smoke: [], top: 40 };
}

function pen(P: Painter, w: number, d: number): BuildingMeta {
  ground(P, w, d, '#7d6a48', 0.7);
  const h = 6;
  const edge = (a: Pt, b: Pt, gap = false) => {
    const n = 6;
    for (let i = 0; i <= n; i++) {
      if (gap && (i === 3)) continue;
      const t = i / n, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      P.line(iso(px, py, 0), iso(px, py, h + 1), TIMBER, 1.4);
    }
    for (const z of [2.5, 5]) {
      if (gap) {
        P.line(iso(a[0], a[1], z), iso(a[0] + (b[0] - a[0]) * 0.42, a[1] + (b[1] - a[1]) * 0.42, z), '#8a6a42', 2);
        P.line(iso(a[0] + (b[0] - a[0]) * 0.58, a[1] + (b[1] - a[1]) * 0.58, z), iso(b[0], b[1], z), '#8a6a42', 2);
      } else P.line(iso(a[0], a[1], z), iso(b[0], b[1], z), '#8a6a42', 2);
    }
  };
  const m = 0.1;
  edge([m, m], [w - m, m]);
  edge([m, m], [m, d - m]);
  edge([w - m, m], [w - m, d - m]);
  edge([m, d - m], [w - m, d - m], true);
  return { smoke: [], top: 20 };
}

function smokerack(P: Painter): BuildingMeta {
  ground(P, 1, 1, '#7d6a48', 0.4);
  const a = 0.25, b = 0.75, h = 14;
  P.line(iso(a, 0.3, 0), iso(0.5, 0.3, h), TIMBER, 1.6);
  P.line(iso(b, 0.3, 0), iso(0.5, 0.3, h), TIMBER, 1.6);
  P.line(iso(a, 0.7, 0), iso(0.5, 0.7, h), TIMBER, 1.6);
  P.line(iso(b, 0.7, 0), iso(0.5, 0.7, h), TIMBER, 1.6);
  P.line(iso(0.5, 0.3, h), iso(0.5, 0.7, h), TIMBER, 1.6);
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = iso(0.5, 0.35 + i * 0.1, h - 1);
    P.g.rect(sx - 1.2, sy, 2.4, 6).fill('#7a2f22');
  }
  const fire = iso(0.5, 0.5, 1);
  P.circle(fire, 3.5, '#4a3020');
  P.lights.circle(fire[0], fire[1], 10).fill({ color: '#ff9a3a', alpha: 0.25 });
  P.lights.circle(fire[0], fire[1] - 1, 2.6).fill('#ffb347');
  return { smoke: [iso(0.5, 0.5, h + 2)], top: 26 };
}

function kiln(P: Painter, firing: boolean): BuildingMeta {
  ground(P, 1, 1, '#8a6a4a', 0.5);
  const x = 0.2, y = 0.2, W = 0.6, D = 0.6;
  P.box(x, y, W, D, 7, '#a0623f');
  P.pyramid(x, y, W, D, 7, 13, '#b0714a', { oh: 0, snow: true });
  if (firing) P.glow('L', y + D, x + W / 2 - 0.1, 0.2, 0, 5, '#3a2418', '#ff8a2a');
  else P.quad('L', y + D, x + W / 2 - 0.1, 0.2, 0, 5, '#3a2418');
  return { smoke: firing ? [iso(x + W / 2, y + D / 2, 22)] : [], top: 30 };
}

const CROP: Record<string, string> = { spring: '#8fcf5a', summer: '#6fae3a', autumn: '#d9b84a' };

function field(P: Painter, w: number, d: number, o: DrawOpts): BuildingMeta {
  const soil = P.winter ? '#e4e0d8' : o.stubble ? '#a88f58' : '#7a5a3a';
  P.ground(0.08, 0.08, w - 0.16, d - 0.16, soil, 1, true);
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const ry = 0.2 + r * ((d - 0.4) / (rows - 1));
    if (o.stage === 'growing' || o.stage === 'ripe') {
      const ripe = o.stage === 'ripe';
      const h = ripe ? 5 : 1 + (o.growth ?? 0) * 4;
      const color = ripe ? '#d9b84a' : (o.growth ?? 0) > 0.75 ? '#b8b04a' : CROP[P.season] ?? '#7fb04a';
      P.box(0.18, ry - 0.06, w - 0.36, 0.12, h, color);
    } else if (o.stubble && !P.winter) {
      for (let k = 0; k < 9; k++) {
        const [sx, sy] = iso(0.22 + (k * (w - 0.44)) / 8, ry);
        P.line([sx, sy], [sx, sy - 2.5], '#e0cc8e', 1.2);
      }
    } else {
      P.line(iso(0.18, ry), iso(w - 0.18, ry), P.winter ? '#c8c3b8' : '#5f4228', 1.2);
    }
  }
  return { smoke: [], top: 20 };
}

export function drawStructure(P: Painter, type: StructureType, w: number, d: number, o: DrawOpts = {}): BuildingMeta {
  switch (type) {
    case 'hall': return hall(P, w, d);
    case 'longhouse': return longhouse(P, w, d);
    case 'granary': return granary(P);
    case 'pen': return pen(P, w, d);
    case 'smokerack': return smokerack(P);
    case 'kiln': return kiln(P, !!o.firing);
    case 'field': return field(P, w, d, o);
  }
}

/** Wooden scaffolding over a plot under construction. */
export function drawScaffold(P: Painter, w: number, d: number, h: number, progress: number) {
  const x = 0.15, y = 0.15, W = Math.max(0.7, w - 0.3), D = Math.max(0.7, d - 0.3);
  const color = '#a0703c';
  P.ground(0.06, 0.06, w - 0.12, d - 0.12, '#8f7a55', 0.5);
  const hh = h * (0.3 + 0.7 * progress);
  for (const [cx, cy] of [[x, y], [x + W, y], [x, y + D], [x + W, y + D]] as [number, number][]) P.line(iso(cx, cy, 0), iso(cx, cy, hh), color, 1.6);
  const ring = [iso(x, y, hh), iso(x + W, y, hh), iso(x + W, y + D, hh), iso(x, y + D, hh), iso(x, y, hh)];
  for (let i = 0; i < 4; i++) P.line(ring[i], ring[i + 1], color, 1.6);
  P.box(x + W * 0.3, y + D * 0.3, 0.3, 0.3, 5, '#8a6a42');
}

/** A goat standing at the origin of `g`. */
export function drawGoat(g: Graphics, color: string) {
  g.ellipse(0, 0, 4, 1.8).fill({ color: '#000000', alpha: 0.25 });
  g.moveTo(-2.5, -1).lineTo(-2.5, -4).moveTo(2.5, -1).lineTo(2.5, -4).stroke({ width: 1, color: '#4a3a2a' });
  g.ellipse(0, -5.5, 4.2, 2.6).fill(color).stroke(STROKE);
  g.circle(4.2, -7.5, 1.8).fill(color).stroke(STROKE);
  g.moveTo(4.5, -9).lineTo(5.6, -11).stroke({ width: 0.8, color: '#5a4a3a' });
}
