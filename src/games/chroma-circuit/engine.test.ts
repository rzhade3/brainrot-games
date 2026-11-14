import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SIZE, palette, type Color, type Mosaic } from './art';
import { BELT_CAPACITY, Circuit, LAP_TIME, SLOT_COUNT, type Level } from './engine';
import { puzzles } from './levels';

for (const { level, solution } of puzzles) {
  test(`${level.name} has balanced ammo and a winning launch sequence`, () => {
    for (const color of Object.keys(palette) as Color[]) {
      const ammo = level.lanes.flat().filter(load => load.color === color).reduce((total, load) => total + load.ammo, 0);
      assert.equal(ammo, level.tiles.filter(tile => tile === color).length, color);
    }
    const game = new Circuit(level);
    for (const [source, slot] of solution) {
      assert.equal(game.launch(source, slot), true);
      game.advance(LAP_TIME + 1);
      if (game.phase === 'won' || game.clearingAutomatically) break;
    }
    if (game.clearingAutomatically) game.advance(LAP_TIME * game.remaining);
    assert.equal(game.phase, 'won');
    assert.equal(game.remaining, 0);
  });
}

test('a rider holds its ammo behind other colors and can be relaunched after a lap', () => {
  const { level, solution } = puzzles[0];
  const game = new Circuit(level);
  const [source, slot] = solution[0];
  const openingAmmo = game.supply[slot][0].ammo;
  assert.equal(game.launch(source, slot), true);
  game.advance(LAP_TIME);
  assert.ok(game.waiting[0]);
  assert.ok(game.waiting[0].ammo < openingAmmo);
  assert.equal(game.launch('waiting', 0), true);
  game.advance(LAP_TIME);
  assert.equal(game.waiting[0], null);
});

test('enough ammo of each color triggers faster laps until the board clears', () => {
  const tiles: Mosaic = Array(SIZE * SIZE).fill('ink');
  tiles[0] = 'gold';
  const game = new Circuit({ name: 'Cleanup check', tiles, lanes: [[
    { color: 'ink', ammo: tiles.length - 1 },
    { color: 'gold', ammo: 1 },
  ]] });

  assert.equal(game.launch('supply', 0), true);
  game.advance(300);
  assert.equal(game.clearingAutomatically, false);
  assert.equal(game.launch('supply', 0), true);
  assert.equal(game.clearingAutomatically, true);
  assert.equal(game.canLaunch, false);
  game.advance(LAP_TIME / 2);
  assert.equal(game.time, 300 + LAP_TIME * 1.5);
  assert.equal(game.phase, 'playing');
  assert.equal(game.waiting.every(slot => slot === null), true);
  assert.equal(game.riders.some(rider => rider.color === 'ink'), true);

  game.advance(LAP_TIME * SIZE);
  assert.equal(game.phase, 'won');
  assert.equal(game.remaining, 0);
});

test('four riders fill the belt and a sixth returning shooter overflows the dock', () => {
  const tiles: Mosaic = Array(SIZE * SIZE).fill(null);
  tiles[0] = 'ink';
  const level: Level = {
    name: 'Capacity check',
    tiles,
    lanes: [[...Array.from({ length: 6 }, () => ({ color: 'gold' as const, ammo: 1 })), { color: 'ink', ammo: 1 }], [], [], [], []],
  };
  const game = new Circuit(level);
  for (let i = 0; i < BELT_CAPACITY; i++) {
    assert.equal(game.launch('supply', 0), true);
    game.advance(300);
  }
  assert.equal(game.launch('supply', 0), false);
  game.advance(LAP_TIME);
  for (let i = BELT_CAPACITY; i < SLOT_COUNT; i++) {
    assert.equal(game.launch('supply', 0), true);
    game.advance(LAP_TIME);
  }
  assert.equal(game.waiting.filter(Boolean).length, SLOT_COUNT);
  assert.equal(game.launch('supply', 0), true);
  game.advance(LAP_TIME);
  assert.equal(game.phase, 'lost');
  assert.equal(game.failure, 'overflow');
});
