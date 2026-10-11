import assert from 'node:assert/strict';
import { Building, OUTPOST } from '../src/games/factory/game/model';
import { createSave, restoreSave } from '../src/games/factory/session/persistence';
import { FactorySimulation } from '../src/games/factory/game/simulation';

function roundtrip(sim: FactorySimulation): FactorySimulation {
  const saved = createSave(sim, true, 'roundtrip-world');
  const restored = restoreSave(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.save.paused, true);
  assert.deepEqual(restored.simulation.serialize(), sim.serialize());
  assert.deepEqual(restored.simulation.snapshot(), sim.snapshot());
  assert.deepEqual(restored.simulation.objective(), sim.objective());
  return restored.simulation;
}

const sim = FactorySimulation.forScenario('guided');
const place = (kind: Building['kind'], c: number, r: number, direction: Building['direction'] = 0) =>
  assert.equal(sim.place({ kind, c, r, direction }), null);
place('miner', 9, 14);
for (let c = 10; c <= 12; c++) place('belt', c, 14);
place('furnace', 13, 14);
place('belt', 14, 14);
place('belt', 15, 14);
place('belt', 16, 14, 3);
place('belt', 16, 13, 3);
let replica = roundtrip(sim);
let sawSmelting = false;
let sawAssembly = false;
let sawBelt = false;
let sawCopperProgress = false;
let swapped = false;
for (let tick = 0; tick < 2500; tick++) {
  sim.advance(137);
  replica.advance(137);
  assert.deepEqual(replica.serialize(), sim.serialize(), `Restored factory diverged at tick ${tick}`);
  if (sim.assemblerUnlocked && !swapped) {
    const recovered = sim.remove({ c: 14, r: 12 });
    assert.ok(recovered['iron-plate'] > 0);
    place('storage', 15, 11);
    assert.ok(sim.transferRecovered({ c: 15, r: 11 }).moved['iron-plate'] > 0);
    place('assembler', 14, 12);
    place('belt', 14, 13, 3);
    place('belt', 15, 12);
    for (let i = 0; i < 3; i++) sim.rotate({ c: 14, r: 14 });
    sim.remove({ c: 15, r: 14 });
    swapped = true;
  }
  const state = sim.serialize();
  sawSmelting ||= state.machines.some(machine => machine.processing && machine.progress > 0);
  sawAssembly ||= state.machines.some(machine => machine.building.kind === 'assembler' && machine.progress > 0);
  sawBelt ||= state.machines.some(machine => machine.item && machine.progress > 0 && machine.progress < 8);
  sawCopperProgress ||= state.delivered['copper-plate'] > 0 && state.stage === 0;
  replica = roundtrip(sim);
  if (sim.objective()!.complete) break;
}
assert.ok(sawSmelting && sawAssembly && sawBelt && sawCopperProgress);
assert.equal(sim.objective()!.complete, true, 'Real production must complete after repeated restoration');
const completed = sim.objective();
replica = roundtrip(sim);
for (let i = 0; i < 400; i++) {
  sim.step();
  replica.step();
}
assert.deepEqual(replica.serialize(), sim.serialize());
assert.deepEqual(sim.objective(), completed, 'Completed objective and rate remain frozen without repeat rewards');
assert.equal(sim.summary().delivered['copper-plate'], 16);
assert.equal(sim.summary().delivered['defense-supply'], 12);
assert.throws(() => replica.remove(OUTPOST), /fixed/);

const free = FactorySimulation.forScenario('free-play');
assert.equal(free.place({ kind: 'miner', c: 7, r: 10, direction: 0 }), null);
free.advance(175);
assert.equal(roundtrip(free).interpolation, 0.75);
const copy = roundtrip(free);
const before = copy.serialize();
copy.resetClock();
assert.equal(copy.ticks, before.ticks);
assert.equal(copy.interpolation, 0);
const detached = free.serialize();
detached.machines[0].output['iron-ore'] = 99;
assert.notEqual(free.getState({ c: 7, r: 10 })!.output['iron-ore'], 99);

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
invalid(save => { save.simulation.stage = 1; });
invalid(save => { save.simulation.delivered['defense-supply'] = 11; });
invalid(save => { save.simulation.machines.push(save.simulation.machines[0]); });
invalid(save => { save.simulation.machines[0].building.direction = 4 as Building['direction']; });
invalid(save => { save.simulation.machines[0].progress = 1000; });
invalid(save => { save.simulation.mined['iron-ore'] = NaN; });
invalid(save => { save.simulation.orderCompleted = save.simulation.ticks + 1; });
invalid(save => { save.simulation.deliveryTicks.push(save.simulation.ticks + 1); });
invalid(save => { save.simulation.machines[0].nextOutput = 1; }, /routing/);
invalid(save => { save.simulation.machines = save.simulation.machines.filter(machine => machine.building.kind !== 'outpost'); });
assert.throws(() => restoreSave(null), /Corrupt/);
assert.throws(() => restoreSave({ version: 2, contractVersion: 1 }), /Corrupt/);
const locked = createSave(FactorySimulation.forScenario('guided'), false, 'locked');
locked.simulation.machines.push({
  ...free.serialize().machines[0],
  progress: 0,
  building: { kind: 'assembler', c: 15, r: 12, direction: 0 },
});
assert.throws(() => restoreSave(locked), /locked/);

const beforeSplitters = JSON.parse(JSON.stringify(createSave(sim, false, 'legacy-routing')));
for (const machine of beforeSplitters.simulation.machines) delete machine.nextOutput;
assert.deepEqual(restoreSave(beforeSplitters).simulation.serialize(), sim.serialize(), 'Existing saves without routing state must still resume identically');

const splitting = FactorySimulation.forScenario('free-play');
for (const building of [
  { kind: 'miner', c: 7, r: 10, direction: 0 },
  { kind: 'belt', c: 8, r: 10, direction: 0 },
  { kind: 'splitter', c: 9, r: 10, direction: 0 },
  { kind: 'storage', c: 10, r: 10, direction: 0 },
  { kind: 'storage', c: 9, r: 11, direction: 0 },
] satisfies Building[]) assert.equal(splitting.place(building), null);
let splitReplica = roundtrip(splitting);
let sawAlternate = false;
let sawSplitCargo = false;
for (let i = 0; i < 400; i++) {
  splitting.advance(137);
  splitReplica.advance(137);
  assert.deepEqual(splitReplica.serialize(), splitting.serialize(), 'Restored splitter must preserve successful-delivery alternation and cargo');
  const router = splitting.getState({ c: 9, r: 10 })!;
  sawAlternate ||= router.nextOutput === 1;
  sawSplitCargo ||= !!router.item && router.progress > 0 && router.progress < 8;
  splitReplica = roundtrip(splitting);
}
assert.ok(sawAlternate && sawSplitCargo);
const splitSave = createSave(splitting, true, 'splitter-save');
for (const bad of [-1, 2, null, undefined, '1']) {
  const candidate = JSON.parse(JSON.stringify(splitSave));
  candidate.simulation.machines.find((machine: { building: Building }) => machine.building.kind === 'splitter').nextOutput = bad;
  assert.throws(() => restoreSave(candidate), /routing/);
}
console.log('Factory persistence checks passed: real-production roundtrips, legacy compatibility, splitter routing/cargo, clocks, recipes, transfers, recovery, objectives, completion, conservation, and corrupt/version rejection.');
