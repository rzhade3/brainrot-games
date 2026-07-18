import { Point, segmentsIntersect } from './geometry';

export type ClusterGraph = {
  /** Node start positions, normalized to 0..1 (scrambled / tangled). */
  start: Point[];
  /** Edges as pairs of local node indices. */
  edges: [number, number][];
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generate a guaranteed-planar, connected graph of `size` nodes plus a
 * scrambled starting layout. We lay out "solution" points, greedily add the
 * shortest edges that don't cross any already-added edge in that solution
 * layout (guaranteeing a planar embedding exists, i.e. the cluster is
 * solvable), then discard the solution positions and hand back a scrambled
 * start layout in local 0..1 space.
 */
export function generateClusterGraph(size: number): ClusterGraph {
  const nodeCount = Math.max(3, size);

  const solution: Point[] = [];
  for (let i = 0; i < nodeCount; i++) {
    solution.push({ x: rand(0.08, 0.92), y: rand(0.08, 0.92) });
  }

  const candidates: { a: number; b: number; d: number }[] = [];
  for (let a = 0; a < nodeCount; a++) {
    for (let b = a + 1; b < nodeCount; b++) {
      const dx = solution[a].x - solution[b].x;
      const dy = solution[a].y - solution[b].y;
      candidates.push({ a, b, d: dx * dx + dy * dy });
    }
  }
  candidates.sort((p, q) => p.d - q.d);

  const edges: [number, number][] = [];
  const degree = new Array(nodeCount).fill(0);
  const maxDegree = 4;

  const crossesExisting = (a: number, b: number): boolean => {
    for (const [c, d] of edges) {
      if (a === c || a === d || b === c || b === d) continue;
      if (segmentsIntersect(solution[a], solution[b], solution[c], solution[d])) {
        return true;
      }
    }
    return false;
  };

  for (const { a, b } of candidates) {
    if (degree[a] >= maxDegree || degree[b] >= maxDegree) continue;
    if (crossesExisting(a, b)) continue;
    edges.push([a, b]);
    degree[a]++;
    degree[b]++;
  }

  connectComponents(nodeCount, edges, solution, crossesExisting, degree);

  // Scrambled starting layout (place on a circle so everything overlaps).
  const start: Point[] = [];
  const order = shuffle([...Array(nodeCount).keys()]);
  for (let i = 0; i < nodeCount; i++) {
    const angle = (order[i] / nodeCount) * Math.PI * 2;
    const r = 0.34 + rand(-0.05, 0.05);
    start[i] = {
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r,
    };
  }

  return { start, edges };
}

function connectComponents(
  n: number,
  edges: [number, number][],
  solution: Point[],
  crosses: (a: number, b: number) => boolean,
  degree: number[]
): void {
  const parent = [...Array(n).keys()];
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (x: number, y: number) => {
    parent[find(x)] = find(y);
  };
  for (const [a, b] of edges) union(a, b);

  let changed = true;
  while (changed) {
    changed = false;
    const roots = new Set<number>();
    for (let i = 0; i < n; i++) roots.add(find(i));
    if (roots.size <= 1) break;

    let best: { a: number; b: number; d: number } | null = null;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        if (find(a) === find(b)) continue;
        if (crosses(a, b)) continue;
        const dx = solution[a].x - solution[b].x;
        const dy = solution[a].y - solution[b].y;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    if (best) {
      edges.push([best.a, best.b]);
      degree[best.a]++;
      degree[best.b]++;
      union(best.a, best.b);
      changed = true;
    } else {
      break;
    }
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
