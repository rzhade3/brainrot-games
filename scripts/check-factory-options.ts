import assert from 'node:assert/strict';
import { planRoute, routeStartError } from '../src/games/factory/game/beltRoute';
import { Building, conveyorInputs, DIRECTIONS, outputDirections, tileKey } from '../src/games/factory/game/model';
import { BELT_TICKS, DEPOT_CAPACITY, depotNextItem, FactorySimulation, Item, ITEMS, SimulationSave } from '../src/games/factory/game/simulation';
import { createSave, restoreSave } from '../src/games/factory/session/persistence';
import { advanceTicks as ticks, assertInvariants, emptyFactory, roundTrip } from './factory-check-helpers';

const b = (kind: Building['kind'], c: number, r: number, direction: Building['direction'] = 0): Building =>
  ({ kind, c, r, direction });
const state = (sim: FactorySimulation, c: number, r: number) => {
  const machine = sim.getState({ c, r });
  assert.ok(machine);
  return machine;
};
function credit(save: SimulationSave, item: Item, count: number): void {
  if (item === 'defense-supply') {
    credit(save, 'iron-plate', count * 2);
    credit(save, 'copper-plate', count);
    save.recipeConsumed['iron-plate'] += count * 2;
    save.recipeConsumed['copper-plate'] += count;
    save.assembled[item] += count;
  } else if (item === 'iron-plate' || item === 'copper-plate') {
    save.smelted[item] += count;
    save.mined[item === 'iron-plate' ? 'iron-ore' : 'copper-ore'] += count;
  } else if (item === 'food-unit') save.settlement.producedFood += count;
  else if (item === 'wood') save.settlement.producedWood += count;
  else save.mined[item] += count;
}
function fixture(buildings: Building[], stocks: [number, number, Item, number][] = []): FactorySimulation {
  const sim = emptyFactory();
  for (const building of buildings) assert.equal(sim.place(building), null);
  const save = sim.serialize();
  for (const [c, r, item, count] of stocks) {
    const machine = save.machines.find(m => m.building.c === c && m.building.r === r)!;
    if (machine.building.kind === 'storage') machine.input[item] += count;
    else if (machine.building.kind === 'belt' || machine.building.kind === 'splitter') {
      assert.equal(count, 1);
      machine.item = item;
      machine.progress = BELT_TICKS;
    } else machine.output[item] += count;
    credit(save, item, count);
  }
  return FactorySimulation.restore(save);
}
const defaults = fixture([b('storage', 16, 16), b('belt', 17, 16)], [[16, 16, 'iron-ore', 4]]);
assert.deepEqual(outputDirections(state(defaults, 16, 16).building), [0]);
assert.equal(routeStartError(defaults, { c: 16, r: 16 }), null);
assert.equal(defaults.inspectMachine({ c: 16, r: 16 }).option, null);
assert.equal(defaults.setMachineOption({ c: 16, r: 16 }), 'Select an extractor');
assert.deepEqual(conveyorInputs(state(defaults, 17, 16).building, defaults.buildings), [0]);
assert.equal(planRoute(defaults, { c: 16, r: 16 }, { c: 17, r: 16 }).blocked, null);
ticks(defaults, BELT_TICKS - 1);
assert.equal(state(defaults, 17, 16).item, null);
defaults.step();
assert.equal(state(defaults, 17, 16).item, 'iron-ore');
assert.equal(state(defaults, 17, 16).progress, 0);
ticks(defaults, 30);
assert.equal(state(defaults, 16, 16).input['iron-ore'], 3);
roundTrip(defaults);
const unconnected = fixture([b('storage', 16, 16)], [[16, 16, 'iron-ore', 4]]);
ticks(unconnected, 40);
assert.equal(state(unconnected, 16, 16).input['iron-ore'], 4);
assert.equal(unconnected.status({ c: 16, r: 16 }), 'Storing goods');
assert.equal(unconnected.place(b('belt', 17, 16)), null);
unconnected.step();
assert.equal(state(unconnected, 17, 16).item, 'iron-ore', 'Connecting an output needs no extra setting');
roundTrip(unconnected);
for (const outputEnabled of [false, true]) {
  const before = fixture([b('storage', 16, 16), b('belt', 17, 16)], [[16, 16, 'iron-ore', 2]]);
  if (outputEnabled) ticks(before, BELT_TICKS - 1);
  const legacy = createSave(before, true, 'legacy-depot-setting');
  Object.assign(legacy.simulation.machines.find(m => m.building.kind === 'storage')!.building, { outputEnabled });
  const restored = restoreSave(JSON.parse(JSON.stringify(legacy)));
  assert.equal(restored.save.paused, true);
  assert.deepEqual(restored.simulation.serialize(), before.serialize(), 'Old depot setting must not change saved goods or progress');
  assert.equal(Object.hasOwn(state(restored.simulation, 16, 16).building, 'outputEnabled'), false);
  ticks(restored.simulation, outputEnabled ? 1 : BELT_TICKS);
  assert.equal(state(restored.simulation, 17, 16).item, 'iron-ore', 'Both old depot modes now transfer automatically');
  roundTrip(restored.simulation);
}
for (const outputEnabled of [null, 'true', 1]) {
  const bad = defaults.serialize();
  Object.assign(bad.machines.find(m => m.building.kind === 'storage')!.building, { outputEnabled });
  assert.throws(() => FactorySimulation.restore(bad), /invalid machine option/);
}
for (const direction of [0, 1, 2, 3] as const) {
  const vector = DIRECTIONS[direction];
  const target = { c: 16 + vector.c, r: 16 + vector.r };
  const sim = fixture([b('storage', 16, 16, direction), b('belt', target.c, target.r, direction)],
    [[16, 16, 'copper-plate', 2]]);
  ticks(sim, BELT_TICKS);
  assert.equal(sim.getState(target)!.item, 'copper-plate');
  sim.rotate({ c: 16, r: 16 });
  ticks(sim, BELT_TICKS * 2);
  assert.equal(state(sim, 16, 16).input['copper-plate'], 1);
  assertInvariants(sim);
}
const mixed = fixture([b('storage', 16, 16), b('storage', 17, 16)], ITEMS.map(item => [16, 16, item, 2]));
for (let i = 0; i < ITEMS.length * 2; i++) {
  assert.equal(depotNextItem(state(mixed, 16, 16)), ITEMS[i % ITEMS.length]);
  ticks(mixed, BELT_TICKS);
  roundTrip(mixed);
}
assert.equal(depotNextItem(state(mixed, 16, 16)), null);
assert.equal(state(mixed, 17, 16).input['defense-supply'], 2);
assert.equal(state(mixed, 17, 16).input['food-unit'], 2);
assert.equal(state(mixed, 17, 16).input.wood, 2);
const blocked = fixture([b('storage', 16, 16), b('furnace', 17, 16)],
  [[16, 16, 'iron-plate', 1], [16, 16, 'copper-ore', 1]]);
const blockedSave = blocked.serialize();
blockedSave.machines.find(m => m.building.kind === 'storage')!.nextItem = 2;
const blockedCopy = FactorySimulation.restore(blockedSave);
ticks(blockedCopy, 40);
assert.equal(state(blockedCopy, 16, 16).input['iron-plate'], 1);
assert.equal(state(blockedCopy, 16, 16).input['copper-ore'], 1);
assert.match(blockedCopy.status({ c: 16, r: 16 }), /incompatible/);
const merge = fixture([b('storage', 16, 16), b('belt', 17, 15, 1), b('belt', 17, 16), b('storage', 18, 16)],
  [[16, 16, 'iron-ore', 20], [17, 15, 'copper-ore', 1]]);
ticks(merge, 60);
assert.equal(state(merge, 18, 16).input['copper-ore'], 1);
assert.ok(state(merge, 18, 16).input['iron-ore'] > 0);
assertInvariants(merge);
const split = fixture([b('storage', 15, 16), b('splitter', 16, 16), b('storage', 17, 16), b('storage', 16, 17)],
  [[15, 16, 'iron-ore', 16]]);
ticks(split, 300);
assert.equal(state(split, 17, 16).input['iron-ore'], 8);
assert.equal(state(split, 16, 17).input['iron-ore'], 8);
assertInvariants(split);
const replenishment = fixture([b('storage', 15, 16), b('storage', 16, 15, 1), b('assembler', 16, 16), b('storage', 17, 16)],
  [[15, 16, 'iron-plate', 4], [16, 15, 'copper-plate', 4]]);
ticks(replenishment, 100);
assert.equal(state(replenishment, 17, 16).input['defense-supply'], 2);
roundTrip(replenishment);
const simultaneous = fixture([b('storage', 15, 16), b('storage', 16, 16), b('storage', 17, 16)],
  [[15, 16, 'iron-ore', 1], [16, 16, 'copper-ore', DEPOT_CAPACITY]]);
ticks(simultaneous, BELT_TICKS);
assert.equal(state(simultaneous, 15, 16).input['iron-ore'], 1);
assert.equal(state(simultaneous, 16, 16).input['copper-ore'], 63);
simultaneous.step();
assert.equal(state(simultaneous, 16, 16).input['iron-ore'], 1);
assert.equal(state(simultaneous, 17, 16).input['iron-ore'], 0);
ticks(simultaneous, BELT_TICKS - 1);
assert.equal(state(simultaneous, 17, 16).input['iron-ore'], 1);
roundTrip(simultaneous);
const standard = fixture([b('miner', 7, 10), b('belt', 8, 10), b('storage', 9, 10)]);
const faster = roundTrip(standard);
assert.equal(faster.setMachineOption({ c: 7, r: 10 }), null);
ticks(standard, 80);
ticks(faster, 80);
assert.equal(faster.summary().mined['iron-ore'] - standard.summary().mined['iron-ore'], 2);
assert.equal(faster.setMachineOption({ c: 7, r: 10 }), null);
assert.equal(state(faster, 7, 10).building.upgraded, false);
roundTrip(faster);
const valid = faster.serialize();
for (const change of [
  (save: SimulationSave) => { Object.assign(save.machines.find(m => m.building.kind === 'miner')!.building, { outputEnabled: true }); },
  (save: SimulationSave) => { save.machines.find(m => m.building.kind === 'belt')!.nextItem = 1; },
]) {
  const save = structuredClone(valid);
  change(save);
  assert.throws(() => FactorySimulation.restore(save), /Corrupt/);
}
for (const bad of [null, -1, ITEMS.length, '1']) {
  const raw = JSON.parse(JSON.stringify(defaults.serialize()));
  raw.machines.find((m: { building: Building }) => m.building.kind === 'storage').nextItem = bad;
  assert.throws(() => FactorySimulation.restore(raw), /Corrupt/);
}
assert.equal(faster.setMachineOption({ c: 0, r: 0 }) !== null, true);
assert.deepEqual(state(standard, 7, 10).building, b('miner', 7, 10));
assert.equal(tileKey(state(faster, 7, 10).building), '7,10');
console.log('Factory option checks passed: extractor upgrades, automatic depot output, unconnected storage, legacy settings, cadence, ports, mixed stock, blocked output, reservation fairness, recipes and strict saves.');
