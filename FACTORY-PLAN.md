# Pocket Factory implementation plan

Status: milestones 1-5 implemented on `feat/pocket-factory`. The visual direction
is approved. The seeded 256x256 world, chunked rendering, and seed-aware saves
are functional. First-time-player pacing and physical-device review, including
the agreed-phone performance benchmark, remain outstanding. Milestone 6 and
later work require separate implementation authorization. Next comes distinct
biome art, then atmospheric weather and environmental polish. Production-fed
defense is deferred until that peaceful experience is evaluated.
This is an exploratory prototype: future milestones may replace terrain,
generator, and save formats without backward compatibility or migration work.
Breaking revisions may require a fresh factory; communicate that explicitly.

## Goal

Add a standalone, mobile-first factory automation game to Brainrot Games.
Players extract resources, connect machines, resolve bottlenecks, and use their
output to supply a small outpost. Build an inviting, finite 256x256 procedural
world with distinct landscape regions and gentle weather before introducing
combat. Keep the starter factory and resources close together so exploration
is optional, not a prerequisite for production. Preserve the calm,
clean-isometric visual direction and offline play after resources finish caching.

## Gameplay direction

The milestone 2 sandbox provided the automation foundation but lacked demand,
interdependent recipes, and a completion moment. Milestone 3 now adds a bounded
guided run: build copper production, unlock mixed-metal assembly, and supply an
outpost. Free Play starts with an empty site and all machines unlocked.
Milestone 4 preserves investment through local autosave and resume. Milestone 5
expands the site into a seeded, explorable world while keeping starter production
local. The next milestones enrich the place players build in, without changing
production rules or adding environmental chores.

Near-term arc:

Choose a landscape -> explore a playable site -> build and fulfill demand ->
enjoy a changing environment -> save and return to the same world.

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

The narrative premise is protecting an isolated outpost and its supply operation.
The exact attacker identity and story remain open; the first prototype needs a
clear protected target and consequence, not extensive lore.

### Design guardrails

- Begin with a short, bounded production objective. Target a 5-10-minute
  production introduction and, later, a 20-30-minute complete defense run.
  These are playtest hypotheses, not durations inferred from recipe counts.
- Give each objective a material sink, visible progress, and a useful reward.
  Prevent completed orders from accepting and silently discarding extra items.
- Show delivered throughput, missing ingredients, and defense readiness alongside
  local machine state. A backed-up extractor can reflect a slower downstream
  machine, not necessarily a player error.
- Keep production buildings free in the first prototype. Routing, recipe ratios,
  footprint, and throughput provide constraints; defense deployment and ongoing
  supplies give materials value without adding a whole construction economy.
- Add simple recovery-to-depot relocation in milestone 3. Make stored/recovered
  supplies available to production before combat spending becomes important;
  relocation into a storage-only depot is not automated replenishment.
- Persist progress before introducing a longer run or meaningful failure.
- Start with one defended outpost, one enemy type, one fixed approach, and one
  automatically firing defense. Preserve the factory after defeat; offer a
  coherent pre-raid retry rather than tedious rebuilding.
- Raids and countdowns follow simulation time: pause, suspension, and backgrounding
  stop them. No attacks or production occur while the app is closed.
- Keep peaceful free play available. Validate whether danger motivates factory
  improvements instead of distracting players from them.
- Keep initial weather atmospheric: no machine shutdowns, production penalties,
  flooded construction, resource depletion, or weather-management UI.
- Procedural variation must preserve reachable resources and usable building
  space. Validate the site instead of trusting attractive noise patterns.
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

## Proposed first-release scope

This table describes the revised near-term target, not shipped behavior.
Milestones 1-5 are implemented, including the seeded 256x256 world and basic
region rendering; polished biome art and weather are planned. Each subsequent
implementation milestone requires approval. Combat and power remain deferred.

| Area | Scope |
| --- | --- |
| World | Finite, seeded 256x256 tiles (65,536 total), organized into 32x32-tile chunks |
| Terrain | Meadow, wooded riverbank, rocky upland; accessible iron/copper and connected building space |
| Environment | Gentle clear/cloudy/rain transitions, restrained water/vegetation motion; atmospheric only |
| Buildings | Miner, directional belt, furnace, assembler, storage, outpost receiver |
| Production | Ore to plates; one mixed-metal defense-supply recipe; later components only when they add a new decision |
| Demand | Existing bounded delivery orders; no new weather-driven material sinks |
| Combat | Deferred; peaceful building remains the near-term focus |
| Progression | Existing objectives unlock assembly; completion followed by peaceful continuation |
| Failure | No environmental or combat failure in the living-world milestones |
| Power | Deferred until the production-defense loop proves it needs another constraint |
| Input | Mouse and touch placement, rotation, removal, pan, and zoom |
| Saves | Versioned local autosave, resume, and new world with optional seed |
| Offline | Cached launch, gameplay, and save/resume without a network |

Defer free-roaming attacks, general enemy pathfinding, damage to individual
production buildings, manual combat, multiple weapon/enemy trees, pollution-based
aggression, power/fuel, trains, fluids, multiplayer, infinite worlds, splitters,
underground belts, separate inserters, and production while the app is closed.
Build the large-world rendering foundation before adding biome detail or weather.
Map size does not expand the initial biome, recipe, or enemy feature list. The
existing defense proposal remains documented below, but is not a first-release
commitment.

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
not reset the factory or its selected machine.

The default HUD prioritizes the map, current mission, and construction controls.
Mission guidance, depot/recovery stock, machine descriptions, and detailed
save/offline information use expandable panels. Successful action feedback
clears after 4.5 seconds; invalid placement feedback remains until the next
action. Save failures automatically expand their full message and retry action.
The small "AN AUTOMATION STUDY" brand label and Free Play's desktop-only
"A little industry. A lot of possibility." headline retain the field-notebook
character without adding instructions. Compact layouts omit the headline to
leave room for the map. The duplicate live badge, repeated footer hints, and
long always-visible guidance remain removed.

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

In a selected depot's inspector, add one "Transfer recovered items here" action.
Transfer up to its remaining total capacity, in a stable item order: iron ore,
copper ore, iron plates, copper plates, then defense supplies. Move the source
and destination quantities atomically; leave any overflow in the tray.

Disable the action when the tray is empty or the depot is full, with an explicit
reason. Report what moved and what remains. No drag-and-drop inventory screen,
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
polished biome art follows in milestone 6, weather in milestone 7.

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
and accounting, not to establish real player completion times. Polished biome
art and dynamic weather have not been implemented.

## Milestone 6: Distinct biome art and cohesive landscapes

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

## Milestone 7: Atmospheric weather and environmental motion

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

## Milestone 8: Livability playtest and environmental polish

Evaluate the 256x256 living world before choosing more systems or more terrain.
Playtest both a fresh Guided Run and open-ended Free Play with varied seeds,
weather, and a developed factory. Focus on whether the place feels inviting,
regions are recognizable, and environmental detail enhances rather than hides
the automation.

Refine palette transitions, decoration density, motion strength, and weather
cadence from the results. Do not solve weak atmosphere by adding more biomes,
more particles, combat, or a larger empty map. Keep the calm visual language and
the compact HUD with on-demand guidance.

Acceptance:

- First-time players can find resources, build, inspect bottlenecks, and understand
  both orders without decoration or weather causing confusion.
- Players perceive coherent landscape regions and a changing environment, and
  have a reason to keep building or return to their saved site.
- Physical-phone checks cover touch, orientation, suspension, reduced motion,
  seeded save restoration, and fresh offline relaunch.
- An agreed device/factory benchmark meets its responsiveness/performance target
  with weather enabled; no unsupported physical-device claims from emulation alone.
- Document playtest findings and decide the next gate explicitly: optional defense,
  purposeful uses for the existing exploration space, or bounded environmental refinement.
  Completing this milestone does not automatically authorize those features.

## Milestone 9: Deferred production-fed defense proof

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
recipes, a small defense upgrade choice, or a simple global power constraint only
when each creates a distinct automation decision. Do not implement them together.
Factory destruction and free-roaming attackers remain outside first-release scope.

## Milestone 10: Release performance, accessibility, and polish

Agree on a reference phone and a specific factory-size benchmark before making
performance claims. Test both sparse terrain and a dense operating factory.
Target at least 30 FPS on that agreed device and benchmark.

Profile terrain rendering, belt animation, and simulation separately. Prioritize
visible-work culling and bounded simulation cost before increasing world size.
Respect reduced-motion preferences and provide readable labels, sufficient
contrast, and clear selected/invalid/disabled states beyond color alone.

Acceptance:

- Automated coverage for generation, weather, production, objectives, placement,
  persistence, and combat/checkpoint retry only if that optional scope is implemented.
- Real-device checks for touch gestures, orientation, suspension, and offline
  relaunch.
- No known item duplication/loss or destructive save failures.
- Performance targets met on the agreed reference device and factory benchmark.

## Planning estimate and risks

The previous 4-6 developer-week estimate does not describe this revised scope.
Estimate world generation/chunked rendering, biome art, and atmospheric weather
separately after their implementation gates are authorized. Re-estimate subsequent
work from the livability playtest; do not commit to combat or expansion beyond
256x256 in advance.

Largest uncertainties:

- Achieving the desired visual quality with original assets.
- Accurate, readable isometric placement on small touchscreens.
- Belt transfer correctness and congestion behavior.
- Cohesive procedural regions with local, guaranteed playable starts in a large world.
- Chunk rendering, memory residency, depth ordering, and navigation at 256x256.
- Weather/decoration readability, reduced motion, and effect cost on phones.
- Keeping current-version seeded worlds and saves deterministic as the prototype evolves.
- Making production-fed defense engaging without creating waiting, overwhelming
  pressure, or reconstruction chores.
- Balancing resource demand and raid difficulty for new players on touchscreens.
- Deterministic combat and atomic save/checkpoint restoration without duplication.
- Dense-factory performance on phones.
- Browser storage limits, save evolution, and offline cache lifecycle.

## Current state

- Plan persisted.
- Milestones 1-5 implemented at `/games/factory/`, accessible from the arcade
  hub. The milestone 1 visual direction is approved.
- Original vector-drawn isometric artwork and a seeded 256x256 world with real
  ore/plate transport, extraction, smelting, and storage. Free Play starts empty
  with all machines unlocked. Guided Run starts with the iron demonstration
  and a fixed outpost.
- Guided copper commissioning delivers 16 plates and unlocks the assembler;
  2 iron plates + 1 copper plate become 1 defense supply in 2 seconds. Delivering
  12 supplies completes preparation; continued building starts no new orders or raids.
- Mouse and touch selection, placement previews, placement, rotation, removal,
  camera pan/zoom/reset, and a contextual inspector.
- Construction navigation uses a compact Select / Build / Pause dock and categorized,
  scrollable building catalog. Rotation is contextual to placement or inspection;
  removal is available only in the selected building's inspector.
- Changes and inventories persist through versioned local autosaves. Item movement
  and machine activity reflect actual simulation state, not demonstration loops.
- The inspector shows live inventory, production progress, orientation, and
  blocked/disconnected/full states. Global counters show plates held in depots.
- Recovery-tray contents remain accounted for when machines or conveyors are
  removed and can be relocated into a selected depot without exceeding capacity.
  Depots still have no output. A manual pause/resume control freezes the whole factory.
- Reduced-motion preferences suppress continuous animations while the
  simulation continues.
- `npm run check:factory` covers tile projection, placement rules, the demo
  layout, rotation, depth-aware building selection, full production chains,
  per-step material conservation, bounded buffers, fair/deterministic transfers,
  mixed ores, invalid routing, congestion, recovery, repair, and fixed-step timing.
  The progression suite additionally covers recipes, objectives, consumed delivery
  accounting, scenario locks, recovery relocation, quotas, and actual delivery rates.
  The world suite covers 32 seeds, region/start constraints, deterministic
  generation, chunk coverage, remote production, and seeded save restoration.
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
- No polished biome art, dynamic weather, power, defenses, or combat have been
  implemented. Real-device performance review and first-time-player pacing
  remain outstanding.
- Roadmap updated: milestone 5 seeded 256x256 world and chunked rendering,
  milestone 6 biome art, milestone 7 weather, and milestone 8 livability playtesting
  precede optional defense in milestone 9. The large-world foundation is now
  implemented rather than a separate deferred expansion.
- Next gate: authorize milestone 6's biome art and cohesive landscapes. Guided
  pacing and physical-device performance still need playtesting; implementation
  of each subsequent milestone and any combat work require separate approval.
