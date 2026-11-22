import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { BUILDINGS } from '../../game/data';
import { buildHours, hourOfDay } from '../../game/rules';
import type { BuildingId, GameState } from '../../game/types';
import { hash, iso, pts, shade } from './iso';
import { DECORATIONS, GRID, HOUSE_SPOTS, PLOTS, ROAD_X, ROAD_Y, isRoad, type Plot } from './layout';
import {
  BuildingSprite, Bush, CLASS_COLORS, Cottage, EmptyPlot, Person, Pine, Rock, Scaffold, Tree,
} from './sprites';

const BASE_W = 1000; // world units visible across the map at zoom 1
const CENTER: [number, number] = [0, 236];
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 3;

/** 0 in daylight, up to ~0.5 in the dead of night. */
export function darkness(hour: number): number {
  if (hour >= 21 || hour < 5) return 0.5;
  if (hour >= 18) return ((hour - 18) / 3) * 0.5;
  if (hour < 8) return ((8 - hour) / 3) * 0.5;
  return 0;
}

interface Entity {
  key: string;
  depth: number;
  node: ReactNode;
}

const plotsOf = (id: BuildingId, level: number): Plot[] =>
  id === 'house' ? HOUSE_SPOTS.slice(0, Math.max(1, level)) : [PLOTS[id]];

export function VillageMap({ state, selected, onSelect }: {
  state: GameState;
  selected: BuildingId | null;
  onSelect: (id: BuildingId) => void;
}) {
  const [view, setView] = useState({ x: CENTER[0], y: CENTER[1], zoom: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [aspect, setAspect] = useState(0.7);
  const drag = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(null);
  const movedRef = useRef(false);

  // Keep the viewBox at the container's aspect ratio so the map fills it.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setAspect(height / width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom needs a non-passive listener so the page does not scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: clampZoom(v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
    movedRef.current = false;
    const scale = svgRef.current?.getScreenCTM()?.a ?? 1;
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.px, dy = ev.clientY - d.py;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        d.moved = true;
        movedRef.current = true;
      }
      if (d.moved) setView((v) => ({ ...v, x: d.vx - dx / scale, y: d.vy - dy / scale }));
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const select = (id: BuildingId) => {
    if (!movedRef.current) onSelect(id);
  };

  const hour = hourOfDay(state);
  const dark = darkness(hour);
  const lit = dark > 0.15;
  const c = state.construction;

  // ---------------------------------------------------------------- entities, painter-sorted
  const entities: Entity[] = [];
  const depthOf = (p: Plot) => p.x + p.w + p.y + p.d;

  for (const d of DECORATIONS) {
    const node = d.kind === 'tree' ? <Tree x={d.x} y={d.y} /> : d.kind === 'pine' ? <Pine x={d.x} y={d.y} />
      : d.kind === 'rock' ? <Rock x={d.x} y={d.y} /> : <Bush x={d.x} y={d.y} />;
    entities.push({ key: `d${d.x},${d.y}`, depth: d.x + d.y + 0.5, node });
  }

  for (const id of Object.keys(PLOTS) as (keyof typeof PLOTS)[]) {
    const p = PLOTS[id];
    const level = state.buildings[id];
    const building = c?.building === id;
    if (level === 0 && !building) continue;
    entities.push({
      key: id,
      depth: depthOf(p),
      node: (
        <g className={`bld${selected === id ? ' selected' : ''}`} onClick={() => select(id)}>
          <title>{`${BUILDINGS[id].name}${level ? ` (level ${level})` : ''}`}</title>
          {level > 0 && <BuildingSprite id={id} p={p} level={level} lit={lit} />}
          {building && <Scaffold p={p} h={level > 0 ? 42 : 26} />}
        </g>
      ),
    });
  }

  HOUSE_SPOTS.forEach((p, i) => {
    const built = i < state.buildings.house;
    const building = c?.building === 'house' && i === state.buildings.house;
    if (!built && !building) return;
    entities.push({
      key: `house${i}`,
      depth: depthOf(p),
      node: (
        <g className={`bld${selected === 'house' ? ' selected' : ''}`} onClick={() => select('house')}>
          <title>{`Houses (level ${state.buildings.house})`}</title>
          {built && <Cottage p={p} index={i} lit={lit} />}
          {building && <Scaffold p={p} h={20} />}
        </g>
      ),
    });
  });

  // Idle adventurers loiter outside the tavern.
  const idle = state.buildings.tavern > 0 ? state.adventurers.filter((a) => a.status === 'idle').slice(0, 8) : [];
  idle.forEach((a, i) => {
    const x = PLOTS.tavern.x + 0.25 + (i % 4) * 0.45;
    const y = PLOTS.tavern.y + PLOTS.tavern.d + 0.2 + Math.floor(i / 4) * 0.5;
    const [sx, sy] = iso(x, y);
    entities.push({
      key: a.id,
      depth: x + y,
      node: (
        <g transform={`translate(${sx},${sy})`} className="bld" onClick={() => select('tavern')}>
          <title>{a.name}</title>
          <Person color={CLASS_COLORS[a.cls]} hat={a.cls === 'mage' ? '#2c2c80' : undefined} />
        </g>
      ),
    });
  });

  entities.sort((a, b) => a.depth - b.depth);

  // ---------------------------------------------------------------- overlays
  const selectedPlots = selected ? plotsOf(selected, state.buildings[selected]) : [];
  const unbuilt = (Object.keys(PLOTS) as (keyof typeof PLOTS)[]).filter(
    (id) => state.buildings[id] === 0 && c?.building !== id,
  );
  const progress = c ? 1 - (c.endsTick - state.tick) / buildHours(c.building, c.targetLevel) : 0;
  const progressAt = c ? (() => {
    const p = c.building === 'house' ? HOUSE_SPOTS[Math.min(state.buildings.house, HOUSE_SPOTS.length - 1)] : PLOTS[c.building];
    return iso(p.x + p.w / 2, p.y + p.d / 2, c.building === 'house' ? 40 : 70);
  })() : null;
  const label = selected ? (() => {
    const p = selected === 'house' ? HOUSE_SPOTS[0] : PLOTS[selected];
    return iso(p.x + p.w / 2, p.y + p.d / 2, selected === 'house' ? 48 : 84);
  })() : null;

  const vw = BASE_W / view.zoom, vh = vw * aspect;

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        className="village-map"
        viewBox={`${view.x - vw / 2} ${view.y - vh / 2} ${vw} ${vh}`}
        onPointerDown={onPointerDown}
        role="img"
        aria-label="Map of the village"
      >
        <Ground />
        {unbuilt.map((id) => (
          <g key={id} className={`bld plot${selected === id ? ' selected' : ''}`} onClick={() => select(id)}>
            <title>{`${BUILDINGS[id].name}: empty plot`}</title>
            <EmptyPlot p={PLOTS[id]} />
          </g>
        ))}
        {state.buildings.house === 0 && (
          <g className="bld plot" onClick={() => select('house')}><EmptyPlot p={HOUSE_SPOTS[0]} /></g>
        )}
        {selectedPlots.map((p, i) => (
          <polygon key={i} className="selection" points={pts(iso(p.x, p.y), iso(p.x + p.w, p.y), iso(p.x + p.w, p.y + p.d), iso(p.x, p.y + p.d))} />
        ))}
        {entities.map((e) => <g key={e.key}>{e.node}</g>)}
        <Villagers count={Math.min(state.population, 14)} />
        <rect x={-3000} y={-3000} width={6000} height={6000} fill="#0b1030" opacity={dark} pointerEvents="none" />
        {lit && (
          <g className="lights-only" pointerEvents="none" aria-hidden="true">
            {entities.map((e) => <g key={e.key}>{e.node}</g>)}
          </g>
        )}
        {lit && <Fireflies />}
        {c && progressAt && (
          <g transform={`translate(${progressAt[0]},${progressAt[1]})`} pointerEvents="none">
            <rect x={-26} y={-5} width={52} height={8} rx={4} fill="rgba(20,14,8,0.85)" />
            <rect x={-24} y={-3} width={48 * Math.max(0, Math.min(1, progress))} height={4} rx={2} fill="#d9a441" />
            <text y={-9} textAnchor="middle" className="map-label small">🔨 {BUILDINGS[c.building].name} {c.targetLevel}</text>
          </g>
        )}
        {selected && label && (
          <text x={label[0]} y={label[1]} textAnchor="middle" className="map-label" pointerEvents="none">
            {BUILDINGS[selected].name}{state.buildings[selected] ? ` · ${state.buildings[selected]}` : ''}
          </text>
        )}
      </svg>
      <div className="map-controls">
        <button className="ghost" onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.25) }))} aria-label="Zoom in">＋</button>
        <button className="ghost" onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.25) }))} aria-label="Zoom out">－</button>
        <button className="ghost" onClick={() => setView({ x: CENTER[0], y: CENTER[1], zoom: 1 })} aria-label="Reset view">⟲</button>
      </div>
      <div className="map-hint">Drag to pan · scroll to zoom · click a building or plot</div>
    </div>
  );
}

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** Static terrain: an island of grass tiles with dirt roads and earthen sides. Never re-renders. */
const Ground = memo(function Ground() {
  const tiles: ReactNode[] = [];
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      const road = isRoad(x, y);
      const base = road ? '#b89c6b' : '#6f9a48';
      const fill = shade(base, (hash(x, y, 9) - 0.5) * (road ? 0.08 : 0.14));
      tiles.push(<polygon key={`${x},${y}`} points={pts(iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1))} fill={fill} />);
    }
  }
  const depth = 22;
  return (
    <g pointerEvents="none">
      <ellipse cx={0} cy={GRID * 16 + 40} rx={GRID * 40} ry={GRID * 20} fill="rgba(0,0,0,0.25)" />
      <polygon points={pts(iso(0, GRID), iso(GRID, GRID), iso(GRID, GRID, -depth), iso(0, GRID, -depth))} fill="#5c4330" />
      <polygon points={pts(iso(GRID, 0), iso(GRID, GRID), iso(GRID, GRID, -depth), iso(GRID, 0, -depth))} fill="#7a5a3f" />
      <polygon points={pts(iso(0, GRID), iso(GRID, GRID), iso(GRID, GRID, -6), iso(0, GRID, -6))} fill="#4f7a36" />
      <polygon points={pts(iso(GRID, 0), iso(GRID, GRID), iso(GRID, GRID, -6), iso(GRID, 0, -6))} fill="#5f8c41" />
      {tiles}
      <Well />
    </g>
  );
});

function Well() {
  const [cx, cy] = iso(ROAD_X + 0.5, ROAD_Y + 0.5);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={11} ry={5.5} fill="#8b8a85" stroke="rgba(0,0,0,0.4)" />
      <ellipse cx={cx} cy={cy - 1} rx={7} ry={3.5} fill="#2b4a63" />
      <line x1={cx - 9} y1={cy} x2={cx - 9} y2={cy - 16} stroke="#5b3d22" strokeWidth={1.6} />
      <line x1={cx + 9} y1={cy} x2={cx + 9} y2={cy - 16} stroke="#5b3d22" strokeWidth={1.6} />
      <polygon points={pts([cx - 12, cy - 15], [cx + 12, cy - 15], [cx, cy - 23])} fill="#8c3b2e" />
    </g>
  );
}

const VILLAGER_COLORS = ['#8a6d4b', '#6b7f99', '#9c5b5b', '#6f8f5a', '#b39b6b', '#7a6a8c'];

/** Villagers stroll back and forth along the roads. */
const Villagers = memo(function Villagers({ count }: { count: number }) {
  const people: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const a = 1 + Math.floor(hash(i, 7) * 14);
    const b = 1 + Math.floor(hash(i, 8) * 14);
    const off = (hash(i, 9) - 0.5) * 0.5;
    const route = i % 2
      ? [iso(a + 0.5, ROAD_Y + 0.5 + off), iso(ROAD_X + 0.5 + off, ROAD_Y + 0.5 + off), iso(ROAD_X + 0.5 + off, b + 0.5)]
      : [iso(ROAD_X + 0.5 + off, a + 0.5), iso(ROAD_X + 0.5 + off, ROAD_Y + 0.5 + off), iso(b + 0.5, ROAD_Y + 0.5 + off)];
    const path = `M${route.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${[...route].reverse().slice(1).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`;
    const dur = 18 + hash(i, 10) * 16;
    people.push(
      <g key={i} pointerEvents="none">
        <Person color={VILLAGER_COLORS[i % VILLAGER_COLORS.length]} />
        <animateMotion dur={`${dur.toFixed(1)}s`} repeatCount="indefinite" path={path} begin={`-${(hash(i, 11) * dur).toFixed(1)}s`} />
      </g>,
    );
  }
  return <g>{people}</g>;
});

function Fireflies() {
  return (
    <g pointerEvents="none">
      {Array.from({ length: 14 }, (_, i) => {
        const [x, y] = iso(1 + hash(i, 21) * 14, 1 + hash(i, 22) * 14, 6 + hash(i, 23) * 14);
        return <circle key={i} cx={x} cy={y} r={1.4} fill="#fff3a0" className="firefly" style={{ animationDelay: `${(hash(i, 24) * 3).toFixed(2)}s` }} />;
      })}
    </g>
  );
}
