import assert from 'node:assert/strict';
import { BUILDING_SHAPES, containsBuilding, pickBuilding } from '../src/games/factory/assets/picking';
import { BUILDING_KINDS, CATALOG, inventory, itemCount, ITEMS, moveInventory, project, tileKey } from '../src/games/factory/game/domain';
import { ASSEMBLER_RECIPE, inputCapacity, inputSlots, machineCycleTicks, machineRecipe, SMELTER_RECIPES } from '../src/games/factory/game/machines';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { roundTrip } from './factory-check-helpers';

const source = inventory();
const destination = inventory();
source['iron-ore'] = 5;
moveInventory(source, destination, 'iron-ore', 3);
assert.equal(itemCount(source) + itemCount(destination), 5);
for (const quantity of [-1, 0.5, Number.NaN, 3]) {
  const before = JSON.stringify([source, destination]);
  assert.throws(() => moveInventory(source, destination, 'iron-ore', quantity), /Invalid inventory transfer/);
  assert.equal(JSON.stringify([source, destination]), before, 'Rejected transfers must be atomic');
}
destination['iron-ore'] = Number.MAX_SAFE_INTEGER;
assert.throws(() => moveInventory(source, destination, 'iron-ore', 1), /Invalid inventory transfer/);
assert.equal(source['iron-ore'], 2);
assert.deepEqual(CATALOG.map(entry => entry.kind).sort(), BUILDING_KINDS.filter(kind => kind !== 'home' && kind !== 'outpost').sort());
for (const kind of BUILDING_KINDS) {
  const shape = BUILDING_SHAPES[kind];
  assert.ok(containsBuilding(kind, { x: 0, y: 0 }));
  assert.equal(containsBuilding(kind, { x: 1000, y: 1000 }), false);
  for (const point of shape.selection.flat()) {
    assert.ok(point.x >= shape.bounds.left && point.x <= shape.bounds.right &&
      point.y >= shape.bounds.top && point.y <= shape.bounds.bottom);
  }
}
const plotFactory = FactorySimulation.forScenario('settlement');
assert.equal(plotFactory.place({ kind: 'furnace', c: 25, r: 25, direction: 0 }), null);
assert.equal(plotFactory.place({ kind: 'food-plot', c: 26, r: 26, direction: 0 }), null);
const plot = plotFactory.buildings.get('26,26')!;
const smelter = plotFactory.buildings.get('25,25')!;
const plotOrigin = project(plot.c, plot.r);
const smelterOrigin = project(smelter.c, smelter.r);
assert.equal(pickBuilding(plotOrigin, plotFactory.buildings), plot);
assert.ok(containsBuilding('food-plot', { x: 0, y: -20 }), 'Crop tops remain selectable');
assert.ok(containsBuilding('food-plot', { x: 31, y: 0 }), 'Plot edges remain selectable');
assert.equal(containsBuilding('food-plot', { x: 0, y: -54 }), false, 'Plots cannot claim tall-building airspace');
assert.equal(pickBuilding({ x: smelterOrigin.x, y: smelterOrigin.y - 16 }, plotFactory.buildings), smelter,
  'A plot must not intercept a visible smelter behind it');
assert.deepEqual(roundTrip(plotFactory).serialize(), plotFactory.serialize());
const sim = FactorySimulation.forScenario('guided');
const snapshot = sim.serialize();
for (const building of sim.buildings.values()) {
  const inspection = sim.inspectMachine(building);
  assert.equal(inspection.cycleTicks, machineCycleTicks(inspection.machine));
  assert.deepEqual(inspection.recipe, machineRecipe(inspection.machine));
  for (const item of ITEMS) {
    assert.ok(inputCapacity(building.kind, item) >= 0);
    assert.ok(inputSlots(inspection.machine, item) <= inputCapacity(building.kind, item));
  }
}
assert.deepEqual(sim.serialize(), snapshot, 'Inspection must not mutate simulation state');
assert.deepEqual(roundTrip(sim).serialize(), snapshot);
assert.equal(SMELTER_RECIPES['iron-ore'].inputs[0].item, 'iron-ore');
assert.equal(ASSEMBLER_RECIPE.inputs.length, 2);

// Changing asset hit geometry affects live picking without touching a logical tile or save.
const building = { c: 6, r: 6, kind: 'storage' as const, direction: 0 as const };
const buildings = new Map([[tileKey(building), building]]);
const original = BUILDING_SHAPES.storage;
const origin = project(building.c, building.r);
const point = { x: origin.x + 70, y: origin.y };
assert.equal(pickBuilding(point, buildings), null);
try {
  BUILDING_SHAPES.storage = {
    bounds: { left: -80, right: 80, top: -80, bottom: 80 },
    selection: [[{ x: -80, y: -80 }, { x: 80, y: -80 }, { x: 80, y: 80 }, { x: -80, y: 80 }]],
  };
  assert.equal(pickBuilding(point, buildings), building);
  assert.deepEqual(sim.serialize(), snapshot);
} finally {
  BUILDING_SHAPES.storage = original;
}
console.log('Factory boundary checks passed: atomic inventory, catalog completeness, recipe inspection and asset-only picking changes.');
