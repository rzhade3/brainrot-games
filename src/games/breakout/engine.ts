import type { Chamber } from './levels/types';
import { makeLevel, type Brick, type Power, type Obstacle } from './levels';
export { type Brick, type Power, type Obstacle } from './levels';
export const W = 720, H = 960, R = 6, TOP = 24, PADDLE_Y = 848, MAX_BALLS = 48, BASE_WIDTH = 114;
export const LABELS: Record<Power, string> = { triple: '×3', add: '+3', wide: 'WIDE', fire: 'FIRE', bomb: 'BOOM', shield: 'SAVE', slow: 'SLOW' };
export const COLORS: Record<Power, string> = { triple: '#edff7a', add: '#73ffca', wide: '#72dcff', fire: '#ff9269', bomb: '#fa8bdb', shield: '#bba2ff', slow: '#a7dcff' };
export interface Ball { x: number; y: number; vx: number; vy: number; flight?: number }
export interface Hit { x: number; y: number; color: string; text?: string }
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export class Breakout {
  balls: Ball[] = [];
  bricks: Brick[] = [];
  obstacles: Obstacle[] = [];
  chambers: Chamber[] = [];
  hits: Hit[] = [];
  paddle = W / 2;
  width = BASE_WIDTH;
  name = '';
  hint = '';
  wave: number;
  score = 0;
  lives = 3;
  shields = 0;
  fire = 0;
  slow = 0;
  wide = 0;
  combo = 0;
  comboTime = 0;
  elapsed = 0;
  rally = 0;
  initialBricks = 0;
  status: 'ready' | 'playing' | 'cleared' | 'over' = 'ready';
  constructor(wave = 1) { this.wave = Math.max(1, Math.floor(wave)); this.loadLevel(); }
  private loadLevel() {
    const level = makeLevel(this.wave);
    this.bricks = level.bricks; this.obstacles = level.obstacles; this.name = level.name; this.hint = level.hint;
    this.chambers = level.chambers ?? [];
    this.initialBricks = this.bricks.length; this.elapsed = 0; this.resetServe();
  }
  private resetServe() {
    this.balls = []; this.fire = 0; this.slow = 0; this.wide = 0; this.shields = 0;
    this.width = this.baseWidth; this.combo = 0; this.comboTime = 0; this.rally = 0;
    this.paddle = W / 2; this.status = 'ready';
  }
  nextWave() { if (this.status === 'cleared') { this.wave++; this.loadLevel(); } }
  get baseWidth() { return this.chambers.length ? 138 : BASE_WIDTH; }
  get remaining() { return this.bricks.filter(b => b.hp > 0).length; }
  move(x: number) { this.paddle = clamp(x, 12 + this.width / 2, W - 12 - this.width / 2); }
  launch(aim = .24) {
    if (this.status !== 'ready') return;
    this.status = 'playing';
    const angle = clamp(aim, -.9, .9);
    this.balls.push({ x: this.paddle, y: PADDLE_Y - R - 1, vx: Math.sin(angle) * this.speed(), vy: -Math.cos(angle) * this.speed(), flight: 0 });
  }
  speed() { return Math.min(this.chambers.length ? 780 : 980, (this.chambers.length ? 480 : 520) + Math.min(12, this.wave - 1) * 18 + Math.min(160, this.rally * 4)); }
  private split(origin: Ball, count: number) {
    count = Math.min(count, MAX_BALLS - this.balls.length);
    const speed = Math.hypot(origin.vx, origin.vy) || this.speed();
    const angle = Math.atan2(origin.vy, origin.vx);
    for (let i = 0; i < count; i++) {
      const spread = count === 2 ? (i === 0 ? -.32 : .32) : (i - (count - 1) / 2) * .38;
      const theta = angle + spread;
      // Keep meaningful vertical travel, including after a near-horizontal bumper hit.
      let vx = Math.cos(theta) * speed, vy = Math.sin(theta) * speed;
      if (Math.abs(vy) < speed * .28) { vy = Math.sign(vy || -1) * speed * .28; vx = Math.sign(vx || 1) * Math.sqrt(speed * speed - vy * vy); }
      this.balls.push({ x: origin.x, y: origin.y, vx, vy, flight: 0 });
    }
  }
  power(kind: Power, origin: Ball) {
    if (kind === 'add') this.split(origin, 3);
    if (kind === 'triple') for (const b of this.balls.map(b => ({ ...b }))) this.split(b, 2);
    if (kind === 'wide') { this.wide = 10; this.width = 162; this.move(this.paddle); }
    if (kind === 'fire') this.fire = Math.min(8, this.fire + 4);
    if (kind === 'slow') this.slow = Math.min(10, this.slow + 5);
    if (kind === 'shield') this.shields = 1;
    this.hits.push({ x: origin.x, y: origin.y, color: COLORS[kind], text: LABELS[kind] });
  }
  private destroy(brick: Brick, ball: Ball) {
    brick.hp = 0;
    if (brick.chamber !== undefined) this.chambers[brick.chamber].remaining--;
    if (brick.gate) this.hits.push({ x: brick.x + brick.w / 2, y: brick.y, color: '#ffe5a3', text: 'BREACH' });
    this.combo = this.comboTime > 0 ? this.combo + 1 : 1; this.comboTime = 1.5;
    this.score += 10 * Math.min(10, this.combo);
    this.hits.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, color: brick.power ? COLORS[brick.power] : brick.color ?? '#b1a2e0' });
    if (!brick.power) return;
    this.power(brick.power, ball);
    if (brick.power === 'bomb') for (const other of this.bricks) {
      if (other.hp > 0 && Math.hypot(other.x - brick.x, other.y - brick.y) < 94) {
        other.hp -= 2;
        if (other.hp <= 0) this.destroy(other, ball);
      }
    }
  }
  /** Fixed 240 Hz simulation, shared by browser and diagnostic controllers. */
  step(dt: number) {
    if (this.status !== 'playing') return;
    this.elapsed += dt;
    this.fire = Math.max(0, this.fire - dt); this.slow = Math.max(0, this.slow - dt); this.wide = Math.max(0, this.wide - dt);
    if (this.wide === 0) this.width = this.baseWidth;
    this.comboTime = Math.max(0, this.comboTime - dt);
    const motion = dt * (this.slow > 0 ? .72 : 1);
    for (const b of [...this.balls]) {
      const ox = b.x, oy = b.y;
      b.flight = (b.flight ?? 0) + dt;
      // Open layouts can still produce repeating orbits: tip the trajectory without teleporting.
      if (b.flight > 14) { const speed = Math.hypot(b.vx, b.vy); b.vx = (b.vx >= 0 ? 1 : -1) * speed * .47; b.vy = speed * Math.sqrt(1 - .47 * .47); b.flight = 0; }
      b.x += b.vx * motion; b.y += b.vy * motion;
      if (b.x < 12 + R) { b.x = 12 + R; b.vx = Math.abs(b.vx); }
      if (b.x > W - 12 - R) { b.x = W - 12 - R; b.vx = -Math.abs(b.vx); }
      if (b.y < TOP + R) { b.y = TOP + R; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && oy + R <= PADDLE_Y && b.y + R >= PADDLE_Y && Math.abs(b.x - this.paddle) <= this.width / 2 + R) {
        let offset = clamp((b.x - this.paddle) / (this.width / 2), -1, 1);
        if (Math.abs(offset) < .07) offset = .07 * (b.vx >= 0 ? 1 : -1);
        this.rally++; const angle = offset * 1.1;
        b.vx = Math.sin(angle) * this.speed(); b.vy = -Math.cos(angle) * this.speed(); b.y = PADDLE_Y - R; b.flight = 0;
      }
      if (b.y > H - 34 && b.vy > 0 && this.shields > 0) {
        this.shields--; b.y = H - 34; b.vy = -Math.abs(b.vy);
        this.hits.push({ x: b.x, y: H - 40, color: COLORS.shield, text: 'SAVED' });
      }
      let blocked = false;
      for (const obstacle of this.obstacles) {
        if (obstacle.kind === 'steel') blocked = this.rectBounce(b, obstacle, ox, oy);
        else {
          const dx = b.x - obstacle.x, dy = b.y - obstacle.y, distance = Math.hypot(dx, dy), contact = obstacle.radius + R;
          if (distance < contact) {
            const nx = distance > 0 ? dx / distance : 0, ny = distance > 0 ? dy / distance : 1;
            b.x = obstacle.x + nx * (contact + .1); b.y = obstacle.y + ny * (contact + .1);
            const dot = b.vx * nx + b.vy * ny;
            if (dot < 0) {
              b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
              const speed = Math.hypot(b.vx, b.vy), boost = Math.min(980, speed * 1.08) / speed;
              b.vx *= boost; b.vy *= boost;
              this.hits.push({ x: obstacle.x, y: obstacle.y, color: '#ffac70' });
            }
            blocked = true;
          }
        }
        if (blocked) break;
      }
      if (blocked) continue;
      for (const brick of this.bricks) {
        if (brick.hp <= 0 || !overlaps(b, brick)) continue;
        // Reflect before spawning split balls so new balls start outside the hit brick.
        const piercing = this.fire > 0 || brick.gate === true && brick.hp === 1;
        if (!piercing) this.rectBounce(b, brick, ox, oy);
        if (piercing || --brick.hp <= 0) this.destroy(brick, b);
        break;
      }
    }
    this.balls = this.balls.filter(b => b.y < H + R);
    this.updateChambers(dt);
    if (this.remaining === 0) {
      this.score += 500 * this.wave;
      this.resetServe(); this.status = 'cleared';
    } else if (this.balls.length === 0) {
      this.lives--; this.resetServe(); this.status = this.lives > 0 ? 'ready' : 'over';
    }
  }
  private updateChambers(dt: number) {
    for (const room of this.chambers) {
      if (room.opened) continue;
      // Count only active play after the first damaged tile. Life loss cannot reseal a vent.
      if (room.remaining < room.initial) room.activeTime += dt;
      if (room.remaining > Math.ceil(room.initial * .18) && room.activeTime < 28) continue;
      room.opened = true;
      const vents = this.obstacles.filter(o => o.kind === 'steel' && o.vent === room.id);
      this.obstacles = this.obstacles.filter(o => o.kind !== 'steel' || o.vent !== room.id);
      for (const vent of vents) this.hits.push({ x: vent.x + 10, y: vent.y + 10, color: room.color });
      if (vents.length) this.hits.push({ x: vents[Math.floor(vents.length / 2)].x, y: vents[0].y, color: room.color, text: 'OPEN' });
    }
  }
  private rectBounce(b: Ball, rect: { x: number; y: number; w: number; h: number }, ox: number, oy: number) {
    if (!overlaps(b, rect)) return false;
    if (oy + R <= rect.y) { b.y = rect.y - R - .01; b.vy = -Math.abs(b.vy); }
    else if (oy - R >= rect.y + rect.h) { b.y = rect.y + rect.h + R + .01; b.vy = Math.abs(b.vy); }
    else if (ox + R <= rect.x) { b.x = rect.x - R - .01; b.vx = -Math.abs(b.vx); }
    else if (ox - R >= rect.x + rect.w) { b.x = rect.x + rect.w + R + .01; b.vx = Math.abs(b.vx); }
    else {
      // Resolve rare corner/spawn overlap along the shallowest penetration axis.
      const depths = [b.x + R - rect.x, rect.x + rect.w + R - b.x, b.y + R - rect.y, rect.y + rect.h + R - b.y];
      const side = depths.indexOf(Math.min(...depths));
      if (side === 0) { b.x = rect.x - R - .01; b.vx = -Math.abs(b.vx); }
      else if (side === 1) { b.x = rect.x + rect.w + R + .01; b.vx = Math.abs(b.vx); }
      else if (side === 2) { b.y = rect.y - R - .01; b.vy = -Math.abs(b.vy); }
      else { b.y = rect.y + rect.h + R + .01; b.vy = Math.abs(b.vy); }
    }
    return true;
  }
}
function overlaps(b: Ball, rect: { x: number; y: number; w: number; h: number }) { return b.x + R > rect.x && b.x - R < rect.x + rect.w && b.y + R > rect.y && b.y - R < rect.y + rect.h; }
