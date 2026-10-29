export type Kind = 'bin' | 'person' | 'tree' | 'car' | 'house' | 'tower' | 'landmark';
export interface Item { x: number; z: number; size: number; points: number; kind: Kind; eaten: boolean; falling?: boolean }
export interface Hole { x: number; z: number; score: number; radius: number; name: string; color: number; respawn: number }
export const LIMIT = 86;
export const MILESTONES = [
  { score: 0, radius: 1.65, name: 'Street snacks', menu: 'TREES' },
  { score: 30, radius: 2.051, name: 'Park picnic', menu: 'CARS' },
  { score: 180, radius: 2.851, name: 'Traffic eater', menu: 'HOUSES' },
  { score: 450, radius: 4.001, name: 'Block party', menu: 'TOWERS' },
  { score: 1100, radius: 6.501, name: 'Skyline snack', menu: 'LANDMARKS' },
  { score: 2600, radius: 9.501, name: 'City devourer', menu: 'THE WHOLE CITY' },
  { score: 7000, radius: 15, name: 'Bottomless', menu: 'THE WHOLE CITY' },
] as const;
export function radiusFor(score: number): number {
  for (let i = 1;i < MILESTONES.length;i++) {
    const previous = MILESTONES[i - 1], next = MILESTONES[i];
    if (score < next.score) return previous.radius + (next.radius - previous.radius) *
      Math.max(0, score - previous.score) / (next.score - previous.score);
  }
  return Math.min(18, 15 + Math.max(0, score - 7000) / 1200);
}
export function growthStage(score: number) {
  return Math.max(0, MILESTONES.filter(stage => score >= stage.score).length - 1);
}
export const spawnPoints = [
  { x: 0, z: 73 }, { x: -60, z: 73 }, { x: 60, z: 73 },
  { x: -60, z: -73 }, { x: 0, z: -73 }, { x: 60, z: -73 },
];
export function canEat(hole: Hole, item: Item) { return !item.eaten && !item.falling && item.size < hole.radius && Math.hypot(hole.x - item.x, hole.z - item.z) < hole.radius - item.size * .35; }
export function feed(hole: Hole, points: number) { hole.score += points; hole.radius = radiusFor(hole.score); }
export function move(hole: Hole, x: number, z: number, dt: number) {
  const length = Math.hypot(x, z); if (!length) return;
  const speed = (15 - Math.min(hole.radius, 15) * .12) * Math.min(length, 1) * dt;
  hole.x = Math.max(-LIMIT, Math.min(LIMIT, hole.x + x / length * speed));
  hole.z = Math.max(-LIMIT, Math.min(LIMIT, hole.z + z / length * speed));
}
export function city(seed = 718): Item[] {
  const items: Item[] = [];
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const add = (x: number, z: number, kind: Kind, size: number, points: number) => items.push({ x, z, kind, size, points, eaten: false });
  for (let x = -60;x <= 60;x += 30) for (let z = -60;z <= 60;z += 30) {
    const park = (x === 0 && z === 0) || random() < .18;
    if (!park) for (const dx of [-7, 7]) for (const dz of [-7, 7]) {
      const landmark = Math.abs(x) + Math.abs(z) < 90 && random() < .22;
      const tall = random() > .4;
      add(x + dx, z + dz, landmark ? 'landmark' : tall ? 'tower' : 'house',
        landmark ? 9.5 : tall ? 6.5 : 4, landmark ? 260 : tall ? 100 : 40);
    }
    else for (let n = 0;n < 14;n++) add(x + (random() - .5) * 19, z + (random() - .5) * 19, 'tree', 2.05, 7);
    // Continuous sidewalk trails connect the six starts to parks, traffic, and blocks.
    for (let n = 0;n < 11;n++) for (const side of [-1, 1]) {
      add(x - 12 + n * 2.4, z + side * 13, n % 3 === 0 ? 'bin' : 'person', n % 3 === 0 ? .65 : .45, 3);
    }
    for (const side of [-1, 1]) {
      for (const offset of [-9, 0, 9]) add(x + side * 13, z + offset, 'tree', 2.05, 7);
      for (const offset of [-9, 0, 9]) add(x + offset, z + side * 15, 'car', 2.85, 12);
    }
  }
  // Large civic buildings around the perimeter remain worthwhile in the final lap.
  for (const side of [-1, 1]) for (const z of [-60, -20, 20, 60])
    add(side * 84, z, 'landmark', 12, 360);
  return items;
}

export const canSwallow = (hunter: Hole, prey: Hole) =>
  hunter !== prey && hunter.respawn <= 0 && prey.respawn <= 0 && hunter.radius > prey.radius * 1.3;

export type FinishReason = 'time' | 'cleared' | 'stalled';
export function matchResult(items: Item[], holes: Hole[], remaining: number): FinishReason | undefined {
  if (items.every(item => item.eaten)) return 'cleared';
  if (remaining <= 0) return 'time';
  // Include returning holes: their respawn absence must not end a match.
  if (items.some(item => !item.eaten && holes.some(hole => item.size < hole.radius))) return;
  if (holes.some(hunter => holes.some(prey => hunter !== prey && hunter.radius > prey.radius * 1.3 && Math.floor(prey.score * .2) > 0))) return;
  return 'stalled';
}

/** Seek food or nearby prey, but escape a larger hole before continuing to eat. */
export function rivalDirection(hole: Hole, holes: Hole[], items: Item[]): { x: number; z: number } {
  const threats = holes.filter(other => canSwallow(other, hole))
    .sort((a, b) => Math.hypot(a.x - hole.x, a.z - hole.z) - Math.hypot(b.x - hole.x, b.z - hole.z));
  const threat = threats[0];
  if (threat && Math.hypot(threat.x - hole.x, threat.z - hole.z) < threat.radius + 9) {
    let x = hole.x - threat.x, z = hole.z - threat.z;
    // Turn along the boundary instead of getting pinned while fleeing.
    if ((hole.x >= LIMIT - 1 && x > 0) || (hole.x <= -LIMIT + 1 && x < 0)) { z += x; x = 0; }
    if ((hole.z >= LIMIT - 1 && z > 0) || (hole.z <= -LIMIT + 1 && z < 0)) { x -= z; z = 0; }
    return { x: x || (z ? 0 : 1), z };
  }
  let target: { x: number; z: number } | undefined, best = Infinity;
  for (const item of items) {
    if (item.eaten || item.falling || item.size >= hole.radius) continue;
    const cost = Math.hypot(item.x - hole.x, item.z - hole.z) / (1 + item.points * .025);
    if (cost < best) { best = cost; target = item; }
  }
  for (const prey of holes) {
    if (!canSwallow(hole, prey) || prey.score < 30) continue;
    const distance = Math.hypot(prey.x - hole.x, prey.z - hole.z);
    const cost = distance / (1 + Math.floor(prey.score * .2) * .025);
    if (cost < best) { best = cost; target = prey; }
  }
  return target ? { x: target.x - hole.x, z: target.z - hole.z } : { x: 0, z: 0 };
}

/** Transfer existing points instead of creating an unlimited source from respawns. */
export function swallow(hunter: Hole, prey: Hole): number {
  const stolen = Math.floor(prey.score * .2);
  feed(hunter, stolen);
  prey.score -= stolen;
  prey.radius = radiusFor(prey.score);
  prey.respawn = 5;
  prey.x = prey.x > 0 ? -73 : 73;
  prey.z = prey.z > 0 ? -73 : 73;
  return stolen;
}


/** Conservative horizontal footprint of each rendered model, including its crown/roof. */
export function footprint(item: Item): number {
  return item.kind === 'tree' ? 1.55 : item.kind === 'car' ? 1.9 :
    item.kind === 'person' ? .32 : item.kind === 'bin' ? .61 : Math.SQRT2 * (item.size * 1.25 + .3) / 2;
}
export interface Falling {
  item: Item;
  hole: Hole;
  phase: 'falling' | 'returning' | 'done';
  elapsed: number;
  drop: number;
  returnFrom: number;
  duration: number;
  depth: number;
}
export function supports(hole: Hole, item: Item): boolean {
  return hole.respawn <= 0 && item.size < hole.radius &&
    Math.hypot(hole.x-item.x, hole.z-item.z) + footprint(item) < hole.radius;
}
export function beginFall(item: Item, hole: Hole): Falling | undefined {
  if (!canEat(hole,item) || !supports(hole,item)) return;
  item.falling = true;
  const duration = { person: .08, bin: .1, tree: .24, car: .32, house: .55, tower: .8, landmark: 1 }[item.kind];
  const depth = { person: 1.6, bin: 1.3, tree: 4.6, car: 1.8, house: 9, tower: 22, landmark: 38 }[item.kind];
  return { item, hole, phase: 'falling', elapsed: 0, drop: 0, returnFrom: 0, duration, depth };
}
/** Keep the opening beneath the whole footprint until the top clears the ground. */
export function advanceFall(fall: Falling, dt: number): 'pending' | 'caught' | 'eaten' | 'done' {
  if (fall.phase === 'done') return 'done';
  if (fall.phase === 'falling' && !supports(fall.hole,fall.item)) {
    fall.phase = 'returning'; fall.elapsed = 0; fall.returnFrom = fall.drop;
  }
  fall.elapsed += dt;
  if (fall.phase === 'returning') {
    fall.drop = fall.returnFrom * Math.max(0,1-fall.elapsed/.2);
    if (fall.elapsed < .2) return 'pending';
    fall.item.falling = false; fall.phase = 'done'; return 'caught';
  }
  const progress = Math.min(1,fall.elapsed/fall.duration);
  fall.drop = fall.depth * progress * progress;
  if (progress < 1) return 'pending';
  fall.item.falling = false; fall.item.eaten = true; fall.phase = 'done';
  feed(fall.hole,fall.item.points);
  return 'eaten';
}
