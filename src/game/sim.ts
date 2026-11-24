// One day of village life. Called by the engine on a cloned state; mutates it.
import {
  BREAKAGE, COOKING_WOOD, DAYS_PER_YEAR, FIELD_YIELD_KG, FIRST_NAMES_F, FIRST_NAMES_M,
  FLINT_TRIP_KG, FLINT_TRIP_Q, FODDER_PER_HERDER, GOAT_FODDER_KG, GROW_DAYS, HARVEST_DAYS, HUNT_SEASON, ITEMS, JOBS,
  MILK_KCAL, MILK_PER_GOAT, NEIGHBORS, RIVER_FLINT_Q, SEED_KG, SHATTER_PER_DAY, SKILL_NAMES, SMOKE_KG_PER_DAY,
  SMOKE_WOOD_PER_KG, SOW_DAYS, STRUCTURES, TECHS, WEED_DAYS, CARRY_KG,
} from './data';
import { plotTiles, tileKey } from './map';
import type { Rng } from './rng';
import {
  age, bestAt, dayOfSeason, granaryCapacity, herdersNeeded, housing, isAvailable, isChild, isElder, kcalNeed,
  neighborDef, neighborValue, penCapacity, plotOf, prey, qty, recipesFor, season, seasonIndex, skill, structuresOf,
  techStatus, workRate, workers,
} from './rules';
import { add, log, newId, take, toolFactor, wear } from './store';
import type { Expedition, GameState, ItemId, JobId, Person, SkillId, TechId, WeatherYear } from './types';

const WEATHER: Record<WeatherYear, { yield: number; text: string }> = {
  good: { yield: 1.15, text: 'Gentle rain and early warmth: the elders expect a good year.' },
  normal: { yield: 1, text: 'An ordinary spring.' },
  dry: { yield: 0.6, text: 'The spring is dry and the river low. Crops will struggle.' },
  wet: { yield: 0.8, text: 'Cold rain day after day. Fields are waterlogged.' },
};

export function simulateDay(s: GameState, rng: Rng) {
  s.day += 1;
  const sd = dayOfSeason(s);
  if (sd === 1) newSeason(s, rng);

  // Work
  practice(s);
  accidents(s, rng);
  farm(s);
  herd(s, rng);
  gather(s);
  cutWood(s);
  build(s);
  craft(s);
  research(s);

  // Living
  eat(s);
  smoke(s);
  keepWarm(s);
  spoil(s);
  expeditions(s, rng);
  neighbors(s, rng);
  life(s, rng);
}

// ---------------------------------------------------------------- seasons

function newSeason(s: GameState, rng: Rng) {
  const se = season(s);
  if (se.id === 'spring') {
    const r = rng.next();
    s.weather = r < 0.2 ? 'good' : r < 0.7 ? 'normal' : r < 0.85 ? 'dry' : 'wet';
    log(s, s.weather === 'dry' || s.weather === 'wet' ? 'bad' : 'info', `🌱 Spring. ${WEATHER[s.weather].text}`);
    recoverFields(s);
    for (const n of s.neighbors) {
      n.famine = s.weather === 'dry' ? rng.chance(0.5) : rng.chance(0.08);
      if (n.famine) log(s, 'bad', `Word comes that ${n.name} went hungry over the winter.`);
    }
  } else {
    log(s, se.id === 'winter' ? 'bad' : 'info', `${se.icon} ${se.name}. ${se.description}`);
  }
}

function recoverFields(s: GameState) {
  const fields = structuresOf(s, 'field');
  const manure = s.known.includes('manuring') && structuresOf(s, 'pen').length > 0;
  let manured = manure ? Math.floor(s.goats / 6) : 0; // dung from ~6 goats per field per year
  for (const f of fields) {
    const fd = f.field!;
    if (fd.harvestedOn === undefined || s.day - fd.harvestedOn > DAYS_PER_YEAR) fd.fertility += 0.1; // lay fallow
    if (manured > 0) {
      fd.fertility += 0.08;
      manured--;
    }
    fd.fertility = Math.min(1.2, fd.fertility);
  }
}

// ---------------------------------------------------------------- skills and accidents

function practice(s: GameState) {
  const byJob = new Map<JobId, Person[]>();
  for (const p of s.people) if (isAvailable(p, s.day)) byJob.set(p.job, [...(byJob.get(p.job) ?? []), p]);
  for (const [job, people] of byJob) {
    const sk = JOBS[job].skill;
    if (!sk) continue;
    const best = bestAt(people, sk);
    for (const p of people) {
      const cur = skill(p, sk);
      const learn = (0.04 * (1 - cur / 100) + 0.02 * Math.max(0, best - cur)) * (age(p, s.day) < 16 ? 1.5 : 1);
      p.skills[sk] = Math.min(100, cur + learn);
    }
  }
}

function accidents(s: GameState, rng: Rng) {
  for (const p of s.people) {
    if (!isAvailable(p, s.day)) continue;
    const a = JOBS[p.job].accident;
    if (!a || !rng.chance(a.chance)) continue;
    hurt(s, p, rng.int(a.days[0], a.days[1]), a.harm, a.what);
  }
}

function hurt(s: GameState, p: Person, days: number, harm: number, what: string) {
  p.health = Math.max(0, p.health - harm);
  p.unwellUntil = Math.max(p.unwellUntil ?? 0, s.day + days);
  p.unwellReason = what;
  log(s, 'bad', `${p.name} ${what} and cannot work for ${days} days.`);
}

const labour = (s: GameState, job: JobId) => workers(s, job).reduce((sum, p) => sum + workRate(p, s.day, job), 0);

// ---------------------------------------------------------------- farming

function farm(s: GameState) {
  const farmers = workers(s, 'farmer');
  let work = farmers.reduce((sum, p) => sum + workRate(p, s.day, 'farmer'), 0);
  const fields = structuresOf(s, 'field');
  const se = season(s).id;
  const weatherYield = WEATHER[s.weather].yield;

  // Winter kills anything still standing.
  if (se === 'winter') {
    for (const f of fields) {
      const fd = f.field!;
      if (fd.sownOn !== null) {
        log(s, 'bad', 'Frost and rot took a field that was never harvested.');
        Object.assign(fd, { sownOn: null, sowWork: 0, weeding: 0, harvestWork: 0, harvestedOn: s.day });
      }
    }
  }

  // 1. Harvest ripe fields: reaping with sickles is the bottleneck.
  const sickles = toolFactor(s, 'sickle', farmers.length);
  let harvesting = false;
  for (const f of fields) {
    const fd = f.field!;
    if (fd.sownOn === null || s.day - fd.sownOn < GROW_DAYS || work <= 0) continue;
    harvesting = true;
    const done = Math.min(work * sickles, HARVEST_DAYS - fd.harvestWork);
    fd.harvestWork += done;
    work -= done / sickles;
    if (fd.harvestWork >= HARVEST_DAYS - 1e-6) {
      const late = Math.max(0, s.day - fd.sownOn - GROW_DAYS);
      const weedFactor = 0.6 + 0.4 * Math.min(1, fd.weeding / WEED_DAYS);
      const kg = FIELD_YIELD_KG * fd.fertility * weatherYield * weedFactor * (1 - Math.min(0.9, late * SHATTER_PER_DAY));
      add(s, 'grain', kg, 0.7);
      add(s, 'straw', kg, 0.7);
      log(s, 'good', `A field was harvested: ${Math.round(kg)} kg of emmer${late > 10 ? ` (${Math.round(Math.min(90, late * SHATTER_PER_DAY * 100))}% lost to waiting)` : ''}.`);
      Object.assign(fd, { sownOn: null, sowWork: 0, weeding: 0, harvestWork: 0, harvestedOn: s.day });
      fd.fertility = Math.max(0.4, fd.fertility - 0.08);
    }
  }
  if (harvesting) wear(s, 'sickle', farmers.length);

  // 2. Sow in spring. Seed comes out of the grain store.
  if (se === 'spring') {
    for (const f of fields) {
      const fd = f.field!;
      if (fd.sownOn !== null || work <= 0) continue;
      if (fd.harvestedOn !== undefined && fd.harvestedOn >= s.day - dayOfSeason(s)) continue; // already used this year
      if (fd.sowWork === 0) {
        if (qty(s, 'grain') < SEED_KG) continue;
        take(s, 'grain', SEED_KG);
        fd.sowWork = 0.001;
      }
      const done = Math.min(work, SOW_DAYS - fd.sowWork);
      fd.sowWork += done;
      work -= done;
      if (fd.sowWork >= SOW_DAYS - 1e-6) fd.sownOn = s.day;
    }
  }

  // 3. Weed growing fields: weeds left alone can halve a crop.
  for (const f of fields) {
    const fd = f.field!;
    if (fd.sownOn === null || work <= 0) continue;
    const grown = s.day - fd.sownOn;
    if (grown < 15 || grown > 90 || fd.weeding >= WEED_DAYS) continue;
    const done = Math.min(work, WEED_DAYS - fd.weeding);
    fd.weeding += done;
    work -= done;
  }
}

// ---------------------------------------------------------------- herding

function herd(s: GameState, rng: Rng) {
  if (s.goats <= 0) return;
  const se = season(s).id;
  const guard = labour(s, 'herder');
  const cover = Math.min(1, guard / Math.max(1, herdersNeeded(s)));

  if (se === 'summer' || se === 'autumn') add(s, 'fodder', guard * FODDER_PER_HERDER * 0.5, 0.6);

  if (se === 'winter') {
    const need = s.goats * GOAT_FODDER_KG;
    const got = take(s, 'fodder', need);
    if (got < need * 0.999 && rng.chance(((need - got) / need) * 0.15)) {
      s.goats -= 1;
      log(s, 'bad', 'A goat starved for lack of fodder.');
    }
  }

  if (se === 'spring' && dayOfSeason(s) === 25) {
    const kids = Math.round(s.goats * 0.5 * (0.6 + 0.4 * cover));
    s.goats += kids;
    log(s, 'good', `${kids} kids were born to the herd.`);
  }

  const over = s.goats > penCapacity(s);
  const risk = (0.004 + 0.05 * (1 - cover) + (over ? 0.03 : 0)) * (se === 'winter' ? 1.5 : 1);
  if (rng.chance(risk)) {
    const lost = Math.min(s.goats, rng.int(1, 3));
    s.goats -= lost;
    log(s, 'bad', `Wolves took ${lost} goat${lost > 1 ? 's' : ''}${cover < 1 ? ': there are too few herders' : over ? ': the pen is too small' : ''}.`);
  }
}

/** Litres of milk today (spring and summer). */
function milkToday(s: GameState): number {
  const se = season(s).id;
  if (se !== 'spring' && se !== 'summer') return 0;
  const cover = Math.min(1, labour(s, 'herder') / Math.max(1, herdersNeeded(s)));
  return s.goats * MILK_PER_GOAT * (0.5 + 0.5 * cover);
}

// ---------------------------------------------------------------- gathering and wood

function gather(s: GameState) {
  const people = workers(s, 'gatherer');
  if (!people.length) return;
  const work = people.reduce((sum, p) => sum + workRate(p, s.day, 'gatherer'), 0);
  const diminish = 1 / (1 + people.length / 10); // the nearby land only holds so much
  for (const [item, kg] of Object.entries(season(s).gathering) as [ItemId, number][]) {
    add(s, item, work * kg * diminish, 0.7);
  }
  add(s, 'flint', work * 0.012 * diminish, RIVER_FLINT_Q); // the odd nodule from the river gravel
}

function cutWood(s: GameState) {
  const people = workers(s, 'woodcutter');
  if (!people.length) return;
  const polished = s.known.includes('polished_axe') ? 1.3 : 1;
  const axes = toolFactor(s, 'axe', people.length + workers(s, 'builder').length);
  add(s, 'wood', labour(s, 'woodcutter') * 45 * axes * polished, 0.6);
  wear(s, 'axe', people.length, s.known.includes('polished_axe') ? 3 : 1);
}

// ---------------------------------------------------------------- building

function build(s: GameState) {
  const people = workers(s, 'builder');
  if (!people.length) return;
  const axes = toolFactor(s, 'axe', people.length + workers(s, 'woodcutter').length);
  let work = labour(s, 'builder') * (0.6 + 0.4 * axes);
  wear(s, 'axe', people.length, s.known.includes('polished_axe') ? 3 : 1);
  for (const x of s.structures) {
    if (x.built || work <= 0) continue;
    const done = Math.min(work, x.workNeeded - x.work);
    x.work += done;
    work -= done;
    if (x.work >= x.workNeeded - 1e-6) {
      x.built = true;
      for (const t of plotTiles(plotOf(x))) if (!s.cleared.includes(tileKey(t))) s.cleared.push(tileKey(t));
      if (x.clearedWood) add(s, 'wood', x.clearedWood, 0.6);
      if (x.type === 'field') x.field = { sownOn: null, sowWork: 0, weeding: 0, harvestWork: 0, fertility: x.clearedWood ? 1.15 : 1 };
      const def = STRUCTURES[x.type];
      log(s, 'good', `The ${def.name.toLowerCase()} is finished${x.clearedWood ? `; felling the trees gave ${x.clearedWood} kg of wood` : ''}.`);
    }
  }
}

// ---------------------------------------------------------------- crafts

function avgSkill(people: Person[], sk: SkillId) {
  return people.length ? people.reduce((sum, p) => sum + skill(p, sk), 0) / people.length : 0;
}

function craft(s: GameState) {
  for (const job of ['knapper', 'potter', 'hideworker'] as JobId[]) {
    const people = workers(s, job);
    if (!people.length) continue;
    let work = labour(s, job);
    const sk = JOBS[job].skill!;
    const sAvg = avgSkill(people, sk);

    if (job === 'potter' && s.known.includes('pottery') && qty(s, 'clay') < 10) {
      add(s, 'clay', work * 100, 0.6); // a day digging and preparing clay from the riverbank
      continue;
    }
    if (job === 'hideworker') work *= toolFactor(s, 'scraper', people.length);

    for (let guard = 0; guard < 6 && work > 1e-6; guard++) {
      const options = recipesFor(s, job)
        .map((r) => ({ r, short: ((s.targets[r.id] ?? 0) - qty(s, r.id)) / Math.max(1, s.targets[r.id] ?? 1) }))
        .filter(({ r, short }) => short > 0 && (Object.entries(r.inputs) as [ItemId, number][]).every(([i, n]) => qty(s, i) >= n * 0.1))
        .sort((a, b) => b.short - a.short);
      if (!options.length) break;
      const { r } = options[0];
      // How much can be made with today's labour and the inputs in store.
      let units = Math.min(work / r.days, (s.targets[r.id] ?? 0) - qty(s, r.id));
      for (const [i, n] of Object.entries(r.inputs) as [ItemId, number][]) units = Math.min(units, qty(s, i) / n);
      if (units <= 1e-6) break;
      let q = 0.6;
      const inputQ = (Object.keys(r.inputs) as ItemId[]).map((i) => s.inventory[i]?.q ?? 0.5);
      for (const [i, n] of Object.entries(r.inputs) as [ItemId, number][]) take(s, i, n * units);
      work -= units * r.days;

      if (job === 'knapper') {
        const flintQ = Math.min(0.95, (s.inventory.flint?.q ?? inputQ[0]) + (s.known.includes('heat_treated_flint') ? 0.15 : 0));
        q = flintQ * (0.55 + 0.45 * sAvg / 100);
        if (r.id === 'axe' && s.known.includes('polished_axe')) q = Math.min(1, q + 0.15);
      } else if (job === 'potter') {
        const kiln = s.known.includes('kiln') && structuresOf(s, 'kiln').length > 0;
        let rate = kiln ? BREAKAGE.kiln : s.known.includes('tempering') ? BREAKAGE.tempered : BREAKAGE.pit;
        rate *= (1 - sAvg / 250) * (season(s).id === 'winter' ? 1.3 : 1);
        const broken = units * rate;
        units -= broken;
        if (kiln) add(s, 'wood', 2 * (units + broken), 0.6); // a kiln needs about half the fuel of a pit firing
        if (techStatus(s, 'tempering') === 'available') s.research.tempering = (s.research.tempering ?? 0) + broken * 0.6;
        q = (s.inventory.clay?.q ?? 0.6) * (kiln ? 1.3 : 1) * (0.6 + 0.4 * sAvg / 100);
      } else {
        q = inputQ[0] * (0.7 + 0.3 * sAvg / 100) + 0.1;
      }
      add(s, r.id, units * r.qty, Math.min(1, q));
    }
  }
}

// ---------------------------------------------------------------- research

function research(s: GameState) {
  for (const p of workers(s, 'researcher')) {
    const id = p.research;
    if (!id || techStatus(s, id) !== 'available') {
      p.job = 'idle';
      p.research = undefined;
      continue;
    }
    const t = TECHS[id];
    if (t.uses && !(Object.entries(t.uses) as [ItemId, number][]).every(([i, n]) => qty(s, i) >= n)) continue;
    for (const [i, n] of Object.entries(t.uses ?? {}) as [ItemId, number][]) take(s, i, n);
    const sk = t.skill ? skill(p, t.skill) : 30;
    s.research[id] = (s.research[id] ?? 0) + (0.3 + 0.7 * sk / 100) * (p.health < 40 ? 0.5 : 1);
    if (t.skill) p.skills[t.skill] = Math.min(100, sk + 0.03);
  }
  checkDiscoveries(s);
}

export function checkDiscoveries(s: GameState) {
  for (const [id, done] of Object.entries(s.research) as [TechId, number][]) {
    const t = TECHS[id];
    if (s.known.includes(id) || done < t.cost || techStatus(s, id) !== 'available') continue;
    s.known.push(id);
    delete s.research[id];
    log(s, 'event', `💡 Discovery: ${t.name}! ${t.effect}`);
    for (const p of s.people) {
      if (p.research === id) {
        p.research = undefined;
        p.job = 'idle';
      }
    }
  }
}

// ---------------------------------------------------------------- food

const EAT_ORDER: ItemId[] = ['wild_food', 'fish', 'meat', 'grain', 'cheese', 'nuts', 'smoked_meat'];

/** Grain kept back to sow every field next spring. Farmers eat it only when there is nothing else. */
export function seedReserve(s: GameState): number {
  const fields = structuresOf(s, 'field').filter((f) => f.field!.sownOn === null && f.field!.sowWork === 0);
  return season(s).id === 'summer' && dayOfSeason(s) < 30 ? 0 : fields.length * SEED_KG;
}

function eat(s: GameState) {
  const present = s.people.filter((p) => !p.away);
  const need = present.reduce((sum, p) => sum + kcalNeed(p, s.day), 0);
  let left = need;

  // Milk first. Without cheese-making, only children can digest it.
  const milk = milkToday(s) * MILK_KCAL;
  const childNeed = present.filter((p) => isChild(p, s.day)).reduce((sum, p) => sum + kcalNeed(p, s.day), 0);
  const drunk = Math.min(milk, childNeed * 0.5);
  left -= drunk;
  if (s.known.includes('cheese') && qty(s, 'pot') >= 1) {
    const spare = (milk - drunk) / MILK_KCAL;
    add(s, 'cheese', spare / 10, 0.7);
  }

  const reserve = Math.min(qty(s, 'grain'), seedReserve(s));
  for (const item of EAT_ORDER) {
    if (left <= 0) break;
    const k = ITEMS[item].kcal!;
    const avail = item === 'grain' ? qty(s, 'grain') - reserve : qty(s, item);
    left -= take(s, item, Math.min(avail, left / k)) * k;
  }
  if (left > 0 && reserve > 0) {
    const before = qty(s, 'grain');
    left -= take(s, 'grain', left / ITEMS.grain.kcal!) * ITEMS.grain.kcal!;
    if (before >= reserve - 1e-6 && dayOfSeason(s) % 7 === 0) log(s, 'bad', 'The village is eating its seed grain. There will be less to sow.');
  }
  const eaten = need - Math.max(0, left);
  const ratio = need > 0 ? eaten / need : 1;
  for (const p of present) {
    if (ratio >= 0.98) p.health = Math.min(100, p.health + (p.job === 'idle' ? 0.8 : 0.4));
    else p.health -= (1 - ratio) * 4 * (isChild(p, s.day) || isElder(p, s.day) ? 1.3 : 1);
  }
  s.report = { ...s.report, kcalNeeded: need, kcalEaten: eaten, hungry: ratio < 0.98 ? present.length : 0, spoiled: {} };
}

function smoke(s: GameState) {
  let cap = structuresOf(s, 'smokerack').length * SMOKE_KG_PER_DAY;
  if (!cap) return;
  for (const [item, keep] of [['meat', 0.6], ['fish', 0.4]] as [ItemId, number][]) {
    const kg = Math.min(cap, qty(s, item), qty(s, 'wood') / SMOKE_WOOD_PER_KG);
    if (kg <= 0.01) continue;
    take(s, item, kg);
    take(s, 'wood', kg * SMOKE_WOOD_PER_KG);
    add(s, 'smoked_meat', kg * keep * (ITEMS[item].kcal! / ITEMS.meat.kcal!), 0.7);
    cap -= kg;
  }
}

// ---------------------------------------------------------------- warmth

function keepWarm(s: GameState) {
  const present = s.people.filter((p) => !p.away);
  const houses = Math.min(Math.ceil(present.length / 8), s.structures.filter((x) => x.built && STRUCTURES[x.type].housing).length);
  const need = present.length * COOKING_WOOD + houses * season(s).heating;
  const got = take(s, 'wood', need);
  // Clothes wear out in about a year.
  take(s, 'clothing', present.length / DAYS_PER_YEAR);

  let cold = 0;
  if (season(s).id === 'winter') {
    const noClothes = Math.max(0, present.length - Math.floor(qty(s, 'clothing')));
    const homeless = Math.max(0, present.length - housing(s));
    cold = Math.max(noClothes, homeless);
    if (got < need * 0.95) cold = present.length;
    const victims = [...present].sort((a, b) => kcalNeed(a, s.day) - kcalNeed(b, s.day)).slice(0, cold);
    for (const p of victims) p.health -= 0.9;
  }
  s.report.cold = cold;
}

// ---------------------------------------------------------------- spoilage

function spoil(s: GameState) {
  const si = seasonIndex(s);
  const spoiled: Partial<Record<ItemId, number>> = {};
  for (const [id, lot] of Object.entries(s.inventory) as [ItemId, NonNullable<GameState['inventory'][ItemId]>][]) {
    const rate = ITEMS[id].spoil[si];
    if (!rate || lot.qty <= 0) continue;
    let lost: number;
    if (id === 'grain') {
      // Granaries and pots keep out damp and mice.
      const safe = Math.min(lot.qty, granaryCapacity(s) + qty(s, 'pot') * 25);
      lost = safe * rate * 0.15 + (lot.qty - safe) * rate;
    } else {
      lost = lot.qty * rate;
    }
    lot.qty -= lost;
    spoiled[id] = lost;
  }
  s.report.spoiled = spoiled;
}

// ---------------------------------------------------------------- expeditions

function expeditions(s: GameState, rng: Rng) {
  for (const e of s.expeditions.filter((x) => x.returns <= s.day)) {
    const members = e.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
    if (e.kind === 'hunt') hunt(s, e, members, rng);
    else if (e.kind === 'flint') flintTrip(s, e, members, rng);
    else trade(s, e, members);
    for (const p of members) p.away = undefined;
  }
  s.expeditions = s.expeditions.filter((x) => x.returns > s.day);
}

function hunt(s: GameState, e: Expedition, members: Person[], rng: Rng) {
  const def = prey(e.target);
  const strength = members.reduce((sum, p) => sum + skill(p, 'hunting') + 20, 0) * HUNT_SEASON[season(s).id];
  const chance = Math.max(0.05, Math.min(0.9, 0.5 + (strength - def.difficulty) / (def.difficulty * 1.5)));
  const success = rng.chance(chance);
  add(s, 'arrows', members.length * 0.4, s.inventory.arrows?.q ?? 0.5); // some arrows come back
  if (success) {
    const kills = def.id === 'deer' && strength > def.difficulty * 2 ? 2 : 1;
    add(s, 'meat', def.meat * kills, 0.75);
    add(s, 'raw_hide', def.hides * kills, 0.7);
    if (def.antler) add(s, 'antler', def.antler * kills, 0.7);
    log(s, 'good', `The hunters brought back ${kills > 1 ? `${kills} ${def.name.toLowerCase()}` : `a ${def.name.toLowerCase()}`}: ${def.meat * kills} kg of meat.`);
  } else {
    log(s, 'info', `The ${def.name.toLowerCase()} hunt came back empty-handed.`);
  }
  for (const p of members) {
    p.skills.hunting = Math.min(100, skill(p, 'hunting') + (success ? 3 : 1.5));
    const f = success ? 1 : 2;
    if (rng.chance(def.death * f)) {
      p.health = 0;
      p.unwellReason = `was killed by a ${def.name.toLowerCase()}`;
    } else if (rng.chance(def.injury * f)) {
      hurt(s, p, rng.int(10, 30), 30, `was gored by a ${def.name.toLowerCase()}`);
    }
  }
}

function flintTrip(s: GameState, e: Expedition, members: Person[], rng: Rng) {
  const n = s.neighbors.find((x) => x.id === e.target)!;
  add(s, 'flint', members.length * FLINT_TRIP_KG, FLINT_TRIP_Q);
  if (n.trust < 20 && rng.chance(0.35)) {
    n.trust -= 15;
    log(s, 'bad', `${n.name} caught our people digging flint on their land. There were blows, and bad feeling.`);
    const p = rng.pick(members);
    hurt(s, p, rng.int(4, 12), 15, 'was beaten in the quarrel');
  } else {
    n.trust -= 3;
    log(s, 'info', `The flint party came back with ${members.length * FLINT_TRIP_KG} kg of good chalk flint. ${n.name} will have noticed.`);
  }
}

function trade(s: GameState, e: Expedition, members: Person[]) {
  const n = s.neighbors.find((x) => x.id === e.target)!;
  const def = neighborDef(n.id);
  let budget = n.owes;
  for (const [item, k] of Object.entries(e.cargo) as [ItemId, number][]) {
    budget += neighborValue(n, item) * k;
    n.stock[item] = (n.stock[item] ?? 0) + k;
  }
  const gift = e.wants.length === 0;
  const got: string[] = [];
  let carry = members.length * CARRY_KG;
  for (const item of e.wants) {
    const price = neighborValue(n, item) * 1.1;
    // Counted goods change hands whole; weighed goods by the kilo.
    const k = Math.floor(Math.min(n.stock[item] ?? 0, budget / price, carry / ITEMS[item].weight));
    if (k <= 0) continue;
    n.stock[item] = (n.stock[item] ?? 0) - k;
    budget -= k * price;
    carry -= k * ITEMS[item].weight;
    add(s, item, k, def.quality[item] ?? 0.6);
    got.push(`${k} ${ITEMS[item].unit === 'kg' ? 'kg ' : ''}${ITEMS[item].name.toLowerCase()}`);
  }
  n.owes = gift ? 0 : budget;
  n.trust = Math.min(100, n.trust + (gift ? Math.min(20, 3 + budget) : 3));
  if (gift) log(s, 'good', `Our gifts were welcomed by ${n.name}. Trust grows.`);
  else log(s, 'good', `Traders returned from ${n.name} with ${got.length ? got.join(', ') : 'nothing they wanted to part with'}.${budget > 0.5 ? ' They owe us the rest.' : ''}`);

  // Seeing how others do things.
  for (const id of def.knows) {
    if (s.known.includes(id) || techStatus(s, id) !== 'available') continue;
    const before = s.research[id] ?? 0;
    s.research[id] = before + 12;
    if (before === 0) log(s, 'event', `💡 Our traders watched how ${n.name} work: ${TECHS[id].name.toLowerCase()}. Experiments will go faster now.`);
  }
  checkDiscoveries(s);
}

// ---------------------------------------------------------------- neighbours

function neighbors(s: GameState, rng: Rng) {
  const se = season(s).id;
  for (const n of s.neighbors) {
    const def = NEIGHBORS.find((d) => d.id === n.id)!;
    for (const [item, k] of Object.entries(def.makes) as [ItemId, number][]) {
      n.stock[item] = Math.min(k * 1.5, (n.stock[item] ?? 0) + k / 30);
    }
    for (const item of Object.keys(n.stock) as ItemId[]) if (!def.makes[item]) n.stock[item]! *= 0.99;
    n.trust += (0 - n.trust) * 0.001;

    if (se === 'winter' && n.famine && n.trust < 10 && (qty(s, 'grain') > 100 || s.goats > 0) && rng.chance(0.006)) {
      const grain = take(s, 'grain', qty(s, 'grain') * 0.15);
      const goats = Math.min(s.goats, rng.int(1, 4));
      s.goats -= goats;
      n.trust -= 10;
      log(s, 'bad', `Hungry raiders from ${n.name} came in the night and took ${Math.round(grain)} kg of grain and ${goats} goats.`);
      for (const p of s.people.filter((x) => isAvailable(x, s.day) && !isChild(x, s.day))) {
        if (rng.chance(0.08)) hurt(s, p, rng.int(5, 20), 25, 'was wounded fighting off the raiders');
      }
    }
  }
}

// ---------------------------------------------------------------- birth, sickness and death

function life(s: GameState, rng: Rng) {
  const se = season(s).id;
  const pop = s.people.length;

  // Sickness spreads through crowded houses.
  const crowding = pop / Math.max(1, housing(s));
  const outbreak = se === 'winter' ? 0.005 : se === 'summer' ? 0.003 * crowding : 0.001;
  if (rng.chance(outbreak)) {
    const what = se === 'summer' ? 'the flux' : 'a coughing sickness';
    let ill = 0;
    for (const p of s.people) {
      if (!rng.chance(se === 'summer' ? 0.3 : 0.4)) continue;
      ill++;
      p.health -= (se === 'summer' ? 18 : 12) * (isChild(p, s.day) || isElder(p, s.day) ? 1.5 : 1);
      p.unwellUntil = Math.max(p.unwellUntil ?? 0, s.day + rng.int(4, 9));
      p.unwellReason = `has ${what}`;
    }
    if (ill) log(s, 'bad', `${what[0].toUpperCase() + what.slice(1)} spreads: ${ill} are ill.`);
  }

  // Deaths.
  for (const p of [...s.people]) {
    const a = age(p, s.day);
    const old = a > 45 ? Math.pow((a - 45) / 30, 3) * 0.01 : 0;
    if (p.health > 0 && !rng.chance(old)) continue;
    s.people = s.people.filter((x) => x !== p);
    const cause = p.health <= 0
      ? p.unwellReason?.startsWith('was killed') ? p.unwellReason : s.report.hungry ? 'of hunger' : s.report.cold ? 'of cold and sickness' : 'of their wounds and sickness'
      : 'of old age';
    const lost = (Object.entries(p.skills) as [SkillId, number][])
      .filter(([sk, v]) => v >= 50 && bestAt(s.people, sk) < v * 0.6)
      .map(([sk]) => SKILL_NAMES[sk].toLowerCase());
    log(s, 'bad', `${p.name} (${Math.floor(a)}) died ${cause}.${lost.length ? ` Much of what they knew of ${lost.join(' and ')} is lost with them.` : ''}`);
    if (p.away) for (const e of s.expeditions) e.members = e.members.filter((id) => id !== p.id);
  }

  // Births: about one child every three to four years per woman, when there is food and room.
  const fed = s.report.kcalNeeded > 0 && s.report.kcalEaten / s.report.kcalNeeded >= 0.9;
  if (fed && s.people.length < housing(s) + 2) {
    for (const p of s.people) {
      const a = age(p, s.day);
      if (p.sex !== 'f' || a < 17 || a > 42 || p.away || !rng.chance(0.28 / DAYS_PER_YEAR)) continue;
      const sex = rng.chance(0.5) ? 'f' : 'm';
      const child: Person = {
        id: newId(s, 'p'), name: rng.pick(sex === 'f' ? FIRST_NAMES_F : FIRST_NAMES_M), sex, born: s.day, health: 70,
        skills: {}, job: 'idle',
      };
      s.people.push(child);
      log(s, 'good', `${p.name} gave birth to ${sex === 'f' ? 'a daughter' : 'a son'}, ${child.name}.`);
    }
  }

  // Growing up.
  for (const p of s.people) {
    const born = Math.round(age(p, s.day) * DAYS_PER_YEAR);
    if (born === 7 * DAYS_PER_YEAR) log(s, 'info', `${p.name} is seven: old enough to help and learn a craft.`);
    if (born === 12 * DAYS_PER_YEAR) log(s, 'info', `${p.name} is twelve and now works as an adult.`);
  }
}
