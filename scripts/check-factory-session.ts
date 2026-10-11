import assert from 'node:assert/strict';
import { createSave, SaveConflictError, type FactorySave } from '../src/games/factory/session/persistence';
import { FactorySession, type SaveStore } from '../src/games/factory/session/session';
import { FactorySimulation } from '../src/games/factory/game/simulation';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
class Store implements SaveStore {
  saved: FactorySave | null = null;
  writes: FactorySave[] = [];
  failure: Error | null = null;
  pending: (() => void) | null = null;
  hold = false;
  closed = false;
  async load(): Promise<FactorySave | null> {
    if (this.failure) throw this.failure;
    return this.saved;
  }
  async write(save: FactorySave): Promise<void> {
    this.writes.push(save);
    if (this.hold) await new Promise<void>(resolve => { this.pending = resolve; });
    if (this.failure) throw this.failure;
    this.saved = save;
  }
  close(): void { this.closed = true; }
}
function fixture(store = new Store()) {
  const statuses: { text: string; error?: boolean; retry?: boolean }[] = [];
  const activations: FactorySimulation[] = [];
  const session = new FactorySession({
    setSavedScenario() {},
    setSaveStatus(text, error, retry) { statuses.push({ text, error, retry }); },
  }, simulation => activations.push(simulation), store);
  return { store, session, statuses, activations };
}
{
  const { store, session, statuses, activations } = fixture();
  await session.load();
  assert.equal(await session.replace('settlement', 'north-bank'), true);
  const original = session.simulation;
  const originalId = session.worldId;
  store.failure = new Error('quota exceeded');
  assert.equal(await session.replace('guided', 'new-world'), false);
  assert.equal(session.simulation, original);
  assert.equal(session.worldId, originalId);
  assert.equal(activations.length, 1);
  assert.match(statuses.at(-1)!.text, /quota exceeded/);
  store.failure = null;
  store.hold = true;
  original.step();
  session.changed(false);
  const first = session.save();
  await flush();
  original.step();
  session.changed(false);
  const second = session.save();
  await flush();
  assert.equal(store.writes.length, 3, 'Second snapshot must wait for the first write');
  store.pending!();
  await first;
  await flush();
  assert.equal(store.writes.length, 4);
  store.hold = false;
  store.pending!();
  await second;
  assert.equal(store.saved!.simulation.ticks, original.ticks);
  assert.equal(statuses.at(-1)!.text, 'Saved on this device');
  const count = store.writes.length;
  session.changed(false);
  for (let i = 0; i < 30; i++) session.update(250, true);
  await flush();
  assert.equal(store.writes.length, count, 'Hidden/suspended sessions must not autosave');
  for (let i = 0; i < 20; i++) session.update(250, false);
  await flush();
  assert.equal(store.writes.length, count + 1);
  store.failure = new SaveConflictError();
  session.changed(false);
  await session.save();
  assert.equal(statuses.at(-1)!.retry, false);
  store.failure = null;
  await session.save(true);
  assert.equal(store.writes.length, count + 2, 'Conflicts block even forced saves');
  assert.equal(await session.replace('guided', 'replacement'), true);
  session.changed(false);
  await session.save();
  assert.equal(store.saved!.worldId, session.worldId);
  session.close();
  assert.equal(store.closed, true);
  const closedCount = store.writes.length;
  await session.save(true);
  assert.equal(await session.replace('guided', 'closed'), false);
  assert.equal(store.writes.length, closedCount);
}
{
  const { store, session, activations, statuses } = fixture();
  store.saved = createSave(FactorySimulation.forScenario('guided'), true, 'resume-check');
  await session.load();
  session.resume();
  assert.equal(session.paused, true);
  assert.equal(session.worldId, 'resume-check');
  assert.equal(activations.length, 1);
  store.hold = true;
  session.changed(false);
  const saving = session.save();
  await flush();
  session.changed(false);
  const queued = session.save();
  session.close();
  const count = statuses.length;
  const writes = store.writes.length;
  store.pending!();
  await saving;
  await queued;
  assert.equal(store.writes.length, writes, 'Closing must not reopen storage for queued writes');
  assert.equal(statuses.length, count, 'Closed sessions cannot update the view from an in-flight save');
}
{
  const { store, session, activations } = fixture();
  await session.load();
  await session.replace('guided', 'old-world');
  const old = session.simulation;
  const oldId = session.worldId;
  store.hold = true;
  session.changed(false);
  const saving = session.save();
  await flush();
  const replacing = session.replace('settlement', 'new-world');
  session.resume();
  assert.equal(session.simulation, old, 'Resume must not interrupt a pending replacement');
  assert.equal(activations.length, 1);
  await session.save(true);
  assert.equal(store.writes.length, 2, 'Replacement blocks snapshots of the old world');
  store.pending!();
  await saving;
  await flush();
  assert.equal(session.worldId, oldId, 'Do not activate a world before its save commits');
  assert.equal(store.writes.length, 3, 'Replacement follows the pending old-world write');
  store.hold = false;
  store.pending!();
  assert.equal(await replacing, true);
  assert.notEqual(session.worldId, oldId);
  assert.equal(store.saved!.worldId, session.worldId);
  assert.equal(session.simulation.scenario, 'settlement');
}
{
  const { store, session, statuses } = fixture();
  store.failure = new Error('storage unavailable');
  await session.load();
  assert.match(statuses.at(-1)!.text, /Load failed: storage unavailable/);
}
console.log('Factory session checks passed: failures, FIFO snapshots, conflicts, suspension, resume and close.');
