# Hearthstead

A village and professions simulation game. Read `docs/design.md` before changing game content or mechanics.

## Design rules (from docs/design.md)

- Grounded: materials, tools and processes follow real physics, chemistry, biology and geology. A technology or
  process only exists when its real prerequisites exist.
- Invented world: places, peoples and history are fictional; Earth history guides plausibility and order only.
- Humans only, no magic or supernatural content until the design says otherwise.
- Gradual technology progression; knowledge is held by people and can be lost.
- Trade and uneven resources shape the economy.

## Code

- `src/game/`: pure, deterministic engine. All state changes go through `reduce(state, action)`; validation
  lives in `rules.ts` and is shared with the UI. Content is data in `data.ts`. No React or DOM here.
- `src/ui/`: React panels. `src/ui/map/`: PixiJS village map.
- `npm test` (Vitest) and `npm run build` (typecheck + build) must pass.
