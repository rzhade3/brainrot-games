import assert from 'node:assert/strict';
import { BuildableKind, HOUSE_WOOD_COST, Item, Tile } from '../src/games/factory/game/domain';
import { ORE_FOR_SMELTER, PLATES_FOR_EXTRACTOR } from '../src/games/factory/game/discovery';
import { FactorySimulation, STARTING_KINDS } from '../src/games/factory/game/simulation';
import { roundTrip } from './factory-check-helpers';

const known = (sim: FactorySimulation) => sim.inspectResources().filter(resource => resource.discovered).map(resource => resource.item);
const near = (sim: FactorySimulation, kind: BuildableKind, from: Tile): Tile => {
  const tiles: Tile[] = [];
  for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) if (!sim.placementError({ c, r }, kind)) tiles.push({ c, r });
  tiles.sort((a, b) => Math.abs(a.c - from.c) + Math.abs(a.r - from.r) - Math.abs(b.c - from.c) - Math.abs(b.r - from.r) ||
    a.c - b.c || a.r - b.r);
  assert.ok(tiles.length, `Room for ${kind}`);
  return tiles[0];
};
const runUntil = (sim: FactorySimulation, done: () => boolean, limit: number, message: string) => {
  for (let tick = 0; tick < limit && !done(); tick++) sim.step();
  assert.ok(done(), message);
};
const mined = (sim: FactorySimulation) => Object.values(sim.summary().mined).reduce((sum, value) => sum + value, 0);

// A new settlement knows only its starting buildings and resources.
const sim = FactorySimulation.create();
assert.deepEqual(new Set(sim.inspectDiscoveries().discovered), new Set(STARTING_KINDS));
assert.deepEqual(sim.inspectDiscoveries().next, { kinds: ['mining-site'], condition: 'Finish a house', current: 0, required: 1 });
assert.match(sim.placementError({ c: 7, r: 10 }, 'mining-site')!, /not discovered/);
assert.match(sim.placementError({ c: 12, r: 12 }, 'belt')!, /not discovered/);
assert.equal(sim.isDiscovered('mining-site'), false);
assert.deepEqual(known(sim), ['food-unit', 'wood'] satisfies Item[]);
assert.deepEqual(sim.takeDiscoveries(), []);

// Finishing the first house reveals mining.
const house = { c: 16, r: 12 };
assert.equal(sim.place({ ...house, kind: 'house', direction: 0 }), null);
const wood = near(sim, 'woodcutting-site', house);
assert.equal(sim.place({ ...wood, kind: 'woodcutting-site', direction: 0 }), null);
assert.equal(sim.setHaulTarget(wood, house), null);
runUntil(sim, () => sim.getState(house)!.input.wood >= HOUSE_WOOD_COST, 6000, 'The house is finished');
assert.ok(sim.isDiscovered('mining-site'));
assert.deepEqual(sim.takeDiscoveries(), ['mining-site']);
assert.deepEqual(sim.takeDiscoveries(), [], 'Each discovery is announced once');
assert.deepEqual(known(sim), ['iron-ore', 'copper-ore', 'food-unit', 'wood'] satisfies Item[]);
assert.deepEqual(sim.inspectDiscoveries().next, { kinds: ['furnace'], condition: 'Dig ore by hand', current: 0, required: ORE_FOR_SMELTER });
const afterHouse = roundTrip(sim);
assert.ok(afterHouse.isDiscovered('mining-site'), 'Discoveries are saved');
assert.deepEqual(afterHouse.takeDiscoveries(), [], 'Loading does not repeat announcements');

// Losing the house keeps what was learned.
const lost = FactorySimulation.restore(sim.serialize());
lost.remove(house);
lost.step();
assert.ok(lost.isDiscovered('mining-site'), 'Discoveries are permanent');

// Hand-dug ore reveals the smelter.
let mine: Tile | null = null;
for (let r = 0; r <= 23 && !mine; r++) for (let c = 0; c <= 23 && !mine; c++) {
  if (sim.world.at({ c, r }).deposit === 'iron' && !sim.placementError({ c, r }, 'mining-site')) mine = { c, r };
}
assert.ok(mine);
assert.equal(sim.place({ ...mine, kind: 'mining-site', direction: 0 }), null);
const depot = near(sim, 'storage', mine);
assert.equal(sim.place({ ...depot, kind: 'storage', direction: 0 }), null);
assert.equal(sim.setHaulTarget(mine, depot), null);
const start = mined(sim);
runUntil(sim, () => sim.isDiscovered('furnace'), 12000, 'Digging ore reveals the smelter');
assert.equal(mined(sim) - start, ORE_FOR_SMELTER, 'The smelter appears at the threshold');
assert.deepEqual(sim.takeDiscoveries(), ['furnace']);
assert.ok(known(sim).includes('iron-plate') && known(sim).includes('copper-plate'));
assert.equal(sim.inspectDiscoveries().next?.condition, 'Smelt a plate');

// Smelting reveals conveyors, then the extractor.
const furnace = near(sim, 'furnace', mine);
assert.equal(sim.place({ ...furnace, kind: 'furnace', direction: 0 }), null);
assert.equal(sim.setHaulTarget(mine, furnace), null);
assert.equal(sim.setHaulTarget(furnace, depot), null);
runUntil(sim, () => sim.isDiscovered('belt'), 12000, 'The first plate reveals conveyors');
assert.deepEqual(sim.takeDiscoveries(), ['belt', 'splitter']);
assert.equal(sim.inspectDiscoveries().next?.condition, 'Smelt plates');
roundTrip(sim);
runUntil(sim, () => sim.isDiscovered('miner'), 60000, 'Smelted plates reveal the extractor');
assert.equal(Object.values(sim.summary().smelted).reduce((sum, value) => sum + value, 0), PLATES_FOR_EXTRACTOR);
assert.deepEqual(sim.takeDiscoveries(), ['miner']);
assert.equal(sim.inspectDiscoveries().next, null, 'The settlement chain is complete');
assert.equal(sim.isDiscovered('assembler'), false, 'Assemblers stay hidden without a settlement use');
assert.equal(known(sim).includes('defense-supply'), false);
roundTrip(sim);

// Older saves infer discoveries from their buildings and recorded work.
const legacy = FactorySimulation.create().serialize();
delete (legacy as Partial<typeof legacy>).discovered;
const inferredSim = FactorySimulation.restore(legacy);
assert.deepEqual(new Set(inferredSim.inspectDiscoveries().discovered), new Set(STARTING_KINDS));
const worked = sim.serialize();
delete (worked as Partial<typeof worked>).discovered;
const inferred = FactorySimulation.restore(worked);
for (const kind of ['mining-site', 'furnace', 'belt', 'splitter', 'miner'] as const) assert.ok(inferred.isDiscovered(kind), kind);
assert.equal(inferred.isDiscovered('assembler'), false);
assert.deepEqual(inferred.takeDiscoveries(), []);

// Invalid discovery lists are rejected.
const invalid = (patch: (save: ReturnType<FactorySimulation['serialize']>) => void, message: RegExp) => {
  const save = FactorySimulation.create().serialize();
  patch(save);
  assert.throws(() => FactorySimulation.restore(save), message);
};
invalid(save => { (save.discovered as string[]).push('rocket'); }, /invalid discoveries/);
invalid(save => { save.discovered.push('house'); }, /invalid discoveries/);
invalid(save => { (save as { discovered: unknown }).discovered = 'all'; }, /invalid discoveries/);
invalid(save => { save.discovered = save.discovered.filter(kind => kind !== 'kitchen'); }, /missing starting/);
invalid(save => { save.discovered.push('home' as BuildableKind); }, /invalid discoveries/);
const unearned = sim.serialize();
unearned.discovered = unearned.discovered.filter(kind => kind !== 'furnace');
assert.throws(() => FactorySimulation.restore(unearned), /undiscovered building/);

console.log('Factory discovery checks passed: starting buildings, house -> mining, ore -> smelter, plate -> conveyors, plates -> extractor, one-time announcements, permanence, saving, legacy inference and validation.');
