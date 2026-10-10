import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { FactoryWorld, BIOMES, CHUNK_SIZE, WORLD_SIZE, GUIDED_SEED } from '../src/games/factory/world';
import { HALF_WIDTH, HALF_HEIGHT, project, tileKey } from '../src/games/factory/model';
import { MAX_RESIDENT_CHUNKS, visibleChunks, visibleTileBounds, WorldView } from '../src/games/factory/chunks';
import { FactorySimulation } from '../src/games/factory/simulation';
import { createSave, restoreSave } from '../src/games/factory/persistence';

assert.equal(WORLD_SIZE, 256);
assert.equal(CHUNK_SIZE, 32);
const fingerprints = new Set<number>();
let maxGenerateMs = 0;
for (let seed = 0; seed < 32; seed++) {
  const start = performance.now();
  const world = new FactoryWorld(`seed-suite-${seed}`);
  maxGenerateMs = Math.max(maxGenerateMs, performance.now() - start);
  const regions = { meadow: 0, riverbank: 0, upland: 0 };
  let water = 0;
  let hash = 2166136261;
  for (let r = 0; r < WORLD_SIZE; r++) {
    for (let c = 0; c < WORLD_SIZE; c++) {
      const cell = world.at({ c, r });
      regions[cell.biome]++;
      water += cell.ground === 'water' ? 1 : 0;
      if (cell.ground === 'water') assert.equal(cell.deposit, null);
      if (cell.deposit) assert.equal(cell.decoration, null);
      hash = Math.imul(hash ^ (BIOMES.indexOf(cell.biome) + (cell.ground === 'water' ? 4 : 0) +
        (cell.deposit === 'iron' ? 8 : cell.deposit === 'copper' ? 16 : 0) + (cell.decoration ? 32 : 0) + cell.variant * 64), 16777619);
    }
  }
  for (const count of Object.values(regions)) assert.ok(count > 1000, `Missing substantive region in seed ${seed}`);
  assert.ok(water > 256 && water < WORLD_SIZE * WORLD_SIZE / 8);
  fingerprints.add(hash);
  for (let r = 0; r < 24; r++) for (let c = 0; c < 24; c++) {
    const cell = world.at({ c, r });
    assert.equal(cell.ground, 'land');
    assert.equal(cell.decoration, null);
  }
  assert.equal(world.at(world.iron).deposit, 'iron');
  assert.equal(world.at(world.copper).deposit, 'copper');
  assert.ok(Math.abs(world.start.c - world.copper.c) + Math.abs(world.start.r - world.copper.r) < 12);
  const replay = new FactoryWorld(world.seed);
  for (const tile of [{ c: 0, r: 0 }, { c: 31, r: 32 }, { c: 32, r: 31 }, { c: 127, r: 128 },
    { c: 128, r: 127 }, { c: 255, r: 255 }].reverse()) assert.deepEqual(world.at(tile), replay.at(tile));
}
assert.equal(fingerprints.size, 32, 'Different seeds must generate different landscapes');
assert.throws(() => new FactoryWorld(' '), /seed/);
assert.throws(() => new FactoryWorld('x'.repeat(65)), /seed/);

let maxChunks = 0;
for (let r = 0; r <= 256; r += 8) {
  for (let c = 0; c <= 256; c += 8) {
    const center = project(c, r);
    const view: WorldView = { x: center.x - 2400, y: center.y - 1350, width: 4800, height: 2700 };
    const chunks = visibleChunks(view);
    maxChunks = Math.max(maxChunks, chunks.length);
    assert.ok(chunks.length <= MAX_RESIDENT_CHUNKS, `Chunk budget exceeded near ${c},${r}`);
    const keys = new Set(chunks.map(chunk => chunk.key));
    assert.equal(keys.size, chunks.length);
    const bounds = visibleTileBounds(view);
    for (let tr = bounds.minR; tr <= bounds.maxR; tr += 5) {
      for (let tc = bounds.minC; tc <= bounds.maxC; tc += 5) {
        const p = project(tc, tr);
        if (p.x >= view.x && p.x <= view.x + view.width && p.y >= view.y && p.y <= view.y + view.height) {
          assert.ok(keys.has(`${Math.floor(tc / CHUNK_SIZE)},${Math.floor(tr / CHUNK_SIZE)}`), 'Visible tile chunk omitted');
        }
      }
    }
  }
}
assert.ok(maxChunks < 64, 'Camera must not retain the entire world');

const world = new FactoryWorld('remote-factory');
const sim = new FactorySimulation(new Map(), 'free-play', world);
let oreTile: { c: number; r: number } | null = null;
for (let r = 64; r < 200 && !oreTile; r++) {
  for (let c = 64; c < 200; c++) {
    if (!world.at({ c, r }).deposit) continue;
    if ([1, 2, 3].every(offset => world.terrainAt({ c: c + offset, r }) === 'grass')) {
      oreTile = { c, r };
      break;
    }
  }
}
assert.ok(oreTile);
const { c, r } = oreTile;
for (const building of [
  { kind: 'miner' as const, c, r, direction: 0 as const },
  { kind: 'belt' as const, c: c + 1, r, direction: 0 as const },
  { kind: 'furnace' as const, c: c + 2, r, direction: 0 as const },
  { kind: 'storage' as const, c: c + 3, r, direction: 0 as const },
]) assert.equal(sim.place(building), null, `Remote placement failed at ${tileKey(building)}`);
for (let i = 0; i < 100; i++) sim.step();
const material = world.at(oreTile).deposit!;
assert.ok(sim.summary().stored[`${material}-plate`] > 0, 'Remote factory must use its seeded deposit');
const saved = createSave(sim, true, 'remote-world');
const resumed = restoreSave(structuredClone(saved)).simulation;
assert.deepEqual(resumed.serialize(), sim.serialize());
assert.equal(resumed.world.seed, world.seed);
for (let i = 0; i < 100; i++) {
  sim.step();
  resumed.step();
}
assert.deepEqual(resumed.serialize(), sim.serialize());
const invalid = structuredClone(saved);
invalid.map.seed = 'another-seed';
assert.throws(() => restoreSave(invalid), /identity mismatch/);
assert.equal(FactorySimulation.forScenario('guided', 'ignored-user-seed').world.seed, GUIDED_SEED);
assert.equal(FactorySimulation.forScenario('free-play', 'chosen-user-seed').world.seed, 'chosen-user-seed');
assert.equal(project(255, 255).y, 510 * HALF_HEIGHT);
assert.equal(project(255, 0).x, 255 * HALF_WIDTH);
console.log(`Factory world checks passed: 32 seeds, all regions/playable starts, deterministic boundaries, remote production/save restoration, camera coverage; max ${maxChunks} resident chunks, max generation ${maxGenerateMs.toFixed(1)}ms (local Node, not a phone benchmark).`);
