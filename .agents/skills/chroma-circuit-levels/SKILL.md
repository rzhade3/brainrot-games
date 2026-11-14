---
name: chroma-circuit-levels
description: Add Chroma Circuit pixel-art mosaics, shooter layouts, or puzzle progression.
---

# Chroma Circuit level authoring

Add a named 26×26 mosaic using the palette and `PixelArt` helpers in `src/games/chroma-circuit/art.ts`. In `levels.ts`, give the new artwork a finite per-lap ammo limit and include the built puzzle in the exported `puzzles` order. Adding to `artwork` alone leaves it out of play. The build index affects ammo and lanes. Preserve existing artwork indices, the original name ordering used for save migration, and the two-move Panda tutorial. Current clears are keyed by unique level name.

Run `node --import tsx --test src/games/chroma-circuit/engine.test.ts`. The suite checks color ammo totals and replays the winning launch sequence for each exported puzzle. Confirm the new name appears in the test output and the puzzle appears in the level picker.
