import { Breakout, W, H, R, TOP, PADDLE_Y, COLORS, type Hit } from './engine';
const GLYPHS = { triple: '×3', add: '+3', wide: '↔', fire: 'F', bomb: '✹', shield: 'S', slow: '~' };
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Toast extends Hit { text: string; life: number }
export class Renderer {
  private particles: Particle[] = [];
  private toasts: Toast[] = [];
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  clear() { this.particles = []; this.toasts = []; }
  hit(hit: Hit, reduced: boolean) {
    if (hit.text) { this.toasts.push({ ...hit, text: hit.text, life: 1 }); this.toasts = this.toasts.slice(-4); }
    if (!reduced) for (let i = 0; i < 5 && this.particles.length < 180; i++) this.particles.push({ ...hit, vx: (Math.random() - .5) * 130, vy: (Math.random() - .5) * 130, life: .35 });
  }
  draw(g: Breakout, dt: number, reduced: boolean) {
    const c = this.ctx;
    c.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    c.fillStyle = '#121420'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#252939';
    for (let x = 32; x < W; x += 32) for (let y = 40; y < PADDLE_Y - 20; y += 32) c.fillRect(x, y, 1.5, 1.5);
    const cleanup = g.remaining <= 5;
    for (const b of g.bricks) {
      if (b.hp <= 0) continue;
      c.fillStyle = b.power ? COLORS[b.power] : ['#7975ad', '#9791c4', '#b5a7db', '#ccbae7', '#e5d0f0', '#f3e6f8'][Math.min(5, b.hp - 1)];
      c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, 4); c.fill();
      if (cleanup) { c.strokeStyle = '#f5f5f7'; c.lineWidth = 2.5; c.stroke(); }
      if (b.power || b.hp > 1) this.text(b.power ? GLYPHS[b.power] : String(b.hp), b.x + b.w / 2, b.y + b.h / 2 + 6, 18, '#181827');
    }
    for (const o of g.obstacles) {
      if (o.kind === 'steel') {
        c.save(); c.beginPath(); c.rect(o.x, o.y, o.w, o.h); c.clip(); c.fillStyle = '#272e3b'; c.fillRect(o.x, o.y, o.w, o.h);
        c.strokeStyle = '#4d5c6b'; c.lineWidth = 3;
        for (let x = o.x - o.h; x < o.x + o.w + o.h; x += 14) { c.beginPath(); c.moveTo(x, o.y); c.lineTo(x + o.h, o.y + o.h); c.stroke(); }
        c.restore(); c.strokeStyle = '#8a9bae'; c.lineWidth = 2; c.strokeRect(o.x, o.y, o.w, o.h);
      } else {
        c.fillStyle = '#3c2926'; c.strokeStyle = '#ffac70'; c.lineWidth = 4;
        c.beginPath(); c.arc(o.x, o.y, o.radius, 0, Math.PI * 2); c.fill(); c.stroke();
        c.lineWidth = 1; c.beginPath(); c.arc(o.x, o.y, o.radius - 8, 0, Math.PI * 2); c.stroke();
        this.text('↗', o.x, o.y + 8, 24, '#ffac70');
      }
    }
    c.fillStyle = g.fire > 0 ? COLORS.fire : '#f5f5f7';
    for (const b of g.balls) {
      if (!reduced) { c.globalAlpha = .15; c.beginPath(); c.arc(b.x - b.vx * .012, b.y - b.vy * .012, R, 0, 7); c.fill(); c.globalAlpha = 1; }
      c.beginPath(); c.arc(b.x, b.y, R, 0, 7); c.fill();
    }
    c.fillStyle = g.wide > 0 ? COLORS.wide : '#bcf58b'; c.beginPath(); c.roundRect(g.paddle - g.width / 2, PADDLE_Y, g.width, 14, 6); c.fill();
    if (g.status === 'ready') {
      c.fillStyle = '#f5f5f7'; c.beginPath(); c.arc(g.paddle, PADDLE_Y - R - 1, R, 0, 7); c.fill();
      c.strokeStyle = '#bcf58b80'; c.lineWidth = 2; c.setLineDash([5, 9]); c.beginPath(); c.moveTo(g.paddle, PADDLE_Y - 18); c.lineTo(g.paddle + 42, PADDLE_Y - 190); c.stroke(); c.setLineDash([]);
    }
    if (g.shields) { c.strokeStyle = COLORS.shield; c.lineWidth = 3; c.beginPath(); c.moveTo(12, H - 34); c.lineTo(W - 12, H - 34); c.stroke(); }
    c.strokeStyle = '#363d4e'; c.lineWidth = 2; c.beginPath(); c.moveTo(12, PADDLE_Y + 30); c.lineTo(12, TOP); c.lineTo(W - 12, TOP); c.lineTo(W - 12, PADDLE_Y + 30); c.stroke();
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; c.globalAlpha = Math.max(0, p.life * 2.85); c.fillStyle = p.color; c.fillRect(p.x, p.y, 4, 4); }
    c.globalAlpha = 1; this.particles = this.particles.filter(p => p.life > 0);
    for (const t of this.toasts) { t.life -= dt; if (!reduced) t.y -= dt * 18; c.globalAlpha = Math.min(1, Math.max(0, t.life * 2)); this.text(t.text, Math.max(60, Math.min(W - 60, t.x)), t.y, 24, t.color); }
    c.globalAlpha = 1; this.toasts = this.toasts.filter(t => t.life > 0);
  }
  private text(s: string, x: number, y: number, size: number, color: string) { const c = this.ctx; c.fillStyle = color; c.font = `700 ${size}px system-ui`; c.textAlign = 'center'; c.fillText(s, x, y); }
}
