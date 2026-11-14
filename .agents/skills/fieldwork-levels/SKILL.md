---
name: fieldwork-levels
description: Add Fieldwork fields or tune seeded obstacles, workable acreage, unlocks, or fuel difficulty.
---

# Fieldwork level authoring

Start in `src/games/fieldwork/engine.ts` at `makeField(level, seed)`. It builds the obstacles and the workable-cell mask together. Give obstacles their safety margins and leave headlands and turning room for the widest plough. Note that fuel capacity depends on workable area and plough width, so a geometry change can also affect difficulty.

For additional fields, update the numbered name/geometry mapping, the practice picker and unlock limit in `main.ts`, and the simulation’s field range. Preserve existing numbered records when appending a field. Run `npm run test:fieldwork` and `npm run simulate:fieldwork`. The lane and detour bots measure coverage, collisions, and fuel. Verify the 98% completion target with actual driving, especially around obstacle cutouts. See the [field and fuel guide](../../../docs/fieldwork.md).
