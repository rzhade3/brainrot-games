import assert from 'node:assert/strict';
import test from 'node:test';
import data from './layouts.json';
import {
  advanceEndless, completeEndless, GENERATOR_EDITION, newEndless, puzzleSignature,
  readEndless, rememberPuzzle, type GeneratedPuzzle,
  type GenerationRequest, type GenerationResponse,
} from './endless';
import { EndlessGenerator } from './endless-client';
import { endlessSpec, generateLevel, meetsSpec, GenerationExhaustedError } from './generate';
import { GenerationIndex } from './generation-index';
import { formatPuzzleCode, selectEndlessPreset } from './puzzle-code';
import { solve, type Layout } from './rules';
import { CATALOG, catalogKey } from './catalog';

const layout = data.layouts[0] as Layout;
const puzzle: GeneratedPuzzle = { edition: GENERATOR_EDITION, seed: 42, layout };

test('endless saves restore accepted layouts and legal moves, never regenerate old editions', () => {
  assert.equal(readEndless(null), null);
  const save = newEndless({ ...puzzle, edition: 17 });
  save.removed = solve(layout)!.slice(0, 3);
  assert.deepEqual(readEndless(JSON.stringify(save)), save);
  assert.equal(readEndless(JSON.stringify(save))!.puzzle.edition, 17);
  assert.equal(save.cleared, 0);
  assert.equal(save.finished, false);
  assert.equal(save.next, null);
});

test('exact difficulty presets survive save/reload while legacy saves remain valid', () => {
  const legacy = newEndless(puzzle);
  assert.equal(readEndless(JSON.stringify(legacy))!.puzzle.preset, undefined);
  for (let preset = 0; preset < 6; preset++) {
    const save = newEndless({ ...puzzle, preset });
    assert.deepEqual(readEndless(JSON.stringify(save)), save);
  }
  for (const preset of [-1, 6, 1.5, '1', null]) {
    const save = newEndless(puzzle);
    assert.throws(() => readEndless(JSON.stringify({
      ...save, puzzle: { ...puzzle, preset },
    })), /difficulty preset/);
  }
});

test('endless completion is idempotent and advancing retains separate clear count and recent history', () => {
  const save = newEndless(puzzle);
  save.removed = solve(layout)!;
  completeEndless(save);
  completeEndless(save);
  assert.equal(save.cleared, 1);
  assert.equal(save.finished, true);
  assert.throws(() => advanceEndless(save), /not ready/);
  save.next = { edition: 1, seed: 9, layout: data.layouts[1] as Layout };
  assert.deepEqual(readEndless(JSON.stringify(save)), save);
  advanceEndless(save);
  assert.equal(save.cleared, 1);
  assert.equal(save.finished, false);
  assert.equal(save.puzzle.seed, 9);
  assert.deepEqual(save.removed, []);
  assert.equal(save.next, null);
  assert.equal(save.recent.length, 2);
  assert.deepEqual(readEndless(JSON.stringify(save)), save);
  assert.throws(() => advanceEndless(save), /not ready/);
});

test('recent layout identity ignores line IDs/order, distinguishes arrow reversal and keeps a bounded window', () => {
  const renamed = { ...layout, lines: [...layout.lines].reverse().map((line, i) => ({ ...line, id: `other-${i}` })) };
  assert.equal(puzzleSignature(renamed), puzzleSignature(layout));
  const reversed = { ...layout, lines: layout.lines.map((line, i) => i ? line : { ...line, cells: [...line.cells].reverse() }) };
  assert.notEqual(puzzleSignature(reversed), puzzleSignature(layout));
  let recent = newEndless(puzzle).recent;
  for (let seed = 100; seed < 120; seed++) recent = rememberPuzzle(recent, { ...puzzle, seed });
  assert.equal(recent.length, 12);
  assert.equal(recent[0].seed, 108);
  assert.equal(recent.at(-1)!.seed, 119);
});

test('corrupt endless saves, illegal moves and repeated prefetched cubes are rejected explicitly', () => {
  const save = newEndless(puzzle);
  const invalid: unknown[] = [
    {}, { ...save, cleared: -1 }, { ...save, cleared: 0.5 }, { ...save, cleared: Infinity },
    { ...save, finished: true }, { ...save, removed: ['missing'] }, { ...save, removed: [solve(layout)![0], solve(layout)![0]] },
    { ...save, puzzle: { ...puzzle, seed: -1 } }, { ...save, puzzle: { ...puzzle, edition: 0 } },
    { ...save, puzzle: { ...puzzle, layout: { size: 8, lines: [null] } } },
    { ...save, puzzle: { ...puzzle, layout: { size: 8, lines: [{ id: 'bad', cells: [{}, {}] }] } } },
    { ...save, puzzle: { ...puzzle, layout: { size: 8, lines: [] } } },
    { ...save, puzzle: { ...puzzle, layout: { ...layout, size: 1 } } },
    { ...save, recent: [] }, { ...save, recent: [{ seed: 42, signature: 42 }] },
    { ...save, recent: Array(13).fill(save.recent[0]) },
    { ...save, next: puzzle },
    { ...save, next: { ...puzzle, seed: 43 } },
  ];
  for (const value of invalid) assert.throws(() => readEndless(JSON.stringify(value)));
  assert.throws(() => readEndless('{bad JSON'));
});

class FakeWorker {
  static instances: FakeWorker[] = [];
  static failStart = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  request: unknown;
  constructor() {
    if (FakeWorker.failStart) throw new Error('Worker blocked');
    FakeWorker.instances.push(this);
  }
  terminate() { this.terminated = true; }
  postMessage(request: unknown) { this.request = request; }
  respond(data: unknown) { this.onmessage?.(new MessageEvent('message', { data })); }
}

test('worker client cancels stale requests and reports generation/start/transport errors', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  const client = new EndlessGenerator();
  try {
    const received: GeneratedPuzzle[] = [];
    const errors: string[] = [];
    const request = { cleared: 5, recent: newEndless(puzzle).recent };
    client.generate(request, value => received.push(value), message => errors.push(message));
    const first = FakeWorker.instances.at(-1)!;
    assert.deepEqual(first.request, request);
    client.generate(request, value => received.push(value), message => errors.push(message));
    assert.equal(first.terminated, true);
    first.respond({ ok: true, puzzle });
    assert.equal(received.length, 0);
    const second = FakeWorker.instances.at(-1)!;
    second.respond({ ok: true, puzzle });
    assert.equal(second.terminated, true);
    assert.deepEqual(received, [puzzle]);
    client.generate(request, () => assert.fail('Unexpected success'), message => errors.push(message));
    FakeWorker.instances.at(-1)!.respond({ ok: false, error: 'Seed exhausted' });
    client.generate(request, () => assert.fail('Unexpected success'), message => errors.push(message));
    FakeWorker.instances.at(-1)!.onmessageerror?.();
    client.generate(request, () => assert.fail('Unexpected success'), message => errors.push(message));
    FakeWorker.instances.at(-1)!.onerror?.({ message: 'Module unavailable', preventDefault() {} } as ErrorEvent);
    FakeWorker.failStart = true;
    client.generate(request, () => assert.fail('Unexpected success'), message => errors.push(message));
    assert.deepEqual(errors, ['Seed exhausted', 'The puzzle worker returned unreadable data.', 'Module unavailable', 'Worker blocked']);
  } finally {
    FakeWorker.failStart = false;
    client.cancel();
    if (original) Object.defineProperty(globalThis, 'Worker', original);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

test('worker timeout terminates background work and permits a fresh retry', context => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const client = new EndlessGenerator();
  try {
    const errors: string[] = [];
    client.generate({ cleared: 0, recent: [] }, () => assert.fail('Unexpected success'), message => errors.push(message));
    const first = FakeWorker.instances.at(-1)!;
    context.mock.timers.tick(15000);
    assert.equal(first.terminated, true);
    assert.match(errors[0], /too long/);
    let result: GeneratedPuzzle | undefined;
    client.generate({ cleared: 0, recent: [] }, value => { result = value; }, () => assert.fail('Unexpected error'));
    FakeWorker.instances.at(-1)!.respond({ ok: true, puzzle });
    assert.deepEqual(result, puzzle);
  } finally {
    client.cancel();
    context.mock.timers.reset();
    if (original) Object.defineProperty(globalThis, 'Worker', original);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

test('worker enforces recent seed/layout exclusions, progression and bounded failure', async context => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const handlers: ((event: MessageEvent<GenerationRequest>) => void)[] = [];
  const responses: GenerationResponse[] = [];
  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    value: {
      addEventListener(_type: string, handler: (event: MessageEvent<GenerationRequest>) => void) { handlers.push(handler); },
      postMessage(response: GenerationResponse) { responses.push(response); },
    },
  });
  let seeds: number[] = [];
  const random = context.mock.method(crypto, 'getRandomValues', <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array instanceof Uint32Array);
    array[0] = seeds.shift() ?? 0;
    return array;
  });
  try {
    await import('./endless.worker');
    const run = (request: GenerationRequest) => {
      const catalogSeen = CATALOG.presets.flatMap((seeds, preset) =>
        seeds.map(seed => catalogKey({ edition: CATALOG.edition, preset, seed })));
      handlers[0](new MessageEvent('message', { data: { catalogSeen, ...request } }));
      return responses.at(-1)!;
    };
    seeds = [0, 1];
    let response = run({ cleared: 0, recent: [{ seed: 0, signature: 'already used' }] });
    assert.equal(response.ok, true);
    if (response.ok) assert.equal(response.puzzle.seed, 1);
    seeds = [0, 1];
    response = run({
      cleared: 0,
      recent: [{ seed: 123456, signature: puzzleSignature(generateLevel(endlessSpec(0), 0)) }],
    });
    assert.equal(response.ok, true);
    if (response.ok) assert.equal(response.puzzle.seed, 1, 'same layout from a different recorded seed is rejected');
    seeds = [0, 1];
    response = run({ cleared: 0, recent: [] });
    assert.equal(response.ok, true);
    if (response.ok) assert.equal(response.puzzle.seed, 1, 'fresh fallback rejects seed zero for excessive forced moves');
    response = run({ cleared: 0, recent: [], code: 'CL1-T1-00000000' });
    assert.equal(response.ok, true, 'explicit replay is not restricted by catalog heuristics');
    if (response.ok) assert.equal(response.puzzle.seed, 0);
    seeds = [];
    response = run({ cleared: 0, recent: [{ seed: 0, signature: 'already used' }] });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.error, /generation budget/);
    const seen: string[] = [];
    for (let i = 0; i < CATALOG.presets[0].length; i++) {
      seeds = [42];
      response = run({ cleared: 0, recent: [], catalogSeen: seen });
      assert.equal(response.ok, true);
      if (response.ok) {
        assert.ok(CATALOG.presets[0].includes(response.puzzle.seed));
        const key = catalogKey(response.puzzle);
        assert.ok(!seen.includes(key), 'catalog entries do not repeat beyond the recent window');
        seen.push(key);
      }
    }
    for (const cleared of [5, 6, 8, 10, 11, 13, 15, 18, 20, 23, 25, 26, 28, 33, 38, 43, 48]) {
      seeds = [42];
      response = run({ cleared, recent: [], catalogSeen: [] });
      assert.equal(response.ok, true);
      if (response.ok) {
        const preset = selectEndlessPreset(cleared);
        const spec = endlessSpec(preset * 5);
        assert.equal(response.puzzle.preset, preset);
        assert.equal(response.puzzle.layout.size, spec.size);
        assert.ok(meetsSpec(response.puzzle.layout, spec));
        assert.ok(CATALOG.presets[preset].includes(response.puzzle.seed));
        assert.deepEqual(response.puzzle.layout, generateLevel(spec, response.puzzle.seed));
      }
    }
    const randomCalls = random.mock.callCount();
    for (let preset = 0; preset < 6; preset++) {
      const code = formatPuzzleCode({ edition: 1, preset, seed: 0xffffffff });
      const layout = generateLevel(endlessSpec(preset * 5), 0xffffffff);
      response = run({
        code, cleared: 0, recent: [{ seed: 0xffffffff, signature: puzzleSignature(layout) }],
      });
      assert.equal(response.ok, true, 'explicit replay bypasses repeat exclusions');
      if (response.ok) assert.deepEqual(response.puzzle, { edition: 1, preset, seed: 0xffffffff, layout });
    }
    response = run({ cleared: 0, recent: [], code: 'CL2-T1-00000000' });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.error, /not supported/);
    assert.equal(random.mock.callCount(), randomCalls, 'explicit codes never draw a replacement random seed');
    response = run({ cleared: -1, recent: [] });
    assert.equal(response.ok, false);
    const originalMetrics = GenerationIndex.prototype.metrics;
    let exhausted = true;
    const metricMock = context.mock.method(GenerationIndex.prototype, 'metrics', function(this: GenerationIndex) {
      if (exhausted) {
        exhausted = false;
        throw new GenerationExhaustedError('Injected seed exhaustion');
      }
      return originalMetrics.call(this);
    });
    const warningMock = context.mock.method(console, 'warn', () => {});
    seeds = [42, 1];
    response = run({ cleared: 0, recent: [] });
    assert.equal(response.ok, true);
    if (response.ok) assert.equal(response.puzzle.seed, 1);
    assert.equal(warningMock.mock.callCount(), 1);
    metricMock.mock.restore();
    const failureMock = context.mock.method(GenerationIndex.prototype, 'metrics', () => {
      throw new Error('Injected programming error');
    });
    seeds = [1, 42];
    response = run({ cleared: 0, recent: [] });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.error, /Injected programming error/);
    assert.deepEqual(seeds, [42], 'programming errors must not trigger another seed');
    failureMock.mock.restore();
    const exhaustionMock = context.mock.method(GenerationIndex.prototype, 'metrics', () => {
      throw new GenerationExhaustedError('Injected repeated exhaustion');
    });
    seeds = Array(9).fill(1);
    response = run({ cleared: 0, recent: [] });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.error, /generation budget/);
    assert.equal(seeds.length, 1, 'exhausted seeds still consume the eight-attempt budget');
    const beforeExplicit = random.mock.callCount();
    response = run({ cleared: 0, recent: [], code: 'CL1-T1-00000001' });
    assert.equal(response.ok, false);
    if (!response.ok) assert.match(response.error, /Injected repeated exhaustion/);
    assert.equal(random.mock.callCount(), beforeExplicit, 'explicit codes must never change seeds');
    exhaustionMock.mock.restore();
  } finally {
    context.mock.restoreAll();
    if (original) Object.defineProperty(globalThis, 'self', original);
    else Reflect.deleteProperty(globalThis, 'self');
  }
});

test('generation reports budget exhaustion with a distinct retryable error type', () => {
  assert.throws(() => generateLevel({
    ...endlessSpec(0), size: 2, minLines: 100,
  }, 42), GenerationExhaustedError);
  assert.throws(() => generateLevel(endlessSpec(0), -1),
    error => error instanceof Error && !(error instanceof GenerationExhaustedError));
});
