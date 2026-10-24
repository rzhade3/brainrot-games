import { Farm, makeField, TOOLS } from '../src/games/fieldwork/engine';
// A deliberately simple lane driver: long passes and turns in the headlands.
// It does not plan around obstacles or hunt missed patches.
export function simulate(level: number, tool: number, seed?: number) {
  const game = new Farm(makeField(level, seed), tool);
  const points: {x: number; y: number}[] = [];
  const spacing = TOOLS[tool].width * .85;
  for (let x = 80, n = 0; x < 540; x += spacing, n++) {
    const end = n % 2 ? 725 : 40;
    points.push({x, y: end});
    if (x + spacing < 540) points.push({ x: x + spacing, y: end });
  }
  let next = 0;
  for (let frame = 0; frame < 60 * 300 && game.status === 'playing'; frame++) {
    const target = points[Math.min(next, points.length - 1)];
    if (Math.hypot(game.x - target.x, game.y - target.y) < 22 && next < points.length - 1) next++;
    game.step(1 / 60, { throttle: 0, steer: 0, target: points[Math.min(next, points.length - 1)] });
  }
  return { level, plough: TOOLS[tool].name, coverage: Math.round(game.coverage * 1000) / 10, efficiency: Math.round(game.efficiency * 100), collisions: game.hits, seconds: Math.round(game.elapsed), outcome: game.status };
}
console.table(Array.from({length: 6}, (_, i) => TOOLS.map((_, t) => simulate(i + 1, t))).flat());
