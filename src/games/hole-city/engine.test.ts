import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginFall, advanceFall, footprint, supports, city, canEat, matchResult, feed, move, radiusFor, LIMIT, MILESTONES, growthStage, spawnPoints, swallow, itemElevation, type Hole, type Item } from './engine';
import { createRivalPlan, moveRival, rivalDirection, type RivalPlan } from './rivals';
import { parkingRows, produceArea, storefront, supermarket, supermarketSpawns } from './supermarket';
import { advanceTraffic } from './traffic';
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

test('Supermarket seeds stock reachable displays at all six starts', () => {
  assert.deepEqual(supermarket(42), supermarket(42));
  assert.notDeepEqual(supermarket(42), supermarket(43));
  for (const seed of [0, 42, 718]) {
    const items = supermarket(seed);
    assert.ok(items.every(item => Math.abs(item.x) <= LIMIT && Math.abs(item.z) <= LIMIT));
    for (const spawn of supermarketSpawns) {
      const snacks = items.filter(item => item.size < radiusFor(0) && Math.hypot(item.x - spawn.x, item.z - spawn.z) < 16);
      assert.ok(snacks.reduce((points, item) => points + item.points, 0) >= 30);
    }
  }
});

test('stock can be eaten separately and settles when its supports disappear', () => {
  const top = supermarket().find(item => item.kind === 'fruit' && item.stack);
  assert.ok(top?.stack && top.stockedOn);
  const display = top.stockedOn;
  const stackedHeight = itemElevation(top);
  const hole = player();
  const eat = (item: Item, offset = 0) => {
    hole.x = item.x + offset;
    hole.z = item.z;
    const fall = beginFall(item, hole);
    assert.ok(fall);
    assert.equal(advanceFall(fall, fall.duration), 'eaten');
  };
  for (const fruit of top.stack.supports.slice(0, 3)) eat(fruit, 2);
  assert.equal(display.eaten, false);
  assert.equal(top.eaten, false);
  assert.ok(itemElevation(top) < stackedHeight && itemElevation(top) > 0);

  feed(hole, 1100);
  eat(display);
  assert.equal(top.eaten, false);
  assert.equal(itemElevation(top), 0);
  eat(top);
  assert.equal(hole.score, 1100 + display.points + top.points * 4);
});

test('grocery props fall and score at their intended growth milestones', () => {
  const items = supermarket();
  const unlocks = [['fruit', 0], ['can', 0], ['milk', 0], ['bread', 0], ['basket', 30], ['cart', 180], ['shopper', 180], ['promo-bin', 180], ['checkout', 450], ['bakery-case', 450], ['parked-car', 450], ['produce-stand', 1100], ['fridge', 1100], ['shelf', 2600], ['delivery-van', 2600]] as const;
  for (const [kind, score] of unlocks) {
    const item = items.find(item => item.kind === kind && !item.beingPushed);
    assert.ok(item, `missing ${kind}`);
    const hole = { ...player(), x: item.x, z: item.z, score, radius: radiusFor(score) };
    if (score) assert.equal(beginFall(item, { ...hole, radius: radiusFor(score - 1) }), undefined, `${kind} unlocked early`);
    const fall = beginFall(item, hole);
    assert.ok(fall, `${kind} failed to unlock`);
    assert.equal(advanceFall(fall, fall.duration), 'eaten');
    assert.equal(hole.score, score + item.points);
  }
});

test('produce has an opening route but cannot fund the large-fixture tier on its own', () => {
  const { left, right, back, front } = produceArea;
  const items = supermarket();
  const produce = items.filter(item => item.x >= left && item.x <= right && item.z >= back && item.z <= front);
  const budget = produce.reduce((points, item) => points + item.points, 0);
  assert.ok(budget >= MILESTONES[3].score && budget < MILESTONES[4].score);
  assert.ok(items.some(item => item.kind === 'milk' && item.stockedOn?.kind === 'fridge'));
  const vehicles = items.filter(item => item.kind === 'parked-car' || item.kind === 'delivery-van');
  assert.ok(vehicles.some(item => item.kind === 'delivery-van'));
  assert.ok(vehicles.every(item => item.z > storefront && item.z < LIMIT));
  assert.ok(vehicles.filter(item => !item.route).every(item => parkingRows.some(row => Math.abs(item.z - row) < 1)));
});

test('traffic on both maps moves within reach and stops while falling or eaten', () => {
  const market = supermarket().filter(item => item.route);
  const downtown = city().filter(item => item.route);
  for (const [items, kinds] of [[market, ['shopper', 'parked-car']], [downtown, ['person', 'car']]] as const) {
    for (const kind of kinds) {
      const item = items.find(item => item.kind === kind);
      assert.ok(item?.route);
      const visited = new Set<string>();
      for (let step = 0; step < Math.ceil(item.route.duration * 4); step++) {
        advanceTraffic(item, .25);
        assert.ok(Math.abs(item.x) <= LIMIT && Math.abs(item.z) <= LIMIT);
        if (kind === 'parked-car') assert.ok(item.z > storefront);
        visited.add(`${item.x},${item.z}`);
      }
      assert.ok(visited.size > 1);
      if (kind === 'parked-car') assert.ok(parkingRows.every(row => [...visited].some(point => point.endsWith(`,${row}`))));
      const hole = { ...player(), x: item.x, z: item.z, radius: 5 };
      const fall = beginFall(item, hole);
      assert.ok(fall);
      assert.equal(advanceTraffic(item, 1), false);
      assert.equal(advanceFall(fall, fall.duration), 'eaten');
      assert.equal(advanceTraffic(item, 1), false);
      assert.equal(hole.score, item.points);
    }
  }
});

test('shoppers abandon one edible cart, sprint away and slow down when safe', () => {
  const items = supermarket();
  const shopper = items.find(item => item.kind === 'shopper');
  assert.ok(shopper?.route?.shopper && shopper.pushedCart);
  const cart = shopper.pushedCart;
  assert.ok(items.includes(cart));
  const bigHole = { ...player(), x: cart.x, z: cart.z, radius: 4 };
  assert.equal(beginFall(cart, bigHole), undefined);
  const startZ = shopper.z;
  const hole = { ...player(), x: shopper.x, z: shopper.z + 5 };
  const calm = structuredClone(shopper);
  advanceTraffic(calm, .1, [hole]);
  assert.ok(calm.z > startZ);
  assert.equal(calm.route?.shopper?.alert, 0);
  assert.ok(calm.pushedCart && calm.pushedCart.z > cart.z);

  hole.radius = 4;
  const respawning = structuredClone(shopper);
  advanceTraffic(respawning, .1, [{ ...hole, respawn: 1 }]);
  assert.equal(respawning.z, calm.z);
  const parked = { x: cart.x, z: cart.z, heading: cart.heading };
  advanceTraffic(shopper, .1, [hole]);
  assert.equal(shopper.route.shopper.direction, -1);
  assert.ok(shopper.route.shopper.alert > 0);
  assert.ok(startZ - shopper.z > calm.z - startZ);
  assert.equal(shopper.pushedCart, undefined);
  assert.equal(beginFall(cart, { ...player(), x: cart.x, z: cart.z }), undefined);
  for (let i = 0; i < 10; i++) advanceTraffic(shopper, .1);
  assert.deepEqual({ x: cart.x, z: cart.z, heading: cart.heading }, parked);
  assert.equal(shopper.route.shopper.alert, 0);
  const safeZ = shopper.z;
  advanceTraffic(shopper, .1);
  assert.ok(Math.abs((safeZ - shopper.z) - (calm.z - startZ)) < 1e-6);

  const cartFall = beginFall(cart, bigHole);
  assert.ok(cartFall);
  assert.equal(advanceFall(cartFall, cartFall.duration), 'eaten');
  assert.equal(shopper.eaten, false);
  assert.ok(canEat({ ...player(), x: shopper.x, z: shopper.z }, shopper));
  assert.equal(bigHole.score, cart.points);
  assert.equal(beginFall(cart, bigHole), undefined);
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
  const plan: RivalPlan = { reconsiderIn: 0 };
  rivalDirection(big, [big, small], [], plan, .4);
  assert.equal(plan.target, undefined);
  assert.notEqual(plan.scoutDestination, undefined);
});

test('a fleeing rival takes a safe food route instead of doubling back toward the hunter', () => {
  const hunter = { ...player(), score: 450, radius: radiusFor(450) };
  const prey = { ...player(), x: 10, score: 30, radius: radiusFor(30) };
  const blocked: Item = { x: -10, z: 0, kind: 'bin', size: .65, points: 100, eaten: false };
  const safe: Item = { ...blocked, x: 20, points: 3 };
  const plan = createRivalPlan(718, 1);
  const dt = 1 / 60;

  for (let step = 0; step < 30; step++) {
    const previousX = prey.x;
    moveRival(prey, [hunter, prey], [blocked, safe], plan, dt, false);
    assert.ok(prey.x > previousX, 'the rival doubled back toward the hunter');
  }
  assert.equal(plan.target, safe);

  hunter.z = 30;
  safe.eaten = true;
  moveRival(prey, [hunter, prey], [blocked, safe], plan, dt, false);
  assert.equal(plan.target, blocked);
});

test('a rival scouts outside the danger zone when its only food route is blocked', () => {
  const hunter = { ...player(), score: 450, radius: radiusFor(450) };
  const prey = { ...player(), x: 10, score: 30, radius: radiusFor(30) };
  const blocked: Item = { x: -10, z: 0, kind: 'bin', size: .65, points: 3, eaten: false };
  const plan = createRivalPlan(718, 1);
  const dt = 1 / 60;

  for (let step = 0; step < 120; step++) {
    moveRival(prey, [hunter, prey], [blocked], plan, dt, false);
  }
  assert.equal(plan.target, undefined);
  assert.ok(plan.scoutDestination);
  assert.ok(Math.hypot(prey.x, prey.z) > 20);
});

test('rivals still eat reachable food when there is no prey', () => {
  const h = player();
  const item = { ...city().find(item => item.kind === 'bin')!, x: -5, z: 0 };
  assert.ok(rivalDirection(h, [h], [item]).x < 0);
  item.eaten = true;
  assert.equal(matchResult([item], [h], 90), 'cleared');
});

test('rivals explore different sectors until food becomes edible', () => {
  const hole = { ...player(), x: LIMIT, z: LIMIT };
  const food: Item = { x: 0, z: 0, kind: 'tree', size: 2.05, points: 7, eaten: false };
  const plan = createRivalPlan(718, 1);
  moveRival(hole, [hole], [food], plan, .1, false);
  assert.equal(hole.x, LIMIT);
  assert.equal(hole.z, LIMIT);
  const stops = new Set<{ x: number; z: number }>();
  for (let step = 0; step < 900; step++) {
    moveRival(hole, [hole], [food], plan, 1 / 30, false);
    if (plan.scoutDestination) stops.add(plan.scoutDestination);
    assert.ok(Math.abs(hole.x) <= LIMIT && Math.abs(hole.z) <= LIMIT);
  }
  assert.ok(stops.size >= 3);
  assert.ok([...stops].some(point => Math.hypot(point.x, point.z) < LIMIT / 2));
  assert.equal(new Set(plan.recentSectors).size, plan.recentSectors?.length);
  assert.ok(Math.hypot(hole.vx ?? 0, hole.vz ?? 0) > 0);
  const position = { x: hole.x, z: hole.z };
  moveRival(hole, [hole], [food], plan, .1, true);
  assert.deepEqual({ x: hole.x, z: hole.z }, position);
  feed(hole, 30);
  const start = Math.hypot(hole.x - food.x, hole.z - food.z);
  moveRival(hole, [hole], [food], plan, .15, false);
  assert.equal(plan.target, food);
  assert.equal(plan.scoutDestination, undefined);
  assert.ok(Math.hypot(hole.x - food.x, hole.z - food.z) < start);
});

test('scouting varies by match and rival without sacrificing repeatability', () => {
  const destination = (seed: number, rival: number) => {
    const hole = player();
    const plan = createRivalPlan(seed, rival);
    rivalDirection(hole, [hole], [], plan, .4);
    return { point: plan.scoutDestination, sector: plan.recentSectors?.[0] };
  };
  assert.deepEqual(destination(718, 1), destination(718, 1));
  assert.notEqual(destination(718, 1).sector, destination(718, 2).sector);
  assert.notEqual(destination(718, 1).sector, destination(42, 1).sector);
});

test('rivals pick a richer food patch and replan when its target is eaten', () => {
  const hole = player();
  const lone: Item = { x: -6, z: 0, kind: 'bin', size: .65, points: 3, eaten: false };
  const patch: Item[] = Array.from({ length: 18 }, (_, i) => ({ ...lone, x: 11, z: i * .15 }));
  const plan = { reconsiderIn: 0 };
  assert.ok(rivalDirection(hole, [hole], [lone, ...patch], plan).x > 0);
  patch.forEach(item => { item.eaten = true; });
  assert.ok(rivalDirection(hole, [hole], [lone, ...patch], plan, .01).x < 0);
});

test('rivals aim ahead of crossing prey and escape along the free side of a boundary', () => {
  const hunter = { ...player(), radius: 5 };
  const prey = { ...player(), x: 12, score: 180, radius: radiusFor(180), vz: 12 };
  assert.ok(rivalDirection(hunter, [hunter, prey], []).z > 0);

  const cornered = { ...player(), x: LIMIT, z: 0 };
  const west = { ...hunter, x: LIMIT - 5, z: 0 };
  const south = { ...hunter, x: LIMIT, z: 8 };
  const escape = rivalDirection(cornered, [cornered, west, south], [], { reconsiderIn: 0 }, .02, true);
  assert.ok(escape.x <= 0 && escape.z < 0);
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
  const fall=beginFall(item,h)!;advanceFall(fall,.02);h.x=5;
  assert.equal(supports(h,item),false);assert.equal(advanceFall(fall,.11),'pending');
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
  h.x=3-item.size*.35;assert.equal(beginFall(item,h),undefined);
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

test('small holes can skim a tree while moving and finish after the bite is secured',()=>{
  const h={...player(),radius:2.1};const item={...city().find(i=>i.kind==='tree')!,x:0,z:0};
  h.x=.8;assert.ok(supports(h,item));
  const fall=beginFall(item,h)!;advanceFall(fall,.09);assert.equal(fall.secured,true);
  h.x=5;assert.equal(advanceFall(fall,.1),'eaten');assert.equal(h.score,item.points);
});
test('a brief rim excursion does not cancel an early bite',()=>{
  const h={...player(),radius:2.1};const item={...city().find(i=>i.kind==='tree')!,x:0,z:0};
  const fall=beginFall(item,h)!;advanceFall(fall,.02);h.x=5;advanceFall(fall,.04);
  assert.equal(fall.phase,'falling');h.x=0;assert.equal(advanceFall(fall,.13),'eaten');
});
