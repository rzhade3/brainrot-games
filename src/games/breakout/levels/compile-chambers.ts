import type { Brick, Level, Obstacle, ChamberDefinition, RewardPocket } from './types';

const COLS = 32,
  ROWS = 28,
  PITCH = 20,
  LEFT = 40,
  TOP = 80;
type Cell = { wall?: boolean; gate?: boolean; room: number; vent?: number };

/** Compile room blueprints into fresh simulation objects; no level-specific branches. */
export function compileChambers(definition: ChamberDefinition, cycle: number): Level {
  const cells: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ room: -1 })),
  );
  paintRooms(cells, definition);
  paintOpenings(cells, definition);
  const { bricks, obstacles } = buildGeometry(cells, definition, cycle);
  mergeEntranceLocks(bricks);
  const chambers = definition.rooms.map((room, id) => {
    placeRewards(bricks, id, room.rewards);
    const initial = bricks.filter((brick) => brick.chamber === id).length;
    return { id, color: room.color, initial, remaining: initial, activeTime: 0, opened: false };
  });
  return { name: definition.name, hint: definition.hint, bricks, obstacles, chambers };
}

function paintRooms(cells: Cell[][], definition: ChamberDefinition) {
  for (const [id, room] of definition.rooms.entries()) {
    const { column: x, row: y, columns: w, rows: h } = room;
    for (let r = y; r < y + h; r++)
      for (let c = x; c < x + w; c++) {
        const edge = r === y || r === y + h - 1 || c === x || c === x + w - 1;
        cells[r][c] = { room: id, wall: edge, vent: r === y + h - 1 ? id : undefined };
      }
  }
}

function paintOpenings(cells: Cell[][], definition: ChamberDefinition) {
  for (const [id, room] of definition.rooms.entries()) {
    for (const opening of room.openings) {
      for (let offset = opening.offset; offset < opening.offset + opening.length; offset++) {
        const horizontal = opening.side === 'top' || opening.side === 'bottom';
        const c = room.column + (horizontal ? offset : opening.side === 'left' ? 0 : room.columns - 1);
        const r = room.row + (!horizontal ? offset : opening.side === 'top' ? 0 : room.rows - 1);
        cells[r][c] = { room: id, gate: true };
      }
    }
  }
}

function buildGeometry(cells: Cell[][], definition: ChamberDefinition, cycle: number) {
  const bricks: Brick[] = [],
    obstacles: Obstacle[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = cells[r][c],
        x = LEFT + c * PITCH,
        y = TOP + r * PITCH;
      if (cell.wall) {
        obstacles.push({ kind: 'steel', x, y, w: 20, h: 20, vent: cell.vent });
      } else if (cell.room >= 0) {
        // Leave a ricochet lane inside every wall, so a successful breach reaches behind the carpet.
        const nearWall = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ].some(([a, b]) => cells[a]?.[b]?.wall);
        if (nearWall && !cell.gate) continue;
        const hp = cell.gate ? 1 : 1 + (cycle > 0 && (r * 3 + c) % 7 === 0 ? Math.min(2, cycle) : 0);
        bricks.push({
          x,
          y,
          w: cell.gate ? 20 : 18,
          h: cell.gate ? 20 : 18,
          hp,
          maxHp: hp,
          chamber: cell.room,
          gate: cell.gate,
          color: definition.rooms[cell.room].color,
        });
      }
    }
  return { bricks, obstacles };
}

function mergeEntranceLocks(bricks: Brick[]) {
  // Merge horizontal plugs into readable +3 locks; one earned breach seeds the room.
  for (const b of [...bricks]) {
    if (!b.gate || !bricks.includes(b)) continue;
    const row = bricks
      .filter((n) => n.gate && n.chamber === b.chamber && n.y === b.y && n.x >= b.x)
      .sort((a, z) => a.x - z.x);
    const run = [b];
    for (const next of row.slice(1)) {
      if (next.x !== run[run.length - 1].x + 20) break;
      run.push(next);
    }
    if (run.length < 3) continue;
    for (const other of run.slice(1)) bricks.splice(bricks.indexOf(other), 1);
    b.w = run.length * 20;
    b.power = 'add';
    b.hp = b.maxHp = 1;
  }
}

function placeRewards(bricks: Brick[], roomId: number, rewards: readonly RewardPocket[]) {
  // Two-wide rewards remain legible on phones. Each chamber earns its own multiplier.
  const targets = bricks
    .filter((b) => b.chamber === roomId && !b.gate)
    .sort((a, b) => b.y - a.y || Math.abs(a.x - 360) - Math.abs(b.x - 360));
  const chosen: Brick[] = [];
  for (const { power, depth } of rewards) {
    const candidates = targets.filter(
      (b) => bricks.includes(b) && !b.power && !chosen.some((p) => Math.hypot(p.x - b.x, p.y - b.y) < 65),
    );
    const top = Math.min(...targets.map((b) => b.y)),
      bottom = Math.max(...targets.map((b) => b.y));
    candidates.sort(
      (a, b) =>
        Math.abs(a.y - (top + (bottom - top) * depth)) - Math.abs(b.y - (top + (bottom - top) * depth)),
    );
    const b = candidates.find((b) =>
      bricks.some(
        (n) => !n.power && !n.gate && n.chamber === b.chamber && n.y === b.y && n.x === b.x + PITCH,
      ),
    );
    if (!b) continue;
    const neighbor = bricks.find((n) => n.x === b.x + PITCH && n.y === b.y)!;
    bricks.splice(bricks.indexOf(neighbor), 1);
    b.w = 38;
    b.hp = b.maxHp = 1;
    b.power = power;
    chosen.push(b);
  }
}
