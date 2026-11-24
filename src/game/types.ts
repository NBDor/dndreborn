// Core game types for era 1, First Villages. The engine is pure: every change goes through `reduce`.
// One tick is one day.

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export type ItemId =
  // food
  | 'grain' | 'meat' | 'smoked_meat' | 'fish' | 'wild_food' | 'nuts' | 'cheese'
  // materials
  | 'straw' | 'wood' | 'clay' | 'flint' | 'antler' | 'raw_hide' | 'leather' | 'fodder'
  // goods and tools
  | 'clothing' | 'pot' | 'sickle' | 'axe' | 'scraper' | 'arrows';

export type SkillId =
  | 'farming' | 'herding' | 'gathering' | 'woodcutting' | 'building' | 'knapping' | 'pottery' | 'hideworking'
  | 'hunting';

export type JobId =
  | 'idle' | 'farmer' | 'herder' | 'gatherer' | 'woodcutter' | 'builder' | 'knapper' | 'potter' | 'hideworker'
  | 'researcher';

export type StructureType = 'hall' | 'longhouse' | 'field' | 'granary' | 'pen' | 'smokerack' | 'kiln';

export type TechId =
  | 'fire' | 'knapping' | 'farming' | 'herding' | 'hunting' | 'gathering' | 'hide_smoking' | 'wattle_daub'
  | 'pottery' | 'tempering' | 'kiln' | 'heat_treated_flint' | 'polished_axe' | 'manuring' | 'cheese'
  | 'copper';

export interface Tile {
  x: number;
  y: number;
}

/** A stock of one item. Quality (0..1) is the average of everything in the stock. */
export interface Lot {
  qty: number;
  q: number;
}

export type Inventory = Partial<Record<ItemId, Lot>>;
export type Amounts = Partial<Record<ItemId, number>>;

export interface Person {
  id: string;
  name: string;
  sex: 'f' | 'm';
  /** Day of birth (negative for people born before the game started). */
  born: number;
  /** 0..100. At 0 the person dies. */
  health: number;
  /** 0..100 per skill. Knowledge lives in people: it is learned by doing and from better workers. */
  skills: Partial<Record<SkillId, number>>;
  job: JobId;
  /** What a researcher is experimenting with. */
  research?: TechId;
  /** Cannot work until this day (injury or sickness). */
  unwellUntil?: number;
  unwellReason?: string;
  /** Set while away on an expedition. */
  away?: string;
}

export interface Field {
  /** Day the field was sown, or null if it lies unsown. */
  sownOn: number | null;
  /** Worker-days spent sowing (needs SOW_DAYS before the seed is in). */
  sowWork: number;
  /** Worker-days of weeding while the crop grows. */
  weeding: number;
  /** Worker-days of harvesting done. */
  harvestWork: number;
  /** Soil fertility multiplier. Falls with each harvest, recovers with rest and manure. */
  fertility: number;
  /** Day of the last harvest (for drawing stubble). */
  harvestedOn?: number;
}

export interface Structure {
  id: string;
  type: StructureType;
  at: Tile;
  built: boolean;
  /** Builder-days done and needed. */
  work: number;
  workNeeded: number;
  /** Wood recovered from clearing trees on the plot, added when finished. */
  clearedWood: number;
  field?: Field;
}

export type ExpeditionKind = 'hunt' | 'flint' | 'trade';

export interface Expedition {
  id: string;
  kind: ExpeditionKind;
  /** Prey id for hunts, neighbour id for flint trips and trade. */
  target: string;
  members: string[];
  departed: number;
  returns: number;
  /** Goods carried out (trade). */
  cargo: Amounts;
  /** Goods wanted in return, in order of preference (trade). */
  wants: ItemId[];
}

export interface Neighbor {
  id: string;
  name: string;
  /** -100..100. Trust grows with fair trade and gifts, falls with trespass and theft. */
  trust: number;
  stock: Amounts;
  /** Value they owe us from earlier trades (in labour-days), repaid in goods later. */
  owes: number;
  famine: boolean;
}

export type WeatherYear = 'good' | 'normal' | 'dry' | 'wet';

export type LogKind = 'info' | 'good' | 'bad' | 'event';

export interface LogEntry {
  id: number;
  day: number;
  kind: LogKind;
  text: string;
}

/** Yesterday's figures, kept for the UI. */
export interface DayReport {
  kcalNeeded: number;
  kcalEaten: number;
  hungry: number;
  cold: number;
  spoiled: Amounts;
}

export interface GameState {
  version: number;
  /** Days since the founding (0 = first day of spring, year 1). */
  day: number;
  seed: number;
  people: Person[];
  inventory: Inventory;
  goats: number;
  structures: Structure[];
  /** Tiles whose trees have been felled ("x,y"). */
  cleared: string[];
  expeditions: Expedition[];
  neighbors: Neighbor[];
  known: TechId[];
  /** Research progress in worker-days, per technology. */
  research: Partial<Record<TechId, number>>;
  /** How many of each craft good the village wants in store. Craftspeople work towards these. */
  targets: Partial<Record<ItemId, number>>;
  weather: WeatherYear;
  report: DayReport;
  log: LogEntry[];
  nextId: number;
}

export type Action =
  | { type: 'tick' }
  | { type: 'assign'; personId: string; job: JobId; research?: TechId }
  | { type: 'build'; structure: StructureType; at: Tile }
  | { type: 'cancelBuild'; structureId: string }
  | { type: 'setTarget'; item: ItemId; qty: number }
  | { type: 'slaughter'; count: number }
  | { type: 'expedition'; kind: ExpeditionKind; target: string; members: string[]; cargo?: Amounts; wants?: ItemId[] };
