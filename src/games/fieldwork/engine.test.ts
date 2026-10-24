import test from 'node:test';
import assert from 'node:assert/strict';
import { CELL, COLS, Farm, makeField, TOOLS, W, H } from './engine';
const idle = {throttle: 0, steer: 0};
function tick(game: Farm, seconds: number, input = idle) { for (let n = 0; n < seconds * 60; n++) game.step(1 / 60, input); }
test('fields are deterministic and every workable cell is reachable by the blade outside obstacle collision radii', () => {
  for (let level = 1; level <= 6; level++) for (let seed = 1; seed <= 20; seed++) {
    const field = makeField(level, seed);
    assert.deepEqual(field, makeField(level, seed));
    assert.equal(field.total, field.mask.reduce((a, b) => a + b, 0));
    assert.ok(field.total > 8000);
    field.mask.forEach((v, i) => { if (v) for (const o of field.obstacles) assert.ok(Math.hypot((i % COLS + .5) * CELL - o.x, (Math.floor(i / COLS) + .5) * CELL - o.y) >= o.r + 13); });
  }
});
test('stationary and reverse driving never plough; contracts time out, practice does not', () => {
  const game = new Farm(makeField(1)); tick(game, 20); assert.equal(game.covered, 0);
  tick(game, 5, { throttle: -1, steer: 0 }); assert.equal(game.covered, 0);
  tick(game, 240); assert.equal(game.status, 'lost');
  const practice = new Farm(makeField(1), 1, true); tick(practice, 260); assert.equal(practice.status, 'playing');
});
test('forward blade leaves a contiguous strip and wider blades cover more ground', () => {
  const counts = TOOLS.map((_, tool) => { const game = new Farm(makeField(1), tool); tick(game, 5, { throttle: 1, steer: 0 });
    for (let y = Math.ceil((game.y + 30) / CELL) * CELL; y < 670; y += CELL) assert.ok(game.soil[Math.floor(y / CELL) * COLS + Math.floor(86 / CELL)]);
    assert.ok(game.efficiency > .95); return game.covered;
  });
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
});
test('collisions stop motion without per-frame penalties and reverse allows recovery', () => {
  const game = new Farm(makeField(2)); const o = game.field.obstacles[0];
  game.x = o.x; game.y = o.y + o.r + 13; game.angle = -Math.PI / 2;
  tick(game, 1, { throttle: 1, steer: 0 }); assert.equal(game.hits, 1); assert.ok(game.y >= o.y + o.r + 12);
  const y = game.y; tick(game, 1, { throttle: -1, steer: 0 }); assert.ok(game.y > y + 10);
});
test('a completed field wins once and freezes its result', () => {
  const game = new Farm(makeField(1)); game.covered = Math.ceil(game.field.total * .98); game.worked = game.covered;
  game.step(1 / 60, idle); assert.equal(game.status, 'won'); assert.equal(game.stars, 3);
  const time = game.elapsed; tick(game, 1); assert.equal(game.elapsed, time);
});
test('seeded random controls preserve bounds and coverage invariants', () => {
  for (let level = 1; level <= 6; level++) for (let tool = 0; tool < 3; tool++) {
    const game = new Farm(makeField(level), tool);
    for (let n = 0; n < 10000; n++) {
      game.step(1 / 60, { throttle: Math.sin(n / 113) > -.3 ? 1 : -1, steer: Math.sin(n / 79) });
      assert.ok(game.x >= 22 && game.x <= W - 22 && game.y >= 22 && game.y <= H - 22);
      assert.ok(game.covered <= game.field.total && game.worked >= game.covered);
      assert.ok(Number.isFinite(game.score));
    }
  }
});
