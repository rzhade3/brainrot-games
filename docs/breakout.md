# Break Rot

Open `/games/breakout/`. Drag to position the paddle before launch, then steer with touch, mouse, or arrow keys / A and D. Space launches; P pauses. Paddle edges aim the rebound. Instructions and obstacle explanations live in Help; the play screen shows only the score, wave, lives, active effects, and multiball count. The phone layout fits the viewport, including small screens, and landscape puts the HUD beside the arena. Pause contains sound and restart; restarting uses an in-game confirmation. Backgrounding pauses automatically. Sound is opt-in; reduced motion disables trails/particles.

Three dense chamber layouts open the eleven-arena cycle: Twin vaults, Nested rings, and Honeycomb cascade. Gold +3 locks send a breach into the room; two-wide reward tiles remain readable on phones. Mint-edged floors retract at 18% targets remaining or 28 seconds after the first destroyed tile. Retraction persists through a lost life. Chamber serves use a 138-unit paddle, 480-unit starting speed (plus wave/rally scaling), and a 780-unit speed cap. The 48-ball cap and fresh-wave reset still apply.

The eight classic layouts follow with their original geometry: Split decision, Diamond circuit, Slalom, The vault, Constellation, Hourglass, Switchback, and Orbit. Steel shelves and vault walls are indestructible, including during fireballs and explosions. Circular bumpers reflect balls radially and boost their speed by 8% up to the global cap. Permanent obstacles do not count toward clearing. Numbers on bricks show remaining hits; the last five targets receive a white outline. Later cycles increase armor (up to six hits), and wave/rally speed is bounded. Repeating long flights are gently redirected after 14 seconds without teleporting.

Each serve starts with **one ball**. Eight spaced power tiles per classic layout (chambers use authored reward pockets) activate on impact: ×3 triples live balls, +3 adds three (48-ball cap), ↔ widens the paddle for ten seconds, F pierces bricks for four seconds, ✹ damages nearby bricks by two, S rescues one falling ball, and ~ slows motion for five seconds. Fire/slow timers cap at eight/ten seconds; wide refreshes rather than growing permanently, and saves do not stack. Rapid hits build a score combo up to ×10. Bombs may trigger fragile powers but never erase reinforced armor for free.

A clear pauses on a summary screen; Next wave previews the new geometry before launch. Balls, upgrades, and rally speed reset between waves and after losing a life. A run has three lives with no per-wave regeneration. Scores use `breakout-v3` for the denser chamber rules; previous scores remain stored separately. No new runtime dependencies or external assets are needed.

```bash
npm run test:breakout       # physics, lifecycle, layout overlap/accessibility, and full-army tests
npm run simulate:breakout   # seeded stationary, reactive, and predictive controllers
SIM_WAVE=8 SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout
```

See [the gameplay evaluation](breakout-evaluation.md) for the old/new simulation results, controller limitations, tuning decisions, and reproducible commands.

See [chamber balancing](breakout-chambers.md) for the new layouts and seeded results.

For new arenas, use the [declarative level authoring guide](../src/games/breakout/levels/README.md). New levels use literal maps, parameterized families, or custom generators behind one validated board interface. Twin vaults varies entrances and brick patterns from a reproducible run seed; existing layouts retain compatibility adapters.
