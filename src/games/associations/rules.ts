import { CATEGORIES, ORDERED_CATEGORIES } from './categories';
import type { LevelSpec } from './levels';

/**
 * Pure game rules for Associations (solitaire-style word grouping).
 *
 * - Word cards belong to exactly one category; category cards say how many
 *   word cards belong to them.
 * - Deck slots (3–5 per level): an empty slot accepts a category card
 *   (optionally carrying its words beneath it); a slot holding a category
 *   accepts that category's word cards. Once every word is in, the slot clears.
 * - Tableau columns (3–5 per level): an empty column accepts anything.
 *   Otherwise word cards stack on words of the same category. A category card
 *   may be stacked on a word of its own category, but it caps the column —
 *   nothing can be stacked on top of a category card.
 * - A column's face-up cards always move together as one stack.
 * - Ordered categories must enter their slot first→last, so they stack
 *   last→first down a column (a category card caps only the first word).
 * - Cards are dealt face down with the top of each column face up; the stock
 *   ("house cards") draws one at a time to the waste and recycles when empty.
 * - Every move (including draws and recycles) costs one from a finite budget.
 */

export type CardKind = 'word' | 'category';

export interface Card {
  id: number;
  cat: number;
  kind: CardKind;
  label: string;
  faceUp: boolean;
  /** Position within an ordered category (0 = first); -1 otherwise. */
  rank: number;
}

export interface CategoryInfo {
  name: string;
  /** Number of word cards in this category. */
  size: number;
  ordered: boolean;
}

export interface Slot {
  cat: number;
  filled: number;
  /** Label of the last word placed (shown for ordered groups). */
  last?: string;
}

export interface GameState {
  level: number;
  categories: CategoryInfo[];
  columns: Card[][];
  stock: Card[];
  waste: Card[];
  slots: (Slot | null)[];
  movesLeft: number;
  movesTotal: number;
  completed: number;
}

export type Source = { zone: 'column'; index: number } | { zone: 'waste' };
export type Target = { zone: 'column'; index: number } | { zone: 'slot'; index: number };

export interface MoveResult {
  ok: boolean;
  /** Category index completed by this move, if any. */
  completedCat?: number;
  /** Slot that held the completed category. */
  completedSlot?: number;
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Deal a random deck for a level spec. `movesTotal` is set by the generator. */
export function deal(level: number, spec: LevelSpec, rng: () => number = Math.random): GameState {
  const plain = shuffle([...CATEGORIES], rng).slice(0, spec.groups - spec.ordered);
  const ordered = shuffle([...ORDERED_CATEGORIES], rng).slice(0, spec.ordered);
  const pool = shuffle([...plain, ...ordered], rng);
  const categories: CategoryInfo[] = [];
  const cards: Card[] = [];
  let id = 0;

  pool.forEach((def, cat) => {
    const want = spec.minWords + Math.floor(rng() * (spec.maxWords - spec.minWords + 1));
    const count = Math.min(want, def.words.length);
    let words: string[];
    if (def.ordered) {
      const start = Math.floor(rng() * (def.words.length - count + 1));
      words = def.words.slice(start, start + count);
    } else {
      words = shuffle([...def.words], rng).slice(0, count);
    }
    const isOrdered = !!def.ordered;
    categories.push({ name: def.name, size: words.length, ordered: isOrdered });
    cards.push({ id: id++, cat, kind: 'category', label: def.name, faceUp: false, rank: -1 });
    words.forEach((w, r) =>
      cards.push({ id: id++, cat, kind: 'word', label: w, faceUp: false, rank: isOrdered ? r : -1 })
    );
  });

  shuffle(cards, rng);

  const columns: Card[][] = [];
  for (let c = 0; c < spec.columns; c++) {
    const col = cards.splice(0, c + 1);
    if (col.length) col[col.length - 1].faceUp = true;
    columns.push(col);
  }

  return {
    level,
    categories,
    columns,
    stock: cards, // remaining cards, face down; last element is drawn first
    waste: [],
    slots: Array.from({ length: spec.slots }, () => null),
    movesLeft: 0,
    movesTotal: 0,
    completed: 0,
  };
}

/** Index of the first face-up card in a column (column length if none). */
export function firstFaceUp(col: Card[]): number {
  let i = col.length;
  while (i > 0 && col[i - 1].faceUp) i--;
  return i;
}

/** Cards that would move from a source: the waste top, or a column's whole face-up stack. */
export function getRun(state: GameState, src: Source): Card[] | null {
  if (src.zone === 'waste') {
    const top = state.waste[state.waste.length - 1];
    return top ? [top] : null;
  }
  const col = state.columns[src.index];
  if (!col || !col.length) return null;
  const run = col.slice(firstFaceUp(col));
  return run.length ? run : null;
}

export function canDrop(state: GameState, run: Card[], target: Target): boolean {
  if (!run.length) return false;
  const first = run[0];
  const last = run[run.length - 1];
  const hasCategory = last.kind === 'category';
  const ordered = state.categories[first.cat].ordered;

  if (target.zone === 'slot') {
    if (target.index < 0 || target.index >= state.slots.length) return false;
    const slot = state.slots[target.index];
    if (!slot) {
      if (!hasCategory) return false;
      // Words beneath the category pour in top-down, so the top word must come first.
      return !ordered || run.length === 1 || run[run.length - 2].rank === 0;
    }
    if (hasCategory || first.cat !== slot.cat) return false;
    return !ordered || last.rank === slot.filled;
  }

  const col = state.columns[target.index];
  if (!col) return false;
  if (!col.length) return true;
  const top = col[col.length - 1];
  if (!top.faceUp || top.kind === 'category' || top.cat !== first.cat) return false;
  if (!ordered) return true;
  return first.kind === 'category' ? top.rank === 0 : first.rank === top.rank - 1;
}

export function sameSource(src: Source, target: Target): boolean {
  return src.zone === 'column' && target.zone === 'column' && src.index === target.index;
}

export function applyMove(state: GameState, src: Source, target: Target): MoveResult {
  if (state.movesLeft <= 0 || sameSource(src, target)) return { ok: false };
  const run = getRun(state, src);
  if (!run || !canDrop(state, run, target)) return { ok: false };

  if (src.zone === 'waste') {
    state.waste.pop();
  } else {
    const col = state.columns[src.index];
    col.splice(col.length - run.length);
    const top = col[col.length - 1];
    if (top && !top.faceUp) top.faceUp = true;
  }

  state.movesLeft--;

  if (target.zone === 'column') {
    state.columns[target.index].push(...run);
    return { ok: true };
  }

  const words = run.filter((c) => c.kind === 'word');
  let slot = state.slots[target.index];
  if (!slot) {
    slot = { cat: run[0].cat, filled: 0 };
    state.slots[target.index] = slot;
  }
  slot.filled += words.length;
  // Words enter top card first, so the bottom word of the stack lands last.
  if (words.length) slot.last = words[0].label;

  if (slot.filled >= state.categories[slot.cat].size) {
    const cat = slot.cat;
    state.slots[target.index] = null;
    state.completed++;
    return { ok: true, completedCat: cat, completedSlot: target.index };
  }
  return { ok: true };
}

/** Draw a house card, or recycle the waste back into the stock when empty. */
export function draw(state: GameState): boolean {
  if (state.movesLeft <= 0) return false;
  if (state.stock.length) {
    const card = state.stock.pop()!;
    card.faceUp = true;
    state.waste.push(card);
  } else if (state.waste.length) {
    state.stock = state.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    state.waste = [];
  } else {
    return false;
  }
  state.movesLeft--;
  return true;
}

export function isWon(state: GameState): boolean {
  return state.completed >= state.categories.length;
}
