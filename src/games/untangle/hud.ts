/**
 * HTML/CSS overlay UI for the Untangle game. Keeping the HUD and modal in the
 * DOM (instead of drawing text on the canvas) means it renders at native
 * device resolution — crisp on Retina — and is easy to style and animate.
 */
export interface Hud {
  setLevel(n: number): void;
  setStatus(text: string, solved: boolean): void;
  showWin(level: number): void;
  hideWin(): void;
  destroy(): void;
  onShuffle: (() => void) | null;
  onNext: (() => void) | null;
  onHub: (() => void) | null;
}

export function createHud(): Hud {
  const overlay = document.createElement('div');
  overlay.className = 'ug-overlay';
  overlay.innerHTML = `
    <div class="ug-bar">
      <span class="ug-level" id="ug-level">Level 1</span>
      <span class="ug-status" id="ug-status">—</span>
    </div>
    <button class="ug-btn ug-shuffle" id="ug-shuffle">↻ Shuffle</button>
    <div class="ug-modal" id="ug-modal" hidden>
      <div class="ug-card">
        <div class="ug-emoji">🎉</div>
        <h2>Untangled!</h2>
        <p id="ug-modal-sub">Level complete</p>
        <div class="ug-actions">
          <button class="ug-btn ug-primary" id="ug-next">Next level →</button>
          <button class="ug-btn" id="ug-hub">Back to hub</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const levelEl = overlay.querySelector<HTMLElement>('#ug-level')!;
  const statusEl = overlay.querySelector<HTMLElement>('#ug-status')!;
  const modalEl = overlay.querySelector<HTMLElement>('#ug-modal')!;
  const subEl = overlay.querySelector<HTMLElement>('#ug-modal-sub')!;
  const shuffleBtn = overlay.querySelector<HTMLButtonElement>('#ug-shuffle')!;
  const nextBtn = overlay.querySelector<HTMLButtonElement>('#ug-next')!;
  const hubBtn = overlay.querySelector<HTMLButtonElement>('#ug-hub')!;

  const hud: Hud = {
    onShuffle: null,
    onNext: null,
    onHub: null,
    setLevel(n: number) {
      levelEl.textContent = `Level ${n}`;
    },
    setStatus(text: string, solved: boolean) {
      statusEl.textContent = text;
      statusEl.classList.toggle('solved', solved);
    },
    showWin(level: number) {
      subEl.textContent = `Level ${level} complete`;
      modalEl.hidden = false;
    },
    hideWin() {
      modalEl.hidden = true;
    },
    destroy() {
      overlay.remove();
    },
  };

  shuffleBtn.addEventListener('click', () => hud.onShuffle?.());
  nextBtn.addEventListener('click', () => hud.onNext?.());
  hubBtn.addEventListener('click', () => hud.onHub?.());

  return hud;
}
