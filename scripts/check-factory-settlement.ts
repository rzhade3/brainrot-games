import assert from 'node:assert/strict';
import { DIRECTIONS, tileKey } from '../src/games/factory/game/model';
import { createSave, restoreSave } from '../src/games/factory/session/persistence';
import { FARM_TICKS, KITCHEN_CAPACITY, MEAL_TICKS, STARTER_FOOD, WALK_TICKS } from '../src/games/factory/game/settlement';
import { DEPOT_CAPACITY, FactorySimulation, itemCount, ITEMS } from '../src/games/factory/game/simulation';
import { assertResidentLocation } from './factory-check-helpers';

const fresh = () => FactorySimulation.create();
const ticks = (sim: FactorySimulation, count: number) => { for (let i = 0; i < count; i++) sim.step(); };
const state = (sim: FactorySimulation) => sim.summary().settlement!;
const roundtrip = (sim: FactorySimulation) => {
  const restored = restoreSave(JSON.parse(JSON.stringify(createSave(sim, true, 'settlement-check')))).simulation;
  assert.deepEqual(restored.serialize(), sim.serialize());
  return restored;
};
function accounted(sim: FactorySimulation): void {
  const snapshot = sim.snapshot();
  const settlement = snapshot.settlement!;
  let food = snapshot.recovered['food-unit'];
  for (const machine of snapshot.machines) {
    food += machine.input['food-unit'] + machine.output['food-unit'] + (machine.item === 'food-unit' ? 1 : 0);
    assert.ok(machine.input['food-unit'] <= (machine.building.kind === 'kitchen' ? KITCHEN_CAPACITY : 64));
    assert.ok(machine.output['food-unit'] <= 4);
  }
  for (const resident of settlement.residents) {
    if (resident.cargo === 'food-unit') food++;
    assertResidentLocation(sim, resident);
  }
  assert.equal(food + settlement.consumedFood, settlement.starterFood + settlement.producedFood);
}

const sim = fresh();
assert.equal(sim.serialize().ruleset, 'settlement-v7');
assert.equal(sim.buildings.size, 3);
assert.equal(Object.hasOwn(sim.summary(), 'projects'), false);
assert.equal(state(sim).residents.length, 4);
assert.equal(sim.getState({ c: 14, r: 12 })!.input['food-unit'], STARTER_FOOD);
assert.equal(sim.setMachineOption({ c: 10, r: 9 }) !== null, true);
assert.throws(() => sim.remove({ c: 11, r: 12 }), /fixed/);
let replica = roundtrip(sim);
let sawCargo = false;
let sawTravel = false;
let sawFarm = false;
let firstFood = 0;
let firstDelivery = 0;
for (let i = 0; i < 1800; i++) {
  sim.step();
  replica.step();
  assert.deepEqual(replica.serialize(), sim.serialize());
  const settlement = state(sim);
  sawCargo ||= settlement.residents.some(resident => resident.cargo === 'food-unit');
  sawTravel ||= settlement.residents.some(resident => resident.travel > 0);
  sawFarm ||= settlement.residents.some(resident => resident.note === 'Growing food');
  if (!firstFood && settlement.producedFood > 0) firstFood = sim.ticks / 10;
  const heldAway = sim.getState({ c: 10, r: 9 })!.output['food-unit'] +
    settlement.residents.filter(resident => resident.cargo === 'food-unit').length;
  if (!firstDelivery && settlement.producedFood > heldAway) firstDelivery = sim.ticks / 10;
  accounted(sim);
  if (i % 37 === 0) replica = roundtrip(sim);
}
assert.ok(sawCargo && sawTravel && sawFarm);
assert.equal(state(sim).missedMeals, 0, 'Initial food and working supply chain sustain all four residents');
assert.equal(state(sim).consumedFood, 1800 / MEAL_TICKS);
assert.ok(state(sim).producedFood >= 75);
assert.ok(firstDelivery < STARTER_FOOD * MEAL_TICKS / 10, 'Starter meals last longer than the first supply delivery');

// Construction during a route replans around the new footprint without changing carried cargo.
const interrupted = fresh();
while (!state(interrupted).residents.some(resident => resident.cargo)) interrupted.step();
const traveler = state(interrupted).residents.find(resident => resident.cargo)!;
assert.ok(traveler.job!.path.length > 2);
const obstruction = traveler.job!.path[2];
assert.equal(interrupted.place({ kind: 'storage', ...obstruction, direction: 0 }), null);
ticks(interrupted, 100);
accounted(interrupted);
roundtrip(interrupted);
const carrying = fresh();
while (!state(carrying).residents.some(resident => resident.cargo)) carrying.step();
const carriedBefore = state(carrying).residents.filter(resident => resident.cargo === 'food-unit').length;
carrying.remove({ c: 14, r: 12 });
assert.ok(carrying.summary().recovered['food-unit'] >= carriedBefore, 'Removing a destination safely recovers in-flight cargo');
assert.equal(state(carrying).residents.some(resident => resident.cargo), false);
accounted(carrying);
roundtrip(carrying);
ticks(carrying, 200);
assert.ok(state(carrying).missedMeals > 0);
assert.equal(state(carrying).residents.length, 4);
assert.ok(state(carrying).producedFood > 0, 'Shortage does not disable farming');
assert.equal(carrying.place({ kind: 'kitchen', c: 14, r: 12, direction: 0 }), null);
assert.equal(carrying.setHaulTarget({ c: 10, r: 9 }, { c: 14, r: 12 }), null);
ticks(carrying, 100);
assert.ok(state(carrying).consumedFood > 0);
accounted(carrying);

const disabled = fresh();
while (!state(disabled).residents.some(resident => resident.cargo)) disabled.step();
assert.equal(disabled.place({ kind: 'furnace', c: 25, r: 25, direction: 0 }), null);
const beforeInvalidRoute = disabled.serialize();
assert.match(disabled.setHaulTarget({ c: 10, r: 9 }, { c: 25, r: 25 })!, /cannot accept/);
assert.deepEqual(disabled.serialize(), beforeInvalidRoute, 'Rejected routing must preserve in-flight cargo and reservations');
assert.equal(disabled.setHaulTarget({ c: 10, r: 9 }, null), null);
assert.equal(state(disabled).residents.some(resident => resident.job?.kind === 'collect' || resident.job?.kind === 'deliver'), false);
assert.ok(disabled.summary().recovered['food-unit'] > 0);
ticks(disabled, 100);
accounted(disabled);
roundtrip(disabled);

const reservedDepot = fresh();
const depotTile = { c: 15, r: 10 };
assert.equal(reservedDepot.place({ kind: 'storage', ...depotTile, direction: 0 }), null);
assert.equal(reservedDepot.setHaulTarget({ c: 10, r: 9 }, depotTile), null);
for (let tick = 0; tick < 100 && !state(reservedDepot).residents.some(resident =>
  resident.job?.destination && tileKey(resident.job.destination) === tileKey(depotTile)); tick++) reservedDepot.step();
const reservations = state(reservedDepot).residents.filter(resident =>
  resident.job?.destination && tileKey(resident.job.destination) === tileKey(depotTile)).length;
assert.ok(reservations > 0);
const reservedSave = reservedDepot.serialize();
const depot = reservedSave.machines.find(machine => tileKey(machine.building) === tileKey(depotTile))!;
const added = DEPOT_CAPACITY - itemCount(depot.input) - reservations - 2;
depot.input['iron-ore'] += added;
reservedSave.recovered['iron-ore'] = 5;
reservedSave.mined['iron-ore'] += added + 5;
const recovery = FactorySimulation.restore(reservedSave);
const inspection = recovery.inspectMachine(depotTile);
assert.equal(inspection.inputCapacity, DEPOT_CAPACITY);
assert.equal(inspection.availableInput, 2, 'Inspector excludes space reserved for resident deliveries');
const recovered = recovery.transferRecovered(depotTile);
assert.equal(itemCount(recovered.moved), inspection.availableInput, 'Recovery moves exactly the count promised by the inspector');
assert.equal(recovered.remaining['iron-ore'], 3);
assert.equal(recovery.inspectMachine(depotTile).availableInput, 0);
assert.ok(itemCount(recovery.getState(depotTile)!.input) < DEPOT_CAPACITY, 'Remaining physical space belongs to incoming cargo');
assert.equal(itemCount(recovery.transferRecovered(depotTile).moved), 0);
roundtrip(recovery);
ticks(recovery, 100);
assert.equal(itemCount(recovery.getState(depotTile)!.input), DEPOT_CAPACITY);
assert.equal(recovery.inspectMachine(depotTile).availableInput, 0);
accounted(recovery);
roundtrip(recovery);

const mixedDepot = fresh();
assert.equal(mixedDepot.place({ kind: 'storage', c: 15, r: 10, direction: 0 }), null);
assert.equal(mixedDepot.setHaulTarget({ c: 10, r: 9 }, null), null);
const mixedSave = mixedDepot.serialize();
const mixedStock = mixedSave.machines.find(machine => tileKey(machine.building) === '15,10')!;
mixedStock.input['food-unit'] = 3;
mixedStock.input['iron-ore'] = 2;
mixedSave.settlement.producedFood += 3;
mixedSave.mined['iron-ore'] += 2;
const matchingStock = FactorySimulation.restore(mixedSave);
assert.equal(matchingStock.setHaulTarget({ c: 15, r: 10 }, { c: 14, r: 12 }), null);
let carriedFromDepot = false;
for (let tick = 0; tick < 100; tick++) {
  matchingStock.step();
  for (const resident of matchingStock.residents) if (resident.job?.source && tileKey(resident.job.source) === '15,10') {
    assert.equal(resident.job.item, 'food-unit', 'Mixed depots deliver only items accepted by their destination');
    carriedFromDepot ||= resident.cargo === 'food-unit';
  }
  if (tick % 20 === 0) roundtrip(matchingStock);
}
assert.ok(carriedFromDepot);
assert.equal(matchingStock.getState({ c: 15, r: 10 })!.input['food-unit'], 0);
assert.equal(matchingStock.getState({ c: 15, r: 10 })!.input['iron-ore'], 2);
accounted(matchingStock);
roundtrip(matchingStock);

// Surround a destination: source remains honest stock and unavailable work is explained.
const blocked = fresh();
for (const vector of DIRECTIONS) assert.equal(blocked.place({
  kind: 'belt', c: 14 + vector.c, r: 12 + vector.r, direction: 0,
}), null);
ticks(blocked, 300);
assert.equal(blocked.getState({ c: 10, r: 9 })!.output['food-unit'], 4);
assert.ok(state(blocked).residents.some(resident => /blocked/.test(resident.note)));
assert.ok(state(blocked).missedMeals > 0);
roundtrip(blocked);
accounted(blocked);

// Replace food carrying with a conveyor, then measure useful labor on an identical second route.
const walking = fresh();
const automated = fresh();
const comparisonDepot = { c: 15, r: 12 };
for (const factory of [walking, automated]) {
  assert.equal(factory.place({ kind: 'miner', c: 7, r: 10, direction: 0 }), null);
  assert.equal(factory.place({ kind: 'storage', ...comparisonDepot, direction: 0 }), null);
  assert.equal(factory.setHaulTarget({ c: 7, r: 10 }, comparisonDepot), null);
}
for (const b of [
  { c: 11, r: 9, direction: 0 }, { c: 12, r: 9, direction: 0 }, { c: 13, r: 9, direction: 0 },
  { c: 14, r: 9, direction: 1 }, { c: 14, r: 10, direction: 1 }, { c: 14, r: 11, direction: 1 },
] as const) assert.equal(automated.place({ kind: 'belt', ...b }), null);
ticks(walking, 1200);
ticks(automated, 1200);
const walkingIron = walking.getState(comparisonDepot)!.input['iron-ore'];
const automatedIron = automated.getState(comparisonDepot)!.input['iron-ore'];
assert.ok(automatedIron > walkingIron, `Automation releases labor: expected more than ${walkingIron}, got ${automatedIron}`);
assert.equal(state(automated).residents.some(resident => resident.job?.source.c === 10 &&
  resident.job.source.r === 9 && resident.job.kind !== 'farm'), false);
assert.equal(state(automated).missedMeals, 0);
assert.equal(state(walking).missedMeals, 0);
accounted(automated);
roundtrip(automated);
for (const factory of [walking, automated]) {
  const copy = roundtrip(factory);
  ticks(factory, 200);
  ticks(copy, 200);
  assert.deepEqual(copy.serialize(), factory.serialize());
}

// Older factories are explicitly rejected, never migrated or silently converted.
for (const scenario of ['guided', 'free-play'] as const) {
  const raw = JSON.parse(JSON.stringify(createSave(fresh(), false, 'legacy')));
  raw.version = 2;
  raw.simulation.scenario = scenario;
  delete raw.simulation.ruleset;
  delete raw.simulation.settlement;
  const inventories = ['recovered', 'mined', 'smelted', 'assembled', 'recipeConsumed'];
  for (const key of inventories) delete raw.simulation[key]['food-unit'];
  for (const machine of raw.simulation.machines) {
    delete machine.input['food-unit'];
    delete machine.output['food-unit'];
  }
  const before = structuredClone(raw);
  assert.throws(() => restoreSave(raw), /Unsupported factory save version/);
  assert.deepEqual(raw, before);
}

for (const seed of ['north-bank', 'settlement', 'food', 'river', 'wood', '42', '100']) {
  const seeded = FactorySimulation.create(seed);
  ticks(seeded, 300);
  assert.ok(state(seeded).producedFood > 0);
  assert.equal(state(seeded).missedMeals, 0);
  accounted(seeded);
  roundtrip(seeded);
}
const valid = sim.serialize();
const invalid = (change: (raw: typeof valid) => void, pattern = /Corrupt/) => {
  const raw = structuredClone(valid);
  change(raw);
  assert.throws(() => FactorySimulation.restore(raw), pattern);
};
invalid(raw => { Object.assign(raw, { ruleset: 'factory-v1' }); }, /unsupported settlement ruleset/);
invalid(raw => { Object.assign(raw, { settlement: null }); });
invalid(raw => { raw.settlement!.residents.pop(); });
invalid(raw => { raw.settlement!.starterFood++; });
invalid(raw => { raw.settlement!.consumedFood++; });
invalid(raw => { raw.settlement!.mealClock = MEAL_TICKS; });
invalid(raw => { raw.settlement!.missedMeals++; });
invalid(raw => { raw.settlement!.residents[0].travel = WALK_TICKS; });
invalid(raw => { raw.settlement!.residents[0].tile = { c: 11, r: 12 }; });
invalid(raw => { raw.machines.find(machine => machine.building.kind === 'food-plot')!.progress = FARM_TICKS; });
invalid(raw => { raw.machines.find(machine => machine.building.kind === 'kitchen')!.input['iron-ore'] = 1; });
invalid(raw => { raw.settlement!.residents[0].job = null; raw.settlement!.residents[0].cargo = 'food-unit'; });
const noClockAdvance = roundtrip(sim);
const beforePause = noClockAdvance.serialize();
noClockAdvance.advance(0);
noClockAdvance.resetClock();
assert.deepEqual(noClockAdvance.serialize(), beforePause);
assert.equal(ITEMS.length, 7);
console.log(`Settlement checks passed: physical farming/hauling/consumption, reservations, save determinism, interruptions/recovery, blocked routes, no starvation, legacy rulesets, seeded starts. First harvest ${firstFood}s; first delivery ${firstDelivery}s; automated second-route iron ${automatedIron} vs walking ${walkingIron} in 120s.`);
