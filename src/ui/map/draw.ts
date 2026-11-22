// Isometric drawing primitives on top of Pixi Graphics.
// Everything is drawn twice-aware: `g` is the body (tinted at night), `lights` holds what glows.
import type { Graphics } from 'pixi.js';
import type { SeasonId } from '../../game/data';
import { iso, shade, type Pt } from './iso';

export const STROKE = { width: 0.6, color: '#190f05', alpha: 0.4, join: 'round' as const };
const WINDOW_DARK = '#3a4652';
export const LIGHT = '#ffd36b';
const SNOW = '#eef2f6';

const flat = (ps: Pt[]) => ps.flatMap(([x, y]) => [x, y]);

export class Painter {
  constructor(
    public g: Graphics,
    public lights: Graphics,
    public season: SeasonId,
  ) {}

  get winter() {
    return this.season === 'winter';
  }

  poly(ps: Pt[], color: string, opts: { stroke?: boolean; alpha?: number } = {}) {
    this.g.poly(flat(ps)).fill({ color, alpha: opts.alpha ?? 1 });
    if (opts.stroke !== false) this.g.stroke(STROKE);
  }

  line(a: Pt, b: Pt, color: string, width: number, alpha = 1) {
    this.g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width, color, alpha, cap: 'round' });
  }

  circle([x, y]: Pt, r: number, color: string, alpha = 1) {
    this.g.circle(x, y, r).fill({ color, alpha });
  }

  ellipse([x, y]: Pt, rx: number, ry: number, color: string, alpha = 1) {
    this.g.ellipse(x, y, rx, ry).fill({ color, alpha });
  }

  shadow(x: number, y: number, rx: number, ry: number) {
    this.ellipse(iso(x, y), rx, ry, '#000000', 0.22);
  }

  /** Flat diamond on the ground. */
  ground(x: number, y: number, w: number, d: number, color: string, alpha = 1, stroke = false) {
    this.poly([iso(x, y), iso(x + w, y), iso(x + w, y + d), iso(x, y + d)], color, { alpha, stroke });
  }

  /** Rectangular prism; only the three faces the camera sees. */
  box(x: number, y: number, w: number, d: number, h: number, color: string, opt: { z?: number; top?: string; snow?: boolean } = {}) {
    const z = opt.z ?? 0, x1 = x + w, y1 = y + d, zt = z + h;
    this.poly([iso(x, y1, z), iso(x1, y1, z), iso(x1, y1, zt), iso(x, y1, zt)], shade(color, -0.3));
    this.poly([iso(x1, y, z), iso(x1, y1, z), iso(x1, y1, zt), iso(x1, y, zt)], shade(color, -0.08));
    const top = opt.snow && this.winter ? SNOW : (opt.top ?? shade(color, 0.12));
    this.poly([iso(x, y, zt), iso(x1, y, zt), iso(x1, y1, zt), iso(x, y1, zt)], top);
  }

  private roof(color: string) {
    return this.winter ? SNOW : color;
  }

  gable(x: number, y: number, w: number, d: number, z: number, rh: number, color: string, opt: { wall?: string; axis?: 'x' | 'y'; oh?: number } = {}) {
    const oh = opt.oh ?? 0.08;
    const x0 = x - oh, y0 = y - oh, x1 = x + w + oh, y1 = y + d + oh;
    const end = opt.wall ?? shade(color, -0.1);
    const c = this.roof(color);
    if ((opt.axis ?? 'x') === 'x') {
      const ym = y + d / 2;
      const r0 = iso(x0, ym, z + rh), r1 = iso(x1, ym, z + rh);
      this.poly([iso(x0, y0, z), iso(x1, y0, z), r1, r0], shade(c, 0.15));
      this.poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, ym, z + rh)], shade(end, -0.08));
      this.poly([iso(x0, y1, z), iso(x1, y1, z), r1, r0], shade(c, this.winter ? -0.05 : -0.12));
      return;
    }
    const xm = x + w / 2;
    const r0 = iso(xm, y0, z + rh), r1 = iso(xm, y1, z + rh);
    this.poly([iso(x0, y0, z), iso(x0, y1, z), r1, r0], shade(c, 0.05));
    this.poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(xm, y + d, z + rh)], shade(end, -0.3));
    this.poly([iso(x1, y0, z), iso(x1, y1, z), r1, r0], shade(c, this.winter ? -0.04 : 0.08));
  }

  pyramid(x: number, y: number, w: number, d: number, z: number, rh: number, color: string, opt: { oh?: number; snow?: boolean } = {}) {
    const oh = opt.oh ?? 0.06;
    const x0 = x - oh, y0 = y - oh, x1 = x + w + oh, y1 = y + d + oh;
    const apex = iso(x + w / 2, y + d / 2, z + rh);
    const c = opt.snow === false ? color : this.roof(color);
    this.poly([iso(x0, y0, z), iso(x1, y0, z), apex], shade(c, 0.2));
    this.poly([iso(x0, y0, z), iso(x0, y1, z), apex], shade(c, 0.05));
    this.poly([iso(x0, y1, z), iso(x1, y1, z), apex], shade(c, -0.22));
    this.poly([iso(x1, y0, z), iso(x1, y1, z), apex], c);
  }

  /** Corners of a rectangle on a wall. 'L' faces +y (screen left), 'R' faces +x (screen right). */
  private quadPts(face: 'L' | 'R', plane: number, a: number, len: number, z: number, h: number): Pt[] {
    const p = (t: number, zz: number): Pt => (face === 'L' ? iso(t, plane, zz) : iso(plane, t, zz));
    return [p(a, z), p(a + len, z), p(a + len, z + h), p(a, z + h)];
  }

  quad(face: 'L' | 'R', plane: number, a: number, len: number, z: number, h: number, color: string) {
    this.poly(this.quadPts(face, plane, a, len, z, h), color);
  }

  /** A wall patch that glows at night (windows, forge mouths). */
  glow(face: 'L' | 'R', plane: number, a: number, len: number, z: number, h: number, dark = WINDOW_DARK, lit = LIGHT) {
    const ps = this.quadPts(face, plane, a, len, z, h);
    this.poly(ps, dark);
    const [cx, cy] = ps.reduce(([sx, sy], [x, y]) => [sx + x / 4, sy + y / 4], [0, 0]);
    this.lights.circle(cx, cy, Math.max(6, len * 40)).fill({ color: lit, alpha: 0.18 });
    this.lights.poly(flat(ps)).fill({ color: lit });
  }

  windows(face: 'L' | 'R', plane: number, from: number, to: number, z: number, n: number, size = 0.16, h = 7) {
    const step = (to - from) / n;
    for (let i = 0; i < n; i++) this.glow(face, plane, from + step * (i + 0.5) - size / 2, size, z, h);
  }

  door(face: 'L' | 'R', plane: number, at: number, w = 0.2, h = 11, color = '#4a2f1c') {
    this.quad(face, plane, at - w / 2, w, 0, h, color);
  }

  lantern(p: Pt) {
    this.circle(p, 2, '#5a4a2a');
    this.lights.circle(p[0], p[1], 9).fill({ color: LIGHT, alpha: 0.22 });
    this.lights.circle(p[0], p[1], 2.4).fill({ color: LIGHT });
  }
}

// ------------------------------------------------------------------ figures and scenery

/** A small person standing at the origin of `g`. */
export function drawPerson(g: Graphics, color: string, opt: { hat?: string; hurt?: boolean } = {}) {
  g.ellipse(0, 0, 4, 2).fill({ color: '#000000', alpha: 0.3 });
  g.roundRect(-2.6, -11, 5.2, 9.5, 2).fill(color).stroke(STROKE);
  g.circle(0, -13.5, 2.8).fill('#e9c39b').stroke(STROKE);
  if (opt.hat) g.poly([-3.5, -15, 3.5, -15, 0, -21]).fill(opt.hat);
  if (opt.hurt) {
    g.rect(3, -20, 5, 5).fill('#ffffff');
    g.rect(4.9, -19.4, 1.2, 3.8).fill('#d62f2f');
    g.rect(3.6, -18.1, 3.8, 1.2).fill('#d62f2f');
  }
}

const CROWNS: Record<SeasonId, [string, string, string]> = {
  spring: ['#4f8a34', '#5e9c3c', '#7cba52'],
  summer: ['#3f6b2e', '#4a7a34', '#5d9140'],
  autumn: ['#b9541f', '#d9822b', '#e6a83a'],
  winter: ['#6b5a48', '#6b5a48', '#6b5a48'],
};

export function drawTree(g: Graphics, season: SeasonId, s = 1) {
  g.ellipse(0, 0, 9 * s, 4 * s).fill({ color: '#000000', alpha: 0.2 });
  g.rect(-1.5 * s, -12 * s, 3 * s, 12 * s).fill('#5b3d22');
  if (season === 'winter') {
    const branches: [number, number, number, number][] = [[0, -12, -7, -22], [0, -14, 6, -24], [0, -18, -2, -28], [-4, -17, -9, -19], [3, -19, 8, -18]];
    for (const [a, b, c, d] of branches) g.moveTo(a * s, b * s).lineTo(c * s, d * s).stroke({ width: 1.4 * s, color: '#5b3d22', cap: 'round' });
    g.circle(-7 * s, -22 * s, 1.6 * s).fill('#ffffff');
    g.circle(6 * s, -24 * s, 1.6 * s).fill('#ffffff');
    return;
  }
  const [a, b, c] = CROWNS[season];
  g.circle(0, -19 * s, 10 * s).fill(a);
  g.circle(-4 * s, -16 * s, 7 * s).fill(b);
  g.circle(3 * s, -23 * s, 6 * s).fill(c);
  if (season === 'spring') {
    for (const [x, y] of [[-5, -21], [4, -17], [0, -26], [6, -22], [-2, -14]]) g.circle(x * s, y * s, 1.3 * s).fill('#f4b6c8');
  }
}

export function drawPine(g: Graphics, season: SeasonId, s = 1) {
  g.ellipse(0, 0, 7 * s, 3.5 * s).fill({ color: '#000000', alpha: 0.2 });
  g.rect(-1.5 * s, -8 * s, 3 * s, 8 * s).fill('#4d331c');
  const dark = season === 'autumn' ? '#35552f' : '#2f5a34';
  const mid = season === 'spring' ? '#447a46' : '#3a6c3f';
  g.poly([-10 * s, -6 * s, 10 * s, -6 * s, 0, -24 * s]).fill(dark);
  g.poly([-8 * s, -15 * s, 8 * s, -15 * s, 0, -32 * s]).fill(mid);
  g.poly([0, -32 * s, 8 * s, -15 * s, 2 * s, -15 * s]).fill('#2a4f2e');
  if (season === 'winter') {
    g.poly([-4 * s, -24 * s, 4 * s, -24 * s, 0, -32 * s]).fill('#f4f7fa');
    g.poly([-6 * s, -12 * s, 6 * s, -12 * s, 0, -20 * s]).fill({ color: '#f4f7fa', alpha: 0.85 });
  }
}

export function drawRock(g: Graphics, season: SeasonId, s = 1) {
  g.poly([-8 * s, 0, -5 * s, -7 * s, 3 * s, -9 * s, 8 * s, -2 * s, 4 * s, 2 * s]).fill('#8b8a85').stroke(STROKE);
  g.poly([-5 * s, -7 * s, 3 * s, -9 * s, 1 * s, -3 * s]).fill(season === 'winter' ? '#f4f7fa' : '#a6a59f');
}

export function drawBush(g: Graphics, season: SeasonId) {
  const [a, b] = season === 'autumn' ? ['#a65a24', '#c97a2e'] : season === 'winter' ? ['#dfe6ea', '#f4f7fa'] : ['#4f7d36', '#5d9140'];
  g.circle(-3, -3, 4).fill(a);
  g.circle(3, -4, 4.5).fill(b);
  if (season === 'spring' || season === 'summer') g.circle(6, -6, 1.2).fill('#e0707a');
}
