import { direction, exitCells, key, type PuzzleLine } from './rules';
import { FACE_AXES, toWorld, type Vec3 } from './surface';
export { FACE_AXES, toWorld } from './surface';

export function firstImpact(line: PuzzleLine, lines: readonly PuzzleLine[], size: number): { blocker: PuzzleLine; distance: number } | null {
  const others = lines.filter(other => other.id !== line.id);
  for (const [index, cell] of exitCells(line, size).entries()) {
    const blocker = others.find(other => other.cells.some(point => key(point) === key(cell)));
    // Arrow tip extends 0.28 cells; leave room for the thickened blocker stroke.
    if (blocker) return { blocker, distance: index + 1 - 0.37 };
  }
  return null;
}

export function impactMotion(elapsed: number, distance: number): { distance: number; hit: boolean; complete: boolean } {
  const approach = Math.min(240, 100 + Math.sqrt(distance) * 55);
  const hit = elapsed >= approach;
  if (!hit) return { distance: distance * (elapsed / approach) ** 2.5, hit, complete: false };
  const recoil = Math.max(0, Math.min(1, (elapsed - approach - 45) / 300));
  return { distance: distance * (1 - recoil) ** 3, hit, complete: recoil === 1 };
}

export function surfacePath(line: PuzzleLine, size: number): Vec3[] {
  const path: Vec3[] = [];
  for (const [index, cell] of line.cells.entries()) {
    const point = toWorld(cell.face, cell, size, 0.02);
    const previous = line.cells[index - 1];
    if (previous && previous.face !== cell.face) {
      const a = FACE_AXES[previous.face].normal;
      const b = FACE_AXES[cell.face].normal;
      const from = path[path.length - 1];
      // Follow the outside of the edge, never a diagonal chord through the cube.
      path.push([0, 1, 2].map(axis => a[axis] || b[axis]
        ? (a[axis] + b[axis]) * 1.02 : (from[axis] + point[axis]) / 2) as [number, number, number]);
    }
    path.push(point);
  }
  return path;
}

export function worldDirection(line: PuzzleLine): Vec3 {
  const { u, v } = FACE_AXES[line.cells[line.cells.length - 1].face];
  const d = direction(line);
  return [u[0] * d.x + v[0] * d.y, u[1] * d.x + v[1] * d.y, u[2] * d.x + v[2] * d.y];
}

// Distances are in cell units. Retain every surface corner until the tail has passed it.
export function movingPath(line: PuzzleLine, distance: number, size: number): Vec3[] {
  const path = surfacePath(line, size);
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(...path[i].map((value, axis) => value - path[i - 1][axis])) * size / 2);
  }
  const total = lengths[lengths.length - 1];
  const d = worldDirection(line);
  const sample = (at: number): Vec3 => {
    if (at >= total) return path[path.length - 1].map((value, axis) =>
      value + d[axis] * (at - total) * 2 / size) as [number, number, number];
    const index = lengths.findIndex(length => length > at);
    const t = (at - lengths[index - 1]) / (lengths[index] - lengths[index - 1]);
    return path[index - 1].map((value, axis) =>
      value + (path[index][axis] - value) * t) as [number, number, number];
  };
  if (distance === 0) return path;
  return [
    sample(distance),
    ...path.filter((_, index) => lengths[index] > distance && lengths[index] < distance + total),
    sample(distance + total),
  ];
}
