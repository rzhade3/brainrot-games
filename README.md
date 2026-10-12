# Brainrot Games

A little arcade of browser games. Installable, offline-ready PWA built with Vite + TypeScript.

## Games

- **Pocket Factory** — clean-isometric settlement logistics. Four residents farm
  and carry goods automatically; keep the communal kitchen stocked and use
  conveyors to free carriers for other work. Industry, farming, hauling,
  extractor upgrades and depot output are available without missions or project
  gates. Set building work priorities; residents share farming, gathering and deliveries.
  Inspect bottlenecks and each depot's contents and capacity. Recovered
  cargo appears only in a depot's inspector when items are available. Splitters divide a
  line between straight/right outputs; connected conveyor branches merge fairly
  with visible junction tracks. Choose **Conveyor**, then a start and destination
  to connect a straight or L-shaped route. On touch, tap both endpoints and
  confirm **Build**; **Swap bend** changes the preview. Machine ports snap without
  replacing endpoints, and blocked routes build nothing. Drag on touch to pan;
  pinch to zoom without losing the preview. Toolbar **Undo** recovers route cargo.
  Free construction
  in a seeded 256x256 world with meadow, wooded riverbank, and rocky upland
  regions: fuller grass and wildflower patches, reed-lined wooded banks, and
  exposed stone with lichen, low scrub, and rounded shrubs. Choose an
  optional world seed with the same compact, tested settlement start.
  Chunked rendering lets you explore while distant
  factories keep producing. Local autosave and resume preserve the settlement;
  cached installations can resume offline. No combat or dynamic weather yet.
  See [the implementation plan](FACTORY-PLAN.md).
- 🧶 **Untangle** — drag nodes so no strings cross.
- 🏰 **Tower Defense** — mine ore, power turrets, defend your castle.
- ⌨️ **Type Rot** — type the words before they escape.
- 🃏 **Associations** — word solitaire: 30 levels of stacking every word on its category (some in order) before your moves run out.

## Develop

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview the build
npm run check:factory  # check geometry, production, residents, saves, and seeded worlds
```

Pocket Factory keeps one versioned settlement save in this browser's IndexedDB.
It saves every five seconds, after construction, priority changes, rotation, removal, recovery,
pause, and attempts a save when the page is hidden
or exited. Use **Settlement** to resume or start a new settlement and expand
**Save & offline** for save status, offline readiness, and the current world seed.
Replacement requires
confirmation and succeeds only after the new save commits. Save errors stay
visible with a retry action; another tab changing the save stops autosaving
until reload. Clearing browser data deletes local saves; they are not synced
or an external backup.

Saves record the world's seed, generator version, residents and physical cargo.
The automatic-labor revision uses save version 4 and `settlement-v4`. All earlier
saves, including Guided Run, Free Play and the earlier Settlement format, require
a new settlement. They are left untouched until replacement is explicitly
confirmed. No save migration is provided.

For offline launch, run the production build and wait for **Offline ready**
under **Settlement → Save & offline**.
The development server does not cache an offline installation. Production and
recipes resume from their saved state, without producing anything for time
spent away. Sudden termination can lose changes since the last completed save.
