// Core game types. The engine is pure: every state change goes through `reduce`.

export type ItemId =
  | 'food'
  | 'wood'
  | 'stone'
  | 'iron_ore'
  | 'herbs'
  | 'pelts'
  | 'planks'
  | 'iron_ingot'
  | 'tools'
  | 'rations'
  | 'healing_potion'
  | 'iron_sword'
  | 'leather_armor'
  | 'monster_parts'
  | 'relic';

export type ItemCategory = 'resource' | 'material' | 'supply' | 'gear' | 'treasure';

export type BuildingId =
  | 'town_hall'
  | 'house'
  | 'farm'
  | 'lumber_camp'
  | 'quarry'
  | 'mine'
  | 'herb_garden'
  | 'warehouse'
  | 'workshop'
  | 'smithy'
  | 'apothecary'
  | 'tavern'
  | 'market';

export type AdventurerClass = 'warrior' | 'rogue' | 'mage' | 'ranger' | 'cleric';

export type Inventory = Partial<Record<ItemId, number>>;

export interface Adventurer {
  id: string;
  name: string;
  cls: AdventurerClass;
  level: number;
  xp: number;
  /** Gold the adventurer asks for to take on a quest. */
  fee: number;
  /** Day on which an idle adventurer leaves the tavern. */
  leavesOnDay: number;
  status: 'idle' | 'questing' | 'injured';
  /** Day an injured adventurer recovers. */
  recoversOnDay?: number;
  questsCompleted: number;
}

export interface ActiveQuest {
  id: string;
  templateId: string;
  partyIds: string[];
  supplies: Inventory;
  startedTick: number;
  endsTick: number;
  successChance: number;
}

export interface Tile {
  x: number;
  y: number;
}

export interface Construction {
  building: BuildingId;
  targetLevel: number;
  endsTick: number;
  /** Where a new building (or a new cottage) is going up. Absent for upgrades in place. */
  at?: Tile;
}

export type LogKind = 'info' | 'good' | 'bad' | 'quest';

export interface LogEntry {
  id: number;
  day: number;
  kind: LogKind;
  text: string;
}

export interface GameState {
  version: number;
  tick: number;
  seed: number;
  gold: number;
  reputation: number;
  population: number;
  inventory: Inventory;
  buildings: Record<BuildingId, number>;
  /** Top-left tile of each built building (houses excluded). */
  placements: Partial<Record<BuildingId, Tile>>;
  /** One tile per cottage; its length equals the house level. */
  houses: Tile[];
  construction: Construction | null;
  adventurers: Adventurer[];
  quests: ActiveQuest[];
  log: LogEntry[];
  nextId: number;
  /** Food shortfall on the last day, used to show warnings. */
  starving: boolean;
  /** Firewood ran out during winter on the current day. */
  freezing: boolean;
}

export type Action =
  | { type: 'tick' }
  | { type: 'build'; building: BuildingId; at?: Tile }
  | { type: 'cancelBuild' }
  | { type: 'craft'; recipeId: string; times?: number }
  | { type: 'buy'; item: ItemId; qty: number }
  | { type: 'sell'; item: ItemId; qty: number }
  | { type: 'startQuest'; templateId: string; partyIds: string[]; supplies: Inventory }
  | { type: 'dismissAdventurer'; adventurerId: string };
