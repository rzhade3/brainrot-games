import type { Point } from './cases';

export const gap = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const brushCoverageInset = 6;
export const bound = (n: number) => Math.min(1, Math.max(0, n));

export function edgeContact([start, end]: readonly [Point, Point], at: Point): Point {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return start;
  const along = bound(((at[0] - start[0]) * dx + (at[1] - start[1]) * dy) / lengthSquared);
  return [start[0] + dx * along, start[1] + dy * along];
}

export function sampleSurface(contains: (point: Point) => boolean): Point[] {
  const samples: Point[] = [];
  for (let y = 3; y < 600; y += 6) {
    for (let x = 3; x < 600; x += 6) {
      const point: Point = [x, y];
      if (contains(point)) samples.push(point);
    }
  }
  return samples;
}

export function sampleLine(line: readonly Point[]): Point[] {
  return line.slice(1).flatMap((end, index) => {
    const start = line[index];
    const steps = Math.max(1, Math.ceil(gap(start, end) / 6));
    return Array.from({ length: steps }, (_, i): Point => [
      start[0] + (end[0] - start[0]) * i / steps,
      start[1] + (end[1] - start[1]) * i / steps,
    ]);
  }).concat(line.slice(-1));
}

export class Coverage {
  private readonly uncovered: Set<Point>;
  private readonly total: number;

  constructor(private readonly points: readonly Point[], private readonly radius: number) {
    this.uncovered = new Set(points);
    this.total = this.uncovered.size;
  }

  get fraction(): number {
    return this.total ? 1 - this.uncovered.size / this.total : 0;
  }

  get complete(): boolean {
    // Leave room for a few edge cells that are hard to reach with a finger.
    return this.fraction >= .99;
  }

  touches([x, y]: Point): boolean {
    const radiusSquared = this.radius * this.radius;
    return this.points.some(([px, py]) => (x - px) ** 2 + (y - py) ** 2 <= radiusSquared);
  }

  stroke(from: Point, to: Point): boolean {
    const previous = this.uncovered.size;
    const minX = Math.min(from[0], to[0]) - this.radius;
    const maxX = Math.max(from[0], to[0]) + this.radius;
    const minY = Math.min(from[1], to[1]) - this.radius;
    const maxY = Math.max(from[1], to[1]) + this.radius;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const lengthSquared = dx * dx + dy * dy;
    const radiusSquared = this.radius * this.radius;
    for (const point of this.uncovered) {
      const [x, y] = point;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const along = lengthSquared ? bound(((x - from[0]) * dx + (y - from[1]) * dy) / lengthSquared) : 0;
      if ((x - from[0] - dx * along) ** 2 + (y - from[1] - dy * along) ** 2 <= radiusSquared) {
        this.uncovered.delete(point);
      }
    }
    return previous !== this.uncovered.size;
  }
}
