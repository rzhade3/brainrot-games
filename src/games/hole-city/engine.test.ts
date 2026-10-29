import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginFall, advanceFall, footprint, supports, city, canEat, matchResult, rivalDirection, feed, move, radiusFor, LIMIT, MILESTONES, growthStage, spawnPoints, swallow, type Hole } from './engine';
const player = (): Hole => ({ name: 'You', x: 0, z: 0, radius: radiusFor(0), score: 0, color: 0, respawn: 0 });
test('growth unlocks every city object without exceeding the radius cap', () => {
  const h = player(); const item = { ...city().find(i => i.kind === 'tower')!, x: 0, z: 0 };
  assert.equal(canEat(h, item), false); feed(h, 1100); assert.ok(h.radius > radiusFor(0)); assert.equal(canEat(h, item), true);
  item.eaten = true; assert.equal(canEat(h, item), false); feed(h, 1e8); assert.equal(h.radius, 18);
});
test('movement normalizes diagonals and stays inside city bounds', () => {
  const a = player(), b = player(); move(a, 1, 0, 1); move(b, 1, 1, 1); assert.ok(Math.abs(Math.hypot(b.x, b.z) - a.x) < 1e-9);
  move(a, 1, 1, 1000); assert.equal(a.x, LIMIT); assert.equal(a.z, LIMIT);
});
test('city is reproducible and has food for each growth stage', () => {
  assert.deepEqual(city(42), city(42)); assert.notDeepEqual(city(42), city(43));
  const items = city(); for (const kind of ['person', 'bin', 'tree', 'car', 'house', 'tower']) assert.ok(items.some(i => i.kind === kind));
  assert.ok(items.filter(i => i.size < radiusFor(0)).length > 200);
});

test('a cleared city finishes immediately instead of waiting for the timer', () => {
  const items = city().map(item => ({ ...item, eaten: true }));
  assert.equal(matchResult(items, [player()], 85), 'cleared');
  assert.equal(matchResult(items, [player()], 0), 'cleared');
});
test('matches finish when everyone is stuck, but allow food and predation to continue', () => {
  const tower = { ...city().find(item => item.kind === 'tower')!, eaten: false };
  const small = { ...player(), score: 30 }, big = { ...player(), radius: 3 };
  assert.equal(matchResult([tower], [small], 60), 'stalled');
  assert.equal(matchResult([tower], [small, big], 60), undefined);
  big.radius = 7; big.respawn = 3;
  assert.equal(matchResult([tower], [big], 60), undefined);
  assert.equal(matchResult([tower], [big], 0), 'time');
});
test('rivals hunt smaller holes when food runs out and flee larger holes', () => {
  const small = { ...player(), x: 10, score: 30 }, big = { ...player(), radius: 4 };
  assert.ok(rivalDirection(big, [big, small], []).x > 0);
  assert.ok(rivalDirection(small, [big, small], []).x > 0);
  small.respawn = 3;
  assert.deepEqual(rivalDirection(big, [big, small], []), { x: 0, z: 0 });
});
test('rivals still eat reachable food when there is no prey', () => {
  const h = player();
  const item = { ...city().find(item => item.kind === 'bin')!, x: -5, z: 0 };
  assert.ok(rivalDirection(h, [h], [item]).x < 0);
  item.eaten = true;
  assert.equal(matchResult([item], [h], 90), 'cleared');
});

test('growth has distinct unlocks and late targets instead of an early size cap', () => {
  for (const [i, stage] of MILESTONES.entries()) {
    assert.equal(radiusFor(stage.score), stage.radius);
    assert.equal(growthStage(stage.score), i);
    if (i) assert.ok(stage.radius > MILESTONES[i - 1].radius);
  }
  assert.ok(radiusFor(2600) > 9.5);
  assert.ok(radiusFor(7000) > radiusFor(2600));
});
test('all six starts have snack trails and each seeded map has late-game food', () => {
  for (let seed = 0;seed < 30;seed++) {
    const items = city(seed);
    for (const p of spawnPoints) {
      const snacks = items.filter(item => item.size < radiusFor(0) && Math.hypot(item.x - p.x, item.z - p.z) < 16);
      assert.ok(snacks.reduce((sum, item) => sum + item.points, 0) >= 30, `seed ${seed}: start lacks first unlock`);
    }
    assert.ok(items.filter(item => item.kind === 'landmark').length >= 1);
    assert.ok(items.filter(item => item.size >= 6.5).reduce((sum, item) => sum + item.points, 0) > 3000);
  }
});
test('being swallowed transfers score, reduces size, and costs five seconds', () => {
  const hunter = player(), prey = player(); feed(hunter, 2600); feed(prey, 600);
  const total = hunter.score + prey.score, oldRadius = prey.radius;
  assert.equal(swallow(hunter, prey), 120);
  assert.equal(hunter.score + prey.score, total);
  assert.ok(prey.radius < oldRadius); assert.equal(prey.respawn, 5);
});
test('late civic buildings remain reachable from the movement boundary', () => {
  const h = player(); feed(h, 11000);
  for (const item of city(718)) {
    h.x = Math.max(-LIMIT, Math.min(LIMIT, item.x));
    h.z = Math.max(-LIMIT, Math.min(LIMIT, item.z));
    assert.ok(canEat(h, item), `${item.kind} at ${item.x},${item.z} unreachable`);
  }
});

test('a bite reserves food but awards nothing until the top clears the opening',()=>{
  const h={...player(),radius:3};const item={...city().find(i=>i.kind==='tree')!,x:0,z:0};
  const fall=beginFall(item,h)!;assert.ok(fall);assert.equal(item.eaten,false);assert.equal(h.score,0);
  assert.equal(beginFall(item,{...h}),undefined);
  assert.equal(advanceFall(fall,.1),'pending');assert.equal(h.score,0);
  assert.equal(advanceFall(fall,.21),'eaten');assert.equal(item.eaten,true);assert.equal(h.score,item.points);
  assert.equal(advanceFall(fall,1),'done');assert.equal(h.score,item.points);
});
test('driving away catches the crown on the rim and restores an uneaten tree',()=>{
  const h={...player(),radius:2.1};const item={...city().find(i=>i.kind==='tree')!,x:0,z:0};
  const fall=beginFall(item,h)!;advanceFall(fall,.1);h.x=.7;
  assert.equal(supports(h,item),false);assert.equal(advanceFall(fall,.05),'pending');
  assert.equal(fall.phase,'returning');assert.equal(advanceFall(fall,.2),'caught');
  assert.equal(fall.drop,0);assert.equal(item.eaten,false);assert.equal(item.falling,false);assert.equal(h.score,0);
  h.x=0;assert.ok(beginFall(item,h));
});
test('a roomy opening permits movement while swallowing, including at small timesteps',()=>{
  const h={...player(),radius:6};const item={...city().find(i=>i.kind==='tree')!,x:0,z:0};
  const fall=beginFall(item,h)!;
  for(let n=0;n<40 && !item.eaten;n++){h.x+=.05;advanceFall(fall,.01);}
  assert.equal(item.eaten,true);assert.equal(h.score,item.points);
});
test('an object touching the rim cannot start falling and respawning releases pending food',()=>{
  const h={...player(),radius:3};const item={...city().find(i=>i.kind==='tree')!,x:0,z:0};
  h.x=3-footprint(item);assert.equal(beginFall(item,h),undefined);
  h.x=0;const fall=beginFall(item,h)!;advanceFall(fall,.1);h.respawn=5;
  assert.equal(advanceFall(fall,.21),'caught');assert.equal(item.eaten,false);assert.equal(h.score,0);
});

test('every object can fit at the boundary as soon as its size tier permits it',()=>{
  const h=player();
  for(const item of city(718)){
    h.radius=Math.max(item.size,footprint(item))+.01;
    h.x=Math.max(-LIMIT,Math.min(LIMIT,item.x));h.z=Math.max(-LIMIT,Math.min(LIMIT,item.z));
    assert.ok(supports(h,item),`${item.kind} at ${item.x},${item.z} blocked by world boundary`);
  }
});
