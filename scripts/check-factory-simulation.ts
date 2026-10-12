import assert from 'node:assert/strict';
import { commitRoute, planRoute, undoRoute } from '../src/games/factory/game/beltRoute';
import {
  acceptsInventoryItem, ASSEMBLER_RECIPE, hasRecipeInputs, inputCapacity, inputSlots, outputCapacity,
  producesInventoryItem, SMELTER_RECIPES,
} from '../src/games/factory/game/machines';
import { Building, BuildingKind, Direction, DIRECTIONS, isConveyor, outputDirections, Tile, tileKey } from '../src/games/factory/game/model';
import {
  BELT_TICKS, BUFFER_CAPACITY, DEPOT_CAPACITY, EXTRACT_TICKS, FactorySimulation,
  inventory, itemCount, ITEMS,
} from '../src/games/factory/game/simulation';
import { createDemo, emptyFactory, factoryFrom } from './factory-check-helpers';

function building(kind: BuildingKind, c: number, r: number, direction: Direction = 0): Building {
  return { kind, c, r, direction };
}

function factory(...buildings: Building[]): FactorySimulation {
  const simulation = emptyFactory();
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
    if (isConveyor(state.building.kind)) {
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

function readyCargo(simulation: FactorySimulation, ...tiles: Tile[]): FactorySimulation {
  const save = simulation.serialize();
  for (const tile of tiles) {
    const machine = save.machines.find(value => tileKey(value.building) === tileKey(tile));
    assert.ok(machine && isConveyor(machine.building.kind) && !machine.item);
    machine.item = 'iron-ore';
    machine.progress = BELT_TICKS;
    save.mined['iron-ore']++;
  }
  return FactorySimulation.restore(save);
}

const machineRules: Record<BuildingKind, { input: number; output: number; items: readonly string[] }> = {
  belt: { input: 0, output: 0, items: [] },
  splitter: { input: 0, output: 0, items: [] },
  miner: { input: 0, output: 4, items: [] },
  furnace: { input: 4, output: 4, items: ['iron-ore', 'copper-ore'] },
  storage: { input: 64, output: 0, items: ITEMS },
  assembler: { input: 8, output: 4, items: ['iron-plate', 'copper-plate'] },
  home: { input: 0, output: 0, items: [] },
  'food-plot': { input: 0, output: 4, items: [] },
  kitchen: { input: 16, output: 0, items: ['food-unit'] },
  'woodcutting-site': { input: 0, output: 4, items: [] },
};
for (const kind of Object.keys(machineRules) as BuildingKind[]) {
  const expected = machineRules[kind];
  assert.equal(inputCapacity(kind), expected.input, `${kind} input capacity`);
  assert.equal(outputCapacity(kind), expected.output, `${kind} output capacity`);
  for (const item of ITEMS) {
    assert.equal(acceptsInventoryItem(kind, item), expected.items.includes(item), `${kind} accepts ${item}`);
    assert.equal(inputCapacity(kind, item), expected.items.includes(item) ? kind === 'assembler' ? 4 : expected.input : 0);
  }
}
for (const item of ITEMS) {
  assert.equal(producesInventoryItem('miner', item, 'iron'), item === 'iron-ore');
  assert.equal(producesInventoryItem('miner', item, 'copper'), item === 'copper-ore');
  assert.equal(producesInventoryItem('furnace', item, null), item === 'iron-plate' || item === 'copper-plate');
  assert.equal(producesInventoryItem('assembler', item, null), item === 'defense-supply');
  assert.equal(producesInventoryItem('food-plot', item, null), item === 'food-unit');
  assert.equal(producesInventoryItem('woodcutting-site', item, null), item === 'wood');
}
assert.deepEqual(SMELTER_RECIPES['iron-ore'], {
  inputs: [{ item: 'iron-ore', quantity: 1 }], output: { item: 'iron-plate', quantity: 1 }, ticks: 16,
});
assert.deepEqual(SMELTER_RECIPES['copper-ore'], {
  inputs: [{ item: 'copper-ore', quantity: 1 }], output: { item: 'copper-plate', quantity: 1 }, ticks: 16,
});
assert.deepEqual(ASSEMBLER_RECIPE, {
  inputs: [{ item: 'iron-plate', quantity: 2 }, { item: 'copper-plate', quantity: 1 }],
  output: { item: 'defense-supply', quantity: 1 }, ticks: 20,
});
assert.equal(hasRecipeInputs({ ...inventory(), 'iron-plate': 2 }, ASSEMBLER_RECIPE), false);
assert.equal(hasRecipeInputs({ ...inventory(), 'iron-plate': 2, 'copper-plate': 1 }, ASSEMBLER_RECIPE), true);
const ingredientFactory = factory(building('assembler', 12, 12));
const ingredients = { ...ingredientFactory.getState({ c: 12, r: 12 })!,
  input: { ...inventory(), 'iron-plate': 4, 'copper-plate': 1 } };
assert.equal(inputSlots(ingredients), 3);
assert.equal(inputSlots(ingredients, 'iron-plate'), 0);
assert.equal(inputSlots(ingredients, 'copper-plate', 2), 1, 'Reservations use the requested ingredient buffer');
assert.equal(inputSlots(ingredients, 'iron-ore'), 0);
const assemblyInspection = ingredientFactory.inspectMachine({ c: 12, r: 12 });
assert.equal(assemblyInspection.inputCapacity, 8);
assert.equal(assemblyInspection.outputCapacity, 4);
assert.equal(assemblyInspection.availableInput, 8);
assert.deepEqual(assemblyInspection.recipe, ASSEMBLER_RECIPE);
assert.equal(assemblyInspection.cycleTicks, 20);
assert.equal(assemblyInspection.status, 'Needs 2 iron + 1 copper plate');
assert.throws(() => ingredientFactory.inspectMachine({ c: 0, r: 0 }), /missing/);

const demo = factoryFrom(createDemo());
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

const midRecipe = factoryFrom(createDemo());
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

const sixtyFps = factoryFrom(createDemo());
const thirtyFps = factoryFrom(createDemo());
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
assert.deepEqual(inventory(), { 'iron-ore': 0, 'copper-ore': 0, 'iron-plate': 0, 'copper-plate': 0, 'defense-supply': 0, 'food-unit': 0, wood: 0 });
assert.match(opposing.place(building('belt', 8, 10))!, /occupied/);
assert.match(opposing.place(building('belt', 8.5, 10))!, /Outside/);
assert.throws(() => opposing.remove({ c: 0, r: 0 }), /missing/);

const splitterLine = [
  building('miner', 7, 10), building('belt', 8, 10), building('splitter', 9, 10),
  building('storage', 10, 10), building('storage', 9, 11),
];
const split = factory(...splitterLine);
const reverseSplit = factory(...[...splitterLine].reverse());
run(split, EXTRACT_TICKS + BELT_TICKS);
run(reverseSplit, EXTRACT_TICKS + BELT_TICKS);
assert.equal(split.getState({ c: 9, r: 10 })!.item, 'iron-ore');
assert.equal(split.getState({ c: 9, r: 10 })!.progress, 0);
assert.equal(itemCount(split.summary().stored), 0, 'Fresh cargo cannot hop through a splitter');
run(split, BELT_TICKS);
run(reverseSplit, BELT_TICKS);
assert.equal(split.getState({ c: 10, r: 10 })!.input['iron-ore'], 1);
assert.equal(split.getState({ c: 9, r: 10 })!.nextOutput, 1, 'First successful delivery prefers the right branch next');
for (let tick = 0; tick < 500; tick++) {
  split.step();
  reverseSplit.step();
  conserved(split);
  assert.deepEqual(split.snapshot(), reverseSplit.snapshot(), 'Splitter routing cannot depend on construction order');
  const straight = split.getState({ c: 10, r: 10 })!.input['iron-ore'];
  const right = split.getState({ c: 9, r: 11 })!.input['iron-ore'];
  assert.ok(Math.abs(straight - right) <= 1, 'Unblocked splitter must alternate successful deliveries');
}
assert.ok(split.getState({ c: 9, r: 11 })!.input['iron-ore'] > 20);

const congestedSplit = factory(...splitterLine.filter(value => value.r !== 11));
run(congestedSplit, 1000);
assert.equal(congestedSplit.getState({ c: 10, r: 10 })!.input['iron-ore'], DEPOT_CAPACITY);
assert.match(congestedSplit.status({ c: 9, r: 10 }), /Both outputs blocked/);
const beforeBlocked = congestedSplit.serialize();
run(congestedSplit, 100);
assert.deepEqual(congestedSplit.summary().mined, beforeBlocked.mined, 'Blocked splitter must propagate backpressure');
assert.equal(congestedSplit.getState({ c: 9, r: 10 })!.nextOutput, beforeBlocked.machines.find(value => value.building.kind === 'splitter')!.nextOutput,
  'Blocked attempts must not change routing preference');
assert.equal(congestedSplit.place(building('storage', 9, 11)), null);
run(congestedSplit, 500);
assert.ok(congestedSplit.getState({ c: 9, r: 11 })!.input['iron-ore'] > 40, 'Full straight output must not block the right output');
assert.equal(congestedSplit.getState({ c: 10, r: 10 })!.input['iron-ore'], DEPOT_CAPACITY);

const incompatibleSplit = factory(
  building('miner', 7, 10), building('belt', 8, 10), building('furnace', 9, 10),
  building('splitter', 10, 10), building('furnace', 11, 10), building('storage', 10, 11),
);
run(incompatibleSplit, 400);
assert.ok(incompatibleSplit.summary().stored['iron-plate'] > 10, 'Incompatible straight output must use the right branch');
assert.equal(itemCount(incompatibleSplit.getState({ c: 11, r: 10 })!.input), 0);

for (const direction of [0, 1, 2, 3] as const) {
  const router = building('splitter', 18, 18, direction);
  for (const incoming of [0, 1, 2, 3] as const) {
    const vector = DIRECTIONS[incoming];
    const sender = building('belt', router.c - vector.c, router.r - vector.r, incoming);
    const input = readyCargo(factory(router, sender), sender);
    run(input, 1);
    assert.equal(input.getState(router)!.item, incoming === direction ? 'iron-ore' : null, 'Splitter accepts only its rear port');
    assert.equal(input.getState(sender)!.item, incoming === direction ? null : 'iron-ore');
  }
  const exits = outputDirections(router).map(output => {
    const vector = DIRECTIONS[output];
    return building('belt', router.c + vector.c, router.r + vector.r, output);
  });
  let rotated = readyCargo(factory(router, ...exits), router);
  run(rotated, 1);
  assert.equal(rotated.getState(exits[0])!.item, 'iron-ore');
  assert.equal(rotated.getState(exits[0])!.enteredFrom, direction);
  assert.equal(rotated.getState(exits[1])!.item, null);
  rotated = readyCargo(rotated, router);
  run(rotated, 1);
  assert.equal(rotated.getState(exits[1])!.item, 'iron-ore');
  assert.equal(rotated.getState(exits[1])!.enteredFrom, exits[1].direction, 'Side output records its actual transfer direction');
  assert.equal(rotated.getState(router)!.nextOutput, 0);
}

const contentionBuildings = [
  building('splitter', 11, 10, 2), building('belt', 10, 11, 3),
  building('belt', 10, 10, 3), building('storage', 11, 9), building('storage', 10, 9),
];
const contested = readyCargo(factory(...contentionBuildings), { c: 11, r: 10 }, { c: 10, r: 11 });
const reversedContested = readyCargo(factory(...[...contentionBuildings].reverse()), { c: 11, r: 10 }, { c: 10, r: 11 });
run(contested, 1);
run(reversedContested, 1);
assert.equal(contested.getState({ c: 10, r: 10 })!.item, 'iron-ore');
assert.equal(contested.getState({ c: 11, r: 9 })!.input['iron-ore'], 1, 'Lost preferred-slot arbitration must fall back in the same tick');
assert.equal(contested.getState({ c: 11, r: 10 })!.nextOutput, 0, 'Alternate delivery prefers the straight branch next');
assert.equal(itemCount(contested.getState({ c: 10, r: 9 })!.input), 0, 'New cargo must not hop after arbitration');
assert.deepEqual(contested.serialize(), reversedContested.serialize());

const fallbackBuildings = [
  building('splitter', 10, 10), building('splitter', 11, 11, 1),
  building('belt', 10, 11, 1), building('storage', 10, 12),
];
const competingFallbacks = readyCargo(factory(...fallbackBuildings), { c: 10, r: 10 }, { c: 11, r: 11 });
run(competingFallbacks, 1);
assert.equal(competingFallbacks.getState({ c: 10, r: 10 })!.item, null);
assert.equal(competingFallbacks.getState({ c: 11, r: 11 })!.item, 'iron-ore', 'Two fallbacks cannot reserve the same cargo slot');
assert.equal(competingFallbacks.getState({ c: 11, r: 11 })!.nextOutput, 0);
assert.equal(itemCount(competingFallbacks.summary().stored), 0);
run(competingFallbacks, BELT_TICKS + 1);
assert.equal(competingFallbacks.getState({ c: 11, r: 11 })!.item, null, 'The waiting fallback resumes after the slot is emptied');

const reservationBase = readyCargo(factory(
  building('splitter', 10, 10), building('belt', 11, 11, 2), building('storage', 10, 11),
), { c: 10, r: 10 }, { c: 11, r: 11 }).serialize();
reservationBase.machines.find(value => value.building.kind === 'storage')!.input['iron-ore'] = DEPOT_CAPACITY - 1;
reservationBase.mined['iron-ore'] += DEPOT_CAPACITY - 1;
const reservedFallback = FactorySimulation.restore(reservationBase);
run(reservedFallback, 1);
assert.equal(reservedFallback.summary().stored['iron-ore'], DEPOT_CAPACITY);
assert.equal(reservedFallback.getState({ c: 10, r: 10 })!.item, 'iron-ore', 'Fallback respects a depot slot reserved by a primary transfer');

const splitRotation = readyCargo(factory(building('splitter', 12, 12), building('storage', 12, 13)), { c: 12, r: 12 });
const splitBefore = splitRotation.getState({ c: 12, r: 12 })!;
assert.equal(splitRotation.rotate(splitBefore.building), 1);
assert.equal(splitBefore.item, 'iron-ore');
assert.equal(splitBefore.progress, BELT_TICKS);
assert.equal(splitBefore.nextOutput, 0);
run(splitRotation, 1);
assert.equal(splitRotation.summary().stored['iron-ore'], 1, 'Rotation uses the new output ports without losing cargo');
const splitRecovery = readyCargo(factory(building('splitter', 12, 12)), { c: 12, r: 12 });
assert.equal(splitRecovery.remove({ c: 12, r: 12 })['iron-ore'], 1);
conserved(splitRecovery);
assert.equal(splitRecovery.place(building('splitter', 12, 12)), null);
assert.equal(splitRecovery.getState({ c: 12, r: 12 })!.nextOutput, 0, 'Replacement splitter starts with a clean route preference');

const drawnFactory = factory(building('miner', 7, 10), building('storage', 12, 12));
const drawn = planRoute(drawnFactory, { c: 7, r: 10 }, { c: 12, r: 12 });
assert.equal(drawn.blocked, null, 'Machine output and depot destination are valid endpoints');
const applied = commitRoute(drawnFactory, drawn);
assert.equal(applied.placed.length, 6);
assert.equal(applied.error, null);
run(drawnFactory, 180);
assert.ok(drawnFactory.summary().stored['iron-ore'] > 0, 'Auto-oriented drawn turns must form a working production route');
assert.equal(drawnFactory.buildings.get('12,12')!.kind, 'storage', 'Drawing must never replace the endpoint receiver');
const drawnBeforeUndo = drawnFactory.snapshot();
const undone = undoRoute(drawnFactory, applied.placed);
assert.equal(undone.removed, 6);
assert.ok(itemCount(undone.recovered) > 0, 'Group undo recovers cargo that entered after drawing');
assert.equal(drawnFactory.buildings.size, 3, 'Undo preserves the founding home and both existing endpoints');
assert.deepEqual(drawnFactory.summary().stored, drawnBeforeUndo.stored, 'Undo leaves existing receivers and delivered inventory intact');
conserved(drawnFactory);
assert.equal(undoRoute(drawnFactory, applied.placed).removed, 0, 'Repeated undo cannot duplicate recovered cargo');
assert.deepEqual(FactorySimulation.restore(drawnFactory.serialize()).serialize(), drawnFactory.serialize());

const staleTrail = factory();
const stalePreview = planRoute(staleTrail, { c: 10, r: 10 }, { c: 14, r: 10 });
assert.equal(staleTrail.place(building('splitter', 12, 10)), null);
const partial = commitRoute(staleTrail, stalePreview);
assert.equal(partial.placed.length, 0);
assert.match(partial.error!, /occupied/, 'Release revalidates cells instead of overwriting a newly occupied tile');
assert.equal(staleTrail.buildings.get('12,10')!.kind, 'splitter');
assert.equal(staleTrail.buildings.has('10,10'), false, 'Blocked routes commit nothing, including the valid prefix');
staleTrail.remove({ c: 12, r: 10 });
const owned = commitRoute(staleTrail, stalePreview);
assert.equal(owned.placed.length, 5);
staleTrail.remove({ c: 10, r: 10 });
assert.equal(staleTrail.place(building('belt', 10, 10, 1)), null);
staleTrail.rotate({ c: 11, r: 10 });
assert.equal(undoRoute(staleTrail, owned.placed).removed, 4, 'Undo removes its rotated originals but not later replacements at the same coordinates');
assert.equal(staleTrail.buildings.get('10,10')!.direction, 1);
conserved(staleTrail);

for (const direction of [0, 1, 2, 3] as const) {
  const vector = DIRECTIONS[direction];
  const source = building('furnace', 18, 18, direction);
  const receiver = building('storage', 18 + vector.c * 4, 18 + vector.r * 4);
  const ports = factory(source, receiver);
  const planned = planRoute(ports, source, receiver);
  assert.equal(planned.blocked, null);
  assert.equal(planned.buildings.length, 3);
  assert.ok(planned.buildings.every(value => value.direction === direction), 'All rotated output ports snap without rotating endpoints');
  const committed = commitRoute(ports, planned);
  assert.equal(committed.error, null);
  assert.equal(ports.buildings.get(tileKey(source))!.direction, direction);
  assert.equal(ports.buildings.get(tileKey(receiver))!.kind, 'storage');
  assert.equal(undoRoute(ports, committed.placed).removed, 3);

  const splitter = building('splitter', 18, 18, direction);
  const behind = { c: 18 - vector.c * 4, r: 18 - vector.r * 4 };
  const splitInput = factory(splitter);
  const rear = planRoute(splitInput, behind, splitter);
  assert.equal(rear.blocked, null);
  assert.equal(rear.buildings.length, 4);
  assert.ok(rear.buildings.every(value => value.direction === direction), 'Splitter destination uses its rear input only');
  for (const output of outputDirections(splitter)) {
    const along = DIRECTIONS[output];
    const splitOutput = planRoute(splitInput, splitter, { c: 18 + along.c * 4, r: 18 + along.r * 4 });
    assert.equal(splitOutput.blocked, null);
    assert.equal(splitOutput.buildings.length, 4);
    assert.ok(splitOutput.buildings.every(value => value.direction === output), 'Both splitter outputs can anchor a route');
  }
}
const mergeEndpoint = factory(building('belt', 12, 12));
assert.equal(planRoute(mergeEndpoint, { c: 12, r: 8 }, { c: 12, r: 12 }).blocked, null, 'Existing belt side accepts a merge');
const frontEndpoint = planRoute(mergeEndpoint, { c: 16, r: 12 }, { c: 12, r: 12 });
const frontLast = frontEndpoint.buildings.at(-1)!;
assert.ok(frontLast.c !== 13 || frontLast.r !== 12, 'An opposing front feed must snap around to a valid input');
assert.equal(mergeEndpoint.buildings.get('12,12')!.direction, 0);
const adjacent = factory(building('belt', 10, 10), building('storage', 11, 10));
const connected = planRoute(adjacent, { c: 10, r: 10 }, { c: 11, r: 10 });
assert.equal(connected.blocked, null);
assert.equal(connected.buildings.length, 0);
assert.match(commitRoute(adjacent, connected).error!, /already connected/);
const minerDestination = factory(building('miner', 7, 10));
assert.match(planRoute(minerDestination, { c: 10, r: 10 }, { c: 7, r: 10 }).blocked!.error, /no input/);
const endpointChanged = factory(building('belt', 10, 10), building('storage', 14, 10));
const endpointPreview = planRoute(endpointChanged, { c: 10, r: 10 }, { c: 14, r: 10 });
endpointChanged.rotate({ c: 10, r: 10 });
endpointChanged.place(building('splitter', 10, 11));
assert.equal(commitRoute(endpointChanged, endpointPreview).placed.length, 0, 'Commit rechecks changed source ports and their obstructions atomically');
assert.equal(endpointChanged.buildings.size, 4);
endpointChanged.remove({ c: 10, r: 11 });
assert.match(commitRoute(endpointChanged, endpointPreview).error!, /Route changed/,
  'A changed but unobstructed source cannot build a different route from the inspected preview');
assert.equal(endpointChanged.buildings.size, 3);
console.log('Factory simulation checks passed: complete chains, bounded buffers, congestion, deterministic/fair transfers, splitter routing, anchored-route production/group undo/atomic revalidation, conservation, turns, recovery, reconnection, and fixed-step timing.');
