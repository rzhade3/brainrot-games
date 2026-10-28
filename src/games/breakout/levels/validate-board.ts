import type { Level, Power } from './types';

const R = 6,
  CELL = 6,
  WIDTH = 720,
  HEIGHT = 960;
export function validateBoard(board: Level, required: Partial<Record<Power, number>> = {}): string[] {
  const errors: string[] = [];
  if (!board.bricks.length) errors.push('board has no targets');
  const groups = board.chambers ?? [];
  const validGroup = (id: number) =>
    Number.isInteger(id) && id >= 0 && id < groups.length && groups[id].id === id;
  const rects = [...board.bricks, ...board.obstacles.filter((o) => o.kind === 'steel')];
  for (const rect of rects) {
    if (
      ![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) ||
      rect.w <= 0 ||
      rect.h <= 0 ||
      rect.x < 12 ||
      rect.x + rect.w > 708 ||
      rect.y < 24 ||
      rect.y + rect.h >= 728
    )
      errors.push('invalid rectangle bounds');
  }
  for (const [i, a] of rects.entries())
    for (const b of rects.slice(i + 1)) {
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        errors.push('overlapping rectangles');
    }
  for (const [i, group] of groups.entries()) {
    const count = board.bricks.filter((b) => b.chamber === i).length;
    if (
      group.id !== i ||
      !count ||
      group.initial !== count ||
      group.remaining !== count ||
      group.opened ||
      group.activeTime !== 0
    )
      errors.push('invalid initial behavior group');
  }
  const powers = new Set(['add', 'triple', 'wide', 'fire', 'bomb', 'shield', 'slow']);
  for (const brick of board.bricks) {
    if (brick.power !== undefined && !powers.has(brick.power)) errors.push('unknown power');
    if (!Number.isInteger(brick.hp) || brick.hp < 1 || brick.hp !== brick.maxHp)
      errors.push('invalid initial durability');
    if (brick.chamber !== undefined && !validGroup(brick.chamber))
      errors.push('invalid brick group reference');
  }
  for (const obstacle of board.obstacles) {
    if (obstacle.kind === 'steel') {
      if (obstacle.vent !== undefined && !validGroup(obstacle.vent))
        errors.push('invalid floor group reference');
    } else {
      if (
        ![obstacle.x, obstacle.y, obstacle.radius].every(Number.isFinite) ||
        obstacle.radius <= 0 ||
        obstacle.x - obstacle.radius < 12 ||
        obstacle.x + obstacle.radius > 708 ||
        obstacle.y - obstacle.radius < 24 ||
        obstacle.y + obstacle.radius >= 728
      )
        errors.push('invalid bumper bounds');
      for (const rect of rects) {
        const x = Math.max(rect.x, Math.min(obstacle.x, rect.x + rect.w));
        const y = Math.max(rect.y, Math.min(obstacle.y, rect.y + rect.h));
        if (Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius)
          errors.push('bumper overlaps rectangle');
      }
    }
  }
  for (const [power, count] of Object.entries(required))
    if (board.bricks.filter((b) => b.power === power).length < count!)
      errors.push(`missing required ${power} rewards`);
  if (errors.length) return [...new Set(errors)];
  // Conservative ball-center flood with destructible targets removed. This checks potential
  // access, not that a player will find the trajectory or survive the resulting returns.
  const nx = WIDTH / CELL,
    ny = HEIGHT / CELL;
  const seen = new Uint8Array(nx * ny),
    free = new Uint8Array(nx * ny);
  for (let row = 0; row < ny; row++)
    for (let col = 0; col < nx; col++) {
      const x = col * CELL,
        y = row * CELL;
      if (x < 12 + R || x > WIDTH - 12 - R || y < 24 + R || y > HEIGHT - R) continue;
      if (
        !board.obstacles.some((o) =>
          o.kind === 'steel'
            ? x > o.x - R - 2 && x < o.x + o.w + R + 2 && y > o.y - R - 2 && y < o.y + o.h + R + 2
            : Math.hypot(x - o.x, y - o.y) < o.radius + R + 2,
        )
      )
        free[row * nx + col] = 1;
    }
  const start = Math.floor(848 / CELL) * nx + 60,
    queue = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    for (const next of [index - 1, index + 1, index - nx, index + nx]) {
      if (next >= 0 && next < free.length && free[next] && !seen[next]) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  for (const b of board.bricks) {
    const samples = [
      [b.x + b.w / 2, b.y - R - 10],
      [b.x + b.w / 2, b.y + b.h + R + 10],
      [b.x - R - 10, b.y + b.h / 2],
      [b.x + b.w + R + 10, b.y + b.h / 2],
    ];
    if (!samples.some(([x, y]) => seen[Math.round(y / CELL) * nx + Math.round(x / CELL)]))
      errors.push(`unreachable target at ${b.x},${b.y}`);
  }
  return [...new Set(errors)];
}
