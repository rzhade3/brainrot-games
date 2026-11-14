---
name: breakout-levels
description: Author Break Rot (Breakout) brick maps, chamber layouts, or seeded wave families.
---

# Break Rot level authoring

Start with the [level-authoring guide](../../../src/games/breakout/levels/README.md) for map syntax, generator examples, replay metadata, and simulation flags. For an exact board, use `authoredMap(id, version, map)` and register it in the playable `GENERATORS` order in `src/games/breakout/levels/registry.ts`. `makeLevel()` and `LEGACY_GENERATORS` serve the compatibility path. For a procedural family, follow `twin-vaults-map.ts` and `twin-vaults.ts` for seeded variation and explicit reward placement, and bump the generator version when its output changes.

Run `npm run test:breakout`. For generated waves, run `SIM_GENERATED=1 SIM_WAVE=1 SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout` with the playable wave number. The reachability check ignores destructible tiles, so play the board to verify that shots, entrances, and rewards are practical. Record the wave, seed, and generator version for any layout that needs adjustment.
