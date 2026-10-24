export const W = 600,
  H = 760,
  CELL = 5,
  COLS = W / CELL,
  ROWS = H / CELL;
export const TOOLS = [
  { name: "Nimble", width: 34, speed: 83, turn: 2.5 },
  { name: "All-rounder", width: 48, speed: 75, turn: 1.85 },
  { name: "Wide load", width: 66, speed: 66, turn: 1.25 },
];
export type Obstacle = {
  x: number;
  y: number;
  r: number;
  kind: "tree" | "turbine";
};
export type Field = {
  seed: number;
  name: string;
  mask: Uint8Array;
  total: number;
  obstacles: Obstacle[];
  limit: number;
};
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeField(level: number, seed = level * 7919): Field {
  const rng = random(seed),
    obstacles: Obstacle[] = [];
  const count = Math.min(6, level - 1);
  for (let n = 0; n < count; n++) {
    // Separated islands leave room to turn with the largest implement.
    obstacles.push({
      x: 180 + (n % 2) * 225 + (rng() - 0.5) * 35,
      y: 220 + Math.floor(n / 2) * 170 + (rng() - 0.5) * 30,
      r: 19 + rng() * 8,
      kind: n % 2 ? "tree" : "turbine",
    });
  }
  const mask = new Uint8Array(COLS * ROWS);
  let total = 0;
  for (let i = 0; i < mask.length; i++) {
    const x = ((i % COLS) + 0.5) * CELL,
      y = (Math.floor(i / COLS) + 0.5) * CELL;
    const cut = level >= 3 && x > 430 && y < 175;
    const taper = level >= 5 && x < 80 + Math.max(0, y - 430) * 0.28;
    if (
      x >= 65 &&
      x <= 535 &&
      y >= 85 &&
      y <= 675 &&
      !cut &&
      !taper &&
      !obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < o.r + 13)
    ) {
      mask[i] = 1;
      total++;
    }
  }
  const names = [
    "First furrow",
    "Windbreak",
    "The elbow",
    "Orchard run",
    "Crooked acres",
    "Tight quarters",
  ];
  return {
    seed,
    name: names[Math.min(level - 1, 5)],
    mask,
    total,
    obstacles,
    limit: Math.max(140, 240 - level * 10),
  };
}
export type Input = {
  throttle: number;
  steer: number;
  target?: { x: number; y: number };
};
export class Farm {
  x = 86;
  y = 700;
  angle = -Math.PI / 2;
  speed = 0;
  elapsed = 0;
  covered = 0;
  worked = 0;
  hits = 0;
  collisionFlash = 0;
  cooldown = 0;
  status: "playing" | "won" | "lost" = "playing";
  soil: Uint8Array;
  directions: Float32Array;
  changed: number[] = [];
  colliding = false;
  lastBrush: { x: number; y: number } | undefined;
  constructor(
    public field: Field,
    public tool = 1,
    public practice = false,
  ) {
    this.soil = new Uint8Array(field.mask.length);
    this.directions = new Float32Array(field.mask.length);
  }
  get coverage() {
    return this.covered / this.field.total;
  }
  get efficiency() {
    return this.worked ? this.covered / this.worked : 1;
  }
  get score() {
    return Math.max(
      0,
      Math.round(
        this.coverage * 1000 +
          this.efficiency * 500 +
          Math.max(0, this.field.limit - this.elapsed) * 5 -
          this.hits * 40,
      ),
    );
  }
  get stars() {
    return this.status !== "won"
      ? 0
      : 1 +
          Number(this.efficiency >= 0.7 && this.hits <= 3) +
          Number(
            this.efficiency >= 0.84 &&
              this.hits === 0 &&
              this.elapsed < this.field.limit * 0.85,
          );
  }
  step(dt: number, input: Input) {
    if (this.status !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 1 / 30);
    this.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.collisionFlash = Math.max(0, this.collisionFlash - dt);
    const spec = TOOLS[this.tool];
    let throttle = Math.max(-1, Math.min(1, input.throttle)),
      steer = Math.max(-1, Math.min(1, input.steer));
    if (input.target) {
      const dx = input.target.x - this.x,
        dy = input.target.y - this.y;
      const delta = Math.atan2(
        Math.sin(Math.atan2(dy, dx) - this.angle),
        Math.cos(Math.atan2(dy, dx) - this.angle),
      );
      steer = Math.max(-1, Math.min(1, delta * 2.8));
      throttle =
        Math.hypot(dx, dy) < 15
          ? 0
          : Math.max(0.18, Math.max(0, Math.cos(delta)) ** 2);
    }
    this.speed +=
      (throttle * spec.speed * (throttle < 0 ? 0.55 : 1) - this.speed) *
      Math.min(1, dt * 5);
    this.angle +=
      steer *
      spec.turn *
      dt *
      Math.min(1, Math.abs(this.speed) / 25) *
      (this.speed < 0 ? -1 : 1);
    const nx = this.x + Math.cos(this.angle) * this.speed * dt,
      ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const blocked =
      nx < 22 ||
      nx > W - 22 ||
      ny < 22 ||
      ny > H - 22 ||
      this.field.obstacles.some(
        (o) => Math.hypot(nx - o.x, ny - o.y) < o.r + 12,
      );
    if (blocked) {
      this.speed = 0;
      if (!this.colliding && this.cooldown === 0) {
        this.hits++;
        this.cooldown = 1.2;
        this.collisionFlash = 0.35;
      }
      this.lastBrush = undefined;
      this.colliding = true;
    } else {
      this.x = nx;
      this.y = ny;
      this.colliding = false;
    }
    // Lift the plough while reversing. Paint only moving, collision-free passes.
    if (!blocked && this.speed > 3) {
      const brush = {
        x: this.x - Math.cos(this.angle) * 22,
        y: this.y - Math.sin(this.angle) * 22,
      };
      const old = this.lastBrush ?? brush;
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(brush.x - old.x, brush.y - old.y) / 2),
      );
      for (let n = 1; n <= steps; n++)
        this.paint(
          old.x + ((brush.x - old.x) * n) / steps,
          old.y + ((brush.y - old.y) * n) / steps,
        );
      this.lastBrush = brush;
    } else this.lastBrush = undefined;
    if (this.coverage >= 0.98) this.status = "won";
    else if (!this.practice && this.elapsed >= this.field.limit)
      this.status = "lost";
  }
  private paint(bx: number, by: number) {
    const half = TOOLS[this.tool].width / 2,
      c = Math.cos(this.angle),
      s = Math.sin(this.angle);
    const radius = half + 5;
    for (
      let row = Math.max(0, Math.floor((by - radius) / CELL));
      row <= Math.min(ROWS - 1, Math.ceil((by + radius) / CELL));
      row++
    ) {
      for (
        let col = Math.max(0, Math.floor((bx - radius) / CELL));
        col <= Math.min(COLS - 1, Math.ceil((bx + radius) / CELL));
        col++
      ) {
        const i = row * COLS + col;
        if (!this.field.mask[i]) continue;
        const dx = (col + 0.5) * CELL - bx,
          dy = (row + 0.5) * CELL - by;
        if (Math.abs(dx * c + dy * s) > 3 || Math.abs(-dx * s + dy * c) > half)
          continue;
        // A cell is a new pass only after the blade has left it (prevents FPS-dependent overlap).
        if (this.soil[i] === 0) {
          this.covered++;
          this.directions[i] = this.angle;
          this.changed.push(i);
        }
        if (this.soil[i] !== 2) this.worked++;
        this.soil[i] = 2;
      }
    }
    for (let i = 0; i < this.soil.length; i++)
      if (this.soil[i] === 2) {
        const dx = ((i % COLS) + 0.5) * CELL - bx,
          dy = (Math.floor(i / COLS) + 0.5) * CELL - by;
        if (
          Math.abs(dx * c + dy * s) > 5 ||
          Math.abs(-dx * s + dy * c) > half + 2
        )
          this.soil[i] = 1;
      }
  }
}
