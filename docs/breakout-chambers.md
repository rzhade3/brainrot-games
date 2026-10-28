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

## Generation architecture

The common generator interface now supports literal authored maps, parameterized families,
and custom algorithms. Existing layouts retain version-0 adapters and pass the original
66-wave exact-output fixtures. The browser selects Twin vaults version 1, a map-based family
with four centered entrance offsets per floor and three constrained brick-fill patterns.
All powers and connector gates remain explicit. Other families are unchanged.

Validation rejects missing rewards and invalid behavior references as well as geometry.
Three deterministic placement attempts are allowed; exhaustion fails tests/development.
Production may use a separately validated fallback and logs the reasons. Initial boards,
seeds, family versions, difficulty and attempt diagnostics remain available independently
of mutable game state. See the [authoring guide](../src/games/breakout/levels/README.md).

The 128-seed generation suite exercises first-cycle and later-cycle armor, exact replays,
all 16 entrance combinations, and required rewards without retries or fallbacks. The
new 36-run gameplay results are in [breakout-generated-simulations.jsonl](breakout-generated-simulations.jsonl).

Final generated opening results (12 seeds/controller, up to 240 seconds): stationary
0/12 first clears, reactive 1/12, predictive 6/12. Predictive successful first-clear
median is 75.35 seconds, mean peak swarm 29.33. All stationary runs lose their three
lives. The prior fixed opening had 7/12 predictive first clears (98.5-second successful
median). Different layouts change trajectories, so these small samples are diagnostic,
not evidence of statistically equivalent difficulty. The final choices use centered
entrance offsets 4–7; wider offsets 3/5/7/9 were rejected after worse survival results.

Cloudflare deployed code commit `6f48f5e` successfully. Desktop browser smoke testing
verified pre-launch pointer steering, launch, keyboard steering, pause, restart
confirmation, and a visibly changed board after restart. No application-origin errors
were observed. See [the deployed board](breakout-generated-preview.jpg). This is not
mobile/touch verification or a complete human balance test.
