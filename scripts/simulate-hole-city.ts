import assert from 'node:assert/strict';
import { city, spawnPoints, radiusFor, move, beginFall, advanceFall, type Falling, type Item, rivalDirection, canSwallow, swallow, matchResult, type Hole } from '../src/games/hole-city/engine';

// A repeatable greedy player is a pacing probe, not a substitute for human playtesting.
for (const seed of [718, 42, 2026, 891, 15]) {
  const items = city(seed);
  const holes: Hole[] = spawnPoints.map((p, i) => ({ ...p, radius: radiusFor(0), score: 0, name: String(i), color: 0, respawn: 0 }));
  const unlocks: Record<string, number> = {};
  const falling=new Map<Item,Falling>();
  let end = 120; let reason: string | undefined;
  for (let t = 0;t < 120;t += 1/30) {
    for (const [i, h] of holes.entries()) {
      if (h.respawn > 0) { h.respawn -= 1/30; continue; }
      const direction = rivalDirection(h, holes, items);
      const holding=[...falling.values()].some(f=>f.hole===h && f.phase==='falling');
      const danger=holes.some(other=>canSwallow(other,h)&&Math.hypot(other.x-h.x,other.z-h.z)<other.radius+9);
      if(!holding||danger)move(h, direction.x, direction.z, (1/30) * (i === 0 ? 1 : .8));
      for(const item of items){const fall=beginFall(item,h);if(fall)falling.set(item,fall);}
    }
    for (const hunter of holes) for (const prey of holes) if (canSwallow(hunter, prey) && Math.hypot(hunter.x - prey.x, hunter.z - prey.z) < hunter.radius - prey.radius * .4) swallow(hunter, prey);
    for(const [item,fall] of falling){
      const result=advanceFall(fall,1/30);
      if(result==='eaten' && fall.hole===holes[0] && unlocks[item.kind]===undefined)unlocks[item.kind]=Math.round(t*10)/10;
      if(result==='eaten'||result==='caught')falling.delete(item);
    }
    reason = matchResult(items, holes, 120 - t); if (reason) { end = t; break; }
  }
  if(!process.env.HOLE_PACING_REPORT_ONLY){
  assert.notEqual(reason, 'stalled', `seed ${seed}: economy stalled`);
  assert.ok(end >= 90, `seed ${seed}: city depleted too early`);
  assert.ok(unlocks.house < 35, `seed ${seed}: opening progression too slow`);
  assert.equal(holes.reduce((sum, h) => sum + h.score, 0), items.filter(item => item.eaten).reduce((sum, item) => sum + item.points, 0));
  }
  console.log(JSON.stringify({ seed, end: Math.round(end), score: holes[0].score, radius: +holes[0].radius.toFixed(1), remaining: items.filter(i => !i.eaten).length, total: items.length, unlocks }));
}
