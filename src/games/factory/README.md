# Pocket Factory

Keep Phaser and keep Factory independent of sibling-game runtime code.

Settlement is the only ruleset and starting layout. New settlement, Resume and an
optional seed share one entry menu. Farming, hauling and industry are available
without mission or project gates; extractor upgrades are optional. Depots
automatically feed connected outputs and otherwise store goods. Saves use
envelope version 4 and `settlement-v5`.
Earlier saves are rejected without migration or writes. Replacement requires
confirmation and activates only after the new save commits.

Woodcutting sites need clear land within four tiles of an accessible tree.
Residents share a labor pool. Each producer and depot has Low / Normal / High
work priority, defaulting to Normal, for both production and outgoing delivery
jobs. Extractors and industry produce automatically; their priority only affects
resident deliveries. Buildings share resident-time with Low / Normal / High
weights of 1 / 2 / 3 within each connected walkable region. Useful production
slots, available stock and destination space cap demand; spare labor is borrowed
by other buildings. Travel and work both count, and new reservations count
immediately. Idle residents favor underserved buildings, then shorter trips.
Inactive buildings do not bank credit. These are soft effort shares, not assigned
headcounts or staffing caps.
One farmer or woodcutter works each site at a time; full buffers and inaccessible
jobs do not hold residents. People shows activity without assignment controls.
Residents finish each harvest or cargo trip before choosing new work; changing
priority never cancels progress or carried goods.
The woodcutter gathers for two seconds, then carries
one wood unit back to the site's four-unit output buffer. Choose a depot under
Deliver to, or connect a conveyor. Trees remain renewable obstacles. Blocking
access or removing a site recovers interrupted cargo without loss.
Priorities, labor credits, gathering progress, reservations and cargo resume exactly.
Wood has no recipe or construction cost yet.

Resident delivery choices and route validation share the production and
inventory acceptance rules in `game/machines.ts`, not a separate compatibility
matrix or list of building kinds. Recipe input/output changes therefore apply
to routing as well as actual carried items. Empty producers can route their
future output; depots deliver matching stock, including stock received later.
Full destinations remain selectable and wait for space.

The Deliver to card opens a searchable destination picker using the same
paper/ink dialog and mobile bottom-sheet styles. Previously
saved incompatible routes remain loadable and are explicitly flagged on the
card so the player can change or stop them without resetting the settlement.

| Responsibility | Owner |
| --- | --- |
| Types, items, catalog, timing and geometry | `game/domain.ts` |
| Seeded terrain, placement, ports and starting layouts | `game/world.ts`, `game/model.ts` |
| Machine state, recipes, capacities, production and transfers | `game/machines.ts` |
| Authoritative state, fixed-step orchestration and inspection | `game/simulation.ts` |
| Residents, jobs, navigation, reservations and food consumption | `game/settlement.ts` |
| Demand-capped weighted labor targets | `game/labor.ts` |
| Bounded grove access search | `game/gathering.ts` |
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
  construction, production, machine options, saves, settlement and replay.
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
