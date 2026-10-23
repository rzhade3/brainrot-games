/** Fixed-size world; rendering and input scale independently to any viewport. */
export const W = 720, H = 960, R = 6, PADDLE_Y = 866, MAX_BALLS = 128;
export type Power = 'triple' | 'add' | 'wide' | 'fire' | 'bomb' | 'shield' | 'slow';
export const LABELS: Record<Power, string> = { triple: '×3', add: '+3', wide: 'WIDE', fire: 'FIRE', bomb: 'BOOM', shield: 'SAVE', slow: 'SLOW' };
export const COLORS: Record<Power, string> = { triple: '#f5fc74', add: '#73ffca', wide: '#72dcff', fire: '#ff9269', bomb: '#fa8bdb', shield: '#bba2ff', slow: '#a7dcff' };
export interface Ball { x: number; y: number; vx: number; vy: number }
export interface Brick { x: number; y: number; w: number; h: number; hp: number; maxHp: number; power?: Power }
export interface Hit { x: number; y: number; color: string; text?: string }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const powers: Power[] = ['add', 'wide', 'triple', 'fire', 'shield', 'bomb', 'slow'];
export function makeWave(wave: number): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < 15; row++) for (let col = 0; col < 14; col++) {
    // Staggered power columns, including guaranteed multipliers close to the paddle.
    const power = (col + row * 3) % 5 === 0 ? powers[(row + Math.floor(col / 5) + wave - 1) % powers.length] : undefined;
    const hp = power ? 1 : 1 + Math.min(4, Math.floor((wave - 1) / 2) + (row < 5 ? 1 : 0));
    bricks.push({ x: 18 + col * 49, y: 100 + row * 31, w: 47, h: 27, hp, maxHp: hp, power });
  }
  return bricks;
}
export class Breakout {
  balls: Ball[] = [];
  bricks: Brick[] = [];
  hits: Hit[] = [];
  paddle = W / 2;
  width = 124;
  wave = 1;
  score = 0;
  lives = 3;
  shields = 0;
  fire = 0;
  slow = 0;
  combo = 0;
  comboTime = 0;
  status: 'ready' | 'playing' | 'over' = 'ready';
  constructor() { this.bricks = makeWave(this.wave); }
  move(x: number) { this.paddle = clamp(x, 12 + this.width / 2, W - 12 - this.width / 2); }
  launch() {
    if (this.status !== 'ready') return;
    this.status = 'playing';
    this.addBalls(3);
  }
  private speed() { return Math.min(900, 450 + this.wave * 20); }
  private addBalls(count: number, origin?: Ball) {
    count = Math.min(count, MAX_BALLS - this.balls.length);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + ((i + 1) / (count + 1) - 0.5) * 1.65;
      this.balls.push({ x: origin?.x ?? this.paddle, y: origin?.y ?? PADDLE_Y - 14, vx: Math.cos(angle) * this.speed(), vy: Math.sin(angle) * this.speed() });
    }
  }
  power(kind: Power, origin: Ball) {
    if (kind === 'add') this.addBalls(3, origin);
    if (kind === 'triple') {
      const sources = this.balls.map(b => ({ ...b }));
      for (const b of sources) this.addBalls(2, b);
    }
    if (kind === 'wide') { this.width = Math.min(300, this.width + 36); this.move(this.paddle); }
    if (kind === 'fire') this.fire = Math.min(24, this.fire + 10);
    if (kind === 'slow') this.slow = Math.min(24, this.slow + 10);
    if (kind === 'shield') this.shields = Math.min(5, this.shields + 1);
    this.hits.push({ x: origin.x, y: origin.y, color: COLORS[kind], text: LABELS[kind] });
  }
  private destroy(brick: Brick, ball: Ball) {
    brick.hp = 0;
    this.combo = this.comboTime > 0 ? this.combo + 1 : 1;
    this.comboTime = 2;
    this.score += 10 * Math.min(20, this.combo);
    this.hits.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, color: brick.power ? COLORS[brick.power] : '#8292ff' });
    if (!brick.power) return;
    const kind = brick.power;
    this.power(kind, ball);
    if (kind === 'bomb') {
      for (const other of this.bricks) {
        if (other.hp > 0 && Math.hypot(other.x - brick.x, other.y - brick.y) < 115) this.destroy(other, ball);
      }
    }
  }
  /** Call with a small fixed timestep (1/240 s); timers use game time only. */
  step(dt: number) {
    if (this.status !== 'playing') return;
    this.fire = Math.max(0, this.fire - dt); this.slow = Math.max(0, this.slow - dt);
    this.comboTime = Math.max(0, this.comboTime - dt);
    const motion = dt * (this.slow > 0 ? 0.65 : 1);
    // Newly spawned balls join on the next step rather than recursively simulating this one.
    for (const b of [...this.balls]) {
      const ox = b.x, oy = b.y;
      b.x += b.vx * motion; b.y += b.vy * motion;
      if (b.x < 12 + R) { b.x = 12 + R; b.vx = Math.abs(b.vx); }
      if (b.x > W - 12 - R) { b.x = W - 12 - R; b.vx = -Math.abs(b.vx); }
      if (b.y < 65 + R) { b.y = 65 + R; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && oy + R <= PADDLE_Y && b.y + R >= PADDLE_Y && Math.abs(b.x - this.paddle) <= this.width / 2 + R) {
        const offset = clamp((b.x - this.paddle) / (this.width / 2), -1, 1);
        const angle = offset * 1.12;
        b.vx = Math.sin(angle) * this.speed(); b.vy = -Math.cos(angle) * this.speed(); b.y = PADDLE_Y - R;
      }
      if (b.y > H - 25 && b.vy > 0 && this.shields > 0) {
        this.shields--; b.y = H - 25; b.vy = -Math.abs(b.vy);
        this.hits.push({ x: b.x, y: H - 30, color: COLORS.shield, text: 'SAVED' });
      }
      for (const brick of this.bricks) {
        if (brick.hp <= 0 || b.x + R < brick.x || b.x - R > brick.x + brick.w || b.y + R < brick.y || b.y - R > brick.y + brick.h) continue;
        if (this.fire > 0 || --brick.hp <= 0) this.destroy(brick, b);
        if (this.fire <= 0) {
          if (oy + R <= brick.y) { b.y = brick.y - R; b.vy = -Math.abs(b.vy); }
          else if (oy - R >= brick.y + brick.h) { b.y = brick.y + brick.h + R; b.vy = Math.abs(b.vy); }
          else if (ox < brick.x) { b.x = brick.x - R; b.vx = -Math.abs(b.vx); }
          else { b.x = brick.x + brick.w + R; b.vx = Math.abs(b.vx); }
        }
        break;
      }
    }
    this.balls = this.balls.filter(b => b.y < H + R);
    if (this.bricks.every(b => b.hp <= 0)) {
      this.score += 1000 * this.wave; this.wave++;
      this.bricks = makeWave(this.wave);
      this.lives = Math.min(5, this.lives + 1);
      // Retain upgrades and the ball army, launch it safely below the new wall.
      for (const b of this.balls) { b.x = clamp(b.x, 20, W - 20); b.y = 650; b.vy = -Math.abs(b.vy); }
      if (!this.balls.length) this.addBalls(3);
      this.hits.push({ x: W / 2, y: 640, color: '#f5fc74', text: `WAVE ${this.wave} · +1 LIFE` });
    } else if (!this.balls.length) {
      this.lives--; this.combo = 0; this.comboTime = 0;
      this.fire = 0; this.slow = 0;
      this.status = this.lives > 0 ? 'ready' : 'over';
    }
  }
}
