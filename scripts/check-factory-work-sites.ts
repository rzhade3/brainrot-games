import assert from 'node:assert/strict';
import { DIRECTIONS, Tile, tileKey } from '../src/games/factory/game/domain';
import { residentNextTile, residentWorkTile, Resident, WALK_TICKS } from '../src/games/factory/game/settlement';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, assertResidentLocation, roundTrip, unlockedFactory } from './factory-check-helpers';

const plot = { c: 10, r: 9 };
const kitchen = { c: 14, r: 12 };
const neighbors = (tile: Tile) => DIRECTIONS.map(vector => ({ c: tile.c + vector.c, r: tile.r + vector.r }));
const clear = (sim: FactorySimulation, tile: Tile) => sim.world.contains(tile) &&
  !sim.buildings.has(tileKey(tile)) && !['water', 'tree'].includes(sim.world.terrainAt(tile));
function until(sim: FactorySimulation, condition: () => boolean, limit = 2000): void {
  for (let tick = 0; tick < limit && !condition(); tick++) {
    sim.step();
    for (const resident of sim.residents) assertResidentLocation(sim, resident);
  }
  assert.ok(condition(), `Work-site condition not reached after ${limit} ticks`);
}
function replay(sim: FactorySimulation, count: number): void {
  const copy = roundTrip(sim);
  for (let tick = 0; tick < count; tick++) {
    sim.step();
    copy.step();
    assert.deepEqual(copy.serialize(), sim.serialize());
    for (const resident of sim.residents) assertResidentLocation(sim, resident);
  }
}
function farmer(sim: FactorySimulation): Resident | undefined {
  return sim.residents.find(resident => resident.job?.kind === 'farm');
}
function farm(): FactorySimulation {
  const sim = unlockedFactory();
  assert.equal(sim.setHaulTarget(plot, null), null);
  until(sim, () => sim.getState(plot)!.progress > 0);
  return sim;
}
function protectExit(sim: FactorySimulation, worker: Resident, exit: Tile): void {
  for (const tile of neighbors(worker.tile)) {
    if (!clear(sim, tile) || tileKey(tile) === tileKey(exit)) continue;
    assert.equal(sim.place({ ...tile, kind: 'belt', direction: 2 }), null);
  }
  const before = sim.serialize();
  assert.match(sim.place({ ...exit, kind: 'belt', direction: 2 })!, /clear exit/);
  assert.deepEqual(sim.serialize(), before, 'Rejected construction does not change work or navigation');
  assert.deepEqual(worker.siteAccess, exit);
  assertResidentLocation(sim, worker);
}

const inside = farm();
const resident = farmer(inside)!;
assert.deepEqual(resident.tile, plot);
assert.deepEqual(residentWorkTile(resident.job), plot);
assert.deepEqual(residentNextTile(resident), plot);
assert.deepEqual(resident.job!.path, []);
assert.equal(resident.travel, 0);
const progress = inside.getState(plot)!.progress;
const newExit = neighbors(plot).find(tile => clear(inside, tile) &&
  tileKey(tile) !== tileKey(resident.siteAccess!))!;
assert.ok(newExit);
protectExit(inside, resident, newExit);
assert.equal(inside.getState(plot)!.progress, progress, 'Building on the old access point does not interrupt farming');
assert.deepEqual(resident.tile, plot, 'The worker occupies the plot, not neighboring machine space');
const work = structuredClone(resident.job);
assert.equal(inside.setWorkPriority(plot, 'low'), null);
assert.deepEqual(resident.job, work, 'Priority changes finish the current harvest');
replay(inside, 1);
until(inside, () => inside.getState(plot)!.output['food-unit'] === 4);
assert.equal(resident.job, null);
assert.deepEqual(resident.exit, newExit, 'A full plot releases its farmer through the remaining exit');
replay(inside, WALK_TICKS);
assert.deepEqual(resident.tile, newExit);
assert.equal(resident.siteAccess, null);
assert.equal(resident.exit, null);
assert.equal(inside.place({ ...newExit, kind: 'belt', direction: 2 }) !== null, true, 'The departing worker still occupies floor');

const reassigned = farm();
const reassignedWorker = farmer(reassigned)!;
until(reassigned, () => reassigned.getState(plot)!.output['food-unit'] === 4);
assert.ok(reassignedWorker.exit);
assert.equal(reassigned.setHaulTarget(plot, kitchen), null);
reassigned.step();
const collector = reassigned.residents.find(resident => resident.job?.kind === 'collect')!;
assert.ok(collector && collector.id !== reassignedWorker.id, 'A free resident carries the full plot output');
assert.equal(reassignedWorker.job, null, 'The site worker stays posted instead of hauling');
assert.ok(reassignedWorker.post);
replay(reassigned, WALK_TICKS);
until(reassigned, () => reassignedWorker.siteAccess === null, 4 * WALK_TICKS);
until(reassigned, () => reassigned.summary().settlement.producedFood > 4);

const removed = farm();
const removedWorker = farmer(removed)!;
removed.remove(plot);
assert.equal(removedWorker.siteAccess, null, 'Removing a plot leaves its worker on newly clear land');
assert.equal(removedWorker.job, null);
assert.equal(removedWorker.exit, null);
assert.deepEqual(removedWorker.tile, plot);
replay(removed, WALK_TICKS);

const handoff = unlockedFactory();
let sawInterruptedExit = false;
for (let tick = 0; tick < 1400; tick++) {
  const departing = handoff.residents.filter(worker => worker.exit && worker.travel > 0).map(worker => worker.id);
  handoff.step();
  for (const worker of handoff.residents) {
    assertResidentLocation(handoff, worker);
    if (departing.includes(worker.id) && worker.job?.kind === 'farm' && !worker.job.path.length) {
      sawInterruptedExit = true;
      assert.equal(worker.travel, 0, 'Reassigning an in-site worker stops their partial exit animation');
      roundTrip(handoff);
    }
  }
}
assert.ok(sawInterruptedExit);

function woodSite(sim: FactorySimulation): Tile {
  const sites: Tile[] = [];
  for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) {
    if (!sim.placementError({ c, r }, 'woodcutting-site')) sites.push({ c, r });
  }
  sites.sort((a, b) => Math.abs(a.c - 12) + Math.abs(a.r - 12) -
    Math.abs(b.c - 12) - Math.abs(b.r - 12) || a.c - b.c || a.r - b.r);
  assert.ok(sites.length);
  return sites[0];
}
function grove() {
  const sim = unlockedFactory();
  const site = woodSite(sim);
  assert.equal(sim.place({ ...site, kind: 'woodcutting-site', direction: 0 }), null);
  until(sim, () => sim.getState(site)!.progress > 0);
  const worker = sim.residents.find(resident => resident.job?.kind === 'gather')!;
  assert.equal(worker.job?.kind, 'gather');
  if (worker.job?.kind !== 'gather') throw new Error('Expected a gathering worker');
  assert.deepEqual(worker.tile, worker.job.tree);
  assert.deepEqual(residentWorkTile(worker.job), worker.job.tree);
  assert.equal(sim.world.terrainAt(worker.tile), 'tree');
  assert.equal(worker.job.path.length, 0);
  assert.equal(worker.travel, 0);
  return { sim, site, worker };
}

const wood = grove();
protectExit(wood.sim, wood.worker, wood.worker.siteAccess!);
assert.equal(wood.worker.job?.kind, 'gather');
const gathering = structuredClone(wood.worker.job);
const woodProgress = wood.sim.getState(wood.site)!.progress;
assert.equal(wood.sim.setWorkPriority(wood.site, 'low'), null);
assert.deepEqual(wood.worker.job, gathering);
assert.equal(wood.sim.getState(wood.site)!.progress, woodProgress);
replay(wood.sim, 1);
until(wood.sim, () => wood.worker.job?.kind === 'return-wood');
assert.equal(wood.worker.cargo, 'wood');
assert.ok(wood.worker.siteAccess, 'The completed gather starts its return trip inside the tree');
assert.ok(wood.worker.job!.path.length > 0, 'Returning cargo includes a physical exit from the tree');
replay(wood.sim, WALK_TICKS);
assert.equal(wood.worker.siteAccess, null);
until(wood.sim, () => wood.sim.getState(wood.site)!.output.wood > 0);
assert.equal(wood.sim.summary().recovered.wood, 0);

for (const carrying of [false, true]) {
  const canceled = grove();
  if (carrying) until(canceled.sim, () => canceled.worker.job?.kind === 'return-wood');
  const tree = { ...canceled.worker.tile };
  assert.ok(canceled.worker.siteAccess);
  canceled.sim.remove(canceled.site);
  assert.equal(canceled.worker.job, null);
  assert.equal(canceled.worker.cargo, null);
  assert.ok(canceled.worker.exit, 'Removing the site preserves the woodcutter escape route');
  assert.equal(canceled.sim.summary().recovered.wood, carrying ? 1 : 0);
  replay(canceled.sim, WALK_TICKS + 1);
  assert.equal(canceled.worker.siteAccess, null);
  assert.notDeepEqual(canceled.worker.tile, tree);
}

const valid = farm().serialize();
const workingResident = valid.settlement.residents.find(worker => worker.job?.kind === 'farm')!;
function invalid(change: (worker: Resident) => void): void {
  const raw = structuredClone(valid);
  change(raw.settlement.residents[workingResident.id]);
  assert.throws(() => FactorySimulation.restore(raw), /Corrupt/);
}
invalid(worker => { worker.siteAccess = null; });
invalid(worker => { worker.siteAccess = { c: 11, r: 12 }; });
invalid(worker => { worker.exit = { ...worker.siteAccess! }; });
invalid(worker => { worker.travel = 1; });
invalid(worker => { worker.job!.path = [{ c: plot.c + 1, r: plot.r }]; });
invalid(worker => { worker.tile = { c: 11, r: 12 }; });
const escaped = roundTrip(removed);
advanceTicks(escaped, WALK_TICKS);

console.log('Work-site checks passed: shared farm/tree occupancy, free neighboring footprints, protected and reanchored exits, physical release/reassignment/removal, conserved cargo, stopped exit animation and exact validated replay.');
