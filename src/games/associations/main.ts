import { getBestScore, submitScore } from '../../core/scores';
import { showOnboardHint } from '../../core/onboardHint';
import {
  COLUMN_COUNT,
  applyMove,
  autoTarget,
  canDrop,
  deal,
  draw,
  getRun,
  hasAnyMove,
  isWon,
  listTargets,
  sameSource,
  type Card,
  type GameState,
  type Source,
  type Target,
} from './rules';

/**
 * Associations — a solitaire-style word grouping game.
 *
 * DOM-rendered: the whole board is re-rendered from `state` after every move.
 * Cards can be dragged (mouse/touch) or tapped: tap a card to select it, then
 * tap a destination; tapping a selected card again auto-moves it to a slot.
 */

const SCORE_KEY = 'associations';

showOnboardHint({
  key: SCORE_KEY,
  line1: 'Stack every word on its category.',
  line2: 'Put category cards in the five slots, then drop matching words on them. Moves are limited — house cards cost a move too.',
});

const root = document.getElementById('game-root')!;

// ── HUD ───────────────────────────────────────────────────
const hud = document.createElement('div');
hud.className = 'hud-overlay as-overlay';
hud.innerHTML = `
  <div class="hud-topbar">
    <a class="back-link" href="../../">← Hub</a>
    <div class="hud-bar as-bar">
      <div class="as-stat"><span class="as-label">Level</span><span class="as-val" id="as-level">1</span></div>
      <div class="as-stat"><span class="as-label">Moves</span><span class="as-val" id="as-moves">0</span></div>
      <div class="as-stat"><span class="as-label">Groups</span><span class="as-val" id="as-groups">0/0</span></div>
    </div>
    <button class="game-btn as-new" id="as-new" type="button">↻ New</button>
  </div>
  <div class="td-modal" id="as-modal" hidden>
    <div class="td-card as-modal-card" role="dialog" aria-modal="true" aria-labelledby="as-modal-title">
      <div class="td-emoji" id="as-modal-emoji" aria-hidden="true">🃏</div>
      <h2 id="as-modal-title">Out of moves</h2>
      <p id="as-modal-sub"></p>
      <p class="td-best" id="as-modal-best"></p>
      <div class="td-actions">
        <button class="game-btn td-primary" id="as-modal-primary" type="button">Play again</button>
        <a class="game-btn as-hub-btn" href="../../">Back to hub</a>
      </div>
    </div>
  </div>
`;
document.body.appendChild(hud);

const levelEl = hud.querySelector<HTMLElement>('#as-level')!;
const movesEl = hud.querySelector<HTMLElement>('#as-moves')!;
const groupsEl = hud.querySelector<HTMLElement>('#as-groups')!;
const modalEl = hud.querySelector<HTMLElement>('#as-modal')!;
const modalEmojiEl = hud.querySelector<HTMLElement>('#as-modal-emoji')!;
const modalTitleEl = hud.querySelector<HTMLElement>('#as-modal-title')!;
const modalSubEl = hud.querySelector<HTMLElement>('#as-modal-sub')!;
const modalBestEl = hud.querySelector<HTMLElement>('#as-modal-best')!;
const modalPrimaryEl = hud.querySelector<HTMLButtonElement>('#as-modal-primary')!;
const newBtn = hud.querySelector<HTMLButtonElement>('#as-new')!;

// ── Board skeleton ────────────────────────────────────────
const board = document.createElement('div');
board.className = 'as-board';
board.innerHTML = `
  <div class="as-row as-top">
    <button class="as-pile as-stock" id="as-stock" type="button" aria-label="House cards: draw a card"></button>
    <div class="as-pile as-waste" id="as-waste" aria-label="Drawn card"></div>
    <p class="as-status" id="as-status" role="status" aria-live="polite"></p>
  </div>
  <div class="as-row as-slots" id="as-slots"></div>
  <div class="as-tableau" id="as-tableau"></div>
`;
root.appendChild(board);

const stockEl = board.querySelector<HTMLButtonElement>('#as-stock')!;
const wasteEl = board.querySelector<HTMLElement>('#as-waste')!;
const statusEl = board.querySelector<HTMLElement>('#as-status')!;
const slotsEl = board.querySelector<HTMLElement>('#as-slots')!;
const tableauEl = board.querySelector<HTMLElement>('#as-tableau')!;

// ── State ─────────────────────────────────────────────────
let state: GameState = deal(1);
let selected: Source | null = null;
let gameOver = false;
let statusTimer: number | undefined;

function startLevel(level: number): void {
  state = deal(level);
  selected = null;
  gameOver = false;
  modalEl.hidden = true;
  setStatus(level === 1 ? 'Drag a category card into a slot to begin.' : `Level ${level} — more groups, fewer spare moves.`);
  render();
}

function setStatus(text: string, tone: 'info' | 'good' | 'bad' = 'info'): void {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
  window.clearTimeout(statusTimer);
}

function flashStatus(text: string, tone: 'good' | 'bad'): void {
  setStatus(text, tone);
  statusTimer = window.setTimeout(() => setStatus(''), 2200);
}

// ── Layout ────────────────────────────────────────────────
function layout(): { cw: number; ch: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const sidePad = 12;
  const gap = Math.max(6, Math.min(14, W * 0.02));
  const cw = Math.max(54, Math.min(112, (Math.min(W, 760) - sidePad * 2 - gap * (COLUMN_COUNT - 1)) / COLUMN_COUNT));
  // Keep two fixed rows plus at least a few fanned cards visible on short screens.
  const ch = Math.min(cw * 1.38, Math.max(64, (H - 80) / 4.6));
  document.documentElement.style.setProperty('--as-cw', `${cw}px`);
  document.documentElement.style.setProperty('--as-ch', `${ch}px`);
  document.documentElement.style.setProperty('--as-gap', `${gap}px`);
  return { cw, ch };
}

// ── Rendering ─────────────────────────────────────────────
function cardHTML(card: Card, opts: { slotFilled?: number } = {}): string {
  if (!card.faceUp) return '';
  if (card.kind === 'word') {
    return `<span class="as-wordtext">${escapeHTML(card.label)}</span>`;
  }
  const size = state.categories[card.cat].size;
  const count = opts.slotFilled != null
    ? `${opts.slotFilled}/${size}`
    : `${size} card${size === 1 ? '' : 's'}`;
  const pct = opts.slotFilled != null ? Math.round((opts.slotFilled / size) * 100) : 0;
  return `
    <span class="as-tag">Category</span>
    <span class="as-name">${escapeHTML(card.label)}</span>
    <span class="as-count">${count}</span>
    ${opts.slotFilled != null ? `<span class="as-progress"><span style="width:${pct}%"></span></span>` : ''}
  `;
}

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function makeCard(card: Card, extra = ''): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `as-card ${card.faceUp ? `as-${card.kind}` : 'as-facedown'} ${extra}`.trim();
  el.innerHTML = cardHTML(card);
  if (card.faceUp) {
    el.setAttribute('aria-label', card.kind === 'category'
      ? `Category ${card.label}, ${state.categories[card.cat].size} cards`
      : `Word ${card.label}`);
  }
  return el;
}

function isSelected(src: Source): boolean {
  if (!selected) return false;
  if (selected.zone === 'waste') return src.zone === 'waste';
  return src.zone === 'column' && src.index === selected.index && src.start >= selected.start;
}

function render(): void {
  const focused = document.activeElement as HTMLElement | null;
  const focusKey = focused && board.contains(focused)
    ? focused.dataset.src ? `[data-src="${focused.dataset.src}"]` : focused.dataset.drop ? `[data-drop="${focused.dataset.drop}"]` : ''
    : '';
  const { ch } = layout();

  // HUD
  levelEl.textContent = String(state.level);
  movesEl.textContent = String(state.movesLeft);
  movesEl.classList.toggle('as-low', state.movesLeft <= 10);
  groupsEl.textContent = `${state.completed}/${state.categories.length}`;

  // Stock
  stockEl.innerHTML = '';
  stockEl.classList.toggle('as-empty', state.stock.length === 0);
  stockEl.classList.toggle('as-recycle', state.stock.length === 0 && state.waste.length > 0);
  stockEl.setAttribute('aria-label', state.stock.length
    ? `House cards: ${state.stock.length} left, draw one`
    : state.waste.length ? 'Recycle house cards' : 'No house cards left');
  if (state.stock.length) {
    const back = makeCard({ id: -1, cat: 0, kind: 'word', label: '', faceUp: false });
    back.innerHTML = `<span class="as-stock-count">${state.stock.length}</span>`;
    stockEl.appendChild(back);
  } else {
    stockEl.innerHTML = `<span class="as-pile-label">${state.waste.length ? '↺' : '∅'}</span>`;
  }

  // Waste (show the top card, with a hint of the one beneath)
  wasteEl.innerHTML = '';
  const wasteTop = state.waste[state.waste.length - 1];
  if (state.waste.length > 1) wasteEl.appendChild(makeCard(state.waste[state.waste.length - 2], 'as-under'));
  if (wasteTop) {
    const el = makeCard(wasteTop, isSelected({ zone: 'waste' }) ? 'as-selected' : '');
    el.dataset.src = 'waste';
    wasteEl.appendChild(el);
  }

  // Slots
  slotsEl.innerHTML = '';
  state.slots.forEach((slot, i) => {
    const el = document.createElement('div');
    el.className = 'as-pile as-slot';
    el.dataset.drop = `slot:${i}`;
    if (slot) {
      const cat = state.categories[slot.cat];
      const card = makeCard({ id: -1, cat: slot.cat, kind: 'category', label: cat.name, faceUp: true });
      card.innerHTML = cardHTML({ id: -1, cat: slot.cat, kind: 'category', label: cat.name, faceUp: true }, { slotFilled: slot.filled });
      card.setAttribute('aria-label', `Slot: ${cat.name}, ${slot.filled} of ${cat.size}`);
      el.appendChild(card);
    } else {
      el.innerHTML = `<span class="as-pile-label">Slot</span>`;
      el.setAttribute('aria-label', 'Empty slot');
    }
    slotsEl.appendChild(el);
  });

  // Tableau
  tableauEl.innerHTML = '';
  const tableauTop = tableauEl.getBoundingClientRect().top || 0;
  const availH = Math.max(ch * 1.5, window.innerHeight - tableauTop - 12);
  state.columns.forEach((col, index) => {
    const colEl = document.createElement('div');
    colEl.className = 'as-column';
    colEl.dataset.drop = `column:${index}`;
    colEl.setAttribute('aria-label', `Column ${index + 1}`);

    // Fan offsets shrink so tall columns still fit in the viewport.
    const down = col.filter((c) => !c.faceUp).length;
    const up = col.length - down;
    let upOff = ch * 0.3;
    let downOff = ch * 0.12;
    const needed = down * downOff + Math.max(0, up - 1) * upOff + ch;
    if (needed > availH && col.length > 1) {
      const k = (availH - ch) / (needed - ch);
      upOff *= k;
      downOff *= k;
    }

    let y = 0;
    col.forEach((card, start) => {
      const src: Source = { zone: 'column', index, start };
      const el = makeCard(card, isSelected(src) && card.faceUp ? 'as-selected' : '');
      el.style.top = `${y}px`;
      el.style.zIndex = String(start + 1);
      if (card.faceUp && getRun(state, src)) el.dataset.src = `column:${index}:${start}`;
      colEl.appendChild(el);
      y += card.faceUp ? upOff : downOff;
    });
    colEl.style.minHeight = `${Math.max(ch, y - (col.length ? (col[col.length - 1].faceUp ? upOff : downOff) : 0) + ch)}px`;
    if (!col.length) colEl.innerHTML = `<span class="as-pile-label">Empty</span>`;
    tableauEl.appendChild(colEl);
  });

  fitText();
  highlightTargets();

  board.querySelectorAll<HTMLElement>('[data-src], [data-drop]').forEach((el) => {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
  });
  if (focusKey) board.querySelector<HTMLElement>(focusKey)?.focus();
}

/** Shrink card text that would overflow so long words never break mid-word. */
function fitText(): void {
  board.querySelectorAll<HTMLElement>('.as-wordtext, .as-name').forEach((span) => {
    span.style.fontSize = '';
    const card = span.parentElement!;
    const avail = card.clientWidth - 6;
    if (span.scrollWidth > avail) {
      const base = parseFloat(getComputedStyle(span).fontSize);
      span.style.fontSize = `${Math.max(7, Math.floor(base * (avail / span.scrollWidth) * 10) / 10)}px`;
    }
  });
}

function highlightTargets(): void {
  board.querySelectorAll('.as-valid').forEach((el) => el.classList.remove('as-valid'));
  const src = dragging?.source ?? selected;
  if (!src) return;
  const run = getRun(state, src);
  if (!run) return;
  for (const t of listTargets(state)) {
    if (sameSource(src, t)) continue;
    if (canDrop(state, run, t)) board.querySelector(`[data-drop="${t.zone}:${t.index}"]`)?.classList.add('as-valid');
  }
}

// ── Moves ─────────────────────────────────────────────────
function parseSource(attr: string | undefined): Source | null {
  if (!attr) return null;
  if (attr === 'waste') return { zone: 'waste' };
  const [, i, s] = attr.split(':');
  return { zone: 'column', index: Number(i), start: Number(s) };
}

function parseTarget(attr: string | undefined): Target | null {
  if (!attr) return null;
  const [zone, i] = attr.split(':');
  if (zone !== 'slot' && zone !== 'column') return null;
  return { zone, index: Number(i) };
}

function tryMove(src: Source, target: Target): boolean {
  if (gameOver) return false;
  const res = applyMove(state, src, target);
  if (!res.ok) return false;
  selected = null;
  if (res.completedCat != null) {
    flashStatus(`✓ ${state.categories[res.completedCat].name} complete!`, 'good');
  } else {
    setStatus('');
  }
  afterMove();
  return true;
}

function doDraw(): void {
  if (gameOver) return;
  if (draw(state)) {
    selected = null;
    setStatus('');
    afterMove();
  }
}

function afterMove(): void {
  render();
  if (isWon(state)) {
    gameOver = true;
    const best = submitScore(SCORE_KEY, state.level);
    showModal({
      emoji: '🎉',
      title: `Level ${state.level} cleared!`,
      sub: `All ${state.categories.length} groups associated with ${state.movesLeft} move${state.movesLeft === 1 ? '' : 's'} to spare.`,
      best: `Best: ${best} level${best === 1 ? '' : 's'}`,
      primary: 'Next level →',
      onPrimary: () => startLevel(state.level + 1),
      win: true,
    });
  } else if (state.movesLeft <= 0 || !hasAnyMove(state)) {
    gameOver = true;
    const best = getBestScore(SCORE_KEY);
    showModal({
      emoji: state.movesLeft <= 0 ? '⌛' : '🧱',
      title: state.movesLeft <= 0 ? 'Out of moves' : 'No moves left',
      sub: `You reached level ${state.level} and finished ${state.completed} of ${state.categories.length} groups.`,
      best: best > 0 ? `Best: ${best} level${best === 1 ? '' : 's'}` : '',
      primary: 'Play again',
      onPrimary: () => startLevel(1),
      win: false,
    });
  }
}

let onModalPrimary: () => void = () => {};
function showModal(o: { emoji: string; title: string; sub: string; best: string; primary: string; onPrimary: () => void; win: boolean }): void {
  modalEmojiEl.textContent = o.emoji;
  modalTitleEl.textContent = o.title;
  modalTitleEl.classList.toggle('as-win', o.win);
  modalSubEl.textContent = o.sub;
  modalBestEl.textContent = o.best;
  modalPrimaryEl.textContent = o.primary;
  onModalPrimary = o.onPrimary;
  modalEl.hidden = false;
  modalPrimaryEl.focus();
}
modalPrimaryEl.addEventListener('click', () => onModalPrimary());

newBtn.addEventListener('click', () => startLevel(1));
stockEl.addEventListener('click', doDraw);

// Keyboard: Enter/Space on a focused card selects it; on a slot or column it drops the selection there.
board.addEventListener('keydown', (e) => {
  if (gameOver || (e.key !== 'Enter' && e.key !== ' ')) return;
  const el = e.target as HTMLElement;
  const source = parseSource(el.dataset.src);
  const target = parseTarget(el.dataset.drop);
  if (!source && !target) return;
  e.preventDefault();
  e.stopPropagation();
  if (source) {
    handleTap(source);
  } else if (selected && target && !tryMove(selected, target)) {
    flashStatus("That card doesn't go there.", 'bad');
  }
});

window.addEventListener('keydown', (e) => {
  if (!modalEl.hidden) return;
  if (e.key === 'd' || e.key === 'D') doDraw();
  if (e.key === 'Escape' && selected) {
    selected = null;
    render();
  }
});

// ── Pointer input: drag & drop + tap-to-select ────────────
interface DragState {
  source: Source;
  pointerId: number;
  x0: number;
  y0: number;
  active: boolean;
  ghost?: HTMLDivElement;
  offX: number;
  offY: number;
  originals: HTMLElement[];
}
let dragging: DragState | null = null;
const DRAG_THRESHOLD = 6;

board.addEventListener('pointerdown', (e) => {
  if (gameOver || e.button !== 0) return;
  const cardEl = (e.target as HTMLElement).closest<HTMLElement>('[data-src]');
  const source = parseSource(cardEl?.dataset.src);
  if (!cardEl || !source) return;
  e.preventDefault();
  const rect = cardEl.getBoundingClientRect();
  dragging = {
    source,
    pointerId: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    active: false,
    offX: e.clientX - rect.left,
    offY: e.clientY - rect.top,
    originals: [],
  };
});

window.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== dragging.pointerId) return;
  if (!dragging.active) {
    if (Math.hypot(e.clientX - dragging.x0, e.clientY - dragging.y0) < DRAG_THRESHOLD) return;
    beginDrag(dragging);
  }
  if (dragging.ghost) {
    dragging.ghost.style.transform = `translate(${e.clientX - dragging.offX}px, ${e.clientY - dragging.offY}px)`;
  }
});

function sourceElements(src: Source): HTMLElement[] {
  if (src.zone === 'waste') return [wasteEl.querySelector<HTMLElement>('[data-src="waste"]')!].filter(Boolean);
  const colEl = tableauEl.children[src.index] as HTMLElement | undefined;
  if (!colEl) return [];
  return Array.from(colEl.querySelectorAll<HTMLElement>('.as-card')).slice(src.start);
}

function beginDrag(d: DragState): void {
  d.active = true;
  selected = null;
  board.querySelectorAll('.as-selected').forEach((el) => el.classList.remove('as-selected'));
  d.originals = sourceElements(d.source);
  if (!d.originals.length) return;
  const baseRect = d.originals[0].getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'as-ghost';
  for (const orig of d.originals) {
    const r = orig.getBoundingClientRect();
    const clone = orig.cloneNode(true) as HTMLElement;
    clone.classList.remove('as-selected');
    clone.style.top = `${r.top - baseRect.top}px`;
    clone.style.left = '0px';
    clone.style.zIndex = '';
    ghost.appendChild(clone);
    orig.classList.add('as-lifted');
  }
  ghost.style.transform = `translate(${baseRect.left}px, ${baseRect.top}px)`;
  document.body.appendChild(ghost);
  d.ghost = ghost;
  highlightTargets();
}

function dropTargetAt(x: number, y: number): Target | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const t = parseTarget((el as HTMLElement).closest<HTMLElement>('[data-drop]')?.dataset.drop);
    if (t) return t;
  }
  return null;
}

window.addEventListener('pointerup', (e) => {
  const d = dragging;
  if (!d || e.pointerId !== d.pointerId) return;
  dragging = null;

  if (d.active) {
    d.ghost?.remove();
    d.originals.forEach((el) => el.classList.remove('as-lifted'));
    // Try the pointer position first, then the centre of the dragged card.
    const first = d.ghost?.firstElementChild?.getBoundingClientRect();
    const candidates: Target[] = [];
    const atPointer = dropTargetAt(e.clientX, e.clientY);
    if (atPointer) candidates.push(atPointer);
    if (first) {
      const atCard = dropTargetAt(e.clientX - d.offX + first.width / 2, e.clientY - d.offY + first.height / 2);
      if (atCard) candidates.push(atCard);
    }
    if (!candidates.some((t) => tryMove(d.source, t))) {
      if (candidates.length) flashStatus("That card doesn't go there.", 'bad');
      render();
    }
    return;
  }
  handleTap(d.source);
});

window.addEventListener('pointercancel', () => {
  if (!dragging) return;
  dragging.ghost?.remove();
  dragging = null;
  render();
});

function sameSrc(a: Source, b: Source): boolean {
  if (a.zone === 'waste' || b.zone === 'waste') return a.zone === b.zone;
  return a.index === b.index && a.start === b.start;
}

function handleTap(source: Source): void {
  if (selected && sameSrc(selected, source)) {
    // Second tap on the same card: auto-move it somewhere useful.
    const t = autoTarget(state, source);
    if (!t || !tryMove(source, t)) {
      selected = null;
      render();
    }
    return;
  }
  if (selected && source.zone === 'column' && tryMove(selected, { zone: 'column', index: source.index })) return;
  selected = source;
  render();
}

// Taps on empty drop zones (slots, empty columns, column background) while a card is selected.
board.addEventListener('click', (e) => {
  if (!selected || gameOver) return;
  const el = e.target as HTMLElement;
  if (el.closest('[data-src]')) return;
  const t = parseTarget(el.closest<HTMLElement>('[data-drop]')?.dataset.drop);
  if (t) {
    if (!tryMove(selected, t)) flashStatus("That card doesn't go there.", 'bad');
  } else if (!el.closest('#as-stock')) {
    selected = null;
    render();
  }
});

window.addEventListener('resize', render);
window.addEventListener('orientationchange', render);

startLevel(1);
