// Procedural isometric sprites. Every building is drawn from a few primitives (boxes, roofs,
// wall quads) so that it scales with level and lights up at night. To use painted art instead,
// replace the body of a building's function with an <image> anchored at iso(plot centre).
import type { ReactNode } from 'react';
import type { AdventurerClass, BuildingId } from '../../game/types';
import { iso, pts, shade, type Pt } from './iso';
import type { Plot } from './layout';

const STROKE = 'rgba(25,15,5,0.4)';
const WINDOW_DARK = '#3a4652';
const WINDOW_LIT = '#ffd36b';

// ------------------------------------------------------------------ primitives

interface BoxProps { x: number; y: number; w: number; d: number; h: number; z?: number; color: string; top?: string }

/** Rectangular prism. Only the three faces visible from the camera are drawn. */
export function Box({ x, y, w, d, h, z = 0, color, top }: BoxProps) {
  const x1 = x + w, y1 = y + d, zt = z + h;
  return (
    <g stroke={STROKE} strokeWidth={0.6} strokeLinejoin="round">
      <polygon points={pts(iso(x, y1, z), iso(x1, y1, z), iso(x1, y1, zt), iso(x, y1, zt))} fill={shade(color, -0.3)} />
      <polygon points={pts(iso(x1, y, z), iso(x1, y1, z), iso(x1, y1, zt), iso(x1, y, zt))} fill={shade(color, -0.08)} />
      <polygon points={pts(iso(x, y, zt), iso(x1, y, zt), iso(x1, y1, zt), iso(x, y1, zt))} fill={top ?? shade(color, 0.12)} />
    </g>
  );
}

interface RoofProps { x: number; y: number; w: number; d: number; z: number; rh: number; color: string; wall?: string; oh?: number }

/** Gable roof. axis 'x' runs the ridge along x; 'y' along y. */
export function Gable({ x, y, w, d, z, rh, color, wall, oh = 0.08, axis = 'x' }: RoofProps & { axis?: 'x' | 'y' }) {
  const x0 = x - oh, y0 = y - oh, x1 = x + w + oh, y1 = y + d + oh;
  const end = wall ?? shade(color, -0.1);
  if (axis === 'x') {
    const ym = y + d / 2;
    const r0 = iso(x0, ym, z + rh), r1 = iso(x1, ym, z + rh);
    return (
      <g stroke={STROKE} strokeWidth={0.6} strokeLinejoin="round">
        <polygon points={pts(iso(x0, y0, z), iso(x1, y0, z), r1, r0)} fill={shade(color, 0.15)} />
        <polygon points={pts(iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, ym, z + rh))} fill={shade(end, -0.08)} />
        <polygon points={pts(iso(x0, y1, z), iso(x1, y1, z), r1, r0)} fill={shade(color, -0.12)} />
      </g>
    );
  }
  const xm = x + w / 2;
  const r0 = iso(xm, y0, z + rh), r1 = iso(xm, y1, z + rh);
  return (
    <g stroke={STROKE} strokeWidth={0.6} strokeLinejoin="round">
      <polygon points={pts(iso(x0, y0, z), iso(x0, y1, z), r1, r0)} fill={shade(color, 0.05)} />
      <polygon points={pts(iso(x, y + d, z), iso(x + w, y + d, z), iso(xm, y + d, z + rh))} fill={shade(end, -0.3)} />
      <polygon points={pts(iso(x1, y0, z), iso(x1, y1, z), r1, r0)} fill={shade(color, 0.08)} />
    </g>
  );
}

export function Pyramid({ x, y, w, d, z, rh, color, oh = 0.06 }: RoofProps) {
  const x0 = x - oh, y0 = y - oh, x1 = x + w + oh, y1 = y + d + oh;
  const apex = iso(x + w / 2, y + d / 2, z + rh);
  return (
    <g stroke={STROKE} strokeWidth={0.6} strokeLinejoin="round">
      <polygon points={pts(iso(x0, y0, z), iso(x1, y0, z), apex)} fill={shade(color, 0.2)} />
      <polygon points={pts(iso(x0, y0, z), iso(x0, y1, z), apex)} fill={shade(color, 0.05)} />
      <polygon points={pts(iso(x0, y1, z), iso(x1, y1, z), apex)} fill={shade(color, -0.22)} />
      <polygon points={pts(iso(x1, y0, z), iso(x1, y1, z), apex)} fill={color} />
    </g>
  );
}

/** A rectangle painted on a wall: 'L' is the wall facing +y (screen left), 'R' faces +x (screen right). */
function Quad({ face, plane, a, len, z, h, fill }: { face: 'L' | 'R'; plane: number; a: number; len: number; z: number; h: number; fill: string }) {
  const p = (t: number, zz: number): Pt => (face === 'L' ? iso(t, plane, zz) : iso(plane, t, zz));
  return <polygon points={pts(p(a, z), p(a + len, z), p(a + len, z + h), p(a, z + h))} fill={fill} stroke={STROKE} strokeWidth={0.5} />;
}

function Windows({ face, plane, from, to, z, n, lit, size = 0.16, h = 7 }: {
  face: 'L' | 'R'; plane: number; from: number; to: number; z: number; n: number; lit: boolean; size?: number; h?: number;
}) {
  const step = (to - from) / n;
  return (
    <g className={lit ? 'lit' : undefined}>
      {Array.from({ length: n }, (_, i) => (
        <Quad key={i} face={face} plane={plane} a={from + step * (i + 0.5) - size / 2} len={size} z={z} h={h}
          fill={lit ? WINDOW_LIT : WINDOW_DARK} />
      ))}
    </g>
  );
}

function Door({ face, plane, at, w = 0.2, h = 11, fill = '#4a2f1c' }: { face: 'L' | 'R'; plane: number; at: number; w?: number; h?: number; fill?: string }) {
  return <Quad face={face} plane={plane} a={at - w / 2} len={w} z={0} h={h} fill={fill} />;
}

function Shadow({ x, y, rx = 5, ry = 2.5 }: { x: number; y: number; rx?: number; ry?: number }) {
  const [cx, cy] = iso(x, y);
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(0,0,0,0.25)" />;
}

function Foundation({ p, color = '#8f7a55' }: { p: Plot; color?: string }) {
  const m = 0.06;
  return (
    <polygon points={pts(iso(p.x + m, p.y + m), iso(p.x + p.w - m, p.y + m), iso(p.x + p.w - m, p.y + p.d - m), iso(p.x + m, p.y + p.d - m))}
      fill={color} opacity={0.55} />
  );
}

export function Smoke({ at }: { at: Pt }) {
  return (
    <g transform={`translate(${at[0]},${at[1]})`} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <circle key={i} className="smoke" r={4} fill="#c9c4bd" style={{ animationDelay: `${i * 1.1}s` }} />
      ))}
    </g>
  );
}

function Flag({ at, color = '#d9a441' }: { at: Pt; color?: string }) {
  const [x, y] = at;
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - 16} stroke="#3b2b1b" strokeWidth={1.2} />
      <polygon className="flag" points={pts([x, y - 16], [x + 12, y - 13], [x, y - 9])} fill={color} />
    </g>
  );
}

// ------------------------------------------------------------------ scenery

export function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [cx, cy] = iso(x, y);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={9 * s} ry={4 * s} fill="rgba(0,0,0,0.22)" />
      <rect x={cx - 1.5 * s} y={cy - 12 * s} width={3 * s} height={12 * s} fill="#5b3d22" />
      <circle cx={cx} cy={cy - 19 * s} r={10 * s} fill="#3f6b2e" />
      <circle cx={cx - 4 * s} cy={cy - 16 * s} r={7 * s} fill="#4a7a34" />
      <circle cx={cx + 3 * s} cy={cy - 23 * s} r={6 * s} fill="#5d9140" />
    </g>
  );
}

export function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [cx, cy] = iso(x, y);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={7 * s} ry={3.5 * s} fill="rgba(0,0,0,0.22)" />
      <rect x={cx - 1.5 * s} y={cy - 8 * s} width={3 * s} height={8 * s} fill="#4d331c" />
      <polygon points={pts([cx - 10 * s, cy - 6 * s], [cx + 10 * s, cy - 6 * s], [cx, cy - 24 * s])} fill="#2f5a34" />
      <polygon points={pts([cx - 8 * s, cy - 15 * s], [cx + 8 * s, cy - 15 * s], [cx, cy - 32 * s])} fill="#3a6c3f" />
      <polygon points={pts([cx, cy - 32 * s], [cx + 8 * s, cy - 15 * s], [cx + 2 * s, cy - 15 * s])} fill="#2a4f2e" />
    </g>
  );
}

export function Rock({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [cx, cy] = iso(x, y);
  return (
    <g>
      <polygon points={pts([cx - 8 * s, cy], [cx - 5 * s, cy - 7 * s], [cx + 3 * s, cy - 9 * s], [cx + 8 * s, cy - 2 * s], [cx + 4 * s, cy + 2 * s])} fill="#8b8a85" stroke={STROKE} strokeWidth={0.6} />
      <polygon points={pts([cx - 5 * s, cy - 7 * s], [cx + 3 * s, cy - 9 * s], [cx + 1 * s, cy - 3 * s])} fill="#a6a59f" />
    </g>
  );
}

export function Bush({ x, y }: { x: number; y: number }) {
  const [cx, cy] = iso(x, y);
  return (
    <g>
      <circle cx={cx - 3} cy={cy - 3} r={4} fill="#4f7d36" />
      <circle cx={cx + 3} cy={cy - 4} r={4.5} fill="#5d9140" />
      <circle cx={cx + 6} cy={cy - 6} r={1.2} fill="#e0707a" />
    </g>
  );
}

export const CLASS_COLORS: Record<AdventurerClass, string> = {
  warrior: '#b03a2e', rogue: '#34343a', mage: '#4b4bb8', ranger: '#2e7d32', cleric: '#e6d9a0',
};

/** A small person standing at the origin of the enclosing transform. */
export function Person({ color, hat }: { color: string; hat?: string }) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={4} ry={2} fill="rgba(0,0,0,0.3)" />
      <rect x={-2.6} y={-11} width={5.2} height={9.5} rx={2} fill={color} stroke={STROKE} strokeWidth={0.5} />
      <circle cx={0} cy={-13.5} r={2.8} fill="#e9c39b" stroke={STROKE} strokeWidth={0.5} />
      {hat && <polygon points={pts([-3.5, -15], [3.5, -15], [0, -21])} fill={hat} />}
    </g>
  );
}

// ------------------------------------------------------------------ buildings

interface SpriteProps { p: Plot; level: number; lit: boolean }

const inset = (p: Plot, m: number) => ({ x: p.x + m, y: p.y + m, w: p.w - 2 * m, d: p.d - 2 * m });
const grow = (level: number, k = 0.12) => 1 + k * (Math.max(1, level) - 1);

function TownHall({ p, level, lit }: SpriteProps) {
  const { x, y, w, d } = inset(p, 0.15);
  const h = 24 * grow(level);
  const ts = 0.65;
  const th = h + 18 + level * 5;
  const wall = '#b8a98c';
  return (
    <g>
      <Foundation p={p} color="#9b9079" />
      <Box x={x} y={y} w={ts} d={ts} h={th} color="#cbbfa6" />
      <Windows face="R" plane={x + ts} from={y} to={y + ts} z={th - 14} n={1} lit={lit} />
      <Pyramid x={x} y={y} w={ts} d={ts} z={th} rh={18} color="#3f5f8f" />
      <Flag at={iso(x + ts / 2, y + ts / 2, th + 18)} />
      <Box x={x} y={y} w={w} d={d} h={h} color={wall} />
      <Windows face="L" plane={y + d} from={x} to={x + w} z={h * 0.45} n={4} lit={lit} />
      <Windows face="R" plane={x + w} from={y} to={y + d} z={h * 0.45} n={4} lit={lit} />
      <Door face="L" plane={y + d} at={x + w / 2} w={0.28} h={13} />
      <Gable x={x} y={y} w={w} d={d} z={h} rh={16} color="#8c3b2e" wall={wall} axis="x" />
    </g>
  );
}

function Tavern({ p, level, lit }: SpriteProps) {
  const { x, y, w, d } = inset(p, 0.2);
  const h = 30 * grow(level, 0.1);
  const wall = '#d9b57a';
  const beam = (z: number) => (
    <g stroke="#5a3a1e" strokeWidth={1.6}>
      <line x1={iso(x, y + d, z)[0]} y1={iso(x, y + d, z)[1]} x2={iso(x + w, y + d, z)[0]} y2={iso(x + w, y + d, z)[1]} />
      <line x1={iso(x + w, y, z)[0]} y1={iso(x + w, y, z)[1]} x2={iso(x + w, y + d, z)[0]} y2={iso(x + w, y + d, z)[1]} />
    </g>
  );
  const sign = iso(x + w + 0.05, y + d - 0.15, h * 0.7);
  return (
    <g>
      <Foundation p={p} />
      <Box x={x + 0.2} y={y + 0.15} w={0.3} d={0.3} h={h + 22} color="#7d6f63" />
      <Box x={x} y={y} w={w} d={d} h={h} color={wall} />
      {beam(h * 0.5)}
      <Windows face="L" plane={y + d} from={x} to={x + w} z={h * 0.62} n={3} lit={lit} />
      <Windows face="R" plane={x + w} from={y} to={y + d} z={h * 0.62} n={3} lit={lit} />
      <Windows face="R" plane={x + w} from={y} to={y + d * 0.6} z={h * 0.15} n={2} lit={lit} />
      <Door face="L" plane={y + d} at={x + w * 0.55} w={0.26} h={12} />
      <Gable x={x} y={y} w={w} d={d} z={h} rh={18} color="#7b3b22" wall={wall} axis="y" />
      <Smoke at={iso(x + 0.35, y + 0.3, h + 26)} />
      <g transform={`translate(${sign[0]},${sign[1]})`}>
        <line x1={0} y1={0} x2={7} y2={-3} stroke="#3b2b1b" strokeWidth={1.2} />
        <rect x={3} y={-1} width={10} height={9} rx={1} fill="#6b4423" stroke={STROKE} />
        <text x={8} y={6} fontSize={7} textAnchor="middle">🍺</text>
      </g>
      <Barrel x={x + w + 0.08} y={y + 0.2} />
      <Barrel x={x + w + 0.1} y={y + 0.45} />
      {lit && <circle cx={iso(x + w * 0.4, y + d + 0.02, 14)[0]} cy={iso(x + w * 0.4, y + d + 0.02, 14)[1]} r={2.5} fill={WINDOW_LIT} className="lantern" />}
    </g>
  );
}

function Barrel({ x, y }: { x: number; y: number }) {
  const [cx, cy] = iso(x, y);
  return (
    <g>
      <rect x={cx - 4} y={cy - 9} width={8} height={9} fill="#7a4e2a" stroke={STROKE} strokeWidth={0.5} />
      <ellipse cx={cx} cy={cy - 9} rx={4} ry={2} fill="#9a6a3c" stroke={STROKE} strokeWidth={0.5} />
      <line x1={cx - 4} y1={cy - 4.5} x2={cx + 4} y2={cy - 4.5} stroke="#3d3d3d" strokeWidth={0.8} />
    </g>
  );
}

function Market({ p, level }: SpriteProps) {
  const cells: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const stalls = cells.slice(0, Math.min(4, level + 1));
  const awnings = ['#c0392b', '#2e86c1', '#d68910', '#7d3c98'];
  return (
    <g>
      <Foundation p={p} color="#b8a682" />
      {stalls.map(([cx, cy], i) => {
        const x = p.x + cx + 0.15, y = p.y + cy + 0.15, s = 0.7, top = 18;
        const post = (px: number, py: number) => {
          const a = iso(px, py, 0), b = iso(px, py, top);
          return <line key={`${px},${py}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#5a3a1e" strokeWidth={1.2} />;
        };
        const stripes = 4;
        return (
          <g key={i}>
            {post(x, y)}
            {post(x + s, y)}
            {post(x, y + s)}
            <Box x={x + 0.05} y={y + 0.3} w={s - 0.1} d={0.3} h={7} color="#9a6b3f" />
            {[0, 1, 2].map((k) => {
              const [gx, gy] = iso(x + 0.2 + k * 0.17, y + 0.45, 8.5);
              return <circle key={k} cx={gx} cy={gy} r={1.8} fill={['#e74c3c', '#f1c40f', '#27ae60'][(k + i) % 3]} />;
            })}
            {post(x + s, y + s)}
            {Array.from({ length: stripes }, (_, k) => {
              const a = x + (s * k) / stripes, b = x + (s * (k + 1)) / stripes;
              return (
                <polygon key={k} points={pts(iso(a, y, top), iso(b, y, top), iso(b, y + s, top - 3), iso(a, y + s, top - 3))}
                  fill={k % 2 ? '#f3ead8' : awnings[i]} stroke={STROKE} strokeWidth={0.4} />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function Warehouse({ p, level }: SpriteProps) {
  const { x, y, d } = inset(p, 0.15);
  const w = p.w - 0.6;
  const h = 22 * grow(level, 0.08);
  const wall = '#8a4b32';
  const crates = Math.min(4, level);
  const door = { at: x + w / 2, w: 0.5 };
  const [d0, d1] = [iso(door.at - door.w / 2, y + d, 0), iso(door.at + door.w / 2, y + d, 15)];
  return (
    <g>
      <Foundation p={p} />
      <Box x={x} y={y} w={w} d={d} h={h} color={wall} />
      <Door face="L" plane={y + d} at={door.at} w={door.w} h={15} fill="#5a2f1d" />
      <line x1={d0[0]} y1={d0[1]} x2={d1[0]} y2={d1[1]} stroke="#3a1d10" strokeWidth={1} />
      <Gable x={x} y={y} w={w} d={d} z={h} rh={16} color="#5d5d66" wall={wall} axis="y" />
      {Array.from({ length: crates }, (_, i) => (
        <Box key={i} x={x + w + 0.08} y={y + 0.1 + i * 0.4} w={0.3} d={0.3} h={8} color="#b08850" />
      ))}
    </g>
  );
}

function Workshop({ p, level, lit }: SpriteProps) {
  const x = p.x + 0.2, y = p.y + 0.2, w = 1.2, d = 1.1;
  const h = 18 * grow(level);
  const wall = '#a67c52';
  return (
    <g>
      <Foundation p={p} />
      <Box x={x} y={y} w={w} d={d} h={h} color={wall} />
      <Windows face="R" plane={x + w} from={y} to={y + d} z={h * 0.4} n={2} lit={lit} />
      <Door face="L" plane={y + d} at={x + w * 0.4} w={0.3} h={12} />
      <Gable x={x} y={y} w={w} d={d} z={h} rh={14} color="#c9a14a" wall={wall} axis="x" />
      <Box x={p.x + 1.55} y={p.y + 0.4} w={0.3} d={0.9} h={3} color="#d8b483" />
      <Box x={p.x + 1.55} y={p.y + 0.4} w={0.3} d={0.9} h={3} z={3} color="#caa070" />
      <Box x={p.x + 0.4} y={p.y + 1.5} w={0.8} d={0.15} h={5} color="#8b5a2b" />
    </g>
  );
}

function Smithy({ p, level, lit }: SpriteProps) {
  const { x, y, w, d } = inset(p, 0.2);
  const h = 17 * grow(level);
  const ch = h + 24;
  return (
    <g>
      <Foundation p={p} color="#6f6a62" />
      <Box x={x + 0.1} y={y + 0.1} w={0.35} d={0.35} h={ch} color="#55514d" />
      <Box x={x} y={y} w={w} d={d} h={h} color="#6d6a66" />
      <g className={lit ? 'lit' : undefined}>
        <Quad face="L" plane={y + d} a={x + w * 0.3} len={0.5} z={0} h={12} fill={lit ? '#ff9a3a' : '#e0701f'} />
      </g>
      <Windows face="R" plane={x + w} from={y} to={y + d} z={h * 0.45} n={2} lit={lit} />
      <Gable x={x} y={y} w={w} d={d} z={h} rh={14} color="#3b3f4a" wall="#6d6a66" axis="y" />
      <Smoke at={iso(x + 0.28, y + 0.28, ch + 4)} />
      <Box x={x + w * 0.6} y={y + d + 0.08} w={0.22} d={0.12} h={5} color="#2c2c30" />
    </g>
  );
}

function Apothecary({ p, level, lit }: SpriteProps) {
  const x = p.x + 0.35, y = p.y + 0.35, w = 1.2, d = 1.2;
  const h = 26 * grow(level);
  const wall = '#d6c9ad';
  return (
    <g>
      <Foundation p={p} />
      <Box x={x} y={y} w={w} d={d} h={h} color={wall} />
      <Windows face="L" plane={y + d} from={x} to={x + w} z={h * 0.6} n={2} lit={lit} />
      <Windows face="R" plane={x + w} from={y} to={y + d} z={h * 0.6} n={2} lit={lit} />
      <Door face="L" plane={y + d} at={x + w * 0.5} h={11} fill="#3d5a3a" />
      <Pyramid x={x} y={y} w={w} d={d} z={h} rh={22} color="#5b3d7a" />
      {[0, 1, 2].map((i) => (
        <Box key={i} x={x + w + 0.1} y={y + 0.15 + i * 0.35} w={0.2} d={0.2} h={4} color="#9c5b3a" top="#4f8f3a" />
      ))}
    </g>
  );
}

function LumberCamp({ p, level }: SpriteProps) {
  const piles = Math.min(4, level);
  return (
    <g>
      <Foundation p={p} color="#7d6a48" />
      <Pine x={p.x + 0.4} y={p.y + 1.6} s={1.1} />
      <Pine x={p.x + 1.7} y={p.y + 0.35} s={1.2} />
      <Box x={p.x + 0.9} y={p.y + 0.8} w={1.1} d={0.9} h={14} color="#7a5230" />
      <Gable x={p.x + 0.9} y={p.y + 0.8} w={1.1} d={0.9} z={14} rh={10} color="#4f3a26" wall="#7a5230" axis="x" />
      {Array.from({ length: piles }, (_, i) => <LogPile key={i} x={p.x + 0.35 + (i % 2) * 1.3} y={p.y + 2.1 + Math.floor(i / 2) * 0.45} />)}
      <Stump x={p.x + 2.5} y={p.y + 1.2} />
      <Stump x={p.x + 2.3} y={p.y + 2.6} />
    </g>
  );
}

function LogPile({ x, y }: { x: number; y: number }) {
  const logs: [number, number][] = [[0, 2], [0.12, 2], [0.24, 2], [0.06, 7], [0.18, 7]];
  return (
    <g>
      {logs.map(([dy, z], i) => {
        const a = iso(x, y + dy, z), b = iso(x + 0.8, y + dy, z);
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1] - 2} x2={b[0]} y2={b[1] - 2} stroke="#8b5a2b" strokeWidth={5} strokeLinecap="round" />
            <circle cx={b[0]} cy={b[1] - 2} r={2.4} fill="#d8b483" />
          </g>
        );
      })}
    </g>
  );
}

function Stump({ x, y }: { x: number; y: number }) {
  const [cx, cy] = iso(x, y);
  return (
    <g>
      <rect x={cx - 3.5} y={cy - 4} width={7} height={4} fill="#6b4423" />
      <ellipse cx={cx} cy={cy - 4} rx={3.5} ry={1.8} fill="#d8b483" />
    </g>
  );
}

function Quarry({ p, level }: SpriteProps) {
  const terraces = 3;
  const blocks = Math.min(5, level + 1);
  const ring = (k: number) => {
    const m = 0.2 + k * 0.35, z = -k * 6;
    return { x0: p.x + m, y0: p.y + m, x1: p.x + p.w - m, y1: p.y + p.d - m, z };
  };
  return (
    <g>
      {Array.from({ length: terraces }, (_, k) => {
        const r = ring(k);
        const inner = k + 1 < terraces ? ring(k + 1) : null;
        return (
          <g key={k}>
            <polygon points={pts(iso(r.x0, r.y0, r.z), iso(r.x1, r.y0, r.z), iso(r.x1, r.y1, r.z), iso(r.x0, r.y1, r.z))}
              fill={shade('#9a968e', -k * 0.12)} stroke={STROKE} strokeWidth={0.5} />
            {inner && (
              <g stroke={STROKE} strokeWidth={0.5}>
                <polygon points={pts(iso(inner.x0, inner.y0, r.z), iso(inner.x1, inner.y0, r.z), iso(inner.x1, inner.y0, inner.z), iso(inner.x0, inner.y0, inner.z))} fill={shade('#7d7a73', -k * 0.1)} />
                <polygon points={pts(iso(inner.x0, inner.y0, r.z), iso(inner.x0, inner.y1, r.z), iso(inner.x0, inner.y1, inner.z), iso(inner.x0, inner.y0, inner.z))} fill={shade('#6a6761', -k * 0.1)} />
              </g>
            )}
          </g>
        );
      })}
      {Array.from({ length: blocks }, (_, i) => (
        <Box key={i} x={p.x + 0.25 + (i % 3) * 0.35} y={p.y + p.d - 0.45 + (i >= 3 ? -0.0 : 0)} z={i >= 3 ? 7 : 0} w={0.3} d={0.25} h={7} color="#b5b1a8" />
      ))}
      <Box x={p.x + p.w - 0.55} y={p.y + 0.25} w={0.3} d={0.45} h={6} color="#7a5230" />
    </g>
  );
}

function Mine({ p, level, lit }: SpriteProps) {
  const x = p.x + 0.05, y = p.y + 0.05, w = p.w - 0.1, d = p.d - 0.1;
  const hill = 30 + level * 2;
  const ex = x + w / 2;
  const frame = [iso(ex - 0.28, y + d, 0), iso(ex - 0.28, y + d, 14), iso(ex + 0.28, y + d, 14), iso(ex + 0.28, y + d, 0)];
  return (
    <g>
      <Pyramid x={x} y={y} w={w} d={d} z={0} rh={hill} color="#7d6b4f" oh={0} />
      <polygon points={pts(iso(ex - 0.22, y + d, 0), iso(ex - 0.22, y + d, 12), iso(ex + 0.22, y + d, 12), iso(ex + 0.22, y + d, 0))} fill="#1b130d" />
      <polyline points={pts(...frame)} fill="none" stroke="#8b5a2b" strokeWidth={2.4} />
      {lit && <circle cx={frame[1][0] - 2} cy={frame[1][1] + 3} r={2.2} fill={WINDOW_LIT} className="lantern" />}
      <Box x={ex - 0.1} y={y + d + 0.05} w={0.3} d={0.22} h={5} color="#5b4a3a" top="#3a3530" />
    </g>
  );
}

function HerbGarden({ p, level }: SpriteProps) {
  const beds = Math.min(3, level);
  const flowers = ['#e0707a', '#f1c40f', '#b07ad9', '#ffffff'];
  return (
    <g>
      <Foundation p={p} color="#7d6a48" />
      {Array.from({ length: beds }, (_, i) => {
        const bx = p.x + 0.15, by = p.y + 0.2 + i * 0.58;
        return (
          <g key={i}>
            <Box x={bx} y={by} w={1.7} d={0.38} h={4} color="#6b4a2f" top="#3e7a3a" />
            {Array.from({ length: 6 }, (_, k) => {
              const [fx, fy] = iso(bx + 0.15 + k * 0.27, by + 0.19, 5.5);
              return <circle key={k} cx={fx} cy={fy} r={1.6} fill={flowers[(k + i) % flowers.length]} />;
            })}
          </g>
        );
      })}
    </g>
  );
}

function Farm({ p, level }: SpriteProps) {
  const fields = Math.min(4, 1 + Math.floor((level - 1) / 2));
  const cells: [number, number][] = [[0, 0], [2, 0], [0, 2], [2, 2]];
  const crops = ['#d9b84a', '#8fbf4a', '#c9a23e', '#7fb04a'];
  return (
    <g>
      {cells.map(([cx, cy], i) => {
        const x = p.x + cx + 0.1, y = p.y + cy + 0.1, s = 1.8;
        const planted = i < fields;
        return (
          <g key={i}>
            <polygon points={pts(iso(x, y), iso(x + s, y), iso(x + s, y + s), iso(x, y + s))}
              fill={planted ? '#7a5a3a' : 'none'} stroke={planted ? STROKE : 'rgba(255,255,255,0.25)'}
              strokeDasharray={planted ? undefined : '4 3'} />
            {planted && Array.from({ length: 6 }, (_, r) => (
              <Box key={r} x={x + 0.1} y={y + 0.12 + r * 0.28} w={s - 0.2} d={0.14} h={3} color={crops[i]} />
            ))}
          </g>
        );
      })}
      <g transform={`translate(${iso(p.x + 2, p.y + 2)[0]},${iso(p.x + 2, p.y + 2)[1]})`}>
        <line x1={-6} y1={-12} x2={6} y2={-12} stroke="#5b3d22" strokeWidth={1.4} />
        <Person color="#a0522d" hat="#c9a14a" />
      </g>
    </g>
  );
}

const COTTAGE_WALLS = ['#e8d8b0', '#d9c7a0', '#efe3c8', '#dccbb0'];
const COTTAGE_ROOFS = ['#9c4a2f', '#c9a14a', '#6e4b3a', '#8c3b2e', '#5d6b7a'];

export function Cottage({ p, index, lit }: { p: Plot; index: number; lit: boolean }) {
  const x = p.x + 0.18, y = p.y + 0.22, w = 0.62, d = 0.56, h = 15;
  const wall = COTTAGE_WALLS[index % COTTAGE_WALLS.length];
  const axis = index % 2 ? 'y' : 'x';
  return (
    <g>
      <Shadow x={p.x + 0.55} y={p.y + 0.85} rx={18} ry={6} />
      <Box x={x + 0.1} y={y + 0.08} w={0.14} d={0.14} h={h + 14} color="#7d6f63" />
      <Box x={x} y={y} w={w} d={d} h={h} color={wall} />
      <Windows face="R" plane={x + w} from={y} to={y + d} z={6} n={1} lit={lit} />
      <Door face="L" plane={y + d} at={x + w * 0.5} w={0.16} h={9} />
      <Gable x={x} y={y} w={w} d={d} z={h} rh={11} color={COTTAGE_ROOFS[index % COTTAGE_ROOFS.length]} wall={wall} axis={axis} />
    </g>
  );
}

const SPRITES: Record<Exclude<BuildingId, 'house'>, (props: SpriteProps) => ReactNode> = {
  town_hall: TownHall, tavern: Tavern, market: Market, warehouse: Warehouse, workshop: Workshop, smithy: Smithy,
  apothecary: Apothecary, lumber_camp: LumberCamp, quarry: Quarry, mine: Mine, herb_garden: HerbGarden, farm: Farm,
};

export function BuildingSprite({ id, ...props }: SpriteProps & { id: Exclude<BuildingId, 'house'> }) {
  const Sprite = SPRITES[id];
  return <Sprite {...props} />;
}

/** Wooden scaffolding shown over a plot while it is under construction. */
export function Scaffold({ p, h = 30 }: { p: Plot; h?: number }) {
  const { x, y, w, d } = { x: p.x + 0.15, y: p.y + 0.15, w: Math.max(0.7, p.w - 0.3), d: Math.max(0.7, p.d - 0.3) };
  const corners: [number, number][] = [[x, y], [x + w, y], [x, y + d], [x + w, y + d]];
  const ring = (z: number) => pts(iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z));
  return (
    <g stroke="#a0703c" strokeWidth={1.6} fill="none" pointerEvents="none">
      {corners.map(([cx, cy], i) => {
        const a = iso(cx, cy, 0), b = iso(cx, cy, h);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
      })}
      <polygon points={ring(h * 0.5)} />
      <polygon points={ring(h)} />
      <line x1={iso(x, y + d, 0)[0]} y1={iso(x, y + d, 0)[1]} x2={iso(x + w, y + d, h)[0]} y2={iso(x + w, y + d, h)[1]} />
    </g>
  );
}

/** Marker on an empty plot: a dashed outline and a signpost. */
export function EmptyPlot({ p }: { p: Plot }) {
  const m = 0.1;
  const [sx, sy] = iso(p.x + p.w / 2, p.y + p.d / 2);
  return (
    <g>
      <polygon points={pts(iso(p.x + m, p.y + m), iso(p.x + p.w - m, p.y + m), iso(p.x + p.w - m, p.y + p.d - m), iso(p.x + m, p.y + p.d - m))}
        fill="rgba(60,40,20,0.18)" stroke="rgba(255,240,200,0.55)" strokeWidth={1.2} strokeDasharray="5 4" />
      <line x1={sx} y1={sy} x2={sx} y2={sy - 18} stroke="#5b3d22" strokeWidth={1.6} />
      <rect x={sx - 8} y={sy - 22} width={16} height={9} rx={1.5} fill="#c9a46a" stroke={STROKE} />
      <text x={sx} y={sy - 15} fontSize={7} textAnchor="middle" fill="#3b2b1b" fontWeight={700}>+</text>
    </g>
  );
}
