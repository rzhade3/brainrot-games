# Authoring Break Rot levels

Start with **chamber-layouts.ts** for enclosed rooms or **classic-layouts.ts** for free-form brick arrangements. These files contain data, not generators. `catalog.ts` controls play order. `levels.ts` selects a blueprint and compiles a fresh runtime level each wave.

## Add a chamber arena

Copy a blueprint in `CHAMBER_LEVELS`, give it a unique `id` and `name`, and edit its rooms. No compiler or engine edits are needed to add a layout.

```ts
{
  kind: 'chambers',
  id: 'single-vault',
  name: 'Single vault',
  hint: 'Breach the floor.',
  rooms: [{
    id: 'vault',
    column: 0, row: 0, columns: 32, rows: 28,
    color: '#73dfc3',
    openings: [{ side: 'bottom', offset: 13, length: 5 }],
    rewards: [
      { power: 'add', depth: .95 },
      { power: 'triple', depth: .3 },
    ],
  }],
}
```

All room coordinates are **tiles**, starting at the top left. The chamber grid is 32 columns × 28 rows. Tiles are 20 world units apart, with origin (40, 80). Room dimensions include perimeter walls. The example's entrance spans five tiles starting 13 tiles from the left edge of the bottom wall.

- Rooms may sit beside one another or nest strictly inside an earlier room. List outer rooms first: later rooms replace the cells underneath them. Partial overlaps are rejected.
- `openings` replace wall cells with breakable gold gates. Offsets are local to the room: count from the left for top/bottom, from the top for left/right. Leave both corner cells intact.
- Adjacent rooms have two walls. Define a matching opening on **both** walls to connect them. For vertical connections, align the upper room's bottom opening with the lower room's top opening.
- All bottom wall cells outside openings become retractable floors. Other wall cells remain permanent. Floor-release timing belongs to the engine, not the blueprint.
- The compiler leaves a one-tile ricochet lane beside walls and fills the rest with small bricks. Horizontal gate runs of at least three tiles merge into one readable +3 lock. Smaller or vertical gate runs remain ordinary breakable gates.
- Rewards specify a power and preferred vertical depth within that room's brick carpet: 0 = top, 1 = bottom. Placement chooses an available adjacent pair of bricks, merges them into a readable tile, and keeps rewards at least 65 world units apart. Ties are deterministic. **Placement is best effort:** if a small/nested room cannot fit a pocket, it is skipped. Inspect the compiled level, not just the requested reward count. This preserves the existing small-room behavior.
- Room IDs are author-facing names. The compiler assigns numeric simulation IDs from room order; do not hard-code numeric room indices elsewhere.

## Add a classic arena

Copy a blueprint in `CLASSIC_LEVELS`. Edit its 20 strings of 14 cells: `#` places a brick, `.` leaves space. Every character is a tile; no boolean geometry expressions are needed.

Classic brick positions use origin (31, 90), spacing (47, 28), and brick size (42, 23), in world units. Obstacles use **world units**, not tile coordinates, because shelves and round bumpers need sub-tile placement. Use explicit `kind: 'steel'` rectangles or `kind: 'bumper'` circles.

`armorPattern` is a stable nonnegative seed for armor variation. It does not depend on where the level sits in the catalog. Shared armor progression and wave-seeded, spaced reward placement live in `compile-classic.ts`.

## Data, compilation, and simulation boundaries

| File | Responsibility |
| --- | --- |
| `types.ts` | Readable authoring schema and mutable runtime types |
| `chamber-layouts.ts`, `classic-layouts.ts` | Authored geometry and rewards |
| `catalog.ts` | Play order; validates definitions once at load |
| `validate.ts` | Contextual authoring errors (level/room IDs, bounds, openings, overlaps) |
| `compile-chambers.ts`, `compile-classic.ts` | Generic geometry generation, fresh runtime objects, difficulty scaling |
| `../engine.ts` | Collisions, gate breaking, floor release, scoring and lifecycle |

Level definitions are readonly at the TypeScript boundary. Runtime objects are new on every compilation, so playing or retrying cannot mutate the catalog. A new room arrangement needs only data edits. A genuinely new geometry primitive needs a schema/compiler change with tests; don't add `if (index === ...)` branches.

## Verify an edit

```sh
npm run test:breakout
npm run build
SIM_WAVE=1 SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout
```

`SIM_WAVE` is the one-based position in the combined catalog. Tests check every arena's overlaps, ball-sized reachability, swarm physics, and room lifecycle. Definition validation catches malformed maps, duplicate IDs, invalid bounds/depths, and ambiguous room overlap. It does **not** prove gameplay reachability or balance; retain the geometry tests and simulations.

`levels.test.ts` also fingerprints the first six cycles against the pre-refactor generator to prevent accidental gameplay changes during this migration. Intentional layout/balance changes should update the corresponding fingerprints after reviewing the generated geometry and rerunning simulations; never regenerate them just to hide a regression.
