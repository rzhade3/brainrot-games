import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeLevel, LEVEL_DEFINITIONS } from './levels';
import { validateCatalog } from './levels/validate';
import { compileChambers } from './levels/compile-chambers';
import type { ChamberDefinition, ClassicDefinition, LevelDefinition } from './levels/types';
import fingerprints from './levels/legacy-fingerprints.json';

const chamber = () => structuredClone(LEVEL_DEFINITIONS[0]) as ChamberDefinition;
const classic = () =>
  structuredClone(LEVEL_DEFINITIONS.find((l) => l.kind === 'classic')) as ClassicDefinition;

test('declarative migration preserves exact output for six complete cycles', () => {
  fingerprints.forEach((expected, index) => {
    const actual = createHash('sha256')
      .update(JSON.stringify(makeLevel(index + 1)))
      .digest('hex');
    assert.equal(actual, expected, `Geometry, rewards or state changed in wave ${index + 1}`);
  });
});

test('authoring mistakes fail with level/room context', () => {
  const badMap = { ...classic(), tiles: ['#'] };
  assert.throws(() => validateCatalog([badMap]), /split-decision.*20 rows/);
  assert.throws(() => validateCatalog([classic(), classic()]), /unique/);
  const base = chamber(),
    room = base.rooms[0];
  const invalidRooms = [
    { ...room, columns: 33 },
    { ...room, column: 0.5 },
    { ...room, openings: [{ side: 'bottom' as const, offset: 15, length: 5 }] },
    { ...room, rewards: [{ power: 'triple' as const, depth: 2 }] },
    { ...room, openings: [] },
  ];
  for (const invalid of invalidRooms) {
    assert.throws(() => validateCatalog([{ ...base, rooms: [invalid] }]), /twin-vaults\/left/);
  }
  assert.throws(
    () => validateCatalog([{ ...base, rooms: [room, { ...room, id: 'overlap', column: 8 }] }]),
    /overlap.*disjoint/,
  );
  assert.throws(() => validateCatalog([]), /at least one/);
});

test('a new named chamber compiles without an index branch and returns independent objects', () => {
  const room = {
    ...chamber().rooms[0],
    id: 'new-room',
    openings: [{ side: 'bottom' as const, offset: 5, length: 5 }],
  };
  const definition: ChamberDefinition = {
    kind: 'chambers',
    id: 'new-arena',
    name: 'New arena',
    hint: 'Aim.',
    rooms: [room],
  };
  validateCatalog([definition]);
  const a = compileChambers(definition, 0),
    b = compileChambers(definition, 0);
  assert.equal(a.name, 'New arena');
  assert.ok(a.bricks.length > 0);
  a.bricks[0].hp = 0;
  a.chambers![0].opened = true;
  a.obstacles.length = 0;
  assert.ok(b.bricks[0].hp > 0);
  assert.equal(b.chambers![0].opened, false);
  assert.ok(b.obstacles.length > 0);
});

test('compilation does not mutate frozen authoring data', () => {
  function freeze(value: object): void {
    Object.freeze(value);
    for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  }
  const definitions = structuredClone(LEVEL_DEFINITIONS) as LevelDefinition[];
  const before = JSON.stringify(definitions);
  freeze(definitions);
  validateCatalog(definitions);
  for (const definition of definitions) if (definition.kind === 'chambers') compileChambers(definition, 2);
  assert.equal(JSON.stringify(definitions), before);
});
