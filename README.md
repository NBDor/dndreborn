# Hearthstead

A browser-based village management game. You are the steward of a small settlement: grow it, keep its people
fed, manage its resources and expenses, craft goods, and post quests for the adventurers who pass through.

## Running

```bash
npm install
npm run dev      # start the dev server
npm test         # engine unit tests
npm run build    # typecheck + production build into dist/
```

Progress is saved automatically to the browser's local storage. Use **↺ New** to start over.

## The village map

The Village tab shows the settlement as a 2.5D isometric island seen from above. Every building has its own plot:
empty plots show a signpost, buildings under construction get scaffolding and a progress bar, and buildings grow
as they level up (more cottages, more crop fields, more market stalls, taller halls). Villagers walk the roads,
idle adventurers gather outside the tavern, smoke rises from chimneys, and the day/night cycle dims the land and
lights the windows. Drag to pan, scroll or use the buttons to zoom, and click a building or plot to manage it.
A list view is still available.

The art is procedural SVG drawn from isometric primitives (`src/ui/map/sprites.tsx`), so it needs no image
files. Each building is one function, so painted sprites can replace them one at a time.

## How it plays

- **Time.** One in-game hour passes every half second at 1× speed (pause, 1×, 2× or 4×). Production, food and
  gold accrue continuously. Population, arrivals and random events happen at the start of each day.
- **Villagers.** They pay taxes and eat food. A new family arrives each day while there is spare housing and
  food. If food runs out, families leave.
- **Workforce.** Production buildings need workers. If jobs outnumber villagers, every building produces less.
- **Expenses.** Each building level (except houses) costs gold upkeep per day.
- **Buildings.** One construction at a time. The Town Hall caps every other building's level, and raising it
  needs reputation. Higher tiers need planks and then tools.
- **Crafting.** The Workshop, Smithy, Apothecary and Tavern turn raw resources into materials, quest supplies
  (rations, potions) and gear (swords, armor).
- **Adventurers.** They show up at the tavern, stay a few days and work for a fee. Five classes, each with a perk.
  They level up from successful quests and charge more as they do.
- **Quests.** Choose a quest from the board, pick a party and attach supplies. Success depends on party power
  against quest difficulty. Success brings loot and reputation; failure can injure or kill adventurers and
  lose gear. Reputation unlocks harder quests and Town Hall upgrades.
- **Market.** Buy and sell any item once you have a Market. Higher levels give better prices.

## Code layout

```
src/game/   pure game logic, no React
  types.ts    state and action types
  data.ts     content: items, buildings, recipes, quests, classes
  rules.ts    derived values and validation (shared by engine and UI)
  engine.ts   reducer (state, action) -> state, tick simulation, save/load
  rng.ts      seeded RNG; the seed lives in state, so runs are reproducible
src/ui/     React panels (village, crafting, tavern & quests, market, chronicle)
  map/        isometric village map: projection, plot layout, sprites, pan/zoom
src/App.tsx game loop, speed controls, autosave
```

Adding content is mostly data: new items, buildings, recipes or quests go in `src/game/data.ts`.
