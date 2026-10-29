> Survival mechanics and balance figures below are historical. See [squad-only survival](gate-runner-squad-balance.md) for the current system.

# Difficulty revision

The previous balance was too forgiving in actual play. Exact-state bots clearing nearly every run established solvability, but did not establish a satisfying challenge. The prior reactive controller also cleared 300/300 seeds, exposing the missing skill requirement.

## Changes

- Auto-fire now needs horizontal alignment within 2.1 world units and 21 units of forward range (previously full-road targeting and 27 range). Players must trade off lining up kills against avoiding danger. The start-screen hint explains this.
- Every wave contains a sniper, starting in stage one; later-stage grunts also shoot. Waves contain one more enemy and enemy HP scales more strongly across stages.
- Bosses alternate five-shot aimed fans and four-lane barrages. A barrage leaves a marked green corridor; red lanes warn before firing. The boss cycles the gap, preventing stationary safe spots.
- Hostile projectiles travel at 24.5–30.5 units/second rather than 18. Boss cooldown shrinks across stages; warning durations remain 750ms for bosses and 650ms for other ranged enemies.
- Projectile hit tolerance is 0.72 horizontally, matching a more meaningful portion of the squad. Boss hits cost 20 HP, ordinary shots 11 HP, before armor. All hits retain the existing troop cost.
- Automatic stage recovery is 4 HP rather than 10 HP. Medic and armor become consequential survival choices.
- Large squads gain a modest extra damage factor `(soldiers / 12)^0.1`. This preserves army-heavy builds after the tighter combat tuning instead of making damage upgrades the only workable route.

## Simulations

Command: `SEEDS=300 npm run simulate:gate-runner -- --write --check`.

2,100 attempts across 300 seeds and seven policies finished without timeout or invalid state. The simulator now values aligning with enemies; otherwise the old aiming-agnostic controller would misrepresent the new rules. The reactive policy retains exact-state threat projection, but acts every 400ms, misses 15% of inputs, and has ±0.35 units of steering error. These are controller comparisons, not human win-rate predictions.

| Controller | Clears / 300 | Clear rate | Mean stage |
| --- | ---: | ---: | ---: |
| Idle | 0 | 0% | 1.0 |
| Random | 0 | 0% | 1.0 |
| Repeating left/right sweep | 0 | 0% | 1.2 |
| Precise squad-heavy | 69 | 23.0% | 4.6 |
| Precise damage-heavy | 247 | 82.3% | 4.6 |
| Precise balanced | 292 | 97.3% | 4.9 |
| Slower/error-prone balanced | 30 | 10.0% | 2.7 |

This preserves a high solvability rate for precise play while punishing imprecise positioning. Squad-only gate selection remains a harder strategy, not an equally strong substitute for a balanced build. No claim is made that every seed/build combination is winnable.

The balance guard now caps passive, random, sweep, and reactive success while requiring viable active strategies and a substantial precision gap. Previously it only required active strategies to clear at least 85%, which could accept an excessively easy game.

## Checks

15 engine tests and the production TypeScript/Vite/PWA build passed. New coverage checks firing alignment, the exact safe lane in boss barrages, and guaranteed early ranged pressure. Existing fixed-step, terminal-score, piercing, upgrade, collision, and deterministic-generation tests still pass. The full native-touch/mobile-device limitation recorded in the original review remains applicable.
