import assert from 'node:assert/strict';
import { DIRECTIONS, tileKey } from '../src/games/factory/model';
import { createSave, restoreSave } from '../src/games/factory/persistence';
import { FactorySimulation, ITEMS } from '../src/games/factory/simulation';
import { FARM_TICKS, KITCHEN_CAPACITY, MEAL_TICKS, STARTER_FOOD, WALK_TICKS } from '../src/games/factory/settlement';

const fresh = () => FactorySimulation.forScenario('settlement');
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
    assert.ok(!sim.buildings.has(tileKey(resident.tile)), 'Workers never walk through occupied footprints');
    assert.ok(!['water', 'tree'].includes(sim.world.terrainAt(resident.tile)));
    assert.ok(resident.travel >= 0 && resident.travel < WALK_TICKS);
  }
  assert.equal(food + settlement.consumedFood, settlement.starterFood + settlement.producedFood);
}

const sim = fresh();
assert.equal(sim.serialize().ruleset, 'settlement-v1');
assert.equal(sim.buildings.size, 3);
assert.equal(sim.summary().projects.available, false);
assert.equal(sim.objective(), null);
assert.equal(state(sim).residents.length, 4);
assert.equal(sim.getState({ c: 14, r: 12 })!.input['food-unit'], STARTER_FOOD);
assert.equal(sim.setMachineOption({ c: 10, r: 9 }) !== null, true);
assert.throws(() => sim.remove({ c: 11, r: 12 }), /fixed/);
assert.equal(sim.selectProject('extraction') !== null, true);
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
  sawFarm ||= settlement.residents.some(resident => resident.note === 'Farming');
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
assert.equal(disabled.setHaulTarget({ c: 10, r: 9 }, null), null);
assert.equal(state(disabled).residents.some(resident => resident.job?.kind === 'collect' || resident.job?.kind === 'deliver'), false);
assert.ok(disabled.summary().recovered['food-unit'] > 0);
ticks(disabled, 100);
accounted(disabled);
roundtrip(disabled);

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
for (const factory of [walking, automated]) {
  assert.equal(factory.place({ kind: 'miner', c: 7, r: 10, direction: 0 }), null);
  assert.equal(factory.place({ kind: 'storage', c: 15, r: 10, direction: 0 }), null);
  assert.equal(factory.setHaulTarget({ c: 7, r: 10 }, { c: 15, r: 10 }), null);
}
for (const b of [
  { c: 11, r: 9, direction: 0 }, { c: 12, r: 9, direction: 0 }, { c: 13, r: 9, direction: 0 },
  { c: 14, r: 9, direction: 1 }, { c: 14, r: 10, direction: 1 }, { c: 14, r: 11, direction: 1 },
] as const) assert.equal(automated.place({ kind: 'belt', ...b }), null);
ticks(walking, 600);
ticks(automated, 600);
const walkingIron = walking.getState({ c: 15, r: 10 })!.input['iron-ore'];
const automatedIron = automated.getState({ c: 15, r: 10 })!.input['iron-ore'];
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

// Old five-item factories are explicitly normalized, never converted to a settlement.
for (const scenario of ['guided', 'free-play'] as const) {
  const old = FactorySimulation.forScenario(scenario);
  ticks(old, 100);
  const raw = JSON.parse(JSON.stringify(createSave(old, false, 'legacy')));
  delete raw.simulation.ruleset;
  delete raw.simulation.settlement;
  const inventories = ['recovered', 'mined', 'smelted', 'assembled', 'recipeConsumed', 'delivered'];
  for (const key of inventories) delete raw.simulation[key]['food-unit'];
  for (const machine of raw.simulation.machines) {
    delete machine.input['food-unit'];
    delete machine.output['food-unit'];
  }
  const restored = restoreSave(raw).simulation;
  assert.equal(restored.serialize().ruleset, 'factory-v1');
  assert.equal(restored.summary().settlement, null);
  assert.deepEqual(restored.serialize(), old.serialize());
  assert.equal(restored.place({ kind: 'food-plot', c: 10, r: 9, direction: 0 }) !== null, true);
}

for (const seed of ['north-bank', 'settlement', 'food', 'river', 'wood', '42', '100']) {
  const seeded = FactorySimulation.forScenario('settlement', seed);
  ticks(seeded, 300);
  assert.ok(state(seeded).producedFood > 0);
  assert.equal(state(seeded).missedMeals, 0);
  accounted(seeded);
  roundtrip(seeded);
}
const valid = sim.serialize();
const invalid = (change: (raw: typeof valid) => void) => {
  const raw = structuredClone(valid);
  change(raw);
  assert.throws(() => FactorySimulation.restore(raw), /Corrupt/);
};
invalid(raw => { raw.ruleset = 'factory-v1'; });
invalid(raw => { raw.settlement = null; });
invalid(raw => { raw.settlement!.residents.pop(); });
invalid(raw => { raw.settlement!.starterFood++; });
invalid(raw => { raw.settlement!.consumedFood++; });
invalid(raw => { raw.settlement!.mealClock = MEAL_TICKS; });
invalid(raw => { raw.settlement!.missedMeals++; });
invalid(raw => { raw.settlement!.residents[0].travel = WALK_TICKS; });
invalid(raw => { raw.settlement!.residents[0].tile = { c: 11, r: 12 }; });
invalid(raw => { raw.machines.find(machine => machine.building.kind === 'food-plot')!.progress = FARM_TICKS; });
invalid(raw => { raw.machines.find(machine => machine.building.kind === 'kitchen')!.input['iron-ore'] = 1; });
invalid(raw => { raw.settlement!.residents[0].cargo = 'food-unit'; });
const noClockAdvance = roundtrip(sim);
const beforePause = noClockAdvance.serialize();
noClockAdvance.advance(0);
noClockAdvance.resetClock();
assert.deepEqual(noClockAdvance.serialize(), beforePause);
assert.equal(ITEMS.length, 6);
console.log(`Settlement checks passed: physical farming/hauling/consumption, reservations, save determinism, interruptions/recovery, blocked routes, no starvation, legacy rulesets, seeded starts. First harvest ${firstFood}s; first delivery ${firstDelivery}s; automated second-route iron ${automatedIron} vs walking ${walkingIron} in 60s.`);
