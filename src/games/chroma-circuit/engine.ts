import { SIZE, type Color, type Mosaic } from './art';

export const BELT_CAPACITY = 4;
export const SLOT_COUNT = 5;
const TILE_TIME = 30;
const LAUNCH_GAP = 290;
const CLEANUP_SPEED = 3;
const OUTER = -1.6;
const FAR = SIZE - OUTER;

interface Stop {
  x: number;
  y: number;
  time: number;
  ray: number[];
}

const track: Stop[] = [{ x: SIZE / 2, y: FAR, time: 0, ray: [] }];

function addStop(x: number, y: number, ray: number[] = []): void {
  const prev = track[track.length - 1];
  track.push({ x, y, time: prev.time + Math.hypot(x - prev.x, y - prev.y) * TILE_TIME, ray });
}

const line = (index: (i: number) => number) => Array.from({ length: SIZE }, (_, i) => index(i));
const bottom = (col: number) => addStop(col + 0.5, FAR, line(i => (SIZE - 1 - i) * SIZE + col));
for (let col = SIZE / 2 - 1; col >= 0; col--) bottom(col);
addStop(OUTER, FAR);
for (let row = SIZE - 1; row >= 0; row--) addStop(OUTER, row + 0.5, line(i => row * SIZE + i));
addStop(OUTER, OUTER);
for (let col = 0; col < SIZE; col++) addStop(col + 0.5, OUTER, line(i => i * SIZE + col));
addStop(FAR, OUTER);
for (let row = 0; row < SIZE; row++) addStop(FAR, row + 0.5, line(i => row * SIZE + SIZE - 1 - i));
addStop(FAR, FAR);
for (let col = SIZE - 1; col >= SIZE / 2; col--) bottom(col);
addStop(SIZE / 2, FAR);

export const LAP_TIME = track[track.length - 1].time;

export interface Load { color: Color; ammo: number }
export interface Level { name: string; tiles: Mosaic; lanes: Load[][] }
interface Shooter extends Load { id: number }
interface Rider extends Shooter { start: number; next: number }
export type Source = 'supply' | 'waiting';
export interface Hit { x: number; y: number; tile: number; color: Color; time: number }

export function lap(tiles: Mosaic, color: Color, ammo: number): number {
  const initial = ammo;
  for (const { ray } of track) {
    const tile = ray.find(index => tiles[index] !== null);
    if (tile === undefined || tiles[tile] !== color) continue;
    tiles[tile] = null;
    if (--ammo === 0) break;
  }
  return initial - ammo;
}

export function riderPosition(rider: Rider, time: number): { x: number; y: number } {
  const previous = track[rider.next - 1];
  const next = track[rider.next];
  const fraction = Math.min(1, Math.max(0, (time - rider.start - previous.time) / (next.time - previous.time)));
  return { x: previous.x + (next.x - previous.x) * fraction, y: previous.y + (next.y - previous.y) * fraction };
}

export class Circuit {
  readonly tiles: Mosaic;
  readonly supply: Shooter[][];
  readonly waiting: (Shooter | null)[] = Array(SLOT_COUNT).fill(null);
  readonly riders: Rider[] = [];
  readonly total: number;
  remaining: number;
  phase: 'playing' | 'won' | 'lost' = 'playing';
  failure: 'overflow' | 'blocked' | null = null;
  time = 0;
  private cleanup = false;
  private lastLaunch = -LAUNCH_GAP;

  constructor(level: Level) {
    let id = 0;
    this.tiles = [...level.tiles];
    this.supply = level.lanes.map(lane => lane.map(load => ({ ...load, id: ++id })));
    this.total = this.remaining = this.tiles.filter(Boolean).length;
  }

  get canLaunch(): boolean {
    return this.phase === 'playing' && !this.cleanup && this.riders.length < BELT_CAPACITY && this.time - this.lastLaunch >= LAUNCH_GAP;
  }

  get clearingAutomatically(): boolean {
    return this.phase === 'playing' && this.cleanup;
  }

  launch(source: Source, slot: number): boolean {
    const shooter = source === 'supply' ? this.supply[slot]?.[0] : this.waiting[slot];
    if (!shooter || !this.canLaunch) return false;
    if (source === 'supply') this.supply[slot].shift();
    else this.waiting[slot] = null;
    this.riders.push({ ...shooter, start: this.time, next: 1 });
    this.lastLaunch = this.time;
    this.cleanup = this.hasAmmoForRemainingTiles();
    return true;
  }

  private hasAmmoForRemainingTiles(): boolean {
    const ammo = new Map<Color, number>();
    for (const rider of this.riders) ammo.set(rider.color, (ammo.get(rider.color) ?? 0) + rider.ammo);
    for (const tile of this.tiles) {
      if (tile === null) continue;
      const remainingAmmo = ammo.get(tile) ?? 0;
      if (remainingAmmo === 0) return false;
      ammo.set(tile, remainingAmmo - 1);
    }
    return true;
  }

  advance(elapsed: number, onHit?: (hit: Hit) => void): boolean {
    this.time += this.clearingAutomatically ? elapsed * CLEANUP_SPEED : elapsed;
    if (this.phase !== 'playing') return false;
    let changed = false;
    while (this.riders.length) {
      // Resolve shots in timestamp order, even if a frame spans several stops.
      const rider = this.riders.reduce((first, candidate) =>
        candidate.start + track[candidate.next].time < first.start + track[first.next].time ? candidate : first);
      const stop = track[rider.next];
      const time = rider.start + stop.time;
      if (time > this.time) break;
      rider.next++;
      const tile = stop.ray.find(index => this.tiles[index] !== null);
      if (tile !== undefined && this.tiles[tile] === rider.color) {
        this.tiles[tile] = null;
        this.remaining--;
        rider.ammo--;
        changed = true;
        onHit?.({ x: stop.x, y: stop.y, tile, color: rider.color, time });
        if (this.remaining === 0) {
          this.phase = 'won';
          this.riders.length = 0;
          return true;
        }
      }
      const finished = rider.next === track.length;
      if (rider.ammo > 0 && !finished) continue;
      if (rider.ammo > 0 && this.cleanup) {
        rider.start = time;
        rider.next = 1;
        continue;
      }
      this.riders.splice(this.riders.indexOf(rider), 1);
      changed = true;
      if (rider.ammo === 0) continue;
      const slot = this.waiting.indexOf(null);
      if (slot === -1) {
        this.phase = 'lost';
        this.failure = 'overflow';
        return true;
      }
      this.waiting[slot] = { id: rider.id, ammo: rider.ammo, color: rider.color };
    }
    if (!this.riders.length && changed) this.checkBlocked();
    return changed;
  }

  private checkBlocked(): void {
    if (this.supply.some(lane => lane.length > 0)) return;
    const exposed = new Set(track.map(({ ray }) => this.tiles[ray.find(index => this.tiles[index] !== null) ?? -1]));
    const available = [...this.waiting, ...this.supply.map(lane => lane[0])];
    if (available.some(shooter => shooter && exposed.has(shooter.color))) return;
    this.phase = 'lost';
    this.failure = 'blocked';
  }
}
