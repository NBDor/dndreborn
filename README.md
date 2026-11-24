# Hearthstead

A village simulation grounded in real-world logic. You guide a band of settlers founding the first village in a
river valley of an invented world: humans only, no magic, and technology that grows step by step from real
prerequisites. See [`docs/design.md`](docs/design.md) for the design rules.

This is the **era 1 proof of concept: First Villages** (a Neolithic-level technology).

## Running

```bash
npm install
npm run dev      # start the dev server
npm test         # engine, map and balance tests
npm run build    # typecheck + production build into dist/
```

Progress is saved automatically in the browser. Use **↺ New** to start over. Saves from earlier prototypes are
not carried over.

## How it plays

- **Time.** One day passes per second at 1× (pause, 1×, 2×, 5×). A season is 91 days, a year 364.
- **People.** Sixteen named settlers with ages, health and skills. Assign each a job; skills grow by practice and
  fastest beside someone more skilled. Children help from seven and work fully from twelve. When the last expert
  in a craft dies untaught, the knowledge is largely lost.
- **Food.** Everyone needs real calories (about 2,400 kcal a day for a working adult). Emmer wheat is sown in
  spring (75 kg of seed per half-hectare field), weeded in summer, ripens after about four months and must be
  harvested before it shatters. Seed grain is kept back from eating. Gatherers fish and forage by season
  (hazelnuts in autumn are a mainstay). Goats give milk (only children can digest it until cheese is discovered),
  meat and hides. Fresh food spoils in days; smoking racks and granaries preserve it.
- **Winter.** Fields freeze, goats need dried fodder, every house burns firewood and everyone needs warm
  clothing, which wears out in about a year.
- **Building.** Place longhouses, fields, granaries, pens and smoking racks anywhere on dry land. Building on
  forest takes longer but the felled trees give wood. Clay for daub is dug on site.
- **Crafts.** Set how many tools and goods to keep; knappers, potters and hide-workers work toward those targets.
  Tool quality follows the flint and the worker's skill; tools wear out with use.
- **Journeys.** Hunt deer, boar or aurochs (real danger); dig flint on the Chalk Hill folk's land (they will not
  like it); trade by barter with two neighbouring peoples, limited to what your people can carry (25 kg each).
  Neighbours value what they lack, remember debts, and teach by example.
- **Knowledge.** Discover fired pottery, tempered clay, the updraft kiln, heat-treated flint, the polished axe,
  manuring and cheese by experimenting, each with its real prerequisites and the science behind it. Copper
  smelting is shown as the next era.
- **Advisor.** The bar under the resources warns about what will go wrong soon: food, seed, firewood, clothing,
  fodder, wolves, and knowledge held by a single ageing person.

## Code layout

```
docs/design.md    design rules: grounded world, eras, technology, trade
src/game/         pure, deterministic engine (no React)
  types.ts          state and action types
  data.ts           content with real figures: items, jobs, structures, technologies, prey, neighbours
  map.ts            the river valley: grid, river, forest, starting layout
  rules.ts          derived values, validation and advisor warnings (shared by engine and UI)
  sim.ts            one day of village life: work, food, warmth, spoilage, journeys, birth and death
  engine.ts         reducer (state, action) -> state, founding village, save/load
  store.ts, rng.ts  inventory helpers and a seeded RNG
src/ui/           React panels: village, people, stores & crafts, journeys, knowledge, chronicle
  map/              PixiJS isometric village map
src/App.tsx       game loop, speed controls, autosave
```
