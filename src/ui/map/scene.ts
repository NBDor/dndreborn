// The village scene, rendered with PixiJS. Owned by <VillageMap>, which feeds it game state.
// React never touches the canvas: `update()` diffs the state against what is on screen and rebuilds
// only what changed; a ticker animates people, goats, smoke and weather in between.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { NEIGHBORS, STRUCTURES } from '../../game/data';
import { GRID, hasTree, isBank, isRiver, noise, plotAt, riverX, tileKey, type Plot } from '../../game/map';
import {
  age, fieldStage, isUnwell, occupied, placementBlocker, plotOf, season, treesOn,
} from '../../game/rules';
import type { GameState, JobId, Person, SeasonId, StructureType, Tile } from '../../game/types';
import { drawGoat, drawScaffold, drawStructure, type BuildingMeta } from './buildings';
import { Painter, drawBush, drawPerson, drawPine, drawRock, drawTree } from './draw';
import { TH, TW, iso, shade, type Pt } from './iso';

export interface SceneProps {
  state: GameState;
  selected: string | null;
  placing: StructureType | null;
}

export interface SceneCallbacks {
  onSelect: (id: string) => void;
  onPlace: (at: Tile) => void;
  onCancelPlace: () => void;
}

interface Entity {
  sig: string;
  root: Container;
  body: Graphics;
  meta?: BuildingMeta;
  /** Structure id this entity selects when clicked. */
  target?: string;
  plot?: Plot;
}

interface Mover {
  root: Container;
  body: Graphics;
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  wait: number;
}

interface Traveller {
  root: Container;
  body: Graphics;
  path: Pt[];
  leg: number;
  t: number;
  delay: number;
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

const CLOTHES = ['#8a6d4b', '#6b5a3e', '#9c7b55', '#7a6a50', '#a08560', '#5f5240'];
const GOAT_COLORS = ['#e8e0d0', '#d8c8a8', '#a08060', '#f2ede4', '#6b5440'];

const GROUND: Record<SeasonId, { grass: string; edge: string; water: string; bank: string }> = {
  spring: { grass: '#78ab4c', edge: '#558a3a', water: '#3f7fa8', bank: '#9a9a5a' },
  summer: { grass: '#7a9e44', edge: '#5f8c41', water: '#3a78a0', bank: '#a8a060' },
  autumn: { grass: '#9a9447', edge: '#7d7a3a', water: '#3a6f90', bank: '#9a8a52' },
  winter: { grass: '#e6ecf0', edge: '#d3dce2', water: '#a9c7d8', bank: '#d8dde0' },
};

function labelStyle(size: number) {
  return {
    fontFamily: 'Georgia, serif', fontSize: size, fontWeight: '600' as const, fill: '#fff6e0',
    stroke: { color: '#140c04', width: 3 }, align: 'center' as const,
  };
}

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
  private bars = new Graphics();

  private entities = new Map<string, Entity>();
  private people = new Map<string, Mover>();
  private goats: Mover[] = [];
  private travellers: Traveller[] = [];
  private knownTrips = new Set<string>();
  private tripsReady = false;
  private particles: Particle[] = [];

  private props: SceneProps | null = null;
  private season: SeasonId | null = null;
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
    this.ui.addChild(this.bars, this.selLabel, this.ghost, this.ghostText);
    this.ghost.alpha = 0.7;
    for (const t of [this.ghostText, this.selLabel]) {
      t.anchor.set(0.5, 1);
      t.resolution = 3;
    }
    this.app.stage.addChild(this.world);
    this.fit();
    this.bindInput();
    this.app.ticker.add((t) => this.animate(t.deltaMS / 1000));
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

  // ---------------------------------------------------------------- camera and input

  fit() {
    const { width, height } = this.app.screen;
    const s = Math.min(width / 1000, height / 640);
    this.world.scale.set(s);
    const [cx, cy] = iso(GRID / 2, GRID / 2);
    this.world.position.set(width / 2 - cx * s, height / 2 - (cy - 30) * s);
  }

  zoomBy(f: number, at?: Pt) {
    const { width, height } = this.app.screen;
    const [mx, my] = at ?? [width / 2, height / 2];
    const s0 = this.world.scale.x;
    const s1 = Math.min(3.5, Math.max(0.35, s0 * f));
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
        if (this.ghostTile && this.props && !placementBlocker(this.props.state, placing, this.ghostTile)) this.cb.onPlace(this.ghostTile);
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
      const { w, d } = STRUCTURES[placing];
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

  private hitTest(mx: number, my: number): Entity | null {
    const [wx, wy] = this.toWorld(mx, my);
    const candidates = [...this.entities.values()].filter((e) => e.target).sort((a, b) => b.root.zIndex - a.root.zIndex);
    for (const e of candidates) {
      if (e.body.containsPoint({ x: wx - e.root.x, y: wy - e.root.y })) return e;
    }
    // Flat things like fields: fall back to the footprint under the pointer.
    const [tx, ty] = this.toTile(mx, my);
    return candidates.find((e) => e.plot && tx >= e.plot.x && tx < e.plot.x + e.plot.w && ty >= e.plot.y && ty < e.plot.y + e.plot.d) ?? null;
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
    this.syncStructures(state);
    this.syncTrees(state);
    this.syncPeople(state);
    this.syncGoats(state);
    this.syncTrips(state);
    if (placingChanged) {
      this.ghostTile = null;
      this.ghostSig = '';
      if (!props.placing) this.el!.style.cursor = 'grab';
    }
    this.drawOverlay();
  }

  private makeEntity(key: string, sig: string, at: Pt, z: number, draw: (P: Painter) => BuildingMeta | void, target?: string, plot?: Plot): Entity {
    const old = this.entities.get(key);
    if (old && old.sig === sig) {
      old.root.position.set(at[0], at[1]);
      old.root.zIndex = z;
      return old;
    }
    if (old) old.root.destroy({ children: true });
    const root = new Container();
    const body = new Graphics();
    const lights = new Graphics();
    root.addChild(body, lights);
    const meta = draw(new Painter(body, lights, this.season ?? 'spring')) ?? undefined;
    root.position.set(at[0], at[1]);
    root.zIndex = z;
    this.objects.addChild(root);
    const e: Entity = { sig, root, body, meta, target, plot };
    this.entities.set(key, e);
    return e;
  }

  private syncStructures(state: GameState) {
    const keep = new Set<string>();
    const potting = state.people.some((p) => p.job === 'potter' && !p.away);
    for (const x of state.structures) {
      const plot = plotOf(x);
      const def = STRUCTURES[x.type];
      let opts = {};
      let extra = '';
      if (x.type === 'field' && x.field) {
        const stage = fieldStage(x.field, state.day);
        const growth = x.field.sownOn === null ? 0 : Math.min(1, (state.day - x.field.sownOn) / 120);
        const stubble = x.field.harvestedOn !== undefined && state.day - x.field.harvestedOn < 150;
        opts = { stage, growth, stubble };
        extra = `${stage}|${Math.round(growth * 8)}|${stubble}`;
      }
      if (x.type === 'kiln') {
        opts = { firing: potting };
        extra = String(potting);
      }
      const progress = x.built ? 1 : x.work / x.workNeeded;
      const sig = `${this.season}|${x.type}|${x.built}|${x.built ? '' : Math.round(progress * 6)}|${extra}`;
      keep.add(x.id);
      this.makeEntity(x.id, sig, iso(plot.x, plot.y), plot.x + plot.w + plot.y + plot.d, (P) => {
        if (!x.built) {
          if (x.type === 'field') {
            P.ground(0.08, 0.08, plot.w - 0.16, plot.d - 0.16, '#8f7a55', 0.3 + progress * 0.6, true);
            return { smoke: [], top: 24 };
          }
          drawScaffold(P, plot.w, plot.d, def.housing ? 26 : 16, progress);
          return { smoke: [], top: 40 };
        }
        return drawStructure(P, x.type, plot.w, plot.d, opts);
      }, x.id, plot);
    }
    for (const [key, e] of this.entities) {
      if (!key.startsWith('t:') && !keep.has(key)) {
        e.root.destroy({ children: true });
        this.entities.delete(key);
      }
    }
  }

  private syncTrees(state: GameState) {
    const taken = occupied(state);
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        const key = `t:${x},${y}`;
        const tile = tileKey({ x, y });
        const decor = this.decorAt(x, y);
        const show = decor && !taken.has(tile) && (decor !== 'tree' && decor !== 'pine' || !state.cleared.includes(tile));
        if (!show) {
          const e = this.entities.get(key);
          if (e) {
            e.root.destroy({ children: true });
            this.entities.delete(key);
          }
          continue;
        }
        const px = x + 0.25 + noise(x, y, 2) * 0.5, py = y + 0.25 + noise(x, y, 3) * 0.5;
        this.makeEntity(key, `${this.season}`, iso(px, py), px + py + 0.2, (P) => {
          const s = 0.9 + noise(x, y, 5) * 0.35;
          if (decor === 'tree') drawTree(P.g, P.season, s);
          else if (decor === 'pine') drawPine(P.g, P.season, s);
          else if (decor === 'rock') drawRock(P.g, P.season, s);
          else drawBush(P.g, P.season);
        });
      }
    }
  }

  private decorAt(x: number, y: number): 'tree' | 'pine' | 'rock' | 'bush' | null {
    if (isRiver(x, y)) return null;
    if (hasTree(x, y)) return noise(x, y, 4) < 0.45 ? 'pine' : 'tree';
    const r = noise(x, y, 6);
    if (r > 0.94) return 'bush';
    if (r < 0.03) return 'rock';
    return null;
  }

  // ---------------------------------------------------------------- people and animals

  /** Where a person's day takes them, as a tile area. */
  private workArea(state: GameState, p: Person): Plot {
    const built = (t: StructureType) => state.structures.filter((x) => x.type === t && x.built);
    const pick = <T,>(list: T[], salt: number): T | undefined => list[Math.floor(noise(salt, p.id.length + Number(p.id.slice(1)), 9) * list.length)];
    const hall = state.structures.find((x) => x.type === 'hall')!;
    const homeArea = (): Plot => {
      const homes = state.structures.filter((x) => x.built && STRUCTURES[x.type].housing);
      const h = pick(homes, 1) ?? hall;
      const pl = plotOf(h);
      return { x: pl.x - 0.2, y: pl.y + pl.d, w: pl.w + 0.4, d: 0.8 };
    };
    if (isUnwell(p, state.day) || age(p, state.day) < 7) return homeArea();
    const job: JobId = p.job;
    const area = (x: { at: Tile; type: StructureType } | undefined, pad = 0.2): Plot | null => {
      if (!x) return null;
      const pl = plotAt(x.type, x.at);
      return { x: pl.x - pad, y: pl.y - pad, w: pl.w + pad * 2, d: pl.d + pad * 2 };
    };
    switch (job) {
      case 'farmer': return area(pick(built('field'), Math.floor(this.time / 20)), -0.1) ?? homeArea();
      case 'herder': return area(built('pen')[0], 0.8) ?? homeArea();
      case 'builder': return area(state.structures.find((x) => !x.built), 0.3) ?? homeArea();
      case 'hideworker': return area(built('smokerack')[0], 0.5) ?? homeArea();
      case 'potter': return area(built('kiln')[0], 0.5) ?? { x: riverX(9) - 1, y: 8, w: 1, d: 3 };
      case 'gatherer': {
        const y = 2 + Math.floor(noise(Number(p.id.slice(1)), 3, 1) * (GRID - 4));
        return { x: riverX(y) - 1, y, w: 1, d: 1.5 };
      }
      case 'woodcutter': {
        const y = 3 + Math.floor(noise(Number(p.id.slice(1)), 4, 1) * (GRID - 6));
        return { x: 1, y, w: 2.5, d: 1.5 };
      }
      default: {
        const pl = plotOf(hall);
        return { x: pl.x - 0.6, y: pl.y + pl.d, w: pl.w + 1.2, d: 1 };
      }
    }
  }

  private makeMover(draw: (g: Graphics) => void, x: number, y: number, speed: number): Mover {
    const root = new Container();
    const body = new Graphics();
    draw(body);
    root.addChild(body);
    this.objects.addChild(root);
    const m: Mover = { root, body, x, y, tx: x, ty: y, speed, wait: Math.random() * 2 };
    this.placeAt(m.root, x, y);
    return m;
  }

  private placeAt(root: Container, x: number, y: number) {
    const [sx, sy] = iso(x, y);
    root.position.set(sx, sy);
    root.zIndex = x + y + 0.05;
  }

  private syncPeople(state: GameState) {
    const shown = state.people.filter((p) => !p.away).slice(0, 48);
    const ids = new Set(shown.map((p) => p.id));
    for (const [id, m] of this.people) {
      if (!ids.has(id)) {
        m.root.destroy({ children: true });
        this.people.delete(id);
      }
    }
    for (const p of shown) {
      let m = this.people.get(p.id);
      const area = this.workArea(state, p);
      if (!m) {
        const child = age(p, state.day) < 12;
        m = this.makeMover((g) => {
          drawPerson(g, CLOTHES[Number(p.id.slice(1)) % CLOTHES.length], { hurt: isUnwell(p, state.day) });
          if (child) g.scale.set(0.7);
        }, area.x + area.w / 2, area.y + area.d / 2, child ? 1.1 : 0.8);
        this.people.set(p.id, m);
      }
      (m as Mover & { area?: Plot }).area = area;
    }
  }

  private syncGoats(state: GameState) {
    const pen = state.structures.find((x) => x.type === 'pen' && x.built);
    const want = pen ? Math.min(state.goats, 24) : 0;
    while (this.goats.length > want) this.goats.pop()!.root.destroy({ children: true });
    if (!pen) return;
    const pl = plotOf(pen);
    while (this.goats.length < want) {
      const i = this.goats.length;
      const m = this.makeMover((g) => drawGoat(g, GOAT_COLORS[i % GOAT_COLORS.length]), pl.x + 0.3 + Math.random() * (pl.w - 0.6), pl.y + 0.3 + Math.random() * (pl.d - 0.6), 0.4);
      (m as Mover & { area?: Plot }).area = { x: pl.x + 0.25, y: pl.y + 0.25, w: pl.w - 0.5, d: pl.d - 0.5 };
      this.goats.push(m);
    }
  }

  /** Journeys: walk out to the map edge when they leave, and back in when they return. */
  private syncTrips(state: GameState) {
    const hall = plotOf(state.structures.find((x) => x.type === 'hall')!);
    const door: Pt = [hall.x + hall.w / 2, hall.y + hall.d + 0.4];
    const ids = new Set(state.expeditions.map((e) => e.id));
    if (this.tripsReady) {
      for (const e of state.expeditions) {
        if (this.knownTrips.has(e.id)) continue;
        e.members.forEach((_, i) => this.travel([door, this.edgeFor(e.kind, e.target, i)], i * 0.5));
      }
      for (const id of this.knownTrips) {
        if (ids.has(id)) continue;
        // Returned: we no longer know who, so send back a small party.
        for (let i = 0; i < 2; i++) this.travel([this.edgeFor('trade', 'chalk', i), door], i * 0.5);
      }
    }
    this.knownTrips = ids;
    this.tripsReady = true;
  }

  private edgeFor(kind: string, target: string, i: number): Pt {
    if (kind === 'hunt') return [-1.5, 4 + i * 0.6];
    const dir = NEIGHBORS.find((n) => n.id === target)?.dir ?? 'west';
    if (dir === 'south') return [riverX(GRID - 1) - 1 - i * 0.4, GRID + 1.5];
    if (dir === 'north') return [8 + i * 0.4, -1.5];
    return [-1.5, 9 + i * 0.4];
  }

  private travel(path: Pt[], delay: number) {
    const root = new Container();
    const body = new Graphics();
    drawPerson(body, '#5a4a32');
    root.addChild(body);
    root.visible = false;
    this.objects.addChild(root);
    this.travellers.push({ root, body, path, leg: 0, t: 0, delay });
  }

  // ---------------------------------------------------------------- ground and overlay

  private drawGround() {
    const g = this.groundG;
    g.clear();
    const col = GROUND[this.season ?? 'spring'];
    const depth = 22;
    const poly = (ps: Pt[], color: string, alpha = 1) => g.poly(ps.flatMap((p) => p)).fill({ color, alpha });
    g.ellipse(0, GRID * 16 + 40, GRID * 40, GRID * 20).fill({ color: '#000000', alpha: 0.25 });
    poly([iso(0, GRID), iso(GRID, GRID), iso(GRID, GRID, -depth), iso(0, GRID, -depth)], '#5c4330');
    poly([iso(GRID, 0), iso(GRID, GRID), iso(GRID, GRID, -depth), iso(GRID, 0, -depth)], '#7a5a3f');
    poly([iso(0, GRID), iso(GRID, GRID), iso(GRID, GRID, -6), iso(0, GRID, -6)], shade(col.edge, -0.1));
    poly([iso(GRID, 0), iso(GRID, GRID), iso(GRID, GRID, -6), iso(GRID, 0, -6)], col.edge);
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        const river = isRiver(x, y);
        const base = river ? col.water : isBank(x, y) ? col.bank : col.grass;
        poly([iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], shade(base, (noise(x, y, 9) - 0.5) * (river ? 0.06 : 0.12)));
      }
    }
    // ripples on the water, reeds on the banks
    for (let y = 0; y < GRID; y++) {
      const rx = riverX(y);
      for (let k = 0; k < 3; k++) {
        const [sx, sy] = iso(rx + 0.4 + k * 0.5, y + noise(rx, y, k) * 0.9);
        g.moveTo(sx - 5, sy).lineTo(sx + 5, sy).stroke({ width: 1, color: '#ffffff', alpha: this.season === 'winter' ? 0.15 : 0.3 });
      }
      if (this.season !== 'winter') {
        for (const bx of [rx - 1, rx + 2]) {
          if (bx < 0 || bx >= GRID || !isBank(bx, y)) continue;
          for (let k = 0; k < 4; k++) {
            const [sx, sy] = iso(bx + (bx < rx ? 0.7 : 0.1) + noise(bx, y, k) * 0.25, y + k * 0.25);
            g.moveTo(sx, sy).lineTo(sx + 1, sy - 7).stroke({ width: 1, color: '#5f7a35' });
          }
        }
      }
    }
  }

  private drawOverlay() {
    const g = this.overlayG;
    g.clear();
    const props = this.props;
    if (!props) return;
    const { state, selected, placing } = props;
    const diamond = (p: Plot) => [iso(p.x, p.y), iso(p.x + p.w, p.y), iso(p.x + p.w, p.y + p.d), iso(p.x, p.y + p.d)].flatMap((q) => q);

    const sel = selected ? state.structures.find((x) => x.id === selected) : undefined;
    if (sel && !placing) g.poly(diamond(plotOf(sel))).fill({ color: '#d9a441', alpha: 0.18 }).stroke({ width: 1.6, color: '#ffd36b' });
    if (this.hovered?.plot && !placing) g.poly(diamond(this.hovered.plot)).fill({ color: '#ffffff', alpha: 0.1 }).stroke({ width: 1, color: '#ffffff', alpha: 0.6 });

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
        drawStructure(new Painter(body, new Graphics(), this.season ?? 'spring'), placing, plot.w, plot.d, { stage: 'unsown' });
        this.ghost.addChild(body);
        this.ghostSig = sig;
      }
      const [gx, gy] = iso(plot.x, plot.y);
      this.ghost.position.set(gx, gy);
      this.ghost.visible = true;
      const trees = blocker ? 0 : treesOn(state, placing, this.ghostTile);
      const text = blocker ?? (trees ? `${trees} tile${trees > 1 ? 's' : ''} of forest to clear` : '');
      if (text) {
        const [tx, ty] = iso(plot.x + plot.w / 2, plot.y + plot.d / 2, 46);
        this.ghostText.text = text;
        this.ghostText.position.set(tx, ty);
        this.ghostText.visible = true;
      }
    }

    // label for the selection
    this.selLabel.visible = false;
    if (sel && !placing) {
      const p = plotOf(sel);
      const e = this.entities.get(sel.id);
      const [lx, ly] = iso(p.x + p.w / 2, p.y + p.d / 2, (e?.meta?.top ?? 40) + 6);
      this.selLabel.text = STRUCTURES[sel.type].name;
      this.selLabel.position.set(lx, ly);
      this.selLabel.visible = true;
    }

    // progress bars over building sites
    this.bars.clear();
    for (const x of state.structures.filter((v) => !v.built)) {
      const p = plotOf(x);
      const [bx, by] = iso(p.x + p.w / 2, p.y + p.d / 2, 34);
      this.bars.roundRect(bx - 22, by - 4, 44, 7, 3.5).fill({ color: '#140e08', alpha: 0.85 });
      this.bars.roundRect(bx - 20, by - 2.5, 40 * Math.min(1, x.work / x.workNeeded), 4, 2).fill('#d9a441');
    }
  }

  // ---------------------------------------------------------------- particles

  private resetWeather() {
    this.weather.removeChildren().forEach((c) => c.destroy());
    this.particles = this.particles.filter((p) => p.kind === 'smoke');
    const kind = ({ winter: 'snow', autumn: 'leaf', spring: 'petal', summer: null } as const)[this.season ?? 'spring'];
    if (!kind) return;
    const n = kind === 'snow' ? 150 : 36;
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      if (kind === 'snow') g.circle(0, 0, 1.2 + Math.random() * 1.2).fill({ color: '#ffffff', alpha: 0.9 });
      else g.ellipse(0, 0, 2.6, 1.3).fill(kind === 'leaf' ? ['#d9822b', '#b9541f', '#e6a83a'][i % 3] : '#f4b6c8');
      g.position.set(-620 + Math.random() * 1240, -260 + Math.random() * 900);
      this.weather.addChild(g);
      this.particles.push({ g, life: 0, max: Infinity, vx: (Math.random() - 0.5) * 8, vy: kind === 'snow' ? 18 + Math.random() * 16 : 10 + Math.random() * 8, kind, phase: Math.random() * 6 });
    }
  }

  private emitSmoke() {
    for (const e of this.entities.values()) {
      for (const [sx, sy] of e.meta?.smoke ?? []) {
        const g = new Graphics();
        g.circle(0, 0, 4).fill('#c9c4bd');
        g.position.set(e.root.x + sx, e.root.y + sy);
        this.fx.addChild(g);
        this.particles.push({ g, life: 0, max: 3.3, vx: 3 + Math.random() * 2, vy: -11 - Math.random() * 3, kind: 'smoke', phase: 0 });
      }
    }
  }

  // ---------------------------------------------------------------- frame

  private wander(m: Mover & { area?: Plot }, dt: number) {
    if (m.wait > 0) {
      m.wait -= dt;
      return;
    }
    const dx = m.tx - m.x, dy = m.ty - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) {
      const a = m.area;
      if (a) {
        // Far from the work area: walk there; otherwise potter about inside it.
        m.tx = a.x + Math.random() * a.w;
        m.ty = a.y + Math.random() * a.d;
      }
      m.wait = 0.5 + Math.random() * 2.5;
      return;
    }
    const step = Math.min(dist, m.speed * dt * (dist > 3 ? 2 : 1));
    m.x += (dx / dist) * step;
    m.y += (dy / dist) * step;
    this.placeAt(m.root, m.x, m.y);
    m.body.y = -Math.abs(Math.sin(this.time * 9 + m.speed * 10)) * 1.2;
  }

  private animate(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    for (const m of this.people.values()) this.wander(m, dt);
    for (const m of this.goats) this.wander(m, dt);

    this.travellers = this.travellers.filter((w) => {
      if (w.delay > 0) {
        w.delay -= dt;
        return true;
      }
      w.root.visible = true;
      let move = 1.4 * dt;
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
        w.root.destroy({ children: true });
        return false;
      }
      const a = w.path[w.leg], b = w.path[w.leg + 1];
      const f = w.t / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      this.placeAt(w.root, x, y);
      w.root.alpha = Math.max(0, 1 - Math.max(-x, -y, x - GRID, y - GRID, 0) * 0.8);
      w.body.y = -Math.abs(Math.sin(this.time * 9)) * 1.2;
      return true;
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
      if (p.g.y > 640) {
        p.g.y = -260;
        p.g.x = -620 + Math.random() * 1240;
      }
      return true;
    });
  }
}
