import assert from 'node:assert/strict';
import { Building } from '../src/games/factory/game/model';
import { createSave, restoreSave, SAVE_VERSION } from '../src/games/factory/session/persistence';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, createDemo, factoryFrom, roundTrip, unlockedFactory } from './factory-check-helpers';

const sim = factoryFrom(createDemo());
const place = (kind: Building['kind'], c: number, r: number, direction: Building['direction'] = 0) =>
  assert.equal(sim.place({ kind, c, r, direction }), null);
advanceTicks(sim, 300);
assert.ok(sim.remove({ c: 14, r: 12 })['iron-plate'] > 0);
place('storage', 15, 11);
assert.ok(sim.transferRecovered({ c: 15, r: 11 }).moved['iron-plate'] > 0);
place('assembler', 14, 12);
place('belt', 14, 13, 3);
place('storage', 15, 12);
for (let i = 0; i < 3; i++) sim.rotate({ c: 14, r: 14 });
sim.remove({ c: 15, r: 14 });
let replica = roundTrip(sim);
let sawSmelting = false;
let sawAssembly = false;
let sawBelt = false;
for (let tick = 0; tick < 600; tick++) {
  sim.advance(137);
  replica.advance(137);
  assert.deepEqual(replica.serialize(), sim.serialize(), `Restored factory diverged at tick ${tick}`);
  const state = sim.serialize();
  sawSmelting ||= state.machines.some(machine => machine.processing && machine.progress > 0);
  sawAssembly ||= state.machines.some(machine => machine.building.kind === 'assembler' && machine.progress > 0);
  sawBelt ||= state.machines.some(machine => machine.item && machine.progress > 0 && machine.progress < 8);
  replica = roundTrip(sim);
}
assert.ok(sawSmelting && sawAssembly && sawBelt);
assert.ok(sim.summary().stored['defense-supply'] > 0);
for (let i = 0; i < 400; i++) {
  sim.step();
  replica.step();
}
assert.deepEqual(replica.serialize(), sim.serialize());
assert.throws(() => replica.remove({ c: 11, r: 12 }), /fixed/);

const fresh = unlockedFactory();
assert.equal(fresh.place({ kind: 'miner', c: 7, r: 10, direction: 0 }), null);
fresh.advance(175);
assert.equal(roundTrip(fresh).interpolation, 0.75);
const copy = roundTrip(fresh);
const before = copy.serialize();
copy.resetClock();
assert.equal(copy.ticks, before.ticks);
assert.equal(copy.interpolation, 0);
const detached = fresh.serialize();
detached.machines[0].output['iron-ore'] = 99;
assert.notEqual(fresh.getState({ c: 7, r: 10 })!.output['iron-ore'], 99);
detached.settlement.residents[0].tile.c = 99;
assert.notEqual(fresh.residents[0].tile.c, 99);

const valid = createSave(sim, false, 'valid-world');
const invalid = (change: (save: typeof valid) => void, pattern = /Corrupt factory save/) => {
  const candidate = structuredClone(valid);
  change(candidate);
  assert.throws(() => restoreSave(candidate), pattern);
};
invalid(save => { save.version = 999; }, /Unsupported/);
invalid(save => { save.contractVersion = 999; }, /Unsupported/);
invalid(save => { save.map.generatorVersion = 999; }, /Unsupported/);
invalid(save => { save.simulation.recovered['iron-ore']++; });
invalid(save => { save.simulation.accumulator = 100; });
invalid(save => { save.simulation.machines.push(save.simulation.machines[0]); });
invalid(save => { save.simulation.machines[0].building.direction = 4 as Building['direction']; });
invalid(save => { save.simulation.machines[0].progress = 1000; });
invalid(save => { save.simulation.mined['iron-ore'] = NaN; });
invalid(save => { save.simulation.machines[0].nextOutput = 1; }, /routing/);
invalid(save => { save.simulation.machines = save.simulation.machines.filter(machine => machine.building.kind !== 'home'); });
invalid(save => { Object.assign(save.simulation, { scenario: 'settlement' }); }, /legacy/);
invalid(save => { Object.assign(save.simulation, { projects: {} }); }, /legacy/);
invalid(save => { Object.assign(save.simulation, { ruleset: 'settlement-v1' }); }, /ruleset/);
assert.throws(() => restoreSave(null), /Corrupt/);
assert.throws(() => restoreSave({ version: SAVE_VERSION, contractVersion: 1 }), /Corrupt/);
for (const version of [1, 2]) {
  invalid(save => { save.version = version; }, /Unsupported factory save version/);
}
for (const field of ['nextOutput', 'nextItem'] as const) {
  const missing = JSON.parse(JSON.stringify(valid));
  delete missing.simulation.machines[0][field];
  assert.throws(() => restoreSave(missing), /Corrupt/);
}
const splitting = unlockedFactory();
for (const building of [
  { kind: 'miner', c: 7, r: 10, direction: 0 },
  { kind: 'belt', c: 8, r: 10, direction: 0 },
  { kind: 'splitter', c: 9, r: 10, direction: 0 },
  { kind: 'storage', c: 10, r: 10, direction: 0 },
  { kind: 'storage', c: 9, r: 11, direction: 0 },
] satisfies Building[]) assert.equal(splitting.place(building), null);
let splitReplica = roundTrip(splitting);
let sawAlternate = false;
let sawSplitCargo = false;
for (let i = 0; i < 400; i++) {
  splitting.advance(137);
  splitReplica.advance(137);
  assert.deepEqual(splitReplica.serialize(), splitting.serialize());
  const router = splitting.getState({ c: 9, r: 10 })!;
  sawAlternate ||= router.nextOutput === 1;
  sawSplitCargo ||= !!router.item && router.progress > 0 && router.progress < 8;
  splitReplica = roundTrip(splitting);
}
assert.ok(sawAlternate && sawSplitCargo);
const splitSave = createSave(splitting, true, 'splitter-save');
for (const bad of [-1, 2, null, undefined, '1']) {
  const candidate = JSON.parse(JSON.stringify(splitSave));
  candidate.simulation.machines.find((m: { building: Building }) => m.building.kind === 'splitter').nextOutput = bad;
  assert.throws(() => restoreSave(candidate), /routing/);
}
console.log('Factory persistence checks passed: production replay, cargo/recipes/recovery, clocks, conservation, strict routing and incompatible-save rejection.');
