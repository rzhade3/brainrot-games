import assert from 'node:assert/strict';
import { pickBuilding } from '../src/games/factory/assets/picking';
import { planRoute, routeStartError } from '../src/games/factory/game/beltRoute';
import {
  Building, conveyorInputs, createDemo, createGuided, DIRECTIONS, HALF_HEIGHT, HALF_WIDTH, inBounds, isTool, MAP_SIZE, nextDirection, OUTPOST,
  placementError, project, terrainAt, tileKey, unproject,
} from '../src/games/factory/game/model';
import { FactorySimulation } from '../src/games/factory/game/simulation';

for (let c = 0; c < MAP_SIZE; c++) {
  for (let r = 0; r < MAP_SIZE; r++) {
    const tile = { c, r };
    const point = project(c, r);
    assert.deepEqual(unproject(point.x, point.y), tile);
    for (const offset of [
      { x: HALF_WIDTH * 0.8, y: 0 },
      { x: -HALF_WIDTH * 0.8, y: 0 },
      { x: 0, y: HALF_HEIGHT * 0.8 },
      { x: 0, y: -HALF_HEIGHT * 0.8 },
    ]) {
      assert.deepEqual(unproject(point.x + offset.x, point.y + offset.y), tile);
    }
  }
}
assert.equal(inBounds({ c: -1, r: 0 }), false);
assert.equal(inBounds({ c: MAP_SIZE, r: 0 }), false);
assert.equal(nextDirection(0), 1);
assert.equal(nextDirection(3), 0);
assert.equal(isTool('inspect'), true);
assert.equal(isTool('belt'), true);
assert.equal(isTool('splitter'), true);
assert.equal(isTool('remove'), false, 'Removal must be a selected-building action, not a placement mode');
assert.equal(isTool('assembler'), true);
assert.equal(isTool('outpost'), false, 'The fixed receiver must not be a placement tool');

const empty = new Map();
assert.equal(terrainAt({ c: 7, r: 10 }), 'iron');
assert.equal(terrainAt({ c: 9, r: 14 }), 'copper');
assert.equal(placementError({ c: 7, r: 10 }, 'miner', empty), null);
assert.equal(placementError({ c: 9, r: 14 }, 'miner', empty), null);
assert.match(placementError({ c: 11, r: 11 }, 'miner', empty)!, /ore deposit/);
const water = Array.from({ length: MAP_SIZE }, (_, c) => ({ c, r: 100 })).find(tile => terrainAt(tile) === 'water');
assert.ok(water);
assert.match(placementError(water, 'belt', empty)!, /water/);
assert.match(placementError({ c: -1, r: 0 }, 'belt', empty)!, /Outside/);
assert.match(placementError({ c: 7, r: 10 }, 'furnace', empty)!, /deposits/);
assert.equal(placementError({ c: 7, r: 10 }, 'splitter', empty), null, 'Splitters follow conveyor deposit placement rules');
assert.match(placementError(water, 'splitter', empty)!, /water/);

const junction: Building = { kind: 'belt', c: 12, r: 12, direction: 0 };
const junctionMap = new Map<string, Building>([
  [tileKey(junction), junction],
  ['11,12', { kind: 'belt', c: 11, r: 12, direction: 0 }],
  ['12,11', { kind: 'splitter', c: 12, r: 11, direction: 0 }],
  ['12,13', { kind: 'belt', c: 12, r: 13, direction: 3 }],
  ['13,12', { kind: 'belt', c: 13, r: 12, direction: 2 }],
]);
assert.deepEqual(conveyorInputs(junction, junctionMap), [0, 1, 3], 'Merge art shows all connected rear/side feeds, including splitter branches, but not the front');
junctionMap.get('12,11')!.direction = 3;
assert.deepEqual(conveyorInputs(junction, junctionMap), [0, 3], 'Rotated-away feed must not appear connected');
junctionMap.delete('12,13');
assert.deepEqual(conveyorInputs(junction, junctionMap), [0], 'Removed feed must disappear from merge art');
junctionMap.get('11,12')!.kind = 'storage';
assert.deepEqual(conveyorInputs(junction, junctionMap), [], 'A depot is not a conveyor feed');
const splitPick: Building = { kind: 'splitter', c: 12, r: 12, direction: 0 };
const splitPoint = project(splitPick.c, splitPick.r);
assert.equal(pickBuilding(splitPoint, new Map([[tileKey(splitPick), splitPick]])), splitPick);
assert.equal(pickBuilding({ x: splitPoint.x, y: splitPoint.y - 30 }, new Map([[tileKey(splitPick), splitPick]])), null,
  'Splitter selection must use its low conveyor silhouette');

const demo = createDemo();
for (const building of demo.values()) {
  const others = new Map(demo);
  others.delete(tileKey(building));
  assert.equal(placementError(building, building.kind, others), null, `Invalid demo building at ${tileKey(building)}`);
  assert.match(placementError(building, building.kind, demo)!, /occupied/);
  const center = project(building.c, building.r);
  assert.equal(pickBuilding(center, new Map([[tileKey(building), building]])), building);
  if (building.kind !== 'belt') {
    assert.equal(pickBuilding({ x: center.x, y: center.y - 35 }, demo), building,
      `Roof selection failed at ${tileKey(building)}`);
  }
}

const rear = { kind: 'storage', c: 10, r: 10, direction: 0 } as const;
const front = { kind: 'furnace', c: 11, r: 11, direction: 0 } as const;
const overlap = new Map([[tileKey(rear), rear], [tileKey(front), front]]);
assert.equal(pickBuilding(project(10, 10), overlap), front, 'Frontmost silhouette must win');
assert.equal(pickBuilding({ x: 10000, y: 10000 }, demo), null);
assert.equal(pickBuilding(project(7, 10), new Map()), null);
const outpostPoint = project(OUTPOST.c, OUTPOST.r);
assert.equal(pickBuilding({ x: outpostPoint.x + 25, y: outpostPoint.y - 55 }, createGuided())?.kind, 'outpost',
  'The outpost flag must select the outpost');

const routeFactory = new FactorySimulation(new Map());
for (let dc = -4; dc <= 4; dc++) {
  for (let dr = -4; dr <= 4; dr++) {
    for (const horizontalFirst of [true, false]) {
    const route = planRoute(routeFactory, { c: 12, r: 12 }, { c: 12 + dc, r: 12 + dr }, horizontalFirst);
    const values = route.buildings;
    assert.equal(values.length, Math.abs(dc) + Math.abs(dr) + 1, 'Routes fill every grid gap');
    assert.deepEqual({ c: values[values.length - 1].c, r: values[values.length - 1].r }, { c: 12 + dc, r: 12 + dr });
    assert.equal(new Set(values.map(tileKey)).size, values.length);
    assert.ok(values.slice(1, -1).filter((value, i) => value.direction !== values[i].direction).length <= 1,
      'Empty endpoints use straight or single-bend paths, not staircases');
    for (let i = 0; i < values.length - 1; i++) {
      const current = values[i];
      const next = values[i + 1];
      assert.equal(Math.abs(next.c - current.c) + Math.abs(next.r - current.r), 1, 'Routes must never use diagonal links');
      const vector = DIRECTIONS[current.direction];
      assert.deepEqual({ c: current.c + vector.c, r: current.r + vector.r }, { c: next.c, r: next.r });
      assert.equal(current.kind, 'belt');
    }
    if (values.length > 1) assert.equal(values[values.length - 1].direction, values[values.length - 2].direction);
    }
  }
}
assert.deepEqual(planRoute(routeFactory, { c: 10, r: 10 }, { c: 13, r: 13 }).buildings.map(value => value.direction),
  [0, 0, 0, 1, 1, 1, 1]);
assert.deepEqual(planRoute(routeFactory, { c: 10, r: 10 }, { c: 13, r: 13 }, false).buildings.map(value => value.direction),
  [1, 1, 1, 0, 0, 0, 0]);
assert.equal(routeFactory.place({ kind: 'storage', c: 12, r: 10, direction: 0 }), null);
const barrier = planRoute(routeFactory, { c: 10, r: 10 }, { c: 13, r: 13 });
assert.deepEqual(barrier.blocked, { tile: { c: 12, r: 10 }, error: 'Tile already occupied' });
assert.equal(barrier.buildings.length, 7, 'Obstacles mark a full preview, not a silently shortened route');
assert.equal(planRoute(routeFactory, barrier.start, barrier.end, false).blocked, null, 'Swap bend can avoid a blocked run');
assert.match(routeStartError(routeFactory, { c: 12, r: 10 })!, /no output/);
assert.match(planRoute(routeFactory, water, { c: 10, r: 10 }).blocked!.error, /water/);
assert.match(planRoute(routeFactory, { c: 10, r: 10 }, { c: -1000000, r: 0 }).blocked!.error, /Outside/);
assert.match(planRoute(routeFactory, { c: NaN, r: 10 }, { c: 10, r: 10 }).blocked!.error, /Outside/);
console.log(`Factory prototype checks passed: ${MAP_SIZE * MAP_SIZE} tile projections, placement rules, demo layout, rotation, depth-aware picking, and straight/L-shaped obstacle-safe conveyor routes.`);
