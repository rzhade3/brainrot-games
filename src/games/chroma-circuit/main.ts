import '../../core/pwa-game-gestures';
import { getBestScore, submitScore } from '../../core/scores';
import { palette } from './art';
import { BELT_CAPACITY, Circuit, SLOT_COUNT, type Load, type Source } from './engine';
import { originalLevelNames, puzzles } from './levels';
import { BoardRenderer, drawThumbnail } from './render';
import './style.css';

const key = 'chroma-circuit';
const progressKey = `${key}-cleared`;
const queuePreviewCount = 2;
const clearedLevels = readClearedLevels();
const firstUncleared = puzzles.findIndex(({ level }) => !clearedLevels.has(level.name));
let levelIndex = firstUncleared < 0 ? puzzles.length - 1 : firstUncleared;
let game = new Circuit(puzzles[levelIndex].level);
let showMarks = false;
let tutorialStep = 0;

function readClearedLevels(): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(progressKey) ?? 'null');
    if (Array.isArray(saved)) return new Set(puzzles.map(({ level }) => level.name).filter(name => saved.includes(name)));
  } catch {
    // The arcade score can still restore progress from the sequential campaign.
  }
  const previousCount = Math.max(0, Math.floor(Number(getBestScore(key)) || 0));
  return new Set(originalLevelNames.slice(0, previousCount));
}

const app = document.querySelector<HTMLDivElement>('#chroma-app')!;
app.innerHTML = `
  <main class="game">
    <header class="topbar">
      <a class="icon-button back" href="/" aria-label="Back to arcade" title="Back to arcade"><span aria-hidden="true">‹</span></a>
      <div class="stage-head">
        <h1><button id="open-levels" type="button" aria-haspopup="dialog" aria-controls="collection"><span id="stage-number"></span><span aria-hidden="true">▾</span><span class="sr-only">, choose a level</span></button></h1>
        <p id="stage-name"></p>
      </div>
      <button class="icon-button" id="restart" type="button" aria-label="Restart" title="Restart"><span aria-hidden="true">↻</span></button>
    </header>
    <section aria-label="Mosaic">
      <div class="canvas-wrap">
        <canvas id="board" role="img"></canvas>
        <div class="outcome" id="outcome" hidden>
          <div class="outcome-card">
            <h2 id="result-title"></h2>
            <p id="result-detail"></p>
            <button class="primary" id="result-action" type="button"></button>
          </div>
        </div>
      </div>
      <div class="belt-readout"><span class="belt-indicators" aria-hidden="true"></span><span id="belt-text"></span></div>
    </section>
    <section class="launch-area" aria-label="Shooters">
      <p class="instruction" role="status" id="instruction"></p>
      <div class="rack-head"><h2 id="waiting-title">Waiting</h2><span id="dock-count"></span></div>
      <div id="waiting" class="rack" role="group" aria-labelledby="waiting-title"></div>
      <div class="rack-head supply-head"><h2 id="supply-title">Supply</h2></div>
      <div id="supply" class="rack" role="group" aria-labelledby="supply-title"></div>
    </section>
    <footer class="game-actions">
      <button id="symbols" type="button" aria-pressed="${showMarks}">Symbols</button>
    </footer>
    <dialog id="collection" aria-labelledby="collection-title">
      <div class="collection-head">
        <div><h2 id="collection-title">Mosaics</h2><p id="level-count"></p></div>
        <form method="dialog"><button class="icon-button" type="submit" aria-label="Close mosaics" autofocus>×</button></form>
      </div>
      <div id="levels" class="levels"></div>
    </dialog>
  </main>`;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id)! as T;
}

const board = byId<HTMLCanvasElement>('board');
const renderer = new BoardRenderer(board);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const resultAction = byId<HTMLButtonElement>('result-action');
const instructions = byId('instruction');
const collection = byId<HTMLDialogElement>('collection');
const beltIndicators = app.querySelector('.belt-indicators')!;
beltIndicators.innerHTML = '<i></i>'.repeat(BELT_CAPACITY);

const buttons = {
  waiting: makeRack('waiting'),
  supply: makeRack('supply'),
};

function makeRack(source: Source): HTMLButtonElement[] {
  return Array.from({ length: SLOT_COUNT }, (_, slot) => {
    const column = document.createElement('div');
    column.className = 'column';
    column.innerHTML = `<button type="button" class="shooter"></button>${source === 'supply' ? '<div class="queue" aria-hidden="true"></div>' : ''}`;
    const button = column.querySelector('button')!;
    button.addEventListener('click', () => launch(source, slot));
    byId(source).append(column);
    return button;
  });
}

const levelButtons = puzzles.map(({ level }, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'level';
  button.innerHTML = `<canvas width="104" height="104" aria-hidden="true"></canvas><span>${level.name}</span>`;
  drawThumbnail(button.querySelector('canvas')!, level.tiles);
  button.addEventListener('click', () => {
    collection.close();
    if (index !== levelIndex || game.phase !== 'playing') start(index);
  });
  byId('levels').append(button);
  return button;
});

function start(index: number): void {
  levelIndex = index;
  game = new Circuit(puzzles[index].level);
  tutorialStep = 0;
  renderer.reset();
  byId('outcome').hidden = true;
  byId('stage-number').textContent = `Level ${index + 1}`;
  byId('stage-name').textContent = puzzles[index].level.name;
  board.setAttribute('aria-label', `${puzzles[index].level.name} pixel mosaic with a conveyor around its edge`);
  render();
  updateLevels();
}

function launch(source: Source, slot: number): void {
  if (!game.launch(source, slot)) return;
  if (levelIndex === 0 && tutorialStep < 2) {
    const [expectedSource, expectedSlot] = puzzles[0].solution[tutorialStep];
    tutorialStep = source === expectedSource && slot === expectedSlot ? tutorialStep + 1 : 2;
  }
  render();
}

function renderShooter(button: HTMLButtonElement, shooter: Load | null | undefined, source: Source, slot: number, guided: boolean): void {
  button.setAttribute('aria-disabled', String(!shooter || !game.canLaunch));
  button.classList.toggle('guided', guided && !!shooter && game.canLaunch);
  button.classList.toggle('empty', !shooter);
  button.tabIndex = shooter ? 0 : -1;
  if (shooter) {
    const color = palette[shooter.color];
    button.style.setProperty('--shooter-color', color.fill);
    button.style.setProperty('--shooter-ink', shooter.color === 'ink' ? '#fff' : '#30223f');
    button.setAttribute('aria-label', `${color.name} shooter, ${shooter.ammo} ammo, ${source} ${slot + 1}`);
    const mark = showMarks ? `<span aria-hidden="true">${color.mark}</span>` : '';
    const content = `${mark}<strong>${shooter.ammo}</strong>`;
    if (button.innerHTML !== content) button.innerHTML = content;
  } else {
    button.setAttribute('aria-label', `Empty ${source} slot ${slot + 1}`);
    if (button.textContent) button.textContent = '';
  }
}

function renderControls(): void {
  const guided = levelIndex === 0 && tutorialStep < 2 ? puzzles[0].solution[tutorialStep] : undefined;
  buttons.waiting.forEach((button, slot) => renderShooter(button, game.waiting[slot], 'waiting', slot, guided?.[0] === 'waiting' && guided[1] === slot));
  buttons.supply.forEach((button, slot) => {
    const [front, ...queue] = game.supply[slot].slice(0, 1 + queuePreviewCount);
    renderShooter(button, front, 'supply', slot, guided?.[0] === 'supply' && guided[1] === slot);
    const rail = button.parentElement!.querySelector('.queue')!;
    const content = queue.map(({ color, ammo }) =>
      `<span style="--queued:${palette[color].fill};--queued-ink:${color === 'ink' ? '#fff' : '#30223f'}">${showMarks ? `<small>${palette[color].mark}</small>` : ''}${ammo}</span>`).join('');
    if (queue.length) {
      button.setAttribute('aria-description', `Up next: ${queue.map(({ color, ammo }) => `${palette[color].name}, ${ammo} ammo`).join('; then ')}.`);
    } else {
      button.removeAttribute('aria-description');
    }
    if (rail.innerHTML !== content) rail.innerHTML = content;
  });
  const dock = game.waiting.filter(Boolean).length;
  byId('dock-count').textContent = `${dock} / ${SLOT_COUNT}`;
  byId('dock-count').classList.toggle('warning', dock === SLOT_COUNT);
  byId('belt-text').textContent = `Belt ${game.riders.length} / ${BELT_CAPACITY}`;
  [...beltIndicators.children].forEach((light, index) => light.classList.toggle('on', index < game.riders.length));
  const message = game.clearingAutomatically ? 'Clearing…'
    : game.riders.length === BELT_CAPACITY ? 'Belt full.'
    : dock === SLOT_COUNT ? 'Waiting slots full. Relaunch a shooter.'
    : guided?.[0] === 'supply' ? 'Tap to launch.'
    : guided?.[0] === 'waiting' && game.waiting[0] ? 'Tap to relaunch.'
    : guided?.[0] === 'waiting' ? 'Shooters with ammo left come back.'
    : '';
  if (instructions.textContent !== message) instructions.textContent = message;
}

function updateLevels(): void {
  byId('level-count').textContent = `${clearedLevels.size} / ${puzzles.length} cleared`;
  levelButtons.forEach((button, index) => {
    const { name } = puzzles[index].level;
    const cleared = clearedLevels.has(name);
    button.setAttribute('aria-current', index === levelIndex ? 'true' : 'false');
    button.setAttribute('aria-label', `Level ${index + 1}, ${name}${cleared ? ', cleared' : ''}`);
    button.classList.toggle('cleared', cleared);
  });
}

function render(): void {
  renderer.updateTiles(game.tiles, showMarks);
  renderControls();
}

function showOutcome(): void {
  const won = game.phase === 'won';
  const final = levelIndex === puzzles.length - 1;
  if (won) {
    for (const name of readClearedLevels()) clearedLevels.add(name);
    clearedLevels.add(puzzles[levelIndex].level.name);
    try {
      localStorage.setItem(progressKey, JSON.stringify([...clearedLevels]));
      submitScore(key, clearedLevels.size);
    } catch {
      // Keep the clear in memory if local storage is unavailable.
    }
    updateLevels();
  }
  byId('result-title').textContent = won ? (clearedLevels.size === puzzles.length ? 'All mosaics cleared!' : 'Mosaic cleared!')
    : game.failure === 'overflow' ? 'Waiting slots full' : 'No matches left';
  const detail = byId('result-detail');
  detail.hidden = won;
  detail.textContent = won ? '' : 'Try a different launch order.';
  resultAction.textContent = won && !final ? 'Next mosaic' : won ? 'Play again' : 'Retry';
  byId('outcome').hidden = false;
  resultAction.focus({ preventScroll: true });
}

byId('open-levels').addEventListener('click', () => collection.showModal());
byId('restart').addEventListener('click', () => start(levelIndex));
byId('symbols').addEventListener('click', event => {
  showMarks = !showMarks;
  (event.currentTarget as HTMLElement).setAttribute('aria-pressed', String(showMarks));
  render();
});
resultAction.addEventListener('click', () => {
  start(game.phase === 'won' && levelIndex < puzzles.length - 1 ? levelIndex + 1 : levelIndex);
  buttons.supply.find(button => button.getAttribute('aria-disabled') === 'false')?.focus({ preventScroll: true });
});
let previousTime = performance.now();
let frame = 0;
function animate(now: number): void {
  const previousReady = game.canLaunch;
  const changed = !collection.open && game.advance(Math.min(60, now - previousTime), hit => renderer.addHit(hit));
  previousTime = now;
  if (changed) {
    render();
    if (game.phase !== 'playing') showOutcome();
  } else if (previousReady !== game.canLaunch) {
    renderControls();
  }
  renderer.draw(game, now, motion.matches, showMarks);
  frame = requestAnimationFrame(animate);
}

start(levelIndex);
frame = requestAnimationFrame(animate);
if (import.meta.hot) import.meta.hot.dispose(() => cancelAnimationFrame(frame));
