# Fieldwork

A standalone top-down tractor coverage game at `/games/fieldwork/`, inspired by the FS25 ploughing clip. Original procedural canvas artwork; no third-party game assets. This first PR is a playable draft, not a final balance sign-off.

## Play

Hold and drag on the field to steer toward the pointer, release to brake, and hold Reverse to back out. Keyboard: WASD/arrows, P/Escape to pause. Reversing lifts the plough. Grass is driveable turning space. Tractor bodies collide with tree/turbine islands and fences; the implement clips its work to the field mask, rather than physically colliding.

Clear 98% to finish. Fuel-limited contracts unlock six fixed seeded layouts with additional islands, a cut-out corner, and a tapered edge. Three implements trade coverage and speed against turning radius. Practice exposes all six fields with unlimited fuel and never awards progression or a high score. Failed contracts can continue in practice without erasing their furrows.

Stars: finish = one; save 15% fuel = two; save 30% fuel = three. Score is coverage × 1000 + remaining fuel fraction × 1000, with no time or collision penalty. Fuel-era progress uses `fieldwork-fuel-v2` and best scores use `fieldwork-fuel`, so timer-era medals and scores are not compared to the new rules. Missing/corrupt storage does not prevent play.

## Architecture

- `engine.ts`: DOM-free deterministic field masks, tractor motion, fixed-step input, swept blade coverage, repeated-pass accounting, collisions, scores and terminal states.
- `camera.ts`: shared ground-plane projection and inverse for rendering/touch input, a fixed north-up orientation.
- `render.ts`: cached terrain and furrows, tractor, trees, wind turbines, dust and impact feedback. Only newly worked cells update the terrain cache. Reduced motion disables dust and turbine animation.
- `main.ts`: menus, input, persistence, background pause and accessibility announcements. The engine advances at 60 Hz independently of rendering. Long frames are capped; background tabs pause automatically.

Coverage uses 5-unit cells. Work increments on distinct blade visits, not every simulation frame. A 2% allowance avoids requiring pixel-perfect edge cleanup. Remaining cells brighten after 90% coverage.

## Validation and known limits

Run `npm run test:fieldwork`, `npm run simulate:fieldwork` and `npm run build`.

Four camera tests plus ten engine tests cover 120 deterministic layouts, masks, stationary/reverse behavior, contiguous sweeps, implement differences, impact/reverse recovery, frozen terminal states, fuel exhaustion/practice recovery, distance-based consumption, star thresholds and fixed-step fuel consistency and 180,000 random-control simulation steps with bounds/count/finite-score invariants.

The simulator runs 36 bounded contract simulations: six fields × three implements × two drivers. The baseline drives straight lanes; the second adds obstacle detours and circular cleanup passes. Both use ordinary pointer targets through the real engine, without teleporting or directly changing coverage. Baseline clears field 1 with every implement with 16–23% fuel remaining, then stalls on islands as expected. The detour driver clears fields 2–3 with the medium/wide implements and field 4 with the wide implement. It leaves missed patches with narrower tools and is unreliable on the tight final fields. These are diagnostic bots, not proof that every contract or three-star route is attainable; later-field fuel budgets and implement parity still need playtesting and a stronger route planner before merging.

Cloudflare deployed the initial draft successfully. Live browser smoke review verified the menu, keyboard/pointer movement, coverage updates and pause menu. Browser console showed extension-origin messages, but no game-origin error. Full mobile-device testing and completion of late fields are outstanding.

## Fuel model

Only actual distance moved burns fuel. Forward travel with the blade over any workable field cell costs 1.25 units per world unit, including already worked soil. Grass and reversing cost 1 unit; idle and blocked movement cost nothing. A depleted tank caps the last step's travel and ends the contract. Finish wins if 98% is reached on that last step. Practice bypasses consumption and can resume a failed field with its coverage intact.

Tank capacity is workable area / blade width × 2, plus 90 per estimated lane and 650 per obstacle. This normalizes each implement's tank to the work required and budgets for headland turns and island cleanup. The low-fuel gauge turns amber at 20% with a one-time announcement. No fuel pickups or idling penalty.

Simulation step caps are reported as bot stalls, not game losses: a stationary bot no longer loses just because time passes. The final-field bot's route remains unreliable, so these results are not a full solvability proof.

Next review priorities: late-field solvability and star thresholds, a recovery-capable simulation driver, phone ergonomics, and whether broad implements dominate despite their turning penalty. No audio or endless mode in this draft.

## Driving camera

The default driving view follows the tractor at a modest 1.55× zoom with a fixed north-up orientation and the tractor centred, leaving equal room to see ahead in any direction. Neither view rotates or tilts. Map returns to the stationary field instantly, with no animated transition. These defaults replace the rotating follow camera after motion-discomfort feedback.

The follow view includes a north-up minimap showing worked soil, obstacles, heading and the visible footprint. Pointer coordinates are inverted through the current camera each simulation step. The minimap ignores driving gestures. Menus and results always show the whole field.

Camera tests cover projection/inverse consistency at field edges, the stationary overview, heading-independent projection and held-pointer aiming while following.
