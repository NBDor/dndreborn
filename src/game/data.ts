// Static game content: items, buildings, recipes, quests, adventurer classes.
import type { AdventurerClass, BuildingId, Inventory, ItemCategory, ItemId } from './types';

export const TICKS_PER_DAY = 24; // one tick is one in-game hour
export const BASE_STORAGE = 150;
export const STORAGE_PER_WAREHOUSE = 150;
export const BASE_HOUSING = 4;
export const HOUSING_PER_HOUSE = 4;
export const FOOD_PER_VILLAGER = 1; // per day
export const TAX_PER_VILLAGER = 1.5; // gold per day
export const UPKEEP_PER_LEVEL = 0.5; // gold per building level per day

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  category: ItemCategory;
  value: number;
  description: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  food: { id: 'food', name: 'Food', icon: '🌾', category: 'resource', value: 1, description: 'Feeds villagers. Each villager eats 1 per day.' },
  wood: { id: 'wood', name: 'Wood', icon: '🪵', category: 'resource', value: 1, description: 'Basic construction material.' },
  stone: { id: 'stone', name: 'Stone', icon: '🪨', category: 'resource', value: 2, description: 'Sturdy construction material.' },
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', icon: '⛏️', category: 'resource', value: 3, description: 'Smelted into ingots at the smithy.' },
  herbs: { id: 'herbs', name: 'Herbs', icon: '🌿', category: 'resource', value: 2, description: 'Brewed into potions.' },
  pelts: { id: 'pelts', name: 'Pelts', icon: '🦊', category: 'resource', value: 3, description: 'Hides brought back from the wilds.' },
  planks: { id: 'planks', name: 'Planks', icon: '🪚', category: 'material', value: 4, description: 'Processed wood for finer buildings.' },
  iron_ingot: { id: 'iron_ingot', name: 'Iron Ingot', icon: '🔩', category: 'material', value: 10, description: 'Refined iron for tools and weapons.' },
  tools: { id: 'tools', name: 'Tools', icon: '🛠️', category: 'material', value: 25, description: 'Needed for advanced construction.' },
  rations: { id: 'rations', name: 'Rations', icon: '🥖', category: 'supply', value: 6, description: 'Quest supply: +3% success each.' },
  healing_potion: { id: 'healing_potion', name: 'Healing Potion', icon: '🧪', category: 'supply', value: 15, description: 'Quest supply: +4% success and lowers injury risk.' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', icon: '🗡️', category: 'gear', value: 40, description: 'Quest gear: +3 power for one adventurer.' },
  leather_armor: { id: 'leather_armor', name: 'Leather Armor', icon: '🦺', category: 'gear', value: 35, description: 'Quest gear: +2 power and lowers death risk.' },
  monster_parts: { id: 'monster_parts', name: 'Monster Parts', icon: '🦴', category: 'treasure', value: 30, description: 'Rare trophies. Prized by merchants.' },
  relic: { id: 'relic', name: 'Ancient Relic', icon: '🏺', category: 'treasure', value: 120, description: 'A priceless artifact from forgotten ages.' },
};

export const ITEM_ORDER = Object.keys(ITEMS) as ItemId[];

export interface BuildingDef {
  id: BuildingId;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
  /** Cost to build level 1. Scaled by `costGrowth` per further level. */
  baseCost: { gold: number; items: Inventory };
  costGrowth: number;
  /** Construction hours per target level. */
  buildHours: number;
  workersPerLevel: number;
  produces?: { item: ItemId; perLevelPerDay: number };
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  town_hall: {
    id: 'town_hall', name: 'Town Hall', icon: '🏛️', maxLevel: 5,
    description: 'Seat of the village. Its level caps every other building at twice its level + 1. Needs reputation to grow.',
    baseCost: { gold: 150, items: { wood: 60, stone: 60 } }, costGrowth: 2.2, buildHours: 36, workersPerLevel: 0,
  },
  house: {
    id: 'house', name: 'Houses', icon: '🏠', maxLevel: 10,
    description: `Room for ${HOUSING_PER_HOUSE} more villagers per level.`,
    baseCost: { gold: 20, items: { wood: 25 } }, costGrowth: 1.45, buildHours: 8, workersPerLevel: 0,
  },
  farm: {
    id: 'farm', name: 'Farm', icon: '🌾', maxLevel: 10,
    description: 'Grows food.', produces: { item: 'food', perLevelPerDay: 4 },
    baseCost: { gold: 15, items: { wood: 20 } }, costGrowth: 1.45, buildHours: 8, workersPerLevel: 2,
  },
  lumber_camp: {
    id: 'lumber_camp', name: 'Lumber Camp', icon: '🪓', maxLevel: 10,
    description: 'Fells trees for wood.', produces: { item: 'wood', perLevelPerDay: 4 },
    baseCost: { gold: 15, items: { wood: 10 } }, costGrowth: 1.45, buildHours: 8, workersPerLevel: 2,
  },
  quarry: {
    id: 'quarry', name: 'Quarry', icon: '🪨', maxLevel: 10,
    description: 'Cuts stone.', produces: { item: 'stone', perLevelPerDay: 3 },
    baseCost: { gold: 25, items: { wood: 30 } }, costGrowth: 1.5, buildHours: 12, workersPerLevel: 2,
  },
  mine: {
    id: 'mine', name: 'Iron Mine', icon: '⛏️', maxLevel: 10,
    description: 'Digs iron ore.', produces: { item: 'iron_ore', perLevelPerDay: 2 },
    baseCost: { gold: 50, items: { wood: 40, stone: 30 } }, costGrowth: 1.55, buildHours: 16, workersPerLevel: 2,
  },
  herb_garden: {
    id: 'herb_garden', name: 'Herb Garden', icon: '🌿', maxLevel: 10,
    description: 'Cultivates medicinal herbs.', produces: { item: 'herbs', perLevelPerDay: 2 },
    baseCost: { gold: 25, items: { wood: 20, stone: 5 } }, costGrowth: 1.45, buildHours: 8, workersPerLevel: 1,
  },
  warehouse: {
    id: 'warehouse', name: 'Warehouse', icon: '📦', maxLevel: 10,
    description: `Raises storage for every item by ${STORAGE_PER_WAREHOUSE} per level.`,
    baseCost: { gold: 30, items: { wood: 40, stone: 20 } }, costGrowth: 1.5, buildHours: 12, workersPerLevel: 0,
  },
  workshop: {
    id: 'workshop', name: 'Workshop', icon: '🪚', maxLevel: 5,
    description: 'Crafts planks, tools and leatherwork.',
    baseCost: { gold: 30, items: { wood: 40 } }, costGrowth: 1.6, buildHours: 12, workersPerLevel: 1,
  },
  smithy: {
    id: 'smithy', name: 'Smithy', icon: '⚒️', maxLevel: 5,
    description: 'Smelts iron and forges weapons.',
    baseCost: { gold: 60, items: { wood: 30, stone: 50 } }, costGrowth: 1.6, buildHours: 16, workersPerLevel: 1,
  },
  apothecary: {
    id: 'apothecary', name: 'Apothecary', icon: '⚗️', maxLevel: 5,
    description: 'Brews potions from herbs.',
    baseCost: { gold: 50, items: { wood: 30, stone: 20 } }, costGrowth: 1.6, buildHours: 12, workersPerLevel: 1,
  },
  tavern: {
    id: 'tavern', name: 'Tavern', icon: '🍺', maxLevel: 5,
    description: 'Draws adventurers. Higher levels attract more of them, more often. Also cooks rations.',
    baseCost: { gold: 40, items: { wood: 50, stone: 10 } }, costGrowth: 1.7, buildHours: 16, workersPerLevel: 1,
  },
  market: {
    id: 'market', name: 'Market', icon: '⚖️', maxLevel: 5,
    description: 'Trade goods for gold. Higher levels give better prices.',
    baseCost: { gold: 60, items: { wood: 40, stone: 20 } }, costGrowth: 1.7, buildHours: 16, workersPerLevel: 1,
  },
};

export const BUILDING_ORDER = Object.keys(BUILDINGS) as BuildingId[];

/** Reputation needed to raise the town hall to a given level. */
export const TOWN_HALL_REPUTATION: Record<number, number> = { 2: 10, 3: 30, 4: 60, 5: 100 };

export interface RecipeDef {
  id: string;
  output: ItemId;
  qty: number;
  inputs: Inventory;
  station: BuildingId;
  stationLevel: number;
}

export const RECIPES: RecipeDef[] = [
  { id: 'planks', output: 'planks', qty: 1, inputs: { wood: 2 }, station: 'workshop', stationLevel: 1 },
  { id: 'tools', output: 'tools', qty: 1, inputs: { iron_ingot: 1, planks: 2 }, station: 'workshop', stationLevel: 2 },
  { id: 'leather_armor', output: 'leather_armor', qty: 1, inputs: { pelts: 4, planks: 1 }, station: 'workshop', stationLevel: 2 },
  { id: 'iron_ingot', output: 'iron_ingot', qty: 1, inputs: { iron_ore: 2, wood: 1 }, station: 'smithy', stationLevel: 1 },
  { id: 'iron_sword', output: 'iron_sword', qty: 1, inputs: { iron_ingot: 3, planks: 1 }, station: 'smithy', stationLevel: 2 },
  { id: 'healing_potion', output: 'healing_potion', qty: 1, inputs: { herbs: 3 }, station: 'apothecary', stationLevel: 1 },
  { id: 'rations', output: 'rations', qty: 2, inputs: { food: 5 }, station: 'tavern', stationLevel: 1 },
];

export interface LootRange {
  item: ItemId | 'gold';
  min: number;
  max: number;
}

export interface QuestTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Party power at which success is a coin flip. */
  difficulty: number;
  days: number;
  minReputation: number;
  maxParty: number;
  reputation: number;
  loot: LootRange[];
}

export const QUESTS: QuestTemplate[] = [
  {
    id: 'cellar_rats', name: 'Rats in the Cellar', icon: '🐀', difficulty: 2, days: 1, minReputation: 0, maxParty: 1, reputation: 1,
    description: 'Giant rats are gnawing through the grain stores.',
    loot: [{ item: 'gold', min: 8, max: 16 }, { item: 'food', min: 5, max: 12 }],
  },
  {
    id: 'wolf_den', name: 'The Wolf Den', icon: '🐺', difficulty: 8, days: 2, minReputation: 0, maxParty: 2, reputation: 2,
    description: 'Wolves prowl near the farms. Thin the pack and bring back their pelts.',
    loot: [{ item: 'gold', min: 12, max: 25 }, { item: 'pelts', min: 4, max: 8 }],
  },
  {
    id: 'herb_expedition', name: 'Moonleaf Expedition', icon: '🌙', difficulty: 6, days: 2, minReputation: 0, maxParty: 2, reputation: 2,
    description: 'Escort the herbalist into the Thornwood to gather rare herbs.',
    loot: [{ item: 'gold', min: 5, max: 15 }, { item: 'herbs', min: 8, max: 16 }],
  },
  {
    id: 'bandit_camp', name: 'Bandit Camp', icon: '🏴', difficulty: 15, days: 3, minReputation: 5, maxParty: 3, reputation: 4,
    description: 'Bandits are raiding travellers on the north road.',
    loot: [{ item: 'gold', min: 40, max: 80 }, { item: 'iron_ingot', min: 1, max: 3 }],
  },
  {
    id: 'abandoned_mine', name: 'The Abandoned Mine', icon: '🕳️', difficulty: 20, days: 3, minReputation: 10, maxParty: 3, reputation: 4,
    description: 'Something stirs in the old dwarven mine. Clear it out and haul what ore remains.',
    loot: [{ item: 'iron_ore', min: 15, max: 30 }, { item: 'stone', min: 10, max: 25 }, { item: 'gold', min: 10, max: 30 }],
  },
  {
    id: 'troll_bridge', name: 'Troll Under the Bridge', icon: '🧌', difficulty: 32, days: 4, minReputation: 20, maxParty: 3, reputation: 6,
    description: 'A troll demands tolls from every merchant crossing the river.',
    loot: [{ item: 'gold', min: 60, max: 120 }, { item: 'monster_parts', min: 2, max: 5 }],
  },
  {
    id: 'haunted_ruins', name: 'The Haunted Ruins', icon: '👻', difficulty: 48, days: 5, minReputation: 35, maxParty: 4, reputation: 8,
    description: 'Restless spirits guard the ruins of an old temple, and its treasures.',
    loot: [{ item: 'gold', min: 100, max: 200 }, { item: 'relic', min: 1, max: 2 }],
  },
  {
    id: 'dragon_lair', name: 'The Dragon of Ashpeak', icon: '🐉', difficulty: 95, days: 8, minReputation: 70, maxParty: 4, reputation: 20,
    description: 'A dragon has woken in the mountains. Slay it and the realm will know your village\'s name.',
    loot: [{ item: 'gold', min: 400, max: 800 }, { item: 'relic', min: 3, max: 5 }, { item: 'monster_parts', min: 5, max: 10 }],
  },
];

export interface ClassDef {
  id: AdventurerClass;
  name: string;
  icon: string;
  powerPerLevel: number;
  perk: string;
}

export const CLASSES: Record<AdventurerClass, ClassDef> = {
  warrior: { id: 'warrior', name: 'Warrior', icon: '🛡️', powerPerLevel: 4, perk: 'Gains double power from swords and armor.' },
  rogue: { id: 'rogue', name: 'Rogue', icon: '🗝️', powerPerLevel: 3, perk: '+25% gold from quests.' },
  mage: { id: 'mage', name: 'Mage', icon: '🔮', powerPerLevel: 5, perk: 'Powerful but frail: higher injury risk.' },
  ranger: { id: 'ranger', name: 'Ranger', icon: '🏹', powerPerLevel: 3, perk: 'Finds the quick path: quests take one day less.' },
  cleric: { id: 'cleric', name: 'Cleric', icon: '✨', powerPerLevel: 3, perk: 'Heals the party: halves injury and death risk.' },
};

export const FIRST_NAMES = [
  'Aldric', 'Brienne', 'Corwin', 'Dara', 'Elowen', 'Fenris', 'Gwyn', 'Halvard', 'Isolde', 'Jory', 'Kael', 'Lyra',
  'Merrick', 'Nessa', 'Orrin', 'Perrin', 'Quill', 'Rowan', 'Sable', 'Thane', 'Ulric', 'Vesna', 'Wren', 'Yara', 'Zephyr',
];
export const EPITHETS = [
  'the Bold', 'Ironhand', 'of the Vale', 'Swiftfoot', 'the Grey', 'Stormborn', 'Oakenshield', 'the Quiet', 'Ashwalker',
  'Brightblade', 'the Wanderer', 'Duskbane', 'Thornheart', 'the Lucky', 'Ravenwood',
];

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonDef {
  id: SeasonId;
  name: string;
  icon: string;
  /** Multipliers on daily production by item. Items not listed produce normally. */
  production: Partial<Record<ItemId, number>>;
  /** Wood burned per villager per day to keep warm. */
  firewood: number;
  description: string;
}

export const DAYS_PER_SEASON = 6;

export const SEASONS: SeasonDef[] = [
  { id: 'spring', name: 'Spring', icon: '🌱', production: { herbs: 1.25 }, firewood: 0,
    description: 'Herbs flourish (+25%).' },
  { id: 'summer', name: 'Summer', icon: '☀️', production: { food: 1.25 }, firewood: 0,
    description: 'Long days: farms yield +25%.' },
  { id: 'autumn', name: 'Autumn', icon: '🍂', production: { food: 1.1, herbs: 0.75 }, firewood: 0,
    description: 'Harvest time: farms +10%, herbs -25%. Stock up for winter.' },
  { id: 'winter', name: 'Winter', icon: '❄️', production: { food: 0.35, herbs: 0.25 }, firewood: 0.4,
    description: 'Fields freeze: farms 35%, herbs 25%. Each villager burns 0.4 wood a day.' },
];
