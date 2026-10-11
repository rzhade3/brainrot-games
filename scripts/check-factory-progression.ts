import assert from 'node:assert/strict';
import {
  Building, createGuided, OUTPOST, placementError, tileKey,
} from '../src/games/factory/game/model';
import {
  ASSEMBLE_TICKS, BUFFER_CAPACITY, DEPOT_CAPACITY, FactorySimulation, inventory,
  itemCount, ITEMS, ORDERS, RATE_WINDOW_TICKS,
} from '../src/games/factory/game/simulation';
import { advanceTicks as ticks } from './factory-check-helpers';

const building = (kind: Building['kind'], c: number, r: number, direction: Building['direction'] = 0): Building =>
  ({ kind, c, r, direction });
const state = (sim: FactorySimulation, c: number, r: number) => {
  const machine = sim.getState({ c, r });
  assert.ok(machine, `Missing machine ${c},${r}`);
  return machine;
};
const place = (sim: FactorySimulation, ...buildings: Building[]) => {
  for (const value of buildings) assert.equal(sim.place(value), null, `Cannot place ${value.kind} at ${tileKey(value)}`);
};
function accounted(sim: FactorySimulation): void {
  const snapshot = sim.snapshot();
  const held = { ...snapshot.recovered };
  for (const machine of snapshot.machines) {
    for (const items of [machine.input, machine.output]) {
      for (const item of ITEMS) {
        assert.ok(Number.isInteger(items[item]) && items[item] >= 0);
        held[item] += items[item];
      }
    }
    if (machine.item) held[machine.item]++;
    assert.ok(itemCount(machine.output) <= BUFFER_CAPACITY);
    if (machine.building.kind === 'assembler') {
      assert.ok(machine.input['iron-plate'] <= 4 && machine.input['copper-plate'] <= 4);
      assert.equal(machine.input['iron-ore'] + machine.input['copper-ore'] + machine.input['defense-supply'], 0);
    } else assert.ok(itemCount(machine.input) <= (machine.building.kind === 'storage' ? DEPOT_CAPACITY : BUFFER_CAPACITY));
  }
  for (const metal of ['iron', 'copper'] as const) {
    const ore = `${metal}-ore` as const;
    const plate = `${metal}-plate` as const;
    assert.equal(held[plate] + snapshot.delivered[plate] + snapshot.recipeConsumed[plate], snapshot.smelted[plate]);
    assert.equal(held[ore] + snapshot.smelted[plate], snapshot.mined[ore]);
  }
  assert.equal(held['defense-supply'] + snapshot.delivered['defense-supply'], snapshot.assembled['defense-supply']);
  assert.equal(snapshot.recipeConsumed['iron-plate'], snapshot.assembled['defense-supply'] * 2);
  assert.equal(snapshot.recipeConsumed['copper-plate'], snapshot.assembled['defense-supply']);
}

const freePlay = FactorySimulation.forScenario('free-play');
assert.equal(freePlay.buildings.size, 0, 'Free Play must start without factories or an outpost');
assert.equal(freePlay.objective(), null);
assert.equal(freePlay.assemblerUnlocked, true);
assert.deepEqual(freePlay.summary().stored, inventory());
assert.deepEqual(freePlay.summary().recovered, inventory());
ticks(freePlay, 100);
assert.deepEqual(freePlay.summary().mined, inventory(), 'An empty Free Play site must not produce items');
place(freePlay, building('assembler', 16, 12));

const guided = FactorySimulation.forScenario('guided');
assert.equal(guided.buildings.size, 11);
assert.equal(guided.buildings.has('9,14'), false);
assert.equal(guided.buildings.get(tileKey(OUTPOST))?.kind, 'outpost');
assert.deepEqual(guided.summary().mined, inventory());
assert.equal(guided.assemblerUnlocked, false);
assert.match(guided.place(building('assembler', 15, 12))!, /unlock/);
assert.match(guided.placementError({ c: 15, r: 12 }, 'assembler')!, /unlock/);
assert.throws(() => guided.remove(OUTPOST), /fixed/);
assert.throws(() => guided.rotate(OUTPOST), /fixed/);
assert.match(guided.place(building('outpost', 17, 12))!, /fixed/);
for (const machine of createGuided().values()) {
  const others = createGuided();
  others.delete(tileKey(machine));
  assert.equal(placementError(machine, machine.kind, others), null);
}
ticks(guided, 120);
assert.equal(guided.objective()!.accepted, 0, 'Demonstration stock must not count as a delivery');
assert.equal(guided.objective()!.rate, 0);

const copper = [
  building('miner', 9, 14), building('belt', 10, 14), building('belt', 11, 14),
  building('belt', 12, 14), building('furnace', 13, 14), building('belt', 14, 14),
  building('belt', 15, 14), building('belt', 16, 14, 3), building('belt', 16, 13, 3),
];
place(guided, ...copper);
let limit = 1500;
while (!guided.assemblerUnlocked && limit-- > 0) {
  guided.step();
  accounted(guided);
}
assert.ok(limit > 0, 'Copper commissioning must complete from real production');
assert.equal(guided.summary().delivered['copper-plate'], 16);
assert.equal(guided.objective()!.stage, 1);
assert.equal(guided.objective()!.rate, 0, 'New order starts with a fresh rate window');
ticks(guided, 100);
assert.equal(guided.summary().delivered['copper-plate'], 16, 'Excess copper must remain upstream');
assert.match(guided.status({ c: 16, r: 13 }), /needs defense supplies/);
assert.ok(state(guided, 16, 13).item);

const depotContents = guided.remove({ c: 14, r: 12 });
assert.ok(depotContents['iron-plate'] > 0);
place(guided, building('assembler', 14, 12), building('belt', 14, 13, 3), building('belt', 15, 12));
for (let i = 0; i < 3; i++) guided.rotate({ c: 14, r: 14 });
limit = 2000;
while (!guided.objective()!.complete && limit-- > 0) {
  guided.step();
  accounted(guided);
}
assert.ok(limit > 0, 'Real combined production must finish the defense-supply order');
assert.equal(guided.summary().delivered['defense-supply'], 12);
assert.equal(guided.objective()!.stage, 2);
const finalRate = guided.objective();
ticks(guided, RATE_WINDOW_TICKS * 2);
assert.deepEqual(guided.objective(), finalRate, 'Completion and its final rate stay frozen');
assert.equal(guided.summary().delivered['defense-supply'], 12);
assert.match(guided.status({ c: 15, r: 12 }), /Order complete/);
accounted(guided);

place(guided, building('storage', 17, 12));
const relocated = guided.transferRecovered({ c: 17, r: 12 });
assert.deepEqual(relocated.moved, depotContents);
assert.equal(itemCount(relocated.remaining), 0);
assert.equal(guided.transferRecovered({ c: 17, r: 12 }).moved['iron-plate'], 0);
assert.equal(guided.objective()!.accepted, 12, 'Recovery relocation cannot fulfill an order');
accounted(guided);

// Seed isolated buffers to exercise tick boundaries without production setup delays.
const assembly = new FactorySimulation();
place(assembly, building('assembler', 12, 12));
const a = state(assembly, 12, 12);
ticks(assembly, 30);
assert.equal(a.progress, 0);
a.input['iron-plate'] = 2;
ticks(assembly, 30);
assert.equal(a.progress, 0);
assert.match(assembly.status(a.building), /copper/);
a.input['copper-plate'] = 1;
ticks(assembly, ASSEMBLE_TICKS - 1);
assert.equal(a.progress, 19);
assert.equal(a.input['iron-plate'], 2, 'Inputs are retained until completion');
assembly.rotate(a.building);
assert.equal(a.progress, 19);
assert.equal(a.input['copper-plate'], 1);
assembly.step();
assert.equal(a.input['iron-plate'], 0);
assert.equal(a.input['copper-plate'], 0);
assert.equal(a.output['defense-supply'], 1);
assert.deepEqual(assembly.summary().recipeConsumed, { ...inventory(), 'iron-plate': 2, 'copper-plate': 1 });
assert.equal(assembly.summary().assembled['defense-supply'], 1);
a.input['iron-plate'] = 4;
a.input['copper-plate'] = 4;
a.output['defense-supply'] = 4;
ticks(assembly, 30);
assert.equal(a.progress, 0, 'Full output cannot consume ingredients or start a cycle');
a.output['defense-supply'] = 3;
ticks(assembly, 5);
a.output['defense-supply'] = 4;
ticks(assembly, 10);
assert.equal(a.progress, 5, 'Output blockage freezes partial work');
const assemblyRecovery = assembly.remove(a.building);
assert.deepEqual(assemblyRecovery, { ...inventory(), 'iron-plate': 4, 'copper-plate': 4, 'defense-supply': 4 });

const capacities = new FactorySimulation();
place(capacities, building('assembler', 12, 12), building('furnace', 11, 12),
  building('furnace', 12, 11, 1), building('furnace', 12, 13, 3));
state(capacities, 12, 12).input['iron-plate'] = 3;
state(capacities, 11, 12).output['iron-plate'] = 4;
state(capacities, 12, 11).output['iron-plate'] = 4;
state(capacities, 12, 13).output['copper-plate'] = 4;
capacities.step();
assert.equal(state(capacities, 12, 12).input['iron-plate'], 4, 'Competing iron sources share per-ingredient capacity');
assert.equal(state(capacities, 12, 12).input['copper-plate'], 1, 'Full iron input must not exclude copper');
state(capacities, 12, 13).output['iron-ore'] = 1;
state(capacities, 12, 13).output['copper-plate'] = 0;
capacities.step();
assert.equal(state(capacities, 12, 12).input['iron-ore'], 0, 'Assembler rejects ore');

const quota = new FactorySimulation(new Map([[tileKey(OUTPOST), building('outpost', 16, 12)]]), 'guided');
place(quota, building('furnace', 15, 12), building('furnace', 16, 11, 1), building('furnace', 17, 12, 2));
state(quota, 15, 12).output['iron-plate'] = 1;
quota.step();
assert.equal(quota.objective()!.accepted, 0, 'Wrong items stay at their source');
state(quota, 15, 12).output['iron-plate'] = 0;
for (let i = 0; i < 15; i++) {
  state(quota, 15, 12).output['copper-plate'] = 1;
  quota.step();
}
state(quota, 15, 12).output['copper-plate'] = 1;
state(quota, 16, 11).output['copper-plate'] = 1;
state(quota, 17, 12).output['defense-supply'] = 1;
quota.step();
assert.equal(quota.summary().delivered['copper-plate'], 16, 'Final quota is reserved across competing sources');
assert.equal(state(quota, 15, 12).output['copper-plate'] + state(quota, 16, 11).output['copper-plate'], 1);
assert.equal(quota.objective()!.stage, 1);
assert.equal(quota.objective()!.rate, 0);
assert.equal(quota.summary().delivered['defense-supply'], 0, 'A new order cannot accept items in the old transfer batch');
assert.equal(quota.remove({ c: 17, r: 12 })['defense-supply'], 1);
place(quota, building('assembler', 17, 12, 2));
state(quota, 17, 12).output['defense-supply'] = 1;
quota.step();
assert.equal(quota.objective()!.accepted, 1);
assert.equal(quota.objective()!.windowSeconds, 0.1);
assert.equal(quota.objective()!.rate, 600);
ticks(quota, 9);
assert.equal(quota.objective()!.rate, 60);
ticks(quota, RATE_WINDOW_TICKS - 10);
assert.equal(quota.objective()!.rate, 2);
quota.step();
assert.equal(quota.objective()!.rate, 0, 'Old deliveries leave the trailing rate window');
const pausedRate = quota.objective();
quota.advance(90);
quota.resetClock();
assert.deepEqual(quota.objective(), pausedRate, 'A paused clock does not age the window');
for (let i = 1; i < 12; i++) {
  state(quota, 17, 12).output['defense-supply'] = 1;
  quota.step();
}
assert.equal(quota.objective()!.complete, true);
assert.equal(quota.summary().delivered['copper-plate'], ORDERS[0].quantity);
assert.equal(quota.summary().delivered['defense-supply'], ORDERS[1].quantity);
const quotaFinished = quota.objective();
ticks(quota, 1000);
assert.deepEqual(quota.objective(), quotaFinished);
assert.equal(quota.assemblerUnlocked, true, 'Completion cannot revoke the assembler');
const commissioningLedger = quota.summary().delivered;
const commissioningCompletion = quota.objective();
assert.equal(quota.selectProject('extraction'), null, 'Completed Guided Run supports optional expansion without replacing its factory');
assert.equal(quota.receiver?.c, OUTPOST.c);
assert.equal(quota.receiver?.r, OUTPOST.r);
for (let i = 0; i < 8; i++) {
  state(quota, 17, 12).output['defense-supply'] = 1;
  quota.step();
}
assert.equal(quota.projectComplete('extraction'), true);
assert.equal(quota.summary().projects.accepted.extraction, 8);
assert.deepEqual(quota.summary().delivered, commissioningLedger, 'Expansion uses a separate consumed-delivery ledger');
assert.deepEqual(quota.objective(), commissioningCompletion, 'Guided completion and its final rate remain frozen');

const recovery = new FactorySimulation();
place(recovery, building('storage', 12, 12), building('storage', 13, 12));
state(recovery, 12, 12).input['iron-ore'] = 2;
state(recovery, 12, 12).input['copper-ore'] = 2;
state(recovery, 12, 12).input['iron-plate'] = 2;
state(recovery, 12, 12).input['copper-plate'] = 2;
state(recovery, 12, 12).input['defense-supply'] = 2;
const recoveredStock = recovery.remove({ c: 12, r: 12 });
state(recovery, 13, 12).input['defense-supply'] = 59;
const partial = recovery.transferRecovered({ c: 13, r: 12 });
assert.deepEqual(partial.moved, { ...inventory(), 'iron-ore': 2, 'copper-ore': 2, 'iron-plate': 1 });
assert.equal(itemCount(state(recovery, 13, 12).input), 64);
for (const item of ITEMS) assert.equal(partial.moved[item] + partial.remaining[item], recoveredStock[item]);
assert.equal(itemCount(recovery.transferRecovered({ c: 13, r: 12 }).moved), 0);
place(recovery, building('storage', 12, 12));
recovery.transferRecovered({ c: 12, r: 12 });
assert.equal(itemCount(recovery.summary().recovered), 0);
assert.equal(itemCount(recovery.transferRecovered({ c: 12, r: 12 }).moved), 0);
assert.throws(() => recovery.transferRecovered({ c: 0, r: 0 }), /selected depot/);

const orderIndependent = [building('assembler', 12, 12), building('furnace', 11, 12),
  building('furnace', 12, 11, 1), building('belt', 13, 12), building('storage', 14, 12)];
const forward = new FactorySimulation(new Map(orderIndependent.map(b => [tileKey(b), b])));
const reverse = new FactorySimulation(new Map([...orderIndependent].reverse().map(b => [tileKey(b), b])));
for (const sim of [forward, reverse]) {
  state(sim, 11, 12).output['iron-plate'] = 4;
  state(sim, 12, 11).output['copper-plate'] = 4;
}
for (let i = 0; i < 120; i++) {
  forward.step();
  reverse.step();
  assert.deepEqual(forward.snapshot(), reverse.snapshot());
}
assert.ok(forward.summary().stored['defense-supply'] > 0);
const fast = FactorySimulation.forScenario('guided');
const slow = FactorySimulation.forScenario('guided');
for (let i = 0; i < 600; i++) fast.advance(1000 / 60);
for (let i = 0; i < 300; i++) slow.advance(1000 / 30);
assert.deepEqual(fast.snapshot(), slow.snapshot(), 'Progression clocks do not depend on render frame rate');
console.log('Factory progression checks passed: scenarios, complete real-production run, recipe accounting, locks, quotas, recovery, throughput, completion, and deterministic timing.');
