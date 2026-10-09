import { getLevelLayout } from './layouts';
import type { GameState } from './rules';
import { solve } from './solver';

const SOLVABILITY_BUDGET = 999;

export function generateLevel(level: number): GameState {
  return getLevelLayout(level);
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
