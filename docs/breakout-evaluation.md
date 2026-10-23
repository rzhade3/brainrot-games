# Break Rot gameplay evaluation

## What failed in the first version

The original rules rewarded passive survival more than paddle skill. Forty-two of 210 bricks
were powers, every power fired instantly, bombs erased all nearby armor, paddle growth was
permanent, and every wave gave a life while retaining the entire ball army and timed effects.
A fresh wall could immediately collapse into the same chain reaction as the previous wall.
The level generator changed armor but repeated the same full rectangle. The UI duplicated wave
information, hid the arena behind a large intro, exposed several low-priority controls throughout
play, and provided little separation between progress, effects, and navigation.

A four-minute baseline simulation confirmed the runaway behavior:

| Controller | Mean waves cleared | Mean peak balls | Game overs / 12 |
| --- | ---: | ---: | ---: |
| Stationary after launch | 113.83 | 107.17 | 0 |
| Reactive tracking | 139.58 | 128.00 | 0 |
| Predictive tracking | 130.42 | 128.00 | 0 |

## Revised gameplay contract

- One-ball serves; no balls, effects, paddle growth, or rally speed carry to another wave.
- Three lives for the run; clears never regenerate lives. Losing a life also resets upgrades.
- Eight spatially separated power tiles per board; ×3/+3 still build an earned swarm up to 48.
- WIDE refreshes a ten-second timer instead of stacking permanent width. Fire lasts four seconds
  (eight-second cap), slow lasts five (ten-second cap), and SAVE holds one rescue. Bombs deal two
  damage, so armor has meaning and nearby powers only chain if actually destroyed.
- Eight authored geometry families: split banks, diamond ring, staggered slalom, open steel vault,
  small constellations, hourglass, switchback lanes, and an orbital ring. Counts differ by layout.
  Later cycles raise armor; the first cycle already varies one-, two-, and three-hit bricks.
- Hatched steel always reflects, even during fire. Circular orange bumpers reflect around their
  radial normal and accelerate the ball by 8%, capped at 980 world units/second. They are never
  part of the clear condition. Bricks are placed below the old wall region as well as above it.
- Centered paddle returns get a small aiming offset instead of remaining exactly vertical;
  long repeating flights are redirected after 14 seconds without teleporting. The last five
  breakable targets receive a static outline for cleanup visibility.

Opening speed was eased from the first redesign, and rally acceleration was bounded after
controllers showed early losses. Diamond circuit and Slalom were thinned after their first
simulations showed excessive clear times. These are pacing changes, not difficulty fallbacks
that silently remove hazards or award wins.

## Final simulations

The revised opening wave has zero clears for stationary and reactive controllers across 12
runs each; both exhaust all three lives. The predictive controller clears it in 12/12 runs,
with a 103.4-second median first clear. Its mean clear count drops from 130.42 in the original
to 1.58 in the revised game over four minutes. No opening predictive run ends in game over
within that window. This removes idle runaway success while retaining viable skilled play.

Every geometry was also tested as the starting wave, with 12 seeds per controller, three
controllers, and up to 240 simulated seconds per run: **288 revised runs**, plus 36 baseline
runs. Later waves are deliberately more demanding; the table reports predictive results.
Clear counts include subsequent waves within the same run. A first-clear success means the
starting layout was completed before time ran out or the run ended. Medians exclude failures.

| Starting layout | First-clear successes | Median first clear | Mean total clears / 240s | Mean peak balls |
| --- | ---: | ---: | ---: | ---: |
| 1 · Split decision | 12/12 | 103.4s | 1.58 | 10.67 |
| 2 · Diamond circuit | 12/12 | 111.4s | 1.50 | 8.83 |
| 3 · Slalom | 12/12 | 105.9s | 1.75 | 9.08 |
| 4 · The vault | 11/12 | 101.0s | 2.25 | 13.00 |
| 5 · Constellation | 12/12 | 35.3s | 2.50 | 14.50 |
| 6 · Hourglass | 12/12 | 71.0s | 1.75 | 9.92 |
| 7 · Switchback | 11/12 | 87.1s | 1.33 | 7.50 |
| 8 · Orbit | 8/12 | 118.9s | 0.75 | 8.17 |

The simulation uses the actual game engine at 240 Hz, without browser rendering. Controllers:

- **Stationary**: randomized launch position, then no movement until the next serve.
- **Reactive**: follows the most urgent downward ball's current x every 180 ms, with ±45 units
  of seeded tracking error plus a sinusoidal aim offset. Movement is limited to 850 units/s.
- **Predictive**: predicts side-wall bounces and the intercept with the paddle every 90 ms,
  with ±20 units of seeded error plus the same aim offset and speed limit. It does not predict
  steel/bumper collisions or choose strategic brick targets.

Seeds are 1–12; they vary launch position, angle (where supported), and steering error. No
randomness is added to physics. The original engine ignores the aim argument and has its original
three-ball serve; the comparison preserves each version's rules rather than forcing equal serves.
These controllers are diagnostics, **not measured human skill levels or human playtesting**.
They are weak at prioritizing multiple returns and late bumper deflections. The results expose
auto-win loops, unreachable geometry, survivability, and pacing problems; they do not establish
that the subjective difficulty is perfect. Human feedback remains necessary for fine tuning.

Raw per-seed results are in [breakout-simulations.json](breakout-simulations.json).

## UX and verification

The pre-launch board remains visible, with one compact launch button below the geometry.
The HUD shows wave/name, run lives, score, remaining bricks, live balls, and temporary effects.
A clear screen explicitly leads to a fresh board preview before the next launch. Sound and
restart live in pause/help rather than occupying a permanent bottom toolbar; restart uses an
in-game confirmation. Distinct hatching/rings and a persistent legend distinguish steel and
bumpers from destructible targets. Larger numerals show remaining armor; power glyphs have
full explanations in Help. Legacy scores are retained under their old key, while the revised
rules use a fresh `breakout-v2` score category in the shared arcade store.

Thirteen tests cover arithmetic/caps, all eight layouts, overlapping geometry, obstacle-only
ball-sized flood reachability, armor/steel/fire interactions, radial bumper reflection, life
loss, wave resets, and bounded full-army simulation. The reachability test proves permanent
obstacles do not seal away any target; simulations assess practical access. Type-check and
production/PWA builds pass. Chromium interaction/viewport checks cover desktop, a 390×844
phone, a 320×568 phone with reduced motion, and 844×390 landscape. They exercise actual touch
input, launch, pause/resume, help, restart confirmation, a forced clear through the live engine,
and a fresh one-ball next-wave serve. No production test/debug controls are added to the app.

## Reproduce

```bash
npm run test:breakout
npm run build
npm run simulate:breakout
SIM_WAVE=8 SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout
# All starting layouts (JSON lines):
for wave in 1 2 3 4 5 6 7 8; do
  SIM_WAVE=$wave SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout
done
# Baseline, after fetching the PR's original commit:
git show 6c5596bdd2c245a8d5288d88e5156c6283ea7901:src/games/breakout/engine.ts > /tmp/breakout-baseline.ts
SIM_SEEDS=12 SIM_SECONDS=240 npm run simulate:breakout -- /tmp/breakout-baseline.ts
```
