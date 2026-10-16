import { attemptMove, solve, validateLayout, type Layout } from './rules';
import { catalogKey, isCatalogPuzzle } from './catalog';

export const ENDLESS_KEY = 'brainrot-cube-lines:endless:v1';
export const MODE_KEY = 'brainrot-cube-lines:mode';
export const SHARED_KEY = 'brainrot-cube-lines:shared:v1';
export const GENERATOR_EDITION = 1;
const HISTORY_LIMIT = 12;

export interface GeneratedPuzzle {
  edition: number;
  seed: number;
  layout: Layout;
  preset?: number;
}

export interface RecentPuzzle {
  seed: number;
  signature: string;
}

export interface EndlessSave {
  version: 1;
  cleared: number;
  puzzle: GeneratedPuzzle;
  removed: string[];
  finished: boolean;
  recent: RecentPuzzle[];
  next: GeneratedPuzzle | null;
  catalogSeen: string[];
}

export interface GenerationRequest {
  cleared: number;
  recent: readonly RecentPuzzle[];
  code?: string;
  catalogSeen?: readonly string[];
}

export type GenerationResponse =
  | { ok: true; puzzle: GeneratedPuzzle }
  | { ok: false; error: string };

export function puzzleSignature(layout: Layout): string {
  // Ignore generated line IDs/order, but retain body order because it determines the arrowhead.
  return `${layout.size}:${layout.lines.map(line =>
    line.cells.map(cell => `${cell.face}:${cell.x},${cell.y}`).join(';')).sort().join('|')}`;
}

export function rememberPuzzle(recent: readonly RecentPuzzle[], puzzle: GeneratedPuzzle): RecentPuzzle[] {
  return [...recent, { seed: puzzle.seed, signature: puzzleSignature(puzzle.layout) }].slice(-HISTORY_LIMIT);
}

export function newEndless(puzzle: GeneratedPuzzle): EndlessSave {
  return {
    version: 1, cleared: 0, puzzle, removed: [], finished: false,
    recent: rememberPuzzle([], puzzle), next: null,
    catalogSeen: isCatalogPuzzle(puzzle) ? [catalogKey(puzzle)] : [],
  };
}

export function rememberCatalog(save: EndlessSave, puzzle: GeneratedPuzzle): void {
  if (isCatalogPuzzle(puzzle) && !save.catalogSeen.includes(catalogKey(puzzle))) {
    save.catalogSeen.push(catalogKey(puzzle));
  }
}

export function completeEndless(save: EndlessSave): void {
  if (save.finished) return;
  if (save.cleared === Number.MAX_SAFE_INTEGER) throw new Error('Cube Lines: endless progress limit reached.');
  save.cleared++;
  save.finished = true;
}

export function advanceEndless(save: EndlessSave): void {
  if (!save.finished || !save.next) throw new Error('Cube Lines: next endless puzzle is not ready.');
  save.puzzle = save.next;
  save.next = null;
  save.removed = [];
  save.finished = false;
  save.recent = rememberPuzzle(save.recent, save.puzzle);
  rememberCatalog(save, save.puzzle);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function uint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

function readPuzzle(value: unknown): GeneratedPuzzle {
  if (!record(value) || !uint32(value.seed) ||
    typeof value.edition !== 'number' || !Number.isSafeInteger(value.edition) || value.edition < 1 ||
    !record(value.layout) || typeof value.layout.size !== 'number' || !Array.isArray(value.layout.lines) ||
    value.layout.lines.length < 1 || value.layout.lines.length > 1536 ||
    !value.layout.lines.every((line: unknown) => record(line) && typeof line.id === 'string' &&
      Array.isArray(line.cells) && line.cells.length >= 2 && line.cells.length <= 1536 &&
      line.cells.every((cell: unknown) => record(cell) && typeof cell.face === 'string' &&
        typeof cell.x === 'number' && typeof cell.y === 'number'))) {
    throw new Error('The saved endless puzzle is invalid.');
  }
  // Structural shape is checked above; the authoritative rules check coordinates, seams and IDs.
  const layout = value.layout as Layout;
  validateLayout(layout);
  if (solve(layout)?.length !== layout.lines.length) throw new Error('The saved endless puzzle has no solution.');
  if (value.preset !== undefined &&
    (typeof value.preset !== 'number' || !Number.isInteger(value.preset) || value.preset < 0 || value.preset > 5)) {
    throw new Error('The saved puzzle difficulty preset is invalid.');
  }
  return {
    edition: value.edition, seed: value.seed, layout,
    ...(value.preset === undefined ? {} : { preset: value.preset }),
  };
}

export function readEndless(raw: string | null): EndlessSave | null {
  if (!raw) return null;
  const data: unknown = JSON.parse(raw);
  if (!record(data) || data.version !== 1 ||
    typeof data.cleared !== 'number' || !Number.isSafeInteger(data.cleared) || data.cleared < 0 ||
    typeof data.finished !== 'boolean' ||
    !Array.isArray(data.removed) || !data.removed.every((id: unknown) => typeof id === 'string') ||
    !Array.isArray(data.recent) || data.recent.length > HISTORY_LIMIT ||
    !data.recent.every((item: unknown) => record(item) && uint32(item.seed) &&
      typeof item.signature === 'string' && item.signature.length <= 100000)) {
    throw new Error('The saved endless progress is invalid.');
  }
  const puzzle = readPuzzle(data.puzzle);
  if (data.catalogSeen !== undefined &&
    (!Array.isArray(data.catalogSeen) || data.catalogSeen.length > 10000 ||
      !data.catalogSeen.every((key: unknown) => typeof key === 'string' && /^\d+:[0-5]:\d{1,10}$/.test(key)))) {
    throw new Error('The saved seed catalog history is invalid.');
  }
  let remaining = puzzle.layout;
  for (const id of data.removed) {
    const move = attemptMove(remaining, id);
    if (!move.removed) throw new Error('The saved endless moves do not match this cube.');
    remaining = move.layout;
  }
  if (data.finished && (remaining.lines.length > 0 || data.cleared === 0)) {
    throw new Error('The saved endless completion is invalid.');
  }
  const recent = data.recent as RecentPuzzle[];
  if (!recent.some(item => item.seed === puzzle.seed && item.signature === puzzleSignature(puzzle.layout))) {
    throw new Error('The saved endless history does not match this cube.');
  }
  const next = data.next === null ? null : readPuzzle(data.next);
  if (next && recent.some(item => item.seed === next.seed || item.signature === puzzleSignature(next.layout))) {
    throw new Error('The saved next endless puzzle repeats a recent cube.');
  }
  const save: EndlessSave = {
    version: 1, cleared: data.cleared, puzzle, removed: data.removed,
    finished: data.finished, recent, next,
    catalogSeen: [...new Set(data.catalogSeen as string[] | undefined)],
  };
  rememberCatalog(save, puzzle);
  if (next) rememberCatalog(save, next);
  return save;
}
