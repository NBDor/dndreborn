// Era 1 content: First Villages. Numbers are real-world approximations; the comments say where they come from.
// See docs/design.md for the rules this content follows.
import type { Amounts, ItemId, JobId, SeasonId, SkillId, StructureType, TechId } from './types';

// ---------------------------------------------------------------- calendar

export const DAYS_PER_SEASON = 91;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * 4; // 364

export interface SeasonDef {
  id: SeasonId;
  name: string;
  icon: string;
  /** Firewood burned per occupied house per day for warmth, kg. Cooking fuel is counted per person. */
  heating: number;
  /** Fraction of the day's wild-food gathering per kind, per gatherer-day, in kg. */
  gathering: Partial<Record<'fish' | 'wild_food' | 'nuts', number>>;
  description: string;
}

export const SEASONS: SeasonDef[] = [
  { id: 'spring', name: 'Spring', icon: '🌱', heating: 4, gathering: { fish: 2.5, wild_food: 2 },
    description: 'Sowing time. Fish run in the river; greens and eggs to gather.' },
  { id: 'summer', name: 'Summer', icon: '☀️', heating: 0, gathering: { fish: 2, wild_food: 4 },
    description: 'Crops grow and need weeding. Berries ripen. Herders cut leaf fodder for winter.' },
  { id: 'autumn', name: 'Autumn', icon: '🍂', heating: 4, gathering: { nuts: 1.8, wild_food: 1.5, fish: 1.5 },
    description: 'Harvest, hazelnuts and deer at their fattest. Prepare for winter.' },
  { id: 'winter', name: 'Winter', icon: '❄️', heating: 14, gathering: { fish: 0.8, wild_food: 0.2 },
    description: 'Nothing grows. The village lives on its stores, firewood and warm clothes.' },
];

// ---------------------------------------------------------------- people

/** kcal per day. Adults doing heavy work burn about 2,400–3,000; children and elders less. */
export const KCAL_CHILD = 1400;
export const KCAL_ADULT = 2400;
export const KCAL_ELDER = 1900;
export const CHILD_AGE = 12; // works and learns as a helper from 7, fully from 12
export const HELPER_AGE = 7;
export const ELDER_AGE = 55;
/** Firewood for cooking, kg per person per day (open hearths are inefficient). */
export const COOKING_WOOD = 1.2;
/** A person can carry about this much on a long walk, kg. */
export const CARRY_KG = 25;

export const FIRST_NAMES_F = [
  'Aru', 'Bena', 'Kessa', 'Ilo', 'Teska', 'Oda', 'Mira', 'Sael', 'Yuna', 'Lirra', 'Neve', 'Asha', 'Tavi', 'Ebru',
  'Hesk', 'Wenna', 'Dalis', 'Fio', 'Runa', 'Isse',
];
export const FIRST_NAMES_M = [
  'Doran', 'Maro', 'Vann', 'Rhun', 'Tobek', 'Esk', 'Garro', 'Halun', 'Joss', 'Kel', 'Lomir', 'Ostav', 'Peln',
  'Sorr', 'Ulmo', 'Barek', 'Corin', 'Davo', 'Fenn', 'Ivar',
];

// ---------------------------------------------------------------- items

export type ItemCategory = 'food' | 'material' | 'tool' | 'goods';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  category: ItemCategory;
  /** 'kg' items are counted by weight; others by piece. */
  unit: 'kg' | 'pc';
  /** Weight of one unit, kg (for carrying). */
  weight: number;
  /** Food energy per unit. */
  kcal?: number;
  /** Labour-days it takes to produce one unit: the basis of barter value. */
  value: number;
  /** Fraction lost per day, by season (spring, summer, autumn, winter). */
  spoil: [number, number, number, number];
  description: string;
}

const none: [number, number, number, number] = [0, 0, 0, 0];

export const ITEMS: Record<ItemId, ItemDef> = {
  grain: { id: 'grain', name: 'Emmer grain', icon: '🌾', category: 'food', unit: 'kg', weight: 1, kcal: 3400, value: 0.03,
    spoil: [0.0012, 0.0015, 0.0012, 0.0006],
    description: 'Hulled wheat. Stores for a year if kept dry and away from mice. Also the seed for next year.' },
  meat: { id: 'meat', name: 'Fresh meat', icon: '🍖', category: 'food', unit: 'kg', weight: 1, kcal: 1500, value: 0.05,
    spoil: [0.08, 0.15, 0.08, 0.03], description: 'Rots within days unless smoked or eaten.' },
  smoked_meat: { id: 'smoked_meat', name: 'Smoked meat', icon: '🥓', category: 'food', unit: 'kg', weight: 1, kcal: 2500, value: 0.12,
    spoil: [0.002, 0.003, 0.002, 0.001], description: 'Smoke and drying stop rot. Lighter and richer than fresh meat.' },
  fish: { id: 'fish', name: 'Fish', icon: '🐟', category: 'food', unit: 'kg', weight: 1, kcal: 1000, value: 0.04,
    spoil: [0.12, 0.2, 0.12, 0.05], description: 'From the river. Spoils fast.' },
  wild_food: { id: 'wild_food', name: 'Wild food', icon: '🫐', category: 'food', unit: 'kg', weight: 1, kcal: 500, value: 0.04,
    spoil: [0.25, 0.3, 0.25, 0.1], description: 'Greens, roots, berries, mushrooms. Eaten fresh.' },
  nuts: { id: 'nuts', name: 'Hazelnuts', icon: '🌰', category: 'food', unit: 'kg', weight: 1, kcal: 6300, value: 0.25,
    spoil: [0.001, 0.002, 0.0005, 0.0005], description: 'Rich in fat and protein, and keep through winter. Gathered in autumn.' },
  cheese: { id: 'cheese', name: 'Cheese', icon: '🧀', category: 'food', unit: 'kg', weight: 1, kcal: 3500, value: 0.6,
    spoil: [0.002, 0.004, 0.002, 0.001],
    description: 'Ten litres of milk make about one kilo. Making cheese removes most of the lactose adults cannot digest.' },

  straw: { id: 'straw', name: 'Straw', icon: '🌿', category: 'material', unit: 'kg', weight: 1, value: 0.005,
    spoil: none, description: 'Left after threshing: about as much straw as grain. Thatch, bedding, temper for daub.' },
  wood: { id: 'wood', name: 'Wood', icon: '🪵', category: 'material', unit: 'kg', weight: 1, value: 0.02,
    spoil: none, description: 'Posts, wattle and firewood. A household burns kilos every day.' },
  clay: { id: 'clay', name: 'Clay', icon: '🟫', category: 'material', unit: 'kg', weight: 1, value: 0.01,
    spoil: none, description: 'Dug from the riverbank. For daub walls and, once known, pottery.' },
  flint: { id: 'flint', name: 'Flint', icon: '🪨', category: 'material', unit: 'kg', weight: 1, value: 0.4,
    spoil: none,
    description: 'Breaks in sharp, predictable flakes. River nodules are small and flawed; mined chalk flint is far better.' },
  antler: { id: 'antler', name: 'Antler', icon: '🦌', category: 'material', unit: 'pc', weight: 1.5, value: 0.3,
    spoil: none, description: 'Red-deer antler: picks for digging and soft hammers for knapping.' },
  raw_hide: { id: 'raw_hide', name: 'Raw hide', icon: '🐂', category: 'material', unit: 'pc', weight: 6, value: 0.4,
    spoil: [0.04, 0.07, 0.04, 0.01], description: 'Rots unless scraped and smoked soon.' },
  leather: { id: 'leather', name: 'Leather', icon: '🟤', category: 'material', unit: 'pc', weight: 2, value: 3.5,
    spoil: [0.0005, 0.0008, 0.0005, 0.0003], description: 'Scraped, brain-softened and smoked hide.' },
  fodder: { id: 'fodder', name: 'Fodder', icon: '🍃', category: 'material', unit: 'kg', weight: 1, value: 0.02,
    spoil: [0.002, 0.002, 0.001, 0.0005], description: 'Dried leaves and hay for the goats in winter.' },

  clothing: { id: 'clothing', name: 'Clothing', icon: '🧥', category: 'goods', unit: 'pc', weight: 1.5, value: 9,
    spoil: none, description: 'Leather garments. Everyone needs one in winter; they wear out in about a year.' },
  pot: { id: 'pot', name: 'Pot', icon: '🏺', category: 'goods', unit: 'pc', weight: 3, value: 1.5,
    spoil: none, description: 'Keeps grain from damp and mice, and lets milk be made into cheese.' },
  sickle: { id: 'sickle', name: 'Sickle', icon: '🌙', category: 'tool', unit: 'pc', weight: 0.4, value: 0.8,
    spoil: none, description: 'Flint blades set in a wooden haft. Harvesting without one is slow.' },
  axe: { id: 'axe', name: 'Axe', icon: '🪓', category: 'tool', unit: 'pc', weight: 1.5, value: 1.5,
    spoil: none, description: 'For felling trees and shaping timber.' },
  scraper: { id: 'scraper', name: 'Scraper', icon: '🔪', category: 'tool', unit: 'pc', weight: 0.1, value: 0.2,
    spoil: none, description: 'For cleaning hides.' },
  arrows: { id: 'arrows', name: 'Arrows', icon: '🏹', category: 'tool', unit: 'pc', weight: 0.3, value: 0.8,
    spoil: none, description: 'A bundle of ten flint-tipped arrows. Many are lost on every hunt.' },
};

export const ITEM_ORDER = Object.keys(ITEMS) as ItemId[];
export const FOODS = ITEM_ORDER.filter((id) => ITEMS[id].kcal);

/** How long a tool lasts in worker-days at quality 0.5. Better tools last longer. */
export const TOOL_LIFE: Partial<Record<ItemId, number>> = { sickle: 120, axe: 200, scraper: 30 }; // with resharpening

// ---------------------------------------------------------------- jobs and skills

export interface JobDef {
  id: JobId;
  name: string;
  icon: string;
  skill?: SkillId;
  tool?: ItemId;
  /** Chance per worker-day of an accident, and how bad it is. */
  accident?: { chance: number; days: [number, number]; harm: number; what: string };
  description: string;
}

export const JOBS: Record<JobId, JobDef> = {
  idle: { id: 'idle', name: 'Resting', icon: '💤', description: 'Rests and recovers faster.' },
  farmer: { id: 'farmer', name: 'Farmer', icon: '🌾', skill: 'farming', tool: 'sickle',
    accident: { chance: 0.0003, days: [3, 8], harm: 10, what: 'strained a back' },
    description: 'Sows fields in spring, weeds in summer, harvests when the grain is ripe.' },
  herder: { id: 'herder', name: 'Herder', icon: '🐐', skill: 'herding',
    accident: { chance: 0.0005, days: [3, 10], harm: 15, what: 'was bitten driving off a wolf' },
    description: 'Guards the goats from wolves, milks them, and cuts leaf fodder in summer and autumn.' },
  gatherer: { id: 'gatherer', name: 'Gatherer', icon: '🧺', skill: 'gathering',
    accident: { chance: 0.0004, days: [2, 6], harm: 10, what: 'slipped on the riverbank' },
    description: 'Fishes and forages. What is found depends on the season.' },
  woodcutter: { id: 'woodcutter', name: 'Woodcutter', icon: '🪓', skill: 'woodcutting', tool: 'axe',
    accident: { chance: 0.0015, days: [15, 40], harm: 40, what: 'was struck by a falling tree' },
    description: 'Fells trees for posts and firewood. Slow without a good axe.' },
  builder: { id: 'builder', name: 'Builder', icon: '🛖', skill: 'building', tool: 'axe',
    accident: { chance: 0.001, days: [10, 30], harm: 30, what: 'fell from a roof' },
    description: 'Clears land, digs clay and raises houses, granaries and pens.' },
  knapper: { id: 'knapper', name: 'Knapper', icon: '🪨', skill: 'knapping',
    accident: { chance: 0.003, days: [2, 5], harm: 5, what: 'was cut by a flying flake' },
    description: 'Shapes flint into sickles, axes, scrapers and arrowheads.' },
  potter: { id: 'potter', name: 'Potter', icon: '🏺', skill: 'pottery',
    accident: { chance: 0.0008, days: [3, 8], harm: 10, what: 'was burned at the firing' },
    description: 'Digs clay, shapes, dries and fires pots.' },
  hideworker: { id: 'hideworker', name: 'Hide-worker', icon: '🟤', skill: 'hideworking', tool: 'scraper',
    accident: { chance: 0.0004, days: [3, 10], harm: 15, what: 'fell sick from a rotten hide' },
    description: 'Scrapes, softens and smokes hides into leather, and sews clothing.' },
  researcher: { id: 'researcher', name: 'Experimenting', icon: '💡',
    description: 'Tries new ideas. Costs time and materials, and may take many attempts.' },
};

export const JOB_ORDER = Object.keys(JOBS) as JobId[];

export const SKILL_NAMES: Record<SkillId, string> = {
  farming: 'Farming', herding: 'Herding', gathering: 'Gathering', woodcutting: 'Woodcutting', building: 'Building',
  knapping: 'Knapping', pottery: 'Pottery', hideworking: 'Hide-working', hunting: 'Hunting',
};

// ---------------------------------------------------------------- farming and herding (real figures)

export const FIELD_HA = 0.5;
/** Emmer: ~150 kg seed per hectare, ~1,000 kg harvest per hectare in a normal year (ancient yields). */
export const SEED_KG = 75;
export const FIELD_YIELD_KG = 500;
export const SOW_DAYS = 6; // hoeing and sowing half a hectare by hand
export const WEED_DAYS = 4;
export const HARVEST_DAYS = 5; // reaping with flint sickles and threshing
export const GROW_DAYS = 120; // spring-sown emmer ripens in about four months
/** After ripening, ears shatter and birds take grain: this fraction is lost per day. */
export const SHATTER_PER_DAY = 0.006;

export const GOAT_MEAT_KG = 14;
export const GOAT_FODDER_KG = 1.5; // dry fodder per goat per winter day
export const GOATS_PER_HERDER = 30;
export const GOATS_PER_PEN = 40;
/** Litres of milk per goat per day in spring and summer (about half the herd are does in milk). */
export const MILK_PER_GOAT = 0.35;
export const MILK_KCAL = 690;
export const FODDER_PER_HERDER = 35; // kg of leaf fodder cut per day in summer and autumn

// ---------------------------------------------------------------- structures

export interface StructureDef {
  type: StructureType;
  name: string;
  icon: string;
  w: number;
  d: number;
  /** Materials used, and builder-days. Clay is dug on site as part of the work (1 day per 150 kg). */
  wood: number;
  straw: number;
  clay: number;
  days: number;
  tech?: TechId;
  housing?: number;
  buildable: boolean;
  description: string;
}

export const CLAY_PER_DAY = 150;
/** Clearing a wooded tile: extra builder-days, and the wood it yields. */
export const CLEAR_DAYS = 4;
export const CLEAR_WOOD = 250;

export const STRUCTURES: Record<StructureType, StructureDef> = {
  hall: { type: 'hall', name: "Headman's hall", icon: '🏠', w: 2, d: 3, wood: 0, straw: 0, clay: 0, days: 0, housing: 10,
    buildable: false, description: 'The largest house, where the village meets. Holds the common stores.' },
  longhouse: { type: 'longhouse', name: 'Longhouse', icon: '🛖', w: 1, d: 3, wood: 2000, straw: 500, clay: 1500, days: 40,
    housing: 8, tech: 'wattle_daub', buildable: true,
    description: 'Timber posts, wattle walls daubed with clay, dung and straw, and a thick thatch. Houses 8.' },
  field: { type: 'field', name: 'Field', icon: '🌾', w: 2, d: 2, wood: 0, straw: 0, clay: 0, days: 8, tech: 'farming',
    buildable: true, description: 'Half a hectare of tilled land for emmer wheat.' },
  granary: { type: 'granary', name: 'Granary', icon: '🏚️', w: 1, d: 1, wood: 500, straw: 120, clay: 200, days: 12,
    tech: 'wattle_daub', buildable: true,
    description: 'A storehouse raised on posts to keep out damp and mice. Protects 2,000 kg of grain.' },
  pen: { type: 'pen', name: 'Goat pen', icon: '🐐', w: 2, d: 2, wood: 700, straw: 0, clay: 0, days: 8, tech: 'herding',
    buildable: true, description: 'A wattle fold where the goats spend the night safe from wolves. Holds 40.' },
  smokerack: { type: 'smokerack', name: 'Smoking rack', icon: '🔥', w: 1, d: 1, wood: 150, straw: 0, clay: 0, days: 3,
    tech: 'hide_smoking', buildable: true,
    description: 'Smokes up to 25 kg of meat or fish a day, so it keeps for months. Burns wood.' },
  kiln: { type: 'kiln', name: 'Kiln', icon: '🧱', w: 1, d: 1, wood: 100, straw: 50, clay: 900, days: 10, tech: 'kiln',
    buildable: true,
    description: 'A clay updraft kiln: a firebox below a perforated floor. Reaches 900–1,000 °C, hotter and more even than a pit.' },
};

export const STRUCTURE_ORDER = Object.keys(STRUCTURES) as StructureType[];
export const GRANARY_KG = 2000;
export const SMOKE_KG_PER_DAY = 25;
export const SMOKE_WOOD_PER_KG = 0.5; // a smouldering fire under the rack

// ---------------------------------------------------------------- crafts

export interface RecipeDef {
  id: ItemId;
  job: JobId;
  qty: number;
  inputs: Amounts;
  days: number;
  tech?: TechId;
}


export const RECIPES: RecipeDef[] = [
  { id: 'sickle', job: 'knapper', qty: 1, inputs: { flint: 0.25, wood: 0.5 }, days: 0.5 },
  { id: 'axe', job: 'knapper', qty: 1, inputs: { flint: 1.2, wood: 1 }, days: 1 },
  { id: 'scraper', job: 'knapper', qty: 1, inputs: { flint: 0.1 }, days: 0.15 },
  { id: 'arrows', job: 'knapper', qty: 1, inputs: { flint: 0.2, wood: 0.5 }, days: 0.6 },
  { id: 'pot', job: 'potter', qty: 1, inputs: { clay: 5, wood: 4 }, days: 0.8, tech: 'pottery' },
  { id: 'leather', job: 'hideworker', qty: 1, inputs: { raw_hide: 1 }, days: 3 },
  { id: 'clothing', job: 'hideworker', qty: 1, inputs: { leather: 2 }, days: 2 },
];

export const DEFAULT_TARGETS: Partial<Record<ItemId, number>> = {
  sickle: 6, axe: 4, scraper: 4, arrows: 10, pot: 20, leather: 2, clothing: 22,
};

// ---------------------------------------------------------------- knowledge

export interface TechDef {
  id: TechId;
  name: string;
  icon: string;
  prereqs: TechId[];
  /** Worker-days of experimenting needed. */
  cost: number;
  /** The skill that helps experiments. */
  skill?: SkillId;
  /** Materials used per day of experimenting. */
  uses?: Amounts;
  /** Buildings needed before experimenting. */
  needs?: StructureType;
  effect: string;
  science: string;
  /** Beyond this era: shown, but cannot be researched yet. */
  future?: boolean;
}

export const TECHS: Record<TechId, TechDef> = {
  fire: { id: 'fire', name: 'Fire', icon: '🔥', prereqs: [], cost: 0, effect: 'Warmth, cooking, light.',
    science: 'Burning wood releases the energy plants stored from sunlight. Cooking breaks down starch and proteins so the body gets more from food.' },
  knapping: { id: 'knapping', name: 'Flint knapping', icon: '🪨', prereqs: ['fire'], cost: 0, skill: 'knapping',
    effect: 'Stone tools.',
    science: 'Flint is almost pure silica with no grain, so a blow sends a cone-shaped fracture through it: knappers control where flakes break off.' },
  farming: { id: 'farming', name: 'Farming', icon: '🌾', prereqs: [], cost: 0, effect: 'Fields of emmer wheat.',
    science: 'Emmer keeps its grain in tough husks that do not shatter easily, so it can be harvested. One seed returns six or seven.' },
  herding: { id: 'herding', name: 'Goat herding', icon: '🐐', prereqs: [], cost: 0, effect: 'Goats for milk, meat and hides.',
    science: 'Goats eat leaves and scrub people cannot, turning them into milk and meat.' },
  hunting: { id: 'hunting', name: 'Hunting', icon: '🏹', prereqs: ['knapping'], cost: 0, effect: 'Hunting expeditions.',
    science: 'Bows store the archer\'s energy in bent wood and release it quickly into the arrow.' },
  gathering: { id: 'gathering', name: 'Gathering', icon: '🧺', prereqs: [], cost: 0, effect: 'Fish and wild food.',
    science: 'Knowing which plants are food, medicine or poison, and when each ripens, is knowledge passed down for generations.' },
  hide_smoking: { id: 'hide_smoking', name: 'Smoking', icon: '💨', prereqs: ['fire'], cost: 0,
    effect: 'Leather from hides; smoked meat and fish.',
    science: 'Wood smoke contains phenols and aldehydes that kill microbes and bind hide fibres; drying removes the water rot needs.' },
  wattle_daub: { id: 'wattle_daub', name: 'Wattle and daub', icon: '🛖', prereqs: [], cost: 0,
    effect: 'Longhouses and granaries.',
    science: 'Woven branches give walls strength in tension; clay mixed with straw and dung fills them and dries hard without cracking.' },

  pottery: { id: 'pottery', name: 'Fired pottery', icon: '🏺', prereqs: ['fire', 'wattle_daub'], cost: 45, skill: 'building',
    uses: { clay: 4, wood: 6 }, effect: 'Potters can make pots in a pit firing (about 700–800 °C).',
    science: 'Above about 600 °C the water locked inside clay minerals is driven off and they fuse: the change cannot be undone, so the clay can no longer dissolve.' },
  tempering: { id: 'tempering', name: 'Tempered clay', icon: '🧂', prereqs: ['pottery'], cost: 30, skill: 'pottery',
    uses: { clay: 4, wood: 4 }, effect: 'Far fewer pots crack in firing.',
    science: 'Grit, sand or crushed shell mixed into the clay lets steam escape and stops cracks from running when the pot heats and cools.' },
  kiln: { id: 'kiln', name: 'Updraft kiln', icon: '🧱', prereqs: ['tempering'], cost: 50, skill: 'pottery',
    uses: { clay: 10, wood: 10 }, effect: 'Kilns can be built: hotter, even firing, stronger pots, less fuel and breakage.',
    science: 'Enclosing the fire and drawing air up through it reaches 900–1,000 °C and keeps heat even. Kilns are the furnaces later used to smelt copper.' },
  heat_treated_flint: { id: 'heat_treated_flint', name: 'Heat-treated flint', icon: '♨️', prereqs: ['knapping', 'fire'], cost: 35,
    skill: 'knapping', uses: { flint: 0.5, wood: 3 }, effect: 'Knappers bake flint slowly in sand before working it: better tools from poorer stone.',
    science: 'Heating flint slowly to about 250–350 °C changes its micro-crystals so it fractures more smoothly. Too fast and it shatters.' },
  polished_axe: { id: 'polished_axe', name: 'Polished axe', icon: '🪓', prereqs: ['knapping'], cost: 40, skill: 'knapping',
    uses: { flint: 1 }, effect: 'Axes are ground smooth on sandstone: they last three times longer and cut faster.',
    science: 'A ground edge has no flake scars for cracks to start from, so it chips far less when it hits wood.' },
  manuring: { id: 'manuring', name: 'Manuring', icon: '💩', prereqs: ['farming', 'herding'], cost: 40, skill: 'farming',
    needs: 'pen', effect: 'Dung from the pen is spread on the fields: fertility recovers every year.',
    science: 'Dung returns nitrogen, phosphorus and potassium that each harvest takes out of the soil.' },
  cheese: { id: 'cheese', name: 'Cheese making', icon: '🧀', prereqs: ['herding', 'pottery'], cost: 35, skill: 'herding',
    uses: { wood: 2 }, effect: 'Milk becomes cheese that keeps for months and that adults can digest.',
    science: 'Most adults cannot digest lactose. Souring and straining milk through perforated pots removes most of it with the whey.' },
  copper: { id: 'copper', name: 'Copper smelting', icon: '🟢', prereqs: ['kiln'], cost: 999, future: true,
    effect: 'The next era.',
    science: 'Green and blue stones (malachite, azurite) are copper ores. Heated above 1,085 °C with charcoal, which takes their oxygen away, they give up metal.' },
};

export const TECH_ORDER = Object.keys(TECHS) as TechId[];
export const START_KNOWN: TechId[] = ['fire', 'knapping', 'farming', 'herding', 'hunting', 'gathering', 'hide_smoking', 'wattle_daub'];

// ---------------------------------------------------------------- pottery

/** Chance a pot cracks in firing. */
export const BREAKAGE = { pit: 0.35, tempered: 0.15, kiln: 0.06 };

// ---------------------------------------------------------------- hunting

export interface PreyDef {
  id: string;
  name: string;
  icon: string;
  days: number;
  minHunters: number;
  /** Party strength (hunting skill) at which success is a coin flip. */
  difficulty: number;
  meat: number;
  hides: number;
  antler: number;
  injury: number;
  death: number;
  description: string;
}

export const PREY: PreyDef[] = [
  { id: 'deer', name: 'Red deer', icon: '🦌', days: 3, minHunters: 2, difficulty: 60, meat: 55, hides: 1, antler: 1,
    injury: 0.01, death: 0, description: 'Shy forest deer. Around 55 kg of meat, a hide and antler.' },
  { id: 'boar', name: 'Wild boar', icon: '🐗', days: 3, minHunters: 2, difficulty: 80, meat: 45, hides: 1, antler: 0,
    injury: 0.06, death: 0.006, description: 'Fat in autumn, and dangerous when wounded.' },
  { id: 'aurochs', name: 'Aurochs', icon: '🐂', days: 5, minHunters: 4, difficulty: 200, meat: 300, hides: 2, antler: 0,
    injury: 0.12, death: 0.02, description: 'Wild cattle, taller than a man at the shoulder. Huge reward, real danger.' },
];

/** Hunting is best in autumn and worst in spring, when animals are lean and rearing young. */
export const HUNT_SEASON: Record<SeasonId, number> = { spring: 0.7, summer: 0.9, autumn: 1.2, winter: 1 };

// ---------------------------------------------------------------- neighbours

export interface NeighborDef {
  id: string;
  name: string;
  /** Days of travel each way. */
  days: number;
  /** Which edge of the map the path leaves by. */
  dir: 'west' | 'south' | 'north';
  description: string;
  /** What they produce well (kept in stock) and what they lack (value highly). */
  makes: Amounts;
  lacks: ItemId[];
  knows: TechId[];
  /** Quality of their goods. */
  quality: Partial<Record<ItemId, number>>;
  flintSource?: boolean;
}

export const NEIGHBORS: NeighborDef[] = [
  { id: 'chalk', name: 'The Chalk Hill folk', days: 1, dir: 'west',
    description: 'Herders on the chalk downs a day\'s walk west. They dig fine flint from deep shafts.',
    makes: { flint: 60, raw_hide: 6, axe: 4 }, lacks: ['grain', 'pot', 'cheese', 'nuts'],
    knows: ['heat_treated_flint', 'polished_axe'], quality: { flint: 0.9, axe: 0.8 }, flintSource: true },
  { id: 'reed', name: 'The Reed people', days: 2, dir: 'south',
    description: 'Fishers and potters two days downstream, where the river widens into marsh.',
    makes: { pot: 12, smoked_meat: 40, nuts: 30 }, lacks: ['flint', 'axe', 'leather', 'clothing', 'sickle'],
    knows: ['pottery', 'tempering'], quality: { pot: 0.6 } },
];

/** Gathering flint yourself on the Chalk Hill folk's land: kg per person, and its quality. */
export const FLINT_TRIP_KG = 20;
export const FLINT_TRIP_Q = 0.8;
export const RIVER_FLINT_Q = 0.45;
