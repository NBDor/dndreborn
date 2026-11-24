# Hearthstead: design foundation

Draft 0.1. This document sets the rules the game is built on. Code, content and future ideas should follow it.
When something here changes, change it here first.

## 1. Pillars

1. **Grounded in real-world logic.** Materials, tools and processes behave as they do on Earth: the same physics,
   chemistry, biology and geology. A process exists in the game only when its real prerequisites exist
   (materials, temperatures, tools, knowledge, people to do the work, food to feed them).
2. **Another world.** The places, peoples, languages and history are invented. Earth history is our guide to
   what is *plausible* and in what *order*, not a script to replay. Inventions can come in a different order or
   place than they did on Earth, as long as the prerequisites hold.
3. **Gradual progression.** Technology grows out of experiment, observation, accident and contact with other
   peoples. Nothing appears without its prerequisites, and knowledge lives in people, so it can be lost.
4. **Trade shapes the world.** Goods are made by people, from materials found in particular places. Uneven
   resources, distance, transport, seasons and spoilage set prices and make trade necessary. Trade also carries
   ideas and techniques between peoples.
5. **Connected trades.** The game is a set of professions (mayor, miner, smith, potter, trader, ...) that share
   one world and one economy. Each feels like its own game, with its own skills and dangers. What one produces,
   with its real properties, is what the next one works with.
6. **Humans only, no magic, for now.** No supernatural beings or effects. A supernatural layer may be added
   later as a separate, rare layer with its own consistent rules; it must never be needed to explain how
   ordinary things work.

## 2. The world

- **Nature is Earth-like.** Plants, animals, rocks and minerals are Earth species and minerals (emmer wheat,
  goats, aurochs, flint, malachite, ...), so real data can drive the simulation. Geography, peoples and history
  are our own.
- **Uneven resources.** Each region has what its geology and climate give it, and lacks the rest. This is what
  makes trade necessary. Example: good flint only in chalk hills, copper ore only in certain uplands, tin far
  away, salt on the coast or at salt springs.
- **Seasons and climate** matter everywhere: when crops grow, when animals breed, when rivers flood or freeze,
  when travel is possible, what spoils.

### Starting region (working sketch, names are placeholders)

A temperate river valley:

| Area | What it offers | Problems |
|---|---|---|
| River and floodplain | Water, fish, clay, reeds, fertile silt, easy travel by boat | Floods, fevers from marshes |
| Valley slopes | Farmland, pasture | Soil wears out without rest or manure |
| Forest | Timber, firewood, game, nuts, bark (later tanning) | Wolves, bears, getting lost |
| Chalk hills (a day away) | High-quality flint | Belongs to neighbours; must be traded or mined |
| Uplands (several days) | Green and blue stones (copper ores), seen but not yet understood | Far, steep, other peoples |
| Coast (far) | Salt, shells, dried fish | Only reachable through traders |

## 3. Eras

Our own era names. The Earth equivalent and dates are only for reference and plausibility.

| # | Era | Earth equivalent | Settlement | Exchange | New professions |
|---|---|---|---|---|---|
| 0 | **Foragers** (optional prologue) | Late Stone Age | Seasonal camps of 20–50 | Gifts, sharing | Knapper, hide-worker, hunter, gatherer, healer |
| 1 | **First Villages** (start) | Neolithic | Year-round village of 50–300 | Gifts, barter, reciprocal debts | Farmer, herder, potter, weaver, flint miner, builder, trader, headman |
| 2 | **Copper** | Copper Age | Larger villages, chiefdoms | Barter; valued goods (copper, beads) store wealth | Miner, smelter, coppersmith, carter |
| 3 | **Bronze and Writing** | Bronze Age | Towns and the first cities | Weighed metal as money, merchants, written accounts | Bronze caster, scribe, merchant, sailor, shipwright, soldier |
| 4 | **Iron** | Iron Age | Cities and kingdoms | Coins | Blacksmith, charcoal burner, tanner (bark pits), shopkeeper |
| 5+ | Later eras | Classical, medieval, ... | | | Defined later |

The current prototype (iron, coins, market, tavern) roughly matches era 4. It is a preview of where the game
is heading, not the starting point.

## 4. Technology model

A technology is **knowledge + tools + materials + conditions + people who can do it**.

- **Prerequisites are real.** Example chain:
  ```
  fire ─▶ heat-treating flint ─▶ firing clay ─▶ kilns that reach 900–1,100 °C ─▶ copper smelting
  (copper melts at 1,085 °C; charcoal supplies the carbon that pulls oxygen out of the ore)
       ─▶ alloys (arsenic, then tin) ─▶ bronze
       ─▶ bloomery furnace ~1,200 °C ─▶ iron as a spongy bloom, hammered not cast (iron melts at 1,538 °C)
       ─▶ adding carbon and quenching ─▶ steel
  ```
- **Heat is the main gate** of early technology:

  | Heat source | Typical temperature | Enables |
  |---|---|---|
  | Open fire | 600–800 °C | Cooking, heat-treating flint, softening resin |
  | Pit or bonfire firing | 700–900 °C | Simple pottery |
  | Updraft kiln | 900–1,100 °C | Better pottery, lime burning |
  | Furnace with bellows | 1,100–1,250 °C | Copper smelting and casting |
  | Bloomery | 1,200–1,300 °C | Iron |

- **How discoveries happen:** players experiment (try a hotter fire, a different clay, a green stone in the
  kiln), notice accidents, or learn from traders and neighbours. Experiments cost materials and time and can
  fail.
- **Knowledge lives in people.** Skills belong to villagers and are passed on by teaching apprentices. If the
  only potter dies untaught, pottery quality drops or the craft is lost.

## 5. Materials model

Every good carries real properties, and every process changes them according to real rules. Examples:

| Material | Properties that matter |
|---|---|
| Flint | Quality (fine-grained or flawed), nodule size, freshly mined or weathered |
| Clay | Plasticity, impurities, temper added (sand, crushed shell, grit), moisture |
| Hide | Animal, thickness, freshness, how it was cured |
| Grain | Crop, moisture (damp grain rots or sprouts), pests |
| Copper ore | Mineral (oxide or sulphide), grade, arsenic content |
| Timber | Species, seasoned or green (green wood warps and cracks) |

A finished item remembers what it was made from and how. That is what connects the trades: the miner's ore
choice shows up in the smith's blade.

## 6. Economy and trade

- **Food surplus pays for specialists.** A potter or miner only works full time if others grow extra food.
  The size of the surplus limits how many specialists a village can support.
- **Value** comes from labour time, scarcity, quality and need. There is no money in era 1: people barter,
  give gifts and keep track of who owes whom.
- **Distance has a cost.** People carry about 20–30 kg; dugout canoes and rafts carry more on rivers; pack
  animals and carts come later. Heavy, cheap goods (stone, grain) travel short distances; light, valuable goods
  (flint blades, shells, salt, later copper) travel far.
- **Storage and spoilage.** Grain needs dry, pest-proof storage; meat and fish need smoking, drying or salt;
  hides rot if not cured.
- **Neighbours are real economies too.** Other villages produce, consume, trade, feud and change over time,
  simulated more simply than the player's own trade.

## 7. Era 1 professions and their dangers

| Profession | What they do | Dangers and problems |
|---|---|---|
| **Headman** (mayor role) | Assigns work, stores food, settles disputes, deals with neighbours, leads rituals | Famine, disease, feuds, raids, fire, losing the village's trust |
| Farmer | Clears land, sows and harvests emmer, barley, lentils, flax | Drought, floods, pests, soil exhaustion, rodents and rot in storage |
| Herder | Keeps goats, sheep, cattle, pigs | Wolves, disease, not enough winter fodder |
| Flint miner and knapper | Digs shafts into chalk with antler picks, shapes blades and axes | Shaft collapse, flying flakes and cuts, bad nodules |
| Potter | Digs and prepares clay, shapes, dries, fires | Pots crack or burst when not dried properly, poor clay, fuel shortage |
| Hide-worker | Scrapes, smokes and softens hides | Rot, maggots, infection from diseased animals |
| Weaver | Spins flax and wool, weaves cloth | Slow work, crop failure of flax |
| Builder | Builds houses of timber, wattle-and-daub and mudbrick | Fire, collapse, rot, damp |
| Hunters and explorers (replace adventurers) | Hunt, scout, travel to other peoples | Aurochs, boars, wolves, bears, drowning, getting lost, injury, hostile groups |
| Trader | Carries goods between villages | Robbery, bad bargains, being away in bad weather |

## 8. What changes in the current prototype

The architecture stays: a pure, deterministic engine (`src/game/`), shared rules, content as data tables, a
React UI and the PixiJS map. The content changes:

| Now (prototype) | Era 1 |
|---|---|
| Gold and coins, market prices | No money: barter, gifts, owed favours; value from labour and scarcity |
| Iron, steel, swords, smithy, apothecary potions | Flint, clay, hides, grain, flax, wood; knapping, pottery, weaving |
| Tavern, adventurers with classes (mage, cleric, ...) | Hunting and scouting parties of villagers with real skills |
| Quests with trolls, ghosts, a dragon, relics | Hunts, expeditions to the flint hills, visits to neighbours, defence against raids |
| Town hall, market, warehouse | Headman's house, granaries, shared work areas, a gathering place |
| Fixed list of buildings | Buildings and crafts appear only when their technology is known |

## 9. First milestone: era 1 vertical slice

A small, playable first-villages game that proves the pillars:

1. One village in the river valley, with seasons, a year-round food cycle and a food surplus that limits
   specialists.
2. A few professions: farmer, herder, potter, flint knapper, builder, hunters.
3. Materials with real properties for flint, clay, grain and hides, and processes that change them.
4. Technologies with prerequisites and experiments: for example from open-fire cooking to pit firing to a
   simple kiln.
5. One or two neighbouring villages to trade and feud with, with distance and carrying limits.
6. Knowledge held by villagers, passed on by teaching.

## 10. Open decisions

Defaults are proposed so work can continue; change them here.

| Question | Proposed default |
|---|---|
| Starting era | Era 1, First Villages. The foragers prologue can come later. |
| How discoveries happen | Experiments plus learning from traders and neighbours; no timed eras |
| Scale | One village and its neighbours first; a wider region later |
| World and people names | Placeholders for now |
| Supernatural layer | None until the grounded game works |
