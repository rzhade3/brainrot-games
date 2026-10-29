import { test } from 'node:test';
import assert from 'node:assert/strict';
import { city, canEat, feed, move, radiusFor, LIMIT, type Hole } from './engine';
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
