import { CATEGORIES } from './categories';

/**
 * Pure game rules for Associations (solitaire-style word grouping).
 *
 * - Word cards belong to exactly one category; category cards say how many
 *   word cards belong to them.
 * - Five deck slots: an empty slot accepts a category card (optionally carrying
 *   a run of its words beneath it); a slot holding a category accepts that
 *   category's word cards. Once every word is stacked, the slot clears.
 * - Tableau columns: an empty column accepts anything. Otherwise word cards
 *   stack on words of the same category. A category card may be stacked on a
 *   word of its own category, but it caps the column — nothing can be stacked
 *   on top of a category card.
 * - Cards are dealt face down with the top of each column face up; the stock
 *   ("house cards") draws one at a time to the waste and recycles when empty.
 * - Every move (including draws and recycles) costs one from a finite budget.
 */

export const SLOT_COUNT = 5;
export const COLUMN_COUNT = 5;

export type CardKind = 'word' | 'category';

export interface Card {
  id: number;
  cat: number;
  kind: CardKind;
  label: string;
  faceUp: boolean;
}

export interface CategoryInfo {
  name: string;
  /** Number of word cards in this category. */
  size: number;
}

export interface Slot {
  cat: number;
  filled: number;
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

export type Source = { zone: 'column'; index: number; start: number } | { zone: 'waste' };
export type Target = { zone: 'column'; index: number } | { zone: 'slot'; index: number };

export interface MoveResult {
  ok: boolean;
  /** Category index completed by this move, if any. */
  completedCat?: number;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Number of categories and word-count range for a level. */
export function levelConfig(level: number): { cats: number; minWords: number; maxWords: number } {
  return {
    cats: Math.min(4 + level, 8),
    minWords: level >= 3 ? 3 : 2,
    maxWords: Math.min(3 + level, 6),
  };
}

export function deal(level: number, rng: () => number = Math.random): GameState {
  const cfg = levelConfig(level);
  const pool = shuffle([...CATEGORIES], rng).slice(0, cfg.cats);
  const categories: CategoryInfo[] = [];
  const cards: Card[] = [];
  let id = 0;

  pool.forEach((def, cat) => {
    const count = cfg.minWords + Math.floor(rng() * (cfg.maxWords - cfg.minWords + 1));
    const words = shuffle([...def.words], rng).slice(0, Math.min(count, def.words.length));
    categories.push({ name: def.name, size: words.length });
    cards.push({ id: id++, cat, kind: 'category', label: def.name, faceUp: false });
    for (const w of words) cards.push({ id: id++, cat, kind: 'word', label: w, faceUp: false });
  });

  shuffle(cards, rng);

  const columns: Card[][] = [];
  for (let c = 0; c < COLUMN_COUNT; c++) {
    const col = cards.splice(0, c + 1);
    if (col.length) col[col.length - 1].faceUp = true;
    columns.push(col);
  }

  const stock = cards; // remaining cards, face down; last element is drawn first
  const total = categories.reduce((n, c) => n + c.size + 1, 0);
  // Budget tightens each level: roughly one move per card plus a shrinking
  // allowance for house-card draws and shuffling.
  const slack = Math.max(2, 14 - 3 * (level - 1));
  const movesTotal = total + stock.length + slack;

  return {
    level,
    categories,
    columns,
    stock,
    waste: [],
    slots: Array.from({ length: SLOT_COUNT }, () => null),
    movesLeft: movesTotal,
    movesTotal,
    completed: 0,
  };
}

/** Cards that would move from a source, or null if the source can't be picked up. */
export function getRun(state: GameState, src: Source): Card[] | null {
  if (src.zone === 'waste') {
    const top = state.waste[state.waste.length - 1];
    return top ? [top] : null;
  }
  const col = state.columns[src.index];
  if (!col || src.start < 0 || src.start >= col.length) return null;
  const run = col.slice(src.start);
  const cat = run[0].cat;
  for (let i = 0; i < run.length; i++) {
    const c = run[i];
    if (!c.faceUp || c.cat !== cat) return null;
    // A category card can only ever be the top (last) card of a run.
    if (c.kind === 'category' && i !== run.length - 1) return null;
  }
  return run;
}

export function canDrop(state: GameState, run: Card[], target: Target): boolean {
  if (!run.length) return false;
  const first = run[0];
  const hasCategory = run.some((c) => c.kind === 'category');

  if (target.zone === 'slot') {
    const slot = state.slots[target.index];
    if (target.index < 0 || target.index >= state.slots.length) return false;
    if (!slot) return hasCategory;
    return !hasCategory && first.cat === slot.cat;
  }

  const col = state.columns[target.index];
  if (!col) return false;
  if (!col.length) return true;
  const top = col[col.length - 1];
  if (!top.faceUp || top.kind === 'category') return false;
  return top.cat === first.cat;
}

function sameSource(src: Source, target: Target): boolean {
  return src.zone === 'column' && target.zone === 'column' && src.index === target.index;
}

export function applyMove(state: GameState, src: Source, target: Target): MoveResult {
  if (state.movesLeft <= 0 || sameSource(src, target)) return { ok: false };
  const run = getRun(state, src);
  if (!run || !canDrop(state, run, target)) return { ok: false };

  // Remove from source.
  if (src.zone === 'waste') {
    state.waste.pop();
  } else {
    const col = state.columns[src.index];
    col.splice(src.start);
    const top = col[col.length - 1];
    if (top && !top.faceUp) top.faceUp = true;
  }

  state.movesLeft--;

  if (target.zone === 'column') {
    state.columns[target.index].push(...run);
    return { ok: true };
  }

  const words = run.filter((c) => c.kind === 'word').length;
  let slot = state.slots[target.index];
  if (!slot) {
    slot = { cat: run[0].cat, filled: 0 };
    state.slots[target.index] = slot;
  }
  slot.filled += words;

  if (slot.filled >= state.categories[slot.cat].size) {
    const cat = slot.cat;
    state.slots[target.index] = null;
    state.completed++;
    return { ok: true, completedCat: cat };
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

/** All legal sources currently on the board. */
export function listSources(state: GameState): Source[] {
  const out: Source[] = [];
  if (state.waste.length) out.push({ zone: 'waste' });
  state.columns.forEach((col, index) => {
    for (let start = 0; start < col.length; start++) {
      if (getRun(state, { zone: 'column', index, start })) out.push({ zone: 'column', index, start });
    }
  });
  return out;
}

export function listTargets(state: GameState): Target[] {
  return [
    ...state.slots.map((_, index): Target => ({ zone: 'slot', index })),
    ...state.columns.map((_, index): Target => ({ zone: 'column', index })),
  ];
}

/** True if any card move or draw is still possible (ignores the move budget). */
export function hasAnyMove(state: GameState): boolean {
  if (state.stock.length || state.waste.length > 1) return true;
  for (const src of listSources(state)) {
    const run = getRun(state, src)!;
    for (const t of listTargets(state)) {
      if (sameSource(src, t)) continue;
      // Moving a whole column into another empty column is never progress.
      if (src.zone === 'column' && src.start === 0 && t.zone === 'column' && !state.columns[t.index].length) continue;
      if (canDrop(state, run, t)) return true;
    }
  }
  return false;
}

/** Best automatic destination for a run (used for tap-again / double-tap). */
export function autoTarget(state: GameState, src: Source): Target | null {
  const run = getRun(state, src);
  if (!run) return null;
  const slots = listTargets(state).filter((t) => t.zone === 'slot');
  // Prefer a slot already holding this category, then an empty slot.
  const matching = slots.find((t) => state.slots[t.index] && canDrop(state, run, t));
  if (matching) return matching;
  const empty = slots.find((t) => canDrop(state, run, t));
  if (empty) return empty;
  for (const t of listTargets(state)) {
    if (t.zone !== 'column' || sameSource(src, t)) continue;
    if (!state.columns[t.index].length) continue;
    if (canDrop(state, run, t)) return t;
  }
  return null;
}
