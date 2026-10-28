import { TWIN_VAULTS_MAP } from './twin-vaults-map';
import { compileTileMap } from './tile-map';
import { random, type LevelGenerator, type GenerationContext } from './generation';

function build(context: GenerationContext, vary: boolean) {
  const rng = random(context.seed),
    rows = TWIN_VAULTS_MAP.rows.map((row) => row.split(''));
  if (vary) {
    // Preserve the perimeter, connector gates and all rewards. Only move each five-cell
    // floor entrance within its own wall; the open lane immediately above stays intact.
    for (const [start, floor, gate] of [
      [0, '_', 'G'],
      [16, '=', 'g'],
    ] as const) {
      for (let col = start; col < start + 16; col++) rows[27][col] = floor;
      const offset = [4, 5, 6, 7][Math.floor(rng() * 4)];
      rows[27][start + offset] = gate;
      for (let i = 1; i < 5; i++) rows[27][start + offset + i] = '.';
    }
    const pattern = Math.floor(rng() * 3),
      phase = Math.floor(rng() * 4);
    for (let r = 2; r < 25; r++)
      for (let c = 2; c < 30; c++) {
        if (!['L', 'R'].includes(rows[r][c])) continue;
        if ((pattern === 1 && r % 5 === phase) || (pattern === 2 && (r + c + phase) % 7 === 0))
          rows[r][c] = '.';
      }
  }
  const board = compileTileMap({ ...TWIN_VAULTS_MAP, rows: rows.map((row) => row.join('')) });
  for (const b of board.bricks)
    if (!b.power && !b.gate) {
      const r = (b.y - 80) / 20,
        c = (b.x - 40) / 20;
      b.hp = b.maxHp =
        1 +
        (context.difficulty.cycle > 0 && (r * 3 + c) % 7 === 0 ? Math.min(2, context.difficulty.cycle) : 0);
    }
  return board;
}
export const twinVaults: LevelGenerator = {
  id: 'twin-vaults',
  version: 1,
  requiredRewards: { add: 6, triple: 4, wide: 2, fire: 2 },
  generate: (context) => build(context, true),
  fallback: (context) => build(context, false),
};
