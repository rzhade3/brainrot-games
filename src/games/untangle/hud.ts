export interface Hud {
  setProgress(solved: number): void;
  setStatus(tangled: number): void;
  setBusy(busy: boolean): void;
  announceSelection(node: number, total: number, tangled: number): void;
  warnSave(): void;
  onNew: (() => void) | null;
  destroy(): void;
}
export function createHud(): Hud {
  const shell = document.querySelector<HTMLElement>('#untangle-app')!;
  shell.innerHTML = `
    <header class="ut-header"><a href="../../">← Arcade</a><h1>untangle<span aria-hidden="true">.</span></h1>
      <div class="ut-actions"><button id="ut-new" type="button">New puzzle</button><button id="ut-help" type="button" aria-label="How to play" aria-haspopup="dialog" aria-controls="ut-help-dialog">?</button></div></header>
    <main class="ut-main" aria-label="Untangle puzzle">
      <div class="ut-progress"><span id="ut-puzzle">Puzzle 1</span><span class="ut-crossings" id="ut-status" role="status" aria-live="polite"></span></div>
      <div class="ut-board" id="game-root"></div>
      <p id="ut-node-status" class="ut-sr-only" role="status" aria-live="polite"></p>
      <p class="ut-tip">Drag the dots until no strings cross.</p>
      <p id="ut-warning" role="status" hidden>Progress can’t be saved in this browser.</p>
    </main>
    <dialog id="ut-help-dialog" aria-labelledby="ut-help-title"><div class="ut-dialog-head"><h2 id="ut-help-title">How to play</h2><button id="ut-close" type="button" aria-label="Close help">×</button></div>
      <p>Drag the dots until no strings cross. Clear the web to reveal the next puzzle.</p>
      <ul class="ut-legend"><li><i class="ut-coral"></i>Coral strings cross another string.</li><li><i class="ut-mint"></i>Mint strings are clear of crossings.</li><li><i class="ut-selection"></i>A white ring marks the selected dot.</li><li><i class="ut-lime"></i>Lime means the web is clear.</li></ul>
      <p>Your puzzle saves as you play. New puzzle replaces only the current web.</p>
      <p class="ut-keyboard">Keyboard: Tab to the board. Enter selects the next dot; arrows move it. Hold Shift for larger steps.</p>
      <button id="ut-play" class="ut-primary" type="button">Let’s untangle</button></dialog>`;
  const $ = (id: string) => shell.querySelector<HTMLElement>(`#ut-${id}`)!;
  const dialog = $('help-dialog') as HTMLDialogElement;
  const hud: Hud = {
    onNew: null,
    setProgress(n) { $('puzzle').textContent = `Puzzle ${n + 1}`; },
    setStatus(n) {
      const clear = n === 0;
      const text = clear ? 'Web clear!' : `${n} tangled ${n === 1 ? 'string' : 'strings'}`;
      if ($('status').textContent !== text) $('status').textContent = text;
      $('status').classList.toggle('is-clear', clear);
    },
    announceSelection(node, total, tangled) { $('node-status').textContent = `Dot ${node} of ${total} selected. ${tangled} tangled strings.`; },
    setBusy(busy) { ($('new') as HTMLButtonElement).disabled = busy; },
    warnSave() { $('warning').hidden = false; },
    destroy() { shell.replaceChildren(); },
  };
  $('new').onclick = () => hud.onNew?.();
  $('help').onclick = () => dialog.showModal();
  const close = () => dialog.close();
  $('close').onclick = close; $('play').onclick = close;
  return hud;
}
