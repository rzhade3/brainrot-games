import assert from 'node:assert/strict';
import { FARM_TICKS, Tile, tileKey } from '../src/games/factory/game/domain';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, roundTrip } from './factory-check-helpers';

const plot = { c: 10, r: 9 };
const nearest = { c: 12, r: 10 };
const far = { c: 17, r: 17 };
function twoPlots() {
  const sim = FactorySimulation.create();
  sim.remove(plot);
  for (const tile of [nearest, far]) {
    assert.equal(sim.place({ ...tile, kind: 'food-plot', direction: 0 }), null);
    assert.equal(sim.setHaulTarget(tile, null), null);
  }
  return sim;
}
const distance = twoPlots();
distance.step();
assert.equal(tileKey(distance.residents[1].job!.source), tileKey(nearest), 'Equal priorities favor less travel');
const priority = twoPlots();
assert.equal(priority.setWorkPriority(nearest, 'low'), null);
assert.equal(priority.setWorkPriority(far, 'high'), null);
priority.step();
assert.equal(tileKey(priority.residents[1].job!.source), tileKey(far), 'High priority outweighs this travel difference');
assert.equal(priority.setWorkPriority({ c: 11, r: 12 }, 'high') !== null, true);
assert.equal(priority.setWorkPriority({ c: 0, r: 0 }, 'low') !== null, true);
const beforeInvalid = priority.serialize();
assert.notEqual(priority.setWorkPriority(nearest, 'urgent' as 'high'), null);
assert.deepEqual(priority.serialize(), beforeInvalid);
const invalidPriority = structuredClone(beforeInvalid);
Object.assign(invalidPriority.machines.find(machine => tileKey(machine.building) === tileKey(nearest))!.building,
  { workPriority: 'urgent' });
assert.throws(() => FactorySimulation.restore(invalidPriority), /invalid work priority/);

const farm = FactorySimulation.create();
while (!farm.residents.some(resident => resident.job?.kind === 'farm' && !resident.job.path.length &&
  farm.getState(plot)!.progress > 0)) farm.step();
const farmer = farm.residents.find(resident => resident.job?.kind === 'farm')!;
const current = structuredClone(farmer.job);
const progress = farm.getState(plot)!.progress;
const food = farm.summary().settlement.producedFood;
assert.equal(farm.setWorkPriority(plot, 'low'), null);
assert.deepEqual(farmer.job, current);
assert.equal(farm.getState(plot)!.progress, progress);
advanceTicks(farm, FARM_TICKS - progress);
assert.ok(farm.summary().settlement.producedFood > food, 'A reprioritized harvest completes before new work is chosen');
roundTrip(farm);

// Five continuously stocked High requests outnumber four residents. Low must
// receive labor before those sources run dry, not merely after the queue empties.
const queue = FactorySimulation.create();
queue.remove(plot);
const sink = { c: 17, r: 17 };
assert.equal(queue.place({ ...sink, kind: 'storage', direction: 0 }), null);
const sources: Tile[] = [];
for (let c = 8; c <= 22 && sources.length < 6; c += 2) {
  for (let r = 8; r <= 22 && sources.length < 6; r += 2) {
    const tile = { c, r };
    if (!queue.placementError(tile, 'storage')) {
      assert.equal(queue.place({ ...tile, kind: 'storage', direction: 0 }), null);
      sources.push(tile);
    }
  }
}
assert.equal(sources.length, 6);
for (const [index, source] of sources.entries()) {
  assert.equal(queue.setHaulTarget(source, sink), null);
  assert.equal(queue.setWorkPriority(source, index === 5 ? 'low' : 'high'), null);
}
const stock = queue.serialize();
for (const source of sources) {
  stock.machines.find(machine => tileKey(machine.building) === tileKey(source))!.input['iron-ore'] = 64;
  stock.mined['iron-ore'] += 64;
}
for (const lowerPriority of ['normal', 'low'] as const) {
  const shared = FactorySimulation.restore(stock);
  for (const source of sources.slice(2)) assert.equal(shared.setHaulTarget(source, null), null);
  assert.equal(shared.setWorkPriority(sources[0], 'high'), null);
  assert.equal(shared.setWorkPriority(sources[1], lowerPriority), null);
  advanceTicks(shared, 5);
  const highWorkers = shared.residents.filter(resident => resident.job &&
    tileKey(resident.job.source) === tileKey(sources[0])).length;
  const lowerWorkers = shared.residents.filter(resident => resident.job &&
    tileKey(resident.job.source) === tileKey(sources[1])).length;
  assert.equal(highWorkers + lowerWorkers, 4);
  assert.ok(lowerWorkers > 0, `${lowerPriority} receives labor in the first allocation, not only after aging`);
  assert.ok(highWorkers >= lowerWorkers, 'High remains a preference without monopolizing the pool');
  if (lowerPriority === 'low') assert.ok(highWorkers > lowerWorkers);
  roundTrip(shared);
  assert.equal(shared.setHaulTarget(sources[1], null), null);
  advanceTicks(shared, 5);
  assert.equal(shared.residents.filter(resident => resident.job &&
    tileKey(resident.job.source) === tileKey(sources[0])).length, 4,
  'Diminishing weight is not a staffing cap when only one building has actionable work');
}
let contested = FactorySimulation.restore(stock);
const low = sources[5];
let firstLow = 0;
let waited = false;
for (let tick = 0; tick < 800; tick++) {
  contested.step();
  const assignment = contested.residents.find(resident => resident.job && tileKey(resident.job.source) === tileKey(low));
  if (tick < 4) assert.equal(assignment, undefined, 'High requests win initial delegation');
  waited ||= (contested.serialize().settlement.waiting[`${tileKey(low)}:iron-ore`] ?? 0) > 120;
  if (assignment && !firstLow) {
    firstLow = contested.ticks;
    assert.ok(sources.slice(0, 5).every(source => contested.getState(source)!.input['iron-ore'] > 0),
      'Aging serves Low while High still has stock');
  }
  if (tick % 17 === 0) contested = roundTrip(contested);
}
assert.ok(waited && firstLow > 4 && firstLow < 800, `Low must get a turn; first turn ${firstLow}`);
assert.ok(contested.getState(low)!.input['iron-ore'] < 64);

const full = FactorySimulation.create();
full.setHaulTarget(plot, null);
advanceTicks(full, 400);
assert.equal(full.getState(plot)!.output['food-unit'], 4);
assert.equal(full.residents.some(resident => resident.job?.kind === 'farm'), false, 'Full plots release labor');
assert.equal(full.inspectMachine(plot).staffing, 'Output full');
roundTrip(full);

const extractor = FactorySimulation.create();
assert.equal(extractor.place({ c: 7, r: 10, kind: 'miner', direction: 0 }), null);
const automatedReplica = roundTrip(extractor);
extractor.setWorkPriority({ c: 7, r: 10 }, 'low');
automatedReplica.setWorkPriority({ c: 7, r: 10 }, 'high');
advanceTicks(extractor, 100);
advanceTicks(automatedReplica, 100);
assert.deepEqual(extractor.getState({ c: 7, r: 10 })!.output, automatedReplica.getState({ c: 7, r: 10 })!.output);
assert.equal(extractor.getState({ c: 7, r: 10 })!.progress, automatedReplica.getState({ c: 7, r: 10 })!.progress);
console.log(`Automatic labor checks passed: shared High/Normal and High/Low allocation without hard staffing caps, priority/distance ordering, bounded production slots, Low aging under ongoing High demand (tick ${firstLow}), safe harvest changes, persisted queues, full release and unchanged extraction speed.`);
