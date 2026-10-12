import assert from 'node:assert/strict';
import { BUILDING_SHAPES, containsBuilding, pickBuilding } from '../src/games/factory/assets/picking';
import { BuildingKind, BUILDING_KINDS, CATALOG, inventory, inventoryText, itemCount, ITEMS, itemText, moveInventory, project, tileKey } from '../src/games/factory/game/domain';
import { ASSEMBLER_RECIPE, canHaulBetween, haulItems, inputCapacity, inputSlots, machineCycleTicks, machineRecipe, SMELTER_RECIPES } from '../src/games/factory/game/machines';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { roundTrip } from './factory-check-helpers';

const source = inventory();
const destination = inventory();
for (const [item, singular, plural] of [
  ['iron-ore', 'iron ore', 'iron ore'], ['copper-ore', 'copper ore', 'copper ore'],
  ['iron-plate', 'iron plate', 'iron plates'], ['copper-plate', 'copper plate', 'copper plates'],
  ['food-unit', 'food unit', 'food units'], ['defense-supply', 'defense supply', 'defense supplies'],
  ['wood', 'wood', 'wood'],
] as const) {
  assert.equal(itemText(item, 1), `1 ${singular}`);
  assert.equal(itemText(item, 2), `2 ${plural}`);
  assert.equal(inventoryText({ ...inventory(), [item]: 1 }), `1 ${singular}`);
}
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
assert.deepEqual(CATALOG.map(entry => entry.kind).sort(), BUILDING_KINDS.filter(kind => kind !== 'home').sort());
for (const kind of BUILDING_KINDS) {
  const shape = BUILDING_SHAPES[kind];
  assert.ok(containsBuilding(kind, { x: 0, y: 0 }));
  assert.equal(containsBuilding(kind, { x: 1000, y: 1000 }), false);
  for (const point of shape.selection.flat()) {
    assert.ok(point.x >= shape.bounds.left && point.x <= shape.bounds.right &&
      point.y >= shape.bounds.top && point.y <= shape.bounds.bottom);
  }
}
const plotFactory = FactorySimulation.create();
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
const sim = FactorySimulation.create();
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

const destinations: Record<BuildingKind, readonly BuildingKind[]> = {
  belt: [], splitter: [], home: [], kitchen: [], house: [],
  miner: ['furnace', 'storage'], furnace: ['assembler', 'storage'],
  assembler: ['storage'], storage: ['furnace', 'assembler', 'storage', 'kitchen', 'house'],
  'food-plot': ['storage', 'kitchen'], 'woodcutting-site': ['storage', 'house'],
};
for (const kind of BUILDING_KINDS) for (const targetKind of BUILDING_KINDS) {
  const from = { kind, c: 7, r: 10, direction: 0 as const };
  const to = { kind: targetKind, c: 20, r: 20, direction: 0 as const };
  assert.equal(canHaulBetween(from, to, sim.world), destinations[kind].includes(targetKind),
    `Incorrect delivery compatibility: ${kind} -> ${targetKind}`);
  assert.equal(canHaulBetween(from, { ...to, c: from.c, r: from.r }, sim.world), false, 'Self-delivery is never valid');
}
assert.deepEqual(haulItems({ kind: 'miner', c: 9, r: 14, direction: 0 }, sim.world), ['copper-ore']);
assert.deepEqual(haulItems({ kind: 'miner', c: 7, r: 10, direction: 0 }, sim.world), ['iron-ore']);
const delivery = FactorySimulation.create();
const placeReceiver = (kind: 'furnace' | 'assembler' | 'storage' | 'woodcutting-site') => {
  for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) {
    const building = { kind, c, r, direction: 0 as const };
    if (!delivery.placementError(building, kind)) {
      assert.equal(delivery.place(building), null);
      return delivery.buildings.get(tileKey(building))!;
    }
  }
  throw new Error(`No fixture site for ${kind}`);
};
placeReceiver('furnace');
const assembler = placeReceiver('assembler');
placeReceiver('storage');
placeReceiver('storage');
const woodsite = placeReceiver('woodcutting-site');
assert.equal(delivery.place({ kind: 'miner', c: 7, r: 10, direction: 0 }), null);
for (const from of delivery.buildings.values()) {
  const choices = delivery.inspectMachine(from).haul?.destinations ?? [];
  for (const to of delivery.buildings.values()) {
    const valid = tileKey(from) !== tileKey(to) && destinations[from.kind].includes(to.kind);
    assert.equal(choices.some(value => tileKey(value.building) === tileKey(to)), valid,
      'Inspector choices and assignment validation must agree');
    const before = delivery.serialize();
    const error = delivery.setHaulTarget(from, to);
    assert.equal(error === null, valid);
    if (!valid) assert.deepEqual(delivery.serialize(), before, 'Invalid routes must not mutate state');
    else assert.deepEqual(Object.keys(from.haulTo!).sort(), ['c', 'r'], 'Delivery destinations store only coordinates');
  }
  if (delivery.inspectMachine(from).haul) assert.equal(delivery.setHaulTarget(from, null), null);
}
const fullSave = delivery.serialize();
const kitchen = fullSave.machines.find(machine => machine.building.kind === 'kitchen')!;
const addedFood = inputCapacity('kitchen') - kitchen.input['food-unit'];
kitchen.input['food-unit'] += addedFood;
fullSave.settlement.producedFood += addedFood;
fullSave.settlement.kitchenDelivered += addedFood;
const full = FactorySimulation.restore(fullSave);
const foodSource = full.buildings.get('10,9')!;
assert.equal(full.getState(foodSource)!.output['food-unit'], 0);
assert.equal(full.inspectMachine(foodSource).haul!.destinations.find(value => value.building.kind === 'kitchen')!.full, true);
assert.equal(full.setHaulTarget(foodSource, kitchen.building), null, 'Full receivers stay valid even when the producer is empty');
roundTrip(full);
const legacy = delivery.serialize();
legacy.machines.find(machine => tileKey(machine.building) === tileKey(woodsite))!.building.haulTo = { c: 14, r: 12 };
const repairable = FactorySimulation.restore(legacy);
assert.deepEqual(repairable.serialize(), legacy, 'Previously selectable invalid routes must not erase or rewrite a settlement on load');
assert.match(repairable.inspectMachine(woodsite).haul!.error!, /cannot accept/);
assert.equal(repairable.inspectMachine(woodsite).haul!.destinations.some(value => value.building.kind === 'kitchen'), false);
assert.equal(repairable.setHaulTarget(woodsite, null), null);
assert.equal(repairable.inspectMachine(woodsite).haul!.error, null);

// A future recipe ingredient updates choices and validation without a new routing rule.
const originalInputs = ASSEMBLER_RECIPE.inputs;
try {
  Object.assign(ASSEMBLER_RECIPE, { inputs: [...originalInputs, { item: 'wood', quantity: 1 }] });
  assert.equal(canHaulBetween(woodsite, assembler, delivery.world), true);
  assert.deepEqual(delivery.inspectMachine(woodsite).haul!.destinations.find(value =>
    tileKey(value.building) === tileKey(assembler))!.items, ['wood']);
  assert.equal(delivery.setHaulTarget(woodsite, assembler), null);
} finally {
  Object.assign(ASSEMBLER_RECIPE, { inputs: originalInputs });
}

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
console.log('Factory boundary checks passed: atomic inventory, catalog completeness, recipe inspection, exhaustive delivery compatibility, full/empty sources, repairable saved routes, extensible recipe routing and asset-only picking changes.');
