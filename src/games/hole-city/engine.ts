import { addCityTraffic, releaseCart } from './traffic';

const fallProfiles = {
  person: { footprint: .32, duration: .06, depth: 1.6 },
  bin: { footprint: .61, duration: .08, depth: 1.3 },
  tree: { footprint: 1.55, duration: .18, depth: 4.6 },
  car: { footprint: 1.9, duration: .24, depth: 1.8 },
  house: { duration: .4, depth: 9 },
  tower: { duration: .55, depth: 22 },
  landmark: { duration: .7, depth: 38 },
  fruit: { footprint: .5, duration: .06, depth: 1.2 },
  can: { footprint: .4, duration: .08, depth: 1.4 },
  milk: { footprint: .5, duration: .08, depth: 1.5 },
  bread: { footprint: .6, duration: .08, depth: 1.6 },
  basket: { footprint: 1.6, duration: .18, depth: 2 },
  cart: { footprint: 2.4, duration: .24, depth: 3.5 },
  shopper: { footprint: 1.2, duration: .16, depth: 4 },
  'promo-bin': { footprint: 2.2, duration: .24, depth: 3.3 },
  checkout: { footprint: 3.6, duration: .4, depth: 5.5 },
  'bakery-case': { footprint: 3.9, duration: .4, depth: 5.5 },
  'parked-car': { footprint: 3.8, duration: .4, depth: 5 },
  'produce-stand': { footprint: 5, duration: .55, depth: 6 },
  fridge: { footprint: 4.6, duration: .55, depth: 8 },
  shelf: { footprint: 7.6, duration: .7, depth: 9 },
  'delivery-van': { footprint: 5.5, duration: .7, depth: 10 },
} satisfies Record<string, { footprint?: number; duration: number; depth: number }>;
export type Kind = keyof typeof fallProfiles;
export interface ItemRoute {
  time: number;
  duration: number;
  segments: { x: number; z: number; dx: number; dz: number; duration: number; heading: number }[];
  shopper?: { direction: 1 | -1; alert: number; phase: number; stride: number };
}
export interface Item {
  x: number; z: number; size: number; points: number; kind: Kind; eaten: boolean; falling?: boolean;
  elevation?: number;
  variant?: number;
  stockedOn?: Item;
  stack?: { rise: number; supports: Item[] };
  heading?: number;
  route?: ItemRoute;
  pushedCart?: Item;
  beingPushed?: boolean;
}
export function itemElevation(item: Item) {
  if (item.stockedOn?.eaten) return 0;
  const stack = item.stack;
  const stackedHeight = stack && stack.supports.filter(support => !support.eaten).length >= 2 ? stack.rise : 0;
  return (item.elevation ?? 0) + stackedHeight;
}
export interface Hole { x: number; z: number; score: number; radius: number; name: string; color: number; respawn: number; vx?: number; vz?: number }
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
// Stock can slide off a fixture into a hole beside it.
const suctionReach = (item: Item) => item.elevation && !item.stockedOn?.eaten ? 1.2 : 0;
function biteSize(item: Item) { return item.pushedCart?.size ?? item.size; }
export function isEdible(hole: Hole, item: Item) { return !item.eaten && !item.falling && !item.beingPushed && biteSize(item) < hole.radius; }
export function canEat(hole: Hole, item: Item) { return isEdible(hole, item) && Math.hypot(hole.x - item.x, hole.z - item.z) < hole.radius + suctionReach(item) - biteSize(item) * .35; }
export function feed(hole: Hole, points: number) { hole.score += points; hole.radius = radiusFor(hole.score); }
export const clampPosition = (value: number) => Math.max(-LIMIT, Math.min(LIMIT, value));
export const holeSpeed = (hole: Hole) => 15 - Math.min(hole.radius, 15) * .12;
export function move(hole: Hole, x: number, z: number, dt: number, pace = 1) {
  const step = holeSpeed(hole) * dt * pace / Math.max(1, Math.hypot(x, z));
  const nextX = clampPosition(hole.x + x * step), nextZ = clampPosition(hole.z + z * step);
  hole.vx = dt > 0 ? (nextX - hole.x) / dt : 0;
  hole.vz = dt > 0 ? (nextZ - hole.z) / dt : 0;
  hole.x = nextX;
  hole.z = nextZ;
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
  addCityTraffic(items);
  return items;
}

export const canSwallow = (hunter: Hole, prey: Hole) =>
  hunter !== prey && hunter.respawn <= 0 && prey.respawn <= 0 && hunter.radius > prey.radius * 1.3;
export const captureReach = (hunter: Hole, prey: Hole) => hunter.radius - prey.radius * .4;

export type FinishReason = 'time' | 'cleared' | 'stalled';
export function matchResult(items: Item[], holes: Hole[], remaining: number): FinishReason | undefined {
  if (items.every(item => item.eaten)) return 'cleared';
  if (remaining <= 0) return 'time';
  // Include returning holes: their respawn absence must not end a match.
  if (items.some(item => !item.eaten && !item.beingPushed && holes.some(hole => biteSize(item) < hole.radius))) return;
  if (holes.some(hunter => holes.some(prey => hunter !== prey && hunter.radius > prey.radius * 1.3 && Math.floor(prey.score * .2) > 0))) return;
  return 'stalled';
}

/** Transfer existing points instead of creating an unlimited source from respawns. */
export function swallow(hunter: Hole, prey: Hole): number {
  const stolen = Math.floor(prey.score * .2);
  feed(hunter, stolen);
  prey.score -= stolen;
  prey.radius = radiusFor(prey.score);
  prey.respawn = 5;
  prey.vx = prey.vz = 0;
  prey.x = prey.x > 0 ? -73 : 73;
  prey.z = prey.z > 0 ? -73 : 73;
  return stolen;
}


/** Conservative horizontal footprint of each rendered model, including its crown/roof. */
export function footprint(item: Item): number {
  const profile = fallProfiles[item.kind];
  return 'footprint' in profile ? profile.footprint : Math.SQRT2 * (item.size * 1.25 + .3) / 2;
}
export function biteReach(hole: Hole, item: Item) {
  return hole.radius + suctionReach(item) - Math.max(biteSize(item), footprint(item)) * .35;
}
export function biteCommitTime(item: Item) {
  return (itemElevation(item) > 0 ? .21 : fallProfiles[item.kind].duration) * .45;
}
export interface Falling {
  item: Item;
  hole: Hole;
  phase: 'falling' | 'returning' | 'done';
  elapsed: number;
  drop: number;
  returnFrom: number;
  outsideTime: number;
  secured: boolean;
  duration: number;
  depth: number;
  reach: number;
}
export function supports(hole: Hole, item: Item, reach = suctionReach(item)): boolean {
  return hole.respawn <= 0 && biteSize(item) < hole.radius &&
    Math.hypot(hole.x-item.x, hole.z-item.z) + footprint(item) * .35 < hole.radius + reach;
}
export function beginFall(item: Item, hole: Hole): Falling | undefined {
  if (!canEat(hole,item) || !supports(hole,item)) return;
  releaseCart(item);
  item.falling = true;
  const { duration, depth } = fallProfiles[item.kind];
  const elevation = itemElevation(item);
  return { item, hole, phase: 'falling', elapsed: 0, drop: 0, returnFrom: 0, outsideTime: 0, secured: false,
    duration: elevation > 0 ? .21 : duration, depth: depth + elevation, reach: suctionReach(item) };
}
/** Allow rim overlap, a brief escape grace, and an early point of no return. */
export function advanceFall(fall: Falling, dt: number): 'pending' | 'caught' | 'eaten' | 'done' {
  if (fall.phase === 'done') return 'done';
  const covered = supports(fall.hole,fall.item,fall.reach);
  if (fall.phase === 'falling') {
    if (covered && fall.elapsed + dt >= fall.duration * .45) fall.secured = true;
    fall.outsideTime = covered ? 0 : fall.outsideTime + dt;
    if (fall.hole.respawn > 0 || (!fall.secured && fall.outsideTime >= .1)) {
      fall.phase = 'returning'; fall.elapsed = 0; fall.returnFrom = fall.drop;
    }
  }
  fall.elapsed += dt;
  if (fall.phase === 'returning') {
    fall.drop = fall.returnFrom * Math.max(0,1-fall.elapsed/.2);
    if (fall.elapsed < .2) return 'pending';
    fall.item.falling = false; fall.phase = 'done'; return 'caught';
  }
  const progress = Math.min(1,fall.elapsed/fall.duration);
  fall.drop = fall.depth * progress * progress;
  if (progress < 1 || (!fall.secured && !covered)) return 'pending';
  fall.item.falling = false; fall.item.eaten = true; fall.phase = 'done';
  feed(fall.hole,fall.item.points);
  return 'eaten';
}
