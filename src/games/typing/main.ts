import dictionaryText from './dictionary.txt?raw';
import { getBestScore, submitScore } from '../../core/scores';
import { submitWord, type Word } from './engine';
import './style.css';

const dictionary = dictionaryText.split('\n').map(word => word.trim()).filter(Boolean);
const INITIAL_SPEED = 25;
const TICK_MS = 250;
type Phase = 'ready' | 'playing' | 'paused' | 'over';
let phase: Phase = 'ready';
let words: Word[] = [];
let score = 0, best = getBestScore('typing'), cycles = 0, speed = INITIAL_SPEED;
let previous: number | null = null, frame = 0;
let width = 1, height = 1;
let feedbackTimer: number | undefined;

const app = document.getElementById('type-app')!;
app.innerHTML = `
  <header class="tp-header"><a href="../../" aria-label="Back to arcade">←</a><h1>Type Rot</h1><form id="tp-form" class="tp-input-area"><label for="tp-input">Your word</label><div class="tp-input-row"><input id="tp-input" type="text" disabled autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="Type a word · Space / Enter" aria-describedby="tp-feedback"><button id="tp-submit" type="submit" disabled aria-label="Submit word">↵</button></div><p id="tp-feedback" role="status" aria-live="polite"></p></form><div class="tp-stats"><span>Score <strong id="tp-score">0</strong></span></div><div class="tp-actions"><button id="tp-pause" type="button" disabled aria-label="Pause game">Ⅱ</button><button id="tp-help" type="button" aria-label="How to play" aria-haspopup="dialog" aria-controls="tp-help-dialog">?</button></div></header>
  <main class="tp-main" aria-label="Type Rot game">

    <div class="tp-arena" id="tp-arena"><canvas id="tp-canvas" aria-hidden="true"></canvas><span class="tp-edge" aria-hidden="true"></span><ul id="tp-words" class="tp-sr-only" aria-label="Words in play"></ul>
      <section class="tp-screen" id="tp-screen" aria-labelledby="tp-title"><div class="tp-screen-card"><h2 id="tp-title">Ready?</h2><p id="tp-description">Type words. Space or Enter submits.</p><p class="tp-result" id="tp-result" hidden></p><button class="tp-primary" id="tp-play" type="button" disabled>Loading…</button></div></section>
    </div>

  </main>
  <dialog id="tp-help-dialog" aria-labelledby="tp-help-title"><div class="tp-dialog-head"><h2 id="tp-help-title">How to play</h2><button id="tp-close" type="button" aria-label="Close help">×</button></div><p>Type a word and press <strong>Space or Enter</strong>. Don’t let any word reach the left edge.</p><p>Longer words score more. The pace increases as you play.</p></dialog>
  <dialog id="tp-device-dialog" aria-labelledby="tp-device-title"><h2 id="tp-device-title">Desktop recommended</h2><p>Best played with a physical keyboard.</p><button id="tp-continue" class="tp-primary" type="button">Continue anyway</button><button id="tp-device-back" class="tp-secondary" type="button">Go back</button></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => app.querySelector<T>(`#tp-${id}`)!;
const canvas = $<HTMLCanvasElement>('canvas');
const ctx = canvas.getContext('2d')!;
const input = $<HTMLInputElement>('input');
const arena = $('arena');
const help = $<HTMLDialogElement>('help-dialog');
const pauseButton = $<HTMLButtonElement>('pause');
const FONT = '700 32px "JetBrains Mono", ui-monospace, Consolas, monospace';
let fontsReady = false;

function render(): void {
  ctx.clearRect(0, 0, width, height);
  ctx.font = FONT;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const buffer = input.value.toLowerCase();
  for (const word of words) {
    const prefix = buffer && word.text.startsWith(buffer) ? buffer : '';
    ctx.fillStyle = '#d9ff7c';
    ctx.fillText(prefix, word.x, word.y);
    ctx.fillStyle = word.x < width * .25 ? '#ffadbd' : '#fff0e5';
    ctx.fillText(word.text.slice(prefix.length), word.x + ctx.measureText(prefix).width, word.y);
  }
}
function updateStats(): void {
  $('score').textContent = score.toLocaleString();
}
function announceWords(): void {
  $('words').replaceChildren(...words.map(word => { const item = document.createElement('li'); item.textContent = word.text; return item; }));
}
function feedback(message: string, error = false): void {
  clearTimeout(feedbackTimer);
  $('feedback').textContent = message;
  $('feedback').classList.toggle('is-error', error);
  if (!message) return;
  feedbackTimer = window.setTimeout(() => { $('feedback').textContent = ''; $('feedback').classList.remove('is-error'); }, 1800);
}
function showScreen(title: string, description: string, action: string): void {
  $('screen').hidden = false;
  $('title').textContent = title;
  $('description').textContent = description;
  $('play').textContent = action;
  $('description').hidden = !description;
}
function setPhase(next: Phase): void {
  phase = next;
  previous = null;
  const playing = next === 'playing';
  input.disabled = !playing;
  $<HTMLButtonElement>('submit').disabled = !playing;
  pauseButton.disabled = next === 'ready' || next === 'over';
  pauseButton.textContent = next === 'paused' ? '▶' : 'Ⅱ';
  pauseButton.setAttribute('aria-label', next === 'paused' ? 'Resume game' : 'Pause game');
  app.dataset.phase = next;
}
function pause(): void {
  if (phase !== 'playing') return;
  setPhase('paused');
  $('result').hidden = true;
  showScreen('Paused', '', 'Resume');
  $('play').focus({ preventScroll: true });
}
let touchAccepted = false;
function play(): void {
  if (!fontsReady) return;
  if (!touchAccepted && window.matchMedia('(pointer: coarse), (max-width: 600px)').matches) {
    $<HTMLDialogElement>('device-dialog').showModal();
    return;
  }
  if (phase !== 'paused') {
    words = []; score = 0; cycles = 0; speed = INITIAL_SPEED;
    input.value = ''; announceWords(); updateStats();
  }
  setPhase('playing');
  $('screen').hidden = true;
  $('result').hidden = true;
  feedback('');
  input.focus({ preventScroll: true });
  render();
}
function finish(): void {
  best = submitScore('typing', score);
  setPhase('over'); updateStats();
  showScreen('Game over', '', 'Restart · R');
  $('result').replaceChildren();
  const points = document.createElement('strong'); points.textContent = `${score.toLocaleString()} points`;
  const record = document.createElement('span'); record.textContent = `Best ${best.toLocaleString()}`;
  $('result').append(points, record);
  $('result').hidden = false;
  $('play').focus({ preventScroll: true });
}
function submit(): void {
  if (phase !== 'playing') return;
  const buffer = input.value.trim().toLowerCase();
  if (!buffer) { input.value = ''; return; }
  const result = submitWord(words, buffer, speed);
  words = result.words; score += result.points; input.value = '';
  feedback(result.matched ? `${result.matched} +${result.points}` : 'No match.', !result.matched);
  updateStats(); announceWords(); render();
}
function spawnY(): number {
  const top = Math.min(36, height / 2), bottom = Math.max(top, height - 20);
  for (let attempt = 0; attempt < 10; attempt++) {
    const y = top + Math.random() * (bottom - top);
    if (!words.some(word => Math.abs(word.y - y) < 50)) return y;
  }
  return top + Math.random() * (bottom - top);
}
function tick(now: number): void {
  frame = requestAnimationFrame(tick);
  if (phase !== 'playing') return;
  if (previous === null) previous = now;
  if (now - previous < TICK_MS) return;
  previous = now;
  cycles++;
  if (cycles % 20 === 0) speed = Math.round(speed * 1.1);
  if (Math.random() < .25) words.push({ text: dictionary[Math.floor(Math.random() * dictionary.length)], x: width, y: spawnY(), speed });
  for (const word of words) {
    word.x -= word.speed;
    if (word.x < 0) { finish(); render(); return; }
  }
  announceWords(); render();
}
function sizeCanvas(): void {
  const oldWidth = width, oldHeight = height;
  width = Math.max(1, arena.clientWidth); height = Math.max(1, arena.clientHeight);
  const dpr = Math.min(devicePixelRatio || 1, 3);
  canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  words.forEach(word => { word.x *= width / oldWidth; word.y = Math.max(Math.min(36, height / 2), Math.min(height - 12, word.y * height / oldHeight)); });
  render();
}
$('play').onclick = play;
$('continue').onclick = () => { touchAccepted = true; $<HTMLDialogElement>('device-dialog').close(); play(); };
$('device-back').onclick = () => $<HTMLDialogElement>('device-dialog').close();
pauseButton.onclick = () => { if (phase === 'playing') pause(); else if (phase === 'paused') play(); };
$('help').onclick = () => { pause(); help.showModal(); };
$('close').onclick = () => help.close();
$('form').addEventListener('submit', event => { event.preventDefault(); submit(); });
input.addEventListener('input', event => { feedback(''); if (!(event as InputEvent).isComposing && /\s$/.test(input.value)) submit(); else render(); });
input.addEventListener('compositionend', () => { feedback(''); if (/\s$/.test(input.value)) submit(); else render(); });
arena.addEventListener('pointerdown', () => { if (phase === 'playing') input.focus({ preventScroll: true }); });
const listeners = new AbortController();
window.addEventListener('keydown', event => {
  if (help.open || $<HTMLDialogElement>('device-dialog').open || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Escape' && phase === 'playing') { pause(); return; }
  if ((phase === 'ready' || phase === 'over') && event.key.toLowerCase() === 'r') { event.preventDefault(); play(); return; }
  if (phase !== 'playing' || event.target === input || event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); submit(); input.focus(); }
  else if (/^[a-z0-9]$/i.test(event.key) || event.key === 'Backspace') {
    event.preventDefault(); feedback(''); input.value = event.key === 'Backspace' ? input.value.slice(0, -1) : input.value + event.key;
    input.focus({ preventScroll: true }); render();
  }
}, { signal: listeners.signal });
window.addEventListener('blur', pause, { signal: listeners.signal });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal: listeners.signal });
function viewport(): void { app.style.height = `${window.visualViewport?.height ?? window.innerHeight}px`; }
window.visualViewport?.addEventListener('resize', viewport, { signal: listeners.signal });
const observer = new ResizeObserver(sizeCanvas); observer.observe(arena);
viewport(); sizeCanvas(); setPhase('ready'); frame = requestAnimationFrame(tick);
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(frame); clearTimeout(feedbackTimer); observer.disconnect(); listeners.abort(); });

// Finish font loading before play so canvas metrics never change mid-run.
// If loading fails, the same monospace fallback remains usable offline.
void Promise.all([
  document.fonts.load(FONT),
  document.fonts.load('600 20px "JetBrains Mono"'),
]).catch(() => {}).then(() => {
  fontsReady = true;
  $<HTMLButtonElement>('play').disabled = false;
  $('play').textContent = 'Start · R';
  render();
});
