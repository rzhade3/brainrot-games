---
name: associations-levels
description: Add Associations levels or tune word-card deals, categories, ordering requirements, or move budgets.
---

# Associations level authoring

Edit `src/games/associations/levels.ts` for the playable level specs and `src/games/associations/categories.ts` for the shared word pool. Append new specs when extending the campaign to keep existing level numbers stable. Match the nearby curve for groups, ordered groups, tableau columns, slots, and word count. `spare` is the move allowance above the generator’s solution length.

Run `npm run build:associations-layouts` to regenerate `layouts.json`, then `npm run check:associations-layouts` to check deterministic output and solver validation under each move budget. Category-pool edits can regenerate existing deals too. Inspect which levels changed and keep the source and generated data together. The browser loads the generated layouts through `layouts.ts`.
