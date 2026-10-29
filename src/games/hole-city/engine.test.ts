import { test } from 'node:test';
import assert from 'node:assert/strict';
import { city, canEat, matchResult, rivalDirection, feed, move, radiusFor, LIMIT, type Hole } from './engine';
const player = ():Hole => ({name:'You',x:0,z:0,radius:radiusFor(0),score:0,color:0,respawn:0});
test('growth unlocks every city object without exceeding the radius cap',()=>{
 const h=player();const item={...city().find(i=>i.kind==='tower')!,x:0,z:0};
 assert.equal(canEat(h,item),false);feed(h,200);assert.ok(h.radius>radiusFor(0));assert.equal(canEat(h,item),true);
 item.eaten=true;assert.equal(canEat(h,item),false);feed(h,1e8);assert.equal(h.radius,13);
});
test('movement normalizes diagonals and stays inside city bounds',()=>{
 const a=player(),b=player();move(a,1,0,1);move(b,1,1,1);assert.ok(Math.abs(Math.hypot(b.x,b.z)-a.x)<1e-9);
 move(a,1,1,1000);assert.equal(a.x,LIMIT);assert.equal(a.z,LIMIT);
});
test('city is reproducible and has food for each growth stage',()=>{
 assert.deepEqual(city(42),city(42));assert.notDeepEqual(city(42),city(43));
 const items=city();for(const kind of ['person','bin','tree','car','house','tower'])assert.ok(items.some(i=>i.kind===kind));
 assert.ok(items.filter(i=>i.size<radiusFor(0)).length>200);
});

test('a cleared city finishes immediately instead of waiting for the timer', () => {
  const items = city().map(item => ({ ...item, eaten: true }));
  assert.equal(matchResult(items, [player()], 85), 'cleared');
  assert.equal(matchResult(items, [player()], 0), 'cleared');
});
test('matches finish when everyone is stuck, but allow food and predation to continue', () => {
  const tower = { ...city().find(item => item.kind === 'tower')!, eaten: false };
  const small = player(), big = { ...player(), radius: 3 };
  assert.equal(matchResult([tower], [small], 60), 'stalled');
  assert.equal(matchResult([tower], [small, big], 60), undefined);
  big.radius = 6; big.respawn = 3;
  assert.equal(matchResult([tower], [big], 60), undefined);
  assert.equal(matchResult([tower], [big], 0), 'time');
});
test('rivals hunt smaller holes when food runs out and flee larger holes', () => {
  const small = { ...player(), x: 10 }, big = { ...player(), radius: 4 };
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
