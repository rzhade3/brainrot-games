import { LEVELS, type LevelSpec } from './levels';
import { deal, type GameState } from './rules';
import { solve } from './solver';

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
    const first = solve(state, { budget: 999, nodeLimit: limit, firstOnly: true });
    if (!first.solved) continue;
    const shorter = solve(state, { budget: first.length - 1, nodeLimit: 2 * limit });
    const length = shorter.solved ? shorter.length : first.length;
    state.movesTotal = state.movesLeft = length + spec.spare;
    return state;
  }
}

export type Viability = 'ok' | 'dead' | 'unknown';

/**
 * Whether the game can still be won within the remaining moves. 'dead' is
 * only returned when the search is exhaustive, so a winnable game is never
 * failed; 'unknown' means the search hit its node limit.
 */
export function checkViable(state: GameState, nodeLimit = 30000): Viability {
  const res = solve(state, { budget: state.movesLeft, nodeLimit, firstOnly: true });
  if (res.solved) return 'ok';
  return res.complete ? 'dead' : 'unknown';
}
