/**
 * HTML/CSS overlay UI for the endless Untangle game. Keeping the HUD in the DOM
 * (instead of drawing text on the canvas) means it renders at native device
 * resolution — crisp on Retina — and is easy to style and animate.
 */
export interface Hud {
  setScore(n: number): void;
  setDepth(n: number): void;
  setStatus(text: string, solved: boolean): void;
  /** Brief celebratory pulse when a cluster collapses into a super-node. */
  pulseCollapse(): void;
  destroy(): void;
  onShuffle: (() => void) | null;
}

export function createHud(): Hud {
  const overlay = document.createElement('div');
  overlay.className = 'ug-overlay';
  overlay.innerHTML = `
    <div class="ug-bar">
      <span class="ug-stat"><span class="ug-stat-label">Untangled</span><span class="ug-stat-val" id="ug-score">0</span></span>
      <span class="ug-stat"><span class="ug-stat-label">Depth</span><span class="ug-stat-val" id="ug-depth">0</span></span>
      <span class="ug-status" id="ug-status">—</span>
    </div>
    <button class="ug-btn ug-shuffle" id="ug-shuffle">↻ Shuffle</button>
  `;
  document.body.appendChild(overlay);

  const scoreEl = overlay.querySelector<HTMLElement>('#ug-score')!;
  const depthEl = overlay.querySelector<HTMLElement>('#ug-depth')!;
  const statusEl = overlay.querySelector<HTMLElement>('#ug-status')!;
  const shuffleBtn = overlay.querySelector<HTMLButtonElement>('#ug-shuffle')!;

  const hud: Hud = {
    onShuffle: null,
    setScore(n: number) {
      scoreEl.textContent = String(n);
    },
    setDepth(n: number) {
      depthEl.textContent = String(n);
    },
    setStatus(text: string, solved: boolean) {
      statusEl.textContent = text;
      statusEl.classList.toggle('solved', solved);
    },
    pulseCollapse() {
      scoreEl.classList.remove('ug-pop');
      // Force reflow so the animation restarts even on rapid collapses.
      void scoreEl.offsetWidth;
      scoreEl.classList.add('ug-pop');
    },
    destroy() {
      overlay.remove();
    },
  };

  shuffleBtn.addEventListener('click', () => hud.onShuffle?.());

  return hud;
}
