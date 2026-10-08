/**
 * Fixed level table for Associations.
 *
 * Each level's deal is still shuffled at runtime, but generate.ts only
 * accepts deals the solver proves winnable, and the move budget is the
 * solver's solution length plus `spare`.
 *
 * Difficulty was pre-validated offline: a simulated player (knows every
 * category, picks greedily, 30% random moves) played 80–100 fresh deals per
 * level. Its win rate is the trailing comment on each row. Levels are sorted
 * so that rate never rises. Level 1 matches the original single-level game.
 */
export interface LevelSpec {
  /** Tableau columns (3–5). Column n is dealt n cards. */
  columns: number;
  /** Deck slots (3–5). */
  slots: number;
  /** Total groups in the deal. */
  groups: number;
  /** How many of those groups must be stacked in order. */
  ordered: number;
  minWords: number;
  maxWords: number;
  /** Moves allowed beyond the solver's solution length. */
  spare: number;
}

export const LEVELS: LevelSpec[] = [
  { columns: 5, slots: 5, groups: 5, ordered: 0, minWords: 2, maxWords: 4, spare: 14 }, // 1: 100%
  { columns: 5, slots: 5, groups: 5, ordered: 0, minWords: 2, maxWords: 5, spare: 12 }, // 2: 100%
  { columns: 5, slots: 5, groups: 6, ordered: 0, minWords: 2, maxWords: 5, spare: 11 }, // 3: 100%
  { columns: 5, slots: 5, groups: 5, ordered: 1, minWords: 2, maxWords: 4, spare: 11 }, // 4: 99%
  { columns: 5, slots: 5, groups: 6, ordered: 1, minWords: 3, maxWords: 4, spare: 10 }, // 5: 100%
  { columns: 5, slots: 4, groups: 6, ordered: 1, minWords: 3, maxWords: 4, spare: 10 }, // 6: 99%
  { columns: 5, slots: 4, groups: 6, ordered: 1, minWords: 3, maxWords: 5, spare: 9 }, // 7: 98%
  { columns: 4, slots: 4, groups: 6, ordered: 1, minWords: 3, maxWords: 5, spare: 9 }, // 8: 98%
  { columns: 4, slots: 5, groups: 6, ordered: 1, minWords: 3, maxWords: 5, spare: 9 }, // 9: 96%
  { columns: 4, slots: 4, groups: 6, ordered: 1, minWords: 3, maxWords: 5, spare: 8 }, // 10: 96%
  { columns: 4, slots: 4, groups: 7, ordered: 1, minWords: 3, maxWords: 5, spare: 8 }, // 11: 90%
  { columns: 4, slots: 4, groups: 6, ordered: 2, minWords: 3, maxWords: 5, spare: 8 }, // 12: 88%
  { columns: 5, slots: 3, groups: 7, ordered: 1, minWords: 3, maxWords: 5, spare: 8 }, // 13: 83%
  { columns: 4, slots: 4, groups: 6, ordered: 2, minWords: 3, maxWords: 5, spare: 7 }, // 14: 77%
  { columns: 4, slots: 3, groups: 6, ordered: 2, minWords: 3, maxWords: 5, spare: 7 }, // 15: 71%
  { columns: 4, slots: 4, groups: 7, ordered: 2, minWords: 3, maxWords: 5, spare: 7 }, // 16: 67%
  { columns: 4, slots: 4, groups: 7, ordered: 2, minWords: 3, maxWords: 5, spare: 6 }, // 17: 61%
  { columns: 3, slots: 4, groups: 7, ordered: 2, minWords: 3, maxWords: 5, spare: 7 }, // 18: 48%
  { columns: 4, slots: 3, groups: 7, ordered: 2, minWords: 3, maxWords: 5, spare: 6 }, // 19: 46%
  { columns: 3, slots: 4, groups: 7, ordered: 2, minWords: 3, maxWords: 6, spare: 6 }, // 20: 36%
  { columns: 4, slots: 3, groups: 7, ordered: 2, minWords: 3, maxWords: 6, spare: 6 }, // 21: 26%
  { columns: 3, slots: 3, groups: 7, ordered: 2, minWords: 3, maxWords: 5, spare: 6 }, // 22: 23%
  { columns: 3, slots: 4, groups: 7, ordered: 3, minWords: 3, maxWords: 6, spare: 5 }, // 23: 18%
  { columns: 3, slots: 3, groups: 8, ordered: 3, minWords: 3, maxWords: 6, spare: 4 }, // 24: 18%
  { columns: 3, slots: 3, groups: 7, ordered: 3, minWords: 3, maxWords: 6, spare: 5 }, // 25: 17%
  { columns: 3, slots: 3, groups: 8, ordered: 3, minWords: 4, maxWords: 6, spare: 3 }, // 26: 17%
  { columns: 4, slots: 3, groups: 7, ordered: 3, minWords: 3, maxWords: 6, spare: 5 }, // 27: 16%
  { columns: 3, slots: 3, groups: 8, ordered: 4, minWords: 4, maxWords: 6, spare: 1 }, // 28: 16%
  { columns: 3, slots: 3, groups: 7, ordered: 3, minWords: 3, maxWords: 6, spare: 4 }, // 29: 13%
  { columns: 3, slots: 3, groups: 8, ordered: 4, minWords: 3, maxWords: 6, spare: 2 }, // 30: 9%
];
