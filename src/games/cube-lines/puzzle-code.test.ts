import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { endlessSpec, generateLevel } from './generate';
import { LEVELS } from './levels';
import { endlessPreset, formatPuzzleCode, parsePuzzleCode, selectEndlessPreset } from './puzzle-code';

test('edition-one presets do not change with campaign tuning or mutations to returned specs', () => {
  for (let preset = 0; preset < 6; preset++) {
    const campaign = LEVELS[Math.min(29, preset * 6)];
    const original = { ...campaign };
    const expected = endlessSpec(preset * 5);
    try {
      campaign.size = 4;
      campaign.minDensity = 0.1;
      assert.deepEqual(endlessSpec(preset * 5), expected);
      const returned = endlessSpec(preset * 5);
      returned.size = 16;
      returned.minDensity = 1;
      assert.deepEqual(endlessSpec(preset * 5), expected);
    } finally {
      Object.assign(campaign, original);
    }
  }
});

test('endless mixes unlocked smaller presets between peak cubes without unbounded growth', () => {
  const sequence = (start: number) => Array.from({ length: 5 }, (_, i) => selectEndlessPreset(start + i));
  assert.deepEqual(sequence(0), [0, 0, 0, 0, 0]);
  assert.deepEqual(sequence(5), [1, 0, 1, 0, 1]);
  assert.deepEqual(sequence(10), [2, 1, 2, 0, 2]);
  assert.deepEqual(sequence(20), [4, 3, 4, 0, 4]);
  assert.deepEqual(sequence(25), [5, 4, 5, 0, 5]);
  assert.deepEqual(sequence(30), [5, 4, 5, 1, 5]);
  assert.deepEqual(sequence(45), [5, 4, 5, 4, 5]);
  assert.deepEqual(new Set(Array.from({ length: 25 }, (_, i) =>
    endlessSpec(selectEndlessPreset(25 + i) * 5).size)), new Set([8, 9, 10, 11, 12]));
  for (let cleared = 0; cleared < 200; cleared++) {
    const preset = selectEndlessPreset(cleared);
    assert.ok(preset >= 0 && preset <= endlessPreset(cleared));
    assert.ok(endlessSpec(preset * 5).size <= 12);
  }
  assert.ok(selectEndlessPreset(Number.MAX_SAFE_INTEGER) <= 5);
  for (const cleared of [-1, 0.5, NaN, Infinity]) {
    assert.throws(() => selectEndlessPreset(cleared), /Invalid endless/);
  }
});

test('puzzle codes roundtrip every exact preset and unsigned seed boundary', () => {
  for (let preset = 0; preset < 6; preset++) {
    for (const seed of [0, 1, 42, 0x12345678, 0xffffffff]) {
      const code = { edition: 1, preset, seed };
      const text = formatPuzzleCode(code);
      assert.deepEqual(parsePuzzleCode(text), code);
      assert.deepEqual(parsePuzzleCode(`  ${text.toLowerCase()}  `), code);
    }
  }
  assert.equal(formatPuzzleCode({ edition: 1, preset: 0, seed: 42 }), 'CL1-T1-0000002A');
  assert.equal(endlessPreset(0), 0);
  assert.equal(endlessPreset(5), 1);
  assert.equal(endlessPreset(20), 4);
  assert.equal(endlessPreset(25), 5);
  assert.equal(endlessPreset(Number.MAX_SAFE_INTEGER), 5);
});

test('invalid seed codes and unsupported editions fail without choosing a substitute', () => {
  for (const text of ['', '42', 'CL1-T0-00000000', 'CL1-T7-00000000', 'CL1-T1-FFFFFFFFF',
    'CL1-T1-0000000G', 'CL1-T1--0000001', 'CL1-T1-00000000 trailing']) {
    assert.throws(() => parsePuzzleCode(text), /full puzzle code/);
  }
  assert.throws(() => parsePuzzleCode('CL2-T1-0000002A'), /edition 2 is not supported/);
  for (const preset of [-1, 0.5, 6]) {
    assert.throws(() => formatPuzzleCode({ edition: 1, preset, seed: 0 }), /cannot be shared/);
  }
  for (const seed of [-1, 0x100000000, NaN, 1.5]) {
    assert.throws(() => formatPuzzleCode({ edition: 1, preset: 0, seed }), /cannot be shared/);
  }
  for (const cleared of [-1, 0.5, Infinity]) assert.throws(() => endlessPreset(cleared), /Invalid endless/);
});

test('edition-one codes retain exact published layout identity, including both 12x12 presets', () => {
  const hashes = [
    '00cdf57b9cc679610645ce339e072f5c100ac6bc430916d14fc754946a8e166b',
    '7dc70936c7dd87bf45a9f34fba36d75c31d0551edff4d394d2992261f837ded1',
    '8519ffaa97211feaccbe539bf266f02b88ef74079630c31f5422245e51f8a069',
    '7617a1bb51c87f3ef3ba30e578bbb1cee065cb76a64842b370896c288dd9135e',
    'a10c215503f82ed4fa19b009697324fc9342157b25634455cba7c36fbd4bc6a2',
    'bf3555b9ef25ef7c58d19bab208508c9016f5cde4eddb010c33f5c8bf71baf4a',
  ];
  hashes.forEach((hash, preset) => {
    const code = parsePuzzleCode(`CL1-T${preset + 1}-FFFFFFFF`);
    const layout = generateLevel(endlessSpec(code.preset * 5), code.seed);
    assert.equal(createHash('sha256').update(JSON.stringify(layout)).digest('hex'), hash);
  });
});
