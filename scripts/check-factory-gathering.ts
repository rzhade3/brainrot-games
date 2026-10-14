import assert from 'node:assert/strict';
import { containsBuilding, pickBuilding } from '../src/games/factory/assets/picking';
import { DIRECTIONS, GATHER_RADIUS, GATHER_TICKS, project, Tile, tileKey } from '../src/games/factory/game/domain';
import { gatheringAccess } from '../src/games/factory/game/gathering';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, assertInvariants, assertResidentLocation, roundTrip } from './factory-check-helpers';

function sites(sim: FactorySimulation): Tile[] {
  const result: Tile[] = [];
  for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) {
    if (!sim.placementError({ c, r }, 'woodcutting-site')) result.push({ c, r });
  }
  return result.sort((a, b) => Math.abs(a.c - 12) + Math.abs(a.r - 12) -
    Math.abs(b.c - 12) - Math.abs(b.r - 12) || a.c - b.c || a.r - b.r);
}
const initial = FactorySimulation.create();
const site = sites(initial)[0];
assert.ok(site);
const setup = () => {
  const sim = FactorySimulation.create();
  assert.equal(sim.place({ ...site, kind: 'woodcutting-site', direction: 0 }), null);
  return sim;
};
function until(sim: FactorySimulation, condition: () => boolean, limit = 2000): void {
  for (let i = 0; i < limit && !condition(); i++) sim.step();
  assert.ok(condition(), `Condition not reached after ${limit} ticks`);
}
const woodworker = (sim: FactorySimulation) => sim.residents.find(resident =>
  (resident.job?.kind === 'gather' || resident.job?.kind === 'return-wood') && tileKey(resident.job.source) === tileKey(site));
function accounted(sim: FactorySimulation): void {
  const snapshot = sim.snapshot();
  let held = snapshot.recovered.wood;
  for (const machine of snapshot.machines) {
    held += machine.input.wood + machine.output.wood + (machine.item === 'wood' ? 1 : 0);
    assert.ok(machine.output.wood <= 4);
    assert.ok(sim.residents.filter(resident => resident.job &&
      ['farm', 'gather', 'return-wood'].includes(resident.job.kind) &&
      tileKey(resident.job.source) === tileKey(machine.building)).length <= 1);
  }
  const reserved = new Set<string>();
  for (const resident of snapshot.settlement.residents) {
    if (resident.cargo === 'wood') held++;
    if (resident.job?.kind === 'gather') {
      assert.equal(reserved.has(tileKey(resident.job.tree)), false);
      reserved.add(tileKey(resident.job.tree));
      assert.equal(sim.world.terrainAt(resident.job.tree), 'tree');
      assert.ok(Math.abs(resident.job.tree.c - resident.job.source.c) +
        Math.abs(resident.job.tree.r - resident.job.source.r) <= GATHER_RADIUS);
    }
    assertResidentLocation(sim, resident);
    assert.equal(Object.hasOwn(resident, 'workplace'), false);
  }
  assert.equal(held, snapshot.settlement.producedWood);
}

const sim = setup();
assert.equal(sim.getState(site)!.building.workPriority ?? 'normal', 'normal');
assert.equal(sim.inspectMachine(site).cycleTicks, GATHER_TICKS);
let replica = roundTrip(sim);
let sawGather = false;
let sawReturn = false;
let sawTravel = false;
for (let i = 0; i < 900; i++) {
  sim.step();
  replica.step();
  assert.deepEqual(replica.serialize(), sim.serialize());
  const worker = woodworker(sim);
  sawGather ||= worker?.job?.kind === 'gather' && !worker.job.path.length;
  sawReturn ||= worker?.job?.kind === 'return-wood';
  sawTravel ||= !!worker?.travel;
  accounted(sim);
  if (i % 31 === 0) replica = roundTrip(sim);
}
assert.ok(sawGather && sawReturn && sawTravel);
assert.equal(sim.getState(site)!.output.wood, 4);
assert.equal(sim.summary().settlement.producedWood, 4);
assert.equal(woodworker(sim), undefined, 'A full site returns its resident to the pool');
assert.equal(sim.inspectMachine(site).staffing, 'Output full');
assert.equal(sim.summary().settlement.missedMeals, 0);
assert.equal(sim.world.identity().terrainChanges.length, 0);

const depot = { c: 17, r: 17 };
assert.equal(sim.place({ ...depot, kind: 'storage', direction: 0 }), null);
assert.equal(sim.setHaulTarget(site, depot), null);
until(sim, () => sim.getState(depot)!.input.wood >= 8);
assert.ok(sim.summary().settlement.producedWood > 4);
accounted(sim);
roundTrip(sim);

const uninterrupted = setup();
until(uninterrupted, () => !!woodworker(uninterrupted) && uninterrupted.getState(site)!.progress > 0);
const gathering = structuredClone(woodworker(uninterrupted)!.job);
const progress = uninterrupted.getState(site)!.progress;
assert.equal(uninterrupted.setWorkPriority(site, 'low'), null);
assert.deepEqual(woodworker(uninterrupted)!.job, gathering);
assert.equal(uninterrupted.getState(site)!.progress, progress);
until(uninterrupted, () => woodworker(uninterrupted)?.cargo === 'wood');
const worker = woodworker(uninterrupted)!;
const returning = structuredClone(worker.job);
assert.equal(uninterrupted.setWorkPriority(site, 'high'), null);
assert.deepEqual(worker.job, returning);
assert.equal(worker.cargo, 'wood');
assert.equal(uninterrupted.summary().recovered.wood, 0);
roundTrip(uninterrupted);
until(uninterrupted, () => uninterrupted.getState(site)!.output.wood > 0);
assert.equal(worker.cargo, null);
assert.notDeepEqual(worker.job, returning, 'Wood return completes before reassignment');
until(uninterrupted, () => woodworker(uninterrupted)?.cargo === 'wood');
uninterrupted.remove(site);
assert.equal(woodworker(uninterrupted), undefined);
assert.equal(uninterrupted.summary().recovered.wood, 2, 'Removal recovers output and carried wood');
accounted(uninterrupted);
roundTrip(uninterrupted);

const hauling = setup();
assert.equal(hauling.place({ ...depot, kind: 'storage', direction: 0 }), null);
until(hauling, () => woodworker(hauling)?.cargo === 'wood');
const haulingWorker = woodworker(hauling)!;
assert.equal(hauling.setHaulTarget(site, depot), null);
assert.equal(haulingWorker.cargo, 'wood');
assert.equal(haulingWorker.job?.kind, 'return-wood');
until(hauling, () => hauling.residents.some(resident => resident.job?.kind === 'deliver' && resident.cargo === 'wood'));
const carrier = hauling.residents.find(resident => resident.cargo === 'wood' && resident.job?.kind === 'deliver')!;
const cargoTrip = structuredClone(carrier.job);
assert.equal(hauling.setWorkPriority(site, 'low'), null);
assert.deepEqual(carrier.job, cargoTrip);
roundTrip(hauling);
hauling.remove(depot);
assert.ok(hauling.summary().recovered.wood > 0);
accounted(hauling);
roundTrip(hauling);

const conveyor = FactorySimulation.create();
const line = sites(conveyor).flatMap(source => DIRECTIONS.flatMap((vector, direction) => {
  const belt = { c: source.c + vector.c, r: source.r + vector.r };
  const storage = { c: source.c + vector.c * 2, r: source.r + vector.r * 2 };
  return conveyor.placementError(belt, 'belt') || conveyor.placementError(storage, 'storage')
    ? [] : [{ source, belt, storage, direction: direction as 0 | 1 | 2 | 3 }];
}))[0];
assert.ok(line);
assert.equal(conveyor.place({ ...line.source, kind: 'woodcutting-site', direction: line.direction }), null);
assert.equal(conveyor.place({ ...line.belt, kind: 'belt', direction: line.direction }), null);
assert.equal(conveyor.place({ ...line.storage, kind: 'storage', direction: 0 }), null);
until(conveyor, () => conveyor.getState(line.storage)!.input.wood >= 5);
assert.equal(conveyor.residents.some(resident => resident.job?.kind === 'collect' &&
  tileKey(resident.job.source) === tileKey(line.source)), false);
accounted(conveyor);
roundTrip(conveyor);

const overlap = setup();
const trees = gatheringAccess(site, overlap.buildings, overlap.world).map(access => tileKey(access.tree));
const otherSite = sites(overlap).find(candidate => gatheringAccess(candidate, overlap.buildings, overlap.world)
  .some(access => trees.includes(tileKey(access.tree))));
assert.ok(otherSite);
assert.equal(overlap.place({ ...otherSite, kind: 'woodcutting-site', direction: 0 }), null);
for (let i = 0; i < 900; i++) { overlap.step(); accounted(overlap); if (i % 43 === 0) roundTrip(overlap); }
assert.equal(overlap.getState(site)!.output.wood, 4);
assert.equal(overlap.getState(otherSite)!.output.wood, 4);

const blocked = setup();
until(blocked, () => woodworker(blocked)?.cargo === 'wood');
for (const vector of DIRECTIONS) {
  const tile = { c: site.c + vector.c, r: site.r + vector.r };
  if (!blocked.placementError(tile, 'belt')) assert.equal(blocked.place({ ...tile, kind: 'belt', direction: 0 }), null);
}
assert.equal(woodworker(blocked), undefined, 'Blocked work releases its resident');
assert.equal(blocked.summary().recovered.wood, 1);
advanceTicks(blocked, 20);
roundTrip(blocked);
accounted(blocked);
const opening = DIRECTIONS.map(vector => ({ c: site.c + vector.c, r: site.r + vector.r }))
  .find(tile => blocked.getState(tile)?.building.kind === 'belt');
assert.ok(opening);
blocked.remove(opening);
until(blocked, () => blocked.summary().settlement.producedWood > 1);
accounted(blocked);

const corrupt = setup();
until(corrupt, () => !!woodworker(corrupt) && corrupt.getState(site)!.progress > 0);
const valid = corrupt.serialize();
const workerId = woodworker(corrupt)!.id;
function invalid(change: (raw: typeof valid) => void): void {
  const raw = structuredClone(valid);
  change(raw);
  assert.throws(() => FactorySimulation.restore(raw), /Corrupt/);
}
invalid(raw => { raw.settlement.producedWood++; });
invalid(raw => { raw.settlement.residents[workerId].post = { c: 99, r: 99 }; });
invalid(raw => { raw.settlement.residents[workerId].cargo = 'wood'; });
invalid(raw => { raw.machines.find(machine => tileKey(machine.building) === tileKey(site))!.progress = GATHER_TICKS; });
invalid(raw => {
  const job = raw.settlement.residents[workerId].job;
  assert.ok(job?.kind === 'gather');
  job.tree = { c: 0, r: 0 };
});
invalid(raw => { raw.settlement.residents[workerId].job = null; });
invalid(raw => { raw.machines.find(machine => tileKey(machine.building) === tileKey(site))!.output.wood = 5; });
until(corrupt, () => woodworker(corrupt)?.cargo === 'wood');
const overreserved = corrupt.serialize();
overreserved.machines.find(machine => tileKey(machine.building) === tileKey(site))!.output.wood = 4;
overreserved.settlement.producedWood += 4;
assert.throws(() => FactorySimulation.restore(overreserved), /overreserved gathering output/);
assert.equal(gatheringAccess({ c: 12, r: 8 }, initial.buildings, initial.world).length, 0);
assert.match(initial.placementError({ c: 12, r: 8 }, 'woodcutting-site')!, /No accessible trees/);
assert.ok(containsBuilding('woodcutting-site', { x: 0, y: -28 }));
assert.equal(pickBuilding({ ...project(site.c, site.r), y: project(site.c, site.r).y - 28 }, setup().buildings)?.kind, 'woodcutting-site');
assertInvariants(sim);
console.log('Wood gathering checks passed: automatic staffing, physical trips, bounded slots, full/blocked release, shared trees, conveyors, priority-safe progress/cargo and deterministic saves.');
