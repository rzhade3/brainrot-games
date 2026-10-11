import assert from 'node:assert/strict';
import { Building, conveyorInputs, createDemo, DIRECTIONS, outputDirections, OUTPOST, tileKey } from '../src/games/factory/model';
import { createSave, restoreSave } from '../src/games/factory/persistence';
import {
  BELT_TICKS, depotNextItem, DEPOT_CAPACITY, FactorySimulation, Item, ITEMS, SimulationSave,
} from '../src/games/factory/simulation';
import { planRoute, routeStartError } from '../src/games/factory/beltRoute';

const building = (kind: Building['kind'], c: number, r: number, direction: Building['direction'] = 0): Building =>
  ({ kind, c, r, direction });
const place = (sim: FactorySimulation, ...buildings: Building[]) => {
  for (const b of buildings) assert.equal(sim.place(b), null, `Cannot place ${b.kind} at ${tileKey(b)}`);
};
const state = (sim: FactorySimulation, c: number, r: number) => {
  const machine = sim.getState({ c, r });
  assert.ok(machine);
  return machine;
};
const ticks = (sim: FactorySimulation, count: number) => {
  for (let i = 0; i < count; i++) sim.step();
};
const roundtrip = (sim: FactorySimulation) => {
  const restored = restoreSave(JSON.parse(JSON.stringify(createSave(sim, false, 'expansion-check')))).simulation;
  assert.deepEqual(restored.serialize(), sim.serialize());
  return restored;
};
function accounted(sim: FactorySimulation): void {
  const snapshot = sim.snapshot();
  const held = { ...snapshot.recovered };
  for (const machine of snapshot.machines) {
    for (const item of ITEMS) held[item] += machine.input[item] + machine.output[item];
    if (machine.item) held[machine.item]++;
  }
  for (const metal of ['iron', 'copper'] as const) {
    assert.equal(held[`${metal}-ore`] + snapshot.smelted[`${metal}-plate`], snapshot.mined[`${metal}-ore`]);
    assert.equal(held[`${metal}-plate`] + snapshot.delivered[`${metal}-plate`] +
      snapshot.recipeConsumed[`${metal}-plate`] + sim.projectConsumed(`${metal}-plate`), snapshot.smelted[`${metal}-plate`]);
  }
  assert.equal(held['defense-supply'] + snapshot.delivered['defense-supply'] +
    sim.projectConsumed('defense-supply'), snapshot.assembled['defense-supply']);
}

function supplyFactory(parallel = false): FactorySimulation {
  const sim = new FactorySimulation(createDemo());
  assert.equal(sim.selectProject('extraction'), null);
  sim.remove({ c: 14, r: 12 });
  place(sim, building('assembler', 14, 12), building('belt', 14, 13, 3), building('belt', 15, 12));
  for (let i = 0; i < 3; i++) sim.rotate({ c: 14, r: 14 });
  if (parallel) {
    sim.remove({ c: 8, r: 10 });
    place(sim, building('splitter', 8, 10), building('belt', 8, 11), building('furnace', 9, 11),
      ...[10, 11, 12].map(c => building('belt', c, 11)),
      building('belt', 13, 11, 1), building('belt', 13, 12));
  }
  return sim;
}
const baseline = supplyFactory();
const expanded = supplyFactory(true);
const timing = (sim: FactorySimulation) => {
  let replica = roundtrip(sim);
  let first = 0;
  for (let tick = 0; tick < 1000 && !sim.projectComplete('extraction'); tick++) {
    sim.step();
    replica.step();
    if (!first && sim.summary().projects.accepted.extraction) first = sim.ticks / 10;
    accounted(sim);
    assert.deepEqual(replica.serialize(), sim.serialize());
    if (tick % 17 === 0) replica = roundtrip(sim);
  }
  assert.equal(sim.projectComplete('extraction'), true);
  assert.equal(sim.summary().projects.active, null);
  assert.equal(sim.summary().delivered['defense-supply'], 0, 'Project sink is separate from commissioning');
  assert.match(sim.selectProject('extraction')!, /complete/);
  assert.equal(state(sim, 7, 10).building.upgraded, undefined, 'Reward never automatically upgrades existing machines');
  return { first, complete: sim.ticks / 10 };
};
const baselineTiming = timing(baseline);
const expansionTiming = timing(expanded);
assert.ok(expansionTiming.complete < baselineTiming.complete - 4, 'Parallel smelting must meaningfully reduce project time');
assert.ok(baselineTiming.complete <= 36, 'Eight supplies must remain a small finite goal');
const frozenCommissioning = baseline.objective();

// Switch and pause preserve physical deliveries, and the receiver never replaces a legacy factory.
const paused = supplyFactory();
while (paused.summary().projects.accepted.extraction < 2) paused.step();
const suppliesAccepted = paused.summary().projects.accepted.extraction;
assert.equal(paused.selectProject('buffering'), null);
ticks(paused, 50);
assert.equal(paused.summary().projects.accepted.extraction, suppliesAccepted);
assert.equal(paused.selectProject(null), null);
ticks(paused, 50);
assert.deepEqual(roundtrip(paused).summary().projects, paused.summary().projects);
assert.equal(paused.selectProject('extraction'), null);
timing(paused);
const legacySite = FactorySimulation.forScenario('free-play');
place(legacySite, building('assembler', OUTPOST.c, OUTPOST.r));
const legacy = legacySite.serialize() as Partial<SimulationSave>;
delete legacy.projects;
for (const machine of legacy.machines!) delete (machine as Partial<typeof machine>).nextItem;
const migrated = FactorySimulation.restore(legacy);
assert.equal(migrated.receiver, null, 'Legacy Free Play remains untouched until opting in');
assert.equal(migrated.selectProject('buffering'), null);
assert.notDeepEqual(migrated.receiver, OUTPOST);
assert.equal(migrated.buildings.get(tileKey(OUTPOST))?.kind, 'assembler');
assert.equal(migrated.selectProject('extraction'), null);
assert.equal([...migrated.buildings.values()].filter(b => b.kind === 'outpost').length, 1);
roundtrip(migrated);
assert.match(FactorySimulation.forScenario('guided').selectProject('extraction')!, /commissioning/);
for (const seed of ['north-bank', 'expansion', 'river', 'upland', '0', '5', '42', '100']) {
  const sim = FactorySimulation.forScenario('free-play', seed);
  assert.equal(sim.selectProject('buffering'), null);
  assert.ok(sim.receiver);
  assert.ok(DIRECTIONS.some(vector => !sim.placementError({
    c: sim.receiver!.c - vector.c, r: sim.receiver!.r - vector.r,
  }, 'belt')), 'Every offered project has an accessible receiver');
  roundtrip(sim);
}

// The second project needs a different allocation: iron plates instead of supplies.
assert.equal(baseline.selectProject('buffering'), null);
baseline.remove({ c: 14, r: 12 });
baseline.remove({ c: 14, r: 13 });
baseline.rotate({ c: 14, r: 14 });
place(baseline, building('belt', 14, 12));
const bufferStarted = baseline.ticks;
while (!baseline.projectComplete('buffering') && baseline.ticks - bufferStarted < 500) baseline.step();
assert.equal(baseline.projectComplete('buffering'), true);
assert.equal(baseline.summary().projects.accepted.buffering, 16);
assert.deepEqual(baseline.objective(), frozenCommissioning);
accounted(baseline);
const bufferSeconds = (baseline.ticks - bufferStarted) / 10;
assert.ok(bufferSeconds <= 30);
const unlockedSave = roundtrip(baseline).serialize();

// Isolated cargo fixtures retain honest ledgers; all tests exercise real transfer code.
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
  } else save.mined[item] += count;
}
function fixture(buildings: Building[], stocks: [number, number, Item, number][] = []): FactorySimulation {
  const save = structuredClone(unlockedSave);
  const empty = new FactorySimulation();
  place(empty, ...buildings);
  // Keep every pre-existing held item in recovery while replacing only the isolated layout.
  for (const machine of save.machines) {
    for (const item of ITEMS) save.recovered[item] += machine.input[item] + machine.output[item];
    if (machine.item) save.recovered[machine.item]++;
  }
  save.machines = [save.machines.find(machine => machine.building.kind === 'outpost')!,
    ...empty.serialize().machines];
  save.lastSource = [];
  for (const [c, r, item, count] of stocks) {
    const machine = save.machines.find(machine => machine.building.c === c && machine.building.r === r)!;
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
const defaults = fixture([building('storage', 12, 12), building('belt', 13, 12)], [[12, 12, 'iron-ore', 4]]);
ticks(defaults, 40);
assert.equal(state(defaults, 13, 12).item, null);
assert.deepEqual(outputDirections(state(defaults, 12, 12).building), []);
assert.match(routeStartError(defaults, { c: 12, r: 12 })!, /no output/);
assert.equal(defaults.setMachineOption({ c: 12, r: 12 }), null);
assert.deepEqual(conveyorInputs(state(defaults, 13, 12).building, defaults.buildings), [0]);
assert.equal(planRoute(defaults, { c: 12, r: 12 }, { c: 13, r: 12 }).blocked, null);
ticks(defaults, BELT_TICKS - 1);
assert.equal(state(defaults, 13, 12).item, null);
defaults.step();
assert.equal(state(defaults, 13, 12).item, 'iron-ore');
assert.equal(state(defaults, 13, 12).progress, 0, 'Depot cargo cannot hop through a conveyor in the same tick');
assert.equal(defaults.setMachineOption({ c: 12, r: 12 }), null);
assert.equal(state(defaults, 12, 12).progress, 0);
ticks(defaults, 30);
assert.equal(state(defaults, 12, 12).input['iron-ore'], 3);
accounted(defaults);
roundtrip(defaults);

for (const direction of [0, 1, 2, 3] as const) {
  const vector = DIRECTIONS[direction];
  const destination = { c: 12 + vector.c, r: 12 + vector.r };
  const sim = fixture([building('storage', 12, 12, direction), building('belt', destination.c, destination.r, direction)],
    [[12, 12, 'copper-plate', 2]]);
  sim.setMachineOption({ c: 12, r: 12 });
  ticks(sim, BELT_TICKS);
  assert.equal(sim.getState(destination)!.item, 'copper-plate');
  sim.rotate({ c: 12, r: 12 });
  ticks(sim, BELT_TICKS * 2);
  assert.equal(state(sim, 12, 12).input['copper-plate'], 1, 'Rotation changes the actual output port');
  accounted(sim);
}
const mixed = fixture([building('storage', 12, 12), building('storage', 13, 12)],
  ITEMS.filter(item => item !== 'food-unit').map(item => [12, 12, item, 2]));
mixed.setMachineOption({ c: 12, r: 12 });
const factoryItems = ITEMS.filter(item => item !== 'food-unit');
for (let i = 0; i < factoryItems.length * 2; i++) {
  assert.equal(depotNextItem(state(mixed, 12, 12)), factoryItems[i % factoryItems.length]);
  ticks(mixed, BELT_TICKS);
  roundtrip(mixed);
  accounted(mixed);
}
assert.equal(depotNextItem(state(mixed, 12, 12)), null);
assert.equal(state(mixed, 13, 12).input['defense-supply'], 2, 'Mixed stock cycles without starving later item types');
const blocked = fixture([building('storage', 12, 12), building('furnace', 13, 12)],
  [[12, 12, 'iron-plate', 1], [12, 12, 'copper-ore', 1]]);
blocked.setMachineOption({ c: 12, r: 12 });
// Explicitly select a plate next; incompatible stock is retained rather than silently skipped.
const blockedSave = blocked.serialize();
blockedSave.machines.find(machine => machine.building.kind === 'storage')!.nextItem = 2;
const blockedCopy = FactorySimulation.restore(blockedSave);
ticks(blockedCopy, 40);
assert.equal(state(blockedCopy, 12, 12).input['iron-plate'], 1);
assert.equal(state(blockedCopy, 12, 12).input['copper-ore'], 1);
assert.match(blockedCopy.status({ c: 12, r: 12 }), /incompatible/);

const merge = fixture([building('storage', 12, 12), building('belt', 13, 11, 1),
  building('belt', 13, 12), building('storage', 14, 12)],
  [[12, 12, 'iron-ore', 20], [13, 11, 'copper-ore', 1]]);
merge.setMachineOption({ c: 12, r: 12 });
ticks(merge, 60);
assert.equal(state(merge, 14, 12).input['copper-ore'], 1, 'An output depot shares reservations fairly with belts');
assert.ok(state(merge, 14, 12).input['iron-ore'] > 0);
accounted(merge);
const split = fixture([building('storage', 11, 12), building('splitter', 12, 12),
  building('storage', 13, 12), building('storage', 12, 13)], [[11, 12, 'iron-ore', 16]]);
split.setMachineOption({ c: 11, r: 12 });
ticks(split, 300);
assert.equal(state(split, 13, 12).input['iron-ore'], 8);
assert.equal(state(split, 12, 13).input['iron-ore'], 8);
accounted(split);

const replenishment = fixture([building('storage', 11, 12), building('storage', 12, 11, 1),
  building('assembler', 12, 12), building('storage', 13, 12)],
  [[11, 12, 'iron-plate', 4], [12, 11, 'copper-plate', 4]]);
replenishment.setMachineOption({ c: 11, r: 12 });
replenishment.setMachineOption({ c: 12, r: 11 });
ticks(replenishment, 100);
assert.equal(state(replenishment, 13, 12).input['defense-supply'], 2, 'Reusable depots feed actual recipe production, not just other storage');
assert.equal(replenishment.summary().projects.active, null);
accounted(replenishment);
roundtrip(replenishment);

const simultaneous = fixture([building('storage', 11, 12), building('storage', 12, 12), building('storage', 13, 12)],
  [[11, 12, 'iron-ore', 1], [12, 12, 'copper-ore', DEPOT_CAPACITY]]);
simultaneous.setMachineOption({ c: 11, r: 12 });
simultaneous.setMachineOption({ c: 12, r: 12 });
ticks(simultaneous, BELT_TICKS);
assert.equal(state(simultaneous, 11, 12).input['iron-ore'], 1, 'Full destination cannot reserve a slot freed later in this batch');
assert.equal(state(simultaneous, 12, 12).input['copper-ore'], 63);
simultaneous.step();
assert.equal(state(simultaneous, 12, 12).input['iron-ore'], 1);
assert.equal(state(simultaneous, 13, 12).input['iron-ore'], 0, 'Incoming stock does not teleport through a depot');
ticks(simultaneous, BELT_TICKS - 1);
assert.equal(state(simultaneous, 13, 12).input['iron-ore'], 1);
accounted(simultaneous);
roundtrip(simultaneous);

const standardMiner = fixture([building('miner', 7, 10), building('belt', 8, 10), building('storage', 9, 10)]);
const fasterMiner = roundtrip(standardMiner);
fasterMiner.setMachineOption({ c: 7, r: 10 });
ticks(standardMiner, 80);
ticks(fasterMiner, 80);
assert.equal(fasterMiner.summary().mined['iron-ore'] - standardMiner.summary().mined['iron-ore'], 2);
assert.equal(fasterMiner.setMachineOption({ c: 7, r: 10 }), null);
assert.equal(state(fasterMiner, 7, 10).building.upgraded, false);
roundtrip(fasterMiner);

const quota = fixture([building('storage', 15, 12), building('storage', 16, 11, 1), building('storage', 17, 12, 2)],
  [[15, 12, 'defense-supply', 1], [16, 11, 'defense-supply', 1], [17, 12, 'defense-supply', 1]]);
for (const b of quota.buildings.values()) if (b.kind === 'storage') quota.setMachineOption(b);
const quotaSave = quota.serialize();
quotaSave.projects.accepted.extraction = 7;
quotaSave.projects.active = 'extraction';
quotaSave.recovered['defense-supply']++;
const finalDelivery = FactorySimulation.restore(quotaSave);
ticks(finalDelivery, BELT_TICKS);
assert.equal(finalDelivery.summary().projects.accepted.extraction, 8);
assert.equal(finalDelivery.summary().stored['defense-supply'], 2, 'Competing depots reserve the final project slot only once');
assert.equal(finalDelivery.summary().projects.active, null);
ticks(finalDelivery, 40);
assert.equal(finalDelivery.summary().stored['defense-supply'], 2, 'Completed projects cannot consume excess cargo');
roundtrip(finalDelivery);
accounted(finalDelivery);

const reuse = new FactorySimulation();
reuse.selectProject('buffering');
place(reuse, building('storage', 15, 12));
const reuseSave = reuse.serialize();
reuseSave.projects.accepted.buffering = 16;
reuseSave.projects.active = 'extraction';
credit(reuseSave, 'iron-plate', 16);
credit(reuseSave, 'defense-supply', 8);
reuseSave.recovered['defense-supply'] = 8;
const reusable = FactorySimulation.restore(reuseSave);
assert.equal(reusable.setMachineOption({ c: 15, r: 12 }), null);
assert.equal(reusable.transferRecovered({ c: 15, r: 12 }).moved['defense-supply'], 8);
assert.equal(reusable.summary().projects.accepted.extraction, 0, 'Manual recovery relocation is not a project delivery');
ticks(reusable, BELT_TICKS - 1);
assert.equal(reusable.summary().projects.accepted.extraction, 0);
reusable.step();
assert.equal(reusable.summary().projects.accepted.extraction, 1, 'Recovered stock counts only upon physical receiver acceptance');
let reusableCopy = roundtrip(reusable);
for (let i = 0; i < 80; i++) {
  reusable.step();
  reusableCopy.step();
  assert.deepEqual(reusableCopy.serialize(), reusable.serialize());
}
assert.equal(reusable.projectComplete('extraction'), true);
accounted(reusable);
reusableCopy = roundtrip(reusable);
assert.equal(reusableCopy.selectProject('extraction') !== null, true, 'Retry/reload cannot grant a reward twice');

const invalid = (change: (save: SimulationSave) => void) => {
  const save = structuredClone(unlockedSave);
  change(save);
  assert.throws(() => FactorySimulation.restore(save), /Corrupt/);
};
invalid(save => { save.projects.accepted.extraction++; });
invalid(save => { save.projects.accepted.buffering--; });
invalid(save => { save.projects.active = 'extraction'; });
invalid(save => { save.machines.find(machine => machine.building.kind === 'miner')!.building.outputEnabled = true; });
invalid(save => { save.machines.find(machine => machine.building.kind === 'belt')!.nextItem = 1; });
invalid(save => { save.machines = save.machines.filter(machine => machine.building.kind !== 'outpost'); });
for (const bad of [null, -1, ITEMS.length, '1']) {
  const save = defaults.serialize();
  const raw = JSON.parse(JSON.stringify(save));
  raw.machines.find((machine: { building: Building }) => machine.building.kind === 'storage').nextItem = bad;
  assert.throws(() => FactorySimulation.restore(raw), /Corrupt/);
}
const locked = new FactorySimulation();
place(locked, building('storage', 12, 12), building('miner', 7, 10));
assert.match(locked.setMachineOption({ c: 12, r: 12 })!, /buffering/);
assert.match(locked.setMachineOption({ c: 7, r: 10 })!, /extraction/);
const lockedSave = locked.serialize();
lockedSave.machines.find(machine => machine.building.kind === 'storage')!.building.outputEnabled = true;
assert.throws(() => FactorySimulation.restore(lockedSave), /locked/);
console.log(`Factory expansion checks passed: finite physical sinks, retained switch/pause progress, unique optional rewards, legacy receiver, strict saves, depot geometry/cadence/mixed-stock/blocked/reservation/splitter/conservation. Timings: supplies baseline ${baselineTiming.complete}s (first ${baselineTiming.first}s), parallel ${expansionTiming.complete}s (first ${expansionTiming.first}s); buffering ${bufferSeconds}s.`);
