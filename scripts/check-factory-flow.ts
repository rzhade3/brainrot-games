import assert from 'node:assert/strict';
import { EXTRACT_TICKS, HOUSE_WOOD_COST, Item, RESIDENT_FOOD_TICKS } from '../src/games/factory/game/domain';
import {
  FactorySimulation, FLOW_MIN_TICKS, FLOW_TICKS, ResourceInspection, resourceVerdict, SMELT_TICKS,
} from '../src/games/factory/game/simulation';
import { advanceTicks, createDemo, emptyFactory, factoryFrom } from './factory-check-helpers';

const resource = (sim: FactorySimulation, item: Item) => sim.inspectResources().find(value => value.item === item)!;
const near = (actual: number, expected: number, message: string) =>
  assert.ok(Math.abs(actual - expected) <= 1, `${message}: ${actual} vs ${expected}`);

// Rates are measured in simulation time and withheld until enough work has been observed.
const settlement = FactorySimulation.create();
settlement.step();
assert.equal(resource(settlement, 'food-unit').flow.ticks, 0);
assert.equal(resource(settlement, 'food-unit').verdict, 'measuring');
advanceTicks(settlement, FLOW_MIN_TICKS - 2);
assert.equal(resource(settlement, 'food-unit').flow.ticks, 0, 'Still measuring before the minimum window');
advanceTicks(settlement, FLOW_TICKS + 2);
const food = resource(settlement, 'food-unit');
assert.ok(food.flow.ticks >= FLOW_TICKS && food.flow.ticks < FLOW_TICKS + 20, 'Rates cover about one minute');
const need = 4 * FLOW_TICKS / RESIDENT_FOOD_TICKS;
assert.equal(food.flow.needed, need);
near(food.flow.used, need, 'Four residents eat their measured need');
assert.ok(food.flow.made > 0, 'Starter plots grow food');
assert.equal(resource(settlement, 'iron-ore').flow.needed, null);
const before = settlement.serialize();
assert.deepEqual(settlement.inspectResources(), settlement.inspectResources(), 'Inspection is stable');
assert.deepEqual(settlement.serialize(), before, 'Inspection does not change state');

// A chain reports ore and plate flow and shows where it backs up.
const demo = factoryFrom(createDemo());
advanceTicks(demo, 900);
const ore = resource(demo, 'iron-ore');
assert.ok(SMELT_TICKS > EXTRACT_TICKS, 'This chain has a faster extractor than smelter');
near(ore.flow.made, FLOW_TICKS / SMELT_TICKS, 'The slower smelter limits extraction');
near(ore.flow.used, ore.flow.made, 'Ore is used as fast as it is made');
near(resource(demo, 'iron-plate').flow.made, ore.flow.used, 'Each ore becomes one plate');
assert.equal(resource(demo, 'iron-plate').flow.used, 0);
assert.equal(resource(demo, 'iron-plate').verdict, 'steady');
advanceTicks(demo, 3600);
const backed = resource(demo, 'iron-ore');
assert.equal(backed.verdict, 'backed-up');
assert.ok(backed.blockedProducers >= 1);
assert.equal(backed.locations[0].issue, 'blocked', 'Problem locations sort first');
assert.equal(backed.flow.made, 0, 'A full chain stops making ore');
assert.equal(resource(demo, 'iron-plate').verdict, 'backed-up', 'The full depot finally stops the smelter');
const restored = FactorySimulation.restore(demo.serialize());
assert.equal(resource(restored, 'iron-ore').flow.ticks, 0, 'Loading starts a fresh measurement');
assert.equal(resource(restored, 'iron-ore').verdict, 'backed-up', 'Building states are judged immediately');

// Consumers without inputs mark the missing resource short; an unused smelter waits for either ore.
const waiting = emptyFactory();
assert.equal(waiting.place({ kind: 'assembler', c: 16, r: 16, direction: 0 }), null);
assert.equal(waiting.place({ kind: 'furnace', c: 12, r: 10, direction: 0 }), null);
for (const item of ['iron-plate', 'copper-plate', 'iron-ore', 'copper-ore'] as const) {
  const value = resource(waiting, item);
  assert.equal(value.verdict, 'short', item);
  assert.equal(value.waitingConsumers, 1, item);
  assert.equal(value.locations[0].issue, 'waiting', item);
}
assert.equal(resource(waiting, 'defense-supply').verdict, 'measuring');
const smelted = waiting.serialize();
smelted.machines.find(machine => machine.building.kind === 'furnace')!.lastProcessed = 'iron-ore';
const lastIron = FactorySimulation.restore(smelted);
assert.equal(resource(lastIron, 'iron-ore').locations.find(location => location.key === '12,10')!.issue, 'waiting');
assert.equal(resource(lastIron, 'copper-ore').locations.find(location => location.key === '12,10')!.issue, null,
  'An iron smelter does not make copper look short');

// Residents missing meals is a shortage even with no kitchen to wait at.
const hungry = emptyFactory();
advanceTicks(hungry, FLOW_TICKS);
const missed = resource(hungry, 'food-unit');
assert.ok(missed.flow.missedFood > 0);
assert.equal(missed.verdict, 'short');

// Producers switched off are idle.
const idle = FactorySimulation.create();
for (const building of idle.buildings.values()) {
  if (building.kind === 'food-plot') assert.equal(idle.setWorkPriority(building, 'off'), null);
}
advanceTicks(idle, 1);
assert.equal(resource(idle, 'food-unit').verdict, 'idle');
assert.equal(resource(idle, 'food-unit').idleProducers, resource(idle, 'food-unit').producers);

// Wood installed in a house counts as used.
const builder = FactorySimulation.create();
assert.equal(builder.place({ kind: 'house', c: 16, r: 12, direction: 0 }), null);
const sites: { c: number; r: number }[] = [];
for (let c = 2; c < 32; c++) for (let r = 2; r < 32; r++) {
  if (!builder.placementError({ c, r }, 'woodcutting-site')) sites.push({ c, r });
}
sites.sort((a, b) => Math.abs(a.c - 16) + Math.abs(a.r - 12) - Math.abs(b.c - 16) - Math.abs(b.r - 12) || a.c - b.c || a.r - b.r);
assert.equal(builder.place({ ...sites[0], kind: 'woodcutting-site', direction: 0 }), null);
assert.equal(builder.setHaulTarget(sites[0], { c: 16, r: 12 }), null);
for (let tick = 0; tick < 6000 && builder.getState({ c: 16, r: 12 })!.input.wood < HOUSE_WOOD_COST; tick++) builder.step();
assert.equal(builder.getState({ c: 16, r: 12 })!.input.wood, HOUSE_WOOD_COST);
advanceTicks(builder, 10);
assert.ok(resource(builder, 'wood').flow.used > 0, 'House construction uses wood');
assert.ok(resource(builder, 'wood').flow.made > 0);

// Verdict precedence: producers full while consumers wait is a routing problem.
const base = resource(settlement, 'iron-ore');
const judge = (patch: Partial<Omit<ResourceInspection, 'verdict'>>) => resourceVerdict({ ...base, ...patch });
assert.equal(judge({ waitingConsumers: 1, blockedProducers: 1 }), 'stuck');
assert.equal(judge({ waitingConsumers: 1, blockedProducers: 0 }), 'short');
assert.equal(judge({ waitingConsumers: 0, blockedProducers: 2 }), 'backed-up');
const measured = { ...base.flow, ticks: FLOW_TICKS };
assert.equal(judge({ waitingConsumers: 0, blockedProducers: 0, idleProducers: 0, producers: 1, flow: { ...measured, made: 4, used: 9 } }), 'falling');
assert.equal(judge({ waitingConsumers: 0, blockedProducers: 0, idleProducers: 0, producers: 1, flow: { ...measured, made: 9, used: 9 } }), 'steady');
assert.equal(judge({ waitingConsumers: 0, blockedProducers: 0, idleProducers: 0, producers: 0, consumers: 0, total: 0, flow: { ...measured, made: 0, used: 0 } }), 'unused');

console.log('Factory flow checks passed: measured per-minute rates, food need, chain flow, backed-up, short, idle, missed meals, house wood, fresh measurement after load and verdict precedence.');
