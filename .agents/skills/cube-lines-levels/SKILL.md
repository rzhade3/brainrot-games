---
name: cube-lines-levels
description: Add Cube Lines campaign puzzles or tune seeded Endless puzzle selection and difficulty.
---

# Cube Lines level authoring

For campaign work, edit the specs in `src/games/cube-lines/levels.ts` and run `npm run build:cube-lines` to regenerate `layouts.json`. If extending the campaign length, check the hard-coded total in `main.ts` and the campaign length assertions in `rules.test.ts`. Keep existing numbered layouts stable when adding puzzles so in-progress removal IDs still refer to the same lines.

For Endless, distinguish the preset rotation in `puzzle-code.ts` from the fixed edition-one specs in `generate.ts` that published puzzle codes use. Preserve edition-one generation for existing codes. Use `npm run build:cube-lines-catalog` when changing curated candidate selection. It writes `catalog.json` as screened seed lists.

Run `npm run check:cube-lines` for campaign reproducibility and `npm run test:cube-lines` for rules, saves, generation, codes, and catalog coverage. See the [generation guide](../../../docs/cube-lines.md) for the existing quality gates.
