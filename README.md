# Brainrot Games

A little arcade of browser games. Installable, offline-ready PWA built with Vite + TypeScript.

## Games

- 🧱 **Break Rot** — breach dense chambers, multiply a swarm, and catch the fallout across eleven cycling arenas.

- 🧶 **Untangle** — drag nodes so no strings cross.
- 🏰 **Tower Defense** — mine ore, power turrets, defend your castle.
- ⌨️ **Type Rot** — type the words before they escape.
- 🃏 **Associations** — word solitaire: 30 levels of stacking every word on its category (some in order) before your moves run out.
- 🧊 **Cube Lines** — rotate a 3D cube and release bent arrows in the right order across 30 relaxed puzzles.

### Cube Lines

Drag to rotate the cube; tap any part of a line to try releasing it. Its head travels straight,
and its bent body follows like a snake. Another line anywhere along the exit path blocks it.
Lines can wrap across cube edges onto up to three faces. The arrowhead exits straight off its
current face (it does not wrap forward); the body follows its existing route around the edges.
Any part of another line on the head's exit ray blocks the move, even if that other line's head
is on a different face. Blocked lines rush into the nearest
obstruction, jolt the view, and recoil without changing the puzzle. Reduced-motion mode uses
a stationary collision highlight instead. Clear all six sides to finish.
There are no timers, lives, or mistake penalties; hints are unlimited. Progress saves locally,
and cleared levels can be replayed. WebGL is required; all assets work offline after the PWA caches them.

Drag to tumble freely through any angle, including upside down; rotation has no pole stops
or upright lock. Pinch or scroll to zoom. Hint stays available during line animations
and immediately highlights the next clearable line, treating a departing line as removed.
The highlight survives the animation finishing. During a blocked recoil, hints use the
unchanged puzzle. Hint is disabled only when no lines remain to suggest or graphics fail.
Hint and How to Play (?) live in the header;
there is no bottom toolbar or reset/restart button. Legal removals cannot make a puzzle unsolvable.

The campaign starts with 8×8 faces and 26 lines on Level 1: 23 wrap across edges, 20 start
blocked, and the cube has eleven dependency layers. Later tiers increase to 12×12 faces,
longer paths, and stronger cross-face dependency targets. Every layout links all six head
faces through its dependency graph instead of presenting six independent puzzles.
The campaign uses the v4 in-progress save key; cleared-level scores are retained and
players returning from v2/v3 see a notice that their active cube starts fresh.

A dismissible first-move tip explains straight exits without simplifying the puzzle.
The counter tracks cleared faces as well as remaining lines; hints identify the highlighted
path rather than screen-relative directions. Help opens over the game without moving the
cube, and the level picker uses a simple numbered grid with a compact “✓ Cleared” legend.

Gameplay is mouse/touch only. The alternate text puzzle and gameplay keyboard shortcuts
were removed to keep the experience focused on the cube. Standard keyboard navigation of
buttons and dialogs remains available. How to Play covers only releasing lines, rotating,
zooming, and clearing the six faces.

#### Generation rules and endless-mode foundation

`generateLevel(spec, seed)` accepts an unsigned 32-bit seed independently of the campaign
level number. Identical specs/seeds reproduce identical layouts. Generation works backward:
each new path must have a clear exit against the paths already placed, but its body may block
older exits. The reverse insertion order is therefore a solution. A final production-rules
solver and structural validator independently check each accepted puzzle.

Generation uses integer cell IDs over six connected grids, with cached typed-array neighbor
tables and face-local exit rays for each grid size. An occupancy array answers collision queries
directly. A cell-to-exit index identifies paths blocked by a proposed body, counting each
blocking line once even when it intersects an exit several times. Accepted paths update blocker
counts, per-face coverage, and a sparse dependency graph incrementally; dependency depth is
computed in reverse insertion order, which is already a topological order.

These indexes are internal to generation. The layout format, multi-face rules, campaign data,
save keys, candidate ordering, and random-number consumption are unchanged. Regression tests
compare indexed topology and every campaign insertion's metrics against the independent
coordinate-based rules, and preserve exact output hashes for 60 additional seeds across all
five grid sizes. `check:cube-lines` also compares all 30 generated campaign layouts byte-for-byte.

Accepted puzzles must satisfy all of these gates:

- No overlapping cells, invalid edge jumps, self-intersections, self-blocked exits, or dependency cycles.
- At most two edge crossings and three faces per path, keeping routes traceable.
- At least 65% total surface coverage and 40% on every face, with heads on all six faces.
- Tier-specific minimums of 60–66% initially blocked, but at least three available moves; dependency depth is
  bounded above to avoid a nearly forced, single-move hunt.
- At least 75% bent paths, 60% multi-turn paths, and 35% at least one face-width long.
- Tier-specific minimums for wrapping paths, cross-face blockers, and dependency depth;
  cross-face dependency links must connect all six head faces.

Choose **Endless** in the level picker to play newly generated cubes. The header simply reads
“Endless”; the clear count still drives progression, and each completion offers the next cube. Campaign levels and Endless retain
separate progress, and switching back to the same campaign level resumes its saved moves.
The browser remembers your last mode.

Endless unlocks a higher preset every five clears, capping face grids at 12×12 and unlocking
the final quality targets after 25 clears. Each five-cube stretch mixes three cubes at the
highest unlocked preset with one at the previous preset and one rotating through the lower
unlocked presets. After all presets unlock, the rotation continues to revisit every grid size
from 8×8 to 12×12 rather than remaining at 12×12 forever. Smaller cubes use their established
cross-face quality targets as breathing room, not weakened generation fallbacks. The rendered
cube stays the same size on screen, so the change adds pacing without shrinking touch targets
indefinitely. `selectEndlessPreset(cleared)` selects the preset; `endlessSpec(preset * 5)`
retains the exact existing specification used by puzzle codes.
The six edition-one specifications are fixed independently of campaign settings, including
their exact numeric thresholds; campaign tuning must not alter published puzzle codes.
Generation runs in a dedicated module worker, with one puzzle prefetched while
the current cube stays playable. Endless first selects unseen entries from a checked-in catalog
of 100 seed/preset pairs (16–17 per preset), not stored layouts. The catalog was selected
deterministically from 128 candidates per preset. In addition to the standard generation gates,
each entry has 3–8 opening moves, at least 65% wrapped lines and 40% cross-face blockers,
and dependency depth no greater than 65% of its line count. A fixed-order greedy solve rejects
more than six consecutive forced moves or more than 35% forced moves, ignoring the final three
cleanup moves. These are structural quality heuristics, not a guarantee of subjective fun or
a measurement of every possible solve order.

Catalog selections, including prefetched cubes, are remembered locally across reloads.
When the selected preset's unseen catalog pool is exhausted, Endless generates fresh seeds
subject to the same deterministic screening, with the existing bounded retry budget.
Explicit code replays remain unrestricted and reproduce their original layouts.
There is no server, telemetry, or automatic collection of player ratings. To expand or tune
the catalog over time, update the offline screening script and review its generated seed list;
existing accepted cubes and puzzle codes remain unchanged.

The last 12 accepted seeds and layout signatures prevent
recent repeats (signatures ignore line IDs/order). Prefetched puzzles are saved too, so a reload
does not discard an accepted cube or require it to be regenerated.

`brainrot-cube-lines:endless:v1` stores clear count, seed, generator edition, the accepted layout,
legal removal sequence, recent history, and the next puzzle independently of campaign scores.
It also stores the catalog entries already accepted so they are not offered repeatedly.
Restore validates the stored layouts and replays moves rather than regenerating from a seed.
Completing/restoring the same cube cannot increment the clear count twice.
Existing active and prefetched cubes are kept when the size schedule changes. Older saves
without preset metadata retain their original progression mapping for sharing. Only future
generation uses the varied schedule; edition-one puzzle codes still reproduce identical layouts.

The search is bounded to 100 attempts per seed and a size-scaled candidate budget. Repeat
avoidance, quality rejection, and exhausted-seed retries share a budget of eight seeds;
only the explicit generation-exhaustion error is retried, while programming errors surface
immediately. Explicit code replay never substitutes a different seed.
The worker is terminated after 15 seconds. Generation,
worker startup, and timeout failures show an explicit retry action using a fresh seed, never
a weaker fallback or replacement of the current cube. Switching modes cancels pending work,
and stale results cannot change the active puzzle. The built worker is included in the PWA's
offline cache.

#### Shareable puzzle codes

Open the level picker and expand **Play or share a puzzle code**. In Endless or a shared cube,
**Copy code** shares the complete original puzzle, not your removal progress. Paste a code into
**Play a code** to start that cube fresh. Input accepts lowercase and surrounding whitespace;
it requires the full code rather than a bare numeric seed.

Codes such as `CL1-T1-0000002A` encode generator edition (`CL1`), exact difficulty preset
(`T1`–`T6`), and an eight-digit hexadecimal unsigned 32-bit seed. T1–T5 use 8×8, 9×9, 10×10,
11×11, and 12×12 faces respectively; T6 retains 12×12 faces with the final, stronger quality
targets. Encoding the exact preset matters because grid size and seed alone do not identify
a puzzle. Explicit replays bypass recent-repeat avoidance, but retain all generation budgets,
quality gates, and solvability checks. A failed replay never replaces your active cube.

Shared cubes save their own layout and moves under `brainrot-cube-lines:shared:v1`, resume
after reload, and never increment Endless clears or unlock campaign levels. Finishing one
offers **Back to Endless**, which resumes your existing Endless cube and progress.
Unsupported generator editions are rejected explicitly rather than silently generating a
different puzzle. Future generator changes must retain the old edition's implementation
to keep its codes playable; accepted saved layouts remain playable without regeneration.

The game uses original layouts and visuals inspired by
[CubeAway - 3DPuzzle](https://apps.apple.com/us/app/cubeaway-3dpuzzle/id6760325543).
It is not affiliated with GOODROID and does not reproduce its levels, branding, or paid features.

```bash
npm run build:cube-lines  # regenerate the 30 seeded, solver-checked layouts
npm run check:cube-lines  # verify reproducibility, tier targets, and full solutions
npm run test:cube-lines   # rules, face geometry, animation paths, saves, and campaign tests
npm run build:cube-lines-catalog # deterministically screen candidates and rebuild the 100-seed catalog
```

## Develop

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview the build
```

### Break Rot

Open `/games/breakout/`. Drag to position the paddle before launch, then steer with touch,
mouse, or arrow keys / A and D. Space launches; P pauses. Paddle edges aim the rebound.
Instructions and obstacle explanations live in Help; the play screen shows only the score,
wave, lives, active effects, and multiball count. The phone layout fits the viewport, including small screens, and landscape puts the HUD
beside the arena. Pause contains sound and restart; restarting uses an in-game confirmation.
Backgrounding pauses automatically. Sound is opt-in; reduced motion disables trails/particles.

Three dense chamber layouts open the eleven-arena cycle: Twin vaults, Nested rings, and Honeycomb cascade. Gold +3 locks send a breach into the room; two-wide reward tiles remain readable on phones. Mint-edged floors retract at 18% targets remaining or 28 seconds after the first destroyed tile. Retraction persists through a lost life. Chamber serves use a 138-unit paddle, 480-unit starting speed (plus wave/rally scaling), and a 780-unit speed cap. The 48-ball cap and fresh-wave reset still apply.

The eight classic layouts follow with their original geometry: Split decision, Diamond
circuit, Slalom, The vault, Constellation, Hourglass, Switchback, and Orbit. Steel shelves and
vault walls are indestructible, including during fireballs and explosions. Circular bumpers
reflect balls radially and boost their speed by 8% up to the global cap. Permanent obstacles
do not count toward clearing. Numbers on bricks show remaining hits; the last five targets
receive a white outline. Later cycles increase armor (up to six hits), and wave/rally speed
is bounded. Repeating long flights are gently redirected after 14 seconds without teleporting.

Each serve starts with **one ball**. Eight spaced power tiles per classic layout (chambers use authored reward pockets) activate on impact:
×3 triples live balls, +3 adds three (48-ball cap), ↔ widens the paddle for ten seconds,
F pierces bricks for four seconds, ✹ damages nearby bricks by two, S rescues one falling
ball, and ~ slows motion for five seconds. Fire/slow timers cap at eight/ten seconds;
wide refreshes rather than growing permanently, and saves do not stack. Rapid hits build a
score combo up to ×10. Bombs may trigger fragile powers but never erase reinforced armor for free.

A clear pauses on a summary screen; Next wave previews the new geometry before launch.
Balls, upgrades, and rally speed reset between waves and after losing a life. A run has three
lives with no per-wave regeneration. Scores use `breakout-v3` for the denser chamber rules; previous scores remain stored separately. No new runtime dependencies or external assets are needed.

```bash
npm run test:breakout       # physics, lifecycle, layout overlap/accessibility, and full-army tests
npm run simulate:breakout   # seeded stationary, reactive, and predictive controllers
SIM_WAVE=8 SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout
```

See [the gameplay evaluation](docs/breakout-evaluation.md) for the old/new simulation results,
controller limitations, tuning decisions, and reproducible commands.

See [chamber balancing](docs/breakout-chambers.md) for the new layouts and seeded results.

For new arenas, use the [declarative level authoring guide](src/games/breakout/levels/README.md). New levels use literal maps, parameterized families, or custom generators behind one validated board interface. Twin vaults varies entrances and brick patterns from a reproducible run seed; existing layouts retain compatibility adapters.
