import './style.css';
import { GateRunner, offers, UPGRADE_INFO } from './engine';
import { draw } from './render';
import { getBestScore, submitScore } from '../../core/scores';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="shell"><header><a href="/" aria-label="Back to arcade">←</a><h1>GATE RUNNER</h1><button id="pause" aria-label="Pause game">Ⅱ</button></header><div class="hud"><span id="stage"></span><span id="squad"></span><span id="health"></span></div><div class="progress" aria-hidden="true"><div id="progress"></div></div><div class="arena"><canvas aria-label="Gate Runner. Drag to steer, or use arrow keys and A/D. Escape pauses." tabindex="0"></canvas><div class="overlay" id="overlay"><h2 id="title"></h2><p id="message"></p><div id="options"></div><button id="action">Run</button><div class="secondary"><button id="retry">Retry seed</button><button id="daily">Daily run</button></div><small id="seed"></small></div><div id="feedback" aria-live="polite"></div></div><div class="build" id="build"></div><footer><span id="score"></span><span id="best"></span></footer></main>`;
const el = (id: string) => document.getElementById(id)!;
const canvas = app.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
const params = new URLSearchParams(location.search), seedParam = params.get('seed');
let game = new GateRunner(seedParam && /^\d{1,10}$/.test(seedParam) ? Number(seedParam) : undefined);
let paused = false, last = 0, shown = '', best = getBestScore('gate-runner'), activePointer: number | null = null;
const keys = new Set<string>();
const resize = () => {
  const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
  ctx.setTransform(d, 0, 0, d, 0, 0);
};
new ResizeObserver(resize).observe(canvas);
function reset(seed?: number) {
  game = new GateRunner(seed); paused = false; keys.clear(); activePointer = null; shown = ''; updateOverlay();
}
function updateOverlay() {
  const s = game.state, show = s.status !== 'playing' || paused;
  el('overlay').hidden = !show;
  el('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  (el('pause') as HTMLButtonElement).disabled = s.status !== 'playing';
  el('pause').textContent = paused ? '▶' : 'Ⅱ';
  el('title').textContent = paused ? 'Paused' : s.status === 'ready' ? `Stage ${s.stage}` : s.status === 'choice' ? 'Build your squad' : s.status === 'cleared' ? 'Run complete' : 'Squad lost';
  el('message').textContent = paused ? 'Take your time.' : s.status === 'ready' ? 'Drag or use ← → to steer. Fire is automatic.' : s.status === 'choice' ? '+10 HP recovered. Choose one upgrade.' : `${s.score.toLocaleString()} points · ${s.kills} defeated · Stage ${s.stage}/5`;
  el('action').textContent = paused ? 'Resume' : s.status === 'ready' ? 'Run' : 'New run';
  el('action').hidden = s.status === 'choice';
  el('retry').hidden = !['over', 'cleared'].includes(s.status);
  el('daily').hidden = paused || s.status === 'choice' || (s.status === 'ready' && s.stage > 1);
  el('seed').textContent = `SEED ${s.seed}`;
  el('options').replaceChildren();
  if (s.status === 'choice' && !paused) {
    for (const u of offers(s.seed, s.stage)) {
      const b = document.createElement('button'), detail = document.createElement('small');
      b.textContent = UPGRADE_INFO[u].name;
      detail.textContent = UPGRADE_INFO[u].detail; b.append(detail);
      b.onclick = () => { game.choose(u); shown = ''; updateOverlay(); };
      el('options').append(b);
    }
  }
  if (show) {
    const focus = s.status === 'choice' ? el('options').querySelector('button') : el('action');
    focus?.focus({ preventScroll: true });
  }
}
function togglePause() {
  if (game.state.status !== 'playing') return;
  paused = !paused; keys.clear(); activePointer = null; updateOverlay();
  if (!paused) canvas.focus({ preventScroll: true });
}
el('action').onclick = () => {
  if (paused) togglePause();
  else if (game.state.status === 'ready') { game.start(); updateOverlay(); canvas.focus({ preventScroll: true }); }
  else reset();
};
el('retry').onclick = () => reset(game.state.seed);
el('daily').onclick = () => reset(Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')));
el('pause').onclick = togglePause;
function pointer(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  game.steer(((e.clientX - r.left) / r.width - .5) * 9);
}
canvas.addEventListener('pointerdown', e => {
  if (paused || game.state.status !== 'playing' || activePointer !== null) return;
  activePointer = e.pointerId; canvas.setPointerCapture(e.pointerId); pointer(e);
});
canvas.addEventListener('pointermove', e => { if (!paused && e.pointerId === activePointer) pointer(e); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { activePointer = null; });
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'a', 'd'].includes(key) && !paused && game.state.status === 'playing') { e.preventDefault(); keys.add(key); }
  if ((key === 'escape' || key === 'p') && !e.repeat) { e.preventDefault(); togglePause(); }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function suspend() {
  keys.clear(); activePointer = null;
  if (game.state.status === 'playing' && !paused) { paused = true; updateOverlay(); }
}
window.addEventListener('blur', suspend);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
function frame(t: number) {
  const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
  if (!paused) {
    const direction = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
    if (direction) game.steer(game.state.x + direction * 8 * dt);
    game.step(dt);
  }
  const s = game.state;
  if (shown !== s.status) {
    shown = s.status;
    if (shown === 'over' || shown === 'cleared') best = submitScore('gate-runner', s.score);
    updateOverlay();
  }
  draw(ctx, canvas.clientWidth, canvas.clientHeight, game);
  el('stage').textContent = `STAGE ${s.stage}/5`;
  el('squad').textContent = `${s.soldiers} SQUAD`;
  el('health').textContent = `${Math.ceil(s.hp)} HP`;
  el('score').textContent = `${s.score.toLocaleString()} PTS`;
  el('best').textContent = `BEST ${best.toLocaleString()}`;
  el('progress').style.width = `${s.z / game.level.length * 100}%`;
  el('build').textContent = `DMG ${s.damage.toFixed(1)} · FIRE ${s.rate.toFixed(1)}/s · ARMOR ${Math.round(s.armor * 100)}%${s.pierce ? ` · PIERCE ${s.pierce}` : ''}`;
  const feedback = s.elapsed < s.feedbackUntil && !paused && s.status === 'playing' ? s.feedback : '';
  if (el('feedback').textContent !== feedback) el('feedback').textContent = feedback;
  requestAnimationFrame(frame);
}
updateOverlay(); requestAnimationFrame(frame);
