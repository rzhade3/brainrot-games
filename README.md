# Brainrot Games

A little arcade of browser games. Installable, offline-ready PWA built with Vite + TypeScript.

## Games

- **Pocket Factory** — clean-isometric automation: choose Guided Run or Free Play.
  Build copper production, deliver 16 plates to unlock assembly, then combine
  iron and copper into 12 defense supplies for the outpost. Free Play starts
  without factories, with all machines unlocked. Inspect bottlenecks,
  track deliveries, and inspect each depot's contents and capacity. Recovered
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
  optional Free Play seed; Guided Run keeps a compact,
  tested starting site. Chunked rendering lets you explore while distant
  factories keep producing. Local autosave and resume work in both scenarios;
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
npm run check:factory  # check geometry, production, progression, saves, and seeded worlds
```

Pocket Factory keeps one versioned factory save in this browser's IndexedDB.
It saves every five seconds, after construction, rotation, removal, recovery,
pause, and objective transitions, and attempts a save when the page is hidden
or exited. Use **Scenarios** to resume or replace a factory and expand
**Save & offline** for save status, offline readiness, and the current world seed.
Replacement requires
confirmation and succeeds only after the new save commits. Save errors stay
visible with a retry action; another tab changing the save stops autosaving
until reload. Clearing browser data deletes local saves; they are not synced
or an external backup.

Saves record the world's seed and generator version. The 256x256-world revision
replaced the old study-site format: incompatible saves require a new factory,
with an explicit warning and confirmation before replacement. No save migration
is provided. The biome-art update preserves existing seeded-world saves,
terrain/buildability, and production rules.
The logistics update also preserves existing seeded saves; new saves retain
splitter cargo and which output to prefer next.

For offline launch, run the production build and wait for **Offline ready**
under **Scenarios → Save & offline**.
The development server does not cache an offline installation. Production and
recipes resume from their saved state, without producing anything for time
spent away. Sudden termination can lose changes since the last completed save.
