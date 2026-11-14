---
name: hole-city-levels
description: Create Hole City maps or tune seeded prop placement, spawns, traffic, or growth pacing.
---

# Hole City level authoring

Use the existing map contracts in `src/games/hole-city/main.ts` as a template. Downtown’s `city(seed)` and spawn points live in `engine.ts`. Supermarket’s placement and starts live in `supermarket.ts`, its floor and props in `supermarket-scene.ts`, and moving routes in `traffic.ts`. A new selectable map needs a generator, spawn points, growth labels, a distinct score key, and picker and scene wiring. The growth labels describe the shared `MILESTONES` in `engine.ts`.

Check that all starts have reachable opening food and that players can reach later tiers without exhausting the map’s early food or becoming stuck at the world boundary. Run `npm run test:hole-city`. For existing maps, use `node --import tsx scripts/simulate-hole-city.ts` with `--supermarket` for that variant. A new map needs to be selected explicitly in any simulation used to assess it.
