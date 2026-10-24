import { CELL, COLS, Farm, H, random, TOOLS, W } from './engine';
export class Renderer {
  ctx: CanvasRenderingContext2D;
  ground = document.createElement('canvas');
  soil = this.ground.getContext('2d')!;
  current?: Farm;
  constructor(public canvas: HTMLCanvasElement) {
    canvas.width = W * 2; canvas.height = H * 2;
    this.ctx = canvas.getContext('2d')!; this.ctx.scale(2, 2);
    this.ground.width = W; this.ground.height = H;
  }
  prepare(game: Farm) {
    this.current = game;
    const g = this.soil, rng = random(game.field.seed);
    g.fillStyle = '#738354'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6500; i++) {
      g.fillStyle = rng() > .5 ? '#829060' : '#697b4e'; const x = rng() * W, y = rng() * H; g.fillRect(x, y, 2, 4);
    }
    game.field.mask.forEach((v, i) => {
      if (!v) return;
      g.fillStyle = ['#c4a675', '#c8ad7f', '#c2a271'][i % 3];
      const x = i % COLS * CELL, y = Math.floor(i / COLS) * CELL;
      g.fillRect(x, y, CELL, CELL); g.fillStyle = '#b5996a'; g.fillRect(x + 2, y, 1, CELL);
    });
    g.strokeStyle = '#a6ad80'; g.lineWidth = 2; g.strokeRect(17, 17, W - 34, H - 34);
    for (let y = 20; y < H; y += 40) for (const x of [15, W - 15]) { g.fillStyle = '#4c5639'; g.fillRect(x, y, 4, 9); }
    g.fillStyle = '#d4c49d'; g.fillRect(47, 688, 78, 40);
    g.fillStyle = '#5c633e'; g.font = '10px monospace'; g.fillText('START', 69, 718);
  }
  draw(game: Farm, time: number, reduced: boolean, target?: {x: number; y: number}) {
    if (this.current !== game) this.prepare(game);
    for (const i of game.changed) {
      const x = i % COLS * CELL, y = Math.floor(i / COLS) * CELL;
      this.soil.fillStyle = i % 3 ? '#594333' : '#604936'; this.soil.fillRect(x, y, CELL, CELL);
      this.soil.save(); this.soil.beginPath(); this.soil.rect(x, y, CELL, CELL); this.soil.clip();
      this.soil.translate(x + 2.5, y + 2.5); this.soil.rotate(game.directions[i]);
      this.soil.fillStyle = '#3e3027'; this.soil.fillRect(-5, -1, 10, 1); this.soil.restore();
    }
    game.changed.length = 0;
    const c = this.ctx; c.clearRect(0, 0, W, H); c.drawImage(this.ground, 0, 0);
    if (game.coverage > .9) {
      c.fillStyle = '#ffe5a3';
      game.field.mask.forEach((v, i) => { if (v && !game.soil[i]) c.fillRect(i % COLS * CELL + 1, Math.floor(i / COLS) * CELL + 1, 3, 3); });
    }
    if (target) { c.strokeStyle = '#fff3c688'; c.lineWidth = 2; c.beginPath(); c.arc(target.x, target.y, 12, 0, Math.PI * 2); c.stroke(); }
    // Draw shadows before objects; turbine blades rotate above the field.
    for (const o of game.field.obstacles) {
      c.fillStyle = '#34492c'; c.beginPath(); c.ellipse(o.x, o.y + 4, o.r + 11, o.r + 6, 0, 0, Math.PI * 2); c.fill();
      if (o.kind === 'tree') {
        for (const [dx, dy, r] of [[0, 0, o.r], [-10, -7, o.r * .7], [10, -12, o.r * .8]]) {
          c.fillStyle = dx < 0 ? '#4b6441' : '#3e5939'; c.beginPath(); c.arc(o.x + dx, o.y + dy - 10, r, 0, Math.PI * 2); c.fill();
        }
      } else {
        c.strokeStyle = '#34492c55'; c.lineWidth = 9; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x + 48, o.y + 40); c.stroke();
        c.strokeStyle = '#d4d6c4'; c.lineWidth = 7; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x, o.y - 58); c.stroke();
        c.save(); c.translate(o.x, o.y - 58); c.rotate(reduced ? .2 : time * .0003);
        for (let n = 0; n < 3; n++) { c.rotate(Math.PI * 2 / 3); c.fillStyle = '#f2eddc'; c.beginPath(); c.moveTo(-3, 2); c.lineTo(-5, -30); c.lineTo(0, -44); c.lineTo(3, 2); c.fill(); }
        c.fillStyle = '#8e9888'; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
    c.save(); c.translate(game.x + 4, game.y + 5); c.rotate(game.angle); c.fillStyle = '#26341f55'; c.fillRect(-18, -12, 35, 26); c.restore();
    c.save(); c.translate(game.x, game.y); c.rotate(game.angle);
    const width = TOOLS[game.tool].width;
    c.strokeStyle = '#444a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 0); c.lineTo(-23, 0); c.stroke();
    c.fillStyle = game.speed < -3 ? '#929985' : '#a95033'; c.fillRect(-26, -width / 2, 7, width);
    for (let n = -width / 2; n < width / 2; n += 7) { c.fillStyle = '#d1b48b'; c.fillRect(-29, n, 4, 3); }
    if (!reduced && game.speed > 10) for (let n = 0; n < 6; n++) {
      const t = (time / 1000 + n * .17) % 1;
      c.fillStyle = `rgba(207,182,140,${(1 - t) * .2})`; c.beginPath(); c.arc(-30 - t * 20, Math.sin(n * 4) * width / 2, 3 + t * 6, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#262d26'; for (const y of [-14, 7]) { c.fillRect(-13, y, 14, 7); c.fillRect(10, y + 2, 8, 5); }
    c.fillStyle = game.collisionFlash ? '#e8a06d' : '#d7aa43'; c.fillRect(-12, -9, 30, 18);
    c.fillStyle = '#f2ce70'; c.fillRect(4, -7, 13, 14);
    c.fillStyle = '#3f5c59'; c.fillRect(-8, -7, 10, 14); c.fillStyle = '#87a49a'; c.fillRect(-6, -5, 6, 3);
    c.fillStyle = '#f5e5b0'; c.fillRect(17, -7, 3, 3); c.fillRect(17, 4, 3, 3);
    c.restore();
    if (game.collisionFlash) { c.strokeStyle = '#e9a477'; c.lineWidth = 3; c.beginPath(); c.arc(game.x, game.y, 26 + (1 - game.collisionFlash / .35) * 10, 0, Math.PI * 2); c.stroke(); }
  }
}
