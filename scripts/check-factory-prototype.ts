import assert from 'node:assert/strict';
import {
  createDemo, createGuided, HALF_HEIGHT, HALF_WIDTH, inBounds, isTool, MAP_SIZE, nextDirection, OUTPOST,
  pickBuilding, placementError, project, terrainAt, tileKey, unproject,
} from '../src/games/factory/model';

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
console.log(`Factory prototype checks passed: ${MAP_SIZE * MAP_SIZE} tile projections, placement rules, demo layout, rotation, and depth-aware picking.`);
