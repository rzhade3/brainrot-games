# Pocket Factory

Keep Phaser and keep Factory independent of sibling-game runtime code.

| Responsibility | Owner |
| --- | --- |
| Types, items, catalog, timing and geometry | `game/domain.ts` |
| Seeded terrain, placement, ports and starting layouts | `game/world.ts`, `game/model.ts` |
| Machine state, recipes, capacities, production and transfers | `game/machines.ts` |
| Authoritative state, fixed-step orchestration and inspection | `game/simulation.ts` |
| Residents, jobs, navigation, reservations and food consumption | `game/settlement.ts` |
| Guided orders and optional projects | `game/progression.ts` |
| Save-state validation and conservation | `session/saveState.ts` |
| Save format and IndexedDB conflict protection | `session/persistence.ts` |
| Save queue, revisions and world replacement | `session/session.ts` |
| Atomic conveyor planning, commit and undo | `game/beltRoute.ts` |
| Input, camera, player actions and DOM UI | `FactoryScene.ts`, `hud.ts` |
| Drawing and visual picking | `assets/`, with state adapters in `rendering/art.ts`, `rendering/landscape.ts` |
| Bounded rendering and browser host | `rendering/WorldRenderer.ts`, `rendering/chunks.ts`, `rendering/platform.ts` |

Player actions call the simulation directly; do not add forwarding command or
controller classes. Keep new rules beside existing machine or resident rules.
Headless gameplay modules must not import Phaser, DOM APIs, assets or persistence.
Preserve deterministic tick order, bounded inventories, reservations, recovery and
conservation. Recipes supply production, inspection and save validation.

For a new kind, update `game/domain.ts`, implement its rules in `game/machines.ts` or
`game/settlement.ts`, extend save validation, and add behavior/round-trip checks.
For artwork, see [assets/README.md](assets/README.md). Follow the canonical
field-notebook guide for player-facing copy.

## Running and checking

Use `npm run dev` and `/games/factory/`; build with `npm run build`.
There is no separate Factory build configuration. Independence from sibling games
preserves future extraction without maintaining another deployment today.

- `npm run check:factory`: headless boundaries, session races, inventory,
  construction, production, progression, saves, settlement and replay.
- `npm run check:factory:ui`: native desktop/touch actions, save-resume and
  asset-only changes in both the live game and temporary preview.
- `npm run check:factory:browser`: canvas correctness, dense scenes, long pans,
  bounded caches and frame timings.
- `npm run check:factory:motion`: real cargo/machinery interpolation, pause and
  reduced motion.

Browser checks use isolated Playwright profiles and an installed Chrome.
Override `FACTORY_URL` or `CHROME_PATH` when needed. Record refactor baselines with
`scripts/check-factory-refactor.ts --record <file>` (via `npx tsx`) and
`scripts/check-factory-browser.mjs --record <directory>` (via `node`); repeat with
`--compare` after editing. Saved checkpoints, pixels and cache budgets must match.
Median timing checks allow 15% local noise; run without competing builds.
These checks do not replace physical-phone performance testing.
