import assert from 'node:assert/strict';
import { MINE_TICKS, Tile, tileKey } from '../src/games/factory/game/domain';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, assertResidentLocation, roundTrip } from './factory-check-helpers';

const plot = { c: 10, r: 9 };
const worker = (sim: FactorySimulation, tile: Tile) => sim.residents.find(resident => resident.post && tileKey(resident.post) === tileKey(tile));

// Search the starter clearing, which always holds reachable iron and copper.
function depositTile(sim: FactorySimulation, deposit: 'iron' | 'copper'): Tile {
  for (let r = 0; r <= 23; r++) for (let c = 0; c <= 23; c++) {
    const tile = { c, r };
    if (sim.world.at(tile).deposit === deposit && !sim.placementError(tile, 'mining-site')) return tile;
  }
  throw new Error(`No free ${deposit} deposit`);
}

// Placement shares the extractor's deposit rule.
const sim = FactorySimulation.create();
assert.equal(sim.placementError({ c: 12, r: 16 }, 'mining-site'), 'Mining sites need an ore deposit');
assert.equal(sim.placementError({ c: 7, r: 10 }, 'storage'), 'Leave deposits free for mining');
const mine = { c: 7, r: 10 };
assert.equal(sim.place({ ...mine, kind: 'mining-site', direction: 0 }), null);
assert.equal(sim.inspectMachine(mine).cycleTicks, MINE_TICKS);
assert.ok(worker(sim, mine), 'A mining site is staffed from the shared pool');

// A resident digs physical ore in place; it waits in the four-unit buffer for carriers.
const ledger = sim.summary().mined['iron-ore'];
let entered = false;
for (let tick = 0; tick < 2400 && sim.getState(mine)!.output['iron-ore'] < 4; tick++) {
  sim.step();
  entered ||= sim.residents.some(resident => resident.siteAccess && tileKey(resident.tile) === tileKey(mine));
  for (const resident of sim.residents) assertResidentLocation(sim, resident);
  if (tick % 200 === 0) roundTrip(sim);
}
assert.ok(entered, 'The miner works on the deposit tile');
assert.equal(sim.getState(mine)!.output['iron-ore'], 4);
assert.equal(sim.summary().mined['iron-ore'] - ledger, 4, 'Hand-dug ore enters the extraction ledger');
assert.equal(sim.status(mine), 'Mine full · waiting for transport');
assert.equal(sim.inspectMachine(mine).staffing, 'Output full');
advanceTicks(sim, 200);
assert.equal(sim.getState(mine)!.output['iron-ore'], 4, 'A full mine stops digging');

// Routing the ore lets residents carry it to a depot and mining resumes.
const depot = [{ c: 9, r: 12 }, { c: 9, r: 13 }, { c: 8, r: 13 }, { c: 10, r: 13 }].find(tile => !sim.placementError(tile, 'storage'))!;
assert.equal(sim.place({ ...depot, kind: 'storage', direction: 0 }), null);
assert.equal(sim.setHaulTarget(mine, depot), null);
assert.equal(sim.inspectResources().find(resource => resource.item === 'iron-ore')!.waiting > 0, true);
const stored = () => sim.getState(depot)!.input['iron-ore'];
for (let tick = 0; tick < 3000 && stored() < 6; tick++) sim.step();
assert.ok(stored() >= 6, 'Carried ore reaches the depot and the miner keeps digging');
const restored = roundTrip(sim);
assert.deepEqual(restored.serialize(), sim.serialize());

// Off frees the miner; a copper deposit yields copper ore.
assert.equal(sim.setWorkPriority(mine, 'off'), null);
assert.equal(worker(sim, mine), undefined);
assert.equal(sim.inspectMachine(mine).staffing, 'Off · no worker');
const copperSim = FactorySimulation.create();
copperSim.remove(plot);
const copper = depositTile(copperSim, 'copper');
assert.equal(copperSim.place({ ...copper, kind: 'mining-site', direction: 0 }), null);
for (let tick = 0; tick < 4000 && !copperSim.getState(copper)!.output['copper-ore']; tick++) copperSim.step();
assert.equal(copperSim.getState(copper)!.output['copper-ore'], 1);
assert.equal(copperSim.getState(copper)!.output['iron-ore'], 0);
roundTrip(copperSim);

// Removing an occupied mine recovers its ore without loss.
const removal = FactorySimulation.create();
assert.equal(removal.place({ ...mine, kind: 'mining-site', direction: 0 }), null);
while (removal.getState(mine)!.output['iron-ore'] < 2) removal.step();
const recovered = removal.summary().recovered['iron-ore'];
assert.equal(removal.remove(mine)['iron-ore'], 2);
assert.equal(removal.summary().recovered['iron-ore'] - recovered, 2);
roundTrip(removal);

console.log(`Mining checks passed: deposit placement, staffed hand mining at ${MINE_TICKS / 10}s per ore, ledgered output, full pause, hauling, Off, copper, removal recovery and exact saves.`);
