import test from "node:test";
import assert from "node:assert/strict";
import { CELL, COLS, Farm, makeField, TOOLS, W, H } from "./engine";
const idle = { throttle: 0, steer: 0 };
function tick(game: Farm, seconds: number, input = idle) {
  for (let n = 0; n < seconds * 60; n++) game.step(1 / 60, input);
}
test("fields are deterministic and workable cells exclude obstacle safety margins", () => {
  for (let level = 1; level <= 6; level++)
    for (let seed = 1; seed <= 20; seed++) {
      const field = makeField(level, seed);
      assert.deepEqual(field, makeField(level, seed));
      assert.equal(
        field.total,
        field.mask.reduce((a, b) => a + b, 0),
      );
      assert.ok(field.total > 8000);
      field.mask.forEach((v, i) => {
        if (v)
          for (const o of field.obstacles)
            assert.ok(
              Math.hypot(
                ((i % COLS) + 0.5) * CELL - o.x,
                (Math.floor(i / COLS) + 0.5) * CELL - o.y,
              ) >=
                o.r + 13,
            );
      });
    }
});
test("standing still costs nothing; reversing burns fuel without ploughing", () => {
  const game = new Farm(makeField(1));
  tick(game, 300);
  assert.equal(game.fuel, game.fuelCapacity);
  assert.equal(game.covered, 0);
  tick(game, 5, { throttle: -1, steer: 0 });
  assert.equal(game.covered, 0);
  assert.ok(game.fuel < game.fuelCapacity);
  assert.equal(game.status, "playing");
  const practice = new Farm(makeField(1), 1, true);
  tick(practice, 260);
  assert.equal(practice.status, "playing");
});
test("forward blade leaves a contiguous strip and wider blades cover more ground", () => {
  const counts = TOOLS.map((_, tool) => {
    const game = new Farm(makeField(1), tool);
    tick(game, 5, { throttle: 1, steer: 0 });
    for (let y = Math.ceil((game.y + 30) / CELL) * CELL; y < 670; y += CELL)
      assert.ok(game.soil[Math.floor(y / CELL) * COLS + Math.floor(86 / CELL)]);
    assert.ok(game.efficiency > 0.95);
    return game.covered;
  });
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
});
test("collisions stop motion without per-frame penalties and reverse allows recovery", () => {
  const game = new Farm(makeField(2));
  const o = game.field.obstacles[0];
  game.x = o.x;
  game.y = o.y + o.r + 13;
  game.angle = -Math.PI / 2;
  tick(game, 1, { throttle: 1, steer: 0 });
  assert.equal(game.hits, 1);
  assert.ok(game.y >= o.y + o.r + 12);
  const y = game.y;
  tick(game, 1, { throttle: -1, steer: 0 });
  assert.ok(game.y > y + 10);
});
test("a completed field wins once and freezes its result", () => {
  const game = new Farm(makeField(1));
  game.covered = Math.ceil(game.field.total * 0.98);
  game.worked = game.covered;
  game.step(1 / 60, idle);
  assert.equal(game.status, "won");
  assert.equal(game.stars, 3);
  const time = game.elapsed;
  tick(game, 1);
  assert.equal(game.elapsed, time);
});
test("seeded random controls preserve bounds and coverage invariants", () => {
  for (let level = 1; level <= 6; level++)
    for (let tool = 0; tool < 3; tool++) {
      const game = new Farm(makeField(level), tool);
      for (let n = 0; n < 10000; n++) {
        game.step(1 / 60, {
          throttle: Math.sin(n / 113) > -0.3 ? 1 : -1,
          steer: Math.sin(n / 79),
        });
        assert.ok(
          game.x >= 22 && game.x <= W - 22 && game.y >= 22 && game.y <= H - 22,
        );
        assert.ok(
          game.covered <= game.field.total && game.worked >= game.covered,
        );
        assert.ok(Number.isFinite(game.score));
        assert.ok(game.fuel >= 0 && game.fuel <= game.fuelCapacity);
      }
    }
});

test("fuel follows actual distance, with a working surcharge and no blocked burn", () => {
  const grass = new Farm(makeField(1));
  grass.x = 40;
  grass.y = 650;
  tick(grass, 2, { throttle: 1, steer: 0 });
  assert.ok(Math.abs(grass.fuelCapacity - grass.fuel - grass.distance) < 1e-7);
  const soil = new Farm(makeField(1));
  soil.x = 300;
  soil.y = 600;
  tick(soil, 2, { throttle: 1, steer: 0 });
  assert.ok(
    Math.abs(soil.fuelCapacity - soil.fuel - soil.distance * 1.25) < 1e-7,
  );
  soil.x = 22;
  soil.angle = Math.PI;
  soil.speed = 0;
  const fuel = soil.fuel;
  tick(soil, 3, { throttle: 1, steer: 0 });
  assert.equal(soil.fuel, fuel);
});
test("empty tanks end the contract and practice can continue the same field", () => {
  const game = new Farm(makeField(1));
  game.fuel = 0.2;
  tick(game, 1, { throttle: 1, steer: 0 });
  assert.equal(game.status, "lost");
  assert.equal(game.fuel, 0);
  const x = game.x,
    y = game.y;
  tick(game, 3, { throttle: 1, steer: 0 });
  assert.deepEqual([game.x, game.y], [x, y]);
  game.practice = true;
  game.status = "playing";
  tick(game, 4, { throttle: 1, steer: 0 });
  assert.equal(game.status, "playing");
  assert.ok(game.covered > 0);
  assert.equal(game.fuel, 0);
});
test("stars and scores reward fuel remaining, never speed or waiting", () => {
  const game = new Farm(makeField(1));
  game.status = "won";
  game.covered = game.field.total;
  for (const [fuel, stars] of [
    [0, 1],
    [0.149, 1],
    [0.15, 2],
    [0.299, 2],
    [0.3, 3],
  ]) {
    game.fuel = game.fuelCapacity * fuel;
    assert.equal(game.stars, stars);
  }
  const score = game.score;
  game.elapsed = 99999;
  game.hits = 10;
  assert.equal(game.score, score);
});
test("fuel burn is stable across fixed step frequencies", () => {
  const results = [30, 60, 120].map((hz) => {
    const game = new Farm(makeField(1));
    game.x = 300;
    game.y = 600;
    game.speed = TOOLS[1].speed;
    for (let i = 0; i < hz * 2; i++)
      game.step(1 / hz, { throttle: 1, steer: 0 });
    return game.fuel;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-6);
});
