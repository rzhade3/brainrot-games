import type { Brick, Level, ClassicDefinition, Power } from './types';

const powers: Power[] = ['add', 'wide', 'triple', 'fire', 'bomb', 'shield', 'slow', 'add'];

export function compileClassic(design: ClassicDefinition, wave: number, cycle: number): Level {
  const bricks: Brick[] = [];
  for (let row = 0; row < 20; row++)
    for (let col = 0; col < 14; col++) {
      if (design.tiles[row][col] !== '#') continue;
      const hp =
        1 +
        Math.min(
          5,
          cycle + ((row * 7 + col * 3 + design.armorPattern) % 5 === 0 ? 2 : (row + col) % 3 === 0 ? 1 : 0),
        );
      bricks.push({ x: 31 + col * 47, y: 90 + row * 28, w: 42, h: 23, hp, maxHp: hp });
    }
  // Eight spaced rewards, not a dense carpet that can auto-trigger itself.
  const candidates = [...bricks].sort((a, b) => hash(a.x, a.y, wave) - hash(b.x, b.y, wave));
  const chosen: Brick[] = [];
  for (const b of candidates) {
    if (chosen.length === powers.length) break;
    if (chosen.some((p) => Math.hypot(b.x - p.x, b.y - p.y) < 116)) continue;
    b.power = powers[chosen.length];
    b.hp = b.maxHp = 1;
    chosen.push(b);
  }
  return { name: design.name, hint: design.hint, bricks, obstacles: design.obstacles.map((o) => ({ ...o })) };
}
function hash(x: number, y: number, seed: number) {
  let n = Math.imul(x + seed * 71, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
