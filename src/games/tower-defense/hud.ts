/**
 * HTML/CSS overlay UI for Castle Defense. Like the Untangle HUD, keeping UI in
 * the DOM (not on the canvas) means crisp Retina text and easy styling. The
 * scene drives it through setters and receives player intent via callbacks.
 */
import { BUILD_ORDER, BUILDINGS, BuildingKind } from './buildings';

export interface Hud {
  setOre(ore: number): void;
  setEnergy(produced: number, demand: number): void;
  setWave(n: number, phase: 'prep' | 'wave', prepLeft: number, enemiesLeft: number): void;
  setCastleHp(hp: number, max: number): void;
  /** Reflect which building kinds are currently affordable + selected. */
  updateBuildMenu(ore: number, selected: BuildingKind | null): void;
  showGameOver(waves: number): void;
  hideGameOver(): void;
  destroy(): void;

  onSelectBuild: ((kind: BuildingKind) => void) | null;
  onStartWave: (() => void) | null;
  onRestart: (() => void) | null;
  onHub: (() => void) | null;
}

export function createHud(): Hud {
  const overlay = document.createElement('div');
  overlay.className = 'hud-overlay td-overlay';

  const buildButtons = BUILD_ORDER.map((kind) => {
    const d = BUILDINGS[kind];
    return `<button class="td-build" data-kind="${kind}">
      <span class="td-build-emoji">${d.emoji}</span>
      <span class="td-build-name">${d.name}</span>
      <span class="td-build-cost">⛏️${d.cost}</span>
    </button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="hud-bar td-top">
      <div class="td-stat"><span class="td-stat-label">Ore</span><span class="td-stat-val" id="td-ore">0</span></div>
      <div class="td-stat"><span class="td-stat-label">Energy</span><span class="td-stat-val" id="td-energy">0 / 0</span></div>
      <div class="td-stat td-wave-stat"><span class="td-stat-label" id="td-wave-label">Prep</span><span class="td-stat-val" id="td-wave">1</span></div>
    </div>

    <div class="td-castle">
      <span class="td-castle-label">🏰 Castle</span>
      <div class="td-hpbar"><div class="td-hpfill" id="td-hpfill"></div></div>
    </div>

    <div class="td-bottom">
      <div class="td-build-menu">${buildButtons}</div>
      <button class="game-btn td-primary" id="td-start">Start wave →</button>
    </div>

    <div class="td-modal" id="td-modal" hidden>
      <div class="td-card">
        <div class="td-emoji">💥</div>
        <h2>Castle destroyed</h2>
        <p id="td-modal-sub">You survived 0 waves</p>
        <div class="td-actions">
          <button class="game-btn td-primary" id="td-restart">Play again</button>
          <button class="game-btn" id="td-hub">Back to hub</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const oreEl = overlay.querySelector<HTMLElement>('#td-ore')!;
  const energyEl = overlay.querySelector<HTMLElement>('#td-energy')!;
  const waveEl = overlay.querySelector<HTMLElement>('#td-wave')!;
  const waveLabelEl = overlay.querySelector<HTMLElement>('#td-wave-label')!;
  const hpFillEl = overlay.querySelector<HTMLElement>('#td-hpfill')!;
  const startBtn = overlay.querySelector<HTMLButtonElement>('#td-start')!;
  const modalEl = overlay.querySelector<HTMLElement>('#td-modal')!;
  const subEl = overlay.querySelector<HTMLElement>('#td-modal-sub')!;
  const restartBtn = overlay.querySelector<HTMLButtonElement>('#td-restart')!;
  const hubBtn = overlay.querySelector<HTMLButtonElement>('#td-hub')!;
  const buildEls = [...overlay.querySelectorAll<HTMLButtonElement>('.td-build')];

  const hud: Hud = {
    onSelectBuild: null,
    onStartWave: null,
    onRestart: null,
    onHub: null,

    setOre(ore) {
      oreEl.textContent = String(Math.floor(ore));
    },
    setEnergy(produced, demand) {
      energyEl.textContent = `${Math.round(produced)} / ${Math.round(demand)}`;
      energyEl.classList.toggle('td-low', demand > produced);
    },
    setWave(n, phase, prepLeft, enemiesLeft) {
      if (phase === 'prep') {
        waveLabelEl.textContent = 'Prep';
        waveEl.textContent = `${Math.ceil(prepLeft)}s → W${n + 1}`;
        startBtn.hidden = false;
      } else {
        waveLabelEl.textContent = `Wave ${n}`;
        waveEl.textContent = `${enemiesLeft} left`;
        startBtn.hidden = true;
      }
    },
    setCastleHp(hp, max) {
      const pct = Math.max(0, Math.min(1, hp / max));
      hpFillEl.style.transform = `scaleX(${pct})`;
      hpFillEl.classList.toggle('td-crit', pct < 0.3);
    },
    updateBuildMenu(ore, selected) {
      for (const el of buildEls) {
        const kind = el.dataset.kind as BuildingKind;
        const affordable = ore >= BUILDINGS[kind].cost;
        el.classList.toggle('td-unaffordable', !affordable);
        el.classList.toggle('td-selected', selected === kind);
      }
    },
    showGameOver(waves) {
      subEl.textContent = `You survived ${waves} wave${waves === 1 ? '' : 's'}`;
      modalEl.hidden = false;
    },
    hideGameOver() {
      modalEl.hidden = true;
    },
    destroy() {
      overlay.remove();
    },
  };

  for (const el of buildEls) {
    el.addEventListener('click', () => hud.onSelectBuild?.(el.dataset.kind as BuildingKind));
  }
  startBtn.addEventListener('click', () => hud.onStartWave?.());
  restartBtn.addEventListener('click', () => hud.onRestart?.());
  hubBtn.addEventListener('click', () => hud.onHub?.());

  return hud;
}
