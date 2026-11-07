import './style.css';
import { getBestScore, submitScore } from '../../core/scores';
import { Breakout, W, MAX_BALLS, LABELS, COLORS } from './engine';
import { Renderer } from './render';
const root = document.querySelector<HTMLDivElement>('#app')!;
const playIcon = '<path d="m9 5 11 7-11 7z"/>';
const pauseIcon = '<path d="M9 5v14m6-14v14"/>';
const icon = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
root.innerHTML = `
  <div class="br-shell">
    <header class="br-header">
      <nav aria-label="Arcade navigation"><a class="br-home" href="/" aria-label="Back to arcade" title="Back to arcade">${icon('<path d="m11 6-6 6 6 6m-6-6h14"/>')}<span>Arcade</span></a></nav>
      <h1>Break <span>Rot</span></h1>
      <div class="br-toolbar">
        <div class="br-score"><span>Score</span><b id="score">0</b></div>
        <button id="help" type="button" aria-label="How to play" title="How to play" aria-haspopup="dialog" aria-controls="help-dialog">${icon('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2.9-1.2 1.8m0 2.5h.01"/>')}</button>
        <button id="pause" type="button" aria-label="Pause game" title="Pause game" aria-controls="overlay" disabled>${icon(pauseIcon)}</button>
      </div>
    </header>
    <main>
      <div class="br-level"><div class="br-wave"><span id="wave">01</span><h2 id="level-name"></h2></div><span id="lives" role="img" aria-label="3 lives"></span></div>
      <div class="br-arena" id="arena"><canvas tabindex="0" aria-describedby="playfield-controls"></canvas>
        <div class="br-serve-hint" id="serve-hint" aria-hidden="true"><span class="br-mouse-hint">Click anywhere to launch <span class="br-hint-divider">·</span> <kbd>Space</kbd></span><span class="br-touch-hint">Tap anywhere to launch</span></div>
        <div class="br-overlay" id="overlay" hidden><section class="br-panel"><h2 id="title"></h2><p id="message"></p><button class="br-primary" id="continue" type="button"></button><div id="menu" hidden><button id="sound" aria-pressed="false">Sound off</button><button id="restart">Restart run</button></div></section></div>
      </div>
      <div class="br-readout" id="readout" hidden><span id="effects"></span><span id="balls"></span></div>
      <p id="playfield-controls" hidden>Click or tap to move the paddle and launch. Space or Enter launches from the current paddle position. Drag or use the arrow keys to steer. P pauses.</p>
      <div class="br-sr" id="announcement" aria-live="polite"></div>
    </main>
  </div>
  <dialog id="help-dialog" aria-labelledby="help-title"><h2 id="help-title">How to play</h2><p>Click or tap anywhere on the board to move the paddle under that spot and launch. Drag or use ← → / A D to steer. Press Space to serve from the current paddle position. Enter also launches when the board has focus. Press P to pause.</p><p>Clear the numbered and colored bricks. Steel is permanent; round bumpers reflect and accelerate balls. Gold gates break open into adjoining chambers. Mint-edged floors retract as a chamber empties or after 28 seconds of activity. Only breakable bricks count toward a clear.</p><p>Hit near the paddle’s edges to aim your return. A life is lost when every ball falls. You have three lives for the run; waves don’t award more.</p><dl>${Object.entries(LABELS).map(([k, v]) => `<dt style="color:${COLORS[k as keyof typeof COLORS]}">${v}</dt><dd>${({ triple: 'Triple live balls', add: 'Add three balls', wide: '↔ Wider paddle for 10 seconds', fire: 'F · Pierce bricks for 4 seconds; steel still blocks', bomb: '✹ Damage nearby bricks by two hits', shield: 'S · Save one falling ball', slow: '~ Slow motion for 5 seconds' })[k as keyof typeof LABELS]}</dd>`).join('')}</dl><p>Hit a power tile to activate it. Upgrades and balls reset each wave and after a lost life. The swarm caps at ${MAX_BALLS}. Numbers show hits remaining. Best scores save on this device.</p><button id="help-sound">Sound off</button><button id="close-help" class="br-primary">Got it</button></dialog>`;
const el = (id: string) => document.getElementById(id)!;
const canvas = root.querySelector('canvas')!, renderer = new Renderer(canvas);
const overlay = el('overlay'), dialog = root.querySelector('dialog')!;
const pauseButton = root.querySelector<HTMLButtonElement>('#pause')!;
let game = new Breakout(1, crypto.getRandomValues(new Uint32Array(1))[0]), paused = false, best = getBestScore('breakout-v3'), sound = false, confirmRestart = false;
let serveTap: { pointerId: number; x: number; y: number } | undefined;
let audio: AudioContext | undefined;
let lastTone = 0, lastTime = 0, accumulator = 0, lastStatus = '', saveClock = 0, announcement = '';
const keys = new Set<string>(), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function persist() { best = submitScore('breakout-v3', game.score); }
function syncOverlay() {
  const ready = game.status === 'ready';
  const active = game.status === 'playing';
  if (!ready) serveTap = undefined;
  overlay.hidden = ready || (active && !paused);
  el('serve-hint').hidden = !ready;
  el('arena').classList.toggle('br-ready', ready);
  canvas.setAttribute('aria-label', ready ? 'Launch ball' : 'Break Rot playfield');
  if (ready) canvas.setAttribute('role', 'button');
  else canvas.removeAttribute('role');
  pauseButton.title = paused ? 'Resume game' : 'Pause game';
  pauseButton.setAttribute('aria-label', pauseButton.title);
  pauseButton.innerHTML = icon(paused ? playIcon : pauseIcon);
  pauseButton.disabled = !active;
  el('menu').hidden = !paused && game.status !== 'over';
  el('restart').textContent = confirmRestart ? 'Yes, restart run' : 'Restart run';
  const cleared = game.status === 'cleared', over = game.status === 'over';
  el('title').textContent = confirmRestart ? 'Restart run?' : paused ? 'Paused' : cleared ? 'Wave cleared' : over ? 'Game over' : '';
  el('message').textContent = confirmRestart ? 'Current progress will reset.' : over ? `${game.score.toLocaleString()} points · Best ${best.toLocaleString()}` : '';
  el('message').hidden = !el('message').textContent;
  el('continue').textContent = confirmRestart ? 'Keep playing' : paused ? 'Resume' : cleared ? 'Next wave' : over ? 'Play again' : '';
}
function start() {
  if (confirmRestart) { confirmRestart = false; paused = false; }
  else if (paused) paused = false;
  else if (game.status === 'cleared') { game.nextWave(); renderer.clear(); }
  else { if (game.status === 'over') reset(); game.launch(); }
  audio?.resume(); accumulator = 0; syncOverlay(); canvas.focus({ preventScroll: true });
}
function reset() { persist(); game = new Breakout(1, crypto.getRandomValues(new Uint32Array(1))[0]); renderer.clear(); paused = false; confirmRestart = false; keys.clear(); syncOverlay(); }
function togglePause() { if (game.status === 'playing') { paused = !paused; confirmRestart = false; keys.clear(); syncOverlay(); } }
el('continue').onclick = start;
pauseButton.onclick = () => { togglePause(); canvas.focus({ preventScroll: true }); };
el('restart').onclick = () => { if (confirmRestart || game.status === 'over') reset(); else { confirmRestart = true; syncOverlay(); } };
function toggleSound() {
  sound = !sound;
  if (sound) { audio ??= new AudioContext(); audio.resume(); }
  for (const id of ['sound', 'help-sound']) { el(id).textContent = sound ? 'Sound on' : 'Sound off'; el(id).setAttribute('aria-pressed', String(sound)); }
}
el('sound').onclick = toggleSound; el('help-sound').onclick = toggleSound;
el('help').onclick = () => { if (game.status === 'playing' && !paused) togglePause(); dialog.showModal(); };
el('close-help').onclick = () => dialog.close();
function steer(clientX: number) {
  if (paused || dialog.open || (game.status !== 'ready' && game.status !== 'playing')) return;
  const rect = canvas.getBoundingClientRect(); game.move((clientX - rect.left) * W / rect.width);
}
const tapSlop = 8;
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  if (game.status === 'ready' && !dialog.open) serveTap = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  steer(e.clientX);
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', e => {
  if (!e.isPrimary) return;
  if (serveTap?.pointerId === e.pointerId && Math.hypot(e.clientX - serveTap.x, e.clientY - serveTap.y) > tapSlop) serveTap = undefined;
  if (e.pointerType === 'mouse' || e.buttons) steer(e.clientX);
});
canvas.addEventListener('pointerup', e => {
  if (serveTap?.pointerId !== e.pointerId || e.button !== 0) return;
  const { x, y } = serveTap;
  serveTap = undefined;
  if (game.status !== 'ready' || dialog.open || Math.hypot(e.clientX - x, e.clientY - y) > tapSlop) return;
  steer(e.clientX);
  start();
});
canvas.addEventListener('lostpointercapture', e => { if (serveTap?.pointerId === e.pointerId) serveTap = undefined; });
canvas.addEventListener('pointercancel', () => keys.clear());
canvas.addEventListener('click', e => {
  // Assistive technology can activate the playfield without a pointer gesture.
  if (e.detail === 0 && game.status === 'ready' && !dialog.open) start();
});
window.addEventListener('keydown', e => {
  if (dialog.open || (e.target instanceof HTMLElement && e.target.closest('button, a'))) return;
  if (e.key === 'Enter' && e.target === canvas && game.status === 'ready') {
    e.preventDefault();
    if (!e.repeat) start();
    return;
  }
  if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'A', 'D', 'p', 'P', 'Escape'].includes(e.key)) {
    e.preventDefault(); keys.add(e.key.toLowerCase());
    if (!e.repeat && e.key === ' ' && (game.status !== 'playing' || paused)) start();
    if (!e.repeat && ['p', 'P', 'Escape'].includes(e.key)) togglePause();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function backgroundPause() { keys.clear(); if (game.status === 'playing' && !paused) togglePause(); persist(); }
window.addEventListener('blur', backgroundPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) backgroundPause(); });
window.addEventListener('pagehide', persist);
function resize() { const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr); }
new ResizeObserver(resize).observe(canvas);
function updateHUD() {
  el('score').textContent = game.score.toLocaleString();
  el('wave').textContent = String(game.wave).padStart(2, '0'); el('wave').setAttribute('aria-label', `Wave ${game.wave}`); el('level-name').textContent = game.name;
  el('lives').textContent = '●'.repeat(game.lives) + '○'.repeat(3 - game.lives); el('lives').setAttribute('aria-label', `${game.lives} lives remaining`);
  const multiball = game.balls.length > 1;
  el('balls').textContent = multiball ? `● ×${game.balls.length}` : '';
  el('balls').setAttribute('aria-label', `${game.balls.length} balls`);
  const effects = [game.wide > 0 ? `↔ ${Math.ceil(game.wide)}s` : '', game.fire > 0 ? `F ${Math.ceil(game.fire)}s` : '', game.slow > 0 ? `~ ${Math.ceil(game.slow)}s` : '', game.shields ? 'S' : ''].filter(Boolean).join('  ·  ');
  el('effects').textContent = effects;
  el('readout').hidden = !multiball && !effects;
  const next = `${game.name}. Wave ${game.wave}. ${game.lives} lives. ${paused ? 'Paused' : game.status}.`;
  if (next !== announcement) { el('announcement').textContent = next; announcement = next; }
}
function frame(now: number) {
  const dt = Math.min(.05, (now - (lastTime || now)) / 1000); lastTime = now;
  if (!paused && !dialog.open) {
    if (keys.has('arrowleft') || keys.has('a')) game.move(game.paddle - dt * 850);
    if (keys.has('arrowright') || keys.has('d')) game.move(game.paddle + dt * 850);
    accumulator += dt;
    while (accumulator >= 1 / 240) { game.step(1 / 240); accumulator -= 1 / 240; }
  } else accumulator = 0;
  if (game.hits.length) {
    for (const hit of game.hits) renderer.hit(hit, reducedMotion.matches);
    if (sound && audio && now - lastTone > 70) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.setValueAtTime(260 + Math.min(10, game.combo) * 22, audio.currentTime);
      gain.gain.setValueAtTime(.03, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .06);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .07); lastTone = now;
    }
    game.hits = [];
  }
  if (lastStatus !== game.status) { if (game.status !== 'playing') persist(); lastStatus = game.status; syncOverlay(); }
  saveClock += dt; if (saveClock > 5) { persist(); saveClock = 0; }
  updateHUD(); renderer.draw(game, paused || dialog.open ? 0 : dt, reducedMotion.matches); requestAnimationFrame(frame);
}
syncOverlay(); updateHUD(); resize(); requestAnimationFrame(frame);
