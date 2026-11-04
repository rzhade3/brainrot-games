import assert from 'node:assert/strict';
import test from 'node:test';
import { crossingFlags, newPuzzle, readPuzzle, type PuzzleSave } from './state';

const crossed: PuzzleSave = { version: 1, solved: 3,
  points: [{ x: .1, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }, { x: .9, y: .1 }],
  edges: [[0, 1], [1, 2], [2, 3]] };

test('saves restore the exact moved positions, connections and progress', () => {
  assert.deepEqual(readPuzzle(JSON.stringify(crossed)), crossed);
  assert.equal(readPuzzle(null), null);
  for (const value of ['broken', '{}', JSON.stringify({ ...crossed, solved: -1 }),
    JSON.stringify({ ...crossed, points: [{ x: 2, y: 0 }] }),
    JSON.stringify({ ...crossed, edges: [[0, 50], [1, 2]] })]) assert.equal(readPuzzle(value), null);
});

test('crossing feedback counts affected strings, not crossing pairs or shared endpoints', () => {
  assert.deepEqual(crossingFlags(crossed), [true, false, true]);
  assert.deepEqual(crossingFlags({ points: crossed.points, edges: [[0, 1], [1, 2]] }), [false, false]);
});

test('normalized positions preserve the puzzle on portrait and landscape boards', () => {
  for (const [width, height] of [[320, 400], [1200, 700], [568, 160]]) {
    const points = crossed.points.map(p => ({ x: 30 + p.x * (width - 60), y: 30 + p.y * (height - 60) }));
    assert.deepEqual(crossingFlags({ points, edges: crossed.edges }), crossingFlags(crossed));
  }
});

test('new puzzles ease into full density, stay connected and always require a move', () => {
  for (const solved of [0, 1, 2, 3, 8, 20]) for (let trial = 0; trial < 12; trial++) {
    const puzzle = newPuzzle(solved);
    assert.equal(puzzle.points.length, Math.min(20, [5, 7, 9][solved] ?? 12 + solved - 3));
    assert.ok(crossingFlags(puzzle).some(Boolean));
    assert.ok(readPuzzle(JSON.stringify(puzzle)));
    const visited = new Set([0]);
    for (let i = 0; i < puzzle.points.length; i++) for (const [a, b] of puzzle.edges) {
      if (visited.has(a)) visited.add(b);
      if (visited.has(b)) visited.add(a);
    }
    assert.equal(visited.size, puzzle.points.length);
  }
});

test('unlucky generation still produces a connected, tangled playable puzzle', () => {
  const original = Math.random;
  try {
    Math.random = () => 0;
    const puzzle = newPuzzle(0);
    assert.ok(crossingFlags(puzzle).some(Boolean));
    assert.ok(readPuzzle(JSON.stringify(puzzle)));
  } finally { Math.random = original; }
});

test('legacy node scores are dropped without discarding the current puzzle or progression', () => {
  const legacy = JSON.stringify({ ...crossed, earnedNodes: 21 });
  const restored = readPuzzle(legacy);
  assert.deepEqual(restored, crossed);
  assert.ok(!JSON.stringify(restored).includes('earnedNodes'));
  assert.deepEqual(readPuzzle(JSON.stringify(restored)), crossed);
});
