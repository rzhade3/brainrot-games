---
name: tower-defense-levels
description: Design Tower Defense terrain or tune escalating waves, spawn timing, and starting economy.
---

# Tower Defense level authoring

For terrain, start at `Grid.generate(cols, rows)` in `src/games/tower-defense/grid.ts` and its call in `TowerDefenseScene.resetGame()`. The existing run creates a random grid with ore around a central castle. Keep an open building ring and enough usable ore for the opening economy. Tile coordinates are separate from the scene’s pixel layout and placed building occupancy.

For wave content, edit `waveComposition(n)` in `enemies.ts`. Prep, spawning, and wave completion are managed by `WaveManager` in `waves.ts`. Use `npm run build` and play through the changed map or waves. Check that mining and powering defenses are viable before pressure ramps up, that enemies enter and reach the defense, and that the transition to the next prep phase fires.
