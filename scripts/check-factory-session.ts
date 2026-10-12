import assert from 'node:assert/strict';
import { createSave, restoreSave, SaveConflictError, SaveStorageError, type FactorySave } from '../src/games/factory/session/persistence';
import { FactorySaveError } from '../src/games/factory/session/saveErrors';
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
  const messages: { resumable: boolean; message: string; blocked: boolean; existing: boolean }[] = [];
  const activations: FactorySimulation[] = [];
  const session = new FactorySession({
    setSavedSettlement(resumable, message, blocked, existing) { messages.push({ resumable, message, blocked, existing }); },
    setSaveStatus(text, error, retry) { statuses.push({ text, error, retry }); },
  }, simulation => activations.push(simulation), store);
  return { store, session, statuses, messages, activations };
}
{
  const { store, session, statuses, activations } = fixture();
  await session.load();
  assert.equal(await session.replace('north-bank'), true);
  const original = session.simulation;
  const originalId = session.worldId;
  store.failure = new DOMException('Raw browser quota diagnostic', 'QuotaExceededError');
  assert.equal(await session.replace('new-world'), false);
  assert.equal(session.simulation, original);
  assert.equal(session.worldId, originalId);
  assert.equal(activations.length, 1);
  assert.equal(statuses.at(-1)!.text, 'New settlement not saved');
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
  assert.equal(await session.replace('replacement'), true);
  session.changed(false);
  await session.save();
  assert.equal(store.saved!.worldId, session.worldId);
  session.close();
  assert.equal(store.closed, true);
  const closedCount = store.writes.length;
  await session.save(true);
  assert.equal(await session.replace('closed'), false);
  assert.equal(store.writes.length, closedCount);
}
{
  const { store, session, activations, statuses } = fixture();
  store.saved = createSave(FactorySimulation.create(), true, 'resume-check');
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
  await session.replace('old-world');
  const old = session.simulation;
  const oldId = session.worldId;
  store.hold = true;
  session.changed(false);
  const saving = session.save();
  await flush();
  const replacing = session.replace('new-world');
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
  assert.equal(session.simulation.world.seed, 'new-world');
}
{
  const { store, session, statuses } = fixture();
  store.failure = new SaveStorageError('Local storage did not respond. Close other Pocket Factory tabs, then retry.');
  await session.load();
  assert.equal(statuses.at(-1)!.text, 'Local save unavailable');
}
for (const [change, kind] of [
  [(save: FactorySave) => { save.version = 2; }, 'incompatible'],
  [(save: FactorySave) => { Object.assign(save.simulation, { ruleset: 'settlement-v5' }); }, 'incompatible'],
  [(save: FactorySave) => { save.map.generatorVersion = 99; }, 'incompatible'],
  [(save: FactorySave) => { save.simulation.world.generatorVersion = 99; }, 'incompatible'],
  [(save: FactorySave) => { Object.assign(save.simulation.settlement, { version: 4 }); }, 'incompatible'],
  [(save: FactorySave) => { save.simulation.recovered['food-unit']++; }, 'damaged'],
] as const) {
  const candidate = createSave(FactorySimulation.create(), false, 'copy-check');
  change(candidate);
  const before = structuredClone(candidate);
  const { store, session, messages, statuses } = fixture();
  try {
    restoreSave(candidate);
    assert.fail('Fixture must be rejected');
  } catch (error) {
    assert.ok(error instanceof FactorySaveError);
    assert.equal(error.kind, kind);
    store.failure = error;
  }
  await session.load();
  const result = messages.at(-1)!;
  assert.equal(result.message, `${kind === 'incompatible'
    ? 'This save cannot be resumed in this version of Pocket Factory.'
    : 'This save is damaged and cannot be resumed.'} You can replace it with a new settlement. No save was replaced.`);
  assert.equal(result.resumable, false);
  assert.equal(result.blocked, false);
  assert.equal(result.existing, true);
  assert.equal(statuses.at(-1)!.text, 'Existing save kept on this device');
  assert.doesNotMatch(result.message, /Corrupt|unsupported|ruleset|prototype|version \d/i);
  assert.equal((result.message.match(/new settlement/g) ?? []).length, 1);
  assert.deepEqual(candidate, before);
  assert.equal(store.writes.length, 0);
  store.failure = new DOMException('Raw quota detail', 'QuotaExceededError');
  assert.equal(await session.replace('copy-replacement'), false);
  assert.equal(messages.at(-1)!.message,
    'Not enough space to save. Free some space on this device, then retry. No save was replaced.');
  assert.equal(messages.at(-1)!.existing, true);
}
{
  const { store, session, messages } = fixture();
  store.failure = new DOMException('Raw permission detail', 'SecurityError');
  await session.load();
  assert.equal(messages.at(-1)!.message,
    'Browser settings block local saving. Allow storage for this site, then retry. No save was replaced.');
  assert.equal(messages.at(-1)!.blocked, true);
  assert.equal(messages.at(-1)!.existing, false);
}
{
  const { store, session, messages } = fixture();
  const diagnostic = new Error('Internal save diagnostic');
  store.failure = diagnostic;
  const original = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };
  try {
    await session.load();
  } finally {
    console.error = original;
  }
  assert.equal(messages.at(-1)!.message, 'Could not read your save. Retry loading. No save was replaced.');
  assert.equal(messages.at(-1)!.blocked, true);
  assert.equal(logs[0][1], diagnostic, 'Unknown failures retain diagnostics without exposing them as player copy');
}
console.log('Factory session checks passed: clean incompatible/damaged/storage copy, protected replacements, failures, FIFO snapshots, conflicts, suspension, resume and close.');
