import type { LevelDefinition } from './types';

const POWERS = new Set(['add', 'triple', 'wide', 'fire', 'bomb', 'shield', 'slow']);
const SIDES = new Set(['top', 'bottom', 'left', 'right']);
function requireValue(condition: boolean, context: string, message: string): asserts condition {
  if (!condition) throw new Error(`Breakout level ${context}: ${message}`);
}

/** Fail at catalog load with the level/room ID, rather than during a collision. */
export function validateCatalog(levels: readonly LevelDefinition[]) {
  requireValue(levels.length > 0, 'catalog', 'must contain at least one level');
  const ids = new Set<string>();
  for (const level of levels) {
    const context = level.id;
    requireValue(Boolean(level.id) && !ids.has(level.id), context, 'level ID must be nonempty and unique');
    ids.add(level.id);
    requireValue(Boolean(level.name.trim()), context, 'name is required');
    if (level.kind === 'classic') {
      requireValue(
        level.tiles.length === 20 && level.tiles.every((row) => /^[.#]{14}$/.test(row)),
        context,
        'tiles must be 20 rows of 14 cells using only # and .',
      );
      requireValue(
        level.tiles.some((row) => row.includes('#')),
        context,
        'must contain bricks',
      );
      requireValue(
        Number.isInteger(level.armorPattern) && level.armorPattern >= 0,
        context,
        'armorPattern must be a nonnegative integer',
      );
      for (const obstacle of level.obstacles) {
        const values =
          obstacle.kind === 'steel'
            ? [obstacle.x, obstacle.y, obstacle.w, obstacle.h]
            : [obstacle.x, obstacle.y, obstacle.radius];
        requireValue(values.every(Number.isFinite), context, 'obstacle coordinates must be finite');
        requireValue(
          obstacle.kind === 'steel' ? obstacle.w > 0 && obstacle.h > 0 : obstacle.radius > 0,
          context,
          'obstacle size must be positive',
        );
      }
      continue;
    }
    requireValue(level.rooms.length > 0, context, 'must contain rooms');
    const roomIds = new Set<string>();
    for (const room of level.rooms) {
      const roomContext = `${context}/${room.id}`;
      requireValue(
        Boolean(room.id) && !roomIds.has(room.id),
        roomContext,
        'room ID must be nonempty and unique',
      );
      roomIds.add(room.id);
      requireValue(
        [room.column, room.row, room.columns, room.rows].every(Number.isInteger),
        roomContext,
        'room bounds must use integer tiles',
      );
      requireValue(
        room.column >= 0 &&
          room.row >= 0 &&
          room.columns >= 5 &&
          room.rows >= 5 &&
          room.column + room.columns <= 32 &&
          room.row + room.rows <= 28,
        roomContext,
        'room must fit the 32×28 grid and be at least 5×5',
      );
      requireValue(/^#[\da-f]{6}$/i.test(room.color), roomContext, 'color must be a six-digit hex color');
      requireValue(room.openings.length > 0, roomContext, 'room needs an opening');
      for (const opening of room.openings) {
        const length = opening.side === 'top' || opening.side === 'bottom' ? room.columns : room.rows;
        requireValue(SIDES.has(opening.side), roomContext, 'unknown opening side');
        requireValue(
          Number.isInteger(opening.offset) &&
            Number.isInteger(opening.length) &&
            opening.offset >= 1 &&
            opening.length >= 2 &&
            opening.offset + opening.length < length,
          roomContext,
          'opening must fit within its wall without replacing corners',
        );
      }
      for (const reward of room.rewards) {
        requireValue(
          POWERS.has(reward.power) && Number.isFinite(reward.depth) && reward.depth >= 0 && reward.depth <= 1,
          roomContext,
          'reward needs a known power and depth from 0 to 1',
        );
      }
    }
    // Side-by-side and nested rooms are supported; partial overlaps have ambiguous ownership.
    for (const [i, a] of level.rooms.entries())
      for (const b of level.rooms.slice(i + 1)) {
        const intersects =
          a.column < b.column + b.columns &&
          b.column < a.column + a.columns &&
          a.row < b.row + b.rows &&
          b.row < a.row + a.rows;
        const nested =
          b.column > a.column &&
          b.row > a.row &&
          b.column + b.columns < a.column + a.columns &&
          b.row + b.rows < a.row + a.rows;
        requireValue(
          !intersects || nested,
          context,
          `${b.id} must be disjoint from ${a.id} or strictly nested after it`,
        );
      }
  }
}
