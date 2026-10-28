import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Formation, Feedback } from './feedback';
import { GateRunner, STEP } from './engine';

test('every soldier has a sprite, including casualties above the former 25-unit cap', () => {
  for (const count of [12, 25, 26, 180]) {
    const formation = new Formation(); formation.sync(count);
    assert.equal(formation.members.length, count);
    const survivors = formation.members.slice(0, -1);
    assert.equal(formation.sync(count - 1).length, 1);
    assert.deepEqual(formation.members, survivors);
    assert.equal(formation.capacity, count);
    const oldIds = new Set(formation.members.map(m => m.id));
    formation.sync(count);
    assert.equal(formation.members.length, count);
    assert.ok(!oldIds.has(formation.members[count - 1].id));
    assert.equal(formation.sync(0).length, count);
    assert.equal(formation.members.length, 0);
  }
});
test('collision emits actual losses and removes those units without a kill celebration', () => {
  const g = new GateRunner(42); g.start();
  g.state.soldiers = 180; g.state.gates = []; g.state.hazards = []; g.state.nextShot = 999;
  g.state.enemies = [{ id: 1, x: 0, z: 0, kind: 'grunt', hp: 100, maxHp: 100, cooldown: 0, warning: 0, aim: 0, spawned: 0 }];
  const formation = new Formation(); formation.sync(180);
  g.step(STEP);
  const events = g.drainEvents(), damage = events.find(e => e.type === 'damage')!;
  assert.ok(damage.squad < 0);
  assert.equal(damage.squad, g.state.soldiers - 180);
  assert.equal(formation.sync(g.state.soldiers).length, -damage.squad);
  assert.equal(events.some(e => e.type === 'kill'), false);
  assert.deepEqual(g.drainEvents(), []);
});
test('observing events leaves simulation identical and effects expire', () => {
  const a = new GateRunner(42), b = new GateRunner(42), feedback = new Feedback();
  a.start(); b.start();
  for (let i = 0; i < 1000; i++) { a.step(STEP); b.step(STEP); feedback.accept(a.drainEvents()); feedback.advance(STEP); }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.ok(feedback.effects.length <= 80);
  feedback.advance(2); assert.equal(feedback.effects.length, 0);
});
