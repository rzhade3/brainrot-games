import { generateClusterGraph } from './clusters';
import { edgesShareNode, segmentsIntersect, type Point } from './geometry';

export const SAVE_KEY = 'brainrot-untangle:v1';
export interface PuzzleSave {
  version: 1;
  solved: number;
  points: Point[];
  edges: [number, number][];
}
export function newPuzzle(solved: number): PuzzleSave {
  const size = Math.min(20, [5, 7, 9][solved] ?? 12 + solved - 3);
  for (let i = 0; i < 30; i++) {
    const graph = generateClusterGraph(size);
    const save: PuzzleSave = { version: 1, solved, points: graph.start, edges: graph.edges };
    if (crossingFlags(save).some(Boolean)) return save;
  }
  // A connected graph with two independent edges always starts crossed here.
  return { version: 1, solved,
    points: [{ x: .2, y: .2 }, { x: .8, y: .8 }, { x: .2, y: .8 }, { x: .8, y: .2 }, { x: .5, y: .1 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]] };
}
export function crossingFlags(puzzle: Pick<PuzzleSave, 'points' | 'edges'>): boolean[] {
  const flags = puzzle.edges.map(() => false);
  puzzle.edges.forEach(([a, b], i) => {
    for (let j = i + 1; j < puzzle.edges.length; j++) {
      const [c, d] = puzzle.edges[j];
      if (!edgesShareNode([a, b], [c, d]) && segmentsIntersect(puzzle.points[a], puzzle.points[b], puzzle.points[c], puzzle.points[d])) flags[i] = flags[j] = true;
    }
  });
  return flags;
}
export function readPuzzle(raw: string | null): PuzzleSave | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PuzzleSave;
    if (p.version !== 1 || !Number.isSafeInteger(p.solved) || p.solved < 0 ||
      !Array.isArray(p.points) || p.points.length < 3 || p.points.length > 20 ||
      !p.points.every(q => q && Number.isFinite(q.x) && Number.isFinite(q.y) && q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1) ||
      !Array.isArray(p.edges) || p.edges.length < 2 || p.edges.length > 190 ||
      !p.edges.every(e => Array.isArray(e) && e.length === 2 && e.every(i => Number.isInteger(i) && i >= 0 && i < p.points.length) && e[0] !== e[1])) return null;
    // Older v1 saves also contain earnedNodes. Keep the exact puzzle and
    // progress, but omit that retired score when the save is written again.
    return { version: 1, solved: p.solved, points: p.points, edges: p.edges };
  } catch { return null; }
}
