import type { Brick, Level, Obstacle, Power } from './levels';

export interface Chamber { id: number; color: string; initial: number; remaining: number; activeTime: number; opened: boolean }
export const CHAMBER_NAMES = ['Twin vaults', 'Nested rings', 'Honeycomb cascade'];
const PALETTE = ['#73dfc3', '#88bdf5', '#c5a0ee', '#f2b879', '#ed91bb', '#c9db80'];
const COLS = 32, ROWS = 28, PITCH = 20, LEFT = 40, TOP = 80;
type Cell = { wall?: boolean; gate?: boolean; room: number; vent?: number };

/** Tile-aligned walls keep entrances, brick clearance and gate connections deterministic. */
export function makeChambers(index: number, cycle: number): Level {
  const cells: Cell[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ room: 0 })));
  const chambers: Chamber[] = [];
  function room(x: number, y: number, w: number, h: number, mouth: number) {
    const id = chambers.length;
    chambers.push({ id, color: PALETTE[id % PALETTE.length], initial: 0, remaining: 0, activeTime: 0, opened: false });
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) {
      const edge = r === y || r === y + h - 1 || c === x || c === x + w - 1;
      cells[r][c] = { room: id, wall: edge, vent: r === y + h - 1 ? id : undefined };
    }
    // Five-cell mouths offer an aimed entry without demanding pixel-perfect shots.
    for (let c = mouth - 1; c < mouth + 4; c++) cells[y + h - 1][c] = { room: id, gate: true };
  }
  if (index === 0) {
    room(0, 0, 16, 28, 6); room(16, 0, 16, 28, 23);
    for (let r = 11; r < 14; r++) for (const c of [15, 16]) cells[r][c] = { room: c === 15 ? 0 : 1, gate: true };
  } else if (index === 1) {
    room(0, 0, 32, 28, 14); room(5, 5, 22, 18, 17); room(10, 10, 12, 8, 13);
  } else {
    // Staggered connections create a honeycomb of six connected rectangular cells.
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) room(c * 16, r * 9, 16, 9, c * 16 + (r % 2 ? 4 : 9));
    for (let r = 0; r < 3; r++) for (let y = r * 9 + 3; y < r * 9 + 6; y++) {
      cells[y][15] = { room: r * 2, gate: true }; cells[y][16] = { room: r * 2 + 1, gate: true };
    }
    // Each upper room's mouth meets an opening in the next room's roof.
    for (let r = 1; r < 3; r++) for (let side = 0; side < 2; side++) {
      const mouth = side * 16 + ((r - 1) % 2 ? 4 : 9);
      for (let c = mouth - 1; c < mouth + 4; c++) cells[r * 9][c] = { room: r * 2 + side, gate: true };
    }
    cells[27] = Array.from({ length: COLS }, () => ({ room: -1 }));
  }
  const bricks: Brick[] = [], obstacles: Obstacle[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = cells[r][c], x = LEFT + c * PITCH, y = TOP + r * PITCH;
    if (cell.wall) {
      obstacles.push({ kind: 'steel', x, y, w: 20, h: 20, vent: cell.vent });
    } else if (cell.room >= 0) {
      // Leave a ricochet lane inside every wall, so a successful breach reaches behind the carpet.
      const nearWall = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => cells[a]?.[b]?.wall);
      if (nearWall && !cell.gate) continue;
      const hp = cell.gate ? 1 : 1 + (cycle > 0 && (r * 3 + c) % 7 === 0 ? Math.min(2, cycle) : 0);
      bricks.push({ x, y, w: cell.gate ? 20 : 18, h: cell.gate ? 20 : 18, hp, maxHp: hp, chamber: cell.room, gate: cell.gate, color: PALETTE[cell.room % PALETTE.length] });
    }
  }
  // Merge horizontal plugs into readable +3 locks; one earned breach seeds the room.
  for (const b of [...bricks]) {
    if (!b.gate || !bricks.includes(b)) continue;
    const row = bricks.filter(n => n.gate && n.chamber === b.chamber && n.y === b.y && n.x >= b.x).sort((a, z) => a.x - z.x);
    const run = [b];
    for (const next of row.slice(1)) { if (next.x !== run[run.length - 1].x + 20) break; run.push(next); }
    if (run.length < 3) continue;
    for (const other of run.slice(1)) bricks.splice(bricks.indexOf(other), 1);
    b.w = run.length * 20; b.power = 'add'; b.hp = b.maxHp = 1;
  }
  // Two-wide rewards remain legible on phones. Each chamber earns its own multiplier.
  for (const chamber of chambers) {
    const targets = bricks.filter(b => b.chamber === chamber.id && !b.gate).sort((a, b) => b.y - a.y || Math.abs(a.x - 360) - Math.abs(b.x - 360));
    const rewards: Power[] = index === 2 ? ['add', 'triple', 'wide', 'fire'] : ['add', 'triple', 'add', 'wide', 'triple', 'fire'];
    const chosen: Brick[] = [];
    for (const power of rewards) {
      const candidates = targets.filter(b => bricks.includes(b) && !b.power && !chosen.some(p => Math.hypot(p.x - b.x, p.y - b.y) < 65));
      const top = Math.min(...targets.map(b => b.y)), bottom = Math.max(...targets.map(b => b.y));
      const depth = [.95, .8, .5, .65, .15, .3][chosen.length];
      candidates.sort((a, b) => Math.abs(a.y - (top + (bottom - top) * depth)) - Math.abs(b.y - (top + (bottom - top) * depth)));
      const b = candidates.find(b => bricks.some(n => !n.power && !n.gate && n.chamber === b.chamber && n.y === b.y && n.x === b.x + PITCH));
      if (!b) continue;
      const neighbor = bricks.find(n => n.x === b.x + PITCH && n.y === b.y)!;
      bricks.splice(bricks.indexOf(neighbor), 1); b.w = 38; b.hp = b.maxHp = 1; b.power = power; chosen.push(b);
    }
    chamber.initial = chamber.remaining = bricks.filter(b => b.chamber === chamber.id).length;
  }
  return { name: CHAMBER_NAMES[index], hint: 'Breach the gates. Catch the fallout.', bricks, obstacles, chambers };
}
