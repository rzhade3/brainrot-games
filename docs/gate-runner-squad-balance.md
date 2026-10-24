# Squad-only survival

This report supersedes the dual-health balance in gate-runner-difficulty.md and the balance figures in gate-runner-ux.md.

The squad is the only survival resource. State and events contain no player HP or armor value. Zero soldiers ends the run. Reinforcement gates and the Reinforce upgrade recover soldiers; stage transitions do not heal. HP medic and percentage armor upgrades/gates were removed. The remaining upgrades are Reinforce, Heavy rounds, Rapid fire and Piercing rounds.

Incoming losses: regular bullets 2 soldiers; boss shots 5/7/9/11/13 by stage; ordinary collisions 4; bomber collisions 8; mines 6. Boss shots are drawn larger and retain their pre-existing warning and safe-lane pattern. Damage events report the actual capped casualty count. Existing formation rendering removes those units immediately. Escaped enemies deduct up to 50 score, once, without killing unseen troops or awarding kills. Stage completion awards 250 + 8 per survivor.

Firepower is base damage × (0.8 + 0.3 × sqrt(soldiers)), zero at zero soldiers. A lone survivor retains about 60% of a starting squad's shot damage; 180 soldiers deliver about 2.6×. Reinforcements therefore help survival without making damage upgrades irrelevant. This retains the existing aggregate squad hitbox; it does not add individual-sprite collision geometry or shield mechanics.

## Tuning and validation

An initial low-damage conversion allowed the delayed/noisy controller to win 99/100 runs and was rejected. Increasing boss damage too far reduced that to 7/100; the final setting achieved 19/100 on the tuning subset before validation on larger sets. Controller logic changed only to replace low-HP medic decisions with low-squad reinforcements. The existing balance thresholds were retained.

| Controller | Seeds 1–300 | Held-out seeds 10001–10300 |
|---|---:|---:|
| Idle | 0/300 | 0/300 |
| Random | 0/300 | 0/300 |
| Squad gates + precise combat | 283/300 | 280/300 |
| Damage gates + precise combat | 285/300 | 283/300 |
| Adaptive gates + precise combat | 300/300 | 299/300 |
| Adaptive, delayed/noisy inputs | 61/300 | 55/300 |
| Continuous sweep | 0/300 | 0/300 |

All 4,200 validation runs terminate within six minutes with finite state, integer squad counts in 0–180, no dead winning squad and no living defeated squad. The precise policies have full state knowledge and should not be interpreted as human difficulty measurements. The delayed policy acts every 400ms, misses 15% of decisions and adds steering error; it is a stress proxy, not a calibrated human model. Detailed stage reach, duration, score and surviving-squad results are in gate-runner-simulations.json and gate-runner-squad-holdout.json.

Production build and 23 tests pass, including fatal casualty events, no hidden HP, non-lethal breaches, capped recruitment, no automatic healing, diminishing firepower, every soldier rendered, and frame-rate determinism. Official Impeccable static detector returns no findings. Real mobile touch-device validation remains outstanding.

Reproduce:

```sh
npm run build
npm run test:gate-runner
SEEDS=300 npm run simulate:gate-runner -- --write --check
FIRST_SEED=10001 SEEDS=300 node --import tsx scripts/simulate-gate-runner.ts --check
```
