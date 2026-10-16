import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG, catalogKey, isCatalogPuzzle } from './catalog';
import { catalogQuality } from './catalog-quality';
import { endlessSpec, generateLevel, meetsSpec } from './generate';
import { GENERATOR_EDITION, newEndless, puzzleSignature, readEndless, rememberCatalog } from './endless';

test('all 100 catalog puzzles reproduce, pass deterministic screening and have unique layouts', () => {
  assert.equal(CATALOG.edition, GENERATOR_EDITION);
  assert.equal(CATALOG.presets.length, 6);
  assert.equal(CATALOG.presets.flat().length, 100);
  const signatures = new Set<string>();
  for (const [preset, seeds] of CATALOG.presets.entries()) {
    assert.ok(seeds.length >= 16);
    assert.equal(new Set(seeds).size, seeds.length);
    for (const seed of seeds) {
      assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
      const spec = endlessSpec(preset * 5);
      const layout = generateLevel(spec, seed);
      assert.ok(meetsSpec(layout, spec));
      const quality = catalogQuality(layout);
      assert.ok(quality.accepted, `T${preset + 1}/${seed}: ${JSON.stringify(quality)}`);
      const signature = puzzleSignature(layout);
      assert.ok(!signatures.has(signature), 'catalog layouts must not duplicate each other');
      signatures.add(signature);
    }
  }
});

test('catalog reservations persist across prefetch, reload and legacy save migration', () => {
  const puzzle = { edition: CATALOG.edition, preset: 0, seed: CATALOG.presets[0][0],
    layout: generateLevel(endlessSpec(0), CATALOG.presets[0][0]) };
  const save = newEndless(puzzle);
  assert.deepEqual(save.catalogSeen, [catalogKey(puzzle)]);
  const next = { ...puzzle, seed: CATALOG.presets[0][1],
    layout: generateLevel(endlessSpec(0), CATALOG.presets[0][1]) };
  save.next = next;
  rememberCatalog(save, next);
  rememberCatalog(save, next);
  assert.deepEqual(save.catalogSeen, [catalogKey(puzzle), catalogKey(next)]);
  assert.deepEqual(readEndless(JSON.stringify(save)), save);
  const legacy = { ...save, catalogSeen: undefined };
  assert.deepEqual(readEndless(JSON.stringify(legacy))!.catalogSeen, save.catalogSeen);
  for (const catalogSeen of [null, [4], ['bad'], Array(10001).fill('1:0:42')]) {
    assert.throws(() => readEndless(JSON.stringify({ ...save, catalogSeen })), /catalog history/);
  }
  assert.equal(isCatalogPuzzle({ ...puzzle, edition: 2 }), false);
  assert.equal(isCatalogPuzzle({ ...puzzle, preset: undefined }), false);
  assert.equal(isCatalogPuzzle({ ...puzzle, seed: 42 }), false);
});

test('deterministic screening rejects excessive opening choices even when the cube is solvable', () => {
  const layout = { size: 8, lines: Array.from({ length: 9 }, (_, i) => ({
    id: `line-${i}`, cells: [
      { face: i < 8 ? 'front' as const : 'back' as const, x: i % 8, y: 0 },
      { face: i < 8 ? 'front' as const : 'back' as const, x: i % 8, y: 1 },
    ],
  })) };
  const quality = catalogQuality(layout);
  assert.equal(quality.openingChoices, 9);
  assert.equal(quality.accepted, false);
  assert.deepEqual(catalogQuality(layout), quality);
});

test('deterministic screening measures forced sequences before the final cleanup', () => {
  const layout = { size: 16, lines: Array.from({ length: 8 }, (_, i) => ({
    id: `line-${i}`, cells: [
      { face: 'front' as const, x: 0, y: i * 2 },
      { face: 'front' as const, x: 0, y: i * 2 + 1 },
    ],
  })) };
  const quality = catalogQuality(layout);
  assert.equal(quality.openingChoices, 1);
  assert.equal(quality.longestForcedRun, 5);
  assert.equal(quality.forcedRatio, 1);
  assert.equal(quality.accepted, false);
});
