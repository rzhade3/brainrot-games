import assert from 'node:assert/strict';
import { FARM_TICKS, Tile, tileKey } from '../src/games/factory/game/domain';
import { residentName } from '../src/games/factory/game/settlement';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, roundTrip } from './factory-check-helpers';

const plot = { c: 10, r: 9 };
const holder = (sim: FactorySimulation, tile: Tile) => sim.residents.find(resident => resident.post && tileKey(resident.post) === tileKey(tile));
const labor = (sim: FactorySimulation) => sim.inspectMachine([...sim.buildings.values()].find(building => building.kind === 'home')!).labor!;
const waiting = (sim: FactorySimulation) => sim.inspectResources().find(resource => resource.item === 'iron-ore')!.waiting;
const posts = (sim: FactorySimulation) => sim.residents.map(resident => resident.post && tileKey(resident.post));

function plots(count: number) {
  const sim = FactorySimulation.create();
  sim.remove(plot);
  const tiles: Tile[] = [];
  for (let r = 8; r <= 20 && tiles.length < count; r += 3) {
    for (let c = 8; c <= 22 && tiles.length < count; c += 3) {
      const tile = { c, r };
      if (sim.placementError(tile, 'food-plot')) continue;
      assert.equal(sim.place({ ...tile, kind: 'food-plot', direction: 0 }), null);
      assert.equal(sim.setHaulTarget(tile, null), null);
      tiles.push(tile);
    }
  }
  assert.equal(tiles.length, count);
  return { sim, tiles };
}

// Two sites, four residents: both sites are staffed by their nearest residents and
// workers keep their site across many harvest cycles.
const stable = plots(2);
for (const tile of stable.tiles) assert.ok(holder(stable.sim, tile), 'Every site with a free resident is staffed');
assert.equal(stable.sim.residents.filter(resident => resident.post).length, 2);
const assigned = posts(stable.sim);
const farmed = new Map<number, Set<string>>();
for (let tick = 0; tick < 1500; tick++) {
  stable.sim.step();
  for (const resident of stable.sim.residents) if (resident.job?.kind === 'farm') {
    farmed.set(resident.id, (farmed.get(resident.id) ?? new Set()).add(tileKey(resident.job.source)));
  }
  if (tick % 250 === 0) roundTrip(stable.sim);
}
assert.deepEqual(posts(stable.sim), assigned, 'Posts persist through harvests, full buffers and saves');
for (const [id, sites] of farmed) assert.deepEqual([...sites], [assigned[id]], `${residentName(id)} only farms their own site`);
assert.equal(stable.sim.inspectMachine(stable.tiles[0]).staffing, 'Output full');

// Scarce labor: higher priority is staffed first, then stable tile order.
const scarce = plots(6);
const [first, second, , , fifth, last] = scarce.tiles;
assert.equal(scarce.sim.residents.filter(resident => resident.post).length, 4);
assert.equal(holder(scarce.sim, fifth), undefined);
assert.deepEqual(labor(scarce.sim), { posted: 4, hauling: 0, free: 0, openPosts: 2 }, 'The homestead reports one shared labor pool');
assert.match(scarce.sim.inspectMachine(last).staffing!, /No worker free/);
assert.equal(scarce.sim.setWorkPriority(last, 'high'), null);
assert.ok(holder(scarce.sim, last), 'Raising priority takes a worker from a lower priority site');
assert.equal(holder(scarce.sim, scarce.tiles[3]), undefined, 'The last Normal site in tile order gives up its worker');
assert.equal(scarce.sim.inspectMachine(last).staffing, `Worker: ${residentName(holder(scarce.sim, last)!.id)}`);
const before = posts(scarce.sim);
assert.equal(scarce.sim.setWorkPriority(fifth, 'high'), null);
assert.ok(holder(scarce.sim, fifth));
assert.equal(scarce.sim.setWorkPriority(first, 'low'), null);
assert.equal(scarce.sim.setWorkPriority(first, 'normal'), null);
assert.notDeepEqual(posts(scarce.sim), before);
const settled = posts(scarce.sim);
assert.equal(scarce.sim.setWorkPriority(second, 'normal'), null);
assert.deepEqual(posts(scarce.sim), settled, 'Equal priority never moves an existing worker');
const freed = holder(scarce.sim, second)!;
assert.equal(scarce.sim.setWorkPriority(second, 'off'), null);
assert.equal(holder(scarce.sim, second), undefined);
assert.equal(scarce.sim.inspectMachine(second).staffing, 'Off · no worker');
assert.ok(freed.post, 'Turning a site Off moves its worker to the next unstaffed site');
advanceTicks(scarce.sim, 600);
assert.equal(scarce.sim.residents.some(resident => resident.job?.kind === 'farm' && tileKey(resident.job.source) === tileKey(second)), false);
roundTrip(scarce.sim);

// Validation of priorities and posts.
const beforeInvalid = scarce.sim.serialize();
assert.equal(scarce.sim.setWorkPriority({ c: 11, r: 12 }, 'high') !== null, true);
assert.equal(scarce.sim.setWorkPriority({ c: 0, r: 0 }, 'low') !== null, true);
assert.notEqual(scarce.sim.setWorkPriority(first, 'urgent' as 'high'), null);
assert.deepEqual(scarce.sim.serialize(), beforeInvalid);
const invalidPriority = structuredClone(beforeInvalid);
Object.assign(invalidPriority.machines.find(machine => tileKey(machine.building) === tileKey(first))!.building, { workPriority: 'urgent' });
assert.throws(() => FactorySimulation.restore(invalidPriority), /invalid work priority/);
const duplicate = structuredClone(beforeInvalid);
duplicate.settlement.residents[1].post = duplicate.settlement.residents[0].post;
assert.throws(() => FactorySimulation.restore(duplicate), /invalid resident post/);
const wrongKind = structuredClone(beforeInvalid);
wrongKind.settlement.residents[0].post = { c: 11, r: 12 };
assert.throws(() => FactorySimulation.restore(wrongKind), /invalid resident post/);

// A priority change finishes the current harvest before anything else happens.
const farm = FactorySimulation.create();
while (!farm.residents.some(resident => resident.job?.kind === 'farm' && !resident.job.path.length &&
  farm.getState(plot)!.progress > 0)) farm.step();
const farmer = farm.residents.find(resident => resident.job?.kind === 'farm')!;
const current = structuredClone(farmer.job);
const progress = farm.getState(plot)!.progress;
const food = farm.summary().settlement.producedFood;
assert.equal(farm.setWorkPriority(plot, 'off'), null);
assert.equal(farmer.post, null);
assert.deepEqual(farmer.job, current);
assert.equal(farm.getState(plot)!.progress, progress);
advanceTicks(farm, FARM_TICKS - progress);
assert.ok(farm.summary().settlement.producedFood > food, 'A harvest in progress completes after the site is turned Off');
advanceTicks(farm, 5);
assert.equal(farm.residents.some(resident => resident.job?.kind === 'farm'), false);
roundTrip(farm);

// Hauling board: priority beats distance, and a filling Low buffer is not starved.
const queue = FactorySimulation.create();
queue.remove(plot);
const sink = { c: 17, r: 17 };
assert.equal(queue.place({ ...sink, kind: 'storage', direction: 0 }), null);
const sources: Tile[] = [];
for (let c = 8; c <= 22 && sources.length < 2; c += 2) {
  for (let r = 8; r <= 22 && sources.length < 2; r += 2) {
    const tile = { c, r };
    if (!queue.placementError(tile, 'storage')) {
      assert.equal(queue.place({ ...tile, kind: 'storage', direction: 0 }), null);
      sources.push(tile);
    }
  }
}
const [lowSource, highSource] = sources;
for (const source of sources) assert.equal(queue.setHaulTarget(source, sink), null);
assert.equal(queue.setWorkPriority(lowSource, 'low'), null);
assert.equal(queue.setWorkPriority(highSource, 'high'), null);
const stock = queue.serialize();
for (const [source, count] of [[lowSource, 64], [highSource, 40]] as const) {
  stock.machines.find(machine => tileKey(machine.building) === tileKey(source))!.input['iron-ore'] = count;
  stock.mined['iron-ore'] += count;
}
let board = FactorySimulation.restore(stock);
assert.equal(waiting(board), 104, 'Stock routed to a destination counts as waiting to be carried');
assert.match(board.inspectMachine(lowSource).staffing!, /^Waiting for a carrier · 64 /);
const offBoard = FactorySimulation.restore(stock);
assert.equal(offBoard.setWorkPriority(lowSource, 'off'), null);
assert.equal(waiting(offBoard), 40, 'Off routes are not waiting for a carrier');
board.step();
const pool = labor(board);
assert.equal(pool.posted + pool.hauling + pool.free, board.residents.length);
assert.equal(pool.hauling, board.residents.length);
assert.ok(waiting(board) < 104, 'Reserved loads are no longer waiting');
assert.ok(board.residents.every(resident => resident.job && tileKey(resident.job.source) === tileKey(highSource)),
  'High work is taken first');
let firstLow = 0;
for (let tick = 0; tick < 3000 && !firstLow; tick++) {
  board.step();
  if (board.residents.some(resident => resident.job && tileKey(resident.job.source) === tileKey(lowSource))) firstLow = board.ticks;
  if (tick % 37 === 0) board = roundTrip(board);
}
assert.ok(firstLow > 0, 'Low work is eventually hauled');
assert.ok(board.getState(highSource)!.input['iron-ore'] > 0, 'Low is served before High is completely drained');

// Free residents carry a site's output so its worker can keep producing.
const helped = FactorySimulation.create();
advanceTicks(helped, 1200);
const worker = holder(helped, plot)!;
assert.ok(helped.residents.some(resident => !resident.post && resident.job), 'Free residents haul');
assert.ok(worker.job === null || worker.job.kind === 'farm', 'The site worker is not sent to haul while others are free');

const extractor = FactorySimulation.create();
assert.equal(extractor.place({ c: 7, r: 10, kind: 'miner', direction: 0 }), null);
const automatedReplica = roundTrip(extractor);
extractor.setWorkPriority({ c: 7, r: 10 }, 'low');
automatedReplica.setWorkPriority({ c: 7, r: 10 }, 'high');
advanceTicks(extractor, 100);
advanceTicks(automatedReplica, 100);
assert.deepEqual(extractor.getState({ c: 7, r: 10 })!.output, automatedReplica.getState({ c: 7, r: 10 })!.output);
assert.equal(extractor.getState({ c: 7, r: 10 })!.progress, automatedReplica.getState({ c: 7, r: 10 })!.progress);
console.log(`Labor checks passed: stable site posts, priority staffing and Off, validated posts, safe harvest changes, priority hauling with Low served at tick ${firstLow}, free haulers, labor summary, waiting-to-carry counts and unchanged extraction.`);
