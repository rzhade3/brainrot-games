import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject } from './interaction';

test('board mapping roundtrips moves across orientations and pixel densities', () => {
  for (const dpr of [1, 2, 3]) for (const [width, height] of [[320, 400], [568, 160], [1400, 700]]) {
    const board = { width: width * dpr, height: height * dpr, padding: 30 * dpr };
    for (const p of [{ x: 0, y: 0 }, { x: .27, y: .81 }, { x: 1, y: 1 }]) {
      const restored = unproject(project(p, board), board);
      assert.ok(Math.abs(restored.x - p.x) < 1e-10);
      assert.ok(Math.abs(restored.y - p.y) < 1e-10);
    }
    assert.deepEqual(unproject({ x: -1000, y: 1e6 }, board), { x: 0, y: 1 });
  }
});
test('collapse changes only presentation and cannot overwrite playable positions', () => {
  const board = { width: 320, height: 400, padding: 30 };
  const point = { x: .27, y: .81 };
  assert.deepEqual(project(point, board, 0), { x: 160, y: 200 });
  assert.deepEqual(point, { x: .27, y: .81 });
  assert.ok(Number.isFinite(unproject({ x: 0, y: 0 }, { width: 1, height: 1, padding: 30 }).x));
});
