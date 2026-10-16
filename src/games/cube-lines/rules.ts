import { DIRECTIONS, FACES, FACE_AXES, key, step, type Cell, type SurfaceCell } from './surface';
export { FACES, key, type Cell, type Face, type SurfaceCell } from './surface';
export type PuzzleLine = Readonly<{ id: string; cells: readonly SurfaceCell[] }>;
export type Layout = Readonly<{ size: number; lines: readonly PuzzleLine[] }>;

export function direction(line: PuzzleLine): Cell {
  const head = line.cells[line.cells.length - 1];
  const previous = line.cells[line.cells.length - 2];
  if (head.face !== previous.face) {
    const normal = FACE_AXES[previous.face].normal;
    const { u, v } = FACE_AXES[head.face];
    return {
      x: -normal.reduce((sum, value, i) => sum + value * u[i], 0),
      y: -normal.reduce((sum, value, i) => sum + value * v[i], 0),
    };
  }
  return { x: head.x - previous.x, y: head.y - previous.y };
}

export function headFace(line: PuzzleLine): SurfaceCell['face'] {
  return line.cells[line.cells.length - 1].face;
}

export function exitCells(line: PuzzleLine, size: number): SurfaceCell[] {
  const head = line.cells[line.cells.length - 1];
  const d = direction(line);
  const cells: SurfaceCell[] = [];
  for (let x = head.x + d.x, y = head.y + d.y;
    x >= 0 && y >= 0 && x < size && y < size; x += d.x, y += d.y) {
    cells.push({ face: head.face, x, y });
  }
  return cells;
}

export function blockers(line: PuzzleLine, lines: readonly PuzzleLine[], size: number): PuzzleLine[] {
  const ray = new Set(exitCells(line, size).map(key));
  return lines.filter(other => other.id !== line.id &&
    other.cells.some(cell => ray.has(key(cell))));
}

export function removable(lines: readonly PuzzleLine[], size: number): PuzzleLine[] {
  return lines.filter(line => blockers(line, lines, size).length === 0);
}

export function attemptMove(layout: Layout, id: string): { layout: Layout; removed: boolean; blockedBy: readonly PuzzleLine[] } {
  const line = layout.lines.find(candidate => candidate.id === id);
  if (!line) return { layout, removed: false, blockedBy: [] };
  const blockedBy = blockers(line, layout.lines, layout.size);
  return blockedBy.length
    ? { layout, removed: false, blockedBy }
    : { layout: { ...layout, lines: layout.lines.filter(other => other.id !== id) }, removed: true, blockedBy };
}

export function solve(layout: Layout): string[] | null {
  let remaining = layout;
  const result: string[] = [];
  while (remaining.lines.length) {
    const next = removable(remaining.lines, remaining.size)[0];
    if (!next) return null;
    result.push(next.id);
    remaining = attemptMove(remaining, next.id).layout;
  }
  return result;
}

export function turns(line: PuzzleLine): number {
  let count = 0;
  for (let i = 2; i < line.cells.length; i++) {
    const [a, b, c] = [line.cells[i - 2], line.cells[i - 1], line.cells[i]];
    if (a.face !== b.face || b.face !== c.face ||
      b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) count++;
  }
  return count;
}

export function validateLayout(layout: Layout): void {
  if (!Number.isInteger(layout.size) || layout.size < 2 || layout.size > 16) {
    throw new Error('Cube Lines: invalid grid size.');
  }
  const occupied = new Set<string>();
  const ids = new Set<string>();
  for (const line of layout.lines) {
    if (!line.id || ids.has(line.id) || line.cells.length < 2) {
      throw new Error(`Cube Lines: invalid line ${line.id}.`);
    }
    ids.add(line.id);
    for (let i = 0; i < line.cells.length; i++) {
      const cell = line.cells[i];
      const position = key(cell);
      if (!FACES.includes(cell.face) || !Number.isInteger(cell.x) || !Number.isInteger(cell.y) ||
        cell.x < 0 || cell.y < 0 || cell.x >= layout.size || cell.y >= layout.size || occupied.has(position)) {
        throw new Error(`Cube Lines: overlapping or out-of-bounds cell on ${line.id}.`);
      }
      if (i > 0) {
        const prev = line.cells[i - 1];
        if (!DIRECTIONS.some(d => key(step(prev, d, layout.size)) === position)) {
          throw new Error(`Cube Lines: non-adjacent surface path on ${line.id}.`);
        }
      }
      occupied.add(position);
    }
    const body = new Set(line.cells.slice(0, -1).map(key));
    if (exitCells(line, layout.size).some(cell => body.has(key(cell)))) {
      throw new Error(`Cube Lines: self-colliding exit on ${line.id}.`);
    }
  }
}

function dependencyDepth(lines: readonly PuzzleLine[], size: number): number {
  let remaining = [...lines];
  let depth = 0;
  while (remaining.length) {
    const free = new Set(removable(remaining, size).map(line => line.id));
    if (!free.size) throw new Error('Cube Lines: cyclic dependencies.');
    remaining = remaining.filter(line => !free.has(line.id));
    depth++;
  }
  return depth;
}

export function metrics(layout: Layout): {
  density: number; bent: number; blocked: number; depth: number; long: number; wrapped: number; crossFace: number; faceGroups: number;
} {
  const count = layout.lines.length || 1;
  const links = new Map(FACES.map(face => [face, new Set<typeof face>()]));
  for (const line of layout.lines) {
    for (const other of blockers(line, layout.lines, layout.size)) {
      links.get(headFace(line))!.add(headFace(other));
      links.get(headFace(other))!.add(headFace(line));
    }
  }
  const visited = new Set<typeof FACES[number]>();
  let faceGroups = 0;
  const visit = (face: typeof FACES[number]) => {
    if (visited.has(face)) return;
    visited.add(face);
    links.get(face)!.forEach(visit);
  };
  for (const face of FACES) {
    if (visited.has(face)) continue;
    faceGroups++;
    visit(face);
  }
  return {
    density: layout.lines.reduce((total, line) => total + line.cells.length, 0) / (6 * layout.size ** 2),
    bent: layout.lines.filter(line => turns(line) > 0).length / count,
    blocked: layout.lines.length - removable(layout.lines, layout.size).length,
    depth: dependencyDepth(layout.lines, layout.size),
    long: layout.lines.filter(line => line.cells.length >= layout.size).length / count,
    wrapped: layout.lines.filter(line => new Set(line.cells.map(cell => cell.face)).size > 1).length / count,
    crossFace: layout.lines.filter(line => blockers(line, layout.lines, layout.size)
      .some(other => headFace(other) !== headFace(line))).length / count,
    faceGroups,
  };
}
