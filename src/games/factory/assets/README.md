# Factory artwork

An existing building's art and clickable silhouette can change here without
changing gameplay, tile occupancy or saves.

- `art.ts`: visual-state interfaces, procedural drawing, palette and moving parts.
- `picking.ts`: convex selection outlines, bounds and depth-ordered picking.
- `landscape.ts`: terrain palette and canvas drawing from sampled appearance.
- `icons.ts`: catalog and inspector silhouettes.
- `preview.html` / `preview.ts`: shared drawing with facing, cargo, activity,
  progress, origins and selection outlines, without a running settlement.

**The preview is temporary. Remove it once artwork stabilizes**, including the
`factoryAssets` entry in the root `vite.config.ts` and preview-specific browser
checks. Until then, open `/src/games/factory/assets/preview.html` with `npm run dev`.
Do not expand it into another application or add a separate build configuration.

Keep `(0, 0)` at the tile's ground center. Update `BUILDING_SHAPES[kind]` after
changing a silhouette; each outline must be convex and bounds must enclose it.
Keep ports/cargo aligned and honor the motion-paused flag. Asset functions receive
plain appearance/activity data, not live simulation objects.

State adapters live in `../rendering/art.ts` and `../rendering/landscape.ts`; shared resolution and
prop-cache anchors live in `../rendering/platform.ts`. Run `npm run check:factory` and
`npm run check:factory:ui` after edits. Compare renderer baselines for heavier art,
including long pans, dense scenes, DPR-3 touch and reduced motion. The UI check
changes a roof/outline in memory, proves live and preview drawing share assets,
then restores exact pixels without changing the simulation save.
