# Pocket Factory

Keep Phaser and keep Factory independent of sibling-game runtime code.

Settlement is the only ruleset and starting layout. New settlement, Resume and an
optional seed share one entry menu. Farming, hauling and industry are available
without mission or project gates; extractor upgrades are optional. Depots
automatically feed connected outputs and otherwise store goods. Saves use
envelope version 4, `settlement-v8`, and settlement state version 7.
Earlier saves are rejected without migration or writes. Replacement requires
confirmation and activates only after the new save commits.

Woodcutting sites need clear land within four tiles of an accessible tree.
Each food plot and woodcutting site has one worker post. Residents keep their post
until its priority changes, the layout changes, or it is removed; they do not
re-choose a site after each harvest. Every building with resident work has
Off / Low / Normal / High priority (Normal by default). Higher-priority sites are
staffed first in stable tile order and may take the worker of a strictly lower
priority site; equal priority never moves a worker. Off frees the worker and stops
resident deliveries from that building. Extractors and industry produce
automatically; their priority only affects resident deliveries.
Residents without a post haul. Free carriers rank deliveries by priority, the
unreserved fullness of the source buffer and kitchen need, minus walking distance,
so nearby work wins among equals and neglected stock rises as it accumulates. Low
waits while plentiful High work remains. A posted worker hauls (its own output
first) only when its site cannot produce and no free resident in the same
walkable region is idle. Meals draw from the best-stocked kitchen.
Workplaces declare worker slots through `workerSlots()` in `game/machines.ts`
(currently one per farm or woodcutting site); assignment fills slots by priority,
so multi-worker processing posts need no new save shape. A full or inaccessible
site lets its worker haul until it can produce again. The homestead's Work row
splits the single labor pool into residents at sites, carrying and free, plus
unstaffed slots; contextual inspection shows activity without assignment controls.
A routed source with stock but no carrier reports "Waiting for a carrier".
Workers enter their plot or tree tile while working, leaving neighboring land
free for construction. Shared resident navigation protects the last clear exit
of an occupied work tile and walks residents out when their work ends. Only the
assigned work tile is enterable; other buildings and trees remain obstacles.
Residents finish each harvest or cargo trip before choosing new work; changing
priority never cancels progress or carried goods.
The woodcutter gathers for two seconds, then carries
one wood unit back to the site's four-unit output buffer. Choose a depot or house under
Deliver to, or connect a conveyor. Trees remain renewable obstacles. Blocking
access or removing a site recovers interrupted cargo without loss.
Priorities, posts, gathering progress, reservations and cargo resume exactly.

Mining sites sit on an iron or copper deposit beside the extractor. Their one
worker digs in place, like a farmer, producing one ore every two seconds into a
four-unit buffer. Hand-dug ore enters the same extraction ledger as extractor
output. Residents carry it, or a conveyor takes it onward. In-place site jobs
keep the saved `farm` job kind, so adding mines needed no new save version.

House sites accept eight physical wood units through residents or conveyors.
The eighth delivery completes a house with one resident place. Wood stays
installed and cannot be delivered again; removing an empty site/house returns
only its actual wood to recovery. Occupied houses cannot be removed.
Invite explicitly from a completed house with connected, clear arrival access.
Readiness requires no missed food in the last thirty simulation seconds and a
combined kitchen reserve of thirty seconds of food for the prospective
population, held continuously for thirty seconds. Any dip restarts the hold, and
the hold restarts after each invitation. A full kitchen counts as proof of
supply; residents keep eating, so the reserve only holds if supply keeps pace.

Each resident consumes one food unit per ten simulation seconds. An integer
resident-time accumulator preserves fractional demand, serves whole units in
deterministic kitchen order, and records shortages without catch-up debt.
Shortages block growth but never disable labor or kill residents. Newcomers join
the existing shared labor pool; their stable IDs, homes, arrival ticks, demand
remainder and bounded provisioning history resume exactly. No planks, food
processing, specialists, or costs for other buildings are part of this slice.

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

Resources replaces the header's People shortcut with an on-demand stock overview.
Totals separate depot stock, building contents, goods in transit and recovery,
and note unreserved routed stock still waiting to be carried;
they are physical goods, not a shared spendable inventory. Resource details show
stock locations, producers, consumers and their current machine or delivery state.
House wood is labeled Construction or Installed, never shared spendable stock.
Choose a location to focus its building or carrier and open the contextual
inspector. Residents remain inspectable on the map and at the homestead.

Each resource row also shows made and used rates per simulation minute and one
verdict (Short, Stuck, Backed up, Idle, Falling, Keeping up, Not in use or
Measuring). `game/flow.ts` samples cumulative production ledgers once per
simulation second over a 20-second window (`FLOW_TICKS`), scaled to per-minute
units (`MINUTE_TICKS`); rates are unsaved and re-measure after loading. Verdicts
come from `inspectResources()`: waiting consumers, full producers and
unstaffed sites are judged from current building state, and drilldowns list
those locations first with one suggested action.

New settlements start with only the food plot, woodcutting site, kitchen, house
and depot. `game/discovery.ts` lists ordered discoveries earned from actual
work: finishing a house reveals the mining site, hand-dug ore the smelter, the
first plate conveyors and splitters, and further plates the extractor. Progress
reads existing ledgers and completed houses, so each item counts once.
Discoveries are permanent and saved; older saves infer them from placed buildings
and recorded work. The assembler stays hidden without a settlement use. The Build
catalog hides undiscovered buildings and shows only the next one with its
condition, and Resources lists only resources the settlement can make or holds.

| Responsibility | Owner |
| --- | --- |
| Types, items, catalog, timing and geometry | `game/domain.ts` |
| Seeded terrain, placement, ports and starting layouts | `game/world.ts`, `game/model.ts` |
| Machine state, recipes, capacities, production and transfers | `game/machines.ts` |
| Authoritative state, fixed-step orchestration and inspection | `game/simulation.ts` |
| Rolling made/used resource rates | `game/flow.ts` |
| Earned building discoveries and their conditions | `game/discovery.ts` |
| Residents, jobs, navigation, reservations and food consumption | `game/settlement.ts` |
| Bounded grove access search | `game/gathering.ts` |
| Save-state validation, error classification and conservation | `session/saveState.ts`, `session/saveErrors.ts` |
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
  construction, housing readiness/growth, scaled provisioning, production, resource flow,
  discoveries, machine options, saves, settlement and replay.
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
