import assert from 'node:assert/strict';
import { FOOD_READINESS_TICKS, HOUSE_CAPACITY, HOUSE_WOOD_COST, inventory, RESIDENT_FOOD_TICKS, tileKey } from '../src/games/factory/game/domain';
import { inputSlots } from '../src/games/factory/game/machines';
import { residentName, Settlement } from '../src/games/factory/game/settlement';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, roundTrip } from './factory-check-helpers';

const house = { c: 16, r: 12 };
const kitchen = { c: 14, r: 12 };

function readySave() {
  const simulation = FactorySimulation.create();
  assert.equal(simulation.place({ ...house, kind: 'house', direction: 0 }), null);
  const save = simulation.serialize();
  save.ticks = FOOD_READINESS_TICKS;
  save.machines.find(machine => machine.building.kind === 'house')!.input.wood = HOUSE_WOOD_COST;
  save.settlement.producedWood = HOUSE_WOOD_COST;
  save.machines.find(machine => machine.building.kind === 'kitchen')!.input['food-unit'] = 15;
  save.settlement.consumedFood = 12;
  save.settlement.producedFood = 19;
  save.settlement.kitchenDelivered = 19;
  save.settlement.foodHistory = Array.from({ length: 15 }, (_, i) =>
    ({ tick: FOOD_READINESS_TICKS - 15 + i + 1, harvested: 1, delivered: 1, removed: 0, missed: 0 }));
  return save;
}

const ready = FactorySimulation.restore(readySave());
const before = ready.serialize();
const inspected = ready.inspectMachine(house);
assert.equal(inspected.housing!.requiredFood, 15);
assert.equal(inspected.housing!.capacity, HOUSE_CAPACITY);
assert.equal(inspected.housing!.reason, null);
assert.equal(inspected.progress, 1);
assert.equal(inspected.availableInput, 0);
assert.equal(ready.inspectResources().find(resource => resource.item === 'wood')!
  .locations.find(location => location.key === tileKey(house))!.role, 'Installed');
assert.deepEqual(ready.serialize(), before, 'Housing inspection is read-only');

for (const field of ['harvested', 'delivered'] as const) {
  const save = readySave();
  save.settlement.foodHistory[0][field] = 0;
  const below = FactorySimulation.restore(save);
  assert.match(below.inviteResident(house)!, /too slow|kitchen space/);
  assert.equal(below.residents.length, 4);
}
{
  const save = readySave();
  save.machines.find(machine => machine.building.kind === 'kitchen')!.input['food-unit']--;
  save.recovered['food-unit']++;
  save.settlement.kitchenRemoved++;
  const below = FactorySimulation.restore(save);
  assert.match(below.inviteResident(house)!, /reserve/);
  assert.equal(below.residents.length, 4);
}
{
  const save = readySave();
  save.ticks--;
  save.settlement.mealClock = (save.ticks * 4) % RESIDENT_FOOD_TICKS;
  save.settlement.consumedFood--;
  save.machines.find(machine => machine.building.kind === 'kitchen')!.input['food-unit']++;
  save.settlement.foodHistory.forEach(event => event.tick--);
  assert.match(FactorySimulation.restore(save).inviteResident(house)!, /observation/);
}
{
  const save = readySave();
  save.settlement.consumedFood--;
  save.settlement.missedMeals++;
  save.settlement.producedFood--;
  save.settlement.kitchenDelivered--;
  save.settlement.foodHistory[0].missed = 1;
  assert.match(FactorySimulation.restore(save).inviteResident(house)!, /ran short/);
}
{
  const save = readySave();
  save.settlement.foodHistory.forEach(event => { event.harvested = 0; });
  assert.match(FactorySimulation.restore(save).inviteResident(house)!, /too slow|kitchen space/,
    'Recovered/starter deliveries cannot establish sustainability without newly harvested food');
}
{
  const blocked = FactorySimulation.restore(readySave());
  for (const tile of [{ c: 17, r: 12 }, { c: 16, r: 13 }, { c: 15, r: 12 }, { c: 16, r: 11 }]) {
    assert.equal(blocked.place({ ...tile, kind: 'storage', direction: 0 }), null);
  }
  assert.match(blocked.inviteResident(house)!, /arrival path/);
  assert.equal(blocked.residents.length, 4);
  roundTrip(blocked);
}

assert.equal(ready.inviteResident(house), null);
assert.equal(ready.residents.length, 5);
assert.equal(ready.residents[4].joinedAt, FOOD_READINESS_TICKS);
assert.deepEqual(ready.residents[4].home, house);
assert.equal(ready.residents[4].job, null);
assert.equal(ready.residents[4].cargo, null);
assert.equal(residentName(4), 'Ada 2');
assert.match(ready.inviteResident(house)!, /occupied/);
assert.match(ready.removalError(house)!, /occupied/);
assert.throws(() => ready.remove(house), /occupied/);
assert.equal(ready.serialize().settlement.foodHistory.length, 0);
assert.equal(ready.inspectMachine(house).housing!.observedTicks, 0);
assert.equal(ready.place({ c: 18, r: 12, kind: 'house', direction: 0 }), null);
const second = ready.serialize();
second.machines.find(machine => tileKey(machine.building) === '18,12')!.input.wood = HOUSE_WOOD_COST;
second.settlement.producedWood += HOUSE_WOOD_COST;
const enlarged = FactorySimulation.restore(second);
assert.equal(enlarged.inspectMachine({ c: 18, r: 12 }).housing!.requiredFood, 18,
  'The second invitation checks six residents, not the current five');
assert.match(enlarged.inviteResident({ c: 18, r: 12 })!, /observation/);
const consumed = enlarged.serialize().settlement.consumedFood;
advanceTicks(enlarged, RESIDENT_FOOD_TICKS);
assert.equal(enlarged.serialize().settlement.consumedFood - consumed, 5);
let replica = roundTrip(enlarged);
for (let tick = 0; tick < 125; tick++) {
  enlarged.step();
  replica.step();
  assert.deepEqual(replica.serialize(), enlarged.serialize());
}

for (const wood of [0, HOUSE_WOOD_COST - 1, HOUSE_WOOD_COST]) {
  const save = readySave();
  save.machines.find(machine => machine.building.kind === 'house')!.input.wood = wood;
  save.settlement.producedWood = wood;
  const simulation = FactorySimulation.restore(save);
  assert.equal(simulation.inspectMachine(house).housing!.complete, wood === HOUSE_WOOD_COST);
  assert.equal(inputSlots(simulation.getState(house)!, 'wood'), HOUSE_WOOD_COST - wood);
  assert.equal(simulation.remove(house).wood, wood);
  assert.equal(simulation.summary().recovered.wood, wood);
  roundTrip(simulation);
}
{
  const overflow = readySave();
  overflow.machines.find(machine => machine.building.kind === 'house')!.input.wood++;
  overflow.settlement.producedWood++;
  assert.throws(() => FactorySimulation.restore(overflow), /capacity/);
}
{
  const simulation = FactorySimulation.create();
  assert.equal(simulation.place({ ...house, kind: 'house', direction: 0 }), null);
  assert.equal(simulation.place({ c: 15, r: 12, kind: 'belt', direction: 0 }), null);
  const save = simulation.serialize();
  save.machines.find(machine => machine.building.kind === 'house')!.input.wood = 7;
  const belt = save.machines.find(machine => machine.building.kind === 'belt')!;
  belt.item = 'wood';
  belt.progress = 8;
  save.settlement.producedWood = 8;
  const delivering = FactorySimulation.restore(save);
  delivering.step();
  assert.equal(delivering.getState(house)!.input.wood, 8);
  assert.equal(delivering.getState(belt.building)!.item, null);
  assert.equal(delivering.inspectMachine(house).housing!.complete, true);
  roundTrip(delivering);
  const fullSave = delivering.serialize();
  fullSave.machines.find(machine => machine.building.kind === 'belt')!.item = 'wood';
  fullSave.settlement.producedWood++;
  const full = FactorySimulation.restore(fullSave);
  advanceTicks(full, 10);
  assert.equal(full.getState(house)!.input.wood, 8);
  assert.equal(full.getState(belt.building)!.item, 'wood', 'A ninth delivered wood waits outside the completed house');
  roundTrip(full);
}
{
  const simulation = FactorySimulation.create();
  for (const [kind, c, r, direction] of [['house', 16, 12, 0], ['storage', 13, 12, 0], ['belt', 17, 12, 2]] as const) {
    assert.equal(simulation.place({ kind, c, r, direction }), null);
  }
  const save = simulation.serialize();
  save.machines.find(machine => machine.building.kind === 'house')!.input.wood = 7;
  const belt = save.machines.find(machine => machine.building.kind === 'belt')!;
  belt.item = 'wood';
  belt.progress = 8;
  const carrier = save.settlement.residents[0];
  carrier.tile = { c: 15, r: 12 };
  carrier.cargo = 'wood';
  carrier.job = { kind: 'deliver', source: { c: 13, r: 12 }, destination: house, item: 'wood', path: [] };
  save.settlement.producedWood = 9;
  const competing = FactorySimulation.restore(save);
  assert.equal(competing.inspectMachine(house).availableInput, 0, 'Last construction slot is reserved for carried wood');
  const canceled = roundTrip(competing);
  canceled.remove(house);
  assert.equal(canceled.summary().recovered.wood, 8, 'Cancellation recovers installed and carried wood, not waiting belt stock');
  roundTrip(canceled);
  competing.step();
  assert.equal(competing.getState(house)!.input.wood, 8);
  assert.equal(competing.getState(belt.building)!.item, 'wood', 'Conveyor cannot take a slot reserved by a resident');
  roundTrip(competing);
}
{
  const simulation = FactorySimulation.restore(readySave());
  simulation.remove(kitchen);
  const noKitchen = simulation.inspectMachine(house).housing!;
  assert.equal(noKitchen.stockedFood, 0);
  assert.equal(noKitchen.deliveredFood, 0, 'Removing a kitchen subtracts its recovered stock from observed replenishment');
  assert.match(simulation.inviteResident(house)!, /arrival path/);
  assert.equal(simulation.place({ ...kitchen, kind: 'kitchen', direction: 0 }), null);
  assert.match(simulation.inviteResident(house)!, /too slow/, 'Recovery alone is not a new sustainable supply');
  roundTrip(simulation);
}
{
  const simulation = FactorySimulation.restore(readySave());
  assert.equal(simulation.place({ c: 16, r: 10, kind: 'kitchen', direction: 0 }), null);
  const save = simulation.serialize();
  save.machines.find(machine => tileKey(machine.building) === tileKey(kitchen))!.input['food-unit'] = 1;
  save.machines.find(machine => tileKey(machine.building) === '16,10')!.input['food-unit'] = 14;
  const kitchens = FactorySimulation.restore(save);
  advanceTicks(kitchens, 25);
  assert.equal(kitchens.getState(kitchen)!.input['food-unit'], 0, 'The first kitchen is served in deterministic tile order');
  advanceTicks(kitchens, 25);
  assert.equal(kitchens.getState({ c: 16, r: 10 })!.input['food-unit'], 13);
  roundTrip(kitchens);
}
{
  const simulation = FactorySimulation.create();
  assert.equal(simulation.place({ c: 13, r: 12, kind: 'belt', direction: 0 }), null);
  const save = simulation.serialize();
  save.machines.find(machine => machine.building.kind === 'belt')!.item = 'food-unit';
  save.machines.find(machine => machine.building.kind === 'belt')!.progress = 8;
  save.settlement.producedFood++;
  const conveyor = FactorySimulation.restore(save);
  conveyor.step();
  assert.equal(conveyor.summary().settlement.kitchenDelivered, 1);
  assert.equal(conveyor.summary().settlement.foodHistory.reduce((sum, event) => sum + event.delivered, 0), 1,
    'Conveyor food deliveries contribute once to the same readiness history as carriers');
  roundTrip(conveyor);
}
{
  const save = readySave();
  Object.assign(save, { ruleset: 'settlement-v6' });
  assert.throws(() => FactorySimulation.restore(save), /unsupported settlement ruleset/);
}
for (const mutate of [
  (save: ReturnType<typeof readySave>) => { save.settlement.foodHistory[0].delivered = 99; },
  (save: ReturnType<typeof readySave>) => { save.settlement.foodHistory[0].tick = save.ticks + 1; },
  (save: ReturnType<typeof readySave>) => { save.settlement.foodObservedSince = save.ticks + 1; },
  (save: ReturnType<typeof readySave>) => { save.settlement.mealClock = RESIDENT_FOOD_TICKS; },
  (save: ReturnType<typeof readySave>) => { save.settlement.kitchenDelivered++; },
  (save: ReturnType<typeof readySave>) => { save.settlement.residents[0].home = house; },
]) {
  const save = readySave();
  mutate(save);
  assert.throws(() => FactorySimulation.restore(save), /Corrupt/);
}
{
  const machine = structuredClone(ready.getState(kitchen)!);
  machine.input['food-unit'] = 16;
  const state = FactorySimulation.create().serialize().settlement;
  state.residents = Array.from({ length: 105 }, (_, id) => ({ ...structuredClone(state.residents[0]), id }));
  const settlement = new Settlement({
    machines: new Map([[tileKey(kitchen), machine]]), world: ready.world, automated: () => false,
    recover: () => assert.fail('Unexpected recovery'), receive: () => assert.fail('Unexpected delivery'), ticks: () => 1,
  }, state);
  settlement.step();
  assert.equal(settlement.state.consumedFood, 1);
  assert.equal(settlement.state.mealClock, 5);
  settlement.state.mealClock = 99;
  settlement.step();
  assert.equal(settlement.state.consumedFood, 3, 'Multiple whole food units can be due in one tick');
  machine.input = inventory();
  settlement.step();
  const misses = settlement.state.missedMeals;
  assert.ok(misses > 0);
  machine.input['food-unit'] = 1;
  settlement.step();
  assert.equal(settlement.state.consumedFood, 4, 'Shortage does not create additional catch-up debt');
}

function normalOpening() {
  const simulation = FactorySimulation.create();
  for (const [kind, c, r] of [
    ['house', 16, 12], ['kitchen', 16, 10], ['food-plot', 13, 10], ['food-plot', 15, 10],
  ] as const) assert.equal(simulation.place({ kind, c, r, direction: 0 }), null);
  assert.equal(simulation.setHaulTarget({ c: 15, r: 10 }, { c: 16, r: 10 }), null);
  const sites = [];
  for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) {
    if (!simulation.placementError({ c, r }, 'woodcutting-site')) sites.push({ c, r });
  }
  sites.sort((a, b) => Math.abs(a.c - house.c) + Math.abs(a.r - house.r) -
    Math.abs(b.c - house.c) - Math.abs(b.r - house.r) || a.c - b.c || a.r - b.r);
  const site = sites[0];
  assert.ok(site);
  assert.equal(simulation.place({ ...site, kind: 'woodcutting-site', direction: 0 }), null);
  assert.equal(simulation.setHaulTarget(site, house), null);
  return { simulation, site };
}
const opening = normalOpening();
let completedAt = 0;
let invitedAt = 0;
let newcomerWorkedAt = 0;
let sawCargo = false;
for (let tick = 0; tick < 4000; tick++) {
  opening.simulation.step();
  const housing = opening.simulation.inspectMachine(house).housing!;
  if (housing.complete && !completedAt) completedAt = opening.simulation.ticks;
  if (!invitedAt && !housing.reason) {
    invitedAt = opening.simulation.ticks;
    assert.equal(opening.simulation.inviteResident(house), null);
    replica = roundTrip(opening.simulation);
  }
  if (opening.simulation.residents[4]?.job && !newcomerWorkedAt) newcomerWorkedAt = opening.simulation.ticks;
  if (!sawCargo && opening.simulation.residents.some(resident => resident.cargo === 'wood' && resident.job?.kind === 'deliver')) {
    sawCargo = true;
    const inFlight = roundTrip(opening.simulation);
    inFlight.remove(house);
    roundTrip(inFlight);
    assert.ok(inFlight.summary().recovered.wood > 0, 'Cancellation conserves delivered and in-flight wood');
  }
  if (tick % 100 === 0) roundTrip(opening.simulation);
}
assert.ok(completedAt && invitedAt && newcomerWorkedAt && sawCargo);
assert.equal(opening.simulation.residents.length, 5);
assert.equal(opening.simulation.summary().settlement.missedMeals, 0);
assert.ok(opening.simulation.getState(kitchen)!.input['food-unit'] > 0);
assert.ok(opening.simulation.getState(opening.site)!.output.wood <= 4);
console.log(`Housing checks passed: physical eight-wood construction/recovery, prospective readiness, atomic invitations, dynamic demand, validation and replay. Normal four-resident opening: house ${completedAt / 10}s, invitation ${invitedAt / 10}s, newcomer work ${newcomerWorkedAt / 10}s; no shortages through 400s.`);
