import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import data from './layouts.json';
import { generateLevel, endlessSpec } from './generate';
import { GenerationIndex, generationSurface } from './generation-index';
import { blockers, exitCells, metrics, turns, type Layout } from './rules';
import { DIRECTIONS, FACES, step } from './surface';

const layouts = data.layouts as readonly Layout[];

test('integer surface neighbors and every incoming exit ray match coordinate rules', () => {
  for (const size of [2, 4, 8, 9, 10, 11, 12, 16]) {
    const surface = generationSurface(size);
    assert.equal(generationSurface(size), surface);
    assert.equal(surface.count, 6 * size ** 2);
    for (const [id, cell] of surface.cells.entries()) {
      assert.equal(surface.id(cell), id);
      for (const [d, direction] of DIRECTIONS.entries()) {
        const next = surface.neighbors[id * 4 + d];
        assert.deepEqual(surface.cells[next], step(cell, direction, size));
        const path = { id: 'path', cells: [cell, surface.cells[next]] };
        assert.deepEqual(Array.from(surface.exitRay(id, next)), exitCells(path, size).map(cell => surface.id(cell)));
      }
    }
  }
  for (const size of [0, 1, 17, 8.5, NaN]) assert.throws(() => generationSurface(size), /invalid generation grid/);
});

test('incremental occupancy, deduplicated edges, free exits and DAG metrics match independent rules at every insertion', () => {
  for (const layout of layouts) {
    const surface = generationSurface(layout.size);
    const index = new GenerationIndex(surface);
    assert.deepEqual(index.metrics(), { ...metrics({ size: layout.size, lines: [] }), multiTurn: 0 });
    for (let id = 0; id < layout.lines.length; id++) {
      const line = layout.lines[id];
      const body = line.cells.map(cell => surface.id(cell));
      const ray = surface.exitRay(body[body.length - 2], body[body.length - 1]);
      assert.ok(body.every(cell => index.owner[cell] === -1));
      assert.ok(ray.every(cell => index.owner[cell] === -1));
      const affected = index.obstructedBy(body);
      const prefix = { size: layout.size, lines: layout.lines.slice(0, id + 1) };
      const expected = layout.lines.slice(0, id).flatMap((older, i) =>
        blockers(older, [older, line], layout.size).length ? [i] : []);
      assert.deepEqual([...affected].sort((a, b) => a - b), expected);
      assert.equal(new Set(affected).size, affected.length);
      index.add(body, ray, affected);
      const m = metrics(prefix);
      assert.deepEqual(index.metrics(), {
        ...m, multiTurn: prefix.lines.filter(path => turns(path) >= 2).length / prefix.lines.length,
      }, `level ${layouts.indexOf(layout) + 1}, insertion ${id}`);
      assert.deepEqual(index.layout(), prefix);
      assert.deepEqual(index.freeExits(), prefix.lines.filter(path => !blockers(path, prefix.lines, layout.size).length)
        .flatMap(path => exitCells(path, layout.size).map(cell => surface.id(cell))));
      for (let i = 0; i <= id; i++) {
        assert.equal(index.blockerCounts[i], blockers(prefix.lines[i], prefix.lines, layout.size).length);
      }
      for (const [face, name] of FACES.entries()) {
        assert.equal(index.faceHeads[face], prefix.lines.filter(path => path.cells.at(-1)!.face === name).length);
        assert.equal(index.faceCoverage[face], prefix.lines.flatMap(path => path.cells).filter(cell => cell.face === name).length);
      }
    }
  }
});

test('optimized generation preserves the pre-optimization 60-seed corpus exactly', () => {
  const hashes: string[] = [];
  for (let tier = 0; tier < 5; tier++) {
    for (let i = 0; i < 12; i++) {
      const seed = (0x9e3779b9 * (i + 1) + tier * 7919) >>> 0;
      const layout = generateLevel(endlessSpec(tier * 5), seed);
      hashes.push(createHash('sha256').update(JSON.stringify(layout)).digest('hex'));
    }
  }
  assert.equal(createHash('sha256').update(hashes.join('\n')).digest('hex'),
    'cb90e32ad97743f6276429f1c1c388dad21188bf97173264cd9a2e484df7d7bc');
});
