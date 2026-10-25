# Break Rot chambers

The first three waves are Twin vaults, Nested rings, and Honeycomb cascade, followed by the eight classic layouts. Each contains more than 300 small bricks in separate steel enclosures, open interior lanes, breakable gold connections, and readable two-wide reward pockets. Honeycomb uses six rectangular cells with staggered passages rather than introducing a separate polygon collision system.

Gold +3 entrance locks break in one hit. That hit continues through the gate before splitting, so a successful breach seeds the room rather than reflecting every ball outside. Internal gold connections also break. Ordinary bricks retain their usual bounce behavior. Rewards are distributed between entrance and deeper pockets; chamber bombs were removed because their radius could activate powers across thin walls, bypassing the aiming challenge.

Mint-edged floor sections retract once a room has at most 18% of its targets left or 28 seconds of active simulation after its first destroyed tile. Other steel stays permanent. Release emits a localized burst and OPEN cue, persists after life loss, and resets on the next wave. There are no extra progress bars or permanent instructional overlays. Help explains gates and floors. Existing reduced-motion and muted-by-default audio behavior remains.

Chamber stages use a 138-unit default paddle (classic: 114), a 480-unit starting speed plus wave/rally scaling (classic: 520), and a 780-unit speed cap (classic: 980). This compensates for the dense geometry and simultaneous returns without carrying upgrades between levels. The 48-ball cap, three-life run, one-ball serve, and buff resets remain intact. Chamber armor increases sparsely in later eleven-wave cycles. Scores use breakout-v3 in both game and hub, leaving old scores stored separately.

## Seeded diagnostics

Actual engine, fixed 240 Hz, 12 seeds per controller per starting layout, 240-second maximum: 108 runs. Raw output: [breakout-chamber-simulations.jsonl](breakout-chamber-simulations.jsonl). The existing stationary/reactive/predictive controllers are diagnostic policies, not human playtests. They do not strategically target entrances; predictive intercepts ignore subsequent steel collisions. First-clear counts refer only to the starting arena, while peak balls and game-over counts include subsequent arenas.

| Starting arena | Stationary first clears | Reactive first clears | Predictive first clears | Predictive median first clear (successful runs) |
| --- | ---: | ---: | ---: | ---: |
| Twin vaults | 0/12 | 5/12 | 7/12 | 98.5s |
| Nested rings | 0/12 | 2/12 | 6/12 | 55.9s |
| Honeycomb cascade | 1/12 | 7/12 | 12/12 | 59.9s |

All stationary runs eventually lose their three lives. A lucky stationary honeycomb clear remains possible: it is a deliberate cascade-heavy arena, not proof of indefinite idle progression. Predictive mean peak swarms were 31.42, 36.67, and 48. The opening two layouts remain demanding; these results establish finite, playable physics and distinguish active play from idle success, not a claim that difficulty is perfect. No invalid ball state was observed.

## Validation

- 18 engine tests, including ball-sized reachability and overlap checks across all eleven layouts, maximum swarms, gate traversal, room accounting, floor timing and pause semantics, permanent-wall retention, life loss, and wave reset.
- Full TypeScript check and Vite/PWA production build.
- Canvas rendering inspected for all three chamber layouts; viewport/interaction verification is recorded in the PR.

```sh
npm run test:breakout
npm run build
for wave in 1 2 3; do
  SIM_WAVE=$wave SIM_SEEDS=12 SIM_SECONDS=240 npm run --silent simulate:breakout
done
```
