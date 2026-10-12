import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { advanceTicks, assertInvariants, roundTrip } from './factory-check-helpers';

const factories = [
  () => {
    const sim = FactorySimulation.create();
    for (const building of [
      { kind: 'miner', c: 7, r: 10, direction: 0 },
      { kind: 'belt', c: 8, r: 10, direction: 0 },
      { kind: 'furnace', c: 9, r: 10, direction: 0 },
      { kind: 'storage', c: 10, r: 10, direction: 0 },
    ] as const) assert.equal(sim.place(building), null);
    return sim;
  },
  () => FactorySimulation.create(),
  () => FactorySimulation.create('architecture-check'),
  () => {
    const sim = FactorySimulation.create();
    for (let c = 5; c < 22; c++) for (let r = 5; r < 22; r++) {
      if (!sim.placementError({ c, r }, 'food-plot')) {
        assert.equal(sim.place({ c, r, kind: 'food-plot', direction: 0 }), null);
      }
    }
    return sim;
  },
];
const hashes: string[][] = [];
for (const fresh of factories) {
  const sim = fresh();
  let replica = roundTrip(sim);
  const checkpoints: string[] = [];
  for (let batch = 0; batch < 20; batch++) {
    advanceTicks(sim, 100);
    advanceTicks(replica, 100);
    assert.deepEqual(replica.serialize(), sim.serialize());
    assertInvariants(sim);
    checkpoints.push(createHash('sha256').update(JSON.stringify(sim.serialize())).digest('hex'));
    if (batch % 3 === 0) replica = roundTrip(sim);
  }
  hashes.push(checkpoints);
}

const samples: number[][] = [];
for (const fresh of factories) {
  const times: number[] = [];
  for (let trial = 0; trial < 7; trial++) {
    const sim = fresh();
    advanceTicks(sim, 2000);
    const start = performance.now();
    advanceTicks(sim, 10000);
    times.push(performance.now() - start);
  }
  samples.push(times.sort((a, b) => a - b));
}
const result = { hashes, medianMs: samples.map(times => times[3]), samples };
const operation = process.argv[2];
const path = process.argv[3];
if (operation === '--record' && path) writeFileSync(path, JSON.stringify(result, null, 2));
else if (operation === '--compare' && path) {
  const baseline = JSON.parse(readFileSync(path, 'utf8')) as typeof result;
  assert.deepEqual(result.hashes, baseline.hashes, 'Refactor must preserve exact saved state at every checkpoint');
  for (let i = 0; i < result.medianMs.length; i++) {
    assert.ok(result.medianMs[i] <= baseline.medianMs[i] * 1.15,
      `Scenario ${i} exceeded the baseline simulation median by more than 15%`);
  }
  console.log('Baseline / current median milliseconds per 10,000 ticks:',
    baseline.medianMs.map((before, i) => ({ before, after: result.medianMs[i], ratio: result.medianMs[i] / before })));
}
else assert.ok(operation === undefined, 'Use --record or --compare with a baseline path');
console.log('Factory refactor checks passed: exact replay, save round trips and global restore invariants.',
  'Median milliseconds per 10,000 ticks:', result.medianMs.map(ms => ms.toFixed(2)).join(', '));
