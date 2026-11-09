import { biteCommitTime, biteReach, canSwallow, captureReach, clampPosition, holeSpeed, isEdible, LIMIT, MILESTONES, move, type Hole, type Item } from './engine';

type Point = { x: number; z: number };
type Target = Item | Hole;
export interface RivalPlan {
  target?: Target;
  reconsiderIn: number;
  scoutDestination?: Point;
  recentSectors?: number[];
  scoutSeed?: number;
  idleFor?: number;
}
const rivalPace = .922;
const scoutPace = .56;
const stop = { x: 0, z: 0 };
const escapeHeadings = Array.from({ length: 12 }, (_, i) => ({ x: Math.cos(i * Math.PI / 6), z: Math.sin(i * Math.PI / 6) }));
const scoutSectors = Array.from({ length: 25 }, (_, index) => ({
  x: (index % 5 - 2) * 32,
  z: (Math.floor(index / 5) - 2) * 32,
}));

export function createRivalPlan(seed: number, rivalIndex: number): RivalPlan {
  return { reconsiderIn: 0, scoutSeed: (seed ^ Math.imul(rivalIndex + 1, 0x9e3779b1)) >>> 0 };
}

function scout(hole: Hole, holes: Hole[], plan: RivalPlan): Point {
  const distanceTo = (point: Point) => Math.hypot(point.x - hole.x, point.z - hole.z);
  if (!plan.scoutDestination || distanceTo(plan.scoutDestination) < 2) {
    const recent = plan.recentSectors ??= [];
    const random = () => {
      const seed = plan.scoutSeed ?? holes.indexOf(hole) + 1;
      plan.scoutSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return plan.scoutSeed / 4294967296;
    };
    let best = -Infinity, sector = 0;
    for (const [index, center] of scoutSectors.entries()) {
      if (recent.includes(index) || distanceTo(center) < 24) continue;
      const point = { x: center.x + (random() - .5) * 18, z: center.z + (random() - .5) * 18 };
      const distance = distanceTo(point);
      if (distance < 24) continue;
      let crowding = 0;
      for (const other of holes) {
        if (other === hole || other.respawn > 0) continue;
        crowding += Math.max(0, 28 - Math.hypot(point.x - other.x, point.z - other.z));
      }
      // Vary the route without sending rivals on a long detour or into crowded areas.
      const value = random() * 25 - Math.abs(distance - 48) * .45 - crowding * .75;
      if (value > best) { best = value; sector = index; plan.scoutDestination = point; }
    }
    recent.push(sector);
    if (recent.length > 4) recent.shift();
  }
  const aim = plan.scoutDestination!;
  return { x: aim.x - hole.x, z: aim.z - hole.z };
}

function escape(hole: Hole, predators: Hole[]): Point {
  let best = -Infinity, direction = stop;
  for (const { x, z } of escapeHeadings) {
    const nextX = clampPosition(hole.x + x * 7), nextZ = clampPosition(hole.z + z * 7);
    const dx = nextX - hole.x, dz = nextZ - hole.z;
    const distance = Math.hypot(dx, dz);
    if (!distance) continue;
    let clearance = Infinity;
    for (const predator of predators) {
      const predictedX = clampPosition(predator.x + (predator.vx ?? 0) * .35);
      const predictedZ = clampPosition(predator.z + (predator.vz ?? 0) * .35);
      clearance = Math.min(clearance, Math.hypot(nextX - predictedX, nextZ - predictedZ) - captureReach(predator, hole));
    }
    const room = Math.min(7, LIMIT - Math.max(Math.abs(nextX), Math.abs(nextZ)));
    const score = clearance + distance * .17 + room * .22;
    if (score > best) { best = score; direction = { x: dx, z: dz }; }
  }
  return direction;
}

function intercept(hunter: Hole, prey: Hole): Point {
  const gap = Math.hypot(prey.x - hunter.x, prey.z - hunter.z) - captureReach(hunter, prey);
  const lead = Math.max(0, Math.min(.55, gap / (holeSpeed(hunter) * rivalPace)));
  return { x: clampPosition(prey.x + (prey.vx ?? 0) * lead), z: clampPosition(prey.z + (prey.vz ?? 0) * lead) };
}

function chooseTarget(hole: Hole, holes: Hole[], items: Item[], predators: Hole[]): Target | undefined {
  const speed = holeSpeed(hole) * rivalPace;
  const nextGrowth = (MILESTONES.find(stage => stage.score > hole.score)?.score ?? Infinity) - hole.score;
  const patches = new Map<number, { points: number; nearest: Item; distance: number }>();
  let target: Target | undefined, best = -Infinity;
  const safety = (x: number, z: number) => {
    let room = 1;
    for (const predator of predators) {
      const gap = Math.hypot(x - predator.x, z - predator.z) - captureReach(predator, hole);
      room = Math.min(room, Math.max(.08, gap / 15));
    }
    return room;
  };
  const foodValue = (item: Item, distance: number, nearbyPoints = 0) => {
    const travel = Math.max(0, distance - biteReach(hole, item)) / speed;
    const bonus = Math.min(2.5, nearbyPoints * .045);
    const growthBonus = item.points + nearbyPoints * .4 >= nextGrowth ? .85 : 0;
    return (1 + item.points * .045 + bonus + growthBonus) * safety(item.x, item.z) / (.4 + travel + biteCommitTime(item));
  };
  for (const item of items) {
    if (!isEdible(hole, item)) continue;
    const distance = Math.hypot(item.x - hole.x, item.z - hole.z);
    const value = foodValue(item, distance);
    if (value > best) { best = value; target = item; }
    const key = Math.floor((item.x + LIMIT) / 9) * 32 + Math.floor((item.z + LIMIT) / 9);
    const patch = patches.get(key);
    if (!patch) {
      patches.set(key, { points: item.points, nearest: item, distance });
    } else {
      patch.points += item.points;
      if (distance < patch.distance) { patch.nearest = item; patch.distance = distance; }
    }
  }
  for (const { nearest, points, distance } of patches.values()) {
    // Nearby stock makes a route worthwhile, but large fixtures still get their full individual value.
    const value = foodValue(nearest, distance, points - nearest.points);
    if (value > best) { best = value; target = nearest; }
  }
  for (const prey of holes) {
    if (!canSwallow(hole, prey) || prey.score < 30) continue;
    const aim = intercept(hole, prey);
    const gap = Math.hypot(aim.x - hole.x, aim.z - hole.z) - captureReach(hole, prey);
    if (gap > 25) continue;
    const dx = prey.x - hole.x, dz = prey.z - hole.z;
    const outwardSpeed = (dx * (prey.vx ?? 0) + dz * (prey.vz ?? 0)) / Math.max(1, Math.hypot(dx, dz));
    const pursuitSpeed = gap <= 4 ? speed : Math.max(speed * .18, speed - Math.max(0, outwardSpeed));
    const value = (1 + Math.floor(prey.score * .2) * .04) * safety(aim.x, aim.z) / (.65 + Math.max(0, gap) / pursuitSpeed);
    if (value > best) { best = value; target = prey; }
  }
  return target;
}

export function rivalDirection(hole: Hole, holes: Hole[], items: Item[], plan: RivalPlan = { reconsiderIn: 0 }, dt = 0, holding = false): Point {
  const predators = holes.filter(other => canSwallow(other, hole));
  if (predators.some(other => Math.hypot(other.x - hole.x, other.z - hole.z) < captureReach(other, hole) + 10)) {
    plan.reconsiderIn = 0;
    plan.scoutDestination = undefined;
    plan.idleFor = 0;
    return escape(hole, predators);
  }
  if (holding) return stop;

  plan.reconsiderIn -= dt;
  const target = plan.target;
  const invalid = target && !('kind' in target ? isEdible(hole, target) : canSwallow(hole, target));
  if (invalid || plan.reconsiderIn <= 0) {
    plan.target = chooseTarget(hole, holes, items, predators);
    plan.reconsiderIn = .14;
  }
  if (!plan.target) {
    plan.idleFor = (plan.idleFor ?? 0) + dt;
    return plan.idleFor >= .4 ? scout(hole, holes, plan) : stop;
  }
  plan.idleFor = 0;
  plan.scoutDestination = undefined;
  const aim = 'kind' in plan.target ? plan.target : intercept(hole, plan.target);
  return { x: aim.x - hole.x, z: aim.z - hole.z };
}

export function moveRival(hole: Hole, holes: Hole[], items: Item[], plan: RivalPlan, dt: number, holding: boolean) {
  const { x, z } = rivalDirection(hole, holes, items, plan, dt, holding);
  move(hole, x, z, dt, plan.scoutDestination === undefined ? rivalPace : scoutPace);
}
