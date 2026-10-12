# Pocket Factory implementation plan

Status: milestones 1-6 and the replacement settlement milestone 7 are implemented
on `feat/pocket-factory`.
The earlier milestone 7 project experiment has been removed and superseded
by the inhabited-settlement direction specified below. The visual direction
is approved. The seeded 256x256 world, chunked rendering, and seed-aware saves
are functional, with distinct biome artwork and cohesive ground transitions.
An approved pre-weather logistics extension adds splitters, clearer conveyor
merge junctions, and anchored conveyor connections.
The replacement milestone 7 combines people, useful hauling, and a complete
raw-food supply chain. Settlement is now the only ruleset and starting layout,
with matching isometric artwork. Guided Run, Free Play, their delivery missions,
outposts, and project gates have been removed. Farming, hauling, conveyors and
existing production machines remain available; extractor upgrades and depot
output are optional settings without unlock requirements. The entry menu offers
New settlement, Resume and an optional seed. Save version 3 / `settlement-v2`
rejects all earlier formats without migration or overwriting them. Explicit
replacement confirmation and a successful local save precede activation.
Milestone 8 is the next major priority: worker assignments, resident-run mining
and industry, then tools and combined components that earn the first automated
extractor. An implemented early housing slice brings wood-funded houses and
population-scaled raw-food provisioning forward, before timber processing and
the full extractor-kit chain; its implementation plan is below. Milestone 9
retains food processing and later housing refinements;
milestone 10 adds specialist invitations and production-based discoveries.
Milestone 11 develops intersecting resource branches. These features are planned,
not implemented; this roadmap update does not itself implement gameplay.
First-time-player pacing and physical-device performance remain unverified.
General construction costs and deeper logistics follow separate gates. Power,
defense, and underground excavation are conditional extensions, not numbered milestones.
This is an exploratory prototype: future milestones may replace terrain,
generator, and save formats without backward compatibility or migration work.
Breaking revisions may require a fresh settlement; communicate that explicitly.

Historical milestone notes below describe the implementation sequence, not
alternate playable modes. Any references to retained legacy factories, guided
orders, project rewards or older save compatibility are superseded by this
single-Settlement consolidation.

## Goal

Player-facing writing follows the
[field-notebook guide](.github/instructions/factory.instructions.md).
It defines the voice and implemented content hierarchy for the catalog,
inspectors, help, and feedback. The notebook is a presentation language, not a
separate information channel.

Develop a standalone, mobile-first inhabited logistics/base-building game in
Brainrot Games. Players provision a small community, arrange physical supply
chains, and use automation to free residents for useful work. Begin with food;
industry later improves farming, transport, and construction instead of making
plates for a disconnected quota. Retain the inviting, finite 256x256 procedural
world and distinct landscape regions. Keep starter resources close so exploration
is optional, not a prerequisite for production. Preserve the calm,
clean-isometric visual direction and offline play after resources finish caching.

## Gameplay direction

The milestone 2 sandbox provided the automation foundation but lacked demand,
interdependent recipes, and a completion moment. Milestone 3 now adds a bounded
guided run: build copper production, unlock mixed-metal assembly, and supply an
outpost. Free Play starts with an empty site and all machines unlocked.
Milestone 4 preserves investment through local autosave and resume. Milestone 5
expands the site into a seeded, explorable world while keeping starter production
local. Milestone 6 adds fuller meadows, wooded riverbanks, and rugged upland art.
The optional-project experiment did not provide the desired connection to the
core loop: delivery quotas and rewards still left the factory without everyday
consumers. The revised direction gives production a visible purpose through
people who produce, carry, and consume goods. This is a design hypothesis, not
proof of engagement or differentiation from other settlement games.
Environmental polish cannot substitute for a useful gameplay loop.

Near-term arc:

Food plot -> assign farming, mining, and hauling -> provision residents ->
make tools and components -> automate a mining site -> reassign released labor ->
process food more efficiently -> invite people -> develop new production branches.

Industrial progression:

Operate resident-run production -> encounter a labor or material bottleneck ->
combine resources into tools and equipment -> earn useful automation ->
prepare housing and provisioning -> invite someone with new knowledge ->
combine their production branches -> improve the settlement.
Residents are participants, not animated scenery or arbitrary resource drains.
Routine farming, hauling, processing, and eating run automatically once assigned.

Conditional earned-construction experiment:

Receive a viable starter kit -> produce plates -> invest in another machine ->
expand capacity. Harvestable wood and later power must each add a distinct
decision, rather than another counter or a reason to wait.

Possible later arc, subject to a separate defense gate:

Extract -> automate -> fulfill a useful demand -> unlock a capability ->
prepare defenses -> survive an announced raid -> improve the factory.

Production must remain the player's main way to solve problems. Combat supplies
pressure and an ongoing material sink, rather than replacing automation with
aiming, unit commands, or repeated reconstruction. Borrow the relationship
between production and protection, not another game's assets or full feature set.

### Guided arc and deferred defense extension

1. Keep one working iron demonstration line, then guide the player to build copper
   production and deliver 16 copper plates. Avoid starting with both challenges solved.
2. Unlock one assembler recipe combining two iron plates and one copper plate into
   a defense supply, then deliver 12 supplies to complete factory preparation.
   Make the second resource necessary, not a repetition with different artwork.
Steps 1-2 are implemented. Steps 3-5 are deferred proposals, not the next milestone:

3. Deliver supplies to the outpost, deploy a simple automated defense, and route
   ongoing replenishment to it. Preparation competes with progression for output.
4. Let the player explicitly start the first raid when ready. Announce subsequent
   raids with visible countdowns and a clear material/readiness forecast.
5. Survive three raids for a visible completion moment, then choose free play
   or another challenge. Do not silently turn completion into endless attacks.

The current premise is building a small, peaceful community. Protecting an
outpost remains a possible later scenario, not the opening narrative or a
requirement of the settlement loop.

### Design guardrails

- Begin with a short, complete food supply chain and residents doing useful work.
  Target pacing through internal walkthroughs, not recipe-count extrapolation.
- Food units are physical cargo. Nutrition measures their consumption value,
  not electricity, a global spendable currency, or another manual inventory.
- Raw food must feed residents before processing exists. Shortages halt growth
  without killing residents or disabling workers needed to restore supply.
- Show local inventories, delivered throughput, missing inputs, and job/blockage
  reasons. A backed-up extractor can reflect a slower downstream
  machine, not necessarily a player error.
- Basic construction remains free through milestones 8-11. Milestone 8 tests
  physical commissioning of one extractor using a produced equipment kit, not
  general building costs. Milestone 12 may test broader paid construction only
  behind its own gate. The approved early housing slice is the sole exception:
  new house sites require eight physically delivered wood. Do not silently
  charge other existing buildings or combine
  costs, wood, and energy into one unmeasurable change.
- Add simple recovery-to-depot relocation in milestone 3. Make stored/recovered
  supplies available to production before combat spending becomes important;
  relocation into a storage-only depot is not automated replenishment.
- Persist progress before introducing a longer run or meaningful failure.
- Start with one defended outpost, one enemy type, one fixed approach, and one
  automatically firing defense. Preserve the factory after defeat; offer a
  coherent pre-raid retry rather than tedious rebuilding.
- Raids and countdowns follow simulation time: pause, suspension, and backgrounding
  stop them. No attacks or production occur while the app is closed.
- Keep peaceful building available. Retire expansion-project gating from the
  new settlement ruleset; discoveries recognize production or successful use
  without consuming an extra quota. Residents consume food because they live
  there, not as a disguised research fee. No harvest clicks or mandatory refills.
- Keep initial weather atmospheric: no machine shutdowns, production penalties,
  flooded construction, resource depletion, or weather-management UI.
- Procedural variation must preserve reachable resources and usable building
  space. Validate the site instead of trusting attractive noise patterns.
- New worker-first Settlement worlds begin without automated extractors.
  Set building work priorities; a shared labor pool handles production and
  hauling. Automation releases production labor rather than merely changing
  artwork. Settlement remains the only mode; do not restore removed legacy modes.
- Founders can establish every prerequisite for the first extractor without a
  specialist arrival. Later newcomers teach permanent knowledge; any resident
  can operate an established workplace. Invitations are explicit and optional,
  with housing and reliable food for the prospective population.
- Separate biome identity, ground/buildability, deposits, and decoration.
  Do not make every wooded tile unbuildable or every upland tile an obstacle.

## Agreed visual direction

Clean isometric: dimensional buildings, a restrained palette, and polished UI.
Do not inherit the existing games' neon-purple grid or emoji buildings.
Reuse useful engine and simulation patterns, not their visual language.
Use original artwork.

- Muted greens, sandy earth, blue-gray water, and subtly textured terrain.
- Industrial machines with clear silhouettes, soft shadows, and readable ports.
- Visible belt items and restrained animations that communicate activity.
- Neutral UI surfaces with amber and teal accents for selection and status.
- Compact construction toolbar and contextual machine inspector.
- A subtle grid during construction, rather than permanent tile outlines.

Keep the logical world on a square tile grid. Project that grid isometrically
for rendering; account for depth sorting, tile picking, and building occlusion.

### Asset boundary: art without application changes

Implemented by the architecture refactor. Preserve the current procedural artwork,
muted isometric style, gameplay, saves, and mouse/touch behavior. The goal is that
an art agent can redesign an existing building, including its clickable silhouette,
by editing only the assets folder, without changing gameplay or scene code.

The implementation has four pieces, not a general asset framework:

1. **Assets folder:** `src/games/factory/assets/` owns drawing definitions,
   palette, anchors, bounds, and visual selection shapes. Existing drawing code
   is a suitable starting point; conversion to SVG files is optional.
2. **One rendering interface:** accept simple visual state such as facing,
   activity, progress, variant, and cargo. Do not pass live simulation objects
   or the world to asset definitions. The application maps game state to this
   interface; artwork-specific drawing and moving-part details stay with assets.
3. **One render-scale setting:** live drawing and necessary caches derive their
   resolution from the same policy. Avoid independent quality constants in
   terrain, props, and individual assets. Keep caches bounded and do not rebuild
   them on every small zoom movement.
4. **A small preview page:** review assets and their orientations, activities,
   anchors, and selection shapes without a running settlement or a particular
   save. Reuse the game's drawing interface rather than duplicating artwork.

Visual picking belongs with the asset shape, not hard-coded building silhouettes
in `model.ts`. Tile occupancy, buildability, transport ports, recipes, job
assignment, and saves remain gameplay concerns. Changing a roof or selection
outline must not change the physical footprint. Adding new mechanics or an
unsupported semantic state still requires engineering work.

Defer a general SVG interpreter, declarative animation language, interchangeable
rendering backends, and elaborate quality-tier machinery. The first refactor
should remain close to the existing drawing code. SVG source files alone do not
remove raster-cache costs or establish a rendering abstraction.

Acceptance: demonstrate a building redesign and selection-outline change confined
to the assets folder, visible in both preview and game. Preserve depth ordering,
footprint/roof selection, cargo alignment, and reduced motion on desktop and
touch layouts. Confirm that simulation snapshots and save formats are unchanged.
Measure clarity, frame time, panning, and cache growth before claiming a rendering
performance improvement. Add a short asset-authoring note alongside the assets
when the boundary is implemented.

Implementation and authoring paths are documented in
`src/games/factory/README.md` and `src/games/factory/assets/README.md`.
The preview and live game use the same asset definitions; browser checks demonstrate
an asset-only roof/selection-outline edit without changing simulation saves.
The refactor keeps Phaser and introduces no milestone features or art redesign.
Keep the asset preview only while artwork is actively changing; remove its page,
build entry and preview-specific checks once the artwork stabilizes. There is no
separate Factory build configuration; the game remains independent of sibling
runtime code for eventual extraction.

## Proposed first-release scope

This table describes the revised near-term target, not shipped behavior.
Milestones 1-6 and replacement milestone 7 are implemented, including the seeded
world, biome art, and raw-food settlement. The old project direction and legacy
modes have been removed. Later milestones require separate approval.
Worker-run production and the first earned extractor precede food processing,
specialist growth, broader construction costs, and richer logistics.

| Area | Scope |
| --- | --- |
| World | Finite, seeded 256x256 tiles (65,536 total), organized into 32x32-tile chunks |
| Terrain | Meadow, wooded riverbank, rocky upland; accessible iron/copper and connected building space |
| Environment | Gentle clear/cloudy/rain transitions, restrained water/vegetation motion; atmospheric only |
| Buildings | Settlement home, plots and kitchen; next mining/woodcutting sites, timber processing, workshop, and earned extractor; later food processing and transport |
| People | Workplace assignments, automatic work/hauling, and optional specialist invitations; useful labor rather than individual schedules |
| Production | Raw food and resident-run ore/wood first; planks, tools, gears, and frames combine into equipment; later food and building-material branches |
| Demand | Resident provisioning and optional population growth; no legacy factory missions |
| Combat | Deferred; peaceful building remains the near-term focus |
| Progression | Permanent discoveries from actual production/use; newcomers bring knowledge after explicit housing/provisioning readiness; no research receiver |
| Failure | Food shortages pause growth without starvation deaths or labor softlocks; no environmental/combat failure |
| Construction | Basic construction initially free; milestone 8 commissions an extractor kit physically; milestone 12 separately tests broader material-funded construction |
| Wood | Deferred, separately tested harvesting with a concrete use; not decorative inventory |
| Power | Deferred until a validated peaceful expansion loop needs a generation/demand constraint |
| Input | Mouse and touch placement, rotation, removal, pan, and zoom |
| Saves | Versioned local autosave, resume, and new world with optional seed |
| Offline | Cached launch, gameplay, and save/resume without a network |

Defer free-roaming attacks, general enemy pathfinding, damage to individual
production buildings, manual combat, multiple weapon/enemy trees, pollution-based
aggression, trains, fluids, multiplayer, infinite worlds, filtered/priority splitters,
underground belts, separate inserters, and production while the app is closed.
Build the large-world rendering foundation before adding biome detail or weather.
Map size does not expand the initial biome, recipe, or enemy feature list. The
existing defense proposal remains documented below, but is not a first-release
commitment. People, food, discoveries, power/fuel, wood, paid construction, and
underground resource discovery are not approved implementation or shipped behavior.

## Milestone 1: Visual and interaction prototype

This is the first implementation milestone. Stop here for visual approval
before building the production simulation or large procedural world.

### Deliverables

- A dedicated game page and hub entry, integrated into the Vite build.
- A small representative isometric scene, not the full 256x256 world.
- Original terrain and dimensional miner, furnace, and belt artwork.
- Animated demonstration items traveling along a belt.
- A polished phone-sized HUD, construction toolbar, and machine inspector.
- Placement preview, rotation, removal, selection, pan, zoom, and camera reset.
- Clearly labeled prototype/demo state; no fabricated live production metrics.

### Implementation approach

Use Phaser and the shared game initialization where suitable, but give the game
its own styles, palette, and rendering code. Keep logical tile coordinates
separate from projected screen positions. Reuse existing placement patterns
only where they fit; do not change Tower Defense behavior.

The scene may use scripted animations. Real recipe processing, resource
accounting, progression, persistence, and world generation are later milestones.

### Acceptance criteria

- The scene establishes the agreed clean-isometric art direction without
  emoji structures or the existing neon visual treatment.
- The miner, furnace, belts, and moving items are distinguishable at phone size.
- Construction previews identify the target tile and valid/invalid placement.
- Selection, rotation, and removal work with both mouse and touch.
- Panning and zooming do not accidentally place or remove buildings.
- Buildings draw in the correct depth order; selection remains usable when
  artwork overlaps neighboring tiles.
- The toolbar and inspector fit narrow screens and remain usable after resize
  or orientation changes.
- The production build includes the new page and its resources in the PWA cache.
- Document what is demonstrated versus actually simulated.

### Approval gate

Review desktop and phone-sized views plus interactions before continuing.
Do not treat a static screenshot alone as completion. Revise the prototype if
the appearance or touch usability does not meet the direction above.

### Construction navigation refinement

The permanent dock contains only Select and Build, independent of the
number of building types. Build opens a scrollable catalog with All, Production,
Logistics, and Storage categories. Add future machines to the catalog metadata
rather than allocating more permanent dock buttons.

Opening the catalog exits placement/selection; choosing a machine closes it and
activates placement. A contextual strip shows the chosen machine and output
direction, with rotation and cancel controls. Selected machines expose Rotate
and Remove in their inspector rather than the dock. Remove dismantles only the
selected building and recovers its items, then returns to selection. There is no
global demolition mode or removal keyboard shortcut.

Escape, the close button, or an outside tap dismisses the catalog without acting
on the world. Category tabs support arrow/Home/End navigation, and existing
numeric building shortcuts remain available. Browser modifier shortcuts and text
entry are not intercepted as game actions.

### Responsive layout

The canvas fills the viewport. Desktop layouts use a fluid construction workbench
up to 1040 px wide, with a compact Select / Build / Pause dock, a
three- or four-column catalog, wider inspectors, and side-by-side scenario cards.
Tablets use a wider catalog and a bottom-sheet inspector. Phones retain stacked
scenario choices, a two-column catalog, and compact touch controls.

Catalog height is bounded by the actual header and control area, including
wrapped status text and safe-area spacing. Inspectors and guidance remain
scrollable on short screens. Guidance collapses when entering a compact layout
or using its camera shortcuts, keeping the target area usable. Resizing does
not reset the factory, selected machine, camera position, or player-chosen zoom.
Phone and short-screen Home views start at 100% zoom (76 x 38 CSS-pixel tiles)
and frame the starter area between the header and bottom controls. Pinch zoom
remains available for an overview; wide desktop views retain their larger scale.

The default HUD prioritizes the map, current mission, and construction controls.
Mission guidance, machine descriptions, and detailed save/offline information
use expandable panels. There is no global depot-stock or recovery panel;
each depot's inspector shows its own contents and capacity, with a secondary
recovered-items section only when recovered cargo exists. Save status, offline readiness,
and the current world seed live under **Scenarios → Save & offline**, not in a
routine bottom badge. Successful action feedback
clears after 4.5 seconds; invalid placement feedback remains until the next
action. Save failures show an on-map warning with a retry action when safe;
their full message also expands inside Scenarios.
The small "AN AUTOMATION STUDY" brand label and Free Play's desktop-only
"A little industry. A lot of possibility." headline retain the field-notebook
character without adding instructions. Compact layouts omit the headline to
leave room for the map. The duplicate live badge, repeated footer hints, and
long always-visible guidance remain removed.

### Field-notebook copy and contextual information

Build cards show the existing building name, icon, shortcut, and one short
purpose line, or an unlock condition when unavailable. Recipes, pace, and
capacity are not catalog descriptions: they belong in the selected building's
inspector, alongside activity, contents, direction, and relevant controls.
Extractor placement calls out the deposit requirement. Source inspectors use
**Deliver to** for resident hauling; static access and conveyor rules live under
collapsed **Field notes**, not in an always-visible paragraph.

The homestead shows its resident count and each person's current activity.
Resident details use factual, contextual language such as "Taking food to the
kitchen", with destination and carried items available on selection. The fake
full population meter and lifetime food counters are removed from the UI.
Food shortages appear in the selected kitchen's activity; shortages do not stop
work. Non-obvious rules remain available in collapsed help, including
legacy project unlocks, splitter fallback, and depot recovery behavior.

Personality comes from existing contextual language, residents, illustration,
and animation, not a new margins sidebar, notebook feed, event log, or unsolicited
harvest commentary. Keep necessary warnings explicit. The map remains the focus.

## Milestone 2: Deterministic simulation and a complete production chain

Build a simulation independent of rendering, initially on a small test map.
Use a fixed timestep, integer item counts, bounded machine inventories, and
explicit input/output rules.

Implement:

Iron deposit -> miner -> directional belts -> furnace -> plates -> storage.

Machines stop when inputs are missing or outputs are full. Belts back up rather
than discard items. Define transfer ordering so results do not depend on the
order in which buildings were placed. Off-screen factories keep producing.

Acceptance:

- Repeatable simulation results for identical initial states and inputs.
- Item conservation across movement and crafting, including blocked outputs.
- Correct belt turns, congestion, reconnection, placement, and removal.
- An explicit policy for items inside removed buildings and belts.
- Automated tests for production and transport edge cases.

### Implemented simulation contract

- The simulation is independent of Phaser and advances in fixed 100 ms ticks.
- Extractors produce one ore per second from unlimited study-site deposits.
- Both existing iron and copper lines process one ore into one matching plate
  in 1.6 seconds. Mixed inputs alternate materials when both are available.
  This milestone does not add advanced recipes. Milestone 3 adds the single
  mixed-metal defense-supply recipe; further component crafting remains deferred.
- Extractor outputs and smelter input/output buffers hold four items each.
  Each conveyor holds one item; each depot holds 64 total items.
- Conveyors take 0.8 seconds to traverse a tile. Transfers reserve destinations
  from a snapshot after production; a slot occupied at that point cannot receive
  another item merely because its occupant leaves later in the same tick.
- Building arrows determine output direction. Conveyors accept items from their
  rear and sides, not their front. Smelters accept ore from any adjacent output;
  depots accept any item from an adjacent output. Extractors accept no items.
- Transfer order is independent of construction order. Competing eligible
  sources use deterministic round-robin arbitration.
- Missing, incompatible, and full outputs retain items and stall the line.
  No item can travel multiple tiles in one tick.
- Rotation preserves inventories, traveling items, and cycle progress.
- Removal transfers all contained items into a visible session-local recovery
  tray, including conveyor cargo and ore in an unfinished recipe. Partial work
  is discarded, but the ore is not consumed until the recipe finishes.
  Milestone 3 adds relocation into selected depots; depots remain storage-only.
  Feeding recovered stock back into production is deferred. Free construction
  needs no materials.
- Factory pause freezes production. Reduced motion suppresses continuous
  animation without disabling production. Camera position does not affect
  simulation; a hidden app pauses and does not fast-forward on resume.
- Construction is free. Reloading resets the study site and all inventories.
  Power, fuel, saves, and world generation are not implemented. Milestone 3's
  guided objectives and assembler contract extend this simulation below.

## Milestone 3: Purposeful production loop on the small map

This milestone is implemented. Its deliverable is a complete, session-only
production introduction, not combat or the entire first-release loop.
The numeric contracts below are initial implementation defaults. Tune them only
after playtesting, and update this specification and its tests together.

### Scenario and starting state

- Offer Guided Run and Free Play as explicit choices. Free Play uses the same
  22x22 terrain but starts without any buildings or inventories: no production
  lines, depots, or outpost. All five buildable machines are unlocked, with no
  objectives or attacks.
- Guided Run uses the same terrain and only the existing iron demonstration chain,
  ending at its depot. Leave the copper deposit unbuilt and start inventories empty.
  Iron stored in the demonstration depot does not count as an order delivery.
- Place one fixed outpost/order receiver at tile `(16, 12)`, leaving adjacent
  approach tiles buildable. It occupies its tile and is inspectable, but cannot
  be removed or rotated. Camera home and guidance must keep it easy to find.
- Production construction remains free. Extractors, smelters, conveyors, and depots
  are available immediately. The assembler is locked until the first order completes;
  enforce the lock in placement logic as well as the catalog and keyboard shortcuts.
  Free Play has the assembler available from the start but no order receiver.
- Changing scenarios or restarting discards the current session only after a clear
  confirmation. Explain that reload still resets progress until milestone 4.

### Objective sequence and rewards

| Stage | Required delivery | Result |
| --- | --- | --- |
| Copper commissioning | 16 copper plates | Unlock the assembler once; activate the next order |
| Factory preparation | 12 defense supplies | Mark the run complete once; offer continued building or scenario selection |

The first objective teaches the player to build a copper extraction/smelting line
and connect it to the receiver. The second teaches combining two resources and
rerouting the demonstration iron output into assembly. Guidance should point to
the deposit, output arrows, destination, and missing connections without building
the solution automatically.

Show the active order, accepted count, and next reward. On completion display
"Factory preparation complete" and explain that raids belong to a later milestone.
Continued building keeps the factory and assembler unlock but creates no new orders
or attacks. No throughput threshold is required to complete these two orders.

### Assembler contract

| Property | Initial rule |
| --- | --- |
| Recipe | 2 iron plates + 1 copper plate -> 1 defense supply |
| Cycle | 2 seconds / 20 simulation ticks |
| Input capacity | 4 iron plates and 4 copper plates, separately capped |
| Output capacity | 4 defense supplies |
| Input ports | Any adjacent building whose output points into the assembler |
| Output port | One adjacent destination in the assembler's arrow direction |

Accept only the two plate types; per-ingredient limits prevent one material from
occupying the entire input buffer and starving the other. Start work only when
the full recipe is present and the output has capacity. Inputs remain accounted
for in the input buffer until the cycle completes, then consume exactly the
recipe and create one supply. Blocked output freezes work without consuming items.
Rotation retains inventory and progress; removal recovers all retained inputs
and finished supplies while discarding only partial work.

Depots can store defense supplies within their existing 64-item total capacity.
Assembler transfers use the existing snapshot reservations and deterministic
arbitration; items cannot hop multiple tiles in one tick. Keep the existing
extractor, smelter, and conveyor rates unchanged.

### Receiver and delivery accounting

- Only items physically transferred from an adjacent output into the receiver
  count. Depot stock, recovery transfers, mined totals, and crafted totals do not.
- The receiver accepts only the active order's item type and only its remaining
  quantity. There is no generic input buffer or inventory to withdraw.
- Accepted items are commissioning costs: remove them from transport and record
  them in an explicit delivered/consumed ledger. They are not spendable inventory.
  Later defense deployment requires newly produced supplies, not these items again.
- Reserve against the remaining order quantity before applying the transfer batch.
  Multiple incoming sources cannot overshoot the order in the same tick.
- Complete the order and activate its successor after that batch finishes.
  Do not use the new order to admit extra items in the old order's transfer batch.
- Wrong items, excess items, and all items after final completion remain upstream.
  Their status explains the receiver's active requirement or completed state.
- Derive unlocks and completion from objective state; repeated refreshes, callbacks,
  and future save restoration cannot grant the result again.

### Recovery interaction

In a selected depot's inspector, show a collapsed "Recovered items" section
only when cargo has been recovered. Include the item breakdown, explain that
removing buildings or undoing routes preserves those items, and provide one
"Store N items here" action showing the amount that fits in this depot.
Transfer up to its remaining total capacity, in a stable item order: iron ore,
copper ore, iron plates, copper plates, then defense supplies. Move the source
and destination quantities atomically; leave any overflow in the tray.

Hide the section when recovery is empty. Disable the action when the depot is
full, with an explicit reason. Report what moved and what remains. No global
stock panel, recovery modal, drag-and-drop inventory screen,
receiver deposit shortcut, or manual assembler loading is included.

Depots remain storage-only in this milestone. This action safely relocates
recovered stock; it does not feed a belt or fulfill an order. An explicit path
back into automated production is a deferred defense prerequisite, not a hidden
promise that storage now has output ports.

### Feedback and measurement

- Show objective progress and missing ingredients in the HUD/inspector. Distinguish
  disconnection, wrong input, full destination, and ordinary rate mismatch.
- Display accepted deliveries per simulation minute over the last 30 seconds of
  the active order. During the first 30 seconds, divide by elapsed simulation
  time since that order started; at zero elapsed time display zero.
- Reset the measurement at each order transition so copper and defense supplies
  never share one rate. Label the item and measurement window. Pause/suspension
  freeze the window; completing the final order freezes a labeled final rate.
- Use the rate as diagnostic feedback, not an objective gate or a fabricated
  countdown. A single iron smelter can limit the assembler's two-iron recipe;
  guidance should explain that without treating every backed-up extractor as broken.

### Acceptance and stopping criterion

- Automated scenario tests verify the empty Free Play start, validate the guided
  starting layout, and cover assembler locks through UI and placement entry points.
- Recipe tests cover absent ingredients, per-ingredient capacity, the exact
  20-tick cycle, full output, rotation, removal, and explicit material accounting
  across crafting. Count consumed ingredients and produced supplies separately.
- Receiver tests cover wrong input, competing sources at the final quota,
  objective transitions, final completion, and one-time unlocks/results.
- Recovery tests cover empty/full depots, partial transfer, stable item order,
  repeated actions, and source/destination conservation.
- Rate tests cover startup, the 30-second window, phase reset, pause/suspension,
  and completion. Values must reflect accepted deliveries only.
- Native mouse/touch checks cover the guided flow, locked/unlocked catalog,
  depot recovery action, completion, continued building, and scenario confirmation.
- A first-time player can build, deliver, unlock, combine, and finish without
  external help. Playtest the proposed 5-10-minute introduction and record time
  spent building versus waiting; do not inflate quotas just to hit a duration.
- Stop when this bounded loop works and is understandable. Persistence, enemies,
  defenses, power, additional recipes, and world generation are not part of this gate.

### Implementation and validation status

- Guided Run and Free Play choices, scenario-reset confirmation, fixed outpost,
  two delivery orders, assembler unlock/recipe, consumed-delivery ledger, and
  completion/continued building are implemented.
- Inventory and recovery live inside the guided objective's scrollable guidance
  panel to keep the small-screen map usable. Camera shortcuts find copper, iron,
  and the outpost; guidance explains direction, delivery, and the iron bottleneck.
- Recovery-to-depot relocation, per-ingredient buffers, actual trailing delivery
  rate, order-transition reset, and frozen completion rate follow the contracts above.
- Automated checks cover complete real-production runs, quotas and transfer-batch
  transitions, material accounting, buffer limits, recipe tick boundaries,
  rotation/removal, recovery overflow, scenario locks, and rate/timing behavior.
- Native browser mouse and emulated touch runs complete both orders, relocate
  recovered items, and cancel/confirm scenario resets. Narrow portrait/landscape
  layouts, reduced-motion production, and fresh-cache offline controls also pass.
- These are browser automation checks, not a first-time-player study or physical
  phone validation. The proposed 5-10-minute pacing target remains unverified.

## Milestone 4: Reliable persistence and offline readiness

This milestone is implemented. One local IndexedDB slot stores a versioned
envelope with scenario/recipe contract and map-generator versions. Milestone 5
updates that envelope to save schema 2 with the seed and 256x256 world identity;
old study-site saves are explicitly unsupported, not migrated. Terrain changes
are an empty list in the current immutable world. Unlocks and
completion are derived from the persisted objective stage and consumed ledger,
not reapplied as load-time rewards.

The full state includes machine inputs/outputs, belt cargo and entry direction,
in-progress recipes, recovery and material ledgers, transfer arbitration history,
fixed-step remainder, objective timestamps/rate history, and pause state.
Restoration checks versions, placements, capacities, recipes, objective
consistency, and material conservation before accepting a save.

Autosave runs every five seconds and after important actions and objective
transitions. Hidden/page-exit events also attempt a save. A single transaction
updates the active slot and retains the preceding validated save in a previous
slot; a failed transaction leaves both unchanged. Compare-before-write rejects
another tab's changes rather than overwriting them. The previous slot is an
internal safety copy, not a user-facing backup/recovery feature.

The chooser offers resume, and requires confirmation before replacing an
existing or unreadable save. Replacement is committed before the new factory
opens. Unsupported/corrupt saves stay untouched until explicitly replaced.
Storage failures remain visible with retry; unreadable storage blocks starting
a new factory until loading succeeds. Offline readiness reflects the production
service worker's completed precache; development builds report that offline
caching is unavailable. No elapsed wall-clock production is applied.

Saves are local to this browser/device. Browser data deletion can erase them;
sudden termination can lose work since the last committed autosave. Physical
device suspension/relaunch checks remain a release follow-up.

Save the small-map production run before expanding its length or adding raids.
Use IndexedDB for versioned saves containing the scenario/map identity, terrain
changes, buildings, inventories, recovery contents, objectives, unlocks, and
simulation state. Record versions so incompatible prototype saves are recognizable;
future migrations are not required during this exploratory phase.
Persist milestone 3's scenario choice, assembler unlock, active order and consumed
delivery ledger, completion state, and recovery-to-depot results. Version the
scenario/recipe contract so later tuning does not silently reinterpret old runs.

Autosave periodically and after important actions. Use atomic writes, preserve
the previous valid save when a write fails, and surface storage errors. Confirm
before replacing an existing world. Restore in-progress recipes and objective
state without granting rewards again.

Pause simulation when the app is suspended; do not apply elapsed wall-clock
time as a large catch-up tick on resume. Defer offline-time production.
Expose offline readiness after the PWA has successfully cached its resources.

Acceptance:

- Save/load round trips preserve the complete production and progression state.
- Unsupported or corrupt saves fail visibly without overwriting good data.
- Reload, app suspension, and resume do not duplicate items or rewards or advance
  time unexpectedly.
- An already-cached installation launches and resumes in airplane mode.
- Failed writes are surfaced and cannot be mistaken for a successful save.

Validation: automated state round trips complete the entire guided production
loop with restoration after every frame, including partial recipes, belt
transfers, recovery relocation, objective transitions, and frozen completion.
Native IndexedDB browser checks cover transaction rollback, retention of the
previous valid save, and competing-tab writes. Browser UI checks cover visible
save failures/retry, failed replacement, unavailable storage, unsupported/corrupt
saves, and portrait/short-landscape controls with errors displayed. A touch-built
Free Play factory launches in a fresh cached offline page, resumes paused without
catch-up, produces and autosaves offline, and survives another offline reload.

## Milestone 5: Seeded 256x256 world and chunked rendering

Implemented. Physical-phone performance acceptance remains open; desktop and
mobile-emulated checks are not a substitute for an agreed reference device.

Replace the 22x22 study site with a finite 256x256 world, organized into 32x32-tile
chunks: 8x8 chunks, 64 total. Keep production recipes and objective rules unchanged.
This milestone owns generation, world data, rendering scalability, and navigation;
polished biome art follows in milestone 6; weather is now deferred to milestone 14.

Use authored starter composition with seeded procedural variation:
a connected meadow building area, a winding river/wooded bank, and rocky upland.
Guarantee all three landscape regions, with shapes and positions varying by seed.
They are parts of one continuous world, not numbered levels. Keep starter iron,
copper, and guided delivery routes within a compact local area. More land should
offer exploration and future siting choices, not longer mandatory starter journeys.

### Generation and world data

- Generate broad, coherent regions from low-frequency elevation and moisture
  fields. Avoid independent random biome choices per tile. Establish biome data
  and basic differentiated colors now; detailed boundary blending/art comes next.
- Keep biome, ground/buildability, resource deposits, and decoration separate.
  Elevation is a classification/visual input initially, not raised building
  surfaces, slopes, or new conveyor mechanics.
- Use a pure generator keyed by seed, map size, and generator version. Derive
  local variation from world coordinates and stable seeds, not rendering order
  or a shared random stream advanced by camera traversal.
- Rendering, placement, and simulation read the same world data. Replace
  hard-coded terrain assumptions consistently; camera guidance finds actual
  deposits/outpost positions rather than assuming old coordinates.
- Reserve a clear starting area and reachable iron/copper with enough connected
  buildable land for the guided production routes. Validate and deterministically
  repair failed constraints; use bounded generation, not an unbounded retry loop.

### Rendering, simulation, and navigation

- Render only chunks intersecting the camera view, with bounded padding for
  isometric overhangs, tall trees, and buildings. Keep depth ordering and picking
  correct across chunk boundaries; avoid seams or pop-in at the viewport edge.
- Bake/reuse static ground textures and reusable art assets. Do not allocate
  individual live graphics objects for every tile or a giant full-world graphics
  surface. Bound resident chunk textures/objects and release or reuse off-screen
  render resources as the camera moves.
- Keep persistent world/building state independent of render residency. Simulate
  placed machines and active production, not every empty terrain tile. Off-screen
  factories keep producing; decorative motion is visible-area work only.
- Generate chunk contents from absolute coordinates so traversal order never
  changes the world. Rendering/texture construction must not block input during
  long pans; measure startup and chunk-entry stalls as well as steady frame rate.
- Extend camera bounds for the full world. Home returns to the actual starter
  factory/outpost, not the geometric world center. No minimap or mandatory travel
  mechanic is required for this milestone.
- Agree on a reference phone and sparse/dense factory benchmarks. Measure startup,
  frame time, pan responsiveness, and memory after repeated chunk traversal.
  Target at least 30 FPS on that agreed device/benchmark; do not claim mobile
  readiness based only on a smooth empty desktop map.

### Scenarios and persistence

Offer an optional seed only when creating a new Free Play world; otherwise create
a seed automatically. Guided Run uses a fixed, tested seed with a working iron
demonstration, fixed receiver, and viable routes for both orders. Its objectives,
recipe ratios, and unlock rules stay unchanged.

Replace the hard-coded study-site model with the new generator without retaining
legacy terrain code or adding save migrations. A breaking prototype revision may
require starting a new factory. Do not silently reinterpret an old factory against
different terrain; identify an incompatible save and explain the fresh-start
requirement. New saves record the generator version, seed, world identity, and
player changes. Within the current supported version, generation and restoration
must reproduce exactly; backward compatibility between revisions is not required.

Acceptance:

- Same seed/settings/version reproduce identical terrain, deposits, and decoration
  regardless of render/traversal order; different seeds produce visibly distinct sites.
- All three regions exist in world data and basic rendering; their final visual
  treatment is a separate milestone.
- A representative seed suite verifies region presence, starting clearance,
  resource reachability, and sufficient connected buildable space.
- The tested Guided Run completes both orders through real production on its new
  map; guidance points to real targets and item accounting remains unchanged.
- Placement previews, depth-aware selection, pan/zoom, and touch controls remain
  readable across regions and screen sizes.
- Generation is independent of chunk visitation order; chunk borders have no
  terrain seams, depth/picking errors, or lost buildings/cargo.
- Resident render resources stay bounded while traversing the world repeatedly.
  Sparse and developed factories meet the agreed device performance budget.
- Exploring distant chunks does not interrupt off-screen production. Home reliably
  returns to the local starter area, and initial orders require no distant travel.
- Current-version seeded worlds save/resume identically,
  including fresh cached offline launch and visible unsupported-save errors.
- No combat, terrain height mechanics, power, additional recipes, or weather is
  bundled in. Larger size is not permission to add more biome types.

### Implementation and validation

The pure, versioned generator separates biome, ground, deposits, and decoration.
A deterministic 24x24 clear starting area keeps both materials and the outpost
close together. Guided Run uses a fixed seed; new Free Play worlds accept an
optional seed or generate one. Placement, rendering, guidance, simulation, and
restoration use the same world data.

Rendering bakes 32x32 ground chunks, shares decoration textures, and culls
off-screen machine artwork without removing simulation state. Newly visible
chunks receive low-resolution previews before detailed textures are built in
bounded per-frame batches. Camera coverage limits terrain residency to 24
chunks; departing chunks release their textures. Home returns to the starter
area, and camera centers are clamped to the logical world bounds.

`npm run check:factory` includes a 32-seed suite covering substantial region
presence, clear/reachable starter resources, deterministic boundaries,
distinct seed outputs, camera coverage, remote production, and seed-aware save
restoration. Browser checks cover native desktop and emulated-touch construction
and selection across chunk boundaries and at the world edge, repeated traversal,
Home/camera bounds, both guided orders through actual production, and unsupported
old saves remaining untouched with a visible fresh-start requirement. A touch-built
seeded Free Play factory resumes exactly in a fresh cached offline page, produces
and saves offline, then survives another paused reload without catch-up.

A local headless Chrome benchmark traversed a 1,100-machine factory, including
100 operating extraction/transport/smelting/storage chains. Desktop 1920x1080
and emulated 390x844 touch layouts each measured approximately 33.3 ms median
and 33.4 ms p95 frame intervals over 240 frames; the browser appeared capped at
30 FPS. Both continued producing off-screen, with at most seven resident
chunks during that traversal. Observed terrain-build batches peaked at 6.4 ms
desktop and 3.9 ms emulated touch in that benchmark. These are local measurements,
not physical-phone results or a total browser/GPU memory claim.

Remaining release follow-up: choose a reference phone and measure startup,
sparse/dense factory frame times, pan responsiveness, and memory after repeated
traversal against the 30 FPS target. First-time-player pacing also remains
unverified; guided browser checks advanced simulation ticks to exercise recipes
and accounting, not to establish real player completion times. Biome art follows
in milestone 6; dynamic weather remains deferred.

## Milestone 6: Distinct biome art and cohesive landscapes

Implemented. This is a presentation-only update: existing seeded-world saves,
generator version, terrain, deposits, buildability, recipes, and objectives remain
unchanged. Physical-phone performance acceptance still requires an agreed device.

Give the three generated regions a clear identity in original clean-isometric
art: grasses/flowers in meadow, reeds and clustered trees along the wooded
riverbank, exposed stone and sparse vegetation in rocky upland. Blend ground
colors, textures, and decoration at boundaries so the world feels connected.
Avoid uniform repetition across the larger map, but do not add more biome types
to compensate for weak art direction.

Keep region identity separate from deposits and buildability. Decorations must
not imply an impassable tile where placement allows building, or hide the shape
of actual obstacles. Keep machines, ports, moving cargo, and construction previews
visually dominant. Elevation still does not create raised building surfaces.

Reuse milestone 5's chunk/texture infrastructure. Decoration variants must be
seeded by absolute coordinates, with bounded density and resident render resources.
This milestone is visual/world presentation, not weather or new production rules.

Acceptance:

- Players can recognize meadow, wooded riverbank, and rocky upland without a
  permanent biome label or new HUD panel.
- Transitions and repeated chunk borders are cohesive; decoration changes neither
  generation determinism nor the guaranteed playable starting area.
- Deposits, clear land, obstacles, machines, and cargo remain distinguishable on
  phone-sized screens, including selection and placement previews.
- Representative seeds look varied without repetitive tiling or excessive clutter.
- Detailed biome art preserves the agreed chunk-memory and frame-time budgets.

### Implementation and validation

Meadows use fresh, softly mottled greens, broad low-profile grass/clover patches,
and fuller wildflower beds with restrained cream, gold, lilac, and blush palettes.
Flower themes follow coherent seeded patches rather than independent color picks
per tile. The starter clearing shares the meadow's fuller grass and flowers;
these low-profile details leave building space unobstructed and deposits visible.

Wooded riverbanks use clustered rounded broadleaf canopies, reeds, sandy bank
edges, and static water highlights. Rocky upland uses exposed flat stone,
lichen-like patches, wiry grass, low scrub, and occasional rounded shrub clusters,
not conifers or cacti. Ground details remain low-profile and buildable;
existing vegetation obstacle tiles and water remain obstacles. Foreground trees become translucent
when their canopies overlap machines, retaining their depth and obstacle rules.
Removing a machine restores the tree's opacity without requiring camera movement.
The upland shrub artwork replaces conifers on the same obstacle tiles without
changing seeded terrain or saves.

A coordinate-seeded visual sampler blends biome colors through a 5x5
neighborhood and uses broad noise patches plus 256 ground-detail variations.
Ground detailing is baked into the existing chunk textures, not allocated as
live objects. A fixed 448 KiB visual cache, 20 shared prop textures, and a small
reusable bitmap preview surface keep presentation resources bounded. Padded,
overlapping ground coverage removes subpixel chunk-edge gaps. The existing
24-chunk residency limit remains unchanged.

The world suite checks four complete visual worlds in addition to the 32-seed
generation suite: seed/traversal determinism, smooth neighboring colors,
reciprocal shore edges, fuller-but-not-uniform meadow coverage, all six detail
motifs, unchanged terrain/deposits, and fixed cache allocation. Desktop and
emulated-touch checks cover construction and picking on each ground detail,
tree/water rejection, canopy fading/removal, unclipped prop variants, opaque
chunk edges, and deterministic texture rebuilds after eviction. Actual production
was reviewed in all three regions. Cached offline launch, exact paused resume,
ongoing production/autosave, and another offline reload preserve the seeded world.

A local headless Chrome benchmark used 1,100 machines: 100 operating production
chains and 700 conveyors concentrated near the starter area. It held the dense
view, then traversed distant chunks over 300 frames. The latest desktop 1920x1080
run measured 16.6 ms median and 23.1 ms p95 frame intervals; emulated 390x844
touch measured 16.7 ms and 19.2 ms. Terrain-build batches peaked at 6.4 ms and
7.8 ms respectively during that traversal. Both factories advanced on every
eligible engine update, producing 500 ore and storing 200 plates while exploring.
Clock checks use observed engine input time, not an assumed refresh rate.

Repeated minimum-zoom traversal peaked at 21 resident chunks on desktop and nine
in the touch layout; returning Home left three/four ground textures and the
same fixed visual cache and 20 prop textures. The harsh desktop jump test observed
a 16.3 ms terrain-entry batch. These are local development-browser measurements,
not a physical-phone result or a total browser/GPU memory claim. The agreed-phone
startup, frame-time, pan, and memory benchmark remains a release follow-up, as
does first-time-player pacing. No weather, environmental animation, new biome
type, raised terrain, or production penalty was added.

## Approved logistics extension: Splitters and merge clarity

Implemented ahead of weather as an explicitly approved scope change. A splitter
occupies one tile and accepts one item from its rear. Its two adjacent outputs
are straight ahead and to the right; rotating changes all three ports together.
It has the same one-item capacity and eight-tick travel time as a conveyor,
with no throughput bonus. Splitters are available in both scenarios under
**Build → Logistics**, with keyboard shortcut **8**.

Successful deliveries alternate the preferred output. A disconnected,
incompatible, full, or contested preferred branch falls back to the other
branch. When both are blocked, cargo stays inside and backpressure propagates.
Only an actual delivery updates the preference. Transfer reservations use the
same pre-transfer occupancy snapshot across both attempts, so fallback cannot
double-send, overfill a receiver, or move fresh cargo through another tile.
The inspector shows cargo, both output directions, the next preferred direction,
and blockage; placement art shows the rear inlet and both output arrows.

Existing conveyors already merge rear/side feeds using round-robin arbitration.
Their artwork now shows actual connected inlet tracks and converging arrows,
including a splitter's side output, rather than adding a separate joiner.
Placement, rotation, removal, and camera re-entry refresh these junctions.
Depots, opposing front feeds, and neighbors pointing away do not create
false connections.

### Anchored conveyor connections

Choose **Conveyor**, click a start, move to preview, and click the destination
to build. Desktop dragging remains a shortcut. On touch, tap the start and
destination, inspect the unobstructed preview after lifting your finger, then
confirm **Build N belts**. A single tile can be built by choosing it twice.
Turns orient automatically along straight or L-shaped runs; **Swap bend**
chooses the other bend. Complex connections use successive runs, not freehand
staircases, maze pathfinding, or automatic splitter insertion.

Starting from an existing belt or machine snaps to its output port. Existing
belts, splitters, smelters, assemblers, depots, and the outpost are valid
destinations; conveyors respect their rear/side inputs and splitters their
rear-only input. Endpoints are never replaced or silently rotated.
Already-connected ports are reported without adding conveyors. Any water,
vegetation obstacle, occupied intervening cell, or invalid port is marked
explicitly and prevents the entire route from being built. Confirmation
revalidates the full route before any write and refuses a changed preview.

There is no Draw/Pan mode or floating finger card. Small world-space endpoint
markers and belt arrows replace it; one compact route strip holds confirmation,
Swap bend, and Cancel. The conveyor rotate/placement strip is hidden. On touch,
one finger drags the camera and two fingers pan/zoom; previews remain anchored
through camera moves, wheel zoom, Home, resize, and interrupted gestures.
Changing tools, opening Scenarios, Cancel, or leaving the page discards only
the preview. **Select** exits construction.

The toolbar **Undo** icon removes the latest route in the current session and
recovers any cargo that entered it. It remains available after switching tools.
It removes only the route's original conveyors, not later replacements at the
same coordinates, and leaves existing machines and delivered stock untouched.
Undo history and unfinished previews are not saved; placed conveyors and cargo
use the existing save format and resume normally.

Save schema 2 remains compatible with existing seeded factories that predate
the routing field. New saves validate and retain splitter cargo, progress, and
next-output preference; rotation retains cargo, and removal sends it to the
recovery tray. Existing generator, recipes, unlocks, and starter layouts are
unchanged. Filters, priorities, adjustable ratios, and extra-speed belts remain
out of scope.

Pure checks cover balanced alternation, all rotated ports, blocked/incompatible
branches, competing primary/fallback reservations, backpressure, no extra hops,
construction-order determinism, conservation, recovery, and repeated routing-state
save roundtrips. Existing production, progression, persistence, and seeded-world
suites remain regression gates.
Native mouse/touch checks cover catalog placement, output previews, inspection,
rotation, merge redraws, and exact paused resume on desktop, portrait phones,
320px narrow screens, and short landscape. A production touch-built splitter
factory preserves in-flight cargo and routing preference on a fresh cached
offline launch, then continues balanced delivery. Four-direction artwork and
merge regeneration after camera eviction/re-entry were checked locally;
these checks do not replace physical-phone review.
Connection checks additionally cover both L bends in every quadrant, rotated
output/input ports, valid merges, obstacle marking, all-or-nothing revalidation,
working production routes, and cargo-conserving grouped undo. Native
mouse/multi-touch checks cover click/hover/drag, tap-to-confirm, preview-only
state, one save per route, persistent pan/pinch previews, Swap bend, blocked
confirmation, endpoint picking, Cancel, and compact portrait/short-screen
controls. Production touch-built routes preserve in-flight cargo on a fresh
cached offline launch. A new offline route can be built and undone without
changing the resumed factory; subsequent production and autosave continue.
Reload restores neither session-only undo history nor unfinished previews.

## Historical gameplay review: revise before adding scarcity

Planning constraint: no external player cohort is available. Make design
decisions ourselves, using internal hands-on walkthroughs, explicit tradeoffs,
and reproducible scenario checks. External playtesting is optional feedback,
not a prerequisite to implementation. Automated checks establish correctness
and pacing bounds, not whether real players find the game engaging.

The requested critical-agent review recommended **revise**, not implement the
whole resource-economy proposal. The central hypothesis is that the static
feeling comes from absent ongoing purpose: Free Play has no demand, and Guided
Run stops adding goals after its two missions. Construction costs could delay
the same endpoint rather than make play more interesting. This is a hypothesis,
not a playtest result; demand and costs must be compared independently.

The review raised five load-bearing risks:

| Risk | Planning response |
| --- | --- |
| Costs replace building decisions with waiting | Test useful expansion goals with free construction first; compare paid construction against that baseline |
| Remote depot spending masquerades as physical transport | If costs are tested, explicitly abstract construction funding only; never treat that spending as delivered ore, machine input, or objective progress |
| Free/prebuilt machines generate refunds | Record the exact materials actually paid per building; free and legacy buildings have zero refundable investment |
| Wood becomes repeated mandatory scavenging | Introduce it separately, guarantee a local bootstrap, and require a sustainable path before using it as ongoing fuel |
| Energy stacks another unproven constraint | Gate it on evidence that an engaging expansion loop exists and power adds a new planning decision |

Two recommendations need qualification. Larger repeated orders alone can also
create passive waiting, so milestone 7 needs a meaningful choice or changed
production arrangement, not just higher quotas. Full construction refunds are
not inherently a bug: they preserve experimentation while limiting simultaneous
investment. They are not an ongoing material sink, however, and cannot replace
projects or other useful demand. The exact paid-instance ledger prevents refunds
from creating resources.

The project experiment was separately authorized and implemented, then rejected
as the progression direction. Its implementation notes are retained below for
reference; passing correctness checks did not establish that its gameplay worked.
The following replacement roadmap is the active spec. Replacement milestone 7
was explicitly authorized and implemented. The worker-first progression below
is the selected next priority; this planning change is not gameplay implementation.
Later gates still require separate implementation authorization.

## Revised milestone overview: Inhabited logistics settlement

| Milestone | Focus | Status |
| --- | --- | --- |
| 1-6 | Existing factory, persistence, seeded world, visuals, and controls | Implemented foundation |
| 7 | People and a complete raw-food supply chain | Implemented |
| Early housing slice | Wood-funded houses, explicit invitations, population-scaled kitchen | Implemented |
| 8 | Worker-first industry, tools, and the first earned extractor | Next major priority; planned |
| 9 | Food processing, housing, and optional population growth | Planned |
| 10 | Specialist invitations and production discoveries | Planned |
| 11 | Intersecting resource and equipment branches | Planned, staged by useful demand |
| 12 | Broader earned construction | Planned, separately gated |
| 13 | Deeper logistics | Planned, conditional on observed bottlenecks |
| 14 | Atmosphere and livability | Planned |
| 15 | Release performance, accessibility, and reliability | Final gate |
| Unnumbered | Power, defense, and underground excavation | Conditional extensions |

### Shared food and nutrition contract

Milestones 7-10 use the generic item name **food unit**, not vegetable, wheat, or
a required crop taxonomy. A food plot produces physical food units; artwork may
suggest cultivation without introducing different crop items. Milestone 11 may
explicitly introduce crop types, without silently renaming existing food.
Food processing increases
the nutrition obtained from harvested units, not extraction speed or item count.

Initial balance hypothesis:

| Item or recipe | Physical quantity | Nutrition when consumed |
| --- | --- | --- |
| Raw food unit | One harvested cargo item | 1 |
| Processed food unit | One cargo item made from two raw food units | 3 |

These are illustrative calibration values, not finalized production or resident
consumption rates. This recipe offers 50% more nutrition from the same raw supply,
in exchange for processing time, infrastructure, labor where applicable, and an
extra transport leg. Compare that gain against adding a plot or shortening a
hauling route before adopting the numbers. No processor is required to bootstrap.

Keep physical inventories and nutrition accounting distinct. Plots, residents,
depots, processors, and kitchens hold actual items. Delivery puts cargo into a
bounded local kitchen inventory; it does not immediately consume food or count
as research. Consumption removes an item and credits its defined nutrition to
resident provisioning. Persist any fractional consumption remainder locally so
frame rate, reload, and repeated delivery cannot duplicate nutritional value.
Do not expose a global nutrition wallet or require manual nutrition transfers.

Nutrition is not electrical energy, worker stamina, happiness, or a build
currency. Workers do not lose the ability to farm or haul during a food shortage.
Consumption follows simulation time and stops while paused, suspended, hidden,
or closed, consistently with the existing no-offline-production contract.

### Milestone 7: People and a complete raw-food supply chain

Status: implemented as the only Settlement ruleset. Scope and acceptance below are
followed by the concrete contract and internal validation results.

Deliver a playable food-first settlement, not people walking decoratively around
the existing iron factory. Implement hauling underneath first if useful, but the
milestone stops only when production, transport, and consumption work together.

Scope:

- A small starting group, initially four residents, a home/base, a food plot, and
  a communal kitchen. Give a clearly accounted starter food supply sufficient
  to establish the first chain; tune its size against actual setup timings.
- Residents automatically perform farming and hauling jobs. Farming work
  produces food units into a bounded plot output buffer; there is no harvest
  click or need to reassign a worker after each cycle.
- Haulers collect physical cargo from output buffers or depots and deliver it
  to designated compatible inputs or the kitchen. Use simple job priorities
  and building assignments, not per-person commands, schedules, or personalities.
- Define worker speed, carry capacity, job ordering, plot cycle/output capacity,
  kitchen capacity, and resident consumption cadence before implementation.
  Choose these together through internal timing tests, not isolated giant quotas.
- Route walking over reachable land to defined access points. Water and occupied
  building footprints are not traversable shortcuts. Show unavailable jobs and
  inaccessible destinations; never teleport residents or delivered cargo.
- Reserve source cargo and destination capacity for each job. A reservation is
  not a second copy of an item: cargo remains at the source until pickup and
  thereafter belongs to the carrying resident until delivery. Cancel/replan
  safely when buildings or paths change; carried cargo stays with its owner or
  enters explicit recovery, never disappears.
- Existing industrial machines remain automatic. A resident's delivery route
  may be replaced by a compatible conveyor; the released labor can service
  another job. Do not have hauling and conveyors collect the same output twice.
- Make depots reusable basic infrastructure in the settlement ruleset, with
  deliberate output settings and bounded transfer behavior, not project rewards.
  Remove the Projects UI and project-gated progression from this ruleset.
- Keep construction free during this proof. Food consumption provides a real
  sink; paid construction, research, processing, growth, carts, starvation,
  power, and combat are not bundled into this milestone.

Compatibility and acceptance:

- Specify an explicit settlement ruleset/save identity. Old Guided Run, Free Play
  and pre-consolidation Settlement saves are incompatible; do not migrate them,
  add people or consume old inventories. Starting a replacement settlement must
  disclose the reset and protect the previous save until its replacement commits.
- Save residents, jobs/reservations, positions, carried cargo, all food buffers,
  starter grants, produced/consumed ledgers, and consumption progress together.
  Pause/resume and offline reload cannot duplicate food, lose cargo, or advance
  eating while the factory is closed.
- A resident farms, another transports food, and the kitchen provisions the
  population through actual accepted cargo. A shortage is explained but causes
  no deaths, labor slowdown, or bootstrap deadlock.
- A route/layout or conveyor improvement reduces a measured backlog or releases
  a resident for another useful job. Compare against the same starting residents
  and supply, not a fixture with extra free resources.
- Native desktop/touch walkthroughs can find a resident's activity, destination,
  carried item, kitchen stock, and the reason a job is blocked without a permanent
  per-person dashboard. Verify worker/cargo conservation, competing reservations,
  construction interruption, pause, save, and cached offline continuation.

#### Implemented settlement contract

- New Settlement worlds start with four residents (Ada, Emil, Mira, Owen), a
  fixed homestead at 11,12, a food plot at 10,9, and a communal kitchen at 14,12.
  Eight explicitly accounted starter food units are held in the kitchen.
- A plot needs one resident working at an adjacent access tile. It grows one
  food unit every 20 simulation ticks (2s) and holds four units. Full output
  pauses farming without losing partial growth progress.
- Residents walk one land tile every three ticks (0.3s) and carry one item.
  Navigation avoids water, trees, and all occupied building footprints. Workers
  may share walking tiles; there is no collision/traffic simulation in this gate.
- Jobs assign reachable plots first, then prioritize hauling to kitchens over
  industrial deliveries. Ties follow stable tile order and resident identity.
  Each source's inspector selects its hauling destination or disables hauling.
  New plots default to the first available kitchen; industrial sources/depot
  stock are hauled only when a destination is explicitly assigned.
- A compatible arrow-connected conveyor or machine takes over source transport.
  No new carriers claim that source; already reserved deliveries finish safely.
  Source and destination reservations are shared with conveyor transfer capacity,
  and destinations cannot be overfilled by simultaneous carriers and belts.
- Layout changes replan remaining routes. Removing a source/destination or
  making a job unreachable recovers carried cargo explicitly. Changing or
  disabling a hauling assignment cancels affected hauling jobs and likewise
  preserves carried stock in recovery. Occupied/current-next resident tiles
  reject new building placement rather than trapping a person in a footprint.
- The kitchen stores sixteen units. The fixed four-person group consumes one
  raw unit every 25 ticks (2.5s), contributing one nutrition per unit. The meal
  clock and missed-serving count are deterministic; empty kitchens report a
  shortage but never kill residents or stop work. No population growth ships yet.
- Settlement depots can enable output directly in their inspector, without
  projects or research. Storage-only remains the default. Extractors can also
  toggle their existing faster cycle directly. Projects and legacy unlock
  semantics have been removed entirely.
- A People button opens the homestead's contextual activity list. Residents can
  also be selected directly or from that list to inspect activity, position,
  destination, and cargo. Food plots/kitchens use the existing construction
  catalog and inspectors, with keyboard shortcuts 9 and 0.
- Artwork uses the same original isometric vector style, muted greens, warm
  neutral materials, small shadows, compact UI, and bounded/reduced-motion-aware
  animation as the existing factory. Residents visibly carry the food parcel;
  no external character assets or different visual theme were introduced.
- Saves use envelope version 3 and `settlement-v2`. All earlier versions are
  rejected with a clear new-settlement prompt, without normalization or migration.
  Starting a new settlement requires replacement confirmation when a save exists;
  failures/cancellation leave the previous save and active settlement intact.
- Residents, routes, jobs, carried cargo, reservations inferred from jobs, food
  buffers, starter grants, produced/consumed ledgers, and the meal clock restore
  together. Consumption totals and clock must match simulation ticks, and held
  plus consumed food must equal produced food plus the starter grant.

Internal validation:

- A cold starter settlement first harvests at 3s and delivers at 6.1s. The eight
  initial servings provide 20s of provisioning. A real three-minute simulation
  with repeated exact save/restores sustains all four residents with no missed
  servings, without manual harvesting or loading.
- In a controlled sixty-second comparison with the same four people, food plot,
  iron extractor, and receiving depot, conveyor-fed food allows 22 iron ore to
  reach the second route's depot versus 14 with resident-carried food. Neither
  settlement misses servings. This demonstrates labor reallocation, not proven
  engagement or long-term balance.
- `scripts/check-factory-settlement.ts` covers production/consumption/cargo
  accounting, travel and farming, competing jobs, save determinism, construction
  interruption, removal/recovery, disabled assignments, unreachable access,
  shortages/recovery, seeded starts, legacy rulesets, and invalid-save rejection.
- Native mouse/touch walkthroughs at 1440x900, 390x844, 320x568, and 844x390 cover
  actual food production, people/source inspection, hauling destinations, depot
  output, construction, exact resume, and cancellation of scenario replacement.
  A fresh production service-worker cache also supports offline selection,
  continued production/consumption, autosave, and exact resident/cargo/clock
  reload. Screenshots were reviewed against the existing visual direction.
  These checks are browser emulations, not a physical-phone benchmark.

### Milestone 8: Worker-first industry and the first earned extractor

Status: selected next major priority; wood-gathering starter slice implemented,
remaining industry planned. Deliver in three
ordered slices, comparing each against the previous one. The completion moment
is automating a resident-run mining site and assigning the released worker to
another useful job, not accumulating a quota.

#### 8A: Automatic labor priorities and resident-run production

Implemented starter slice: renewable woodcutting sites on clear land within a
four-tile gathering area, one automatically delegated resident, two-second gathering
at a reserved tree access tile, and a physical one-unit return trip to the
four-unit output buffer. Existing hauling or conveyors take wood onward to a
depot. Trees remain obstacles without felling, regrowth, or terrain rebaking.
Building inspectors provide Low / Normal / High work priorities (Normal by
default), read-only staffing, transport choices, and blocked/full feedback.
Residents share production and outgoing deliveries. Priority, waiting age and
travel distance choose new work; waiting jobs gain weight so Low does not starve.
Priority weight diminishes as a building receives residents, allowing other
sites to share labor without hard staffing quotas.
Residents finish their current harvest or cargo trip before reassignment.
Full buffers and inaccessible jobs release labor. People is inspection-only.
Removal and blocked access recover carried wood; saves preserve priorities,
queue ages, progress, routes and cargo with strict conservation and replay checks.

This starter slice intentionally preserves automatic farming, ungated existing
industry, free construction, and fixed population. Mining, worker-run processing,
planks, tools and earned extractors below remain
future work; wood has no downstream recipe yet. Saves now use envelope version 4,
`settlement-v4`, and resident state version 3; older saves require a new settlement
and are never silently migrated or overwritten.

- New Settlement worlds start with the existing small household, raw-food
  provisioning, and reachable iron, copper, and wood. Automated extractors are
  unavailable initially. Keep the Settlement-only entry flow; Guided Run and
  Free Play are not reintroduced.
- Add a mining site on an ore deposit and a woodcutting site with sustainable,
  automatic collection. Define tree access, harvesting bounds, and regeneration
  or supply policy before implementation; no recurring scavenging clicks.
- Delegate residents automatically to food plots, mining/woodcutting sites, and
  early processing workplaces. Begin with one production slot each. Building
  priorities apply to both production and outgoing hauling from the same pool.
- Early smelting and workshop production require a worker. Basic smelting and
  bootstrap recipes are available to founders; no newcomer or automated machine
  is required to make the goods needed for the first automation.
- Mining produces physical ore into a bounded output buffer. Hauling is separate;
  connecting a conveyor frees carriers, not the person doing extraction.
- Put Work priority and current staffing in existing building inspectors.
  The homestead retains an inspection-only people list; no permanent staffing
  dashboard, shift schedules, repeated commands, or skill-XP system.
- Finish the current harvest or cargo trip before priority-driven reassignment.
  For removed or blocked routes, release reservations and explicitly recover cargo.
  Pause a vacated site's partial work safely; no duplicate workers or items.

Acceptance: allocate the starting residents between food, mining, processing,
and hauling, then change that allocation without manual harvest/loading loops.
Check starvation-free recovery, unreachable sites, full outputs, assignment
changes, removal, competing conveyors, saves, and deterministic replay.
Measure this baseline before adding tool bonuses.

#### 8B: Tools and converging components

Introduce the smallest component graph needed for the first extractor. The
relationships below are design targets; quantities, cycles, worker requirements,
and buffer capacities must be settled together before implementation.

| Product | Inputs | Workplace |
| --- | --- | --- |
| Planks | Wood | Resident-run timber yard |
| Tools | Iron plates + planks | Workshop |
| Gears | Iron plates | Workshop |
| Frames | Iron plates + planks | Workshop |
| Extractor kit | Frames + gears + tools | Workshop assembly recipe |

- Use selectable recipes at the workshop, not a building per component.
  Per-ingredient capacities prevent one input starving the others.
- Tools can be installed to improve a staffed site's production. Define the
  benefit and account for installed goods explicitly. No durability/refill loop
  initially; tools do not substitute for a worker.
- Iron and planks have competing uses. Show missing inputs locally and compare
  expanding upstream supply against diverting goods into tools or equipment.
- Recognize actual new production for the minimal extractor discovery. Stored,
  moved, recovered, or starter-granted goods cannot manufacture progress.
  Do not require an extra donation or research receiver.
- Keep basic sites, paths, depots, and rerouting free. Wood has an immediate
  component use; no power/fuel or broad construction-price system in this slice.

Acceptance: create tools and an extractor kit through real worker production
and delivery while maintaining food supply. A tool investment and an additional
worker/site must offer distinguishable choices. Verify recipe selection,
blocked output, installed tools, production counting, and save conservation.

#### 8C: Commission an extractor and release labor

- Unlock permission after the prerequisite production has been demonstrated.
  Permission is permanent; it does not grant a free machine or spend the kit.
- Physically deliver one produced extractor kit to a mining site and complete
  a bounded resident installation job. This is a narrow equipment-commissioning
  proof, not authorization to implement general construction costs.
- The commissioned extractor produces without a mining worker. Release its
  assignment safely; the resident can haul or be assigned elsewhere. Transport
  remains physical and may still require carriers or a conveyor.
- Record kit ownership through transit, installation, and the installed
  machine. Cancellation/removal recovers only actual invested goods, never
  free-machine refunds; define the resulting site/assignment state explicitly.
- Preserve the useful staffed-site option. No mandatory power, fuel, specialist
  staffing, tool maintenance, raids, or automatic population growth.
- Use an explicit new settlement/save ruleset when required. Do not silently
  strip extractors from existing settlements; disclose a fresh-start requirement
  and protect the active save through replacement confirmation.

Acceptance and stopping criterion: in a fresh settlement, produce the complete
kit, automate one mining site, and put its released resident to useful work while
food remains viable. Compare equal starting resources/population before and
after automation; report production, carrying backlog, and labor allocation,
not just a higher counter. Cover interruption, simultaneous deliveries,
installation/removal/refunds, pause, exact save/resume, cached offline behavior,
ruleset replacement, and native desktop/touch assignment/unlock flows. Stop here before
adding arrivals, carts, crop types, or general paid construction.

### Next implementation slice: Wood-funded houses and population-scaled food

Status: implemented. The approved design and acceptance contract follow. This slice
intentionally advances basic housing/growth ahead of the full milestone 8
industry chain. It supersedes the fixed-population assumption for this slice,
not the remaining worker-first industry or specialist roadmap.

Read the canonical field-notebook guide, `src/games/factory/README.md`,
`src/games/factory/assets/README.md`, and **Agreed visual direction** before
implementation. Preserve the existing Resources overview and its uncommitted
changes; do not reset or replace unrelated work. Keep all gameplay changes
inside Factory and its existing checks.

#### Approved behavior and balance

| Decision | Initial value |
| --- | --- |
| House construction | Eight physical wood units delivered to a placed house site |
| Housing capacity | One additional resident per completed house |
| Population growth | Explicit Invite action; no automatic arrivals |
| Food consumption | One food unit per resident per ten seconds of simulation time |
| Invitation readiness | Thirty seconds of sustainable provisioning and thirty seconds of kitchen reserve, both evaluated for the prospective population |
| Shortage behavior | Block further invitations; existing residents keep working and do not die |

Opening loop: gather wood -> deliver wood to a house -> maintain sufficient food
-> explicitly invite a resident -> gain useful labor. Basic houses require no
planks, tools, specialist, automation, or food payment. Other existing buildings
remain free. Do not implement timber processing, food processing, specialists,
research, maintenance, departures, or broader construction costs in this slice.

#### 1. Physical house construction and ownership

- Add a `house` kind to the existing domain/catalog, names, icons, placement,
  picking and rendering. Keep the original homestead fixed; houses are separate
  one-tile buildings. Use the short purpose line "Makes room for a resident" and
  show the implemented eight-wood requirement using shared constants.
- Placing a house creates an unfinished site, not a completed free house or an
  immediate stockpile deduction. It accepts only wood through the existing
  resident delivery and conveyor rules, with capacity equal to its remaining
  requirement. Reservations must prevent overdelivery.
- Completion occurs once the eighth wood arrives. No extra worker construction
  cycle is needed for this first experiment. The completed house accepts no
  further materials and produces no items.
- Represent invested wood explicitly. Prefer retaining the eight units in the
  house inventory as installed material, with completion derived from that
  quantity, rather than adding a second mutable completion flag or a global
  construction currency. Those units cannot be hauled out or spent again.
  Update inspection wording so installed wood is not presented as usable stock.
- Canceling an unfinished site returns only its actual delivered wood to
  recovery; interrupt its delivery jobs using existing reservation/cargo
  recovery. Removing an empty completed house recovers its actual installed
  wood. Never refund wood that was merely reserved or never delivered.
- Reject removal of an occupied house explicitly. No eviction, disappearing
  resident, or silently homeless population. The original homestead remains
  non-removable.

#### 2. Population-aware kitchen and readiness

- Define shared constants for the ten-second resident food interval and
  thirty-second observation/reserve windows. Replace the old household-wide
  consumption clock with a deterministic integer demand accumulator: add the
  resident count each fixed tick and consume one whole food unit for each
  resident-interval worth of accumulated demand. Preserve the remainder in
  saves. Four residents still consume one unit every 2.5 seconds on average.
- Use a deterministic kitchen order and draw actual cargo from stocked kitchens.
  Serve every whole due unit, including multiple units in a tick at larger
  populations. Record unmet due units without accumulating starvation debt that
  would drain every future delivery. Shortages never disable workers.
- Measure readiness from actual simulation events, not theoretical plot output,
  historical lifetime totals, wall time, or global stock. Maintain a bounded,
  persisted rolling thirty-second record of newly harvested food, net kitchen
  replenishment, and unmet food demand. Instrument both conveyor and resident
  delivery paths through the existing rules; neither path receives special
  readiness privileges.
- Net kitchen replenishment must subtract food removed with a kitchen. Recovering
  and re-delivering that stock cannot manufacture extra supply. Initial starter
  inventory and restore operations do not count as deliveries or production.
  Newly harvested food bounds the supply credit so starter/recovered stock alone
  cannot establish a sustainable chain.
- For prospective population `N`, require a complete observation window with no
  missed due food, at least `ceil(N * 30 / 10)` newly harvested units and net
  kitchen replenishment in that window, and at least `ceil(N * 30 / 10)` food
  units currently in kitchen inventories. Depot stock, plot buffers, cargo,
  recovery, and reservations are not ready-to-serve food.
- Thus the first invitation, from four to five residents, requires fifteen
  replenished food units over thirty seconds and fifteen units stocked in
  kitchens. Count each stock unit once; multiple kitchens may contribute.
  Higher populations may need more kitchen capacity and more plots/shorter routes.
- Reset the observation window after a successful invitation so the next
  invitation proves the enlarged settlement is actually provisioned. Do not
  reset fractional consumption demand, food stock, work progress, or cargo.
  Paused, hidden, suspended, and closed time does not advance readiness.

#### 3. Explicit invitation and variable residents

- Track each resident's home. The original four belong to the homestead; a new
  resident belongs to the selected completed house. Housing occupancy and
  capacity are derived from real residents, not a separately incremented counter.
- Add direct simulation inspection/action methods for housing readiness and
  inviting at a house. Recheck completion, vacancy, provisioning and accessible
  arrival space inside the action, not only through a disabled UI button.
- Spawn on a clear adjacent walkable tile connected to the settlement's
  accessible food infrastructure. If none exists, explain the blocked arrival
  and do not create a resident, consume food, or reserve a housing place.
- Use stable, unique resident IDs and deterministic display names beyond the
  four founders. Do not bound population by the founder-name array. Ensure
  resident art safely handles new IDs, using existing palette/style variations
  without introducing personality or preference mechanics.
- Newcomers begin idle with no cargo, reservations or job and immediately join
  the same demand-capped labor pool. Inviting twice at the same house must not
  create duplicate arrivals. Freshly available labor must not cancel existing
  harvests, gathering work, or delivery trips.

#### 4. Contextual UI and artwork

- Put construction progress/installed wood, occupancy, prospective food demand,
  observed supply, reserve, arrival-access reason and Invite in the selected
  house inspector. Use short labeled values and one relevant blocking reason.
  A completed empty house can wait indefinitely while food supply improves.
- Put current population-dependent consumption and stocked food in the kitchen
  inspector. Replace the old "one food unit for the whole household" copy and
  hard-coded household serving interval everywhere, including expanded notes.
- Keep Resources as the header overview, not a restored People page. Resource
  drilldowns include house construction deliveries and installed wood with clear
  roles; carriers and new residents remain inspectable on the map and at home.
  Keep live lists current when a resident arrives, without losing focus.
- Show unfinished and finished houses distinctly using plain visual state
  passed through `rendering/art.ts` to `assets/art.ts`. Assets must not inspect
  live simulation objects. Refresh cached building art when completion changes;
  the new silhouette must have matching convex picking bounds.
- Preserve keyboard/touch behavior, clear accessible names, reduced motion and
  narrow/landscape layouts. No persistent population panel, notification feed,
  automatic arrival celebration, or unimplemented timber/plank copy.

#### 5. Saves, invariants and implementation owners

| Responsibility | Existing owner |
| --- | --- |
| House kind/catalog and shared quantities | `game/domain.ts`, `game/model.ts` |
| Wood acceptance, bounded inventory, material recovery | `game/machines.ts` |
| Placement/removal guards, inspection, invitation actions and transfers | `game/simulation.ts` |
| Dynamic residents, homes, arrival access, scaled consumption and rolling readiness | `game/settlement.ts`, existing `game/labor.ts` where needed |
| Conservation, schema validation and compatibility | `session/saveState.ts`, `session/persistence.ts` |
| Selected-building actions, current lists and live resource details | `FactoryScene.ts`, `hud.ts`, `style.css` |
| House appearance, icon, bounds and preview | `assets/`, state adapter `rendering/art.ts` |

- Saves use envelope version 4, `settlement-v7`, settlement version 6, replacing
  the `settlement-v6`/version 5 contract. Follow the repository's fresh-start
  policy rather than adding an unrequested migration.
- Reject prior saves as incompatible, without modifying or overwriting them.
  Existing explicit replacement confirmation and commit-before-activation
  behavior must still protect the active save.
- Validate homes, founder/newcomer identities, population against actual
  completed housing, input capacities, installed wood, reservations, arrival
  tiles, demand remainder and the bounded food-history window. Reject forged
  readiness or invalid quantities rather than clamping/falling back.
- Keep wood conserved across buffers, residents, unfinished/finished houses and
  recovery. Keep harvested/starter/consumed food conserved with dynamic demand.
  Persist enough observation state for exact invite readiness after reload.
  Duplicate invitation, save/resume, recovery, or building removal cannot
  duplicate materials or residents.

#### 6. Implementation order and acceptance

1. Implement domain/machine/save foundations and population-aware food
   accounting. Add focused tests before exposing invitations.
2. Implement physical house completion, home ownership, readiness inspection and
   atomic invitations, with headless conservation and replay checks.
3. Wire house/kitchen inspectors, Resources, resident lists and house artwork.
   Update directly dependent existing fixtures/copy, not unrelated gameplay.
4. Validate the complete opening loop, adjust tightly coupled failures, then
   update implemented status in this plan and the Factory README.

Required checks:

- Exact eight-wood threshold, one-place capacity, seventh/eighth/ninth delivery,
  resident/conveyor competition, full buffers, empty sources, route changes,
  inaccessible sites, cancellation, empty-house removal and occupied-house refusal.
- Exact population-dependent consumption at four, five and larger populations;
  fractional remainders, multiple due units, deterministic multi-kitchen serving,
  shortage recovery, no food debt, and no starvation/labor softlock.
- Invitation fails just below either thirty-second threshold and succeeds at
  the exact threshold. Cover prospective rather than current population,
  stock outside kitchens, grants/recovery/re-delivery exclusions, blocked
  arrivals, simultaneous/repeated attempts, and reset after growth.
- Round-trip unfinished construction, in-flight wood, installed wood, occupied
  houses, a fifth resident, partial demand and partial/complete readiness
  windows. Compare deterministic replay, labor reservations and conservation.
- Native desktop and narrow/landscape touch flow: place house, choose deliveries,
  inspect progress, explain unavailable invitation, invite, inspect newcomer,
  see increased kitchen demand, pause, save and resume. Check Resources totals,
  live resident lists, keyboard focus, help and accessibility.
- Run the smallest relevant headless checks during development, then
  `npm run check:factory`, `npm run build`, `npm run check:factory:ui`, and the
  affected browser/art checks. Preserve other games and existing Resources work.
- Exercise the real four-resident opening using normal farming/gathering/hauling,
  without seeded extra wood/food or bypassing readiness. Record simulation time
  to a completed house, a food-ready invitation, first newcomer work, kitchen
  supply and hauling backlog. Do not claim that four residents are sufficient
  from a synthetic threshold test alone.

Stopping criterion: the player can physically build one house, explicitly add a
fifth resident while maintaining food, and save/resume the enlarged settlement
without loss or duplication. Deliver this slice before adding timber processing,
specialists or the extractor-kit chain. If normal play cannot satisfy the
approved thresholds with four residents, report measured demand/supply/travel
constraints and request a balance decision; do not silently weaken readiness,
grant materials, or increase the starting population.

Implemented validation: `scripts/check-factory-housing.ts` covers material
thresholds, resident/conveyor reservation competition, cancellation/removal,
readiness boundaries, shortages, multi-kitchen serving, multiple due units,
save validation and deterministic replay. The normal default-seed opening
places a house at 16,12, a second kitchen at 16,10, and plots at 13,10 and 15,10;
the latter feeds the second kitchen. A nearby woodcutting site at 21,20 delivers
to the house. Four founders complete and invite at 96.5 simulation seconds;
the newcomer starts work at 99.4 seconds. No extra stock is granted, no food is
missed through 400 seconds, and gathering output remains within its four-unit
buffer. One nearly full kitchen instead throttles deliveries to current demand;
the house inspector explains when extra kitchen space is needed. These internal
timings do not establish first-time-player or physical-phone pacing.
Native desktop, narrow touch and landscape checks cover placement, wood routing,
readiness, completion art, invitation, installed-stock inspection, occupied
removal protection, updated kitchen demand and exact save/resume.

### Milestone 9: Food processing and later settlement growth

Add a food processor producing processed food units according to the shared
nutrition contract. For this isolated proof, it is directly available; milestone
10 later connects its availability to a production discovery. Do not implement a
research system merely to test this recipe.

- Raw food remains directly usable and is never silently converted into processed
  food. The player chooses which flows feed the kitchen or processor.
- Define a finite processing cycle and bounded input/output buffers. Consume two
  raw units only when one processed unit is successfully produced; blockage
  retains inputs and partial work. Processing creates no unexplained extra cargo.
- The kitchen accepts both item types. Define a deterministic consumption policy
  and show it locally; count actual nutrition once per consumed item, not once
  per transfer. Haulers can move both types without manual loading chores.
- Housing and sustained provisioning enable explicit population growth. More
  residents add useful labor and additional consumption. No automatic arrivals,
  compulsory growth, arbitrary meal donations, or death/worker-disable penalties.
- Settle housing capacity, arrival criteria, the provisioning observation window,
  and new-resident initialization before implementation. A player can keep a
  smaller stable base instead of chasing a population quota.
- Evaluate food readiness for the prospective population, not just current
  residents. Each explicit invitation shows housing, added food demand, and the
  new worker's contribution; declining or delaying it preserves the smaller base.
  Named specialist knowledge is the next milestone, not a prerequisite here.

Acceptance: compare adding a plot, improving hauling, and adding processing
under identical resident demand. Each solves a different observed limitation.
Show processing's raw-food savings and any added delivery/processing bottleneck.
Growth must supply useful additional labor while leaving the food chain viable.
Conserve raw/processed cargo and account explicitly for recipe conversion,
nutrition consumption, population changes, and starter grants across saves.

### Milestone 10: Specialist invitations and production discoveries

Introduce lightweight automatic unlocks that recognize working supply chains,
not labs, science packs, receiver orders, or stockpile thresholds.

Use the loop: demonstrate useful production -> prepare housing and food ->
explicitly invite a newcomer -> learn recipes -> combine production branches.
Build on milestone 9's growth rules rather than adding another arrival system.

- Begin with a small carpenter/smith/mechanic branch. Carpenter knowledge
  advances timber processing and frames; smith knowledge advances tools and
  copper fittings; their combined outputs enable the mechanic's cart equipment.
  Existing milestone 8 recipes stay available; newcomers add capabilities,
  never retroactively gate the bootstrap or first extractor.
- A discovered invitation remains available permanently. Moving in requires
  a free housing place and reliable food for the prospective household.
  Choose thresholds and observation windows from actual setup/provisioning
  measurements, not arbitrary stockpiles or passive countdowns.
- Arrival teaches permanent settlement knowledge. Any resident can operate an
  established workplace; reassignment does not remove recipes or stop technology.
  Specialists also supply ordinary useful labor, without mandatory staffing
  keys, skill XP, relationships, or individual food-preference mechanics.
- Show contribution, housing, food readiness, and Invite in the homestead
  inspector. Show recipe prerequisites at relevant workplaces/catalog entries,
  not a separate science dashboard or unsolicited arrival feed.
- Cumulative production counts actual newly produced items once; moving,
  recovering, storing, or re-delivering them adds no production progress.
- Successful-use checkpoints count the relevant actual consumption or accepted
  delivery once. Prefer meals consumed for provisioning achievements so repeated
  storage/delivery cannot manufacture progress. Starter grants do not count as
  production. Failed or reserved transfers do not count as successful use.
- Progress never requires retaining a stockpile or consuming an extra research
  payment. Goods still serve their ordinary food/construction/production role.
- Unlock the food processor after operating a basic raw-food chain. Unlock later
  logistics or industrial options only when prerequisites exist and the new
  capability addresses a plausible observed limitation. Essential food/hauling
  infrastructure is available immediately; no circular bootstrap requirements.
- Set numerical thresholds after measuring setup time and useful work in
  milestones 8-9. The proposed food values and earlier example counts are not
  approved discovery thresholds.
- Unlocks are permanent, idempotent, and saved. Show the next relevant discovery,
  progress, and benefit in secondary guidance; no automatic new project orders
  or large always-visible technology dashboard.

Acceptance: each discovery offers a useful production/layout decision rather
than simply increasing a number. Test counting exclusions, exact thresholds,
simultaneous completions, permanent unlocks, reload uniqueness, and food
provisioning continuing while progress advances. Cover housing reservations,
prospective food readiness, simultaneous invitations, exactly-once arrival and
knowledge grants, delayed invitations, and reassignment after knowledge is taught.

### Milestone 11: Intersecting resource and equipment branches

Expand one useful branch at a time. Shared intermediates should compete for
supply and then converge into equipment that changes what the settlement can
do. Do not add item types solely to lengthen recipes.

| Branch | Proposed convergence | Useful result |
| --- | --- | --- |
| Mechanical transport | Frames + gears + tools -> cart kit | Automatic bulk hauling |
| Irrigation | Frames + gears + copper fittings -> pump kit | Improve existing farming |
| Food | Grain -> flour -> bread; bread + vegetables -> prepared meals | More nutrition or less food-hauling demand |
| Building materials | Wood -> charcoal; clay + charcoal -> bricks; bricks + planks + tools | Larger housing/storage or processing equipment |

- Preserve basic raw food and unwatered farming. Crops and prepared meals are
  explicit new item types; do not silently convert existing food units.
- A grower/cook invitation branch can introduce crop and food recipes after
  existing provisioning works. Founders' food chain never depends on arrivals.
- Give copper a useful role through fittings before introducing electronics.
  Pumps require a separately specified water distribution/irrigation contract;
  producing a kit alone does not imply that fluid gameplay exists.
- Stage clay and charcoal only when a concrete building-material use is ready.
  Do not retroactively fuel existing smelters or add global power management.
- Cart operation belongs to milestone 13. Do not add a kit with no implemented
  consumer: coordinate its recipe/discovery with that logistics gate. General
  material-funded construction remains milestone 12; cross-gate entries above
  describe dependencies, not permission to implement all branches together.

Acceptance: each introduced branch has a working consumer and a measurable
capability or provisioning benefit. Compare splitting existing supply against
expanding it, and test multi-input starvation, cargo/nutrition conservation,
worker assignments, discoveries, and save/resume for each staged branch.

### Milestone 12: Broader earned construction

Only after food, people, and discoveries form a useful loop, test selected
material-funded buildings and transport equipment. Industry should produce
tools, components, and infrastructure used by the settlement, not disconnected
plate quotas. Food provisions residents; nutrition never pays construction costs.

Use explicit recipes, a viable starter kit, visible material requirements, and
actual-paid investment/refund records. Discovery unlocks permission to build,
not a free copy of a machine. Specify how residents deliver construction cargo
to a site and complete a job; movement must not be replaced by remote magical
inventory spending. The historical construction-reserve proposal below is not
the selected funding mechanism for this direction.

Atomic placement/route funding, site capacity/reservations, cancellation,
unfinished-site recovery, refunds, free/legacy buildings, and save interruption
must preserve material accounting. No refund can create materials that were
never actually invested. Keep paths/basic rerouting inexpensive enough to
experiment. Existing factories are not retroactively charged.

Reuse milestone 8's wood collection and component chain. Extend them only for
concrete construction/transport recipes, with accessible supply and automatic
harvesting where repeated consumption is intended. Do not add a manual refill loop.
Acceptance: infrastructure investment improves provisioning or labor allocation
without passive waiting, circular prerequisites, or a softlocked settlement.

### Milestone 13: Deeper logistics

Introduce carts on paths, configurable depot roles, or clearer job priorities
only where milestones 8-12 expose useful limits. Walking is flexible low-volume
transport, carts are bulk transport, and conveyors are fixed continuous routes.
Do not add all transport tiers or forced roads just to increase complexity.

Acceptance: explain why a player would select each introduced option. Verify
capacity, loading/unloading, fair job selection, inaccessible routes, competing
workers/transfers, and save-safe rerouting. Compare throughput and labor released
against the walking/conveyor baseline. No recurring manual loading.

### Milestone 14: Atmosphere and livability

Refine visible resident work and settlement pacing, then add bounded ambient
motion or gentle weather where it improves the place. No hunger-survival
schedules, production penalties, seasons, or personality simulation are required.
Retain readable cargo, ports, jobs, touch interaction, and reduced-motion cues.

Use internal fresh/developed settlement walkthroughs and timing checks; external
testers are optional feedback. Physical-device performance remains a separate
measured gate. See the retained atmospheric/livability references below for
rendering and weather-state contracts, not the superseded numbering.

Milestone 15 remains the release gate below. Power, defense, and excavation
require separate approval and a concrete role in the functioning settlement;
nutrition does not imply a power system or survival/combat requirement.

## Historical experiment: Project-based expansion (superseded)

Status: implemented locally under the earlier milestone 7, but rejected as the
future gameplay direction. This section records that experiment, not the active
next milestone or a claim of user-approved gameplay. Runtime code remains for
legacy factories; the replacement Settlement scenario does not use project gating.

Test the missing-purpose hypothesis before introducing new resources. Retain
free construction, unlimited visible ore, existing recipes, and the current
Guided Run/Free Play distinction.

### Historical 7A: A bounded next decision

Offer a small set of opt-in expansion projects in Free Play and after guided
commissioning. Preserve the original two missions and their consumed-delivery
ledger. Do not replace peaceful continuation with mandatory repeating orders.
Present at most two project choices at once, in secondary guidance rather than
another permanent HUD panel.

Use the existing iron plates, copper plates, and mixed-metal supplies. Initial
project hypotheses are an extraction commission paid in mixed-metal supplies,
unlocking one extractor upgrade from one ore per ten ticks to one per eight,
and, once 7B is functional, a buffering commission paid in iron plates that
unlocks output-enabled depots. Never offer a project whose reward is not usable.
The latter should make parallel smelting useful rather than accelerate every
machine. Both rewards are optional and finite; neither removes an existing
capability. Select one active project, preview its inputs and reward, and define
a finite completion. Final project quantities are calibrated from baseline
throughput before implementation, not copied from the earlier mission quotas.

Calibrate batch sizes or a sustained-delivery objective against measured starter
throughput. A longer wait with the unchanged starter line must not be the only
new interaction. Do not add deadlines, penalties, extra resources, random order
spam, or a large research tree to this proof.

Project delivery is physical transport to the receiver. Consumed project items
are a separate sink from commissioning; deposited items, recovered cargo, and
future construction spending cannot also count as deliveries. Projects and
rewards save exactly and cannot be repeatedly claimed through reload or retry.

### Historical 7B: Stored resources can return to production

After evaluating the extraction project in 7A, test the buffering project's
output-enabled depot as a reusable buffer and a second allocation choice.
Existing depots default to storage-only; enabling output is a deliberate,
persisted per-depot setting. Use the building's arrow-facing adjacent output,
bounded transfer rate, and the same snapshot/reservation rules as conveyors.
No manual repeated item-loading action or teleportation into distant machines.

Define mixed-stock output selection deterministically and show what leaves next.
When disabled or blocked, stock remains in the depot. Recovery can be transferred
into a depot and then transported normally; it does not grant mission progress
until the receiver accepts it. Account for capacity, rotated ports, merges,
splitters, simultaneous input/output, and shared destination reservations.

Acceptance and decision gate:

- A player reaching the old completion point can identify a concrete next
  production decision, and a Free Play player can opt into a goal without
  abandoning their factory.
- Test projects before depot-output changes, then test buffering separately;
  compare against the current free-building baseline rather than bundling effects.
- Walk through a fresh factory, the old guided completion point, and a developed
  Free Play factory ourselves on desktop and touch layouts. Document the next
  available decisions, longest forced wait, and which layout changes improve
  the outcome. Do not depend on recruiting players or a sample-size threshold.
- Compare an unchanged starter line against a deliberate expansion. The project
  must make expansion useful and provide a clear reward; merely waiting for a
  larger batch is not a sufficient design. Use simulated production timings to
  tune quantities, not to claim measured engagement or retention.
- Revise if our walkthrough exposes only waiting, an unusable reward, or the
  same task with a larger quota. We own this judgment; outside feedback can
  inform it later but does not block the next implementation gate.
- Automated tests cover project sinks/reward uniqueness, output-enabled depot
  conservation, reservation fairness, disabled defaults, and save/offline resume.

### Implemented contract and internal decision gate

- **Extraction commission:** eight defense supplies unlock an optional
  per-extractor upgrade from one ore every ten ticks to one every eight ticks
  (1.0s to 0.8s). Existing and newly placed extractors stay standard until
  explicitly upgraded in their inspector; switching back is supported.
- **Buffering commission:** sixteen iron plates unlock optional per-depot output,
  one item every eight ticks (0.8s) toward the arrow-facing adjacent receiver.
  Existing and newly placed depots stay storage-only until explicitly enabled.
  Disabling resets the output clock but retains all stock and routing position.
- The Projects button opens secondary, dismissible guidance with exactly two
  choices, accepted counts, input requirements, and usable rewards. The dialog
  pauses simulation and cancels an uncommitted conveyor route. Guided Run offers
  projects only after its original two missions; Free Play can opt in immediately.
  Neither mode automatically starts an order after completion.
- A Free Play receiver appears only on first opt-in, on the nearest clear
  accessible tile around the starter outpost site. It never replaces an existing
  building, persists in place, and can be found through the project guidance.
  Guided Run reuses its existing fixed outpost.
- Only physical receiver acceptance consumes project items. Each project's
  accepted ledger is separate from commissioning, retained when switching or
  pausing, and capped at its finite quota. Completion clears the active project;
  unlocks derive from exact accepted quantities and cannot be claimed again.
  Wrong items and excess cargo remain upstream.
- Mixed depot stock cycles through iron ore, copper ore, iron plates, copper
  plates, and defense supplies, starting after the last successful item type and
  skipping empty types. The inspector shows the next item and actual port.
  An incompatible or blocked next item remains selected and held; it is not
  silently bypassed. Transfers share the conveyor snapshot and fair destination
  reservations: no multi-hop cargo or reuse of a slot freed in the same batch.
- Recovery relocation remains bounded by depot capacity and grants no project
  progress. After output is enabled, recovered stock can feed recipes and
  projects through ordinary physical transport. Removing or rebuilding a
  blocked conveyor safely moves its cargo to recovery; this is needed when
  switching delivery types on an already loaded line.
- Legacy saves gain empty project ledgers and default depot routing without
  changing factories or original mission completion. New saves strictly validate
  projects, unlocks, machine options, clocks, routing, and total material accounting.

Internal comparison, not an engagement or phone-performance measurement:

| Scenario | Measured simulation time | Next useful decision |
| --- | --- | --- |
| Cold starter supply line rerouted to the outpost | First supply 12.6s; eight supplies 35s | Iron plates limit the assembler; add a second iron smelter |
| Same line with a splitter and second iron smelter | First supply 12s; eight supplies 26s | Upgrade extraction to support the parallel smelting branch |
| Finished supply factory rerouted to iron delivery | Sixteen plates in 26s | Choose production input buffers or reuse recovered cargo |
| Output-enabled stocked depots | First item after 0.8s; one successful item per 0.8s thereafter | Set the port and keep compatible stock ahead of blocked item types |

The longest unavoidable first-delivery delay in the compared cold layouts is
12.6s, with no deadline or construction lock while production runs. The unchanged
line can finish, but deliberate parallel smelting shortens the finite project by
nine seconds rather than adding a larger repetition of the old order. Buffering
requires a different allocation and then returns stored stock to production.
This is sufficient for this prototype gate, not proof that players find it engaging.

Native mouse/touch walkthroughs covered fresh Free Play, developed factories,
and Guided Run's original completion point. They covered project selection,
switching, pausing, both rewards, recovery, blocked cargo, and exact reloads at
1440x900, 390x844, 320x568, and 844x390. A fresh production service-worker cache
also resumed both modern rewards and a legacy completed Guided Run offline,
accepted native controls, ran production, autosaved, and reloaded exactly.
These are browser emulations and scripted internal scenarios, not physical-phone
benchmarks or external first-time-player feedback. The walkthrough exposed
incompatible leftover cargo during project switching; guidance now explicitly
explains safe removal/rebuilding instead of silently discarding it.

`scripts/check-factory-expansion.ts` covers real-production timing, project
quotas and sinks, reward uniqueness, retained pause/switch progress, seeded
accessible receivers, legacy/strict saves, physical recovery deliveries,
extractor cadence, depot-fed recipes, mixed-stock selection, rotated ports,
merges, splitters, simultaneous input/output, snapshot capacity, and conservation.
No construction costs, wood, power, weather, excavation, or combat were bundled
into this historical implementation. The old milestone 8A sequence is superseded
by the settlement roadmap, not automatically authorized by these test results.

## Historical proposal: Construction reserve and harvestable wood

Reference only: the former milestone 8 proposal is not the active roadmap.
Reuse its conservation/refund safeguards where applicable, but revised milestone
10 selects physical resident construction delivery rather than this abstract
reserve. Its quantities, resource recipes, and separate wood sequence are not
approved balance or implementation requirements.

### Historical 8A: Construction paid for by existing production

Test a small recipe set funded by existing iron/copper plates. Recipes are
explicit, fixed per ruleset, and visible in the build catalog and placement
preview. Initial recipe hypotheses, subject to the wait-time gate:

| Build | Iron plates | Copper plates |
| --- | ---: | ---: |
| Conveyor | 1 | 0 |
| Extractor | 6 | 0 |
| Smelter | 8 | 0 |
| Depot | 4 | 0 |
| Splitter | 4 | 2 |
| Assembler | 12 | 8 |

Start with 40 iron plates and 12 copper plates in the one-time construction
reserve. This can fund an extractor, smelter, depot, and sixteen connecting belts,
with six iron plates left; the initial chain does not depend on already
producing copper. These numbers are a test fixture, not a validated balance.
Project quantities and the extractor-upgrade price need explicit calibration
before either enters the implementation scope.

Price belts cheaply enough that rerouting remains practical; costs are
a limit on simultaneous factory investment, not a punishment for experimentation.

An economy-enabled new factory receives a one-time starter construction reserve
large enough for an extractor, smelter, depot, connecting belts, and a recoverable
first expansion. Validate a complete productive bootstrap for every supported
seed and scenario; do not require funding infrastructure that cannot yet exist.

Construction funding is an intentional convenience abstraction: spend the
starter/refund reserve first, then eligible stock physically stored in depots,
using a stable item order and depot-coordinate order. Recovered cargo is not a
third spendable wallet: collect it into a depot first. Items inside conveyors or
machine buffers, and already-consumed deliveries, are never eligible.
This abstraction pays only for placing buildings; it does not deliver materials,
feed recipes, or transport ammunition. Physical production still uses belts.

Do not show an aggregate stock dashboard. The selected construction card shows
recipe costs and available funding, including a clear shortfall; the depot
inspector remains the source of physical-stock detail. Describe remote depot
funding honestly. If players cannot distinguish funding from transport, revise
the mechanism rather than introducing manual material hauling by default.

Affordability and geometry are one transaction. For a conveyor route, preview
the total price of all new belts, excluding preserved endpoints. Revalidate
route and funding before any debit or placement; insufficient funds place and
charge nothing. Do not silently shorten a route or silently substitute a different
preview. Refunds and construction spending are immediate state changes, not
render-animation events.

Record the exact paid materials on each building. Removing or undoing an owned
building refunds that recorded investment once into the construction reserve;
the building's cargo remains separate and follows existing recovery rules.
Free/prebuilt/legacy buildings have zero paid investment. Rotations cost nothing.
Refunds cannot reissue starter grants, convert recipes into different resources,
remove later replacements, or duplicate both reserve and physical depot stock.
Start with full paid-material refunds; test their effect before adding a refund
penalty. A cost balance change never changes an existing building's paid ledger.

Acceptance:

- Compare the same expansion tasks with free versus paid construction. Continue
  only if players make clearer investment decisions without more forced waiting,
  repeated insufficient-funds attempts, or reduced willingness to experiment.
- Players understand a cost and its shortfall from the construction controls
  without a new inventory modal or external explanation.
- Demonstrate recoverable bootstrap after a deliberately poor first placement.
  Reject a ruleset that can strand a new player with no productive route.
- Conservation includes produced/starter-granted materials, held cargo, building
  investment, spent deliveries, refunds, and other explicit sinks. Build/remove/
  rebuild, route undo, replacements, scenario grants, and free-demo removal never
  produce net-positive materials.
- Deterministic multi-depot spending, insufficient-funds atomicity, concurrent
  transfers, cross-tab save protection, and exact paused/offline resume are tested.

### Historical 8B: Harvestable wood with one useful role

Only after evaluating 8A, test harvesting trees with one optional depot recipe:
four wood instead of four iron plates. One tree initially yields four wood,
letting players choose local harvesting versus spending factory output.
Do not make every existing machine depend on wood, or add wood merely to increase
the number of counters. Keep the first complete plate-production route viable
from the starter reserve without harvesting. Do not silently convert a paid iron
depot into a wood refund; the paid-instance record retains the selected recipe.

One confirmed action harvests a tree, awards a fixed amount of wood into the
construction reserve, and leaves a buildable tile. Persist the harvested tile
and award atomically; any chopping animation is cosmetic and cannot award again
on reload. Nearby starter trees must be guaranteed in new economy worlds without
blocking required routes. Existing decorative trees cannot become an unannounced
cost requirement for old factories.

Single-use trees provide a bounded local exploration choice, not infinite
renewable fuel. Before making wood a recurring expense, prove an accessible
automated forestry or regeneration mechanism in a separate gate. Do not require
repeated manual harvesting to keep the factory operating.

Acceptance:

- Harvesting visibly changes the landscape and enables a useful build decision.
  Test it against 8A alone; reject if it mostly adds scavenging or click chores.
- Tree-clearance picking remains reliable at phone scale and does not accidentally
  place/remove machinery. The action and yield are visible before confirmation.
- Harvest records, wood grants/spending/refunds, world changes, and terrain chunk
  invalidation reproduce exactly across save/reload and offline play.

### Ruleset and compatibility contract

Existing factories remain on their current free-construction rules. New economy
factories opt into an explicitly versioned experimental ruleset; do not infer
economy state from scenario name, assembler unlocks, or the presence of a depot.
No Guided Run/Free Play menu redesign is required by this experiment.

Version the save schema for construction reserve, one-time grants, per-instance
paid investment, project state, depot output mode, and harvest changes when those
features ship. A generator revision that guarantees starter trees needs its own
identity. Preserve old-version semantics through an explicit loader, or clearly
block unsupported saves and require a confirmed new factory; never silently
reset, reinterpret inventories, or overwrite an unreadable save.

## Conditional extension: Power proof

Proceed only after an engaging expansion loop is demonstrated and power has a
specific planning role. Test one generator type and a small production-machine
demand model. Electricity is continuous generation versus demand, not a stored
item or a new spendable currency. Start with one clearly defined connected
network; defer large wire/pole trees, fluids, batteries, and multiple fuels.

Specify network membership, generator capacity, active versus idle demand, and
the deterministic shortage rule before implementation. Show supply/demand when
inspecting the network or an affected machine, not a permanent energy dashboard.
Shortages must explain the resulting production slowdown or stopped machine.
Belt construction and basic navigation must not require available electricity.

If the generator burns wood, first provide a sustainable automated supply;
the retained historical wood proposal is not an approved prerequisite. No mandatory
recurring manual refills. Otherwise test a simple
non-fuel generator first and do not introduce coal merely to justify power.
Maintain the calm game: no surprise shutdowns from weather, off-screen decay,
or simulated resource use while the app is closed.

Acceptance:

- Power changes a capacity/placement decision in a functioning factory rather
  than making the same recipes take longer or creating another refill chore.
- Compare with the power-free expansion build; reject if waiting, confusing
  network boundaries, or manual servicing increases without useful decisions.
- Pause/resume, fuel consumption if present, shortages, and material/energy
  accounting are deterministic, conserved as applicable, and persisted.
- Evaluate dense factories on physical phones before expanding network complexity.

### Deferred excavation and resource discovery

The user's harvesting/underground-resource idea remains a separate exploration
experiment, not replaced by power or construction pricing. If later authorized,
start with shallow, seeded buried deposits and a selected-tile cutaway:
harvest/use materials -> expose a deposit -> automate extraction.
No full 3D world, caves, rerolled ore, or rapidly depleting starter deposits.
Give the discovery an actionable production benefit and test it against surface
expansion before expanding layers or introducing more material types.

## Reference for milestone 14: Atmospheric weather and environmental motion

Bring the landscape to life without adding penalties or chores. Begin with clear,
cloudy, and light-rain states, gradual lighting changes, drifting cloud shadows,
and restrained water/reed/tree motion. Do not add seasons, a day/night survival
system, storms, flooding, or physically simulated climate in this milestone.

Weather transitions follow a deterministic seeded sequence on simulation time.
Persist the weather seed/version, current state, transition progress, and timing
needed to resume continuously. Pause/suspension freeze environmental time;
reopening does not fast-forward the weather. Rendering may interpolate visually,
but render frames must not advance the authoritative weather sequence.

Keep weather separate from terrain generation and production. Region-aware visual
details may vary, but rain cannot change recipe speed, machine operation,
buildability, resources, or objective progress. Define an initial weather state
for new worlds; a revised save format may require a fresh factory rather than a
backward-compatible loading path.

Use bounded effects and reuse rendering resources. Clouds and rain must not
obscure output arrows, moving items, selected tiles, or HUD text. Reduced motion
uses stable lighting/weather cues rather than continuous particles or swaying.
Provide a small optional environment-effects preference in secondary settings,
not a permanent weather dashboard. Ambient audio is not required for this gate.

Acceptance:

- Transitions are gradual, visually coherent across regions, and never affect
  production/material accounting or placement behavior.
- Same saved state and elapsed simulation ticks reproduce weather independently
  of frame rate; pause, suspension, reload, and offline resume preserve continuity.
- Reduced-motion and effects-disabled modes retain terrain/production clarity
  without continuous weather/decorative animation.
- Effect counts stay bounded; benchmark dense factories on an agreed phone and
  desktop, and reduce effects rather than compromising production responsiveness.
- Touch picking, cargo visibility, camera movement, and compact HUD remain usable
  in every weather state. Weather introduces no alerts or management chores.

## Reference for milestone 14: Livability and environmental polish

Evaluate the 256x256 living world before choosing more systems or more terrain.
Walk through fresh and developed settlements with varied seeds and any
implemented weather, alongside legacy factory compatibility checks.
Focus on whether the place feels inviting,
regions are recognizable, and environmental detail enhances rather than hides
the automation.

Refine palette transitions, decoration density, motion strength, and weather
cadence from the results. Do not solve weak atmosphere by adding more biomes,
more particles, combat, or a larger empty map. Keep the calm visual language and
the compact HUD with on-demand guidance.

Acceptance:

- Internal walkthroughs can find food/resources, build, inspect worker and
  production bottlenecks, and understand provisioning without decoration or
  weather causing confusion. External first-time-player feedback is optional.
- Players perceive coherent landscape regions and a changing environment, and
  have a reason to keep building or return to their saved site.
- Physical-phone checks cover touch, orientation, suspension, reduced motion,
  seeded save restoration, and fresh offline relaunch.
- An agreed device/factory benchmark meets its responsiveness/performance target
  with weather enabled; no unsupported physical-device claims from emulation alone.
- Document playtest findings and decide the next gate explicitly: optional defense,
  purposeful uses for the existing exploration space, or bounded environmental refinement.
  Completing this milestone does not automatically authorize those features.

## Conditional extension: Production-fed defense proof

Revisit only after the living-world playtest and explicit approval. Combat is
optional roadmap direction, not required to validate a peaceful factory world.

Build a bounded defense scenario around the local starter outpost, not a
world-wide combat engine.
Use one enemy type following a fixed, reserved approach outside the buildable
production area, one protected outpost, and one automated defense type. Factories
cannot block the approach; no dynamic navigation around player buildings is needed.
Only the outpost takes damage in this prototype.

Before combat, provide a conservation-tested way for stored/recovered defense
supplies to re-enter transport. Milestone 3's storage-only recovery action is not
an ammunition delivery mechanism; define this interaction at the defense gate.

After commissioning, give the outpost a separate, bounded defense reserve fed by
new deliveries. Milestone 3's consumed-order ledger is not a reserve and cannot
pay for deployment again. Spend reserve supplies to deploy the defense. Replenish
its bounded ammunition/supply buffer through the factory's transport system; each
shot consumes a defined amount. No free infinite ammunition or inventory teleportation.
Specify range, target selection, cooldown, damage, deployment/refund rules, and
enemy movement deterministically before implementation. Removing or rebuilding
a defense must not duplicate deployment materials or replenish spent ammunition.

The player starts the first raid after preparation. Later raids have visible
countdowns and capped escalation; surviving three completes the run. Tune demand
so improving supply throughput or buffering is a viable response to each raid.
Avoid requiring manual combat or repeated emergency reconstruction.

Before each raid, persist a coherent retry checkpoint covering the entire factory,
inventories, progression, defense, and raid state. If the outpost is breached,
freeze the attempt and offer an explicit retry from that checkpoint. Restore all
state together; do not combine old inventory with new rewards or partial damage.
Successful completion offers peaceful free-building continuation or an explicit new
challenge.

Acceptance:

- Materials are accounted for through crafting, deployment, replenishment,
  firing, removal, saving, and retry; all sinks/refunds are explicit. Commissioning
  deliveries cannot also become deployment stock, and recovered supplies have a
  defined route back into replenishment.
- Identical initial states and inputs reproduce raid movement, targeting, damage,
  and outcomes regardless of construction order or frame rate.
- No attack occurs before the first-raid opt-in. Countdown, damage, and combat
  pause with the factory and do not fast-forward after suspension.
- Outpost status, approaching threats, supplies, and failure reasons are readable
  at phone size and not communicated solely by color.
- Save/resume mid-raid and checkpoint retry preserve a coherent run without
  duplicated items, repeated rewards, or free ammunition.
- A short three-raid run has a clear success/failure state and factory-preserving
  retry. Peaceful play does not trigger attacks.
- Playtest whether players improve their factories in response to pressure,
  understand why they lose, and want another attempt. Rework the loop before
  adding more content if combat mainly creates interruptions or passive waiting.
- Validate the proposed 20-30-minute full run through playtesting.

### Later gameplay ideas, gated by the defense proof

Consider production-linked threat, additional approaches, richer component
recipes, or a small defense upgrade choice only
when each creates a distinct automation decision. Do not implement them together.
Factory destruction and free-roaming attackers remain outside first-release scope.

## Milestone 15: Release performance, accessibility, and polish

Agree on a reference phone and a specific factory-size benchmark before making
performance claims. Test both sparse terrain and a dense operating factory.
Target at least 30 FPS on that agreed device and benchmark.

Profile terrain rendering, belt animation, and simulation separately. Prioritize
visible-work culling and bounded simulation cost before increasing world size.
Respect reduced-motion preferences and provide readable labels, sufficient
contrast, and clear selected/invalid/disabled states beyond color alone.

Acceptance:

- Automated coverage for generation, production, placement, persistence, residents,
  jobs/reservations, carried cargo, raw/processed food, nutrition consumption,
  population growth, specialist invitations/knowledge, workplace assignments,
  tool installation, extractor commissioning, discovery uniqueness, and safe
  rejection/replacement of older settlement rulesets.
  Construction delivery/refunds, carts, harvest changes, power, weather, and
  combat/checkpoint retry are covered only when their gates are implemented.
- Real-device checks for touch gestures, orientation, suspension, and offline
  relaunch.
- No known item duplication/loss or destructive save failures.
- Performance targets met on the agreed reference device and factory benchmark.

## Planning estimate and risks

The previous 4-6 developer-week estimate does not describe this revised scope.
World generation/chunked rendering and biome art are already implemented.
Estimate worker assignments, staffed industry, tools/extractor commissioning,
processing/growth, specialist discoveries, resource branches, construction
delivery, and deeper logistics separately after their
individual gates are authorized. Re-estimate from
each gameplay comparison; do not commit to the whole economy, combat, or expansion
beyond 256x256 in advance.

Largest uncertainties:

- Whether visible residents and provisioning create useful decisions rather than
  walking decoration or an ongoing consumption tax.
- Deterministic job reservations, navigation, capacity, and cargo recovery when
  people and existing conveyors compete for the same resources.
- Whether assigning scarce labor and earning automation produces useful choices
  without excessive staffing chores, waiting, or circular recipe/arrival locks.
- Food/nutrition balance that rewards processing and expansion without starvation
  spirals, compulsory population growth, or idle waiting.
- Achieving the desired visual quality with original assets.
- Accurate, readable isometric placement on small touchscreens.
- Belt transfer correctness and congestion behavior.
- Cohesive procedural regions with local, guaranteed playable starts in a large world.
- Chunk rendering, memory residency, depth ordering, and navigation at 256x256.
- Weather/decoration readability, reduced motion, and effect cost on phones.
- Keeping current-version seeded worlds and saves deterministic as the prototype evolves.
- Distinguishing absent goals from insufficient scarcity without confusing a
  preference for new systems with evidence of better play.
- Preventing paid construction or finite wood from creating waiting, scavenging,
  softlocks, or fear of experimenting with conveyor layouts.
- Explaining construction funding separately from physical cargo while preserving
  atomic route costs, actual-paid refunds, grants, and material conservation.
- Sustainable fuel and readable power boundaries without repeated manual servicing.
- Making production-fed defense engaging without creating waiting, overwhelming
  pressure, or reconstruction chores.
- Balancing resource demand and raid difficulty for new players on touchscreens.
- Deterministic combat and atomic save/checkpoint restoration without duplication.
- Dense-factory performance on phones.
- Browser storage limits, save evolution, and offline cache lifecycle.

## Current state

- Plan persisted.
- Milestones 1-6 plus the superseded project experiment are implemented at
  `/games/factory/`, accessible from the arcade hub. The milestone 1 visual
  direction is approved. The replacement settlement milestone 7 is implemented
  as a separate Settlement scenario.
- Original vector-drawn isometric artwork and a seeded 256x256 world with real
  ore/plate transport, extraction, smelting, and storage. Free Play starts empty
  with all machines unlocked. Guided Run starts with the iron demonstration
  and a fixed outpost.
- Guided copper commissioning delivers 16 plates and unlocks the assembler;
  2 iron plates + 1 copper plate become 1 defense supply in 2 seconds. Delivering
  12 supplies completes preparation; continued building starts no new orders or raids.
  Optional projects then offer extractor upgrades and reusable depot stock.
- Mouse and touch selection, placement previews, placement, rotation, removal,
  camera pan/zoom/reset, and a contextual inspector.
- Construction navigation uses a compact Select / Build / Pause dock and categorized,
  scrollable building catalog. Rotation is contextual to placement or inspection;
  removal is available only in the selected building's inspector.
- Changes and inventories persist through versioned local autosaves. Item movement
  and machine activity reflect actual simulation state, not demonstration loops.
- The inspector shows live inventory, production progress, orientation, and
  blocked/disconnected/full states. Depot inventory is contextual; there is no
  global stock/recovery panel.
- Recovery-tray contents remain accounted for when machines or conveyors are
  removed and can be relocated into a selected depot without exceeding capacity.
  Depots remain storage-only unless output is unlocked and explicitly enabled.
  A manual pause/resume control freezes the whole factory.
- Reduced-motion preferences suppress continuous animations while the
  simulation continues.
- `npm run check:factory` covers tile projection, placement rules, the demo
  layout, rotation, depth-aware building selection, full production chains,
  per-step material conservation, bounded buffers, fair/deterministic transfers,
  mixed ores, invalid routing, congestion, recovery, repair, and fixed-step timing.
  The progression suite additionally covers recipes, objectives, consumed delivery
  accounting, scenario locks, recovery relocation, quotas, and actual delivery rates.
  The world suite covers 32 seeds, region/start constraints, deterministic
  generation, chunk coverage, remote production, and seeded save restoration,
  plus four full-world visual checks for detail, color/shore continuity,
  unchanged terrain, and bounded caching.
- Production build and desktop/mobile browser interaction checks passed,
  including native multi-touch gestures, narrow-screen layouts, and offline
  launch/reload/navigation with the production service worker. Production
  continues without a network; offline pause/resume and session reset also pass.
- Live-chain browser checks cover production, pause, cargo recovery, blockage
  propagation, repair, off-screen production, real touch controls, and responsive
  inspectors. Browser checks use mobile emulation, not a physical phone.
- Milestone 4 adds versioned local autosave/resume, visible storage failures,
  confirmed replacement, cross-tab overwrite protection, and cached offline readiness.
- Milestone 5 adds seeded meadow/riverbank/upland regions, bounded chunked
  rendering, optional Free Play seeds, full-world navigation, and seed-aware
  persistence. Starter routes remain compact; distant factories keep producing.
- Milestone 6 adds fuller grass/wildflower meadows, reed-lined wooded riverbanks,
  and stone/lichen/scrub uplands with rounded shrubs. Blended ground and
  foreground-canopy fading preserve construction clarity, bounded rendering,
  and existing seeded-world saves.
- Mobile and short-screen Home views now start at 100% zoom, frame the starter
  around the HUD, and preserve camera position/zoom through resize. Active
  smelters have fuller overlapping smoke; pause/reduced-motion gating remains.
- The superseded project experiment adds two finite physical-delivery expansion projects, retained
  project progress, unique optional extractor/depot rewards, and legacy-safe saves.
  Internal timings and desktop/touch/offline walkthroughs passed; see its gate above.
- Four residents now farm and haul physical food units into communal kitchens
  in Settlement. Consumption supplies nutrition, shortages preserve labor, and
  automation frees workers for other assigned deliveries. Existing factories
  are not converted; depot output is basic infrastructure in the new ruleset.
- Basic wood-funded housing and optional population growth are implemented,
  with population-scaled raw-food demand and prospective provisioning checks.
  No food processing or production discoveries have been implemented. No broad
  construction costs, tree felling, underground excavation, dynamic weather, power, defenses,
  or combat have been implemented.
  Real-device performance review and first-time-player pacing
  remain outstanding.
- Automatic building-level labor priorities and renewable wood gathering are
  implemented. Worker-first mining, tools/components,
  extractor-kit commissioning, and specialist invitations are planned, not
  implemented. Existing Settlement industrial machines remain automatic until
  the new worker-first ruleset is implemented.
- Roadmap now prioritizes milestone 8 worker-first industry and earned extraction;
  milestone 9 food processing/housing/growth; milestone 10 specialist discoveries;
  milestone 11 intersecting resources; milestone 12 broader earned construction;
  milestone 13 deeper logistics; milestone 14 atmosphere/livability;
  milestone 15 release polish. Power, defense, and excavation remain conditional.
- Next major work: milestone 8, extending 8A automatic labor delegation to
  resident-run mining/industry, then 8B tools/components and 8C the first earned
  extractor. Food processing and specialist arrivals follow the early housing
  slice, not the old project or
  construction-reserve sequence. This update records the selected plan only.
  First-time pacing and physical-device performance remain unverified;
  implementation of every subsequent experiment requires separate approval.
