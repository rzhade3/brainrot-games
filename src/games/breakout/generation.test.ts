import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWave } from './levels';
import { authoredMap } from './levels/registry';
import { generateLevel, type LevelGenerator } from './levels/generation';
import { compileTileMap } from './levels/tile-map';
import { twinVaults } from './levels/twin-vaults';
import { TWIN_VAULTS_MAP } from './levels/twin-vaults-map';
import { validateBoard } from './levels/validate-board';
import { Breakout, MAX_BALLS } from './engine';

const context = { seed: 42, wave: 1, difficulty: { cycle: 0 } };
const plain = {
  name: 'Plain',
  hint: '',
  rows: ['B..B'],
  legend: { B: { kind: 'brick' as const } },
  origin: { x: 40, y: 80 },
  pitch: 20,
};

test('plain maps need no procedural parameters, groups, or chamber names', () => {
  const result = generateLevel(authoredMap('plain', 1, plain), context);
  assert.equal(result.board.bricks.length, 2);
  assert.equal(result.board.chambers, undefined);
  assert.deepEqual(result.diagnostics.failures, []);
});
test('custom generators return the same world-coordinate board without using a map', () => {
  const generator: LevelGenerator = {
    id: 'custom',
    version: 1,
    generate: () => ({
      name: 'Custom',
      hint: '',
      bricks: [{ x: 100, y: 100, w: 40, h: 20, hp: 1, maxHp: 1 }],
      obstacles: [],
    }),
    fallback: () => compileTileMap(plain),
  };
  assert.equal(generateLevel(generator, context).board.bricks[0].x, 100);
});
test('128 seeded Twin vaults boards validate, preserve rewards, vary and replay exactly', () => {
  const shapes = new Set<string>(),
    entrances = new Set<string>();
  for (let seed = 0; seed < 128; seed++) {
    const generated = generateWave(seed % 2 ? 12 : 1, seed);
    assert.equal(generated.diagnostics.fallback, false);
    assert.deepEqual(generated.diagnostics.failures, []);
    assert.equal(generated.board.bricks.filter((b) => b.power === 'triple').length, 4);
    assert.equal(generated.board.bricks.filter((b) => b.power === 'add').length, 6);
    shapes.add(JSON.stringify(generated.board.bricks.map((b) => [b.x, b.y])));
    entrances.add(JSON.stringify(generated.board.bricks.filter((b) => b.gate && b.power).map((b) => b.x)));
    assert.deepEqual(generateWave(generated.replay.wave, generated.replay.seed), generated);
  }
  assert.ok(shapes.size >= 20);
  assert.equal(entrances.size, 16);
});
test('runtime state is independent and run seed persists between waves', () => {
  const a = new Breakout(1, 123),
    b = new Breakout(1, 123);
  assert.deepEqual(a.bricks, b.bricks);
  a.bricks[0].hp = 0;
  assert.ok(b.bricks[0].hp > 0);
  assert.ok(a.generation!.board.bricks[0].hp > 0);
  a.launch();
  a.bricks.forEach((brick) => (brick.hp = 0));
  a.step(1 / 240);
  a.nextWave();
  assert.equal(a.generation?.replay.seed, 123);
  assert.equal(a.wave, 2);
  assert.equal(a.balls.length, 0);
});
test('attempt seeds and failure diagnostics are deterministic; fallback is explicit and validated', () => {
  const broken: LevelGenerator = {
    id: 'broken',
    version: 7,
    generate: () => ({ ...compileTileMap(plain), bricks: [] }),
    fallback: () => compileTileMap(plain),
  };
  assert.throws(() => generateLevel(broken, context), /exhausted.*42/);
  const result = generateLevel(broken, context, true);
  assert.equal(result.diagnostics.fallback, true);
  assert.equal(result.diagnostics.failures.length, 3);
  assert.equal(new Set(result.diagnostics.attemptSeeds).size, 3);
  assert.deepEqual(generateLevel(broken, context, true), result);
  assert.throws(
    () => generateLevel({ ...broken, fallback: broken.generate }, context, true),
    /invalid fallback/,
  );
  assert.throws(
    () =>
      generateLevel(
        {
          ...broken,
          generate: () => {
            throw Error('bad schema');
          },
        },
        context,
        true,
      ),
    /bad schema/,
  );
});
test('bad maps, required rewards, behavior references and sealed targets are rejected', () => {
  assert.throws(() => compileTileMap({ ...plain, rows: ['?'] }), /unknown tile/);
  assert.throws(
    () => compileTileMap({ ...plain, rows: ['BB'], legend: { B: { kind: 'brick', span: 2 } } }),
    /overlapping/,
  );
  assert.throws(() => compileTileMap({ ...plain, rows: ['B', 'BB'] }), /ragged/);
  assert.ok(validateBoard(compileTileMap(plain), { triple: 1 }).some((e) => e.includes('required')));
  const bad = compileTileMap(plain);
  bad.bricks[0].chamber = 9;
  assert.ok(validateBoard(bad).some((e) => e.includes('reference')));
  const sealed = compileTileMap({
    ...plain,
    rows: ['#####', '#...#', '#.B.#', '#...#', '#####'],
    legend: { ...plain.legend, '#': { kind: 'steel' } },
  });
  assert.ok(validateBoard(sealed).some((e) => e.includes('unreachable')));
});
test('seeded swarm physics stay finite and capped across representative variations', () => {
  for (let seed = 0; seed < 12; seed++) {
    const game = new Breakout(1, seed);
    game.launch();
    for (let i = 0; i < 4; i++) game.power('triple', game.balls[0]);
    for (let tick = 0; tick < 2400 && game.status === 'playing'; tick++) {
      game.move(game.balls.find((b) => b.vy > 0)?.x ?? 360);
      game.step(1 / 240);
      game.hits = [];
      assert.ok(game.balls.length <= MAX_BALLS);
      assert.ok(game.balls.every((b) => [b.x, b.y, b.vx, b.vy].every(Number.isFinite)));
    }
  }
});
test('authored fallback is valid with every required reward and does not mutate the map', () => {
  const before = JSON.stringify(TWIN_VAULTS_MAP);
  assert.deepEqual(validateBoard(twinVaults.fallback(context), twinVaults.requiredRewards), []);
  for (let seed = 0; seed < 8; seed++) generateWave(1, seed);
  assert.equal(JSON.stringify(TWIN_VAULTS_MAP), before);
});
