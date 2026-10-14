import assert from 'node:assert/strict';
import { Building, inventory, itemCount, Item, Tile, tileKey } from '../src/games/factory/game/domain';
import { MachineState } from '../src/games/factory/game/machines';
import { Settlement, SettlementSave } from '../src/games/factory/game/settlement';
import { FactoryWorld } from '../src/games/factory/game/world';

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
  const host = { world, machines: map, automated: () => false, recover: () => { assert.fail('Unexpected cargo recovery'); },
    ticks: () => 0, receive: (machine: MachineState, item: Item) => { machine.input[item]++; } };
  const initial = state ?? new Settlement(host).serialize();
  if (!state) initial.residents = Array.from({ length: population }, (_, id) =>
    ({ id, home: { c: 11, r: 12 }, joinedAt: 0, tile: { c: 8, r: 8 }, siteAccess: null, exit: null, travel: 0, cargo: null, job: null, post: null, note: 'Looking for work' }));
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
}

function shares(population: number) {
  const f = fixture(population);
  let added = 0;
  let drained = 0;
  const deliveries = [0, 0, 0];
  let replica: ReturnType<typeof fixture> | null = null;
  const started = performance.now();
  for (let tick = 0; tick < 6000; tick++) {
    const change = keepDemand(f);
    added += change.added;
    drained += change.drained;
    f.settlement.step();
    for (let i = 0; i < 3; i++) deliveries[i] += f.map.get(tileKey(f.sinks[i]))!.input['iron-ore'];
    checkPhysical(f, added, drained);
    assert.equal(f.settlement.state.residents.filter(resident => resident.job).length, population,
      'Every resident can reserve useful work in the same tick');
    if (tick === 4000) replica = fixture(population, f.settlement.serialize(), structuredClone(f.map));
    else if (replica) {
      keepDemand(replica);
      replica.settlement.step();
      assert.deepEqual(replica.settlement.serialize(), f.settlement.serialize(), 'Hauling choices replay deterministically');
      assert.deepEqual(replica.map, f.map);
    }
  }
  const ms = (performance.now() - started) / 6000;
  assert.ok(deliveries[0] >= deliveries[1] && deliveries[1] >= deliveries[2], `${population} residents: priority orders deliveries ${deliveries}`);
  // Sources refill every tick here, so lower tiers get work only once reservations
  // drain enough unreserved stock from the higher tiers.
  if (population >= 40) assert.ok(deliveries[1] > 0, `${population} residents: Normal shares busy High stock`);
  if (population >= 96) assert.ok(deliveries[2] > 0, `${population} residents: Low shares busy High and Normal stock`);
  console.log(`${population} residents: deliveries ${deliveries.join('/')} (High/Normal/Low), ${ms.toFixed(3)}ms per tick including checks.`);
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
  'A site needs one worker; everyone else hauls');

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

const inactive = fixture(12);
keepDemand(inactive);
inactive.settlement.step();
for (const m of inactive.map.values()) m.building.haulTo = null;
for (let tick = 0; tick < 500; tick++) inactive.settlement.step();
assert.equal(inactive.settlement.state.residents.some(resident => resident.job), false);
inactive.map.get(tileKey(inactive.sources[0]))!.building.haulTo = inactive.sinks[0];
keepDemand(inactive);
inactive.settlement.step();
assert.equal(inactive.settlement.state.residents.filter(resident => resident.job).length, 12,
  'Reactivated work is available to the whole pool');

const scarce = fixture(1);
keepDemand(scarce);
scarce.settlement.step();
assert.equal(tileKey(scarce.settlement.state.residents[0].job!.source), tileKey(scarce.sources[0]),
  'High receives scarce initial labor even when a lower priority source is closer');

const full = fixture(12);
keepDemand(full);
for (const sink of full.sinks) full.map.get(tileKey(sink))!.input['iron-ore'] = 64;
for (let tick = 0; tick < 100; tick++) full.settlement.step();
assert.equal(full.settlement.state.residents.some(resident => resident.job), false);

const changed = fixture(12);
keepDemand(changed);
changed.settlement.step();
const jobs = structuredClone(changed.settlement.state.residents);
changed.map.get(tileKey(changed.sources[0]))!.building.workPriority = 'low';
changed.map.get(tileKey(changed.sources[2]))!.building.workPriority = 'high';
assert.deepEqual(changed.settlement.state.residents, jobs, 'Priority changes do not interrupt commitments');
const changedDeliveries = [0, 0, 0];
for (let tick = 0; tick < 3000; tick++) {
  keepDemand(changed);
  changed.settlement.step();
  for (let i = 0; i < 3; i++) changedDeliveries[i] += changed.map.get(tileKey(changed.sinks[i]))!.input['iron-ore'];
}
assert.ok(changedDeliveries[2] > changedDeliveries[0], `Changed priorities apply at job boundaries: ${changedDeliveries}`);

// Large settlements: sites keep stable workers; residents beyond the posts haul.
const plots: Tile[] = [];
for (let r = 2; r < 30 && plots.length < 30; r += 4) for (let c = 18; c < 31 && plots.length < 30; c += 2) plots.push({ c, r });
const large = new Map<string, MachineState>();
for (const tile of plots) large.set(tileKey(tile), machine({ ...tile, kind: 'food-plot', direction: 0,
  workPriority: tile.r < 10 ? 'high' : 'normal' }));
const town = fixture(96, undefined, large);
town.settlement.step();
const staffed = town.settlement.state.residents.map(resident => resident.post && tileKey(resident.post));
assert.equal(staffed.filter(Boolean).length, plots.length);
const townStart = performance.now();
for (let tick = 0; tick < 2000; tick++) town.settlement.step();
const townMs = (performance.now() - townStart) / 2000;
assert.deepEqual(town.settlement.state.residents.map(resident => resident.post && tileKey(resident.post)), staffed,
  'Posts stay put without layout or priority changes');
const short = fixture(12, undefined, new Map([...large].map(([key, value]) => [key, machine(structuredClone(value.building))])));
short.settlement.step();
assert.ok(plots.filter(tile => tile.r < 10).every(tile => short.settlement.state.residents.some(resident =>
  resident.post && tileKey(resident.post) === tileKey(tile)) || plots.filter(other => other.r < 10).length > 12),
'High sites are staffed before Normal ones');
assert.equal(short.settlement.state.residents.filter(resident => resident.post).length, 12);
console.log(`Scalable labor checks passed: priority hauling, regional pools, conservation, stable posts for 96 residents on 30 sites (${townMs.toFixed(3)}ms per tick) and persisted replay.`);
