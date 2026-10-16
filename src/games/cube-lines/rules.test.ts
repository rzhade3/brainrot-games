import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from './layouts.json';
import { FACES, attemptMove, blockers, direction, exitCells, headFace, key, metrics, removable, solve, turns, validateLayout, type Cell, type Face, type Layout, type PuzzleLine, type SurfaceCell } from './rules';
import { FACE_AXES, firstImpact, impactMotion, movingPath, surfacePath, toWorld, worldDirection } from './geometry';
import { DIRECTIONS, step } from './surface';
import { LEVELS } from './levels';
import { endlessSpec, generateLevel, meetsSpec } from './generate';
import { PuzzleSession, readSave } from './state';

const layouts: readonly Layout[] = data.layouts as Layout[];
function line(id: string, face: Face, cells: readonly Cell[]): PuzzleLine {
  return { id, cells: cells.map(cell => ({ ...cell, face })) };
}
const arrow = line('a', 'front', [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
const blocker = line('b', 'front', [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }]);
const example: Layout = { size: 4, lines: [arrow, blocker] };
const wrapped: PuzzleLine = { id: 'wrapped', cells: [
  { face: 'front', x: 3, y: 1 }, { face: 'right', x: 0, y: 1 }, { face: 'right', x: 1, y: 1 },
] };
const crossBlocker: PuzzleLine = { id: 'cross', cells: [
  { face: 'right', x: 2, y: 1 }, { face: 'right', x: 2, y: 2 }, { face: 'right', x: 2, y: 3 },
  { face: 'top', x: 3, y: 2 }, { face: 'top', x: 2, y: 2 },
] };
const connected: Layout = { size: 4, lines: [wrapped, crossBlocker] };

test('all 24 directed cube edges map bijectively and reversibly, including polar reversals', () => {
  for (const size of [2, 4, 8, 12]) {
    const transitions = new Set<string>();
    for (const face of FACES) {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const cell: SurfaceCell = { face, x, y };
          const neighbours = DIRECTIONS.map(d => step(cell, d, size));
          assert.equal(new Set(neighbours.map(key)).size, 4);
          for (const next of neighbours) {
            assert.ok(next.x >= 0 && next.x < size && next.y >= 0 && next.y < size);
            assert.ok(DIRECTIONS.some(d => key(step(next, d, size)) === key(cell)));
            if (next.face === face) continue;
            transitions.add(`${face}:${next.face}`);
            const a = toWorld(face, cell, size, 0);
            const b = toWorld(next.face, next, size, 0);
            const distance = Math.hypot(...a.map((value, axis) => value - b[axis]));
            assert.ok(Math.abs(distance - Math.SQRT2 / size) < 1e-10);
          }
        }
      }
    }
    assert.equal(transitions.size, 24);
  }
  assert.deepEqual(step({ face: 'front', x: 1, y: 3 }, { x: 0, y: 1 }, 4), { face: 'top', x: 1, y: 0 });
  assert.deepEqual(step({ face: 'back', x: 1, y: 3 }, { x: 0, y: 1 }, 4), { face: 'top', x: 2, y: 3 });
  assert.deepEqual(step({ face: 'right', x: 2, y: 0 }, { x: 0, y: -1 }, 4), { face: 'bottom', x: 3, y: 1 });
});

test('cross-face bodies obstruct the head face and releasing one unlocks another face', () => {
  validateLayout(connected);
  assert.equal(headFace(wrapped), 'right');
  assert.equal(headFace(crossBlocker), 'top');
  assert.deepEqual(blockers(wrapped, connected.lines, 4).map(line => line.id), ['cross']);
  assert.equal(attemptMove(connected, 'wrapped').layout, connected);
  assert.deepEqual(firstImpact(wrapped, connected.lines, 4), { blocker: crossBlocker, distance: 0.63 });
  const moved = attemptMove(connected, 'cross');
  assert.equal(moved.removed, true);
  assert.equal(attemptMove(moved.layout, 'wrapped').layout.lines.length, 0);
  assert.equal(metrics(connected).crossFace, 0.5);
  assert.deepEqual(solve(connected), ['cross', 'wrapped']);
});

test('heads immediately after seams point inward on the new face; exits never wrap', () => {
  for (const face of FACES) {
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        const tail: SurfaceCell = { face, x, y };
        for (const d of DIRECTIONS) {
          const head = step(tail, d, 4);
          if (head.face === face) continue;
          const path: PuzzleLine = { id: 'seam-head', cells: [tail, head] };
          validateLayout({ size: 4, lines: [path] });
          assert.equal(exitCells(path, 4).length, 3);
          assert.ok(exitCells(path, 4).every(cell => cell.face === head.face));
          assert.deepEqual(step(head, direction(path), 4), exitCells(path, 4)[0]);
          assert.equal(Math.abs(direction(path).x) + Math.abs(direction(path).y), 1);
        }
      }
    }
  }
});

test('impact finds the nearest obstruction, regardless of line order or unrelated faces', () => {
  const distant = line('far', 'front', [{ x: 3, y: 0 }, { x: 3, y: 1 }]);
  const hidden = line('hidden', 'back', [{ x: 2, y: 0 }, { x: 2, y: 1 }]);
  assert.deepEqual(firstImpact(arrow, [arrow, distant, hidden, blocker], 4), { blocker, distance: 0.63 });
  assert.equal(firstImpact(arrow, [arrow, hidden], 4), null);
  assert.equal(firstImpact(arrow, [arrow, distant], 4)?.distance, 1.63);
});

test('slam accelerates up to contact, never crosses it, and returns exactly home', () => {
  for (const distance of [0.63, 1.63, 6.63]) {
    assert.equal(impactMotion(0, distance).distance, 0);
    assert.ok(impactMotion(100, distance).distance > impactMotion(50, distance).distance * 2);
    let hit = false;
    for (let elapsed = 0; elapsed < 650; elapsed += 5) {
      const motion = impactMotion(elapsed, distance);
      assert.ok(motion.distance >= 0 && motion.distance <= distance);
      hit ||= motion.hit;
    }
    assert.ok(hit);
    assert.deepEqual(impactMotion(650, distance), { distance: 0, hit: true, complete: true });
  }
});

test('all four escape directions work on every face and ignore identically addressed cells on other faces', () => {
  for (const face of FACES) {
    for (const { x: dx, y: dy } of DIRECTIONS) {
      const path = line('path', face, [{ x: 2, y: 2 }, { x: 2 + dx, y: 2 + dy }]);
      const further = { x: 2 + dx * 2, y: 2 + dy * 2 };
      const cells = [further, { x: further.x + dy, y: further.y + dx }];
      const other = line('other', face, cells);
      assert.equal(blockers(path, [path], 5).length, 0);
      assert.equal(blockers(path, [path, other], 5).length, 1);
      assert.equal(blockers(path, [path, line('other', FACES.find(f => f !== face)!, cells)], 5).length, 0);
    }
  }
  assert.deepEqual(exitCells(line('edge', 'front', [{ x: 2, y: 1 }, { x: 3, y: 1 }]), 4), []);
  assert.equal(attemptMove(example, 'missing').removed, false);
});

test('validation rejects overlaps, invalid seams, diagonal steps, repeated IDs and own-body exits across faces', () => {
  assert.doesNotThrow(() => validateLayout(example));
  assert.throws(() => validateLayout({ size: 4, lines: [arrow, { ...arrow, id: 'duplicate' }] }), /overlapping/);
  assert.throws(() => validateLayout({ size: 4, lines: [arrow, arrow] }), /invalid line/);
  assert.throws(() => validateLayout({ size: 4, lines: [line('diagonal', 'front', [{ x: 0, y: 0 }, { x: 1, y: 1 }])] }), /non-adjacent/);
  assert.throws(() => validateLayout({ size: 4, lines: [{ id: 'jump', cells: [
    { face: 'front', x: 0, y: 0 }, { face: 'back', x: 0, y: 0 },
  ] }] }), /non-adjacent/);
  assert.throws(() => validateLayout({ size: 4, lines: [{ id: 'wrong-edge', cells: [
    { face: 'front', x: 3, y: 1 }, { face: 'right', x: 0, y: 2 },
  ] }] }), /non-adjacent/);
  const self = line('self', 'front', [
    { x: 2, y: 1 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
  ]);
  assert.throws(() => validateLayout({ size: 4, lines: [self] }), /self-colliding/);
  const roundTrip: PuzzleLine = { id: 'round-trip', cells: [
    { face: 'front', x: 2, y: 2 }, { face: 'front', x: 3, y: 2 },
    { face: 'right', x: 0, y: 2 }, { face: 'right', x: 0, y: 1 },
    { face: 'front', x: 3, y: 1 }, { face: 'front', x: 2, y: 1 }, { face: 'front', x: 1, y: 1 },
    { face: 'front', x: 0, y: 1 }, { face: 'front', x: 0, y: 2 }, { face: 'front', x: 1, y: 2 },
  ] };
  assert.throws(() => validateLayout({ size: 4, lines: [roundTrip] }), /self-colliding/);
  assert.throws(() => validateLayout({ size: 4, lines: [{ ...roundTrip, cells: [
    ...roundTrip.cells, roundTrip.cells[0],
  ] }] }), /overlapping/);
});

test('all face bases are right-handed and points map to their own surfaces', () => {
  for (const face of FACES) {
    const { normal: n, u, v } = FACE_AXES[face];
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.deepEqual(cross.map(value => value || 0), [...n]);
    assert.deepEqual(toWorld(face, { x: 1.5, y: 1.5 }, 4, 0).map(value => value || 0), [...n]);
  }
});

test('wrapped rendering and snake sampling follow external edge corners, never cube-interior chords', () => {
  const route = surfacePath(wrapped, 4);
  assert.equal(route.length, 4);
  assert.deepEqual(route[1], [1.02, -0.25, 1.02]);
  assert.deepEqual(movingPath(wrapped, 0, 4), route);
  for (const candidate of [wrapped, crossBlocker, ...layouts[0].lines]) {
    for (let distance = 0; distance < candidate.cells.length + 4; distance += 0.25) {
      const path = movingPath(candidate, distance, layouts[0].lines.includes(candidate) ? layouts[0].size : 4);
      for (let i = 1; i < path.length; i++) {
        for (let t = 0; t <= 1; t += 0.1) {
          const point = path[i - 1].map((value, axis) => value + (path[i][axis] - value) * t);
          assert.ok(Math.max(...point.map(Math.abs)) >= 1.01999, 'body must stay outside the cube');
        }
      }
    }
  }
  assert.deepEqual(worldDirection(wrapped), [0, 0, -1]);
  const drained = movingPath(wrapped, 20, 4);
  assert.equal(drained.length, 2);
  assert.ok(drained[1][2] < drained[0][2]);
  const bent = line('bent', 'front', [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }]);
  assert.equal(turns(bent), 2);
  const half = movingPath(bent, 0.5, 4);
  assert.deepEqual(half[0], toWorld('front', { x: 0, y: 0.5 }, 4, 0.02));
  assert.deepEqual(half[half.length - 1], toWorld('front', { x: 1, y: 2.5 }, 4, 0.02));
});

test('session guards repeats and stale commits; cross-face saves restore only legal moves', () => {
  const session = new PuzzleSession(connected);
  assert.equal(session.begin('wrapped')?.commit, null);
  const move = session.begin('cross')!;
  assert.equal(session.begin('cross'), null);
  session.restart();
  assert.equal(move.commit!(), false);
  const current = session.begin('cross')!;
  assert.equal(current.commit!(), true);
  assert.equal(current.commit!(), false);
  assert.equal(session.begin('wrapped')!.commit!(), true);
  const raw = JSON.stringify({ version: 1, level: 1, completed: 0, removed: ['cross'] });
  assert.deepEqual(readSave(raw, [connected], 0).removed, ['cross']);
  for (const removed of [['wrapped'], ['cross', 'cross'], ['unknown']]) {
    assert.throws(() => readSave(JSON.stringify({ version: 1, level: 1, completed: 0, removed }), [connected], 0));
  }
  assert.throws(() => readSave('{bad', [example], 0));
  assert.throws(() => readSave(JSON.stringify({ version: 1, level: 2, completed: 0, removed: [] }), [example, example], 0));
  assert.equal(readSave(null, layouts, 30).level, 30);
  assert.equal(readSave(null, layouts, Infinity).completed, 0);
  assert.equal(readSave(null, layouts, 0).introduced, false);
  assert.equal(readSave(null, layouts, 2).introduced, true);
  assert.equal(readSave(raw, [connected], 0).introduced, true);
  assert.equal(readSave(JSON.stringify({ version: 1, level: 1, completed: 0, removed: [], introduced: true }), layouts, 0).introduced, true);
  assert.throws(() => readSave(JSON.stringify({ version: 1, level: 1, completed: 0, removed: [], introduced: 'yes' }), layouts, 0));
});

test('all 30 levels form a connected dependency graph, meet quality gates, and solve completely', () => {
  assert.equal(data.version, 2);
  assert.equal(layouts.length, 30);
  for (const [index, layout] of layouts.entries()) {
    validateLayout(layout);
    assert.ok(meetsSpec(layout, LEVELS[index]), `Level ${index + 1} missed targets`);
    assert.equal(metrics(layout).faceGroups, 1);
    assert.ok(removable(layout.lines, layout.size).length >= 3);
    for (const path of layout.lines) {
      assert.ok(new Set(path.cells.map(cell => cell.face)).size <= 3);
      assert.ok(path.cells.filter((cell, i) => i > 0 && cell.face !== path.cells[i - 1].face).length <= 2);
    }
    const sequence = solve(layout);
    assert.equal(sequence?.length, layout.lines.length);
    let remaining = layout;
    for (const id of sequence!) {
      const moved = attemptMove(remaining, id);
      assert.equal(moved.removed, true);
      remaining = moved.layout;
    }
    assert.equal(remaining.lines.length, 0);
  }
});

test('opening puzzles use cross-face sequencing rather than extra arrow count', () => {
  for (const layout of layouts.slice(0, 6)) {
    const m = metrics(layout);
    assert.equal(layout.size, 8);
    assert.ok(layout.lines.length >= 24 && layout.lines.length <= 36);
    assert.ok(m.density >= 0.65);
    assert.ok(m.blocked / layout.lines.length >= 0.6);
    assert.ok(m.depth >= 5);
    assert.ok(m.wrapped >= 0.3 && m.crossFace >= 0.2);
    assert.ok(m.long >= 0.35);
    assert.ok(layout.lines.some(line => line.cells.length >= 12));
    assert.ok(layout.lines.filter(line => turns(line) >= 2).length / layout.lines.length >= 0.6);
  }
});

test('endless specifications progress then plateau; independent seeds produce reproducible valid puzzles', () => {
  for (const value of [-1, 0.5, NaN, Infinity]) assert.throws(() => endlessSpec(value), /invalid endless/);
  assert.equal(endlessSpec(0).size, 8);
  assert.equal(endlessSpec(5).size, 9);
  assert.equal(endlessSpec(20).size, 12);
  assert.deepEqual(endlessSpec(25), endlessSpec(Number.MAX_SAFE_INTEGER));
  const hashes = new Set<string>();
  for (const [cleared, seed] of [[0, 0], [0, 1], [5, 42], [10, 1234], [15, 0x12345678], [25, 0xffffffff]]) {
    const spec = endlessSpec(cleared);
    const layout = generateLevel(spec, seed);
    validateLayout(layout);
    assert.ok(meetsSpec(layout, spec));
    assert.equal(solve(layout)?.length, layout.lines.length);
    const serialized = JSON.stringify(layout);
    if (seed < 2) assert.equal(JSON.stringify(generateLevel(spec, seed)), serialized);
    hashes.add(serialized);
  }
  assert.equal(hashes.size, 6);
  for (const seed of [-1, 1.5, Infinity, 0x100000000]) {
    assert.throws(() => generateLevel(endlessSpec(0), seed), /unsigned 32-bit/);
  }
});
