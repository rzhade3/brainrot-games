import assert from 'node:assert/strict';
import { city, spawnPoints, radiusFor, move, beginFall, advanceFall, type Falling, type Item, canSwallow, captureReach, isEdible, swallow, matchResult, LIMIT, MILESTONES, type Hole } from '../src/games/hole-city/engine';
import { produceArea, supermarket, supermarketSpawns } from '../src/games/hole-city/supermarket';
import { advanceTraffic } from '../src/games/hole-city/traffic';
import { createRivalPlan, moveRival } from '../src/games/hole-city/rivals';

const campProduce = process.argv.includes('--produce-only');
const classicRivals = process.argv.includes('--classic-rivals');
const grocery = campProduce || process.argv.includes('--supermarket');
const generate = grocery ? supermarket : city;
const spawns = grocery ? supermarketSpawns : spawnPoints;
const { left, right, back, front } = produceArea;
const step = 1 / 30;

// Keep the former policy as a fixed player benchmark when changing the rivals.
function classicDirection(hole: Hole, holes: Hole[], items: Item[]) {
  const predators = holes.filter(other => canSwallow(other, hole))
    .sort((a, b) => Math.hypot(a.x - hole.x, a.z - hole.z) - Math.hypot(b.x - hole.x, b.z - hole.z));
  const predator = predators[0];
  if (predator && Math.hypot(predator.x - hole.x, predator.z - hole.z) < predator.radius + 9) {
    let x = hole.x - predator.x, z = hole.z - predator.z;
    if ((hole.x >= LIMIT - 1 && x > 0) || (hole.x <= -LIMIT + 1 && x < 0)) { z += x; x = 0; }
    if ((hole.z >= LIMIT - 1 && z > 0) || (hole.z <= -LIMIT + 1 && z < 0)) { x -= z; z = 0; }
    return { x: x || (z ? 0 : 1), z };
  }
  let target: { x: number; z: number } | undefined, best = Infinity;
  for (const item of items) {
    if (!isEdible(hole, item)) continue;
    const cost = Math.hypot(item.x - hole.x, item.z - hole.z) / (1 + item.points * .025);
    if (cost < best) { best = cost; target = item; }
  }
  for (const prey of holes) {
    if (!canSwallow(hole, prey) || prey.score < 30) continue;
    const cost = Math.hypot(prey.x - hole.x, prey.z - hole.z) / (1 + Math.floor(prey.score * .2) * .025);
    if (cost < best) { best = cost; target = prey; }
  }
  return target ? { x: target.x - hole.x, z: target.z - hole.z } : { x: 0, z: 0 };
}

// A repeatable greedy player is a pacing probe, not a substitute for human playtesting.
for (const seed of [718, 42, 2026, 891, 15]) {
  const items = generate(seed);
  const movingItems = items.filter(item => item.route);
  const playerTargets = campProduce ? items.filter(item => item.x >= left && item.x <= right && item.z >= back && item.z <= front) : items;
  const holes: Hole[] = spawns.map((p, i) => ({ ...p, radius: radiusFor(0), score: 0, name: String(i), color: 0, respawn: 0 }));
  const plans = holes.map((_, index) => createRivalPlan(seed, index));
  const unlocks: Record<string, number> = {};
  let playerSwallowed = 0;
  let firstMidTier=Infinity;
  const falling=new Map<Item,Falling>();
  let end = 120; let reason: string | undefined;
  for (let t = 0;t < 120;t += step) {
    for (const item of movingItems) advanceTraffic(item, step, holes);
    for (const [i, h] of holes.entries()) {
      if (h.respawn > 0) { h.respawn -= step; continue; }
      const confined = campProduce && i === 0;
      const holding=[...falling.values()].some(f=>f.hole===h && f.phase==='falling' && !f.secured);
      if (i > 0 && !classicRivals) {
        moveRival(h, holes, items, plans[i], step, holding);
      } else {
        const danger = holes.some(other => canSwallow(other, h) && Math.hypot(other.x - h.x, other.z - h.z) < other.radius + 9);
        const direction = !holding || danger ? classicDirection(h, holes, i === 0 ? playerTargets : items) : { x: 0, z: 0 };
        move(h, direction.x, direction.z, step, i === 0 ? 1 : .8);
      }
      if (confined) {
        h.x = Math.max(left, Math.min(right, h.x));
        h.z = Math.max(back, Math.min(front, h.z));
      }
      for(const item of items){const fall=beginFall(item,h);if(fall)falling.set(item,fall);}
    }
    for (const hunter of holes) for (const prey of holes) {
      if (!canSwallow(hunter, prey) || Math.hypot(hunter.x - prey.x, hunter.z - prey.z) >= captureReach(hunter, prey)) continue;
      if (prey === holes[0]) playerSwallowed++;
      swallow(hunter, prey);
    }
    for(const [item,fall] of falling){
      const result=advanceFall(fall,step);
      if(result==='eaten' && item.size===4)firstMidTier=Math.min(firstMidTier,t);
      if(result==='eaten' && fall.hole===holes[0] && unlocks[item.kind]===undefined)unlocks[item.kind]=Math.round(t*10)/10;
      if(result==='eaten'||result==='caught')falling.delete(item);
    }
    reason = matchResult(items, holes, 120 - t); if (reason) { end = t; break; }
  }
  const rank = 1 + holes.slice(1).filter(hole => hole.score > holes[0].score).length;
  if(!process.env.HOLE_PACING_REPORT_ONLY){
  assert.notEqual(reason, 'stalled', `seed ${seed}: economy stalled`);
  assert.ok(end >= 90, `seed ${seed}: map depleted too early`);
  assert.ok(firstMidTier < 35, `seed ${seed}: opening progression too slow`);
  if (grocery) assert.ok(items.some(item => item.kind === 'shelf' && item.eaten), `seed ${seed}: no shelves eaten`);
  if (campProduce) {
    assert.ok(holes[0].score < MILESTONES[4].score, `seed ${seed}: camping produce reached large fixtures`);
    assert.ok(rank > 1, `seed ${seed}: camping produce won`);
  }
  assert.equal(holes.reduce((sum, h) => sum + h.score, 0), items.filter(item => item.eaten).reduce((sum, item) => sum + item.points, 0));
  }
  console.log(JSON.stringify({ seed, end: Math.round(end), score: holes[0].score, rank, playerSwallowed,
    bestRival: Math.max(...holes.slice(1).map(hole => hole.score)), radius: +holes[0].radius.toFixed(1),
    remaining: items.filter(item => !item.eaten).length, total: items.length,
    [grocery ? 'firstCounterOrCar' : 'firstHouse']: Math.round(firstMidTier * 10) / 10, unlocks }));
}
