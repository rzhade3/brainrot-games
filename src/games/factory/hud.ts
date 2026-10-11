import { Building, BuildingKind, BuildableKind, DESCRIPTIONS, Direction, DIRECTION_NAMES, isBuildingKind, isConveyor, isTool, NAMES, outputDirections, Point, Scenario, Tool } from './model';
import { DEFAULT_WORLD, FactoryWorld } from './world';
import {
  ASSEMBLE_TICKS, BELT_TICKS, BUFFER_CAPACITY, DEPOT_CAPACITY, EXTRACT_TICKS, FactorySummary,
  inventoryText, itemCount, ITEM_NAMES, MachineState, ObjectiveSummary, SMELT_TICKS, STEP_MS,
} from './simulation';

export type Action = Tool | 'remove' | 'recover' | 'rotate' | 'zoom-in' | 'zoom-out' | 'home' | 'pause' | 'close'
  | 'focus-copper' | 'focus-iron' | 'focus-outpost' | 'build-route' | 'swap-bend' | 'cancel-route' | 'undo-trail';

const ICONS: Record<BuildingKind | 'inspect' | 'remove', string> = {
  inspect: '<path d="m5 3 13 10-6 1-3 6z"/>',
  belt: '<path d="m3 8 9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/><path d="m8 8 4 2 4-2"/>',
  splitter: '<path d="m3 8 9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/><path d="m7 10 5 3 5-3M12 13V7m-2 2 2-2 2 2"/>',
  miner: '<path d="m4 9 8-5 8 5-8 5zM4 9v9l8 4 8-4V9M12 14v8M12 4V1"/><path d="m8 17 4 2"/>',
  furnace: '<path d="m4 10 8-4 8 4v9l-8 4-8-4zM4 10l8 4 8-4M12 14v9M14 7V2h4v7"/><path d="m7 14 2 1v4l-2-1z"/>',
  storage: '<path d="m3 8 9-5 9 5v10l-9 5-9-5zM3 8l9 5 9-5M12 13v10M7 10l9-5"/>',
  assembler: '<path d="m3 9 9-5 9 5v10l-9 5-9-5zM3 9l9 5 9-5M12 14v10M6 2v7M18 2v7M6 2h12"/><path d="m9 17 3 2 3-2"/>',
  outpost: '<path d="m3 9 9-5 9 5v10l-9 5-9-5zM3 9l9 5 9-5M12 14v10M18 6V1l5 3-5 2"/><path d="m8 8 3 2 5-3"/>',
  remove: '<path d="M5 6h14M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7M14 10v7"/>',
};

export function icon(tool: BuildingKind | 'inspect' | 'remove'): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[tool]}</svg>`;
}

const ROTATE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 7a8 8 0 1 0 2 8M18 2v5h-5"/></svg>';
const BUILD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/></svg>';
const CATEGORIES = [
  { id: 'all', name: 'All' }, { id: 'production', name: 'Production' },
  { id: 'logistics', name: 'Logistics' }, { id: 'storage', name: 'Storage' },
] as const;
type Category = typeof CATEGORIES[number]['id'];
const CATALOG: { kind: BuildableKind; category: Exclude<Category, 'all'>; note: string; shortcut: string }[] = [
  { kind: 'miner', category: 'production', note: `${EXTRACT_TICKS * STEP_MS / 1000}s / ore · place on deposits`, shortcut: '3' },
  { kind: 'furnace', category: 'production', note: `Ore to plates · ${SMELT_TICKS * STEP_MS / 1000}s / plate`, shortcut: '4' },
  { kind: 'belt', category: 'logistics', note: `Directional transport · ${BELT_TICKS * STEP_MS / 1000}s / tile`, shortcut: '2' },
  { kind: 'splitter', category: 'logistics', note: 'Rear input · alternating straight / right outputs', shortcut: '8' },
  { kind: 'storage', category: 'storage', note: `Receives and holds ${DEPOT_CAPACITY} items`, shortcut: '5' },
  { kind: 'assembler', category: 'production', note: '2 iron + 1 copper → defense supply · 2s', shortcut: '7' },
];

export class FactoryHud {
  readonly root: HTMLElement;
  onAction: (action: Action) => void = () => {};
  onScenario: (scenario: Scenario, seed: string) => Promise<boolean> = async () => false;
  onResume: () => void = () => {};
  onRetrySave: () => void = () => {};
  onRetryLoad: () => void = () => {};
  onScenarioDialog: (open: boolean) => void = () => {};
  private status: HTMLElement;
  private inspector: HTMLElement;
  private inspectedBuilding: Building | null = null;
  private zoom: HTMLElement;
  private buildButton: HTMLButtonElement;
  private catalog: HTMLElement;
  private scrim: HTMLElement;
  private placement: HTMLElement;
  private category: Category = 'all';
  private abort = new AbortController();
  private footerObserver: ResizeObserver;
  private scenarioDialog: HTMLDialogElement;
  private scenario: Scenario | null = null;
  private pendingScenario: Scenario | null = null;
  private objectiveState: ObjectiveSummary | null = null;
  private recoveredCount = 0;
  private recoveredText = 'Empty';
  private savedScenario: Scenario | null = null;
  private loadMessage = 'Reading local save...';
  private loadBlocked = true;
  private existingSave = false;
  private scenarioBusy = false;
  private seed = '';
  private saveText = 'Reading local save...';
  private saveError = false;
  private saveRetry = false;
  private offlineText = 'Offline cache: checking...';
  private worldText = '';
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private desktopLayout = window.matchMedia('(min-width: 1000px) and (min-height: 561px)');

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'factory-ui';
    this.root.innerHTML = `
      <header class="factory-header">
        <a class="factory-back" href="../../" aria-label="Back to games">&larr;</a>
        <div class="factory-brand"><span class="factory-overline">AN AUTOMATION STUDY</span><h1>Pocket Factory<span class="factory-period">.</span></h1></div>
        <button class="factory-scenario-button" data-command="scenarios" aria-label="Choose scenario">Scenarios</button>
      </header>
      <aside class="factory-intro"><span class="factory-overline">FIELD NOTES</span><h2>A little industry.<br>A lot of possibility.</h2></aside>
      <details class="factory-objective" hidden>
        <summary><span class="factory-overline" id="factory-objective-stage">GUIDED RUN</span><strong id="factory-objective-title"></strong><span class="factory-objective-count" id="factory-objective-count" aria-live="polite"></span><span class="factory-details-toggle" aria-hidden="true">+</span></summary>
        <div class="factory-objective-body">
          <p id="factory-objective-guide"></p>
          <p class="factory-objective-rate" id="factory-objective-rate"></p>
          <p class="factory-objective-reward" id="factory-objective-reward"></p>
          <div class="factory-guide-actions"><button data-action="focus-copper">Find copper</button><button data-action="focus-iron">Find iron</button><button data-action="focus-outpost">Find outpost</button></div>
          <div class="factory-completion-actions" hidden><button data-command="continue">Continue building</button><button data-command="scenarios">Choose scenario</button></div>
        </div>
      </details>
      <dialog class="factory-scenario-dialog" aria-labelledby="factory-scenario-title"></dialog>
      <div class="factory-camera" aria-label="Camera controls">
        <button data-action="zoom-in" aria-label="Zoom in">+</button>
        <output id="factory-zoom" aria-label="Zoom level">100%</output>
        <button data-action="zoom-out" aria-label="Zoom out">&minus;</button>
        <span></span><button data-action="home" aria-label="Return to factory" title="Return to factory"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/></svg></button>
      </div>
      <section class="factory-inspector" aria-label="Selected building" hidden></section>
      <div class="factory-catalog-scrim" data-command="close-catalog" aria-hidden="true" hidden></div>
      <footer class="factory-footer">
        <section class="factory-catalog" id="factory-catalog" role="dialog" aria-modal="false" aria-labelledby="factory-catalog-title" hidden>
          <div class="factory-catalog-header"><div><h2 id="factory-catalog-title">Build</h2></div><button data-command="close-catalog" aria-label="Close build menu">&times;</button></div>
          <div class="factory-categories" role="tablist" aria-label="Building categories">
            ${CATEGORIES.map(category => `<button id="factory-tab-${category.id}" data-category="${category.id}" role="tab" aria-selected="${category.id === 'all'}" aria-controls="factory-category-${category.id}" tabindex="${category.id === 'all' ? 0 : -1}">${category.name}</button>`).join('')}
          </div>
          <div class="factory-catalog-scroll">
            ${CATEGORIES.map(category => `<div class="factory-catalog-grid" id="factory-category-${category.id}" role="tabpanel" aria-labelledby="factory-tab-${category.id}" ${category.id === 'all' ? '' : 'hidden'}>
              ${CATALOG.filter(entry => category.id === 'all' || entry.category === category.id).map(entry => `<button class="factory-building-card" data-action="${entry.kind}" aria-label="${NAMES[entry.kind]}">${icon(entry.kind)}<span><strong>${NAMES[entry.kind]}</strong><small>${entry.note}</small></span><kbd>${entry.shortcut}</kbd></button>`).join('')}
            </div>`).join('')}
          </div>
        </section>
        <div class="factory-placement" aria-label="Placement controls" hidden>
          <div class="factory-placement-machine" id="factory-placement-machine"></div>
          <button data-action="rotate" aria-label="Rotate placement clockwise" title="Rotate placement (R)">${ROTATE_ICON}<span>Rotate</span></button>
          <button data-action="inspect" aria-label="Cancel placement" title="Cancel placement (Esc)">&times;</button>
        </div>
        <div class="factory-route-controls" aria-label="Conveyor connection" hidden>
          <span id="factory-route-label" role="status">Choose a start</span>
          <button data-action="build-route" hidden>Build</button>
          <button data-action="swap-bend" hidden title="Use the other L-shaped bend">Swap bend</button>
          <button data-action="cancel-route" aria-label="Cancel conveyor route" title="Cancel route">&times;</button>
        </div>
        <div class="factory-status" hidden><span class="factory-status-dot"></span><span id="factory-status" role="status"></span></div>
        <div class="factory-save-warning" hidden><span id="factory-save-warning" role="alert"></span><button data-command="retry-save" hidden>Retry save</button></div>
        <nav class="factory-toolbar" aria-label="Construction tools">
          <button data-action="inspect" aria-label="Select" aria-pressed="true" title="Select (1)">${icon('inspect')}<span>Select</span><kbd>1</kbd></button>
          <button data-command="open-catalog" aria-label="Build" aria-pressed="false" aria-expanded="false" aria-controls="factory-catalog" aria-haspopup="dialog" title="Open construction catalog">${BUILD_ICON}<span>Build <span class="factory-build-chevron" aria-hidden="true">&#8963;</span></span></button>
          <button data-action="undo-trail" aria-label="Undo last conveyor route" title="Undo last route; cargo goes to the recovery tray." disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m9 4-6 6 6 6M3 10h11a6 6 0 0 1 0 12"/></svg></button>
          <button data-action="pause" aria-label="Pause factory" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><span id="factory-run-state">Pause</span></button>
        </nav>
      </footer>`;
    document.body.appendChild(this.root);
    this.status = this.root.querySelector<HTMLElement>('#factory-status')!;
    this.inspector = this.root.querySelector<HTMLElement>('.factory-inspector')!;
    this.zoom = this.root.querySelector<HTMLElement>('#factory-zoom')!;
    this.buildButton = this.root.querySelector<HTMLButtonElement>('[data-command="open-catalog"]')!;
    this.catalog = this.root.querySelector<HTMLElement>('.factory-catalog')!;
    this.scrim = this.root.querySelector<HTMLElement>('.factory-catalog-scrim')!;
    this.placement = this.root.querySelector<HTMLElement>('.factory-placement')!;
    this.scenarioDialog = this.root.querySelector<HTMLDialogElement>('.factory-scenario-dialog')!;
    this.scenarioDialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (this.scenario !== null) this.closeScenarios();
    }, { signal: this.abort.signal });
    this.desktopLayout.addEventListener('change', event => {
      if (!event.matches) this.root.querySelector<HTMLDetailsElement>('.factory-objective')!.open = false;
    }, { signal: this.abort.signal });
    const footer = this.root.querySelector<HTMLElement>('.factory-footer')!;
    const header = this.root.querySelector<HTMLElement>('.factory-header')!;
    const updateFooterBounds = () => {
      this.root.style.setProperty('--factory-footer-height', `${window.innerHeight - footer.getBoundingClientRect().top}px`);
      const controlsTop = Math.min(this.root.querySelector<HTMLElement>('.factory-toolbar')!.getBoundingClientRect().top,
        this.root.querySelector<HTMLElement>('.factory-save-warning')!.hidden ? Infinity : this.root.querySelector<HTMLElement>('.factory-save-warning')!.getBoundingClientRect().top,
        this.root.querySelector<HTMLElement>('.factory-route-controls')!.hidden ? Infinity : this.root.querySelector<HTMLElement>('.factory-route-controls')!.getBoundingClientRect().top,
        this.status.parentElement!.hidden ? Infinity : this.status.parentElement!.getBoundingClientRect().top,
        this.placement.hidden ? Infinity : this.placement.getBoundingClientRect().top);
      this.root.style.setProperty('--factory-controls-height', `${window.innerHeight - controlsTop}px`);
      this.root.style.setProperty('--factory-header-bottom', `${header.getBoundingClientRect().bottom}px`);
    };
    this.footerObserver = new ResizeObserver(updateFooterBounds);
    this.footerObserver.observe(footer);
    this.footerObserver.observe(header);
    window.addEventListener('resize', updateFooterBounds, { signal: this.abort.signal });
    updateFooterBounds();
    this.root.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action], [data-command], [data-category], [data-scenario]') : null;
      if (target instanceof HTMLButtonElement && target.disabled) return;
      if (target?.dataset.command === 'retry-save') {
        this.onRetrySave();
        return;
      }
      if (target?.dataset.command === 'retry-load') {
        this.onRetryLoad();
        return;
      }
      if (target?.dataset.command === 'resume-save') {
        this.scenario = this.savedScenario;
        this.closeScenarios();
        this.onResume();
        return;
      }
      if (target?.dataset.command === 'scenarios') {
        this.openScenarios();
        return;
      }
      if (target?.dataset.command === 'cancel-scenario') {
        this.closeScenarios();
        return;
      }
      if (target?.dataset.command === 'confirm-scenario' && this.pendingScenario) {
        void this.chooseScenario(this.pendingScenario);
        return;
      }
      if (target?.dataset.scenario === 'guided' || target?.dataset.scenario === 'free-play') {
        if (this.scenario === null && !this.existingSave) void this.chooseScenario(target.dataset.scenario);
        else {
          this.pendingScenario = target.dataset.scenario;
          this.renderScenarioDialog(true);
        }
        return;
      }
      if (target?.dataset.command === 'continue') {
        this.root.querySelector<HTMLDetailsElement>('.factory-objective')!.open = false;
        this.setStatus('Preparation complete. Keep experimenting; there are no raids or further orders yet.');
        this.root.querySelector<HTMLButtonElement>('.factory-toolbar [data-action="inspect"]')!.focus();
        return;
      }
      if (target?.dataset.command === 'open-catalog') {
        if (this.catalog.hidden) this.openCatalog();
        else this.closeCatalog();
        return;
      }
      if (target?.dataset.command === 'close-catalog') {
        this.closeCatalog();
        return;
      }
      const category = CATEGORIES.find(category => category.id === target?.dataset.category);
      if (category) {
        this.setCategory(category.id);
        return;
      }
      const button = target instanceof HTMLButtonElement ? target : null;
      const action = button?.dataset.action;
      if (action && (isTool(action) || action === 'remove' || action === 'recover' || action === 'rotate' || action === 'zoom-in' || action === 'zoom-out' ||
          action === 'home' || action === 'pause' || action === 'close' || action === 'focus-copper' || action === 'focus-iron' || action === 'focus-outpost' ||
          action === 'build-route' || action === 'swap-bend' || action === 'cancel-route' || action === 'undo-trail')) {
        const fromCatalog = this.catalog.contains(button);
        this.closeCatalog(false);
        if (!this.desktopLayout.matches && (action === 'focus-copper' || action === 'focus-iron' || action === 'focus-outpost')) {
          this.root.querySelector<HTMLDetailsElement>('.factory-objective')!.open = false;
        }
        this.onAction(action);
        if (fromCatalog) this.buildButton.focus({ preventScroll: true });
      }
    }, { signal: this.abort.signal });
    this.root.addEventListener('input', event => {
      if (event.target instanceof HTMLInputElement && event.target.id === 'factory-world-seed') this.seed = event.target.value;
    }, { signal: this.abort.signal });
    this.root.addEventListener('keydown', event => {
      if (this.scenarioDialog.open) {
        event.stopPropagation();
        return;
      }
      if (this.catalog.hidden || event.ctrlKey || event.metaKey || event.altKey) return;
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeCatalog();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable]')) return;
      const entry = CATALOG.find(entry => entry.shortcut === event.key);
      if (entry || event.key === '1') {
        event.preventDefault();
        this.closeCatalog(false);
        this.onAction(entry?.kind ?? 'inspect');
        this.buildButton.focus({ preventScroll: true });
        return;
      }
      if (event.target instanceof HTMLElement && event.target.getAttribute('role') === 'tab') {
        const index = CATEGORIES.findIndex(category => category.id === this.category);
        const next = event.key === 'ArrowRight' ? (index + 1) % CATEGORIES.length
          : event.key === 'ArrowLeft' ? (index + CATEGORIES.length - 1) % CATEGORIES.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? CATEGORIES.length - 1 : null;
        if (next !== null) {
          event.preventDefault();
          this.setCategory(CATEGORIES[next].id);
          this.root.querySelector<HTMLButtonElement>(`#factory-tab-${this.category}`)!.focus();
        }
      }
    }, { signal: this.abort.signal });
  }

  get choosingScenario(): boolean {
    return this.scenarioDialog.open;
  }

  openScenarios(): void {
    this.closeCatalog(false);
    this.pendingScenario = null;
    this.renderScenarioDialog(false);
    this.scenarioDialog.showModal();
    this.onScenarioDialog(true);
  }

  setSavedScenario(scenario: Scenario | null, message: string, blocked: boolean, existing: boolean): void {
    this.savedScenario = scenario;
    this.loadMessage = message;
    this.loadBlocked = blocked;
    this.existingSave = existing;
    if (this.scenarioDialog.open) this.renderScenarioDialog(!!this.pendingScenario);
  }

  setSaveStatus(text: string, error = false, retry = true): void {
    this.saveText = text;
    this.saveError = error;
    this.saveRetry = error && retry;
    const warning = this.root.querySelector<HTMLElement>('.factory-save-warning')!;
    warning.hidden = !error;
    this.root.querySelector<HTMLElement>('#factory-save-warning')!.textContent = error ? text : '';
    this.updateSaveDetails();
  }

  setOfflineStatus(text: string): void {
    this.offlineText = text;
    this.updateSaveDetails();
  }

  setWorld(world: FactoryWorld): void {
    this.worldText = `World ${world.size} x ${world.size} · Seed: ${world.seed}`;
    this.updateSaveDetails();
  }

  private updateSaveDetails(): void {
    const state = this.scenarioDialog.querySelector<HTMLElement>('#factory-save-state');
    if (state) {
      state.textContent = this.saveText;
      state.classList.toggle('factory-save-error', this.saveError);
    }
    const offline = this.scenarioDialog.querySelector<HTMLElement>('#factory-offline-state');
    if (offline) offline.textContent = this.offlineText;
    const world = this.scenarioDialog.querySelector<HTMLElement>('#factory-world-info');
    if (world) {
      world.textContent = this.worldText;
      world.hidden = !this.worldText;
    }
    const details = this.scenarioDialog.querySelector<HTMLDetailsElement>('.factory-save-details');
    if (details && this.saveError) details.open = true;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-command="retry-save"]')) {
      button.hidden = !this.saveRetry;
      button.disabled = this.scenarioBusy;
    }
  }

  private renderScenarioDialog(confirm: boolean): void {
    this.scenarioDialog.innerHTML = confirm ? `
      <h2 id="factory-scenario-title">Replace your factory?</h2>
      <p>Start ${this.pendingScenario === 'guided' ? 'Guided Run' : 'Free Play'} and replace all saved machines, items, and progress. Your current save stays intact if saving fails.</p>
      <div class="factory-dialog-actions"><button data-command="cancel-scenario" autofocus>Keep current factory</button><button data-command="confirm-scenario">Replace and start</button></div>` : `
      <h2 id="factory-scenario-title">Choose your factory</h2>
      ${this.savedScenario && !this.scenario ? `<button class="factory-resume-button" data-command="resume-save" autofocus>Resume ${this.savedScenario === 'guided' ? 'Guided Run' : 'Free Play'}</button>` : ''}
      <div class="factory-scenario-options">
        <button class="factory-scenario-card" data-scenario="guided" ${this.savedScenario ? '' : 'autofocus'} ${this.loadBlocked ? 'disabled' : ''}><strong>Guided Run</strong><span>Two supply missions. Learn production and unlock assembly.</span></button>
        <button class="factory-scenario-card" data-scenario="free-play" ${this.loadBlocked ? 'disabled' : ''}><strong>Free Play</strong><span>An empty site. All machines unlocked. Build your way.</span></button>
      </div>
      <label class="factory-seed-label" for="factory-world-seed">Free Play seed <span>(optional)</span></label>
      <input id="factory-world-seed" class="factory-seed-input" type="text" maxlength="64" placeholder="Random world" autocomplete="off" spellcheck="false" ${this.loadBlocked ? 'disabled' : ''}>
      <p class="factory-dialog-note">Free construction. No combat yet.</p>
      ${this.scenario ? '<button data-command="cancel-scenario">Back to current factory</button>' : ''}`;
    const message = document.createElement('p');
    message.className = 'factory-load-message';
    message.setAttribute('role', 'status');
    message.textContent = this.loadMessage;
    this.scenarioDialog.appendChild(message);
    const input = this.scenarioDialog.querySelector<HTMLInputElement>('#factory-world-seed');
    if (input) {
      input.value = this.seed;
      input.disabled ||= this.scenarioBusy;
    }
    if (this.loadBlocked) {
      const retry = document.createElement('button');
      retry.dataset.command = 'retry-load';
      retry.textContent = 'Retry loading save';
      this.scenarioDialog.appendChild(retry);
    }
    const details = document.createElement('details');
    details.className = 'factory-save-details';
    details.innerHTML = `<summary>Save &amp; offline</summary><div class="factory-save-body"><span id="factory-save-state" role="status"></span><button data-command="retry-save" hidden>Retry save</button><span id="factory-offline-state"></span><span id="factory-world-info"></span><p>Autosaved in this browser. No production while closed.</p></div>`;
    this.scenarioDialog.appendChild(details);
    this.updateSaveDetails();
    for (const button of this.scenarioDialog.querySelectorAll<HTMLButtonElement>('button')) {
      if (this.scenarioBusy) button.disabled = true;
    }
    if (this.scenarioDialog.open) this.scenarioDialog.querySelector<HTMLButtonElement>('[autofocus]:not(:disabled)')?.focus();
  }

  private closeScenarios(): void {
    if (this.scenarioBusy) return;
    if (this.scenario === null) {
      this.pendingScenario = null;
      this.renderScenarioDialog(false);
      return;
    }
    this.scenarioDialog.close();
    this.pendingScenario = null;
    this.onScenarioDialog(false);
    this.root.querySelector<HTMLButtonElement>('.factory-scenario-button')!.focus();
  }

  private async chooseScenario(scenario: Scenario): Promise<void> {
    if (this.scenarioBusy || this.loadBlocked) return;
    this.scenarioBusy = true;
    this.renderScenarioDialog(!!this.pendingScenario);
    const success = await this.onScenario(scenario, this.seed);
    this.scenarioBusy = false;
    if (success) {
      this.scenario = scenario;
      this.closeScenarios();
    } else this.renderScenarioDialog(!!this.pendingScenario);
  }

  private openCatalog(): void {
    this.onAction('inspect');
    this.catalog.hidden = false;
    this.scrim.hidden = false;
    this.buildButton.setAttribute('aria-expanded', 'true');
    this.root.querySelector<HTMLButtonElement>('.factory-toolbar [data-action="inspect"]')!.setAttribute('aria-pressed', 'false');
    this.root.querySelector<HTMLButtonElement>(`#factory-tab-${this.category}`)!.focus({ preventScroll: true });
  }

  private closeCatalog(restoreFocus = true): void {
    const wasOpen = !this.catalog.hidden;
    this.catalog.hidden = true;
    this.scrim.hidden = true;
    this.buildButton.setAttribute('aria-expanded', 'false');
    if (wasOpen) this.root.querySelector<HTMLButtonElement>('.factory-toolbar [data-action="inspect"]')!.setAttribute('aria-pressed', 'true');
    if (wasOpen && restoreFocus) this.buildButton.focus({ preventScroll: true });
  }

  private setCategory(category: Category): void {
    this.category = category;
    for (const entry of CATEGORIES) {
      const selected = entry.id === category;
      const button = this.root.querySelector<HTMLButtonElement>(`#factory-tab-${entry.id}`)!;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      this.root.querySelector<HTMLElement>(`#factory-category-${entry.id}`)!.hidden = !selected;
    }
    this.root.querySelector<HTMLElement>('.factory-catalog-scroll')!.scrollTop = 0;
  }

  setTool(tool: Tool, direction: Direction, hasSelection: boolean): void {
    this.closeCatalog(false);
    this.root.classList.toggle('has-selection', hasSelection);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('.factory-toolbar button[data-action="inspect"]')) {
      button.setAttribute('aria-pressed', String(button.dataset.action === tool));
    }
    const building = isBuildingKind(tool);
    this.buildButton.setAttribute('aria-pressed', String(building));
    this.placement.hidden = !building || tool === 'belt';
    this.root.querySelector<HTMLElement>('.factory-route-controls')!.hidden = tool !== 'belt';
    if (building) {
      this.root.querySelector<HTMLElement>('#factory-placement-machine')!.innerHTML =
        `${icon(tool)}<div><span class="factory-overline">PLACING ${NAMES[tool].toUpperCase()}</span><strong>${tool === 'splitter'
          ? `Outputs ${outputDirections({ c: 0, r: 0, kind: tool, direction }).map(output => DIRECTION_NAMES[output]).join(' / ')}`
          : `Output faces ${DIRECTION_NAMES[direction]}`}</strong></div>`;
    }
  }

  setStatus(text: string, invalid = false): void {
    if (this.statusTimer !== null) clearTimeout(this.statusTimer);
    this.status.textContent = text;
    this.status.parentElement!.hidden = !text;
    this.status.parentElement?.classList.toggle('invalid', invalid);
    if (text && !invalid) this.statusTimer = setTimeout(() => {
      this.status.parentElement!.hidden = true;
      this.statusTimer = null;
    }, 4500);
  }

  setUndo(undoCount: number): void {
    const undo = this.root.querySelector<HTMLButtonElement>('[data-action="undo-trail"]')!;
    undo.disabled = !undoCount;
    undo.setAttribute('aria-label', `Undo last conveyor route${undoCount ? ` (${undoCount} belts)` : ''}`);
  }

  setRouteControls(state: {
    enabled: boolean; anchored: boolean; ready: boolean; mobile: boolean;
    count: number; canSwap: boolean; error: string | null;
  }): void {
    const controls = this.root.querySelector<HTMLElement>('.factory-route-controls')!;
    controls.hidden = !state.enabled;
    controls.classList.toggle('invalid', !!state.error && state.error !== 'Already connected');
    const label = controls.querySelector<HTMLElement>('#factory-route-label')!;
    label.textContent = state.error ?? (!state.anchored ? 'Choose a start' : !state.ready && state.mobile
      ? 'Tap destination' : !state.count ? 'Choose destination' : state.mobile ? `${state.count} belts`
        : `${state.count} belts · click to connect`);
    const build = controls.querySelector<HTMLButtonElement>('[data-action="build-route"]')!;
    build.hidden = !state.mobile || !state.ready || !!state.error;
    build.disabled = !!state.error || !state.count;
    build.textContent = `Build ${state.count} belts`;
    if (!build.hidden && !state.error) label.textContent = '';
    label.hidden = !label.textContent;
    controls.querySelector<HTMLButtonElement>('[data-action="swap-bend"]')!.hidden = !state.canSwap;
    controls.querySelector<HTMLButtonElement>('[data-action="cancel-route"]')!.hidden = !state.anchored;
  }

  setZoom(value: number): void {
    this.zoom.textContent = `${Math.round(value * 100)}%`;
  }

  mapCenter(): Point {
    const header = this.root.querySelector<HTMLElement>('.factory-header')!.getBoundingClientRect();
    const footer = this.root.querySelector<HTMLElement>('.factory-footer')!.getBoundingClientRect();
    const top = header.bottom + 12;
    const bottom = Math.max(top, footer.top - 12);
    return { x: window.innerWidth / 2, y: (top + bottom) / 2 };
  }

  inspect(building: Building | null): void {
    const focusInInspector = this.inspector.contains(document.activeElement);
    const recoveryOpen = this.inspectedBuilding === building &&
      (this.inspector.querySelector<HTMLDetailsElement>('.factory-depot-recovery')?.open ?? false);
    this.inspectedBuilding = building;
    this.inspector.hidden = !building;
    this.root.classList.toggle('has-selection', !!building);
    if (!building) {
      if (focusInInspector) this.root.querySelector<HTMLButtonElement>('.factory-toolbar [data-action="inspect"]')!.focus({ preventScroll: true });
      return;
    }
    const focused = document.activeElement instanceof HTMLButtonElement && this.inspector.contains(document.activeElement)
      ? document.activeElement.dataset.action : null;
    this.inspector.innerHTML = `
      <button class="factory-inspector-close" data-action="close" aria-label="Close inspector">&times;</button>
      <span class="factory-overline">${building.c}, ${building.r}</span>
      <div class="factory-inspector-title">${icon(building.kind)}<h2>${NAMES[building.kind]}</h2></div>
      <dl>
        ${building.kind === 'outpost' ? '<div><dt>Position</dt><dd>Fixed receiver</dd></div>' : `<div><dt>${building.kind === 'splitter' ? 'Outputs' : building.kind === 'storage' ? 'Orientation' : 'Output faces'}</dt><dd>${outputDirections(building).length > 1
          ? outputDirections(building).map(direction => DIRECTION_NAMES[direction]).join(' / ') : DIRECTION_NAMES[building.direction]}</dd></div>`}
        ${building.kind === 'splitter' ? '<div><dt>Next preferred</dt><dd id="factory-next-output"></dd></div>' : ''}
        <div><dt>State</dt><dd id="factory-machine-state"></dd></div>
        <div><dt>${building.kind === 'storage' ? 'Stored' : isConveyor(building.kind) ? 'Cargo' : 'Input'}</dt><dd id="factory-machine-input"></dd></div>
        ${building.kind === 'miner' || building.kind === 'furnace' || building.kind === 'assembler' ? '<div><dt>Output</dt><dd id="factory-machine-output"></dd></div>' : ''}
      </dl>
      <div class="factory-progress-label"><span id="factory-progress-label"></span><span id="factory-progress-value"></span></div>
      <div class="factory-progress" role="progressbar" aria-label="Machine progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
      ${building.kind === 'storage' ? `<details class="factory-depot-recovery" hidden ${recoveryOpen ? 'open' : ''}>
        <summary>Recovered items <output aria-label="Items available to recover"></output></summary>
        <p class="factory-recovered-items"></p>
        <small>Kept safely when buildings are removed or routes undone.</small>
        <button class="factory-recover-button" data-action="recover">Store items here</button>
        <p class="factory-recover-reason"></p>
      </details>` : ''}
      ${building.kind === 'outpost' ? '' : `<div class="factory-inspector-actions">
        <button class="factory-inspector-rotate" data-action="rotate" aria-label="Rotate selected building clockwise" title="Rotate selected building (R)">${ROTATE_ICON}<span>Rotate</span><kbd>R</kbd></button>
        <button class="factory-inspector-remove" data-action="remove" aria-label="Remove selected building" title="Remove this building. Its items go to the recovery tray.">${icon('remove')}<span>Remove</span></button>
      </div>`}
      <details class="factory-machine-help"><summary>About this machine</summary><p>${DESCRIPTIONS[building.kind]}</p></details>`;
    if (focused) {
      this.inspector.querySelector<HTMLButtonElement>(`[data-action="${focused}"]`)?.focus({ preventScroll: true });
    }
  }

  setMachine(machine: Readonly<MachineState>, status: string, paused: boolean, world: FactoryWorld = DEFAULT_WORLD): void {
    const kind = machine.building.kind;
    const state = this.inspector.querySelector<HTMLElement>('#factory-machine-state')!;
    state.textContent = paused ? 'Paused' : status;
    state.classList.toggle('factory-machine-blocked', /blocked|full|disconnected|incompatible/i.test(status));
    const input = this.inspector.querySelector<HTMLElement>('#factory-machine-input')!;
    input.textContent = isConveyor(kind) ? machine.item ? `1/1 · ${ITEM_NAMES[machine.item]}` : '0/1 · Empty'
      : `${itemCount(machine.input)}/${kind === 'storage' ? DEPOT_CAPACITY : BUFFER_CAPACITY} · ${inventoryText(machine.input)}`;
    const output = this.inspector.querySelector<HTMLElement>('#factory-machine-output');
    if (output) output.textContent = `${itemCount(machine.output)}/${BUFFER_CAPACITY} · ${inventoryText(machine.output)}`;
    if (kind === 'miner') input.textContent = `${world.at(machine.building).deposit === 'copper' ? 'Copper' : 'Iron'} deposit`;
    if (kind === 'assembler') input.textContent = `Iron ${machine.input['iron-plate']}/4 · Copper ${machine.input['copper-plate']}/4`;
    if (kind === 'splitter') this.inspector.querySelector<HTMLElement>('#factory-next-output')!.textContent =
      DIRECTION_NAMES[outputDirections(machine.building)[machine.nextOutput]];
    if (kind === 'outpost') input.textContent = this.objectiveState
      ? `${this.objectiveState.accepted}/${this.objectiveState.quantity} ${ITEM_NAMES[this.objectiveState.item].toLowerCase()} delivered`
      : 'No active order';
    const progress = kind === 'storage' ? itemCount(machine.input) / DEPOT_CAPACITY
      : kind === 'outpost' ? (this.objectiveState ? this.objectiveState.accepted / this.objectiveState.quantity : 0)
      : machine.progress / (kind === 'miner' ? EXTRACT_TICKS : kind === 'furnace' ? SMELT_TICKS : kind === 'assembler' ? ASSEMBLE_TICKS : BELT_TICKS);
    const percent = Math.round(progress * 100);
    this.inspector.querySelector<HTMLElement>('#factory-progress-label')!.textContent =
      kind === 'storage' ? 'Capacity used' : kind === 'outpost' ? 'Order delivered' : kind === 'assembler' ? 'Assembly cycle'
      : isConveyor(kind) ? 'Belt travel' : kind === 'miner' ? 'Extraction cycle' : 'Smelting cycle';
    this.inspector.querySelector<HTMLElement>('#factory-progress-value')!.textContent = `${percent}%`;
    this.inspector.querySelector<HTMLElement>('.factory-progress')!.setAttribute('aria-valuenow', String(percent));
    this.inspector.querySelector<HTMLElement>('.factory-progress > span')!.style.width = `${percent}%`;
    if (kind === 'storage') {
      const recovery = this.inspector.querySelector<HTMLDetailsElement>('.factory-depot-recovery')!;
      if (!this.recoveredCount && recovery.contains(document.activeElement)) {
        this.inspector.querySelector<HTMLButtonElement>('.factory-inspector-close')!.focus({ preventScroll: true });
      }
      recovery.hidden = !this.recoveredCount;
      if (!this.recoveredCount) recovery.open = false;
      recovery.querySelector<HTMLOutputElement>('output')!.textContent = String(this.recoveredCount);
      recovery.querySelector<HTMLElement>('.factory-recovered-items')!.textContent = this.recoveredText;
      const slots = DEPOT_CAPACITY - itemCount(machine.input);
      const count = Math.min(slots, this.recoveredCount);
      const reason = !slots ? 'Depot full. Recovered items remain safely stored.'
        : 'Storage only: depots cannot feed machines or fulfill orders.';
      const recover = this.inspector.querySelector<HTMLButtonElement>('[data-action="recover"]')!;
      recover.disabled = !count;
      recover.textContent = count ? `Store ${count} ${count === 1 ? 'item' : 'items'} here` : 'Depot full';
      recover.title = reason;
      this.inspector.querySelector<HTMLElement>('.factory-recover-reason')!.textContent = reason;
    }
  }

  setSummary(summary: FactorySummary): void {
    this.recoveredCount = itemCount(summary.recovered);
    this.recoveredText = inventoryText(summary.recovered);
    this.setObjective(summary.objective);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('.factory-building-card[data-action="assembler"]')) {
      button.disabled = !!summary.objective && !summary.objective.assemblerUnlocked;
      button.querySelector<HTMLElement>('small')!.textContent = button.disabled
        ? 'Locked · finish the copper mission' : '2 iron + 1 copper → supply · 2s';
    }
  }

  private setObjective(objective: ObjectiveSummary | null): void {
    const previous = this.objectiveState;
    this.objectiveState = objective;
    const details = this.root.querySelector<HTMLDetailsElement>('.factory-objective')!;
    details.hidden = !objective;
    this.root.classList.toggle('factory-guided', !!objective);
    if (!objective) return;
    if (!previous || previous.stage !== objective.stage) {
      details.open = objective.complete;
      this.root.querySelector<HTMLElement>('#factory-objective-title')!.textContent =
        objective.complete ? 'Missions complete' : objective.stage === 0 ? 'Deliver copper plates' : 'Deliver defense supplies';
      this.root.querySelector<HTMLElement>('#factory-objective-stage')!.textContent =
        objective.complete ? 'GUIDED RUN COMPLETE' : `MISSION ${objective.stage + 1} / 2`;
      this.root.querySelector<HTMLElement>('#factory-objective-guide')!.textContent = objective.complete
        ? 'Outpost supplied. Keep building; no raids are active.'
        : objective.stage === 0
        ? 'Copper extractor → smelter → outpost. Connect with conveyors; arrows face the next machine. Depots do not deliver.'
        : 'Feed 2 iron + 1 copper plate into an assembler. Route supplies to the outpost. Reroute plates before depots; depots have no output.';
      this.root.querySelector<HTMLElement>('#factory-objective-reward')!.textContent =
        objective.complete ? 'Deliveries were consumed, not stored as ammunition.'
        : objective.stage === 0 ? 'Unlocks the assembler' : 'Completes factory preparation';
      this.root.querySelector<HTMLElement>('.factory-completion-actions')!.hidden = !objective.complete;
      this.root.querySelector<HTMLElement>('.factory-guide-actions')!.hidden = objective.complete;
    }
    const count = this.root.querySelector<HTMLElement>('#factory-objective-count')!;
    const countText = `${objective.accepted} / ${objective.quantity} ${ITEM_NAMES[objective.item].toLowerCase()}`;
    if (count.textContent !== countText) count.textContent = countText;
    this.root.querySelector<HTMLElement>('#factory-objective-rate')!.textContent =
      `${objective.rate.toFixed(1)}/min · ${objective.windowSeconds < 30 ? `first ${objective.windowSeconds.toFixed(1)}s` : 'last 30s'}${objective.complete ? ' · final rate' : ''}`;
  }

  setPaused(paused: boolean): void {
    const button = this.root.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Resume factory' : 'Pause factory');
    this.root.querySelector<HTMLElement>('#factory-run-state')!.textContent = paused ? 'Resume' : 'Pause';
    button.querySelector('svg')!.innerHTML = paused ? '<path d="m8 5 11 7-11 7z"/>' : '<path d="M8 5v14M16 5v14"/>';
    this.root.classList.toggle('factory-is-paused', paused);
  }

  destroy(): void {
    this.abort.abort();
    if (this.statusTimer !== null) clearTimeout(this.statusTimer);
    this.footerObserver.disconnect();
    this.root.remove();
  }
}
