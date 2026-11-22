// The village scene, rendered with PixiJS. Owned by <VillageMap>, which feeds it game state.
// React never touches the canvas: `update()` diffs the state against what is on screen and
// rebuilds only what changed; a ticker animates people, smoke, weather and flags in between.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { BUILDINGS, type SeasonId } from '../../game/data';
import { FOOTPRINTS, GRID, ROAD_X, ROAD_Y, isRoad, plotAt, type Plot } from '../../game/map';
import { buildHours, hourOfDay, occupiedTiles, placedPlots, placementBlocker, season } from '../../game/rules';
import type { Adventurer, BuildingId, GameState, Tile } from '../../game/types';
import { drawBuilding, drawScaffold, type BuildingMeta } from './buildings';
import { LIGHT, Painter, STROKE, drawBush, drawPerson, drawPine, drawRock, drawTree } from './draw';
import { TH, TW, hash, iso, shade, type Pt } from './iso';

export interface SceneProps {
  state: GameState;
  selected: BuildingId | null;
  placing: BuildingId | null;
}

export interface SceneCallbacks {
  onSelect: (id: BuildingId) => void;
  onPlace: (at: Tile) => void;
  onCancelPlace: () => void;
}

interface Entity {
  sig: string;
  root: Container;
  body: Graphics;
  lights: Graphics;
  meta?: BuildingMeta;
  flag?: Graphics;
  /** Building this entity selects when clicked. */
  target?: BuildingId;
  plot?: Plot;
  /** For adventurers at the tavern: drawn with a bandage. */
  hurt?: boolean;
}

interface Walker {
  root: Container;
  body: Graphics;
  path: Pt[]; // tile coordinates
  leg: number;
  t: number; // progress along current leg, in tiles
  speed: number; // tiles per second
  delay: number;
  onDone?: () => void;
}

interface Villager extends Walker {
  wait: number;
  lane: number;
}

interface Particle {
  g: Graphics;
  life: number;
  max: number;
  vx: number;
  vy: number;
  kind: 'smoke' | 'snow' | 'leaf' | 'petal';
  phase: number;
}

export const CLASS_COLORS: Record<Adventurer['cls'], string> = {
  warrior: '#b03a2e', rogue: '#34343a', mage: '#4b4bb8', ranger: '#2e7d32', cleric: '#e6d9a0',
};
const VILLAGER_COLORS = ['#8a6d4b', '#6b7f99', '#9c5b5b', '#6f8f5a', '#b39b6b', '#7a6a8c'];

const GROUND: Record<SeasonId, { grass: string; road: string; edge: string }> = {
  spring: { grass: '#78ab4c', road: '#b89c6b', edge: '#558a3a' },
  summer: { grass: '#7a9e44', road: '#c0a46f', edge: '#5f8c41' },
  autumn: { grass: '#9a9447', road: '#b39468', edge: '#7d7a3a' },
  winter: { grass: '#e6ecf0', road: '#cfc6b8', edge: '#d3dce2' },
};

const ROAD_C = { x: ROAD_X + 0.5, y: ROAD_Y + 0.5 };

/** 0 by day, up to 0.5 at night. */
export function darkness(hour: number): number {
  if (hour >= 21 || hour < 5) return 0.5;
  if (hour >= 18) return ((hour - 18) / 3) * 0.5;
  if (hour < 8) return ((8 - hour) / 3) * 0.5;
  return 0;
}

function mix(a: number, b: number, t: number): number {
  const ch = (n: number, s: number) => (n >> s) & 255;
  const c = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

/** Deterministic trees, rocks and bushes for every non-road tile; hidden where something is built. */
const DECOR: { kind: 'tree' | 'pine' | 'rock' | 'bush'; x: number; y: number; tile: string }[] = (() => {
  const out: typeof DECOR = [];
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (isRoad(x, y)) continue;
      const r = hash(x, y, 1);
      const forest = x <= 4 && y <= 4 ? 0.7 : x === 0 || y === 0 || x === GRID - 1 ? 0.4 : 0.1;
      const rocky = x >= 11 && y <= 4;
      const px = x + 0.25 + hash(x, y, 2) * 0.5, py = y + 0.25 + hash(x, y, 3) * 0.5;
      const tile = `${x},${y}`;
      if (r < forest) out.push({ kind: hash(x, y, 4) < 0.5 ? 'pine' : 'tree', x: px, y: py, tile });
      else if (rocky && r < forest + 0.3) out.push({ kind: 'rock', x: px, y: py, tile });
      else if (r > 0.93) out.push({ kind: 'bush', x: px, y: py, tile });
    }
  }
  return out;
})();

export class VillageScene {
  private app = new Application();
  private world = new Container();
  private groundG = new Graphics();
  private overlayG = new Graphics();
  private objects = new Container({ sortableChildren: true });
  private fx = new Container();
  private weather = new Container();
  private ui = new Container();
  private ghost = new Container();
  private ghostText = new Text({ text: '', style: labelStyle(11) });
  private selLabel = new Text({ text: '', style: labelStyle(13) });
  private buildLabel = new Text({ text: '', style: labelStyle(10) });
  private buildBar = new Graphics();

  private entities = new Map<string, Entity>();
  private villagers: Villager[] = [];
  private walkers: Walker[] = [];
  private loiterers = new Map<string, Entity>();
  private walkingIn = new Set<string>();
  private knownAdventurers: Map<string, Adventurer['status']> | null = null;
  private particles: Particle[] = [];
  private fireflies: Graphics[] = [];

  private props: SceneProps | null = null;
  private season: SeasonId | null = null;
  private tint = 0xffffff;
  private lit = false;
  private ghostTile: Tile | null = null;
  private ghostSig = '';
  private hovered: Entity | null = null;
  private time = 0;
  private smokeTimer = 0;
  private destroyed = false;
  private ready = false;
  private el: HTMLElement | null = null;
  private cleanup: (() => void)[] = [];

  constructor(private cb: SceneCallbacks) {}

  setCallbacks(cb: SceneCallbacks) {
    this.cb = cb;
  }

  async init(el: HTMLElement) {
    this.el = el;
    await this.app.init({
      resizeTo: el, antialias: true, backgroundAlpha: 0, autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1), preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    el.appendChild(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.stage.eventMode = 'none';
    this.world.addChild(this.groundG, this.overlayG, this.objects, this.fx, this.weather, this.ui);
    this.ui.addChild(this.buildBar, this.buildLabel, this.selLabel, this.ghost, this.ghostText);
    this.ghost.alpha = 0.7;
    for (const t of [this.ghostText, this.selLabel, this.buildLabel]) {
      t.anchor.set(0.5, 1);
      t.resolution = 3;
    }
    this.app.stage.addChild(this.world);
    this.fit();
    this.bindInput();
    this.app.ticker.add((t) => this.animate(t.deltaMS / 1000));
    // Follow the container's size (it changes with layout, not only with the window).
    let last = { w: el.clientWidth, h: el.clientHeight };
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h || (w === last.w && h === last.h)) return;
      const wasHidden = !last.w || !last.h;
      last = { w, h };
      this.app.resize();
      if (wasHidden) this.fit();
    });
    ro.observe(el);
    this.cleanup.push(() => ro.disconnect());
    this.ready = true;
    if (this.props) this.update(this.props);
  }

  destroy() {
    this.destroyed = true;
    this.cleanup.forEach((f) => f());
    if (this.ready) this.app.destroy(true, { children: true });
  }

  // ---------------------------------------------------------------- camera

  fit() {
    const { width, height } = this.app.screen;
    const s = Math.min(width / 1080, height / 680);
    this.world.scale.set(s);
    const [cx, cy] = iso(GRID / 2, GRID / 2);
    this.world.position.set(width / 2 - cx * s, height / 2 - (cy - 30) * s);
  }

  zoomBy(f: number, at?: Pt) {
    const { width, height } = this.app.screen;
    const [mx, my] = at ?? [width / 2, height / 2];
    const s0 = this.world.scale.x;
    const s1 = Math.min(3.5, Math.max(0.4, s0 * f));
    const wx = (mx - this.world.x) / s0, wy = (my - this.world.y) / s0;
    this.world.scale.set(s1);
    this.world.position.set(mx - wx * s1, my - wy * s1);
  }

  private toWorld(mx: number, my: number): Pt {
    const s = this.world.scale.x;
    return [(mx - this.world.x) / s, (my - this.world.y) / s];
  }

  private toTile(mx: number, my: number): Pt {
    const [lx, ly] = this.toWorld(mx, my);
    const a = lx / (TW / 2), b = ly / (TH / 2);
    return [(a + b) / 2, (b - a) / 2];
  }

  private bindInput() {
    const c = this.app.canvas;
    let drag: { x: number; y: number; wx: number; wy: number; moved: boolean } | null = null;
    const local = (e: PointerEvent | WheelEvent): Pt => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e: PointerEvent) => {
      if (e.button === 2 && this.props?.placing) {
        this.cb.onCancelPlace();
        return;
      }
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, wx: this.world.x, wy: this.world.y, moved: false };
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const [mx, my] = local(e);
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
        if (drag.moved) this.world.position.set(drag.wx + dx, drag.wy + dy);
      }
      this.pointerAt(mx, my);
    };
    const up = (e: PointerEvent) => {
      const wasDrag = drag?.moved;
      drag = null;
      if (e.button !== 0 || wasDrag) return;
      const [mx, my] = local(e);
      const placing = this.props?.placing;
      if (placing) {
        this.pointerAt(mx, my);
        if (this.ghostTile && this.props && !placementBlocker(this.props.state, placing, this.ghostTile)) {
          this.cb.onPlace(this.ghostTile);
        }
        return;
      }
      const hit = this.hitTest(mx, my);
      if (hit?.target) this.cb.onSelect(hit.target);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, local(e));
    };
    const leave = () => {
      this.hovered = null;
      this.ghostTile = null;
      this.drawOverlay();
    };
    const menu = (e: Event) => e.preventDefault();
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointerleave', leave);
    c.addEventListener('wheel', wheel, { passive: false });
    c.addEventListener('contextmenu', menu);
    this.cleanup.push(() => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointerleave', leave);
      c.removeEventListener('wheel', wheel);
      c.removeEventListener('contextmenu', menu);
    });
  }

  private pointerAt(mx: number, my: number) {
    const placing = this.props?.placing;
    if (placing) {
      const [tx, ty] = this.toTile(mx, my);
      const { w, d } = FOOTPRINTS[placing];
      const tile = { x: Math.floor(tx - w / 2 + 0.5), y: Math.floor(ty - d / 2 + 0.5) };
      if (tile.x !== this.ghostTile?.x || tile.y !== this.ghostTile?.y) {
        this.ghostTile = tile;
        this.drawOverlay();
      }
      this.el!.style.cursor = 'crosshair';
      return;
    }
    const hit = this.hitTest(mx, my);
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.drawOverlay();
    }
    this.el!.style.cursor = hit ? 'pointer' : 'grab';
  }

  /** Topmost clickable entity under the pointer. */
  private hitTest(mx: number, my: number): Entity | null {
    const candidates = [...this.entities.values(), ...this.loiterers.values()]
      .filter((e) => e.target && e.root.visible)
      .sort((a, b) => b.root.zIndex - a.root.zIndex);
    const [wx, wy] = this.toWorld(mx, my);
    for (const e of candidates) {
      const p = { x: wx - e.root.x, y: wy - e.root.y };
      if (e.body.containsPoint(p)) return e;
    }
    return null;
  }

  // ---------------------------------------------------------------- state sync

  update(props: SceneProps) {
    const placingChanged = props.placing !== this.props?.placing;
    this.props = props;
    if (!this.ready) return;
    const { state } = props;
    const se = season(state).id;
    if (se !== this.season) {
      this.season = se;
      this.drawGround();
      this.resetWeather();
    }
    this.syncBuildings(state);
    this.syncDecorations(state);
    this.syncAdventurers(state);
    this.syncVillagers(Math.min(state.population, 16));
    this.syncLighting(state);
    if (placingChanged) {
      this.ghostTile = null;
      this.ghostSig = '';
      if (!props.placing) this.el!.style.cursor = 'grab';
    }
    this.drawOverlay();
  }

  private makeEntity(key: string, sig: string, at: Pt, z: number, draw: (P: Painter) => BuildingMeta | void, target?: BuildingId, plot?: Plot): Entity {
    const old = this.entities.get(key);
    if (old && old.sig === sig) {
      old.root.position.set(at[0], at[1]);
      old.root.zIndex = z;
      old.plot = plot;
      return old;
    }
    if (old) old.root.destroy({ children: true });
    const root = new Container();
    const body = new Graphics();
    const lights = new Graphics();
    root.addChild(body, lights);
    const meta = draw(new Painter(body, lights, this.season ?? 'spring')) ?? undefined;
    const e: Entity = { sig, root, body, lights, meta, target, plot };
    if (meta?.flag) {
      const f = new Graphics();
      const [fx, fy] = meta.flag;
      body.moveTo(fx, fy).lineTo(fx, fy - 16).stroke({ width: 1.2, color: '#3b2b1b' });
      f.poly([0, 0, 12, 3, 0, 7]).fill('#d9a441');
      f.position.set(fx, fy - 16);
      root.addChild(f);
      e.flag = f;
    }
    root.position.set(at[0], at[1]);
    root.zIndex = z;
    body.tint = this.tint;
    if (e.flag) e.flag.tint = this.tint;
    lights.visible = this.lit;
    this.objects.addChild(root);
    this.entities.set(key, e);
    return e;
  }

  private syncBuildings(state: GameState) {
    const keep = new Set<string>();
    const c = state.construction;
    for (const pp of placedPlots(state)) {
      const { id, plot } = pp;
      const level = state.buildings[id];
      const key = pp.underConstruction ? 'site' : id === 'house' ? `house${pp.index}` : id;
      const upgrading = !!c && !c.at && c.building === id && id !== 'house';
      const sig = `${this.season}|${id}|${level}|${pp.underConstruction ? 'site' : ''}|${upgrading ? 'up' : ''}|${plot.x},${plot.y}`;
      keep.add(key);
      this.makeEntity(key, sig, iso(plot.x, plot.y), plot.x + plot.w + plot.y + plot.d, (P) => {
        if (pp.underConstruction) {
          drawScaffold(P, plot.w, plot.d, id === 'house' ? 20 : 26);
          return { smoke: [], top: 40 };
        }
        const meta = drawBuilding(P, id, plot.w, plot.d, level, pp.index ?? 0);
        if (upgrading) drawScaffold(P, plot.w, plot.d, Math.min(60, meta.top - 6));
        return meta;
      }, id, plot);
    }
    for (const [key, e] of this.entities) {
      if (!key.startsWith('d:') && !keep.has(key)) {
        e.root.destroy({ children: true });
        this.entities.delete(key);
      }
    }
  }

  private syncDecorations(state: GameState) {
    const taken = occupiedTiles(state);
    for (const d of DECOR) {
      const key = `d:${d.tile}`;
      if (taken.has(d.tile)) {
        const e = this.entities.get(key);
        if (e) {
          e.root.destroy({ children: true });
          this.entities.delete(key);
        }
        continue;
      }
      this.makeEntity(key, `${this.season}`, iso(d.x, d.y), d.x + d.y + 0.2, (P) => {
        const s = 0.9 + hash(d.x * 10, d.y * 10, 5) * 0.3;
        if (d.kind === 'tree') drawTree(P.g, P.season, s);
        else if (d.kind === 'pine') drawPine(P.g, P.season, s);
        else if (d.kind === 'rock') drawRock(P.g, P.season, s);
        else drawBush(P.g, P.season);
      });
    }
  }

  // ---------------------------------------------------------------- people

  private person(color: string, opt: { hat?: string; hurt?: boolean } = {}): { root: Container; body: Graphics } {
    const root = new Container();
    const body = new Graphics();
    drawPerson(body, color, opt);
    body.tint = this.tint;
    root.addChild(body);
    this.objects.addChild(root);
    return { root, body };
  }

  private tavernDoor(state: GameState): Pt | null {
    const at = state.placements.tavern;
    if (!at || state.buildings.tavern < 1) return null;
    const p = plotAt('tavern', at);
    return [p.x + p.w / 2, p.y + p.d + 0.3];
  }

  /** From a door to the nearest road, then along it off the edge of the island. */
  private pathToEdge(door: Pt): Pt[] {
    const [x, y] = door;
    if (Math.abs(y - ROAD_C.y) <= Math.abs(x - ROAD_C.x)) {
      return [door, [x, ROAD_C.y], [x < ROAD_C.x ? -1.2 : GRID + 1.2, ROAD_C.y]];
    }
    return [door, [ROAD_C.x, y], [ROAD_C.x, y < ROAD_C.y ? -1.2 : GRID + 1.2]];
  }

  private walk(a: Adventurer, path: Pt[], delay: number, onDone?: () => void) {
    const { root, body } = this.person(CLASS_COLORS[a.cls], { hat: a.cls === 'mage' ? '#2c2c80' : undefined });
    root.visible = false;
    this.walkers.push({ root, body, path, leg: 0, t: 0, speed: 1.5, delay, onDone });
  }

  private syncAdventurers(state: GameState) {
    const door = this.tavernDoor(state);
    const now = new Map(state.adventurers.map((a) => [a.id, a.status]));
    const prev = this.knownAdventurers;
    if (prev && door) {
      const out = this.pathToEdge(door);
      const back = [...out].reverse();
      let departing = 0, returning = 0;
      for (const a of state.adventurers) {
        const before = prev.get(a.id);
        if (before === undefined && a.status === 'idle') {
          this.walkingIn.add(a.id);
          this.walk(a, back, 0, () => this.walkingIn.delete(a.id));
        } else if (before !== 'questing' && before !== undefined && a.status === 'questing') {
          this.walk(a, out, departing++ * 0.45);
        } else if (before === 'questing' && a.status !== 'questing') {
          this.walkingIn.add(a.id);
          this.walk(a, back, returning++ * 0.45, () => this.walkingIn.delete(a.id));
        }
      }
      for (const [id, status] of prev) {
        if (!now.has(id) && status === 'idle') {
          const gone = this.loiterers.get(id);
          const cls = (gone?.sig as Adventurer['cls']) ?? 'warrior';
          this.walk({ id, cls } as Adventurer, out, 0);
        }
      }
    }
    this.knownAdventurers = now;

    // Adventurers waiting at the tavern.
    const waiting = door ? state.adventurers.filter((a) => a.status !== 'questing' && !this.walkingIn.has(a.id)) : [];
    const ids = new Set(waiting.map((a) => a.id));
    for (const [id, e] of this.loiterers) {
      if (!ids.has(id)) {
        e.root.destroy({ children: true });
        this.loiterers.delete(id);
      }
    }
    waiting.slice(0, 8).forEach((a, i) => {
      const x = door![0] - 0.75 + (i % 4) * 0.45, y = door![1] - 0.05 + Math.floor(i / 4) * 0.45;
      const hurt = a.status === 'injured';
      let e = this.loiterers.get(a.id);
      if (e && e.hurt !== hurt) {
        e.root.destroy({ children: true });
        this.loiterers.delete(a.id);
        e = undefined;
      }
      if (!e) {
        const { root, body } = this.person(CLASS_COLORS[a.cls], { hat: a.cls === 'mage' ? '#2c2c80' : undefined, hurt });
        // sig keeps the class so a departing adventurer can be drawn after it has left the state
        e = { sig: a.cls, root, body, lights: new Graphics(), target: 'tavern', hurt };
        this.loiterers.set(a.id, e);
      }
      const [sx, sy] = iso(x, y);
      e.root.position.set(sx, sy);
      e.root.zIndex = x + y;
    });
  }

  private syncVillagers(count: number) {
    while (this.villagers.length > count) this.villagers.pop()!.root.destroy({ children: true });
    while (this.villagers.length < count) {
      const i = this.villagers.length;
      const { root, body } = this.person(VILLAGER_COLORS[i % VILLAGER_COLORS.length]);
      const lane = (hash(i, 9) - 0.5) * 0.5;
      const along = 0.5 + hash(i, 7) * (GRID - 1);
      const start: Pt = i % 2 ? [along, ROAD_C.y + lane] : [ROAD_C.x + lane, along];
      const v: Villager = { root, body, path: [start], leg: 0, t: 0, speed: 0.5 + hash(i, 8) * 0.5, delay: 0, wait: hash(i, 10) * 3, lane };
      this.villagers.push(v);
      this.placeWalker(v, start);
    }
  }

  private newVillagerPath(v: Villager) {
    const here = v.path[v.path.length - 1];
    const onX = Math.abs(here[0] - ROAD_C.x) < 0.4; // on the north-south road
    const r = Math.random();
    const along = 0.4 + Math.random() * (GRID - 0.8);
    const target: Pt = r < 0.5 ? [ROAD_C.x + v.lane, along] : [along, ROAD_C.y + v.lane];
    const targetOnX = r < 0.5;
    const cross: Pt = [ROAD_C.x + v.lane, ROAD_C.y + v.lane];
    v.path = onX === targetOnX ? [here, target] : [here, cross, target];
    v.leg = 0;
    v.t = 0;
  }

  private placeWalker(w: Walker, [x, y]: Pt) {
    const [sx, sy] = iso(x, y);
    w.root.position.set(sx, sy);
    w.root.zIndex = x + y + 0.05;
    const outside = Math.max(-x, -y, x - GRID, y - GRID, 0);
    w.root.alpha = Math.max(0, 1 - outside * 1.2);
  }

  /** Advance along the path. Returns true when the path is finished. */
  private step(w: Walker, dt: number): boolean {
    if (w.delay > 0) {
      w.delay -= dt;
      return false;
    }
    w.root.visible = true;
    let move = w.speed * dt;
    while (move > 0 && w.leg < w.path.length - 1) {
      const a = w.path[w.leg], b = w.path[w.leg + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (w.t + move >= len) {
        move -= len - w.t;
        w.leg++;
        w.t = 0;
      } else {
        w.t += move;
        move = 0;
      }
    }
    if (w.leg >= w.path.length - 1) {
      this.placeWalker(w, w.path[w.path.length - 1]);
      return true;
    }
    const a = w.path[w.leg], b = w.path[w.leg + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const f = w.t / len;
    this.placeWalker(w, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    w.body.y = -Math.abs(Math.sin(this.time * 9 + w.speed * 10)) * 1.2; // a little bob
    return false;
  }

  // ---------------------------------------------------------------- lighting, ground, overlay

  private syncLighting(state: GameState) {
    const dark = darkness(hourOfDay(state));
    const tint = mix(0xffffff, 0x404a7a, dark / 0.5);
    const lit = dark > 0.15;
    if (tint === this.tint && lit === this.lit) return;
    this.tint = tint;
    this.lit = lit;
    this.groundG.tint = tint;
    for (const e of [...this.entities.values(), ...this.loiterers.values()]) {
      e.body.tint = tint;
      if (e.flag) e.flag.tint = tint;
      e.lights.visible = lit;
    }
    for (const w of [...this.walkers, ...this.villagers]) w.body.tint = tint;
    for (const p of this.particles) if (p.kind === 'smoke') p.g.tint = tint;
    this.weather.tint = mix(0xffffff, 0x8090c0, dark / 0.5);
    for (const f of this.fireflies) f.visible = lit && this.season !== 'winter';
  }

  private drawGround() {
    const g = this.groundG;
    g.clear();
    const col = GROUND[this.season ?? 'spring'];
    const depth = 22;
    const P = (x: number, y: number, z = 0) => iso(x, y, z);
    const poly = (ps: Pt[], color: string, alpha = 1) => g.poly(ps.flatMap((p) => p)).fill({ color, alpha });
    g.ellipse(0, GRID * 16 + 40, GRID * 40, GRID * 20).fill({ color: '#000000', alpha: 0.25 });
    poly([P(0, GRID), P(GRID, GRID), P(GRID, GRID, -depth), P(0, GRID, -depth)], '#5c4330');
    poly([P(GRID, 0), P(GRID, GRID), P(GRID, GRID, -depth), P(GRID, 0, -depth)], '#7a5a3f');
    poly([P(0, GRID), P(GRID, GRID), P(GRID, GRID, -6), P(0, GRID, -6)], shade(col.edge, -0.1));
    poly([P(GRID, 0), P(GRID, GRID), P(GRID, GRID, -6), P(GRID, 0, -6)], col.edge);
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        const road = isRoad(x, y);
        const base = road ? col.road : col.grass;
        poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], shade(base, (hash(x, y, 9) - 0.5) * (road ? 0.08 : 0.12)));
      }
    }
    // the village well at the crossroads
    const [cx, cy] = iso(ROAD_C.x, ROAD_C.y);
    g.ellipse(cx, cy, 11, 5.5).fill('#8b8a85').stroke(STROKE);
    g.ellipse(cx, cy - 1, 7, 3.5).fill(this.season === 'winter' ? '#b8d0e0' : '#2b4a63');
    g.moveTo(cx - 9, cy).lineTo(cx - 9, cy - 16).stroke({ width: 1.6, color: '#5b3d22' });
    g.moveTo(cx + 9, cy).lineTo(cx + 9, cy - 16).stroke({ width: 1.6, color: '#5b3d22' });
    g.poly([cx - 12, cy - 15, cx + 12, cy - 15, cx, cy - 23]).fill(this.season === 'winter' ? '#eef2f6' : '#8c3b2e');
  }

  private drawOverlay() {
    const g = this.overlayG;
    g.clear();
    const props = this.props;
    if (!props) return;
    const { state, selected, placing } = props;
    const diamond = (p: Plot) => [iso(p.x, p.y), iso(p.x + p.w, p.y), iso(p.x + p.w, p.y + p.d), iso(p.x, p.y + p.d)].flatMap((q) => q);

    // selection and hover outlines
    const plots = placedPlots(state);
    if (selected && !placing) {
      for (const pp of plots.filter((q) => q.id === selected && !q.underConstruction)) {
        g.poly(diamond(pp.plot)).fill({ color: '#d9a441', alpha: 0.18 }).stroke({ width: 1.6, color: '#ffd36b' });
      }
    }
    if (this.hovered?.plot && !placing) {
      g.poly(diamond(this.hovered.plot)).fill({ color: '#ffffff', alpha: 0.1 }).stroke({ width: 1, color: '#ffffff', alpha: 0.6 });
    }

    // placement ghost
    this.ghostText.visible = false;
    this.ghost.visible = false;
    if (placing && this.ghostTile) {
      const plot = plotAt(placing, this.ghostTile);
      const blocker = placementBlocker(state, placing, this.ghostTile);
      g.poly(diamond(plot)).fill({ color: blocker ? '#e0705a' : '#8fc46a', alpha: 0.35 }).stroke({ width: 1.6, color: blocker ? '#ff8a70' : '#b8f090' });
      const sig = `${placing}|${this.season}`;
      if (sig !== this.ghostSig) {
        this.ghost.removeChildren().forEach((c) => c.destroy());
        const body = new Graphics();
        const index = placing === 'house' ? state.houses.length : 0;
        drawBuilding(new Painter(body, new Graphics(), this.season ?? 'spring'), placing, plot.w, plot.d, 1, index);
        this.ghost.addChild(body);
        this.ghostSig = sig;
      }
      const [gx, gy] = iso(plot.x, plot.y);
      this.ghost.position.set(gx, gy);
      this.ghost.visible = true;
      if (blocker) {
        const [tx, ty] = iso(plot.x + plot.w / 2, plot.y + plot.d / 2, 46);
        this.ghostText.text = blocker;
        this.ghostText.position.set(tx, ty);
        this.ghostText.visible = true;
      }
    }

    // label for the selected building
    this.selLabel.visible = false;
    if (selected && !placing) {
      const pp = plots.find((q) => q.id === selected && !q.underConstruction);
      const e = pp && this.entities.get(selected === 'house' ? 'house0' : selected);
      if (pp && e) {
        const [lx, ly] = iso(pp.plot.x + pp.plot.w / 2, pp.plot.y + pp.plot.d / 2, (e.meta?.top ?? 40) + 4);
        this.selLabel.text = `${BUILDINGS[selected].name} · ${state.buildings[selected]}`;
        this.selLabel.position.set(lx, ly);
        this.selLabel.visible = true;
      }
    }

    // construction progress
    const c = state.construction;
    this.buildBar.clear();
    this.buildLabel.visible = false;
    if (c) {
      const pp = c.at ? plotAt(c.building, c.at) : plots.find((q) => q.id === c.building && !q.underConstruction)?.plot;
      if (pp) {
        const progress = Math.max(0, Math.min(1, 1 - (c.endsTick - state.tick) / buildHours(c.building, c.targetLevel)));
        const [bx, by] = iso(pp.x + pp.w / 2, pp.y + pp.d / 2, c.building === 'house' ? 40 : 66);
        this.buildBar.roundRect(bx - 26, by - 5, 52, 8, 4).fill({ color: '#140e08', alpha: 0.85 });
        this.buildBar.roundRect(bx - 24, by - 3, 48 * progress, 4, 2).fill('#d9a441');
        this.buildLabel.text = `${BUILDINGS[c.building].name} ${c.targetLevel}`;
        this.buildLabel.position.set(bx, by - 7);
        this.buildLabel.visible = true;
      }
    }
  }

  // ---------------------------------------------------------------- particles

  private resetWeather() {
    this.weather.removeChildren().forEach((c) => c.destroy());
    this.particles = this.particles.filter((p) => p.kind === 'smoke');
    const kind = ({ winter: 'snow', autumn: 'leaf', spring: 'petal', summer: null } as const)[this.season ?? 'spring'];
    if (kind) {
      const n = kind === 'snow' ? 140 : 36;
      for (let i = 0; i < n; i++) {
        const g = new Graphics();
        if (kind === 'snow') g.circle(0, 0, 1.2 + Math.random() * 1.2).fill({ color: '#ffffff', alpha: 0.9 });
        else g.ellipse(0, 0, 2.6, 1.3).fill(kind === 'leaf' ? ['#d9822b', '#b9541f', '#e6a83a'][i % 3] : '#f4b6c8');
        g.position.set(-560 + Math.random() * 1120, -240 + Math.random() * 820);
        this.weather.addChild(g);
        this.particles.push({ g, life: 0, max: Infinity, vx: (Math.random() - 0.5) * 8, vy: kind === 'snow' ? 18 + Math.random() * 16 : 10 + Math.random() * 8, kind, phase: Math.random() * 6 });
      }
    }
    if (this.fireflies.length === 0) {
      for (let i = 0; i < 16; i++) {
        const f = new Graphics();
        f.circle(0, 0, 5).fill({ color: LIGHT, alpha: 0.15 });
        f.circle(0, 0, 1.4).fill('#fff3a0');
        const [x, y] = iso(1 + hash(i, 21) * 14, 1 + hash(i, 22) * 14, 6 + hash(i, 23) * 14);
        f.position.set(x, y);
        f.visible = false;
        this.fx.addChild(f);
        this.fireflies.push(f);
      }
    }
  }

  private emitSmoke() {
    for (const e of this.entities.values()) {
      for (const [sx, sy] of e.meta?.smoke ?? []) {
        const g = new Graphics();
        g.circle(0, 0, 4).fill('#c9c4bd');
        g.position.set(e.root.x + sx, e.root.y + sy);
        g.tint = this.tint;
        this.fx.addChild(g);
        this.particles.push({ g, life: 0, max: 3.3, vx: 3 + Math.random() * 2, vy: -11 - Math.random() * 3, kind: 'smoke', phase: 0 });
      }
    }
  }

  // ---------------------------------------------------------------- frame

  private animate(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;

    for (const v of this.villagers) {
      if (v.wait > 0) {
        v.wait -= dt;
        continue;
      }
      if (this.step(v, dt)) {
        v.wait = 0.5 + Math.random() * 3;
        this.newVillagerPath(v);
      }
    }
    this.walkers = this.walkers.filter((w) => {
      if (!this.step(w, dt)) return true;
      w.root.destroy({ children: true });
      w.onDone?.();
      if (w.onDone && this.props) this.syncAdventurers(this.props.state);
      return false;
    });

    this.smokeTimer += dt;
    if (this.smokeTimer > 0.9) {
      this.smokeTimer = 0;
      this.emitSmoke();
    }
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.kind === 'smoke') {
        if (p.life >= p.max) {
          p.g.destroy();
          return false;
        }
        const f = p.life / p.max;
        p.g.x += p.vx * dt;
        p.g.y += p.vy * dt;
        p.g.scale.set(0.5 + f * 1.3);
        p.g.alpha = 0.7 * (1 - f);
        return true;
      }
      p.g.x += (p.vx + Math.sin(this.time * 1.5 + p.phase) * 10) * dt;
      p.g.y += p.vy * dt;
      if (p.kind !== 'snow') p.g.rotation += dt * 2;
      if (p.g.y > 600) {
        p.g.y = -240;
        p.g.x = -560 + Math.random() * 1120;
      }
      return true;
    });

    for (const e of this.entities.values()) {
      if (e.flag) {
        e.flag.skew.y = Math.sin(this.time * 4) * 0.12;
        e.flag.scale.x = 0.92 + Math.sin(this.time * 4 + 1) * 0.08;
      }
    }
    this.fireflies.forEach((f, i) => {
      f.alpha = 0.3 + 0.7 * Math.abs(Math.sin(this.time * 1.3 + i));
      f.y += Math.sin(this.time + i) * 0.08;
    });
  }
}

function labelStyle(size: number) {
  return {
    fontFamily: 'Georgia, serif', fontSize: size, fontWeight: '600' as const, fill: '#fff6e0',
    stroke: { color: '#140c04', width: 3 }, align: 'center' as const,
  };
}
