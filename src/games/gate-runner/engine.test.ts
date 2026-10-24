import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, GateRunner, offers, STEP, squadPower, type Enemy, type Upgrade } from './engine';

const enemy = (id: number, z: number, kind: Enemy['kind'] = 'grunt'): Enemy => ({ id, x: 0, z, kind, hp: 100, maxHp: 100, cooldown: 0, warning: 0, aim: 0, spawned: 0 });
function emptyGame() {
  const g = new GateRunner(42); g.start();
  g.state.enemies = []; g.state.gates = []; g.state.hazards = [];
  return g;
}
test('generation varies across seeds but remains deterministic and navigable', () => {
  assert.deepEqual(generate(123, 3), generate(123, 3));
  assert.notDeepEqual(generate(123, 3), generate(124, 3));
  for (let seed = 0; seed < 200; seed++) for (let stage = 1; stage <= 5; stage++) {
    const level = generate(seed, stage);
    assert.equal(level.segments.filter(s => s.kind === 'gates').length, 3);
    const ids = level.segments.flatMap(s => s.enemies?.map(e => e.id) ?? []);
    assert.equal(new Set(ids).size, ids.length);
    for (const segment of level.segments) {
      if (segment.gates) assert.deepEqual(segment.gates.map(g => g.x).sort(), [-2, 2]);
      if (segment.hazards) assert.equal(segment.hazards.length, 1);
    }
  }
});
test('one frame awards completion once and stops ticking', () => {
  const g = emptyGame(); g.state.z = g.level.length - .01;
  g.step(.1);
  assert.equal(g.state.status, 'choice'); assert.equal(g.state.score, 346);
  const state = g.snapshot(); g.step(.1); assert.deepEqual(g.state, state);
});
test('reject invalid time and steering; clamp movement speed', () => {
  const g = emptyGame(), state = g.snapshot();
  for (const dt of [NaN, Infinity, -1, 0]) g.step(dt);
  for (const x of [NaN, Infinity]) g.steer(x);
  assert.deepEqual(g.state, state);
  g.steer(100); g.step(STEP); assert.ok(g.state.x <= 8 / 60); assert.equal(g.state.targetX, 3.2);
});
test('gate center awards exactly one choice, once', () => {
  const g = emptyGame();
  g.state.gates = [-2, 2].map(x => ({ x, z: 0, kind: 'add', value: 10, used: false }));
  g.step(.1); assert.equal(g.state.soldiers, 22); assert.ok(g.state.gates.every(x => x.used));
});
test('piercing shot cannot damage the same enemy on successive frames', () => {
  const g = emptyGame(); g.state.nextShot = 999;
  g.state.enemies = [enemy(1, 5), enemy(2, 7)];
  g.state.shots = [{ x: 0, z: 4.5, vx: 0, vz: 10, damage: 10, pierce: 1, hits: [] }];
  for (let i = 0; i < 20; i++) g.step(STEP);
  assert.equal(g.state.enemies[0].hp, 90); assert.equal(g.state.enemies[1].hp, 90);
});
test('shots aim toward off-axis targets', () => {
  const g = emptyGame(); g.state.enemies = [{ ...enemy(1, 12), x: 1.5 }];
  g.step(STEP); assert.ok(g.state.shots[0].vx > 0);
});
test('collision and breach each resolve once without kill rewards', () => {
  const g = emptyGame(); g.state.nextShot = 999;
  g.state.enemies = [enemy(1, 0), { ...enemy(2, -2), x: 3 }];
  g.step(.1); assert.equal(g.state.soldiers, 8);
  assert.equal(g.state.kills, 0); assert.equal(g.state.breaches, 1);
  g.step(.1); assert.equal(g.state.soldiers, 8);
});
test('boss stops scrolling until defeated', () => {
  const g = emptyGame(); g.state.z = 149.99; g.state.enemies = [enemy(1, 166, 'boss')];
  g.step(.1); assert.equal(g.state.z, 150); assert.equal(g.state.status, 'playing');
  g.state.enemies[0].hp = 0; g.step(.1); assert.ok(g.state.z > 150);
});
test('sniper telegraphs before shooting; spawner has bounded offspring', () => {
  const g = emptyGame(); g.state.nextShot = 999;
  g.state.enemies = [enemy(1, 25, 'sniper'), enemy(2, 20, 'spawner')];
  g.step(STEP); assert.ok(g.state.enemies[0].warning > 0); assert.equal(g.state.dangers.length, 0);
  for (let i = 0; i < 45; i++) g.step(STEP);
  assert.ok(g.state.dangers.length > 0);
  assert.ok(g.state.enemies.filter(e => e.kind === 'runner').length <= 2);
});
test('all offered upgrades have effects; forged/repeated choices rejected', () => {
  const covered = new Set<Upgrade>();
  for (let seed = 1; seed < 30; seed++) for (const upgrade of offers(seed, 1)) {
    const g = new GateRunner(seed); g.state.status = 'choice';
    const before = [g.state.soldiers, g.state.damage, g.state.rate, g.state.pierce];
    g.choose(upgrade); covered.add(upgrade);
    assert.notDeepEqual([g.state.soldiers, g.state.damage, g.state.rate, g.state.pierce], before);
    assert.equal(g.state.stage, 2); g.choose(upgrade); assert.equal(g.state.stage, 2);
  }
  assert.equal(covered.size, 4);
  const g = new GateRunner(3); g.state.status = 'choice'; g.choose('invalid' as Upgrade); assert.equal(g.state.stage, 1);
});
test('offers are reproducible with three unique upgrades', () => {
  for (let seed = 0; seed < 100; seed++) {
    assert.deepEqual(offers(seed, 2), offers(seed, 2)); assert.equal(new Set(offers(seed, 2)).size, 3);
  }
});
test('fixed-step trajectory agrees across 30 and 60 FPS', () => {
  const a = new GateRunner(12), b = new GateRunner(12); a.start(); b.start(); a.steer(2); b.steer(2);
  for (let i = 0; i < 300; i++) a.step(1 / 30);
  for (let i = 0; i < 600; i++) b.step(1 / 60);
  assert.deepEqual(a.snapshot(), b.snapshot());
});


test('auto fire requires alignment instead of clearing the entire road', () => {
  const g = emptyGame(); g.state.enemies = [{ ...enemy(1, 12), x: 3 }];
  g.step(STEP); assert.equal(g.state.shots.length, 0);
  g.steer(3); for (let i = 0; i < 20; i++) g.step(STEP);
  assert.ok(g.state.shots.length > 0 || g.state.enemies[0].hp < 100);
});
test('boss lane barrage leaves exactly its telegraphed gap', () => {
  const g = emptyGame(); g.state.z = 150; g.state.nextShot = 999;
  g.state.enemies = [{ ...enemy(1, 166, 'boss'), spawned: 1, warning: .01 }];
  g.step(STEP);
  assert.equal(g.state.dangers.length, 4);
  assert.ok(g.state.dangers.every(b => b.x !== -1.5 && b.vx === 0));
  assert.equal(g.state.enemies[0].spawned, 2);
});
test('first-stage waves contain ranged pressure and late stages increase it', () => {
  for (let seed = 0; seed < 100; seed++) {
    const early = generate(seed, 1), late = generate(seed, 5);
    for (const segment of early.segments.filter(s => s.kind === 'wave')) assert.ok(segment.enemies?.some(e => e.kind === 'sniper'));
    assert.ok(late.segments.flatMap(s => s.enemies ?? []).length > early.segments.flatMap(s => s.enemies ?? []).length);
  }
});

test('squad is the only survival pool; last casualty ends the run once', () => {
  const g = emptyGame(); g.state.soldiers = 1; g.state.nextShot = 999;
  assert.equal('hp' in g.state, false);
  g.state.dangers = [{ x: 0, z: .5, vx: 0, vz: -24, damage: 2 }];
  g.step(STEP);
  assert.equal(g.state.soldiers, 0); assert.equal(g.state.status, 'over');
  const events = g.drainEvents().filter(e => e.type === 'damage');
  assert.equal(events.length, 1); assert.equal(events[0].squad, -1);
  const state = g.snapshot(); g.step(.1); assert.deepEqual(g.snapshot(), state);
  assert.deepEqual(g.drainEvents(), []);
});
test('breaches cost score once but never remove unseen soldiers', () => {
  const g = emptyGame(); g.state.score = 25; g.state.nextShot = 999;
  g.state.enemies = [{ ...enemy(1, -2), x: 3 }];
  g.step(STEP);
  assert.equal(g.state.soldiers, 12); assert.equal(g.state.score, 0);
  assert.equal(g.state.kills, 0); assert.equal(g.state.breaches, 1);
  const event = g.drainEvents().find(e => e.type === 'breach')!;
  assert.equal(event.score, -25); assert.equal(event.squad, 0);
  g.step(.1); assert.equal(g.state.breaches, 1);
});
test('recruitment saves a depleted squad and caps the actual gain', () => {
  for (const count of [1, 179, 180]) {
    const g = emptyGame(); g.state.soldiers = count;
    g.state.gates = [{ x: 2, z: 0, kind: 'add', value: 14, used: false }];
    g.step(STEP);
    assert.equal(g.state.soldiers, Math.min(180, count + 14));
    assert.equal(g.drainEvents().find(e => e.type === 'gate')!.squad, Math.min(14, 180 - count));
  }
});
test('stage completion does not invisibly heal or resurrect the squad', () => {
  const g = emptyGame(); g.state.soldiers = 3; g.state.z = g.level.length - .01;
  g.step(STEP);
  assert.equal(g.state.status, 'choice'); assert.equal(g.state.soldiers, 3);
  assert.equal(g.drainEvents().find(e => e.type === 'clear')!.squad, 0);
});

test('small squads keep useful firepower without large squads scaling linearly', () => {
  assert.equal(squadPower(0), 0);
  assert.ok(squadPower(1) / squadPower(12) > .5);
  assert.ok(squadPower(180) / squadPower(12) < 3);
  for (let n = 2; n < 180; n++) {
    assert.ok(squadPower(n) > squadPower(n - 1));
    assert.ok(squadPower(n + 1) - squadPower(n) < squadPower(n) - squadPower(n - 1));
  }
});
