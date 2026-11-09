import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { patients, type Area, type Mark, type Tool } from './cases';
import { Coverage, sampleSurface } from './coverage';
import { advanceDrain, setDrainContact, startDrain } from './drain';
import { createClinicSave } from './save';
import { playSound, preloadRecordedSounds, unlockAudio } from './sound';
import { applyTreatmentHit, areaStatus, finishedMarks, readyTreatments, startTreatments, step, type Treatment } from './treatment';

test('sound and overlapping case writes preserve progress and the best finish across tabs', () => {
  const entries = new Map([['brainrot:pop-clinic:v1', JSON.stringify({
    sound: false,
    records: [{ clean: true }, { clean: false }],
  })]]);
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
  const first = createClinicSave(storage);
  const second = createClinicSave(storage);
  assert.equal(first.sound, false);
  assert.deepEqual(second.record(0), { clean: true });
  first.clear(2, true);
  second.sound = true;
  second.clear(2, false);
  second.clear(8, false);
  assert.equal(first.sound, true);
  assert.deepEqual(first.record(2), { clean: true });
  assert.deepEqual(createClinicSave(storage).record(8), { clean: false });
  first.clear(8, true);
  assert.deepEqual(second.record(8), { clean: true });
});

test('a rejected storage write still applies for the session', () => {
  const save = createClinicSave({
    getItem: key => key.endsWith(':sound') ? 'on' : null,
    setItem: () => { throw new Error('Storage quota'); },
  });
  save.sound = false;
  save.clear(0, true);
  assert.equal(save.sound, false);
  assert.deepEqual(save.record(0), { clean: true });
});

test('unfinished blocked treatment cannot advance or produce an after image', () => {
  const area: Area = {
    field: { anatomy: 'toe', marks: { wound: [300, 300] } },
    initial: ['wound'],
    treatments: [[{
      action: 'tap', tool: 'dress', targets: [[300, 300]], requiresClear: ['wound'],
      title: '', hint: '', success: '',
    }]],
  };
  const marks = new Set(area.initial);
  const treatments = startTreatments(area);
  assert.equal(areaStatus(treatments, marks), 'blocked');
  assert.equal(applyTreatmentHit(treatments[0], marks), undefined);
  assert.equal(finishedMarks(area), undefined);
});

test('every reachable order in the live cases can finish with the same marks as the casebook', () => {
  for (const patient of patients) {
    for (const area of patient.areas) {
      const visited = new Set<string>();
      const expected = finishedMarks(area);
      assert(expected, patient.title);
      function visit(treatments: Treatment[], marks: Set<Mark>): void {
        const key = treatments.map(({ next, hits }) => `${next}.${hits}`).join(',') + `:${[...marks].sort().join(',')}`;
        if (visited.has(key)) return;
        visited.add(key);
        const status = areaStatus(treatments, marks);
        assert.notEqual(status, 'blocked', `${patient.title}: ${key}`);
        if (status === 'finished') assert.deepEqual(marks, expected);
        const ready = readyTreatments(treatments, marks);
        if (ready.some(treatment => step(treatment).tool === 'whiten')) {
          assert.equal(ready.length, 1);
          assert.equal(marks.size, 0);
        }
        for (const treatment of ready) {
          const updated = { ...treatment };
          const updatedMarks = new Set(marks);
          assert(applyTreatmentHit(updated, updatedMarks));
          visit(treatments.map(entry => entry === treatment ? updated : entry), updatedMarks);
        }
      }
      visit(startTreatments(area), new Set(area.initial));
    }
  }
});

test('brush and resin progress counts distinct covered area', () => {
  const nail = new Coverage(sampleSurface(([x, y]) => x >= 184 && x <= 415 && y >= 150 && y <= 344), 38);
  nail.stroke([188, 202], [407, 202]);
  nail.stroke([188, 297], [407, 297]);
  assert.equal(nail.complete, false);
  const partial = nail.fraction;
  for (let i = 0; i < 1000; i++) assert.equal(nail.stroke([188, 202], [407, 202]), false);
  assert.equal(nail.stroke([10, 10], [100, 10]), false);
  assert.equal(nail.fraction, partial);
  for (const y of [160, 220, 280, 335]) nail.stroke([184, y], [415, y]);
  assert.equal(nail.complete, true);

  const resin = new Coverage(sampleSurface(([x, y]) => Math.hypot((x - 209) / 54, (y - 269) / 48) <= 1), 22);
  assert.equal(resin.stroke([205, 269], [216, 269]), true);
  assert.equal(resin.stroke([216, 269], [205, 269]), false);
  assert.equal(resin.complete, false);
  for (const y of [237, 269, 301]) resin.stroke([165, y], [253, y]);
  assert.equal(resin.complete, true);
});

test('the dental case retains all twelve repairs before whitening', () => {
  const dental = patients.flatMap(patient => patient.areas).find(area => area.field.anatomy === 'mouth');
  assert(dental);
  const steps = dental.treatments.flat();
  const repairs = steps.filter(current => current.tool !== 'whiten');
  const expected = ['chip', 'gunk', 'decay', 'cavity', 'tartar', 'lower-stain', 'upper-stain', 'crack', 'bracket', 'rough-enamel', 'caramel', 'seed'];
  assert.equal(repairs.length, expected.length);
  assert.deepEqual(repairs.flatMap(current => current.remove ?? []).sort(), expected.sort());
  assert.equal(repairs.find(current => current.remove?.includes('rough-enamel'))?.tool, 'file');
  assert.deepEqual([...steps.find(current => current.tool === 'whiten')?.requiresClear ?? []].sort(), expected);
});

test('a narrow dental target gives contact and progress only near its surface', () => {
  const edge = new Coverage([[233, 333], [247, 327], [261, 333], [277, 333]], 10);
  assert.equal(edge.touches([250, 345]), false);
  assert.equal(edge.stroke([230, 355], [281, 355]), false);
  assert.equal(edge.touches([232, 331]), true);
  assert.equal(edge.stroke([232, 331], [246, 331]), true);
  assert.equal(edge.complete, false);
  assert.equal(edge.touches([232, 331]), true);
  assert.equal(edge.stroke([246, 331], [280, 333]), true);
  assert.equal(edge.complete, true);
});

test('drain pauses off the wound, resumes on contact and keeps the lead-in', () => {
  const drain = startDrain(0, 0);
  assert.equal(advanceDrain(drain, 100), 0);
  setDrainContact(drain, false, 100);
  assert.equal(advanceDrain(drain, 2000), 0);
  setDrainContact(drain, true, 2000);
  assert.equal(advanceDrain(drain, 2080), 0);
  assert.equal(advanceDrain(drain, 2830), .5);
  setDrainContact(drain, false, 2830);
  assert.equal(advanceDrain(drain, 5000), .5);
  const resumed = startDrain(drain.progress, 5000);
  assert.equal(advanceDrain(resumed, 5750), 1);
});

test('recorded audio retries after fetch and decode failures and shares in-flight loads', async t => {
  let fetches = 0;
  let decodes = 0;
  const played: number[] = [];
  let tones = 0;
  const tools = new Set<Tool>(['pop']);
  t.mock.method(globalThis, 'fetch', async () => {
    fetches++;
    return fetches === 1 ? new Response(null, { status: 503 }) : new Response(new ArrayBuffer(8));
  });
  class TestAudioContext {
    state = 'running';
    currentTime = 1;
    destination = {};
    createGain() {
      return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
    }
    async decodeAudioData() {
      if (++decodes === 1) throw new Error('Decode failed');
      return {};
    }
    createBufferSource() {
      return { playbackRate: { value: 1 }, connect() {}, start() { played.push(this.playbackRate.value); } };
    }
    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(destination: AudioNode) { return destination; },
        start() { tones++; },
        stop() {},
      };
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: TestAudioContext, configurable: true });
  t.after(() => Reflect.deleteProperty(globalThis, 'AudioContext'));

  preloadRecordedSounds(tools);
  await setImmediate();
  unlockAudio();
  preloadRecordedSounds(tools);
  preloadRecordedSounds(tools);
  await setImmediate();
  assert.equal(fetches, 2);
  assert.equal(decodes, 1);

  preloadRecordedSounds(tools);
  await setImmediate();
  playSound('pop');
  playSound('abscess-release');
  preloadRecordedSounds(tools);
  assert.equal(fetches, 3);
  assert.equal(decodes, 2);
  assert.deepEqual(played, [1, .84]);
  assert.equal(tones, 1);
});
