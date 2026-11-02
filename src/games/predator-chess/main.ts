import './style.css';
import { initial, legal, play, side, square, inCheck, type State, type Move } from './engine';
import { pieceSvg } from './pieces';
const app = document.querySelector<HTMLDivElement>('#app')!;
let state: State = initial();
let selected: number | null = null;
let flipped = false;
let handoff = false;
let lastMove: Move | null = null;
const names: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn', x: 'Predator' };
const rules=`<h2>The hunt</h2><p>Standard chess setup, with a queen-moving Predator on d1 and d8. White moves first. Two people share this device.</p><h3>Every turn</h3><p>If your Predator can legally capture a pawn, bishop or knight, you must choose one of those captures. Defended targets still count. Rooks, queens and Predators do not trigger the obligation. Tap a piece, then a highlighted square.</p><h3>Two ways to win</h3><p>Capture the enemy Predator with your king, or have your Predator capture all 12 of the opponent’s original pawns, bishops and knights.</p><h3>House rules for unspecified details</h3><ul><li>A non-king capture, including Predator against Predator, leaves the capturer on the target square. The captured Predator respawns uniformly on a random empty square that keeps the moving king safe. It may be attacked or beside the opposing king. The original square may be chosen. If no safe respawn exists, the capture is illegal.</li><li>Normal check legality applies: kings never move into attack, including when taking a defended Predator. Forced captures that leave your king in check are excluded. If no legal forced capture exists, other legal moves are allowed.</li><li>Castling, en passant and promotion follow chess rules. Promotion offers queen, rook, bishop or knight; a queen is an ordinary queen, not a new Predator.</li><li>Sweep belongs to the Predator’s owner. Track original piece identities, even after promotion. Captures by other pieces do not count; if another piece takes an original target, that sweep becomes impossible. Newly promoted minor pieces trigger forced captures but are not extra sweep targets.</li><li>Checkmate is a draw: the only wins are the two Predator conditions. Stalemate, threefold repetition and 50 moves without a pawn move or capture also draw. Repetition compares exact board state, movement rights, en passant target and sweep progress.</li></ul><p class="credit">Inspired by @neanderman’s <a href="https://youtube.com/shorts/pXmmXOcvaGA" target="_blank" rel="noreferrer">Predator Chess</a>. These edge-case choices are implementation rules, not claims about the video.</p>`;

function render(focusSquare?: number) {
 const available = legal(state);
 const targets = available.moves.filter(m => m.from === selected);
 const checked = inCheck(state, state.turn);
 const message = state.result ? state.result : handoff ? `Pass to ${side(state.turn)}` : `${side(state.turn)} to move`;
 const hint = state.result ? 'Game finished.' : handoff ? 'Hand over the device, then continue.' : available.forced ? (checked ? 'Check. Your Predator must capture.' : 'Your Predator must capture a pawn, bishop or knight.') : checked ? 'Check. Protect your king.' : 'Select a piece, then a highlighted square.';
 app.innerHTML = `
 <header class="header"><a href="/" aria-label="Back to arcade">← Arcade</a><h1>Predator Chess</h1><button id="rules">Rules</button></header>
 <main>
  <section class="game" aria-label="Predator Chess">
   <div class="status ${handoff ? 'waiting' : ''}" role="status" aria-live="polite">
    <div class="status-copy"><span class="side-dot ${state.turn}" aria-hidden="true"></span><div><h2>${message}</h2><p>${hint}</p></div></div>
    ${handoff ? `<button id="ready" class="primary">Play as ${side(state.turn)}</button>` : ''}
   </div>
   <div class="board-wrap">
    <div class="ranks" aria-hidden="true">${Array.from({length: 8}, (_, j) => `<span>${flipped ? j + 1 : 8 - j}</span>`).join('')}</div>
    <div class="board ${handoff ? 'locked' : ''}" role="group" aria-label="Chess board, ${flipped ? 'Black' : 'White'} at bottom" ${handoff ? 'inert' : ''}>
     ${Array.from({length: 64}, (_, j) => {
      const i = flipped ? 63 - j : j;
      const p = state.board[i];
      const target = targets.some(m => m.to === i);
      const forced = !handoff && available.forced && p?.c === state.turn && p.t === 'x';
      const check = checked && p?.t === 'k' && p.c === state.turn;
      return `<button class="sq ${(Math.floor(i / 8) + i % 8) % 2 ? 'dark' : 'light'} ${i === selected ? 'selected' : ''} ${target ? (p ? 'capture' : 'target') : ''} ${lastMove && [lastMove.from, lastMove.to].includes(i) ? 'last-move' : ''} ${forced ? 'forced' : ''} ${check ? 'check' : ''}"
       data-square="${i}" aria-label="${square(i)}${p ? ', ' + side(p.c) + ' ' + names[p.t] : ', empty'}${target ? ', legal destination' : ''}" aria-pressed="${i === selected}" ${handoff || state.result ? 'disabled' : ''}>${p ? pieceSvg(p.t, p.c) : ''}</button>`;
     }).join('')}
    </div>
    <div class="files" aria-hidden="true">${(flipped ? 'hgfedcba' : 'abcdefgh').split('').map(f => `<span>${f}</span>`).join('')}</div>
   </div>
   <div class="board-footer"><span aria-label="Predator sweep progress">Sweep <span class="sweep w">White <b>${state.swept.w.length}/12</b></span><span class="sweep b">Black <b>${state.swept.b.length}/12</b></span></span><button id="flip" aria-label="Flip board orientation">Flip board</button></div>
   <div class="last-action" aria-label="Last move">${state.log[state.log.length - 1] || 'Capture the enemy Predator with your king, or complete a Predator sweep.'}</div>
   <footer><details><summary>Move history${state.log.length ? ` (${state.log.length})` : ''}</summary><ol>${state.log.length ? state.log.map(t => `<li>${t}</li>`).join('') : '<li>No moves yet.</li>'}</ol></details><button id="restart">New game</button></footer>
  </section>
 </main>
 <dialog id="help" aria-labelledby="help-title">${rules.replace('<h2>', '<h2 id="help-title">')}<button class="primary" id="close">Done</button></dialog>
 <dialog id="promotion" aria-labelledby="promotion-title"><h2 id="promotion-title">Promote pawn</h2><p>Choose a piece to finish your move.</p><div id="choices"></div><button id="promotion-cancel">Cancel</button></dialog>
 <dialog id="reset" aria-labelledby="reset-title"><h2 id="reset-title">Start a new game?</h2><p>Your current game will be cleared.</p><div class="dialog-actions"><button id="cancel" autofocus>Keep playing</button><button class="primary" id="confirm">New game</button></div></dialog>`;
 document.querySelectorAll<HTMLButtonElement>('[data-square]').forEach(b => b.onclick = () => click(Number(b.dataset.square)));
 on('rules', () => dialog('help').showModal());
 on('close', () => dialog('help').close());
 on('flip', () => { flipped = !flipped; render(); document.querySelector<HTMLButtonElement>('#flip')!.focus(); });
 on('restart', () => dialog('reset').showModal());
 on('cancel', () => dialog('reset').close());
 on('promotion-cancel', () => dialog('promotion').close());
 on('confirm', () => { state = initial(); selected = null; lastMove = null; handoff = false; flipped = false; render(52); });
 on('ready', () => {
  handoff = false;
  const moves = legal(state);
  if (moves.forced) selected = moves.moves[0].from;
  render(selected ?? (state.turn === 'w' ? 52 : 12));
 });
 if (handoff) document.querySelector<HTMLButtonElement>('#ready')?.focus({ preventScroll: true });
 else if (focusSquare !== undefined) document.querySelector<HTMLButtonElement>(`[data-square="${focusSquare}"]`)?.focus({ preventScroll: true });
}
function on(id: string, fn: () => void) { const el = document.getElementById(id); if (el) el.onclick = fn; }
function dialog(id: string) { return document.getElementById(id) as HTMLDialogElement; }
function click(i: number) {
 if (handoff || state.result) return;
 const moves = legal(state);
 const options = moves.moves.filter(m => m.from === selected && m.to === i);
 if (!options.length) {
  selected = selected === i ? null : moves.moves.some(m => m.from === i) ? i : null;
  render(i);
  return;
 }
 if (options[0].promote) {
  document.getElementById('choices')!.innerHTML = options.map(m => `<button data-promote="${m.promote}">${pieceSvg(m.promote!, state.turn)}<span>${names[m.promote!]}</span></button>`).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-promote]').forEach(b => b.onclick = () => finish(options.find(m => m.promote === b.dataset.promote)!));
  dialog('promotion').showModal();
 } else finish(options[0]);
}
function finish(m: Move) {
 state = play(state, m);
 lastMove = m;
 selected = null;
 handoff = !state.result;
 render(state.result ? m.to : undefined);
}
render();
