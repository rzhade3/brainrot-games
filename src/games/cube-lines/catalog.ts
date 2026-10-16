import data from './catalog.json';

export const CATALOG = data;

export function catalogKey(puzzle: { edition: number; preset?: number; seed: number }): string {
  return `${puzzle.edition}:${puzzle.preset}:${puzzle.seed}`;
}

export function isCatalogPuzzle(puzzle: { edition: number; preset?: number; seed: number }): boolean {
  return puzzle.edition === CATALOG.edition && puzzle.preset !== undefined &&
    !!CATALOG.presets[puzzle.preset]?.includes(puzzle.seed);
}
