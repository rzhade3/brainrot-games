import test from 'node:test';
import assert from 'node:assert/strict';
import { Breakout, MAX_BALLS, PADDLE_Y, H, W, R, TOP } from './engine';
import { makeLevel, LEVEL_NAMES } from './levels';
const dt = 1 / 240;
const origin = { x: 360, y: 740, vx: 60, vy: -520 };
function running(wave = 1) { const g = new Breakout(wave); g.launch(); return g; }
function isolate() { const g = running(); g.obstacles = []; return g; }

test('eleven distinct layouts vary counts and bound armor', () => {
  const signatures = new Set<string>(), counts = new Set<number>();
  for (let wave = 1; wave <= 33; wave++) {
    const l = makeLevel(wave);
    if (!l.chambers) assert.equal(new Set(l.bricks.flatMap(b => b.power ? [b.power] : [])).size, 7);
    if (!l.chambers) assert.equal(l.bricks.filter(b => b.power).length, 8);
    assert.ok(l.bricks.every(b => b.hp > 0 && b.hp <= 6 && b.x >= 12 && b.x + b.w <= W - 12 && b.y + b.h < PADDLE_Y - 120));
    if (wave <= LEVEL_NAMES.length) { signatures.add(JSON.stringify(l.bricks.map(b => [b.x, b.y]))); counts.add(l.bricks.length); }
    assert.deepEqual(makeLevel(wave), l);
  }
  assert.equal(signatures.size, LEVEL_NAMES.length); assert.ok(counts.size >= 6);
});
test('bricks never overlap each other or permanent obstacles', () => {
  for (let wave = 1; wave <= LEVEL_NAMES.length; wave++) {
    const { bricks, obstacles } = makeLevel(wave);
    for (const [i, b] of bricks.entries()) {
      for (const other of bricks.slice(i + 1)) assert.ok(b.x + b.w <= other.x || other.x + other.w <= b.x || b.y + b.h <= other.y || other.y + other.h <= b.y, `Overlapping bricks in ${wave}`);
      for (const o of obstacles) {
        if (o.kind === 'steel') assert.ok(b.x + b.w <= o.x || o.x + o.w <= b.x || b.y + b.h <= o.y || o.y + o.h <= b.y, `Steel overlap in ${wave}`);
        else { const dx = o.x - Math.max(b.x, Math.min(o.x, b.x + b.w)), dy = o.y - Math.max(b.y, Math.min(o.y, b.y + b.h)); assert.ok(Math.hypot(dx, dy) > o.radius, `Bumper overlap in ${wave}`); }
      }
    }
  }
});
test('all targets are accessible from below around obstacles for a ball-sized center', () => {
  // Conservative 6-unit flood: remove destructible bricks, expand permanent solids by R+2.
  // Proves no sealed steel/bumper enclosure; gameplay controllers assess practical reachability.
  const size = 6, nx = Math.floor(W / size), ny = Math.floor(H / size);
  for (let wave = 1; wave <= LEVEL_NAMES.length; wave++) {
    const { bricks, obstacles } = makeLevel(wave);
    const seen = new Uint8Array(nx * ny), queue: number[] = [];
    function free(x: number, y: number) {
      if (x < 12 + R || x > W - 12 - R || y < TOP + R || y > H - R) return false;
      return !obstacles.some(o => o.kind === 'steel' ? x > o.x - R - 2 && x < o.x + o.w + R + 2 && y > o.y - R - 2 && y < o.y + o.h + R + 2 : Math.hypot(x - o.x, y - o.y) < o.radius + R + 2);
    }
    const start = Math.floor(PADDLE_Y / size) * nx + Math.floor(W / 2 / size); queue.push(start); seen[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head], col = index % nx, row = Math.floor(index / nx);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = col + dc, r = row + dr, next = r * nx + c;
        if (c >= 0 && c < nx && r >= 0 && r < ny && !seen[next] && free(c * size, r * size)) { seen[next] = 1; queue.push(next); }
      }
    }
    for (const b of bricks) {
      const samples = [[b.x + b.w / 2, b.y - R - 10], [b.x + b.w / 2, b.y + b.h + R + 10], [b.x - R - 10, b.y + b.h / 2], [b.x + b.w + R + 10, b.y + b.h / 2]];
      assert.ok(samples.some(([x, y]) => seen[Math.round(y / size) * nx + Math.round(x / size)]), `Sealed target ${wave}:${b.x},${b.y}`);
    }
  }
});
test('single-ball launch, exact +3/×3 arithmetic, cap, and distinct split trajectories', () => {
  const g = running(); assert.equal(g.balls.length, 1);
  g.power('add', origin); assert.equal(g.balls.length, 4);
  g.power('triple', origin); assert.equal(g.balls.length, 12);
  g.power('triple', origin); assert.equal(g.balls.length, 36);
  g.power('triple', origin); assert.equal(g.balls.length, MAX_BALLS);
  g.power('add', origin); assert.equal(g.balls.length, MAX_BALLS);
  assert.ok(new Set(g.balls.map(b => b.vx.toFixed(2))).size > 4);
});
test('temporary buffs expire, repeated wide/save cannot compound, and timers freeze outside play', () => {
  const g = running();
  for (let i = 0; i < 20; i++) for (const kind of ['wide', 'shield', 'slow', 'fire'] as const) g.power(kind, origin);
  assert.equal(g.width, 162); assert.equal(g.shields, 1); assert.equal(g.slow, 10); assert.equal(g.fire, 8);
  g.wide = dt / 2; g.fire = dt / 2; g.slow = dt / 2; g.step(dt);
  assert.equal(g.width, g.baseWidth); assert.equal(g.fire, 0); assert.equal(g.slow, 0);
  g.status = 'ready'; g.fire = 4; g.step(dt); assert.equal(g.fire, 4);
});
test('paddle edges aim returns, center avoids a vertical loop, and speed stays bounded', () => {
  for (const offset of [-45, 0, 45]) {
    const g = isolate(); g.rally = 1000;
    g.balls = [{ x: g.paddle + offset, y: PADDLE_Y - R - 1, vx: 0, vy: 980 }]; g.step(dt);
    assert.ok(g.balls[0].vy < 0); assert.ok(g.balls[0].vx !== 0); assert.ok(Math.hypot(g.balls[0].vx, g.balls[0].vy) <= 980.001);
    if (offset) assert.equal(Math.sign(g.balls[0].vx), Math.sign(offset));
  }
});
test('maximum-speed corner/side collisions separate balls without repeated damage', () => {
  const g = isolate();
  g.bricks = [{ x: 100, y: 200, w: 42, h: 23, hp: 3, maxHp: 3 }];
  g.balls = [{ x: 120, y: 230, vx: 0, vy: -980 }];
  g.step(dt); assert.equal(g.bricks[0].hp, 2); assert.ok(g.balls[0].vy > 0);
  for (let i = 0; i < 4; i++) g.step(dt);
  assert.equal(g.bricks[0].hp, 2);
});
test('bombs damage armor by two and chain fragile powers without touching steel', () => {
  const g = isolate(); g.obstacles = [{ kind: 'steel', x: 130, y: 100, w: 100, h: 18 }];
  g.bricks = [
    { x: 100, y: 200, w: 42, h: 23, hp: 1, maxHp: 1, power: 'bomb' },
    { x: 147, y: 200, w: 42, h: 23, hp: 1, maxHp: 1, power: 'add' },
    { x: 100, y: 160, w: 42, h: 23, hp: 4, maxHp: 4 },
    { x: 600, y: 200, w: 42, h: 23, hp: 1, maxHp: 1 },
  ];
  g.balls = [{ x: 120, y: 230, vx: 0, vy: -980 }]; g.step(dt);
  assert.deepEqual(g.bricks.map(b => b.hp), [0, 0, 2, 1]); assert.equal(g.balls.length, 4);
  assert.deepEqual(g.obstacles, [{ kind: 'steel', x: 130, y: 100, w: 100, h: 18 }]);
});
test('fire pierces armor but reflects off steel; bumpers reflect on their radial normal and cap boosts', () => {
  const g = isolate(); g.fire = 4;
  g.obstacles = [{ kind: 'steel', x: 100, y: 200, w: 42, h: 23 }];
  g.balls = [{ x: 120, y: 230, vx: 0, vy: -980 }]; g.step(dt);
  assert.ok(g.balls[0].vy > 0); assert.equal(g.score, 0);
  g.obstacles = []; g.bricks = [{ x: 100, y: 200, w: 42, h: 23, hp: 5, maxHp: 5 }, { x: 600, y: 200, w: 42, h: 23, hp: 1, maxHp: 1 }];
  g.balls = [{ x: 120, y: 230, vx: 0, vy: -980 }]; g.step(dt); assert.equal(g.bricks[0].hp, 0); assert.ok(g.balls[0].vy < 0);
  g.obstacles = [{ kind: 'bumper', x: 300, y: 400, radius: 30 }];
  g.balls = [{ x: 337, y: 400, vx: -970, vy: 0 }]; g.step(dt);
  assert.ok(g.balls[0].vx > 0); assert.ok(g.balls[0].x > 336); assert.ok(Math.hypot(g.balls[0].vx, g.balls[0].vy) <= 980.001);
});
test('only final ball loss costs a life, loss resets all upgrades, and runs have exactly three lives', () => {
  const g = isolate(); g.power('wide', origin); g.shields = 1;
  g.balls = [{ x: 30, y: H - 33, vx: 0, vy: 500 }, { ...origin }];
  g.step(dt); assert.equal(g.shields, 0); assert.ok(g.balls[0].vy < 0);
  g.balls[0].y = H + 20; g.step(dt); assert.equal(g.lives, 3);
  g.balls[0].y = H + 20; g.step(dt); assert.equal(g.lives, 2); assert.equal(g.width, g.baseWidth); assert.equal(g.status, 'ready');
  for (let i = 0; i < 2; i++) { g.launch(); g.balls.forEach(b => b.y = H + 20); g.step(dt); }
  assert.equal(g.status, 'over'); assert.equal(g.lives, 0);
});
test('clear excludes permanent obstacles, empties the swarm, resets buffs, and never awards lives', () => {
  const g = running(); g.power('triple', origin); g.power('wide', origin); g.power('fire', origin); g.power('shield', origin);
  g.bricks.forEach(b => b.hp = 0); g.step(dt);
  assert.equal(g.status, 'cleared'); assert.equal(g.wave, 1); assert.equal(g.lives, 3); assert.equal(g.balls.length, 0);
  assert.equal(g.width, g.baseWidth); assert.equal(g.fire, 0); assert.equal(g.shields, 0); assert.ok(g.obstacles.length > 0);
  g.nextWave(); assert.equal(g.wave, 2); assert.equal(g.status, 'ready'); assert.equal(g.balls.length, 0); assert.equal(g.lives, 3);
  g.launch(); assert.equal(g.balls.length, 1); assert.equal(g.name, 'Nested rings');
  g.nextWave(); assert.equal(g.wave, 2);
});
test('repeating flights are nudged without a teleport or speed explosion', () => {
  const g = isolate(); g.balls = [{ x: 300, y: 700, vx: 700, vy: 0, flight: 14.1 }]; g.step(dt);
  assert.ok(g.balls[0].vy > 0); assert.ok(Math.abs(g.balls[0].x - 300) < 5); assert.ok(g.balls[0].y - 700 < 5);
});
test('full-army simulation is finite and bounded across all eleven geometries', () => {
  for (let wave = 1; wave <= LEVEL_NAMES.length; wave++) {
    const g = running(wave); for (let i = 0; i < 4; i++) g.power('triple', origin);
    for (let i = 0; i < 2400 && g.status === 'playing'; i++) { g.move(g.balls.find(b => b.vy > 0)?.x ?? W / 2); g.step(dt); g.hits = []; }
    assert.ok(g.balls.length <= MAX_BALLS);
    assert.ok(g.balls.every(b => [b.x, b.y, b.vx, b.vy].every(Number.isFinite) && b.x >= 12 && b.x <= W - 12 && b.y > 0));
  }
});

test('breaking a chamber gate sends the original and bonus balls into the room', () => {
  const g = running(); const gate = g.bricks.find(b => b.gate && b.power === 'add')!;
  g.balls = [{ x: gate.x + gate.w / 2, y: gate.y + gate.h + R + 1, vx: 0, vy: -520 }];
  const before = g.chambers[gate.chamber!].remaining;
  g.step(dt);
  assert.equal(gate.hp, 0); assert.equal(g.balls.length, 4);
  assert.ok(g.balls.every(b => b.vy < 0));
  assert.equal(g.chambers[gate.chamber!].remaining, before - 1);
  assert.ok(g.hits.some(h => h.text === 'BREACH'));
});
test('floor release is one-shot, keeps permanent walls, freezes outside play, and survives life loss', () => {
  const g = running(); const room = g.chambers[0];
  room.remaining--; room.activeTime = 28 - dt / 2;
  const solids = g.obstacles.filter(o => o.kind !== 'steel' || o.vent === undefined);
  g.status = 'ready'; g.step(dt); assert.equal(room.opened, false);
  g.launch(); g.step(dt); assert.equal(room.opened, true);
  assert.ok(!g.obstacles.some(o => o.kind === 'steel' && o.vent === 0));
  assert.ok(solids.every(o => g.obstacles.includes(o)));
  const count = g.hits.filter(h => h.text === 'OPEN').length;
  g.step(dt); assert.equal(g.hits.filter(h => h.text === 'OPEN').length, count);
  g.balls.forEach(b => b.y = H + 20); g.step(dt);
  assert.equal(g.status, 'ready'); assert.equal(room.opened, true);
  g.launch(); assert.ok(!g.obstacles.some(o => o.kind === 'steel' && o.vent === 0));
});
test('mostly emptied chambers release early, while undamaged rooms stay closed', () => {
  const g = running(); g.chambers[0].remaining = Math.floor(g.chambers[0].initial * .18);
  g.step(dt); assert.equal(g.chambers[0].opened, true); assert.equal(g.chambers[1].opened, false);
});
test('chamber state and walls reset on a new wave with exactly one served ball', () => {
  const g = running(); g.chambers[0].remaining = 0; g.step(dt);
  g.bricks.forEach(b => b.hp = 0); g.step(dt); g.nextWave();
  assert.equal(g.chambers.length, 3);
  assert.ok(g.chambers.every(c => !c.opened && c.activeTime === 0 && c.remaining === c.initial));
  assert.equal(g.balls.length, 0); g.launch(); assert.equal(g.balls.length, 1);
});
test('fresh chamber generation has independent mutable state and readable rewards', () => {
  for (let wave = 1; wave <= 3; wave++) {
    const a = makeLevel(wave), b = makeLevel(wave);
    assert.ok(a.bricks.length > 300);
    assert.ok(a.bricks.filter(b => b.power).every(b => b.w >= 38));
    assert.ok(a.chambers!.every(c => c.initial === a.bricks.filter(b => b.chamber === c.id).length));
    a.chambers![0].opened = true; a.bricks[0].hp = 0;
    assert.equal(b.chambers![0].opened, false); assert.ok(b.bricks[0].hp > 0);
  }
});
