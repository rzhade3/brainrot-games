import test from 'node:test';
import assert from 'node:assert/strict';
import { Breakout, makeWave, MAX_BALLS, PADDLE_Y, H, W, R } from './engine';
const dt = 1 / 240;
const origin = { x: 360, y: 650, vx: 0, vy: -470 };
function running() { const g = new Breakout(); g.launch(); return g; }

test('dense waves guarantee every power and increase armor with a bound', () => {
  for (const wave of [1, 2, 10, 1000]) {
    const bricks = makeWave(wave);
    assert.equal(bricks.length, 210);
    assert.equal(new Set(bricks.flatMap(b => b.power ? [b.power] : [])).size, 7);
    assert.ok(bricks.every(b => b.hp > 0 && b.hp <= 5 && b.x >= 12 && b.x + b.w <= W - 12));
  }
});
test('ball arithmetic: +3 adds exactly three; ×3 triples the whole army and caps at 128', () => {
  const g = running(); assert.equal(g.balls.length, 3);
  g.power('add', origin); assert.equal(g.balls.length, 6);
  g.power('triple', origin); assert.equal(g.balls.length, 18);
  g.power('triple', origin); assert.equal(g.balls.length, 54);
  g.power('triple', origin); assert.equal(g.balls.length, MAX_BALLS);
  g.power('add', origin); assert.equal(g.balls.length, MAX_BALLS);
  assert.ok(g.balls.every(b => Number.isFinite(b.vx) && b.vy < 0));
});
test('upgrades stack within bounds and clamp the paddle after growing', () => {
  const g = running(); g.move(9999);
  for (let i = 0; i < 20; i++) { g.power('wide', origin); g.power('shield', origin); g.power('slow', origin); g.power('fire', origin); }
  assert.equal(g.width, 300); assert.equal(g.shields, 5); assert.equal(g.slow, 24); assert.equal(g.fire, 24);
  assert.ok(g.paddle + g.width / 2 <= W - 12);
  g.step(dt); assert.ok(g.fire < 24 && g.slow < 24);
});
test('paddle edges aim shots and prevent a downward crossing', () => {
  for (const offset of [-45, 0, 45]) {
    const g = running();
    g.balls = [{ x: g.paddle + offset, y: PADDLE_Y - R - 1, vx: 0, vy: 800 }];
    g.step(dt);
    assert.ok(g.balls[0].vy < 0);
    assert.equal(Math.sign(g.balls[0].vx), Math.sign(offset));
    assert.ok(g.balls[0].y <= PADDLE_Y - R);
  }
});
test('high-speed brick collision reflects once and removes one armor point', () => {
  const g = running();
  g.bricks = [{ x: 100, y: 200, w: 47, h: 27, hp: 3, maxHp: 3 }];
  g.balls = [{ x: 120, y: 235, vx: 0, vy: -900 }];
  g.step(dt); assert.equal(g.bricks[0].hp, 2); assert.ok(g.balls[0].vy > 0);
  g.step(dt); assert.equal(g.bricks[0].hp, 2);
});
test('bombs chain through adjacent powers exactly once', () => {
  const g = running();
  g.bricks = [
    { x: 100, y: 200, w: 47, h: 27, hp: 1, maxHp: 1, power: 'bomb' },
    { x: 149, y: 200, w: 47, h: 27, hp: 1, maxHp: 1, power: 'bomb' },
    { x: 198, y: 200, w: 47, h: 27, hp: 1, maxHp: 1, power: 'add' },
    { x: 600, y: 200, w: 47, h: 27, hp: 1, maxHp: 1 },
  ];
  g.balls = [{ x: 120, y: 235, vx: 0, vy: -900 }];
  g.step(dt);
  assert.deepEqual(g.bricks.map(b => b.hp), [0, 0, 0, 1]);
  assert.equal(g.balls.length, 4); assert.equal(g.score, 60);
});
test('fire destroys armor and passes through; slow changes distance without changing velocity', () => {
  const g = running(); g.fire = 10;
  g.bricks = [{ x: 100, y: 200, w: 47, h: 27, hp: 5, maxHp: 5 }, { x: 600, y: 200, w: 47, h: 27, hp: 1, maxHp: 1 }];
  g.balls = [{ x: 120, y: 235, vx: 0, vy: -900 }]; g.step(dt);
  assert.equal(g.bricks[0].hp, 0); assert.ok(g.balls[0].vy < 0);
  g.slow = 10; g.balls = [{ ...origin }]; g.step(dt);
  assert.ok(Math.abs(g.balls[0].y - (650 - 470 * dt * .65)) < .00001);
});
test('only the final lost ball costs a life; saves bounce one ball', () => {
  const g = running(); g.shields = 1;
  g.balls = [{ x: 30, y: H - 24, vx: 0, vy: 500 }, { ...origin }];
  g.step(dt); assert.equal(g.shields, 0); assert.ok(g.balls[0].vy < 0);
  g.balls[0].y = H + 20; g.step(dt); assert.equal(g.lives, 3);
  g.balls[0].y = H + 20; g.step(dt); assert.equal(g.lives, 2); assert.equal(g.status, 'ready');
  for (let i = 0; i < 2; i++) { g.launch(); g.balls.forEach(b => b.y = H + 20); g.step(dt); }
  assert.equal(g.status, 'over'); assert.equal(g.lives, 0);
});
test('clearing a wall advances once, retains upgrades and army, and awards a life', () => {
  const g = running(); g.power('wide', origin); g.power('fire', origin);
  g.bricks.forEach(b => b.hp = 0); g.step(dt);
  assert.equal(g.wave, 2); assert.equal(g.lives, 4); assert.equal(g.balls.length, 3); assert.equal(g.width, 160);
  assert.ok(g.fire > 0); assert.equal(g.score, 1000); assert.ok(g.balls.every(b => b.y === 650));
  g.step(dt); assert.equal(g.wave, 2);
});
test('wall and ceiling bounces stay finite under a full army simulation', () => {
  const g = running(); for (let i = 0; i < 4; i++) g.power('triple', origin);
  g.balls[0] = { x: 17, y: 70, vx: -900, vy: -900 };
  g.step(dt); assert.ok(g.balls[0].vx > 0 && g.balls[0].vy > 0);
  for (let i = 0; i < 2400 && g.status === 'playing'; i++) { g.move(g.balls[0]?.x ?? W / 2); g.step(dt); g.hits = []; }
  assert.ok(g.balls.length <= MAX_BALLS);
  assert.ok(g.balls.every(b => [b.x, b.y, b.vx, b.vy].every(Number.isFinite)));
});
