import { DIRECTIONS, FACES, step, type SurfaceCell } from './surface';
import { turns, type Layout } from './rules';

// The generator alone uses integer cells; gameplay and stored layouts retain surface coordinates.
export class SurfaceIndex {
  readonly count: number;
  readonly cells: readonly SurfaceCell[];
  readonly neighbors: Uint16Array;
  readonly faces: Uint8Array;
  private readonly rays: readonly Uint16Array[];

  constructor(readonly size: number) {
    if (!Number.isInteger(size) || size < 2 || size > 16) {
      throw new Error('Cube Lines: invalid generation grid size.');
    }
    this.count = 6 * size * size;
    this.cells = Array.from({ length: this.count }, (_, id) => ({
      face: FACES[Math.floor(id / (size * size))], x: id % size, y: Math.floor(id / size) % size,
    }));
    this.faces = Uint8Array.from(this.cells, cell => FACES.indexOf(cell.face));
    this.neighbors = new Uint16Array(this.count * 4);
    const rays: Uint16Array[] = [];
    for (const [id, cell] of this.cells.entries()) {
      for (const [direction, d] of DIRECTIONS.entries()) {
        this.neighbors[id * 4 + direction] = this.id(step(cell, d, size));
        const ray: number[] = [];
        for (let x = cell.x + d.x, y = cell.y + d.y;
          x >= 0 && y >= 0 && x < size && y < size; x += d.x, y += d.y) {
          ray.push(this.id({ face: cell.face, x, y }));
        }
        rays.push(Uint16Array.from(ray));
      }
    }
    this.rays = rays;
  }

  id(cell: SurfaceCell): number {
    return FACES.indexOf(cell.face) * this.size * this.size + cell.y * this.size + cell.x;
  }

  exitRay(previous: number, head: number): Uint16Array {
    // Opposite of the step back to the previous cell, even when that step crosses a seam.
    for (let d = 0; d < 4; d++) {
      if (this.neighbors[head * 4 + d] === previous) return this.rays[head * 4 + (d ^ 1)];
    }
    throw new Error('Cube Lines: non-adjacent indexed path.');
  }
}

const surfaces = new Map<number, SurfaceIndex>();
export function generationSurface(size: number): SurfaceIndex {
  let surface = surfaces.get(size);
  if (!surface) {
    surface = new SurfaceIndex(size);
    surfaces.set(size, surface);
  }
  return surface;
}

export class GenerationIndex {
  readonly owner: Int16Array;
  readonly bodies: (readonly number[])[] = [];
  readonly blockerCounts: Uint16Array;
  readonly dependents: number[][] = [];
  readonly headFaces: number[] = [];
  readonly faceCoverage = new Uint16Array(6);
  readonly faceHeads = new Uint16Array(6);
  private readonly watchers: number[][];
  private readonly rays: Uint16Array[] = [];
  private readonly faceLinks = new Uint8Array(6);
  private readonly crossBlocked: Uint8Array;
  private readonly seen: Uint32Array;
  private stamp = 0;
  occupied = 0;
  private bent = 0;
  private multiTurn = 0;
  private long = 0;
  private wrapped = 0;
  private blocked = 0;
  private crossFace = 0;

  constructor(readonly surface: SurfaceIndex) {
    this.owner = new Int16Array(surface.count).fill(-1);
    this.blockerCounts = new Uint16Array(surface.count);
    this.crossBlocked = new Uint8Array(surface.count);
    this.seen = new Uint32Array(surface.count);
    this.watchers = Array.from({ length: surface.count }, () => []);
  }

  obstructedBy(body: readonly number[]): number[] {
    if (++this.stamp === 0xffffffff) {
      this.seen.fill(0);
      this.stamp = 1;
    }
    const affected: number[] = [];
    for (const cell of body) {
      for (const line of this.watchers[cell]) {
        if (this.seen[line] === this.stamp) continue;
        this.seen[line] = this.stamp;
        affected.push(line);
      }
    }
    return affected;
  }

  add(body: readonly number[], ray: Uint16Array, affected: readonly number[]): void {
    const id = this.bodies.length;
    const face = this.surface.faces[body[body.length - 1]];
    this.bodies.push(body);
    this.headFaces.push(face);
    this.faceHeads[face]++;
    this.rays.push(ray);
    this.dependents.push([...affected]);
    for (const cell of body) {
      this.owner[cell] = id;
      this.faceCoverage[this.surface.faces[cell]]++;
    }
    this.occupied += body.length;
    for (const cell of ray) this.watchers[cell].push(id);
    for (const older of affected) {
      if (this.blockerCounts[older]++ === 0) this.blocked++;
      const otherFace = this.headFaces[older];
      if (face !== otherFace) {
        if (!this.crossBlocked[older]) {
          this.crossBlocked[older] = 1;
          this.crossFace++;
        }
        this.faceLinks[face] |= 1 << otherFace;
        this.faceLinks[otherFace] |= 1 << face;
      }
    }
    const cells = body.map(cell => this.surface.cells[cell]);
    const bends = turns({ id: `line-${id}`, cells });
    if (bends) this.bent++;
    if (bends >= 2) this.multiTurn++;
    if (body.length >= this.surface.size) this.long++;
    if (body.some(cell => this.surface.faces[cell] !== this.surface.faces[body[0]])) this.wrapped++;
  }

  freeExits(): number[] {
    const exits: number[] = [];
    // Preserve insertion and ray order, including duplicates, to preserve seeded sampling.
    for (let id = 0; id < this.bodies.length; id++) {
      if (this.blockerCounts[id]) continue;
      for (const cell of this.rays[id]) {
        if (this.owner[cell] === -1) exits.push(cell);
      }
    }
    return exits;
  }

  metrics() {
    const count = this.bodies.length || 1;
    const depths = new Uint16Array(this.bodies.length).fill(1);
    let depth = 0;
    // All edges point from a newer blocker to an older line: reverse IDs are a topological order.
    for (let id = this.bodies.length - 1; id >= 0; id--) {
      depth = Math.max(depth, depths[id]);
      for (const older of this.dependents[id]) depths[older] = Math.max(depths[older], depths[id] + 1);
    }
    let visited = 0;
    let faceGroups = 0;
    for (let face = 0; face < 6; face++) {
      if (visited & 1 << face) continue;
      faceGroups++;
      let pending = 1 << face;
      while (pending) {
        const next = 31 - Math.clz32(pending);
        pending &= ~(1 << next);
        visited |= 1 << next;
        pending |= this.faceLinks[next] & ~visited;
      }
    }
    return {
      density: this.occupied / this.surface.count,
      bent: this.bent / count, blocked: this.blocked, depth,
      long: this.long / count, wrapped: this.wrapped / count,
      crossFace: this.crossFace / count, faceGroups,
      multiTurn: this.multiTurn / count,
    };
  }

  layout(): Layout {
    return {
      size: this.surface.size,
      lines: this.bodies.map((body, id) => ({
        id: `line-${id}`, cells: body.map(cell => this.surface.cells[cell]),
      })),
    };
  }
}
