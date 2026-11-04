import '../../style.css';
import './style.css';
import data from './layouts.json';
import { getBestScore, submitScore } from '../../core/scores';
import { CubeRenderer } from './render';
import { FACES, attemptMove, removable, validateLayout, type Layout } from './rules';
import { PuzzleSession, readSave, type Save } from './state';
import { advanceEndless, completeEndless, ENDLESS_KEY, MODE_KEY, SHARED_KEY, newEndless, readEndless, rememberCatalog, type EndlessSave } from './endless';
import { EndlessGenerator } from './endless-client';
import { endlessPreset, formatPuzzleCode, parsePuzzleCode } from './puzzle-code';

const layouts = data.layouts as readonly Layout[];
layouts.forEach(validateLayout);
const STORAGE_KEY = 'brainrot-cube-lines:v4';
const root = document.querySelector<HTMLElement>('#cube-app')!;
root.innerHTML = `
  <header class="cl-header">
    <a class="cl-hub" href="../../" aria-label="Back to Brainrot Games">←</a>
    <h1>Cube Lines</h1>
    <button id="cl-levels" class="cl-level-button" type="button" aria-label="Game menu" aria-haspopup="dialog" aria-controls="cl-level-dialog">☰</button>
  </header>
  <dialog id="cl-instructions" class="cl-dialog cl-instructions" aria-labelledby="cl-instructions-title">
    <div class="cl-dialog-header"><h2 id="cl-instructions-title">How to play</h2>
      <button id="cl-help-close" type="button" aria-label="Close instructions">×</button></div>
    <p><strong>Tap a line to release it.</strong> Its arrowhead needs a straight, clear path to the face's edge.
    The body follows, even around cube edges. One line can block several faces.</p>
    <p><strong>Drag to rotate.</strong> Pinch or scroll to zoom.</p>
    <p><strong>Clear all six faces.</strong> Use Hint whenever you need it.</p>
  </dialog>
  <main class="cl-game-body" aria-label="Cube Lines puzzle">
  <div class="cl-progress" id="cl-progress">
    <span><span id="cl-mode-label">Level</span> <span id="cl-level">1</span><span id="cl-total"> / 30</span></span>
    <span id="cl-faces">0 / 6 faces clear</span>
    <span><strong id="cl-remaining">0</strong> lines left</span>
  </div>
  <div class="cl-stage" id="cl-stage"></div>
  <section id="cl-result" class="cl-result" hidden aria-labelledby="cl-result-title">
    <h2 id="cl-result-title">Cube cleared.</h2>
    <p id="cl-result-text"></p>
    <button id="cl-next" class="cl-primary" type="button">Next level →</button>
  </section>
  <p class="cl-status" id="cl-status" role="status" aria-live="polite">Drag to rotate. Tap a line with a clear way out.</p>
  <div id="cl-generation" class="cl-generation" hidden>
    <p id="cl-generation-status" role="status" aria-live="polite"></p>
    <button id="cl-generation-retry" type="button" hidden>Retry generation</button>
  </div>
  <p id="cl-save-warning" class="cl-warning" role="alert" hidden></p>
  <div id="cl-error" class="cl-error" role="alert" hidden>
    <p id="cl-error-text"></p><button id="cl-reload" type="button">Reload puzzle</button>
  </div>
  </main>
  <dialog id="cl-level-dialog" class="cl-dialog" aria-labelledby="cl-level-title">
    <div class="cl-dialog-header"><h2 id="cl-level-title">Game menu</h2>
      <button id="cl-close" type="button" aria-label="Close game menu">×</button></div>
    <div class="cl-dialog-body">
    <div class="cl-menu-actions">
      <button id="cl-hint" type="button">Hint</button>
      <button id="cl-help" type="button" aria-haspopup="dialog" aria-controls="cl-instructions">How to play</button>
    </div>
    <div id="cl-chooser">
      <div class="cl-mode-switch" role="group" aria-label="Puzzle mode">
        <button id="cl-show-levels" type="button" aria-pressed="true" aria-controls="cl-campaign-panel">Levels</button>
        <button id="cl-show-endless" type="button" aria-pressed="false" aria-controls="cl-endless-panel">Endless</button>
      </div>
      <section id="cl-campaign-panel" aria-label="Campaign levels">
        <p id="cl-level-help"></p>
        <div id="cl-level-grid" class="cl-level-grid"></div>
      </section>
      <section id="cl-endless-panel" hidden aria-label="Endless puzzles">
        <button id="cl-endless" class="cl-endless-entry" type="button">Start Endless →</button>
      </section>
    </div>
    <section id="cl-code-panel" aria-label="Puzzle code">
      <form id="cl-code-form">
        <label for="cl-code-input">Puzzle code</label>
        <div class="cl-code-row"><input id="cl-code-input" required maxlength="40" placeholder="CL1-T1-0000002A"
          autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-describedby="cl-code-status">
          <button id="cl-copy-code" type="button" disabled>Copy</button></div>
        <button id="cl-play-code" class="cl-load-code" type="submit" hidden>Load cube</button>
      </form>
      <p id="cl-code-status" role="status" aria-live="polite">Shared cubes do not change your Endless progress.</p>
    </section>
    </div>
  </dialog>
`;

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return root.querySelector<T>(`#cl-${id}`)!;
}

const stage = element('stage');
const status = element('status');
const result = element('result');
const nextButton = element<HTMLButtonElement>('next');
const hintButton = element<HTMLButtonElement>('hint');
const dialog = element<HTMLDialogElement>('level-dialog');
const saveWarning = element('save-warning');
const instructions = element<HTMLDialogElement>('instructions');
let fatal = false;
let view: CubeRenderer | undefined;
let departingLineId: string | null = null;
let hintedLineId: string | null = null;
let mode: 'campaign' | 'endless' | 'shared' = 'campaign';
let endless: EndlessSave | null = null;
let shared: EndlessSave | null = null;
let resumeEndless = false;
let resumeShared = false;
const generator = new EndlessGenerator();
const codeGenerator = new EndlessGenerator();
let generating = false;
let generationError: string | null = null;
let waitingForNext = false;
let currentPuzzleCode = '';

function showHint(): void {
  if (fatal) return;
  const lines = session.layout.lines.filter(line => line.id !== departingLineId);
  if (!lines.length) return;
  const line = removable(lines, session.layout.size)[0];
  if (!line) {
    console.error('Cube Lines found a puzzle with no legal move.', save.level);
    status.textContent = 'This puzzle has no legal move. Choose another level, then return to reload this cube.';
    return;
  }
  hintedLineId = line.id;
  view?.highlight(line);
  status.textContent = 'Hint: the thicker purple path has a clear exit. Tap anywhere along it.';
}

function warnSave(message: string): void {
  saveWarning.hidden = false;
  saveWarning.textContent = message;
}

let save: Save;
let renewed = false;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  renewed = !raw && ['brainrot-cube-lines:v3', 'brainrot-cube-lines:v2']
    .some(key => localStorage.getItem(key) !== null);
  save = readSave(raw, layouts, getBestScore('cube-lines'));
} catch (error) {
  console.warn('Cube Lines could not restore the saved puzzle.', error);
  save = readSave(null, layouts, getBestScore('cube-lines'));
  warnSave('Your saved puzzle could not be restored. Starting a fresh cube; progress will be saved if storage is available.');
}
try {
  endless = readEndless(localStorage.getItem(ENDLESS_KEY));
  resumeEndless = localStorage.getItem(MODE_KEY) === 'endless';
  if (endless) {
    // Saves predating explicit presets used the original monotonic progression.
    endless.puzzle.preset ??= endlessPreset(Math.max(0, endless.cleared - (endless.finished ? 1 : 0)));
    if (endless.next) endless.next.preset ??= endlessPreset(endless.cleared + (endless.finished ? 0 : 1));
  }
} catch (error) {
  console.warn('Cube Lines could not restore endless progress.', error);
  warnSave('Your endless cube could not be restored. Campaign progress is kept; choose Endless to start a fresh cube.');
}
try {
  shared = readEndless(localStorage.getItem(SHARED_KEY));
  if (shared && shared.puzzle.preset === undefined) throw new Error('Shared cube is missing its difficulty preset.');
  resumeShared = !!shared && localStorage.getItem(MODE_KEY) === 'shared';
} catch (error) {
  shared = null;
  console.warn('Cube Lines could not restore the shared cube.', error);
  warnSave('Your shared cube could not be restored. Enter its code again; campaign and Endless progress are kept.');
}
let session: PuzzleSession;

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    if (endless) localStorage.setItem(ENDLESS_KEY, JSON.stringify(endless));
    if (shared) localStorage.setItem(SHARED_KEY, JSON.stringify(shared));
    localStorage.setItem(MODE_KEY, mode);
  } catch (error) {
    console.warn('Cube Lines could not save progress.', error);
    warnSave('Progress cannot be saved in this browser. You can keep playing, but this session will not survive a reload.');
  }
}

function updateCounts(): void {
  const initialEndless = mode === 'endless' && !endless;
  element('progress').style.visibility = initialEndless ? 'hidden' : '';
  stage.setAttribute('aria-busy', String(initialEndless && generating));
  element('mode-label').textContent = mode === 'shared' ? 'Shared cube' : mode === 'endless' ? 'Endless' : 'Level';
  element('level').hidden = mode !== 'campaign';
  element('level').textContent = mode === 'campaign' ? String(save.level) : '';
  element('total').hidden = mode !== 'campaign';
  element('remaining').textContent = String(session.layout.lines.length);
  const cleared = FACES.filter(face => !session.layout.lines.some(line => line.cells.some(cell => cell.face === face))).length;
  element('faces').textContent = `${cleared} / 6 faces clear`;
  refreshShareCode();
  hintButton.disabled = fatal || (mode === 'endless' && !endless) ||
    !session.layout.lines.some(line => line.id !== departingLineId);
}

function finishLevel(): void {
  status.textContent = '';
  element('result-text').hidden = false;
  if (mode === 'shared' && shared) {
    completeEndless(shared);
    persist();
    result.hidden = false;
    element('result-title').textContent = 'Cube cleared.';
    element('result-text').textContent = 'Your Endless progress is unchanged.';
    nextButton.textContent = 'Back to Endless →';
    nextButton.disabled = fatal;
    updateCounts();
    nextButton.focus({ preventScroll: true });
    return;
  }
  if (mode === 'endless' && endless) {
    completeEndless(endless);
    persist();
    result.hidden = false;
    element('result-title').textContent = 'Cube cleared.';
    element('result-text').textContent = '';
    element('result-text').hidden = true;
    nextButton.textContent = 'Next cube →';
    nextButton.disabled = fatal;
    updateCounts();
    prefetchEndless();
    nextButton.focus({ preventScroll: true });
    return;
  }
  if (save.level === save.completed + 1) {
    save.completed = save.level;
    submitScore('cube-lines', save.completed);
  }
  persist();
  result.hidden = false;
  const final = save.level === layouts.length;
  element('result-title').textContent = final ? 'All thirty. All clear.' : 'Cube cleared.';
  element('result-text').textContent = final
    ? 'Replay any cube whenever you like.'
    : '';
  element('result-text').hidden = !final;
  nextButton.textContent = final ? 'Choose a level' : 'Next level →';
  nextButton.focus({ preventScroll: true });
}

function attempt(id: string): void {
  if (fatal || session.busy || view?.isAnimating || (mode === 'endless' && !endless)) return;
  const line = session.layout.lines.find(candidate => candidate.id === id);
  const move = session.begin(id);
  if (!line || !move) return;
  hintedLineId = null;
  if (!move.commit) {
    view!.slam(line, updateCounts);
    updateCounts();
    status.textContent = 'Blocked. Remove the line in its path first.';
    return;
  }
  departingLineId = id;
  updateCounts();
  const activeSession = session;
  const commit = move.commit;
  view!.remove(line, () => {
    if (activeSession !== session || !commit()) return;
    departingLineId = null;
    if (mode === 'shared' && shared) shared.removed.push(id);
    else if (mode === 'endless' && endless) endless.removed.push(id);
    else save.removed.push(id);
    save.introduced = true;

    view!.setLayout(session.layout, hintedLineId);
    persist();
    updateCounts();
    if (!session.layout.lines.length) finishLevel();
    else if (!hintedLineId) status.textContent = '';
  });
}

function startLevel(level: number, restore = false): void {
  stopGeneration();
  mode = 'campaign';
  departingLineId = null;
  hintedLineId = null;
  if (session) session.restart();
  if (!restore) save = { ...save, level, removed: [] };
  session = new PuzzleSession(layouts[save.level - 1]);
  for (const id of save.removed) session.layout = attemptMove(session.layout, id).layout;
  view?.setLayout(session.layout);
  view?.resetView();
  result.hidden = true;
  nextButton.disabled = fatal;

  updateCounts();
  status.textContent = save.introduced ? 'Drag to rotate. Tap a line with a clear way out.' : 'Lines wrap around edges. Drag to follow them; tap a line whose arrow has a clear exit.';
  persist();
  if (!session.layout.lines.length) finishLevel();
}

function stopGeneration(): void {
  generator.cancel();
  generating = false;
  generationError = null;
  waitingForNext = false;
  element('generation').hidden = true;
  element('generation').removeAttribute('aria-busy');
  stage.setAttribute('aria-busy', 'false');
}

function updateGeneration(): void {
  const initial = !endless;
  const show = mode === 'endless' && (initial || waitingForNext || !!generationError);
  element('generation').hidden = !show;
  element('generation').setAttribute('aria-busy', String(generating));
  element('generation-status').textContent = generationError
    ? (initial ? 'Could not create a cube. Retry with a new seed, or choose a campaign level.'
      : 'Could not prepare the next cube. Your current cube is safe.')
    : 'Creating a fresh cube…';
  element('generation-retry').hidden = !generationError;
  stage.setAttribute('aria-busy', String(initial && generating && mode === 'endless'));
  nextButton.disabled = fatal || waitingForNext;
}

function prefetchEndless(): void {
  if (mode !== 'endless' || fatal || generating || endless?.next || generationError) return;
  generating = true;
  updateGeneration();
  const activeSave = endless;
  generator.generate({
    cleared: endless ? endless.cleared + (endless.finished ? 0 : 1) : 0,
    recent: endless?.recent ?? [],
    catalogSeen: endless?.catalogSeen ?? [],
  }, puzzle => {
    if (mode !== 'endless' || endless !== activeSave) return;
    generating = false;
    if (!endless) {
      endless = newEndless(puzzle);
      loadEndless();
    } else {
      endless.next = puzzle;
      rememberCatalog(endless, puzzle);
      persist();
      if (waitingForNext) {
        advanceEndless(endless);
        loadEndless();
      } else updateGeneration();
    }
  }, message => {
    if (mode !== 'endless' || endless !== activeSave) return;
    console.error('Cube Lines endless generation failed:', message);
    generating = false;
    waitingForNext = false;
    generationError = message;
    updateGeneration();
  });
}

function loadEndless(): void {
  if (!endless) return;
  departingLineId = null;
  hintedLineId = null;
  waitingForNext = false;
  session?.restart();
  session = new PuzzleSession(endless.puzzle.layout);
  for (const id of endless.removed) session.layout = attemptMove(session.layout, id).layout;
  view?.setLayout(session.layout);
  view?.resetView();
  result.hidden = true;

  status.textContent = save.introduced ? 'Drag to rotate. Tap a line with a clear way out.' : 'Lines wrap around edges. Drag to follow them; tap a line whose arrow has a clear exit.';
  updateCounts();
  updateGeneration();
  persist();
  if (!session.layout.lines.length) finishLevel();
  else prefetchEndless();
}

function startEndless(): void {
  if (mode === 'endless') return;
  stopGeneration();
  mode = 'endless';
  if (endless) loadEndless();
  else {
    session?.restart();
    session = new PuzzleSession({ size: 8, lines: [] });
    departingLineId = null;
    hintedLineId = null;
    view?.setLayout(session.layout);
    result.hidden = true;

    status.textContent = 'Endless creates a new puzzle for every cube.';
    updateCounts();
    persist();
    prefetchEndless();
  }
}

function loadShared(): void {
  if (!shared) return;
  stopGeneration();
  mode = 'shared';
  departingLineId = null;
  hintedLineId = null;
  session?.restart();
  session = new PuzzleSession(shared.puzzle.layout);
  for (const id of shared.removed) session.layout = attemptMove(session.layout, id).layout;
  view?.setLayout(session.layout);
  view?.resetView();
  result.hidden = true;

  nextButton.disabled = fatal;
  status.textContent = 'Shared cube. Your Endless progress is unchanged.';
  updateCounts();
  persist();
  if (!session.layout.lines.length) finishLevel();
}

function updateCodeActions(): void {
  const input = element<HTMLInputElement>('code-input');
  const value = input.value.trim();
  let normalized = value;
  try { normalized = formatPuzzleCode(parsePuzzleCode(value)); } catch { /* Validate on Load. */ }
  element('play-code').hidden = !value || normalized === currentPuzzleCode;
  element<HTMLButtonElement>('copy-code').disabled = !value;
}

function refreshShareCode(): void {
  const puzzle = mode === 'shared' ? shared?.puzzle : mode === 'endless' ? endless?.puzzle : null;
  currentPuzzleCode = '';
  if (puzzle?.preset !== undefined) {
    try {
      currentPuzzleCode = formatPuzzleCode({ ...puzzle, preset: puzzle.preset });
    } catch (error) {
      console.warn('Cube Lines could not share this puzzle.', error);
    }
  }
  if (!dialog.open) {
    element<HTMLInputElement>('code-input').value = currentPuzzleCode;
    updateCodeActions();
  }
}

function showPuzzleMode(endlessMode: boolean): void {
  element('campaign-panel').hidden = endlessMode;
  element('endless-panel').hidden = !endlessMode;
  element('show-levels').setAttribute('aria-pressed', String(!endlessMode));
  element('show-endless').setAttribute('aria-pressed', String(endlessMode));
}

function openLevels(): void {
  const grid = element('level-grid');
  grid.replaceChildren();
  const unlocked = Math.min(layouts.length, save.completed + 1);
  element('level-help').textContent = save.completed === layouts.length
    ? 'All levels cleared. Replay any cube.'
    : 'Clear a cube to unlock the next.';
  element('endless').textContent = endless ? 'Continue Endless →' : 'Start Endless →';
  element('code-status').textContent = '';
  showPuzzleMode(mode !== 'campaign');
  refreshShareCode();
  for (let level = 1; level <= layouts.length; level++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${level}${level <= save.completed ? ' ✓' : ''}`;
    button.disabled = level > unlocked;
    button.setAttribute('aria-label', `Level ${level}${level <= save.completed ? ', cleared' : level > unlocked ? ', locked' : ''}`);
    if (mode === 'campaign' && level === save.level) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => {
      dialog.close();
      if (mode !== 'campaign' || level !== save.level) startLevel(level, level === save.level);
      view?.canvas.focus({ preventScroll: true });
    });
    grid.appendChild(button);
  }
  dialog.showModal();
}

function fail(message: string): void {
  fatal = true;
  stopGeneration();
  codeGenerator.cancel();
  element('code-form').removeAttribute('aria-busy');
  element<HTMLButtonElement>('play-code').disabled = true;
  element('code-status').textContent = 'The 3D cube is unavailable. Reload the puzzle before entering a code.';
  departingLineId = null;
  hintedLineId = null;
  console.error('Cube Lines graphics error:', message);
  element('error').hidden = false;
  element('error-text').textContent = message;
  view?.setEnabled(false);
  hintButton.disabled = true;
  nextButton.disabled = true;
}

try {
  view = new CubeRenderer(stage, attempt, fail);
} catch (error) {
  console.error('Cube Lines could not initialize WebGL.', error);
  fail('The 3D cube could not start. Enable WebGL or hardware acceleration in your browser, then reload.');
}
startLevel(save.level, true);
if (resumeShared) loadShared();
else if (resumeEndless) startEndless();
else if (renewed) status.textContent = 'Lines now wrap around cube edges. Cleared levels are kept; your in-progress cube starts fresh.';
element('levels').addEventListener('click', openLevels);
element('close').addEventListener('click', () => dialog.close());
element('show-levels').addEventListener('click', () => showPuzzleMode(false));
element('show-endless').addEventListener('click', () => showPuzzleMode(true));
element('code-input').addEventListener('input', () => {
  codeGenerator.cancel();
  element('code-form').removeAttribute('aria-busy');
  element<HTMLButtonElement>('play-code').disabled = fatal;
  element('code-input').removeAttribute('aria-invalid');
  element('code-status').textContent = '';
  updateCodeActions();
});
dialog.addEventListener('close', () => {
  codeGenerator.cancel();
  element('code-form').removeAttribute('aria-busy');
  element<HTMLButtonElement>('play-code').disabled = fatal;
  element('code-status').textContent = 'Shared cubes do not change your Endless progress.';
  element<HTMLInputElement>('code-input').removeAttribute('aria-invalid');
});
element<HTMLFormElement>('code-form').addEventListener('submit', event => {
  event.preventDefault();
  if (fatal || element('play-code').hidden || element('code-form').getAttribute('aria-busy') === 'true') return;
  const input = element<HTMLInputElement>('code-input');
  let code: string;
  try {
    code = formatPuzzleCode(parsePuzzleCode(input.value));
  } catch (error) {
    input.setAttribute('aria-invalid', 'true');
    element('code-status').textContent = error instanceof Error ? error.message : 'Invalid puzzle code.';
    return;
  }
  input.removeAttribute('aria-invalid');
  element('code-form').setAttribute('aria-busy', 'true');
  element<HTMLButtonElement>('play-code').disabled = true;
  element('code-status').textContent = 'Creating the shared cube…';
  codeGenerator.generate({ cleared: 0, recent: [], code }, puzzle => {
    if (!dialog.open || fatal) return;
    shared = newEndless(puzzle);
    dialog.close();
    loadShared();
    view?.canvas.focus({ preventScroll: true });
  }, message => {
    console.error('Cube Lines shared generation failed:', message);
    element('code-form').removeAttribute('aria-busy');
    element<HTMLButtonElement>('play-code').disabled = false;
    element('code-status').textContent = `Could not create that cube. ${message} Your current puzzle is unchanged.`;
  });
});
async function copyCurrentCode(): Promise<void> {
  const input = element<HTMLInputElement>('code-input');
  const code = input.value;
  try {
    await navigator.clipboard.writeText(code);
    const message = 'Code copied.';
    status.textContent = message;
    element('code-status').textContent = message;
  } catch (error) {
    console.warn('Cube Lines could not copy the puzzle code.', error);
    if (!dialog.open) openLevels();
    input.focus();
    input.select();
    element('code-status').textContent = 'Select and copy this code to share the full cube.';
  }
}
element('copy-code').addEventListener('click', copyCurrentCode);
element('endless').addEventListener('click', () => {
  dialog.close();
  startEndless();
  view?.canvas.focus({ preventScroll: true });
});
element('generation-retry').addEventListener('click', () => {
  generationError = null;
  prefetchEndless();
});
element('reload').addEventListener('click', () => window.location.reload());
hintButton.addEventListener('click', () => {
  dialog.close();
  showHint();
  view?.canvas.focus({ preventScroll: true });
});
element('help').addEventListener('click', () => {
  dialog.close();
  instructions.showModal();
});
instructions.addEventListener('close', () => element('levels').focus());
element('help-close').addEventListener('click', () => instructions.close());
nextButton.addEventListener('click', () => {
  if (mode === 'shared') {
    startEndless();
    view?.canvas.focus({ preventScroll: true });
    return;
  }
  if (mode === 'endless') {
    if (!endless?.finished) return;
    if (endless.next) {
      advanceEndless(endless);
      loadEndless();
      view?.canvas.focus({ preventScroll: true });
    } else {
      waitingForNext = true;
      generationError = null;
      prefetchEndless();
      updateGeneration();
    }
    return;
  }
  if (save.level === layouts.length) openLevels();
  else {
    startLevel(save.level + 1);
    view?.canvas.focus({ preventScroll: true });
  }
});
window.addEventListener('pagehide', event => {
  persist();
  if (!event.persisted) {
    generator.cancel();
    codeGenerator.cancel();
    view?.dispose();
  }
});
if (import.meta.hot) import.meta.hot.dispose(() => {
  generator.cancel();
  codeGenerator.cancel();
  view?.dispose();
});

// Keep the code-entry sheet inside the area above the on-screen keyboard.
function updateViewport(): void {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--cl-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
  document.documentElement.style.setProperty('--cl-viewport-top', `${viewport?.offsetTop ?? 0}px`);
}
updateViewport();
window.visualViewport?.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('scroll', updateViewport);
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.visualViewport?.removeEventListener('resize', updateViewport);
  window.visualViewport?.removeEventListener('scroll', updateViewport);
});
