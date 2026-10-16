export const FACES = ['front', 'right', 'back', 'left', 'top', 'bottom'] as const;
export type Face = typeof FACES[number];
export type Cell = Readonly<{ x: number; y: number }>;
export type SurfaceCell = Cell & Readonly<{ face: Face }>;
export type Vec3 = readonly [number, number, number];

export const FACE_AXES: Record<Face, { normal: Vec3; u: Vec3; v: Vec3 }> = {
  front: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  right: { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  back: { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  left: { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  top: { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  bottom: { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
};

export const DIRECTIONS: readonly Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, value, i) => sum + value * b[i], 0);

export function key(cell: SurfaceCell): string {
  return `${cell.face}:${cell.x},${cell.y}`;
}

// Crossing an edge rotates the surface tangent 90 degrees, including top/bottom reversals.
export function step(cell: SurfaceCell, d: Cell, size: number): SurfaceCell {
  const x = cell.x + d.x;
  const y = cell.y + d.y;
  if (x >= 0 && y >= 0 && x < size && y < size) return { face: cell.face, x, y };
  const { normal, u, v } = FACE_AXES[cell.face];
  const outward: Vec3 = [u[0] * d.x + v[0] * d.y, u[1] * d.x + v[1] * d.y, u[2] * d.x + v[2] * d.y];
  const face = FACES.find(name => dot(FACE_AXES[name].normal, outward) === 1);
  if (!face) throw new Error('Cube Lines: invalid edge direction.');
  const target = FACE_AXES[face];
  const span = size - 1;
  const px = cell.x * 2 - span;
  const py = cell.y * 2 - span;
  const point: Vec3 = [
    normal[0] * span + u[0] * px + v[0] * py,
    normal[1] * span + u[1] * px + v[1] * py,
    normal[2] * span + u[2] * px + v[2] * py,
  ];
  return { face, x: (dot(point, target.u) + span) / 2, y: (dot(point, target.v) + span) / 2 };
}

export function toWorld(face: Face, cell: Cell, size: number, lift = 0.014): Vec3 {
  const { normal, u, v } = FACE_AXES[face];
  const x = ((cell.x + 0.5) / size - 0.5) * 2;
  const y = ((cell.y + 0.5) / size - 0.5) * 2;
  return [
    normal[0] * (1 + lift) + u[0] * x + v[0] * y,
    normal[1] * (1 + lift) + u[1] * x + v[1] * y,
    normal[2] * (1 + lift) + u[2] * x + v[2] * y,
  ];
}
