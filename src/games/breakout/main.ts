import './style.css';
import { getBestScore, submitScore } from '../../core/scores';
import { Breakout, W, H, R, PADDLE_Y, MAX_BALLS, LABELS, COLORS } from './engine';

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <header class="br-header"><a href="/" aria-label="Back to all games">← Arcade</a><h1>BREAK <span>ROT</span></h1><button id="help" aria-label="How to play">?</button></header>
  <main class="br-main">
    <div class="br-stats"><span>Score <b id="score">0</b></span><span>Wave <b id="wave">1</b></span><span>Best <b id="best">0</b></span></div>
    <div class="br-arena"><canvas tabindex="0" aria-label="Break Rot playfield. Move with arrow keys or A and D, mouse, or touch. Space launches; P pauses."></canvas>
      <div class="br-overlay" id="overlay"><h2 id="title">MORE BALLS.<br>LESS THOUGHT.</h2><p id="message">210 bricks. Three balls. One very bad idea.</p><button id="launch">LET IT ROT →</button></div>
    </div>
    <div class="br-status" id="status"></div><div class="br-sr" id="announcement" aria-live="polite"></div>
    <div class="br-controls"><button id="pause">Pause</button><button id="sound" aria-pressed="false">Sound off</button><button id="restart">Restart</button></div>
    <p class="br-tip">Drag anywhere to steer · ← → / A D · Space to launch · P to pause</p>
  </main>
  <dialog><h2>Break it. Multiply it.</h2><p>Clear the wall to start the next wave, keep your upgrades, and gain a life. Only lose a life when every ball is gone. Hit near the paddle’s edges to aim.</p><dl>${Object.entries(LABELS).map(([k, v]) => `<dt style="color:${COLORS[k as keyof typeof COLORS]}">${v}</dt><dd>${({ triple: 'Triple all live balls', add: 'Add three balls', wide: 'Permanently widen the paddle (up to 300)', fire: '10 seconds of piercing fireballs', bomb: 'Explode nearby bricks, chaining their powers', shield: 'Save one falling ball (stacks to five)', slow: '10 seconds of slow motion' })[k as keyof typeof LABELS]}</dd>`).join('')}</dl><p>Power tiles activate immediately when broken. Ball count caps at ${MAX_BALLS} for smooth play. Rapid hits build a score combo up to ×20. Scores save on this device.</p><button id="close-help">Got it</button></dialog>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = root.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const overlay = el('overlay'), dialog = root.querySelector('dialog')!;
let game = new Breakout(), paused = false, best = getBestScore('breakout'), sound = false;
let audio: AudioContext | undefined;
let lastTone = 0, lastTime = 0, accumulator = 0, lastStatus = '', saveClock = 0;
const keys = new Set<string>();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Toast { x: number; y: number; text: string; color: string; life: number }
let particles: Particle[] = [], toasts: Toast[] = [];
let announcement = '';
function announce() {
  const next = `Wave ${game.wave}. ${game.lives} lives. ${game.status === 'over' ? 'Game over.' : game.status === 'ready' ? 'Ready to launch.' : paused ? 'Paused.' : 'Playing.'}`;
  if (next !== announcement) { el('announcement').textContent = next; announcement = next; }
}
function persist() { best = submitScore('breakout', game.score); }
function syncOverlay() {
  announce();
  const visible = paused || game.status !== 'playing';
  overlay.hidden = !visible;
  el('pause').textContent = paused ? 'Resume' : 'Pause';
  if (!visible) return;
  el('title').innerHTML = paused ? 'BRAIN ON<br>PAUSE.' : game.status === 'over' ? 'ABSOLUTE<br>BRAINROT.' : game.score > 0 ? 'RUN IT<br>BACK.' : 'MORE BALLS.<br>LESS THOUGHT.';
  el('message').textContent = paused ? 'Your ball army is waiting.' : game.status === 'over' ? `${game.score.toLocaleString()} points · Wave ${game.wave} · Best ${best.toLocaleString()}` : `210 bricks · ${game.lives} lives · Break glowing tiles for instant power.`;
  el('launch').textContent = paused ? 'RESUME →' : game.status === 'over' ? 'ROT AGAIN →' : 'LAUNCH 3 BALLS →';
}
function start() {
  if (paused) paused = false;
  else { if (game.status === 'over') reset(); game.launch(); }
  audio?.resume(); accumulator = 0; syncOverlay(); canvas.focus({ preventScroll: true });
}
function reset() { persist(); game = new Breakout(); particles = []; toasts = []; paused = false; syncOverlay(); }
function togglePause() { if (game.status === 'playing') { paused = !paused; keys.clear(); syncOverlay(); } }
el('launch').onclick = start;
el('pause').onclick = togglePause;
el('restart').onclick = () => { if (game.status === 'playing' || paused) { paused = true; syncOverlay(); if (!confirm('Restart this run? Your best score will be kept.')) return; } reset(); };
el('sound').onclick = () => {
  sound = !sound;
  if (sound) { audio ??= new AudioContext(); audio.resume(); }
  el('sound').textContent = sound ? 'Sound on' : 'Sound off'; el('sound').setAttribute('aria-pressed', String(sound));
};
el('help').onclick = () => { if (game.status === 'playing' && !paused) togglePause(); dialog.showModal(); };
el('close-help').onclick = () => dialog.close();
function steer(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  game.move((event.clientX - rect.left) * W / rect.width);
}
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); steer(e); canvas.focus({ preventScroll: true }); });
canvas.addEventListener('pointermove', steer);
window.addEventListener('keydown', e => {
  if (dialog.open || (e.target instanceof HTMLElement && e.target.closest('button, a'))) return;
  if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'A', 'D', 'p', 'P', 'Escape'].includes(e.key)) {
    e.preventDefault(); keys.add(e.key.toLowerCase());
    if (!e.repeat && e.key === ' ') { if (game.status !== 'playing' || paused) start(); }
    if (!e.repeat && ['p', 'P', 'Escape'].includes(e.key)) togglePause();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function backgroundPause() { keys.clear(); if (game.status === 'playing' && !paused) togglePause(); persist(); }
window.addEventListener('blur', backgroundPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) backgroundPause(); });
window.addEventListener('pagehide', persist);
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
}
new ResizeObserver(resize).observe(canvas);
function text(s: string, x: number, y: number, size: number, color = '#f5f4ff') {
  ctx.fillStyle = color; ctx.font = `800 ${size}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(s, x, y);
}
function draw(dt: number) {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.fillStyle = '#100e24'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#25213d'; ctx.lineWidth = 1;
  for (let x = 24; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 65); ctx.lineTo(x, H); ctx.stroke(); }
  text(`WAVE ${String(game.wave).padStart(2, '0')}`, 90, 39, 19, '#aaa4c4');
  text(`${game.balls.length} BALL${game.balls.length === 1 ? '' : 'S'}`, W / 2, 39, 22, '#f5fc74');
  text(`${game.lives} LIVES`, W - 90, 39, 19, '#aaa4c4');
  for (const b of game.bricks) {
    if (b.hp <= 0) continue;
    ctx.fillStyle = b.power ? COLORS[b.power] : ['#6d68b8', '#8880da', '#a895e9', '#b7a5ef', '#d0c0ff'][Math.min(4, b.hp - 1)];
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
    if (b.power) text(LABELS[b.power], b.x + b.w / 2, b.y + 18, b.power === 'triple' || b.power === 'add' ? 17 : 11, '#171225');
    else if (b.hp > 1) text(String(b.hp), b.x + b.w / 2, b.y + 18, 12, '#211838');
  }
  ctx.fillStyle = game.fire > 0 ? COLORS.fire : '#f7fba4';
  for (const b of game.balls) {
    if (!reducedMotion.matches) { ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.ellipse(b.x - b.vx * .012, b.y - b.vy * .012, R + 1, R + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#73ffca'; ctx.beginPath(); ctx.roundRect(game.paddle - game.width / 2, PADDLE_Y, game.width, 15, 7); ctx.fill();
  if (game.status === 'ready') { ctx.fillStyle = '#f5fc74'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(game.paddle + i * 17, PADDLE_Y - 14, R, 0, 7); ctx.fill(); } }
  if (game.shields) { ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(12, H - 24); ctx.lineTo(W - 12, H - 24); ctx.stroke(); }
  ctx.strokeStyle = '#49405f'; ctx.lineWidth = 2; ctx.strokeRect(12, 65, W - 24, H - 65);
  for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); }
  ctx.globalAlpha = 1; particles = particles.filter(p => p.life > 0);
  for (const t of toasts) { t.life -= dt; if (!reducedMotion.matches) t.y -= dt * 25; ctx.globalAlpha = Math.min(1, Math.max(0, t.life * 2)); text(t.text, Math.max(95, Math.min(W - 95, t.x)), t.y, 26, t.color); }
  ctx.globalAlpha = 1; toasts = toasts.filter(t => t.life > 0);
}
function frame(now: number) {
  const dt = Math.min(.05, (now - (lastTime || now)) / 1000); lastTime = now;
  if (!paused && !dialog.open) {
    if (keys.has('arrowleft') || keys.has('a')) game.move(game.paddle - dt * 800);
    if (keys.has('arrowright') || keys.has('d')) game.move(game.paddle + dt * 800);
    accumulator += dt;
    while (accumulator >= 1 / 240) { game.step(1 / 240); accumulator -= 1 / 240; }
  } else accumulator = 0;
  if (game.hits.length) {
    for (const hit of game.hits) {
      if (hit.text) toasts.push({ ...hit, text: hit.text, life: 1.4 });
      if (!reducedMotion.matches) for (let i = 0; i < 4 && particles.length < 400; i++) particles.push({ ...hit, vx: (Math.random() - .5) * 160, vy: (Math.random() - .5) * 160, life: .5 });
    }
    toasts = toasts.slice(-12);
    if (sound && audio && now - lastTone > 55) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(260 + Math.min(20, game.combo) * 22, audio.currentTime);
      gain.gain.setValueAtTime(.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .06);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .07); lastTone = now;
    }
    game.hits = [];
  }
  if (lastStatus !== game.status) { if (game.status !== 'playing') persist(); lastStatus = game.status; syncOverlay(); }
  saveClock += dt; if (saveClock > 5) { persist(); saveClock = 0; }
  el('score').textContent = game.score.toLocaleString(); el('wave').textContent = String(game.wave); el('best').textContent = Math.max(best, game.score).toLocaleString();
  const status = [`${game.bricks.filter(b => b.hp > 0).length} bricks`, game.comboTime > 0 ? `Combo ×${Math.min(20, game.combo)}` : '', game.width > 124 ? `Paddle +${game.width - 124}` : '', game.shields ? `${game.shields} saves` : '', game.fire > 0 ? `Fire ${Math.ceil(game.fire)}s` : '', game.slow > 0 ? `Slow ${Math.ceil(game.slow)}s` : ''].filter(Boolean).join(' · ');
  el('status').textContent = status;
  announce();
  draw(paused ? 0 : dt); requestAnimationFrame(frame);
}
syncOverlay(); resize(); requestAnimationFrame(frame);
