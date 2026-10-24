# Fieldwork

A standalone top-down tractor coverage game at `/games/fieldwork/`, inspired by the FS25 ploughing clip. Original procedural canvas artwork; no third-party game assets. This first PR is a playable draft, not a final balance sign-off.

## Play

Hold and drag on the field to steer toward the pointer, release to brake, and hold Reverse to back out. Keyboard: WASD/arrows, P/Escape to pause. Reversing lifts the plough. Grass is driveable turning space. Tractor bodies collide with tree/turbine islands and fences; the implement clips its work to the field mask, rather than physically colliding.

Clear 98% to finish. Timed contracts unlock six fixed seeded layouts with additional islands, a cut-out corner, and a tapered edge. Three implements trade coverage and speed against turning radius. Practice exposes all six fields without a clock and never awards progression or a high score. Failed contracts can continue in practice without erasing their furrows.

Stars: finish = one; at least 70% efficiency and at most three impacts = two; at least 84% efficiency, zero impacts and 15% time remaining = three. Local progress uses `fieldwork-v1`; best score uses the arcade's shared score store. Missing/corrupt storage does not prevent play.

## Architecture

- `engine.ts`: DOM-free deterministic field masks, tractor motion, fixed-step input, swept blade coverage, repeated-pass accounting, collisions, scores and terminal states.
- `render.ts`: cached terrain and furrows, tractor, trees, wind turbines, dust and impact feedback. Only newly worked cells update the terrain cache. Reduced motion disables dust and turbine animation.
- `main.ts`: menus, input, persistence, background pause and accessibility announcements. The engine advances at 60 Hz independently of rendering. Long frames are capped; background tabs pause rather than consuming the contract timer.

Coverage uses 5-unit cells. Work increments on distinct blade visits, not every simulation frame. A 2% allowance avoids requiring pixel-perfect edge cleanup. Remaining cells brighten after 90% coverage.

## Validation and known limits

Run `npm run test:fieldwork`, `npm run simulate:fieldwork` and `npm run build`.

Six automated tests cover 120 deterministic layouts, masks, stationary/reverse behavior, contiguous sweeps, implement differences, impact/reverse recovery, frozen terminal states, practice timing and 180,000 random-control simulation steps with bounds/count/finite-score invariants.

The simulator runs 36 full contracts: six fields × three implements × two drivers. The baseline drives straight lanes; the second adds obstacle detours and circular cleanup passes. Both use ordinary pointer targets through the real engine, without teleporting or directly changing coverage. Baseline clears field 1 with every implement (roughly 107–146 seconds), then stalls on islands as expected. The detour driver clears fields 2–3 with the medium/wide implements and field 4 with the wide implement. It leaves missed patches with narrower tools and is unreliable on the tight final fields. These are diagnostic bots, not proof that every contract or three-star route is attainable; later-field time limits and implement parity still need playtesting and a stronger route planner before merging.

Cloudflare deployed the initial draft successfully. Live browser smoke review verified the menu, keyboard/pointer movement, coverage updates and pause menu. Browser console showed extension-origin messages, but no game-origin error. Full mobile-device testing and completion of late fields are outstanding.

Next review priorities: late-field solvability and star thresholds, a recovery-capable simulation driver, phone ergonomics, and whether broad implements dominate despite their turning penalty. No audio or endless mode in this draft.
