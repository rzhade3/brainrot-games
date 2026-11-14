---
name: gate-runner-levels
description: Author Gate Runner stages or tune procedural gates, enemy waves, hazards, or bosses.
---

# Gate Runner level authoring

Edit `generate(seed, stage)` in `src/games/gate-runner/engine.ts` for encounter placement and stage composition. Keep seed and stage sufficient to reproduce the road. Use the existing segment types and accessible gate positions, and check the order and distance between gates, waves, hazards, and the boss. When adding a stage, also check the stage-five completion condition and the simulator’s stage summary.

Run `npm run test:gate-runner` for generation and encounter behavior. For a quick balance probe, run `SEEDS=12 npm run simulate:gate-runner`. For campaign balance changes, compare across a larger seed range and review the policies and assertions in `scripts/simulate-gate-runner.ts` before using `--check`. Play the changed stage and record the seed and stage for pacing issues. See the [difficulty notes](../../../docs/gate-runner-difficulty.md).
