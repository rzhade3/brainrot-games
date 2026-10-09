import { LEVELS, type LevelSpec } from './levels';
import { deal, type GameState } from './rules';
import { solve } from './solver';

const SOLVABILITY_BUDGET = 999;

/**
 * Deal a random deck for a level and validate it with the solver. Only decks
 * with a proven solution are used, and the move budget is that solution's
 * length plus the level's `spare` moves, so every level is winnable and the
 * slack is consistent from deal to deal.
 */
export function generateLevel(level: number, rng: () => number = Math.random): GameState {
  return generateFromSpec(level, LEVELS[Math.min(level, LEVELS.length) - 1], rng);
}

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

export type Viability = 'ok' | 'dead' | 'unknown';

/**
 * Whether the board can still be solved. The remaining move budget is checked
 * first as a fast path, but a board is only called 'dead' when a second,
 * budget-independent search proves that no solution exists. Running short on
 * moves is handled separately by the game's "Out of moves" state.
 */
export function checkViable(state: GameState, nodeLimit = 30000): Viability {
  const withinBudget = solve(state, { budget: state.movesLeft, nodeLimit, firstOnly: true });
  if (withinBudget.solved) return 'ok';
  if (!withinBudget.complete) return 'unknown';

  const solvable = solve(state, { budget: SOLVABILITY_BUDGET, nodeLimit, firstOnly: true });
  if (solvable.solved) return 'ok';
  return solvable.complete ? 'dead' : 'unknown';
}
