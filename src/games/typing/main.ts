import dictionaryText from './dictionary.txt?raw';

/**
 * Type Rot — a port of the standalone typing-game into brainrot-games.
 *
 * Words drift right→left; type one and press Space/Enter before it exits the
 * left edge. Score scales with word length × current speed, which ramps up over
 * time. Recolored to the brainrot palette with a DOM HUD overlay; the canvas is
 * full-window and DPR-aware for crisp text on Hi-DPI displays. Keyboard-driven,
 * with a hidden input focused on tap so mobile soft keyboards appear.
 */

// ── Brainrot palette (mirrors :root vars / core COLORS) ───
const C = {
  prompt: '#00e5ff',
  sub: '#a99fd6',
  hint: '#b958ff',
  tip: '#ffcc66',
  word: '#c9c0e6',
  match: '#3ddc97',
  over: '#ff2e97',
  score: '#00e5ff',
  high: '#b958ff',
};

const dictionary = dictionaryText
  .split('\n')
  .map((word) => word.trim())
  .filter((word) => word.length > 0);

const randomNumber = (min: number, max: number): number => Math.random() * (max - min) + min;
const randomWord = (): string => dictionary[Math.floor(randomNumber(0, dictionary.length))];

// Gameplay modifiers — kept identical to the original game.
const opts = {
  init_speed: 25,
  speed_increase: 1.1,
  speed_cycles: 20,
  spawn_chance: 0.25,
  frame_interval: 250,
  min_word_y: 90, // below the HUD bar
  points_multiplier: 25,
};

// ── Canvas + DPR ──────────────────────────────────────────
const canvas = document.getElementById('tp-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 3);

let w = 0;
let h = 0;

const WORD_FONT = "bold 32px 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace";
const UI_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const sizeCanvas = (): void => {
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = WORD_FONT;
};

// ── HUD overlay (DOM, themed) ─────────────────────────────
const hud = document.createElement('div');
hud.className = 'tp-overlay';
hud.innerHTML = `
  <div class="tp-bar">
    <div class="tp-stat"><span class="tp-label">Score</span><span class="tp-val" id="tp-score">0</span></div>
    <div class="tp-stat"><span class="tp-label">Speed</span><span class="tp-val" id="tp-speed">0</span></div>
    <div class="tp-stat tp-buffer"><span class="tp-label">Buffer</span><span class="tp-val" id="tp-buf">...</span></div>
  </div>
`;
document.body.appendChild(hud);
const scoreEl = hud.querySelector<HTMLElement>('#tp-score')!;
const speedEl = hud.querySelector<HTMLElement>('#tp-speed')!;
const bufEl = hud.querySelector<HTMLElement>('#tp-buf')!;

// ── High score (localStorage) ─────────────────────────────
const HS_KEY = 'brainrotTypingHighScore';
const getHighScore = (): number => {
  try {
    const stored = localStorage.getItem(HS_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
};
const setHighScore = (value: number): void => {
  try {
    localStorage.setItem(HS_KEY, String(value));
  } catch {
    /* ignore storage errors */
  }
};
let highScore = getHighScore();

// ── Game state ────────────────────────────────────────────
class Word {
  constructor(
    public text: string,
    public x: number,
    public y: number,
    public speed: number
  ) {}
}

let score = 0;
let words: Word[] = [];
let cycles = 0;
let speed = opts.init_speed;
let buffer = '';
let animationFrameId: number | null = null;
let lastFrameTime: number | null = null;
let lastDisplayedScore = 0;
let lastDisplayedSpeed = 0;
let lastFinalScore = 0;
let currentScreenRedraw: () => void = () => {};

const initialize = (): void => {
  score = 0;
  words = [];
  cycles = 0;
  speed = opts.init_speed;
  buffer = '';
  lastDisplayedScore = score;
  lastDisplayedSpeed = speed;
  scoreEl.innerText = String(score);
  speedEl.innerText = String(speed);
  bufEl.innerText = buffer || '...';
  highScore = getHighScore();
};

const findNonOverlappingY = (): number => {
  const minSpacing = 50;
  for (let attempt = 0; attempt < 10; attempt++) {
    const y = randomNumber(opts.min_word_y, h - 20);
    if (!words.some((word) => Math.abs(word.y - y) < minSpacing)) return y;
  }
  return randomNumber(opts.min_word_y, h - 20);
};

const renderWords = (): void => {
  ctx.clearRect(0, 0, w, h);
  ctx.font = WORD_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  for (const word of words) {
    if (buffer.length > 0 && word.text.startsWith(buffer)) {
      ctx.fillStyle = C.match;
      ctx.fillText(buffer, word.x, word.y);
      const prefixWidth = ctx.measureText(buffer).width;
      ctx.fillStyle = C.word;
      ctx.fillText(word.text.substring(buffer.length), word.x + prefixWidth, word.y);
    } else {
      ctx.fillStyle = C.word;
      ctx.fillText(word.text, word.x, word.y);
    }
  }
};

const gameTick = (currentTime: number): void => {
  if (animationFrameId !== null) {
    animationFrameId = requestAnimationFrame(gameTick);
  }

  if (lastFrameTime === null) lastFrameTime = currentTime;
  if (currentTime - lastFrameTime < opts.frame_interval) return;
  lastFrameTime = currentTime;

  cycles += 1;
  if (cycles % opts.speed_cycles === 0) {
    speed = Math.round(speed * opts.speed_increase);
    if (speed !== lastDisplayedSpeed) {
      speedEl.innerText = String(speed);
      lastDisplayedSpeed = speed;
    }
  }
  if (Math.random() < opts.spawn_chance) {
    words.push(new Word(randomWord(), w, findNonOverlappingY(), speed));
  }
  for (let i = 0; i < words.length; i++) {
    words[i].x -= words[i].speed;
    if (words[i].x < 0) {
      words.splice(i, 1);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      stateMachine.transition('game_over');
      return;
    }
  }
  renderWords();
};

const setBuffer = (next: string): void => {
  buffer = next;
  bufEl.innerText = buffer || '...';
  renderWords();
};

const submitBuffer = (): void => {
  for (let i = 0; i < words.length; i++) {
    if (words[i].text === buffer) {
      score += Math.round((words[i].text.length * speed) / opts.points_multiplier);
      if (score !== lastDisplayedScore) {
        scoreEl.innerText = String(score);
        lastDisplayedScore = score;
      }
      words.splice(i, 1);
      break;
    }
  }
  setBuffer('');
};

const gameListener = (event: KeyboardEvent): void => {
  if (event.repeat) return;
  const key = event.key;
  if (!key.match(/^[a-z0-9 ]$/i) && key !== 'Backspace' && key !== 'Enter') return;

  if (key === ' ' || key === 'Enter') submitBuffer();
  else if (key === 'Backspace') setBuffer(buffer.slice(0, -1));
  else setBuffer(buffer + key);
};

const restartListener = (event: KeyboardEvent): void => {
  if (event.key === 'r' || event.key === 'R') stateMachine.transition('game');
};

// ── Screens ───────────────────────────────────────────────
const centerText = (text: string, color: string, font: string, y: number): void => {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(text, w / 2, y);
};

const startUpdate = (): void => {
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  centerText("Press 'R' to Start", C.prompt, `bold 48px ${UI_FONT}`, h / 2 - 120);
  centerText('Type the words before they escape!', C.sub, `24px ${UI_FONT}`, h / 2 - 60);

  let y = h / 2 + 20;
  ctx.fillStyle = C.hint;
  ctx.font = `20px ${UI_FONT}`;
  ctx.fillText('R — Start or restart', w / 2, y);
  y += 40;
  ctx.fillText('Type — the words on screen', w / 2, y);
  y += 40;
  ctx.fillText('Space or Enter — submit word', w / 2, y);
  y += 40;
  ctx.fillText('Backspace — delete last character', w / 2, y);

  centerText('💡 Type faster to score more! Words speed up over time.', C.tip, `18px ${UI_FONT}`, h / 2 + 200);
  currentScreenRedraw = startUpdate;
};

const gameStartUpdate = (): void => {
  initialize();
  ctx.font = WORD_FONT;
  lastFrameTime = null;
  currentScreenRedraw = () => {};
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  animationFrameId = requestAnimationFrame(gameTick);
};

const drawGameOver = (): void => {
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  centerText('Game Over', C.over, `bold 56px ${UI_FONT}`, h / 2 - 80);
  centerText(`Final Score: ${lastFinalScore}`, C.score, `bold 36px ${UI_FONT}`, h / 2 - 10);
  centerText(`High Score: ${highScore}`, C.high, `bold 28px ${UI_FONT}`, h / 2 + 40);
  centerText("Press 'R' to Restart", C.sub, `24px ${UI_FONT}`, h / 2 + 90);
};

const gameOverUpdate = (): void => {
  lastFinalScore = score;
  if (lastFinalScore > highScore) {
    highScore = lastFinalScore;
    setHighScore(highScore);
  }
  initialize();
  currentScreenRedraw = drawGameOver;
  drawGameOver();
};

// ── State machine ─────────────────────────────────────────
interface GameState {
  update: () => void;
  listener: (event: KeyboardEvent) => void;
}

let currentListener: ((event: KeyboardEvent) => void) | null = null;

const stateMachine = {
  states: {
    start: { update: startUpdate, listener: restartListener },
    game: { update: gameStartUpdate, listener: gameListener },
    game_over: { update: gameOverUpdate, listener: restartListener },
  } as Record<string, GameState>,
  transition(state: string): void {
    const next = this.states[state];
    if (currentListener !== next.listener) {
      if (currentListener) document.removeEventListener('keydown', currentListener);
      currentListener = next.listener;
      document.addEventListener('keydown', currentListener);
    }
    next.update();
  },
};

// ── Mobile: focus hidden input on tap to raise the soft keyboard ──
const hiddenInput = document.getElementById('tp-input') as HTMLInputElement | null;
if (hiddenInput) {
  const focusInput = () => {
    hiddenInput.value = '';
    hiddenInput.focus();
  };
  canvas.addEventListener('pointerdown', focusInput);

  // Mobile keyboards don't emit reliable keydowns, so let the hidden input BE
  // the buffer: it handles editing/backspace natively, and we just mirror its
  // value. A trailing space (or Enter) submits the current word.
  hiddenInput.addEventListener('input', () => {
    if (currentListener === restartListener) {
      // Menu / game-over screens: typing 'r' restarts.
      const last = hiddenInput.value.slice(-1);
      hiddenInput.value = '';
      if (last === 'r' || last === 'R') stateMachine.transition('game');
      return;
    }
    const value = hiddenInput.value;
    if (/\s$/.test(value)) {
      setBuffer(value.trimEnd().toLowerCase());
      submitBuffer();
      hiddenInput.value = '';
    } else {
      setBuffer(value.toLowerCase());
    }
  });
}

// ── Boot ──────────────────────────────────────────────────
let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    sizeCanvas();
    // Redraw the current static screen; the game loop repaints itself.
    if (animationFrameId === null) currentScreenRedraw();
  });
});

sizeCanvas();
stateMachine.transition('start');
