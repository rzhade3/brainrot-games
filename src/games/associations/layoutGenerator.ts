import type { LevelSpec } from './levels';
import { deal, type GameState } from './rules';
import { solve } from './solver';

const SOLVABILITY_BUDGET = 999;

/**
 * Build a solver-validated layout for the checked-in level manifest.
 */
export function generateFromSpec(level: number, spec: LevelSpec, rng: () => number = Math.random): GameState {
  for (let attempt = 0; ; attempt++) {
    const state = deal(level, spec, rng);
    // Give up on decks the solver can't crack quickly; after many tries, search harder.
    const limit = attempt < 20 ? 30000 : 200000;
    const first = solve(state, { budget: SOLVABILITY_BUDGET, nodeLimit: limit, firstOnly: true });
    if (!first.solved) continue;
    const shorter = solve(state, { budget: first.length - 1, nodeLimit: 2 * limit });
    const length = shorter.solved ? shorter.length : first.length;
    state.movesTotal = state.movesLeft = length + spec.spare;
    return state;
  }
}
