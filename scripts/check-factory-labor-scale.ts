import assert from 'node:assert/strict';
import { Building, inventory, itemCount, Tile, tileKey } from '../src/games/factory/game/domain';
import { weightedLaborTargets } from '../src/games/factory/game/labor';
import { MachineState } from '../src/games/factory/game/machines';
import { Settlement, SettlementSave } from '../src/games/factory/game/settlement';
import { FactoryWorld } from '../src/games/factory/game/world';

const demand = (key: string, weight: number, capacity: number) => ({ key, weight, capacity });
assert.deepEqual([...weightedLaborTargets([demand('low', 1, 20), demand('normal', 2, 20), demand('high', 3, 20)], 12).values()], [2, 4, 6]);
assert.deepEqual([...weightedLaborTargets([demand('farm', 3, 1), demand('haul', 2, 64)], 12).values()], [1, 11]);
assert.deepEqual([...weightedLaborTargets([demand('full', 3, 0), demand('small', 1, 2)], 12).values()], [0, 2]);
assert.equal(weightedLaborTargets([], 96).size, 0);
assert.deepEqual([...weightedLaborTargets([demand('a', 1, 10), demand('b', 2, 10)], 4).values()], [4 / 3, 8 / 3]);

function machine(building: Building): MachineState {
  return { building, input: inventory(), output: inventory(), progress: 0, processing: null, lastProcessed: null,
    item: null, enteredFrom: 0, nextOutput: 0, nextItem: 0, running: false };
}

function fixture(population: number, state?: SettlementSave, machines?: Map<string, MachineState>, divided = false) {
  const world = new FactoryWorld();
  world.terrainAt = tile => tile.c < 32 && tile.r < 32 && (!divided || tile.c !== 16) ? 'grass' : 'water';
  const sources: Tile[] = [{ c: 5, r: 5 }, { c: 9, r: 5 }, { c: 13, r: 5 }];
  const sinks: Tile[] = [{ c: 5, r: 8 }, { c: 9, r: 17 }, { c: 13, r: 29 }];
  const map = machines ?? new Map<string, MachineState>();
  if (!machines) for (let i = 0; i < sources.length; i++) {
    map.set(tileKey(sources[i]), machine({ ...sources[i], kind: 'storage', direction: 0,
      workPriority: (['high', 'normal', 'low'] as const)[i], haulTo: sinks[i] }));
    map.set(tileKey(sinks[i]), machine({ ...sinks[i], kind: 'storage', direction: 0 }));
  }
  const host = { world, machines: map, automated: () => false, recover: () => { assert.fail('Unexpected cargo recovery'); } };
  const initial = state ?? new Settlement(host).serialize();
  if (!state) initial.residents = Array.from({ length: population }, (_, id) =>
    ({ id, tile: { c: 8, r: 8 }, travel: 0, cargo: null, job: null, note: 'Looking for work' }));
  const settlement = new Settlement(host, initial);
  return { settlement, map, sources, sinks };
}

function keepDemand(f: ReturnType<typeof fixture>): { added: number; drained: number } {
  let added = 0;
  let drained = 0;
  for (const source of f.sources) {
    const stock = f.map.get(tileKey(source))!.input;
    added += 64 - stock['iron-ore'];
    stock['iron-ore'] = 64;
  }
  for (const sink of f.sinks) {
    const stock = f.map.get(tileKey(sink))!.input;
    drained += stock['iron-ore'];
    stock['iron-ore'] = 0;
  }
  return { added, drained };
}

function checkPhysical(f: ReturnType<typeof fixture>, added: number, drained: number): void {
  const held = [...f.map.values()].reduce((sum, m) => sum + itemCount(m.input) + itemCount(m.output), 0) +
    f.settlement.state.residents.filter(resident => resident.cargo).length;
  assert.equal(held + drained, added, 'Physical stock and cargo are conserved');
  for (const m of f.map.values()) {
    const inbound = f.settlement.state.residents.filter(resident => resident.job?.destination &&
      tileKey(resident.job.destination) === tileKey(m.building)).length;
    assert.ok(itemCount(m.input) + inbound <= 64, 'Live reservations respect shared destination space');
    assert.ok(f.settlement.reservedSource(m.building, 'iron-ore') <= m.input['iron-ore']);
  }
  assert.ok(Object.values(f.settlement.state.labor).every(Number.isFinite));
}

function shares(population: number) {
  const f = fixture(population);
  let added = 0;
  let drained = 0;
  const time = [0, 0, 0];
  const deliveries = [0, 0, 0];
  let replica: ReturnType<typeof fixture> | null = null;
  for (let tick = 0; tick < 6000; tick++) {
    const change = keepDemand(f);
    added += change.added;
    drained += change.drained;
    const before = f.settlement.state.residents.map(resident => resident.job && tileKey(resident.job.source));
    f.settlement.step();
    for (const [index, resident] of f.settlement.state.residents.entries()) {
      const source = before[index] ?? (resident.job && tileKey(resident.job.source));
      const group = f.sources.findIndex(tile => tileKey(tile) === source);
      if (group >= 0) time[group]++;
    }
    for (let i = 0; i < 3; i++) deliveries[i] += f.map.get(tileKey(f.sinks[i]))!.input['iron-ore'];
    checkPhysical(f, added, drained);
    assert.equal(f.settlement.state.residents.filter(resident => resident.job).length, population,
      'Every resident can reserve useful work in the same tick');
    if (tick === 0 && population === 12) assert.deepEqual(f.sources.map(source =>
      f.settlement.state.residents.filter(resident => resident.job &&
        tileKey(resident.job.source) === tileKey(source)).length), [6, 4, 2]);
    if (tick === 4000) replica = fixture(population, f.settlement.serialize(), structuredClone(f.map));
    else if (replica) {
      keepDemand(replica);
      replica.settlement.step();
      assert.deepEqual(replica.settlement.serialize(), f.settlement.serialize(), 'Resident-time credits replay deterministically');
      assert.deepEqual(replica.map, f.map);
    }
  }
  const total = time.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(time[i] / total - [3 / 6, 2 / 6, 1 / 6][i]) < 0.025,
    `${population} residents: effort ${time} must approach 3:2:1 despite unequal trip durations`);
  assert.ok(deliveries[0] > deliveries[2] * 2, 'Short trips yield more jobs, not extra resident-time entitlement');
  console.log(`${population} residents: effort ${time.join('/')} and deliveries ${deliveries.join('/')} across unequal routes.`);
}
for (const population of [12, 40, 96]) shares(population);

const capped = fixture(12);
const farm = capped.map.get(tileKey(capped.sources[0]))!;
farm.building.kind = 'food-plot';
farm.building.haulTo = null;
farm.input = inventory();
capped.map.get(tileKey(capped.sources[2]))!.building.haulTo = null;
keepDemand(capped);
capped.settlement.step();
assert.equal(capped.settlement.state.residents.filter(resident => resident.job?.kind === 'farm').length, 1);
assert.equal(capped.settlement.state.residents.filter(resident => resident.job?.kind === 'collect').length, 11,
  'A one-slot High producer lends the rest of its capacity');

const disconnected = fixture(12, undefined, undefined, true);
const rightSource = { c: 22, r: 5 };
const rightSink = { c: 22, r: 8 };
disconnected.map.set(tileKey(rightSource), machine({ ...rightSource, kind: 'storage', direction: 0,
  workPriority: 'high', haulTo: rightSink }));
disconnected.map.set(tileKey(rightSink), machine({ ...rightSink, kind: 'storage', direction: 0 }));
disconnected.map.get(tileKey(rightSource))!.input['iron-ore'] = 64;
for (const resident of disconnected.settlement.state.residents.slice(8)) resident.tile = { c: 22, r: 10 };
keepDemand(disconnected);
disconnected.settlement.step();
assert.equal(disconnected.settlement.state.residents.filter(resident =>
  resident.job && tileKey(resident.job.source) === tileKey(rightSource)).length, 4,
  'Disconnected demand shares only its own reachable labor pool');
assert.equal(Object.keys(disconnected.settlement.state.labor).length, 4);

const inactive = fixture(12);
keepDemand(inactive);
inactive.settlement.step();
for (const m of inactive.map.values()) m.building.haulTo = null;
for (let tick = 0; tick < 500; tick++) inactive.settlement.step();
assert.equal(inactive.settlement.state.residents.some(resident => resident.job), false);
assert.deepEqual(inactive.settlement.state.labor, {}, 'Inactive work does not accumulate credit');
inactive.map.get(tileKey(inactive.sources[0]))!.building.haulTo = inactive.sinks[0];
keepDemand(inactive);
inactive.settlement.step();
assert.equal(inactive.settlement.state.residents.filter(resident => resident.job).length, 12,
  'Reactivated sole work borrows the entire useful pool without a dormant-credit burst');

const scarce = fixture(1);
keepDemand(scarce);
scarce.settlement.step();
assert.equal(tileKey(scarce.settlement.state.residents[0].job!.source), tileKey(scarce.sources[0]),
  'High receives scarce initial labor even when a lower priority source is closer');

const full = fixture(12);
keepDemand(full);
for (const sink of full.sinks) full.map.get(tileKey(sink))!.input['iron-ore'] = 64;
for (let tick = 0; tick < 100; tick++) full.settlement.step();
assert.deepEqual(full.settlement.state.labor, {}, 'Full destinations have no entitlement or banked credit');
assert.equal(full.settlement.state.residents.some(resident => resident.job), false);

const changed = fixture(12);
keepDemand(changed);
changed.settlement.step();
const jobs = structuredClone(changed.settlement.state.residents);
changed.map.get(tileKey(changed.sources[0]))!.building.workPriority = 'low';
changed.map.get(tileKey(changed.sources[2]))!.building.workPriority = 'high';
assert.deepEqual(changed.settlement.state.residents, jobs, 'Priority changes do not interrupt commitments');
const changedTime = [0, 0, 0];
for (let tick = 0; tick < 3000; tick++) {
  keepDemand(changed);
  for (const resident of changed.settlement.state.residents) if (resident.job) {
    changedTime[changed.sources.findIndex(tile => tileKey(tile) === tileKey(resident.job!.source))]++;
  }
  changed.settlement.step();
}
for (let i = 0; i < 3; i++) assert.ok(Math.abs(changedTime[i] / 36000 - [1 / 6, 2 / 6, 3 / 6][i]) < 0.025,
  `Changed priorities rebalance resident-time at job boundaries: ${changedTime}`);
console.log('Scalable labor checks passed: caps, borrowing, regional pools, conservation, inactive credits and persisted replay.');
