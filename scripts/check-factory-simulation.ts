import assert from 'node:assert/strict';
import { Building, BuildingKind, createDemo, Direction, tileKey } from '../src/games/factory/model';
import {
  BELT_TICKS, BUFFER_CAPACITY, DEPOT_CAPACITY, EXTRACT_TICKS, FactorySimulation,
  inventory, itemCount, ITEMS,
} from '../src/games/factory/simulation';

function building(kind: BuildingKind, c: number, r: number, direction: Direction = 0): Building {
  return { kind, c, r, direction };
}

function factory(...buildings: Building[]): FactorySimulation {
  const simulation = new FactorySimulation();
  for (const value of buildings) assert.equal(simulation.place(value), null);
  return simulation;
}

function conserved(simulation: FactorySimulation): void {
  const snapshot = simulation.snapshot();
  const held = { ...snapshot.recovered };
  for (const state of snapshot.machines) {
    for (const items of [state.input, state.output]) {
      for (const item of ITEMS) {
        assert.ok(Number.isInteger(items[item]) && items[item] >= 0, `Invalid ${item} count at ${tileKey(state.building)}`);
        held[item] += items[item];
      }
    }
    if (state.item) held[state.item]++;
    assert.ok(itemCount(state.output) <= BUFFER_CAPACITY);
    assert.ok(itemCount(state.input) <= (state.building.kind === 'storage' ? DEPOT_CAPACITY : BUFFER_CAPACITY));
    if (state.building.kind === 'belt') {
      assert.ok(state.progress >= 0 && state.progress <= BELT_TICKS);
      if (!state.item) assert.equal(state.progress, 0);
    }
  }
  for (const material of ['iron', 'copper'] as const) {
    const ore = `${material}-ore` as const;
    const plate = `${material}-plate` as const;
    assert.equal(held[plate], snapshot.smelted[plate], `${material} plates lost or duplicated`);
    assert.equal(held[ore] + held[plate], snapshot.mined[ore], `${material} material not conserved`);
  }
}

function run(simulation: FactorySimulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    simulation.step();
    conserved(simulation);
  }
}

const demo = new FactorySimulation(createDemo());
run(demo, 300);
assert.ok(demo.summary().stored['iron-plate'] > 0, 'Complete iron production chain must deliver plates');
assert.ok(demo.summary().stored['copper-plate'] > 0, 'Existing copper study line must also deliver plates');
run(demo, 2700);
assert.equal(demo.summary().stored['iron-plate'], DEPOT_CAPACITY);
assert.equal(demo.summary().stored['copper-plate'], DEPOT_CAPACITY);
assert.equal(itemCount(demo.getState({ c: 7, r: 10 })!.output), BUFFER_CAPACITY, 'Backpressure must reach the miner');
assert.equal(demo.getState({ c: 7, r: 10 })!.running, false);
const saturated = demo.summary();
run(demo, 100);
assert.deepEqual(demo.summary().mined, saturated.mined, 'Full factories must not keep creating ore');
assert.deepEqual(demo.summary().smelted, saturated.smelted, 'Full outputs must stop smelting');

const contents = demo.remove({ c: 14, r: 12 });
assert.equal(contents['iron-plate'], DEPOT_CAPACITY);
conserved(demo);
assert.equal(demo.summary().recovered['iron-plate'], DEPOT_CAPACITY);
assert.equal(demo.place(building('storage', 14, 12, 1)), null);
run(demo, 200);
assert.ok(demo.summary().stored['iron-plate'] > 0, 'An empty replacement depot must restart the blocked line');

const loneMiner = factory(building('miner', 7, 10));
run(loneMiner, EXTRACT_TICKS);
assert.equal(loneMiner.getState({ c: 7, r: 10 })!.output['iron-ore'], 1);
run(loneMiner, EXTRACT_TICKS * 20);
assert.equal(loneMiner.summary().mined['iron-ore'], BUFFER_CAPACITY);
assert.equal(loneMiner.status({ c: 7, r: 10 }), 'Output disconnected');

const emptySmelter = factory(building('furnace', 12, 10));
run(emptySmelter, 100);
assert.equal(emptySmelter.status({ c: 12, r: 10 }), 'Waiting for ore');
assert.equal(emptySmelter.getState({ c: 12, r: 10 })!.progress, 0);

const noHops = factory(
  building('miner', 7, 10), building('belt', 8, 10), building('belt', 9, 10), building('storage', 10, 10),
);
run(noHops, EXTRACT_TICKS);
assert.equal(noHops.getState({ c: 8, r: 10 })!.item, 'iron-ore');
assert.equal(noHops.getState({ c: 8, r: 10 })!.progress, 0);
assert.equal(noHops.getState({ c: 9, r: 10 })!.item, null, 'Fresh items must not traverse several tiles in one tick');
run(noHops, BELT_TICKS);
assert.equal(noHops.getState({ c: 9, r: 10 })!.item, 'iron-ore');
assert.equal(itemCount(noHops.getState({ c: 10, r: 10 })!.input), 0);

const turned = factory(
  building('miner', 7, 10), building('belt', 8, 10),
  building('belt', 9, 10, 1), building('storage', 9, 11),
);
run(turned, 100);
assert.ok(turned.summary().stored['iron-ore'] > 0);
assert.equal(turned.getState({ c: 9, r: 10 })!.enteredFrom, 0, 'Turns must retain their actual incoming direction');

const opposing = factory(building('miner', 7, 10), building('belt', 8, 10, 2), building('storage', 9, 10));
run(opposing, 100);
assert.equal(opposing.getState({ c: 8, r: 10 })!.item, null, 'Opposing conveyors cannot receive through their front');
assert.equal(opposing.status({ c: 7, r: 10 }), 'Output incompatible');
opposing.rotate({ c: 8, r: 10 });
opposing.rotate({ c: 8, r: 10 });
run(opposing, 100);
assert.ok(opposing.summary().stored['iron-ore'] > 0, 'Rotating a disconnected line must restore flow');

const midRotation = factory(
  building('miner', 7, 10), building('belt', 8, 10), building('belt', 8, 11), building('storage', 9, 11),
);
run(midRotation, EXTRACT_TICKS + 3);
const rotatingItem = midRotation.getState({ c: 8, r: 10 })!.item;
const rotatingProgress = midRotation.getState({ c: 8, r: 10 })!.progress;
midRotation.rotate({ c: 8, r: 10 });
assert.equal(midRotation.getState({ c: 8, r: 10 })!.item, rotatingItem);
assert.equal(midRotation.getState({ c: 8, r: 10 })!.progress, rotatingProgress);
run(midRotation, 100);
assert.ok(midRotation.summary().stored['iron-ore'] > 0);

const inFlight = factory(building('miner', 7, 10), building('belt', 8, 10));
run(inFlight, EXTRACT_TICKS + 2);
assert.equal(inFlight.remove({ c: 8, r: 10 })['iron-ore'], 1, 'Dismantling a conveyor must recover its traveling item');
conserved(inFlight);

const midRecipe = new FactorySimulation(createDemo());
for (let i = 0; i < 200 && midRecipe.getState({ c: 12, r: 10 })!.progress !== 5; i++) midRecipe.step();
assert.equal(midRecipe.getState({ c: 12, r: 10 })!.progress, 5);
const smelterContents = midRecipe.remove({ c: 12, r: 10 });
assert.ok(itemCount(smelterContents) > 0, 'In-process recipe ore must be recovered, not lost');
conserved(midRecipe);
assert.equal(midRecipe.place(building('furnace', 12, 10)), null);
run(midRecipe, 150);
assert.ok(midRecipe.summary().stored['iron-plate'] > 0);

const mergerBuildings = [
  building('miner', 6, 10), building('miner', 7, 9, 1), building('belt', 7, 10),
  building('belt', 8, 10), building('furnace', 9, 10), building('storage', 10, 10),
];
const merge = factory(...mergerBuildings);
const reverseMerge = factory(...[...mergerBuildings].reverse());
let westSent = 0;
let northSent = 0;
for (let tick = 0; tick < 600; tick++) {
  const sent = (tile: { c: number; r: number }) => {
    const state = merge.getState(tile)!;
    return { count: itemCount(state.output), produces: state.progress === EXTRACT_TICKS - 1 && itemCount(state.output) < BUFFER_CAPACITY };
  };
  const west = sent({ c: 6, r: 10 });
  const north = sent({ c: 7, r: 9 });
  merge.step();
  reverseMerge.step();
  westSent += west.count + Number(west.produces) - itemCount(merge.getState({ c: 6, r: 10 })!.output);
  northSent += north.count + Number(north.produces) - itemCount(merge.getState({ c: 7, r: 9 })!.output);
  conserved(merge);
  assert.deepEqual(merge.snapshot(), reverseMerge.snapshot(), 'Construction order must not change the simulation');
}
assert.ok(westSent > 10 && northSent > 10);
assert.ok(Math.abs(westSent - northSent) <= 2, 'Round-robin mergers must not starve an input');

merge.rotate({ c: 7, r: 10 });
reverseMerge.rotate({ c: 7, r: 10 });
assert.deepEqual(merge.remove({ c: 8, r: 10 }), reverseMerge.remove({ c: 8, r: 10 }));
assert.equal(merge.place(building('belt', 8, 10)), null);
assert.equal(reverseMerge.place(building('belt', 8, 10)), null);
run(merge, 50);
run(reverseMerge, 50);
assert.deepEqual(merge.snapshot(), reverseMerge.snapshot());

const loop = factory(
  building('miner', 7, 10), building('belt', 8, 10, 1), building('belt', 8, 11),
  building('belt', 9, 11, 1), building('belt', 9, 12, 2), building('belt', 8, 12, 3),
);
run(loop, 300);

const inputMerger = factory(
  building('miner', 8, 9), building('miner', 7, 10), building('belt', 8, 10),
  building('belt', 9, 10, 3), building('furnace', 9, 9), building('storage', 10, 9),
);
run(inputMerger, 400);
assert.ok(inputMerger.summary().stored['iron-plate'] > 0, 'Multiple adjacent outputs must share a bounded smelter input');

const mixedOre = factory(
  building('miner', 8, 11), building('belt', 9, 11, 1),
  building('miner', 9, 13, 3), building('furnace', 9, 12), building('storage', 10, 12),
);
run(mixedOre, 300);
assert.ok(mixedOre.summary().stored['iron-plate'] >= 5);
assert.ok(mixedOre.summary().stored['copper-plate'] >= 5, 'Mixed-ore smelting must not starve one material');

const incompatible = factory(
  building('miner', 7, 10), building('belt', 8, 10), building('furnace', 9, 10),
  building('belt', 10, 10), building('furnace', 11, 10),
);
run(incompatible, 300);
assert.equal(itemCount(incompatible.getState({ c: 11, r: 10 })!.input), 0, 'Smelters must reject plates');
assert.equal(incompatible.status({ c: 10, r: 10 }), 'Output incompatible');

const sixtyFps = new FactorySimulation(createDemo());
const thirtyFps = new FactorySimulation(createDemo());
for (let i = 0; i < 120; i++) sixtyFps.advance(1000 / 60);
for (let i = 0; i < 60; i++) thirtyFps.advance(1000 / 30);
assert.equal(sixtyFps.ticks, 20);
assert.deepEqual(sixtyFps.snapshot(), thirtyFps.snapshot(), 'Frame rate must not alter production');
const clock = new FactorySimulation();
clock.advance(90);
clock.resetClock();
clock.advance(10);
assert.equal(clock.ticks, 0, 'Pause/suspension must discard partial elapsed time');
clock.advance(90);
assert.equal(clock.ticks, 1);
clock.advance(10000);
assert.equal(clock.ticks, 3, 'Long suspension gaps must not fast-forward the factory');
assert.throws(() => clock.advance(-1), /nonnegative/);
assert.throws(() => clock.advance(Number.NaN), /finite/);
assert.deepEqual(inventory(), { 'iron-ore': 0, 'copper-ore': 0, 'iron-plate': 0, 'copper-plate': 0, 'defense-supply': 0 });
assert.match(opposing.place(building('belt', 8, 10))!, /occupied/);
assert.match(opposing.place(building('belt', 8.5, 10))!, /Outside/);
assert.throws(() => opposing.remove({ c: 0, r: 0 }), /missing/);
console.log('Factory simulation checks passed: complete chains, bounded buffers, congestion, deterministic/fair transfers, conservation, turns, recovery, reconnection, and fixed-step timing.');
