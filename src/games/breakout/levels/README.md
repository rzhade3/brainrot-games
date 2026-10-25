# Level authoring and generation

All generators return the same `Level`: explicit world-coordinate bricks, obstacles, and optional floor-release groups. The engine never interprets tile symbols, templates, or procedural operations. Use the least complicated authoring mechanism that fits the level.

## 1. Plain authored map

Use `authoredMap(id, version, map)` from `registry.ts` for exact geometry. Add the resulting generator to the `GENERATORS` play-order array. No seed handling, group names, or procedural configuration is required:

```ts
const courtyard = authoredMap('courtyard', 1, {
  name: 'Courtyard', hint: 'Bank the shot.',
  origin: { x: 40, y: 80 }, pitch: 20,
  rows: [
    'BBBB....BBBB',
    'B..........B',
    '....T.......',
  ],
  legend: {
    B: { kind: 'brick' },
    T: { kind: 'brick', power: 'triple', span: 2 },
  },
});
```

Rows must have equal lengths. `.` is empty. Each other character is an anchor defined in the legend. A two-wide reward consumes its anchor and the next dot; occupying that reserved cell is an error. Bricks default to one hit with a two-unit gap. `span`, `gap`, `hp`, `power`, and `gate` are explicit; the compiler never searches for somewhere else to place a reward. Steel occupies a full tile.

Coordinates and pitch convert the map to world units. Existing arena bounds are x=12…708 and y=24…728 (the paddle is at y=848). Validation also checks physical accessibility for a ball with radius 6.

Behavior is optional and separate from geometry. A map's `groups: [{ color: '#73dfc3' }]` creates a floor-release group. Bricks use `group: 0`; steel floor tiles use `vent: 0`. These are shared behavioral references, not names for every visual room. Ordinary maps need no groups. The existing engine retracts grouped floors at 18% remaining or 28 seconds after the first destroyed group brick.

## 2. Parameterized family

Read `twin-vaults-map.ts` and `twin-vaults.ts`. The map explicitly places walls, bricks, connections, powers, and floor groups. Its small family-specific generator:

1. Chooses each five-tile entrance from four centered offsets within its own floor.
2. Chooses solid, sparse diagonal, or horizontal-band brick filling, with a seeded phase.
3. Preserves every power tile, connecting gate, perimeter and interior lane.
4. Applies the existing sparse later-cycle armor rule.

No general operation language is involved. Structural choices are valid by construction; shared validation checks the result. Family-specific decisions stay in the family file rather than becoming flags on unrelated generators. Every generated Twin vaults board must contain at least six +3, four ×3, two wide and two fire tiles. Missing rewards are errors, not silently skipped placements.

## 3. Custom algorithm

Implement `LevelGenerator` when a map is inconvenient:

```ts
const generator: LevelGenerator = {
  id: 'my-family', version: 1,
  requiredRewards: { triple: 1 },
  generate(context) {
    // Construct explicit bricks/obstacles using context.seed and difficulty.cycle.
    return board;
  },
  fallback(context) {
    // Return a fresh, known-valid authored board for this difficulty.
    return safeBoard;
  },
};
```

The inputs are an unsigned 32-bit seed, one-based wave, and difficulty cycle. Use `random(seed)` for local randomness; never `Math.random()` in generation. Helpers are optional: algorithms return the same runtime board directly. More complex geometry primitives require engine support and tests; they are not implicitly supported by the generator interface.

## Validation, retries, and reproducibility

`generateLevel()` validates each candidate's bounds, durability, rectangle overlaps, bumper/rectangle overlaps, group references/counts, required rewards, and conservative ball-center reachability. Destructible tiles are removed for the reachability check, so this proves potential access, not a viable winning strategy. Existing simulation tests complement it.

Invalid map/schema input throws immediately. Invalid candidate placements get **three deterministic attempt seeds**. Exhaustion throws by default, including tests and the Vite development server. Production explicitly permits a fallback, which must pass the same validation; the engine logs its replay inputs and failure reasons. Never catch arbitrary generator exceptions and treat them as normal retries.

Results contain:

- `board`: the fully resolved layout.
- `replay`: generator ID/version, original seed, wave, and difficulty.
- `diagnostics`: attempt seeds, rejected-board reasons, and whether fallback was used.

Version is part of the replay identity. Bump it when generation behavior changes. A seed alone is not a cross-version guarantee. Save the complete result with `JSON.stringify(result)` for exact fixtures; replaying an old seed requires that version's code or the saved board. The engine keeps the initial result separate from its mutable gameplay objects. Browser restarts choose a new cryptographic seed; waves within a run retain it. Headless `new Breakout(wave, seed)` reproduces procedural runs.

## Existing boards and migration

`LEGACY_GENERATORS` adapts the eleven existing definitions without changing their output. Version 0 adapters use `chamber-layouts.ts`/`classic-layouts.ts` and the older compilers. They are retained for compatibility, not prescribed as the format for new families. `makeLevel(wave)` selects this compatibility path; the 66-wave fingerprints continue checking it. The browser uses `generateWave()` through a seeded `Breakout` instance, selecting Twin vaults version 1 and the ten unchanged adapters.

The old room compiler's preferred-depth reward placement remains best-effort, as required for exact compatibility. It is not used by the new Twin vaults family. New map definitions place rewards explicitly and declare required counts at the generator boundary.

## Files and checks

| File | Responsibility |
| --- | --- |
| `types.ts` | Runtime board and legacy authoring types |
| `tile-map.ts` | Literal map schema and compilation |
| `generation.ts` | Generator contract, local PRNG, retries, replay metadata |
| `registry.ts` | Generator adapters and playable order |
| `validate-board.ts` | Common physical/behavior/reward validation |
| `twin-vaults-map.ts`, `twin-vaults.ts` | Authored example and first procedural family |
| `validate.ts` | Legacy definition validation |

```sh
npm run test:breakout
npm run build
SIM_GENERATED=1 SIM_WAVE=1 SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout
```

Tests cover six compatibility cycles, 128 procedural seeds with exact replay, all entrance combinations, missing rewards, sealed targets, bad footprints/references, bounded retries/fallbacks, custom generators, map-only generators and swarms. Simulations report balance separately; seeds are not labels for human skill. Inspect desktop/touch play and a spread of generated layouts before accepting new families.
