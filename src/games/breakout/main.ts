import './style.css';
import { getBestScore, submitScore } from '../../core/scores';
import { Breakout, W, MAX_BALLS, LABELS, COLORS } from './engine';
import { Renderer } from './render';
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <div class="br-shell">
    <header><a href="/" aria-label="Back to arcade">←</a><h1>Break<span>rot</span></h1><div class="br-score"><small>SCORE</small><b id="score">0</b></div><button id="help" aria-label="How to play">?</button><button id="pause" aria-label="Pause game">Ⅱ</button></header>
    <main>
      <div class="br-level"><div><small id="wave">WAVE 01</small><h2 id="level-name"></h2></div><span id="lives" role="img" aria-label="3 lives"></span></div>
      <div class="br-arena"><canvas tabindex="0" aria-label="Breakout playfield. Drag to steer or use arrow keys. Space launches; P pauses."></canvas>
        <div class="br-overlay" id="overlay"><section class="br-panel"><small id="eyebrow">ONE BALL. MAKE IT COUNT.</small><h2 id="title">Find your angle.</h2><p id="message"></p><button class="br-primary" id="launch">Launch</button><div id="menu" hidden><button id="sound" aria-pressed="false">Sound off</button><button id="restart">Restart run</button></div></section></div>
      </div>
      <div class="br-progress" role="progressbar" aria-label="Wave cleared" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="progress"></i></div>
      <div class="br-readout"><span id="remaining"></span><span id="balls">1 ball</span></div>
      <div id="effects" class="br-effects"></div>
      <div class="br-legend"><span><i class="br-steel"></i> Steel · permanent</span><span><i class="br-bumper"></i> Bumper · ricochet</span></div>
      <p class="br-tip">Drag to steer <span>· ← → / A D · Space to launch · P to pause</span></p>
      <div class="br-sr" id="announcement" aria-live="polite"></div>
    </main>
  </div>
  <dialog aria-labelledby="help-title"><h2 id="help-title">Play the angles.</h2><p>Clear the numbered and colored bricks. Steel is permanent; round bumpers reflect and accelerate balls. Only breakable bricks count toward a clear.</p><p>Drag to position the paddle before launch. Hit near its edges to aim your return. A life is lost when every ball falls. You have three lives for the run; waves don’t award more.</p><dl>${Object.entries(LABELS).map(([k, v]) => `<dt style="color:${COLORS[k as keyof typeof COLORS]}">${v}</dt><dd>${({ triple: 'Triple live balls', add: 'Add three balls', wide: '↔ Wider paddle for 10 seconds', fire: 'F · Pierce bricks for 4 seconds; steel still blocks', bomb: '✹ Damage nearby bricks by two hits', shield: 'S · Save one falling ball', slow: '~ Slow motion for 5 seconds' })[k as keyof typeof LABELS]}</dd>`).join('')}</dl><p>Hit a power tile to activate it. Upgrades and balls reset each wave and after a lost life. The swarm caps at ${MAX_BALLS}. Numbers show hits remaining. Best scores save on this device.</p><button id="help-sound">Sound off</button><button id="close-help" class="br-primary">Got it</button></dialog>`;
const el = (id: string) => document.getElementById(id)!;
const canvas = root.querySelector('canvas')!, renderer = new Renderer(canvas);
const overlay = el('overlay'), dialog = root.querySelector('dialog')!;
let game = new Breakout(), paused = false, best = getBestScore('breakout-v2'), sound = false, confirmRestart = false;
let audio: AudioContext | undefined;
let lastTone = 0, lastTime = 0, accumulator = 0, lastStatus = '', saveClock = 0, announcement = '';
const keys = new Set<string>(), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function persist() { best = submitScore('breakout-v2', game.score); }
function syncOverlay() {
  const active = game.status === 'playing';
  overlay.hidden = active && !paused;
  overlay.classList.toggle('br-preview', game.status === 'ready' && !paused);
  el('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  el('pause').textContent = paused ? '▶' : 'Ⅱ';
  (el('pause') as HTMLButtonElement).disabled = !active;
  el('menu').hidden = !paused && game.status !== 'over';
  el('restart').textContent = confirmRestart ? 'Yes, restart run' : 'Restart run';
  const cleared = game.status === 'cleared', over = game.status === 'over';
  el('eyebrow').textContent = confirmRestart ? 'START OVER?' : paused ? 'TAKE A BREATHER' : cleared ? `WAVE ${game.wave} CLEARED` : over ? 'RUN COMPLETE' : `WAVE ${game.wave} · ${game.name}`;
  el('title').textContent = confirmRestart ? 'Reset this run?' : paused ? 'Paused.' : cleared ? 'Clean break.' : over ? 'One more run?' : game.elapsed > 0 ? 'Another chance.' : 'Find your angle.';
  el('message').textContent = confirmRestart ? 'Your best score is kept. Current wave progress will reset.' : paused ? `Best ${best.toLocaleString()} · Sound and restart below.` : cleared ? `${game.score.toLocaleString()} points · Next wave starts with one ball and fresh upgrades.` : over ? `${game.score.toLocaleString()} points · Best ${best.toLocaleString()} · Reached wave ${game.wave}` : game.hint;
  el('launch').textContent = confirmRestart ? 'Keep playing' : paused ? 'Resume' : cleared ? 'Next wave →' : over ? 'Play again' : 'Launch →';
}
function start() {
  if (confirmRestart) { confirmRestart = false; paused = false; }
  else if (paused) paused = false;
  else if (game.status === 'cleared') { game.nextWave(); renderer.clear(); }
  else { if (game.status === 'over') reset(); game.launch(); }
  audio?.resume(); accumulator = 0; syncOverlay(); canvas.focus({ preventScroll: true });
}
function reset() { persist(); game = new Breakout(); renderer.clear(); paused = false; confirmRestart = false; keys.clear(); syncOverlay(); }
function togglePause() { if (game.status === 'playing') { paused = !paused; confirmRestart = false; keys.clear(); syncOverlay(); } }
el('launch').onclick = start;
el('pause').onclick = () => { togglePause(); canvas.focus({ preventScroll: true }); };
el('restart').onclick = () => { if (confirmRestart || game.status === 'over') reset(); else { confirmRestart = true; syncOverlay(); } };
function toggleSound() {
  sound = !sound;
  if (sound) { audio ??= new AudioContext(); audio.resume(); }
  for (const id of ['sound', 'help-sound']) { el(id).textContent = sound ? 'Sound on' : 'Sound off'; el(id).setAttribute('aria-pressed', String(sound)); }
}
el('sound').onclick = toggleSound; el('help-sound').onclick = toggleSound;
el('help').onclick = () => { if (game.status === 'playing' && !paused) togglePause(); dialog.showModal(); };
el('close-help').onclick = () => dialog.close();
function steer(event: PointerEvent) {
  if (paused || dialog.open || !['ready', 'playing'].includes(game.status)) return;
  const rect = canvas.getBoundingClientRect(); game.move((event.clientX - rect.left) * W / rect.width);
}
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); steer(e); canvas.focus({ preventScroll: true }); });
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) steer(e); });
canvas.addEventListener('pointercancel', () => keys.clear());
window.addEventListener('keydown', e => {
  if (dialog.open || (e.target instanceof HTMLElement && e.target.closest('button, a'))) return;
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
  el('score').textContent = game.score.toLocaleString(); el('wave').textContent = `WAVE ${String(game.wave).padStart(2, '0')}`; el('level-name').textContent = game.name;
  el('lives').textContent = '●'.repeat(game.lives) + '○'.repeat(3 - game.lives); el('lives').setAttribute('aria-label', `${game.lives} lives remaining`);
  const remaining = game.remaining, progress = Math.round((1 - remaining / game.initialBricks) * 100);
  el('remaining').textContent = `${remaining} bricks left`; el('balls').textContent = `${game.status === 'ready' ? 1 : game.balls.length} ${game.balls.length === 1 || game.status === 'ready' ? 'ball' : 'balls'}`;
  el('progress').style.width = `${progress}%`; root.querySelector('[role="progressbar"]')!.setAttribute('aria-valuenow', String(progress));
  el('effects').textContent = game.status === 'ready' ? game.hint : [game.wide > 0 ? `↔ Wide ${Math.ceil(game.wide)}s` : '', game.fire > 0 ? `Fire ${Math.ceil(game.fire)}s` : '', game.slow > 0 ? `Slow ${Math.ceil(game.slow)}s` : '', game.shields ? '1 save' : '', game.comboTime > 0 && game.combo > 1 ? `Combo ×${Math.min(10, game.combo)}` : ''].filter(Boolean).join(' · ');
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
