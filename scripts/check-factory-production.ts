import assert from 'node:assert/strict';
import { Building, CATALOG, createSettlement, inventory, itemCount, ITEMS, tileKey } from '../src/games/factory/game/model';
import { ASSEMBLE_TICKS, FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks as ticks, assertInvariants, emptyFactory, factoryFrom, roundTrip } from './factory-check-helpers';

const building = (kind: Building['kind'], c: number, r: number, direction: Building['direction'] = 0): Building =>
  ({ kind, c, r, direction });
const state = (sim: FactorySimulation, c: number, r: number) => {
  const machine = sim.getState({ c, r });
  assert.ok(machine, `Missing machine ${c},${r}`);
  return machine;
};
const place = (sim: FactorySimulation, ...buildings: Building[]) => {
  for (const value of buildings) assert.equal(sim.place(value), null, `Cannot place ${value.kind} at ${tileKey(value)}`);
};

const settlement = FactorySimulation.create();
assert.deepEqual(settlement.buildings, createSettlement());
assert.equal(settlement.residents.length, 4);
assert.equal(settlement.getState({ c: 14, r: 12 })!.input['food-unit'], 8);
assert.equal(settlement.serialize().ruleset, 'settlement-v8');
for (const field of ['scenario', 'projects', 'delivered', 'stage', 'deliveryTicks']) {
  assert.equal(Object.hasOwn(settlement.serialize(), field), false);
  assert.equal(Object.hasOwn(settlement.summary(), field), false);
}
for (const entry of CATALOG) {
  const fresh = FactorySimulation.create();
  let tile = entry.kind === 'miner' || entry.kind === 'mining-site' ? { c: 7, r: 10 } : { c: 17, r: 17 };
  if (entry.kind === 'woodcutting-site') {
    const sites = [];
    for (let c = 2; c < 30; c++) for (let r = 2; r < 30; r++) {
      if (!fresh.placementError({ c, r }, entry.kind)) sites.push({ c, r });
    }
    assert.ok(sites.length);
    tile = sites[0];
  }
  assert.equal(fresh.place({ ...tile, kind: entry.kind, direction: 0 }), null);
  assertInvariants(fresh);
}
assert.throws(() => settlement.remove({ c: 11, r: 12 }), /fixed/);
assert.throws(() => settlement.rotate({ c: 11, r: 12 }), /fixed/);
assert.match(settlement.place(building('home', 17, 17))!, /stays in place/);

// Buffered ingredients remain physical until the recipe completes.
const assembly = emptyFactory();
place(assembly, building('assembler', 16, 16));
const a = state(assembly, 16, 16);
ticks(assembly, 30);
assert.equal(a.progress, 0);
a.input['iron-plate'] = 2;
ticks(assembly, 30);
assert.equal(a.progress, 0);
assert.match(assembly.status(a.building), /copper/);
a.input['copper-plate'] = 1;
ticks(assembly, ASSEMBLE_TICKS - 1);
assert.equal(a.progress, 19);
assert.equal(a.input['iron-plate'], 2);
assembly.rotate(a.building);
assert.equal(a.progress, 19);
assembly.step();
assert.equal(a.input['iron-plate'] + a.input['copper-plate'], 0);
assert.equal(a.output['defense-supply'], 1);
assert.deepEqual(assembly.summary().recipeConsumed, { ...inventory(), 'iron-plate': 2, 'copper-plate': 1 });
a.input['iron-plate'] = 4;
a.input['copper-plate'] = 4;
a.output['defense-supply'] = 4;
ticks(assembly, 30);
assert.equal(a.progress, 0);
a.output['defense-supply'] = 3;
ticks(assembly, 5);
a.output['defense-supply'] = 4;
ticks(assembly, 10);
assert.equal(a.progress, 5, 'Blocked output freezes partial work');
assert.deepEqual(assembly.remove(a.building), { ...inventory(), 'iron-plate': 4, 'copper-plate': 4, 'defense-supply': 4 });

const capacities = emptyFactory();
place(capacities, building('assembler', 16, 16), building('furnace', 15, 16),
  building('furnace', 16, 15, 1), building('furnace', 16, 17, 3));
state(capacities, 16, 16).input['iron-plate'] = 3;
state(capacities, 15, 16).output['iron-plate'] = 4;
state(capacities, 16, 15).output['iron-plate'] = 4;
state(capacities, 16, 17).output['copper-plate'] = 4;
capacities.step();
assert.equal(state(capacities, 16, 16).input['iron-plate'], 4);
assert.equal(state(capacities, 16, 16).input['copper-plate'], 1, 'Full iron buffer must not exclude copper');
state(capacities, 16, 17).output['iron-ore'] = 1;
state(capacities, 16, 17).output['copper-plate'] = 0;
capacities.step();
assert.equal(state(capacities, 16, 16).input['iron-ore'], 0);

const recovery = emptyFactory();
place(recovery, building('storage', 16, 16), building('storage', 17, 16));
for (const item of ITEMS.filter(item => item !== 'food-unit')) state(recovery, 16, 16).input[item] = 2;
const recoveredStock = recovery.remove({ c: 16, r: 16 });
const existingRecovery = recovery.summary().recovered;
state(recovery, 17, 16).input['defense-supply'] = 59;
const partial = recovery.transferRecovered({ c: 17, r: 16 });
assert.deepEqual(partial.moved, { ...inventory(), 'iron-ore': 2, 'copper-ore': 2, 'iron-plate': 1 });
assert.equal(itemCount(state(recovery, 17, 16).input), 64);
for (const item of ITEMS) assert.equal(partial.moved[item] + partial.remaining[item], existingRecovery[item]);
assert.equal(recoveredStock['defense-supply'], 2);
assert.equal(itemCount(recovery.transferRecovered({ c: 17, r: 16 }).moved), 0);
place(recovery, building('storage', 16, 16));
recovery.transferRecovered({ c: 16, r: 16 });
assert.equal(itemCount(recovery.summary().recovered), 0);
assert.throws(() => recovery.transferRecovered({ c: 0, r: 0 }), /selected depot/);

const line = [building('assembler', 16, 16), building('furnace', 15, 16),
  building('furnace', 16, 15, 1), building('belt', 17, 16), building('storage', 18, 16)];
const forward = factoryFrom(new Map(line.map(b => [tileKey(b), b])));
const reverse = factoryFrom(new Map([...line].reverse().map(b => [tileKey(b), b])));
for (const sim of [forward, reverse]) {
  const save = sim.serialize();
  save.machines.find(m => tileKey(m.building) === '15,16')!.output['iron-plate'] = 4;
  save.machines.find(m => tileKey(m.building) === '16,15')!.output['copper-plate'] = 4;
  save.mined['iron-ore'] = save.smelted['iron-plate'] = 4;
  save.mined['copper-ore'] = save.smelted['copper-plate'] = 4;
  const credited = FactorySimulation.restore(save);
  ticks(credited, 120);
  assert.equal(credited.summary().stored['defense-supply'], 2);
  roundTrip(credited);
}
for (let i = 0; i < 120; i++) {
  forward.step();
  reverse.step();
  assert.deepEqual(forward.snapshot(), reverse.snapshot());
}
const fast = FactorySimulation.create();
const slow = FactorySimulation.create();
for (let i = 0; i < 600; i++) fast.advance(1000 / 60);
for (let i = 0; i < 300; i++) slow.advance(1000 / 30);
assert.deepEqual(fast.snapshot(), slow.snapshot());
console.log('Factory production checks passed: single starter, ungated catalog, recipe boundaries, recovery, capacities and deterministic timing.');
