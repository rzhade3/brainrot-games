import { shuffle, type GameState } from './rules';

/**
 * Exhaustive solver for Associations, used to validate random deals and to
 * detect when a game in progress can no longer be finished.
 *
 * Depth-first branch-and-bound over compact states with a transposition table
 * (state → fewest moves seen). The bound `h` is admissible: every house card
 * still in the stock needs a draw plus its own move out of the waste, every
 * waste card needs its own move, and every non-empty column needs one move
 * per face-down card plus one for its face-up stack (a buried card can only be
 * reached after the stack above it leaves, and stacks only move whole). That
 * makes an exhausted search a proof that no solution fits the budget.
 *
 * Moving a stack onto the slot that already holds its category is applied as
 * a forced move: it is never worse than any alternative (the cards have to go
 * there eventually, and doing so only frees space), which keeps search small.
 */

interface Col {
  down: number[];
  up: number[];
}

interface S {
  cols: Col[];
  stock: number[];
  waste: number[];
  /** Per slot: [cat, filled] or null. */
  slots: ([number, number] | null)[];
  done: number;
}

export type SolverMove =
  | { t: 'draw' }
  | { t: 'move'; from: number; to: 'slot' | 'col'; idx: number }; // from: -1 = waste

export interface SolveResult {
  /** A solution within the budget was found. */
  solved: boolean;
  /** Length of the best solution found (if solved). */
  length: number;
  /** True if the search finished without hitting the node limit. */
  complete: boolean;
  path: SolverMove[];
  nodes: number;
}

export interface SolveOptions {
  /** Maximum moves a solution may use. */
  budget: number;
  nodeLimit: number;
  /** Stop at the first solution instead of searching for shorter ones. */
  firstOnly?: boolean;
  /** Shuffle move order within each priority tier (for randomized restarts). */
  rng?: () => number;
}

export function solve(state: GameState, opts: SolveOptions): SolveResult {
  // Card metadata indexed by card id.
  const all = [...state.columns.flat(), ...state.stock, ...state.waste];
  const maxId = all.reduce((m, c) => Math.max(m, c.id), 0);
  const catOf = new Int16Array(maxId + 1);
  const isCat = new Uint8Array(maxId + 1);
  const rank = new Int16Array(maxId + 1);
  for (const c of all) {
    catOf[c.id] = c.cat;
    isCat[c.id] = c.kind === 'category' ? 1 : 0;
    rank[c.id] = c.rank;
  }
  const size = state.categories.map((c) => c.size);
  const ordered = state.categories.map((c) => c.ordered);
  const nCats = state.categories.length;

  const root: S = {
    cols: state.columns.map((col) => ({
      down: col.filter((c) => !c.faceUp).map((c) => c.id),
      up: col.filter((c) => c.faceUp).map((c) => c.id),
    })),
    stock: state.stock.map((c) => c.id),
    waste: state.waste.map((c) => c.id),
    slots: state.slots.map((s) => (s ? [s.cat, s.filled] : null)),
    done: state.completed,
  };

  const canSlot = (s: S, run: number[], i: number): boolean => {
    const top = run[run.length - 1];
    const slot = s.slots[i];
    if (!slot) {
      if (!isCat[top]) return false;
      return !ordered[catOf[top]] || run.length === 1 || rank[run[run.length - 2]] === 0;
    }
    if (isCat[top] || catOf[run[0]] !== slot[0]) return false;
    return !ordered[slot[0]] || rank[top] === slot[1];
  };

  const canCol = (s: S, run: number[], i: number): boolean => {
    const col = s.cols[i];
    if (!col.up.length) return col.down.length === 0;
    const top = col.up[col.up.length - 1];
    const first = run[0];
    if (isCat[top] || catOf[top] !== catOf[first]) return false;
    if (!ordered[catOf[first]]) return true;
    return isCat[first] ? rank[top] === 0 : rank[first] === rank[top] - 1;
  };

  const runOf = (s: S, from: number): number[] | null => {
    if (from < 0) return s.waste.length ? [s.waste[s.waste.length - 1]] : null;
    const up = s.cols[from].up;
    return up.length ? up : null;
  };

  const apply = (s: S, m: SolverMove): S => {
    const n: S = {
      cols: s.cols,
      stock: s.stock,
      waste: s.waste,
      slots: s.slots,
      done: s.done,
    };
    if (m.t === 'draw') {
      if (s.stock.length) {
        n.stock = s.stock.slice(0, -1);
        n.waste = [...s.waste, s.stock[s.stock.length - 1]];
      } else {
        n.stock = [...s.waste].reverse();
        n.waste = [];
      }
      return n;
    }
    let run: number[];
    if (m.from < 0) {
      run = [s.waste[s.waste.length - 1]];
      n.waste = s.waste.slice(0, -1);
      n.cols = s.cols;
    } else {
      n.cols = s.cols.slice();
      const src = s.cols[m.from];
      run = src.up;
      n.cols[m.from] = src.down.length
        ? { down: src.down.slice(0, -1), up: [src.down[src.down.length - 1]] }
        : { down: [], up: [] };
    }
    if (m.to === 'col') {
      if (n.cols === s.cols) n.cols = s.cols.slice();
      const dst = n.cols[m.idx];
      n.cols[m.idx] = { down: dst.down, up: [...dst.up, ...run] };
      return n;
    }
    n.slots = s.slots.slice();
    const words = isCat[run[run.length - 1]] ? run.length - 1 : run.length;
    const cur = s.slots[m.idx];
    const cat = cur ? cur[0] : catOf[run[0]];
    const filled = (cur ? cur[1] : 0) + words;
    if (filled >= size[cat]) {
      n.slots[m.idx] = null;
      n.done = s.done + 1;
    } else {
      n.slots[m.idx] = [cat, filled];
    }
    return n;
  };

  const genMoves = (s: S): SolverMove[] => {
    const sources: number[] = [];
    if (s.waste.length) sources.push(-1);
    s.cols.forEach((c, i) => c.up.length && sources.push(i));

    // Forced: a stack onto the slot already holding its category.
    for (const from of sources) {
      const run = runOf(s, from)!;
      for (let i = 0; i < s.slots.length; i++) {
        if (s.slots[i] && canSlot(s, run, i)) return [{ t: 'move', from, to: 'slot', idx: i }];
      }
    }

    const reveal: SolverMove[] = [];
    const other: SolverMove[] = [];
    const late: SolverMove[] = [];
    for (const from of sources) {
      const run = runOf(s, from)!;
      const reveals = from >= 0 && s.cols[from].down.length > 0;
      const bucket = reveals ? reveal : other;
      // Only one empty slot needs trying: empty slots are interchangeable.
      const emptySlot = s.slots.findIndex((x) => x === null);
      if (emptySlot >= 0 && canSlot(s, run, emptySlot)) bucket.push({ t: 'move', from, to: 'slot', idx: emptySlot });
      let triedEmptyCol = false;
      for (let i = 0; i < s.cols.length; i++) {
        if (i === from) continue;
        const dst = s.cols[i];
        const empty = !dst.up.length && !dst.down.length;
        if (empty) {
          // Moving a whole column into an empty one changes nothing.
          if (triedEmptyCol || (from >= 0 && !reveals)) continue;
          triedEmptyCol = true;
          late.push({ t: 'move', from, to: 'col', idx: i });
        } else if (canCol(s, run, i)) {
          bucket.push({ t: 'move', from, to: 'col', idx: i });
        }
      }
    }
    if (opts.rng) {
      shuffle(reveal, opts.rng);
      shuffle(other, opts.rng);
    }
    const moves = [...reveal, ...other];
    if (s.stock.length || s.waste.length > 1) moves.push({ t: 'draw' });
    return [...moves, ...late];
  };

  const keyOf = (s: S): string => {
    const cols = s.cols.map((c) => `${c.down.join(',')}.${c.up.join(',')}`).sort().join('|');
    const slots = s.slots.map((x) => (x ? `${x[0]}:${x[1]}` : '_')).sort().join(',');
    return `${cols}#${slots}#${s.stock.join(',')}/${s.waste.join(',')}`;
  };

  const h = (s: S): number => {
    let est = 2 * s.stock.length + s.waste.length;
    for (const c of s.cols) if (c.up.length) est += c.down.length + 1;
    return est;
  };

  const seen = new Map<string, number>();
  const path: SolverMove[] = [];
  let bestPath: SolverMove[] = [];
  let best = opts.budget + 1;
  let nodes = 0;
  let aborted = false;
  let stop = false;

  const search = (s: S, g: number): void => {
    if (s.done === nCats) {
      if (g < best) {
        best = g;
        bestPath = path.slice();
        if (opts.firstOnly) stop = true;
      }
      return;
    }
    if (g + h(s) >= best) return;
    if (++nodes > opts.nodeLimit) {
      aborted = true;
      return;
    }
    const key = keyOf(s);
    const prev = seen.get(key);
    if (prev !== undefined && prev <= g) return;
    seen.set(key, g);
    for (const m of genMoves(s)) {
      path.push(m);
      search(apply(s, m), g + 1);
      path.pop();
      if (aborted || stop) return;
    }
  };

  search(root, 0);
  const solved = best <= opts.budget;
  return { solved, length: solved ? best : -1, complete: !aborted, path: bestPath, nodes };
}
