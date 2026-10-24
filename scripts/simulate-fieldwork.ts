import { Farm, makeField, TOOLS } from "../src/games/fieldwork/engine";
// A deliberately simple lane driver: long passes and turns in the headlands.
// The optional detour driver adds island avoidance and cleanup loops.
export function simulate(
  level: number,
  tool: number,
  seed?: number,
  avoid = false,
) {
  const game = new Farm(makeField(level, seed), tool);
  const points: { x: number; y: number }[] = [];
  const spacing = TOOLS[tool].width * 0.85;
  for (let x = 80, n = 0; x < 540; x += spacing, n++) {
    const end = n % 2 ? 725 : 40;
    if (avoid) {
      const direction = n % 2 ? 1 : -1;
      const obstacles = game.field.obstacles
        .filter((o) => Math.abs(o.x - x) < o.r + 40)
        .sort((a, b) => direction * (a.y - b.y));
      for (const o of obstacles) {
        const side = x < o.x ? -1 : 1,
          detour = o.x + side * (o.r + 43);
        points.push(
          { x, y: o.y - direction * 100 },
          { x: detour, y: o.y - direction * 65 },
          { x: detour, y: o.y + direction * 65 },
          { x, y: o.y + direction * 100 },
        );
      }
    }
    points.push({ x, y: end });
    if (x + spacing < 540) points.push({ x: x + spacing, y: end });
  }
  if (avoid)
    for (const o of game.field.obstacles) {
      const r = o.r + 30;
      points.push({ x: o.x, y: o.y + r + 60 });
      for (let n = 0; n <= 24; n++) {
        const angle = Math.PI / 2 + (n / 24) * Math.PI * 2;
        points.push({
          x: o.x + Math.cos(angle) * r,
          y: o.y + Math.sin(angle) * r,
        });
      }
    }
  let next = 0;
  for (let frame = 0; frame < 60 * 300 && game.status === "playing"; frame++) {
    const target = points[Math.min(next, points.length - 1)];
    if (
      Math.hypot(game.x - target.x, game.y - target.y) < 12 &&
      next < points.length - 1
    )
      next++;
    game.step(1 / 60, {
      throttle: 0,
      steer: 0,
      target: points[Math.min(next, points.length - 1)],
    });
  }
  return {
    driver: avoid ? "detour" : "lanes",
    level,
    plough: TOOLS[tool].name,
    coverage: Math.round(game.coverage * 1000) / 10,
    efficiency: Math.round(game.efficiency * 100),
    collisions: game.hits,
    fuel: Math.round(game.fuelFraction * 100),
    stars: game.stars,
    distance: Math.round(game.distance),
    outcome: game.status === "playing" ? "bot stalled / step cap" : game.status,
  };
}
console.table(
  Array.from({ length: 6 }, (_, i) =>
    TOOLS.map((_, t) => simulate(i + 1, t)),
  ).flat(),
);

console.table(
  Array.from({ length: 6 }, (_, i) =>
    TOOLS.map((_, t) => simulate(i + 1, t, undefined, true)),
  ).flat(),
);
