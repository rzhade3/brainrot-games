import './style.css';
import { GateRunner, offers, UPGRADE_INFO, type GameEvent } from './engine';
import { draw } from './render';
import { Feedback, GameSound, announce, upgradePreview } from './feedback';
import { getBestScore, submitScore } from '../../core/scores';

const icons = {
  back: '<path d="m14 6-6 6 6 6M8 12h12"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m9 5 10 7-10 7Z"/>',
};
const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="shell">
  <header><a href="/" aria-label="Back to arcade">${icon('back')}</a><h1 id="stage">Stage 1 / 5</h1><button id="pause" aria-label="Pause game">${icon('pause')}</button></header>
  <div class="hud">
    <div class="stat" id="squad-stat"><span>Soldiers</span><strong id="squad">12</strong><span class="delta" id="squad-delta" aria-hidden="true"></span></div>
  </div>
  <div class="progress" id="progress" role="progressbar" aria-label="Stage progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="progress-fill"></div></div>
  <div class="arena"><canvas aria-label="Drag or use arrow keys to steer. Shots fire automatically when you line up with an enemy. Escape pauses." tabindex="0"></canvas>
    <div class="overlay" id="overlay" role="dialog" aria-modal="true" aria-labelledby="title" aria-describedby="message">
      <div class="menu"><h2 id="title">Gate Runner</h2><p id="message"></p><div id="results"></div><div id="options"></div>
      <button class="primary" id="action">Start run</button>
      <div class="secondary"><button id="retry">New run</button><button id="daily">Daily challenge</button></div>
      <p class="controls" id="controls">Drag to move, or use the arrow keys.</p>
      <details id="details"><summary>Run details</summary><dl id="build"></dl><p id="course"></p><button id="sound" aria-pressed="false">Sound off</button></details>
      <p class="best" id="best"></p><a class="menu-back" href="/">Back to arcade</a></div>
    </div>
    <div id="notice" aria-hidden="true"></div>
  </div>
  <footer><span>Score <strong id="score">0</strong></span><span id="stage-status"></span></footer>
  <div class="sr-only" id="announcement" role="status" aria-live="polite" aria-atomic="true"></div>
</main>`;
const el = (id: string) => document.getElementById(id)!;
const canvas = app.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const feedback = new Feedback(), sound = new GameSound();
const params = new URLSearchParams(location.search), seedParam = params.get('seed');
let game = new GateRunner(seedParam && /^\d{1,10}$/.test(seedParam) ? Number(seedParam) : undefined);
let paused = false, last = 0, shown = '', best = getBestScore('gate-runner'), activePointer: number | null = null;
let transitionAt = 0, isDaily = false, noticeUntil = 0;
const keys = new Set<string>(), badges = new Map<string, number>();
const text = (id: string, value: string) => { if (el(id).textContent !== value) el(id).textContent = value; };
const resize = () => {
  const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0);
};
new ResizeObserver(resize).observe(canvas);
function reset(seed?: number, daily = false) {
  game = new GateRunner(seed); feedback.reset(); paused = false; transitionAt = 0;
  isDaily = daily; keys.clear(); activePointer = null; badges.clear();
  for (const id of ['squad-delta', 'notice']) text(id, '');
  game.start(); updateOverlay(); canvas.focus({ preventScroll: true });
}
const defeat = {
  mine: 'A mine took out your squad. Stay clear of the marked circles.',
  collision: 'An enemy reached your squad. Line up your shots, then move clear.',
  projectile: 'Enemy fire stopped your run. Move when the red aiming lines appear.',
};
function updateOverlay() {
  const s = game.state, show = s.status !== 'playing' || paused;
  shown = s.status; transitionAt = 0;
  el('overlay').hidden = !show;
  el('overlay').dataset.mode = paused ? 'paused' : s.status;
  app.querySelector('header')!.inert = show;
  canvas.inert = show;
  el('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  (el('pause') as HTMLButtonElement).disabled = s.status !== 'playing';
  el('pause').innerHTML = icon(paused ? 'play' : 'pause');
  text('title', paused ? 'Paused' : s.status === 'ready' ? 'Gate Runner' : s.status === 'choice' ? 'Choose an upgrade' : s.status === 'cleared' ? 'All five cleared' : 'Run over');
  text('message', paused ? 'Resume when you’re ready.' : s.status === 'ready' ? 'Your squad is your life. Dodge attacks and recruit soldiers at gates. Shots fire automatically.' : s.status === 'choice' ? `Next: stage ${s.stage + 1} of 5` : s.status === 'cleared' ? 'Try a new course, or beat your score on this one.' : defeat[s.lastDamage ?? 'projectile']);
  text('action', paused ? 'Resume' : s.status === 'ready' ? 'Start run' : 'Retry this run');
  el('action').hidden = s.status === 'choice';
  el('retry').hidden = !['over', 'cleared'].includes(s.status) || paused;
  el('daily').hidden = paused || s.status !== 'ready';
  el('daily').setAttribute('title', 'The same course for everyone today (UTC)');
  el('controls').hidden = s.status !== 'ready' && !paused;
  el('details').hidden = !paused;
  app.querySelector<HTMLElement>('.menu-back')!.hidden = s.status === 'choice';
  text('course', `${isDaily ? 'Daily challenge · ' : ''}Course ${s.seed}`);
  const stats = [['Damage', s.damage.toFixed(1)], ['Fire rate', `${s.rate.toFixed(1)} / sec`], ['Targets per shot', String(s.pierce + 1)]];
  el('build').replaceChildren();
  for (const [name, value] of stats) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; el('build').append(dt, dd); }
  text('best', best > 0 && s.status !== 'choice' ? `Personal best ${best.toLocaleString()}` : '');
  el('results').replaceChildren();
  if (!paused && ['over', 'cleared'].includes(s.status)) {
    for (const [label, value] of [['Score', s.score.toLocaleString()], ['Defeated', String(s.kills)]]) {
      const item = document.createElement('div'), strong = document.createElement('strong'), caption = document.createElement('span');
      strong.textContent = value; caption.textContent = label; item.append(strong, caption); el('results').append(item);
    }
  }
  el('options').replaceChildren();
  if (s.status === 'choice' && !paused) for (const u of offers(s.seed, s.stage)) {
    const b = document.createElement('button'), detail = document.createElement('span');
    b.textContent = UPGRADE_INFO[u].name; detail.textContent = upgradePreview(u, s); b.append(detail);
    b.onclick = () => { feedback.reset(); game.choose(u); game.start(); keys.clear(); updateOverlay(); canvas.focus({ preventScroll: true }); };
    el('options').append(b);
  }
  if (show) (s.status === 'choice' ? el('options').querySelector('button') : el('action'))?.focus({ preventScroll: true });
}
function togglePause() {
  if (game.state.status !== 'playing') return;
  paused = !paused; keys.clear(); activePointer = null; updateOverlay();
  if (!paused) canvas.focus({ preventScroll: true });
}
el('action').onclick = () => {
  if (paused) togglePause();
  else if (game.state.status === 'ready') { game.start(); updateOverlay(); canvas.focus({ preventScroll: true }); }
  else reset(game.state.seed, isDaily);
};
el('retry').onclick = () => reset();
el('daily').onclick = () => reset(Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')), true);
el('pause').onclick = togglePause;
el('sound').onclick = async () => {
  const button = el('sound') as HTMLButtonElement; button.disabled = true;
  const enabled = await sound.toggle(); text('sound', enabled ? 'Sound on' : 'Sound off'); button.setAttribute('aria-pressed', String(enabled)); button.disabled = false;
};
function pointer(e: PointerEvent) {
  const r = canvas.getBoundingClientRect(); game.steer(((e.clientX - r.left) / r.width - .5) * 11);
}
canvas.addEventListener('pointerdown', e => {
  if (paused || game.state.status !== 'playing' || activePointer !== null) return;
  activePointer = e.pointerId; canvas.setPointerCapture(e.pointerId); pointer(e);
});
canvas.addEventListener('pointermove', e => { if (!paused && e.pointerId === activePointer) pointer(e); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => { if ((e as PointerEvent).pointerId === activePointer) activePointer = null; });
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (key === 'tab' && !el('overlay').hidden) {
    const items = [...el('overlay').querySelectorAll<HTMLElement>('button:not([disabled]),a,summary')].filter(item => item.getClientRects().length > 0);
    const first = items[0], end = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end?.focus(); }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first?.focus(); }
  }
  if (['arrowleft', 'arrowright', 'a', 'd'].includes(key) && !paused && game.state.status === 'playing') { e.preventDefault(); keys.add(key); }
  if ((key === 'escape' || key === 'p') && !e.repeat) { e.preventDefault(); togglePause(); }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function suspend() { keys.clear(); activePointer = null; if (game.state.status === 'playing' && !paused) { paused = true; updateOverlay(); } }
window.addEventListener('blur', suspend);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
function pulse(id: string, positive: boolean) {
  const target = el(id); target.getAnimations().forEach(a => a.cancel());
  target.animate(motion.matches ? [{ color: positive ? '#a8e6cf' : '#ffb0a0' }, { color: 'inherit' }] : [{ transform: 'scale(1.12)', color: positive ? '#a8e6cf' : '#ffb0a0' }, { transform: 'scale(1)', color: 'inherit' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
}
function handleEvents(events: GameEvent[]) {
  feedback.accept(events); sound.play(events);
  const squad = events.reduce((n, e) => n + e.squad, 0);
  for (const [id, value] of [['squad', squad]] as const) if (value !== 0) {
    const signed = `${value > 0 ? '+' : '−'}${Math.ceil(Math.abs(value))}`;
    text(`${id}-delta`, signed); el(`${id}-delta`).dataset.tone = value > 0 ? 'gain' : 'loss'; badges.set(id, feedback.time + 1.15); pulse(id, value > 0);
  }
  const score = events.reduce((sum, event) => sum + event.score, 0);
  if (score) pulse('score', score > 0);
  const upgrade = events.find(e => e.type === 'upgrade');
  if (upgrade) { text('notice', `${upgrade.text} equipped`); noticeUntil = feedback.time + 1.4; }
  const announcement = announce(events); if (announcement) text('announcement', announcement);
}
function frame(t: number) {
  const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
  if (!paused) {
    feedback.advance(dt);
    const direction = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
    if (direction) game.steer(game.state.x + direction * 8 * dt);
    game.step(dt);
  }
  const events = game.drainEvents(); if (events.length) handleEvents(events);
  const s = game.state;
  if (shown !== s.status) {
    if (['choice', 'over', 'cleared'].includes(s.status)) {
      if (!transitionAt) transitionAt = feedback.time + .25;
      if (feedback.time >= transitionAt) {
        if (s.status === 'over' || s.status === 'cleared') best = submitScore('gate-runner', s.score);
        updateOverlay();
      }
    } else updateOverlay();
  }
  draw(ctx, canvas.clientWidth, canvas.clientHeight, game, feedback);
  el('squad-stat').dataset.low = String(s.soldiers <= 5);
  text('stage', `Stage ${s.stage} / 5`); text('squad', String(s.soldiers));
  text('score', s.score.toLocaleString());
  const percent = Math.round(s.z / game.level.length * 100);
  el('progress-fill').style.transform = `scaleX(${percent / 100})`;
  if (el('progress').getAttribute('aria-valuenow') !== String(percent)) el('progress').setAttribute('aria-valuenow', String(percent));
  text('stage-status', isDaily ? 'Daily challenge' : '');
  for (const [id, until] of badges) if (feedback.time >= until) { text(`${id}-delta`, ''); badges.delete(id); }
  if (feedback.time >= noticeUntil) text('notice', '');
  requestAnimationFrame(frame);
}
updateOverlay(); requestAnimationFrame(frame);
