import { icon } from './assets/icons';
import { CATALOG, Item, ITEMS, WorkPriority, WORK_PRIORITIES } from './game/domain';
import { Building, DESCRIPTIONS, Direction, DIRECTION_NAMES, isBuildingKind, isConveyor, isTool, NAMES, outputDirections, Point, Tile, tileKey, Tool } from './game/model';
import { Resident, residentName, SettlementSave } from './game/settlement';
import {
  FactorySummary, inventoryText,
  ITEM_NAMES,
  itemCount,
  MachineInspection,
  STEP_MS, UPGRADED_EXTRACT_TICKS,
} from './game/simulation';
import { FactoryWorld } from './game/world';

export type Action = Tool | 'remove' | 'recover' | 'rotate' | 'zoom-in' | 'zoom-out' | 'home' | 'pause' | 'close'
  | 'focus-copper' | 'focus-iron' | 'build-route' | 'swap-bend' | 'cancel-route' | 'undo-trail'
  | 'machine-option' | 'focus-home';

const ROTATE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 7a8 8 0 1 0 2 8M18 2v5h-5"/></svg>';
const BUILD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/></svg>';
const CATEGORIES = [
  { id: 'all', name: 'All' }, { id: 'production', name: 'Production' },
  { id: 'logistics', name: 'Logistics' }, { id: 'storage', name: 'Storage' },
] as const;
type Category = typeof CATEGORIES[number]['id'];

export class FactoryHud {
  readonly root: HTMLElement;
  onAction: (action: Action) => void = () => {};
  onNewSettlement: (seed: string) => Promise<boolean> = async () => false;
  onResume: () => void = () => {};
  onRetrySave: () => void = () => {};
  onRetryLoad: () => void = () => {};
  onSettlementDialog: (open: boolean) => void = () => {};
  onHaulTarget: (target: Tile | null) => string | null = () => 'Delivery assignment is unavailable.';
  onResident: (id: number) => void = () => {};
  onWorkPriority: (priority: WorkPriority) => string | null = () => 'Work priority is unavailable.';
  onAssignmentDialog: (open: boolean) => void = () => {};
  private settlement: SettlementSave | null = null;
  private buildingChoices: ReadonlyMap<string, Building> = new Map();
  private residentId: number | null = null;
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
  private settlementDialog: HTMLDialogElement;
  private deliveryDialog: HTMLDialogElement;
  private deliveryInspection: MachineInspection | null = null;
  private deliverySource: Tile | null = null;
  private deliveryDraft: string | null = null;
  private deliveryRows = new Map<string, HTMLButtonElement>();
  private deliveryReturnFocus: HTMLElement | null = null;
  private activeSettlement = false;
  private pendingReplacement = false;
  private recoveredCount = 0;
  private recoveredText = 'Empty';
  private resumableSave = false;
  private loadMessage = 'Reading local save...';
  private loadBlocked = true;
  private existingSave = false;
  private settlementBusy = false;
  private seed = '';
  private saveText = 'Reading local save...';
  private saveError = false;
  private saveRetry = false;
  private offlineText = 'Offline cache: checking...';
  private worldText = '';
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'factory-ui';
    this.root.innerHTML = `
      <header class="factory-header">
        <a class="factory-back" href="../../" aria-label="Back to games">&larr;</a>
        <div class="factory-brand"><span class="factory-overline">AN AUTOMATION STUDY</span><h1>Pocket Factory<span class="factory-period">.</span></h1></div>
        <button class="factory-settlement-button" data-command="settlements" aria-label="Settlement menu">Settlement</button>
        <button class="factory-settlement-button factory-people-button" data-action="focus-home" hidden>People</button>
      </header>
      <aside class="factory-intro"><span class="factory-overline">FIELD NOTES</span><h2>A little community.<br>A lot of possibility.</h2></aside>
      <dialog class="factory-settlement-dialog" aria-labelledby="factory-settlement-title"></dialog>
      <dialog id="factory-delivery-picker" class="factory-delivery-dialog factory-picker-dialog" aria-labelledby="factory-delivery-title" aria-describedby="factory-delivery-note"></dialog>
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
    this.settlementDialog = this.root.querySelector<HTMLDialogElement>('.factory-settlement-dialog')!;
    this.deliveryDialog = this.root.querySelector<HTMLDialogElement>('.factory-delivery-dialog')!;
    this.deliveryDialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.closeDeliveryPicker();
    }, { signal: this.abort.signal });
    const updatePickerViewport = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      this.root.style.setProperty('--factory-picker-viewport', `${height}px`);
      this.root.classList.toggle('factory-picker-compact', height <= 420);
      this.root.style.setProperty('--factory-keyboard-inset', `${Math.max(0,
        window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    };
    window.visualViewport?.addEventListener('resize', updatePickerViewport, { signal: this.abort.signal });
    window.visualViewport?.addEventListener('scroll', updatePickerViewport, { signal: this.abort.signal });
    window.addEventListener('resize', updatePickerViewport, { signal: this.abort.signal });
    updatePickerViewport();
    this.settlementDialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (this.activeSettlement) this.closeSettlements();
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
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action], [data-command], [data-category]') : null;
      if (target instanceof HTMLButtonElement && target.disabled) return;
      if (target?.dataset.command === 'choose-delivery') {
        this.openDeliveryPicker();
        return;
      }
      if (target?.dataset.command === 'clear-delivery') {
        if (!this.onHaulTarget(null)) this.inspector.querySelector<HTMLButtonElement>('[data-command="choose-delivery"]')?.focus({ preventScroll: true });
        return;
      }
      if (target?.dataset.command === 'close-delivery-picker') {
        this.closeDeliveryPicker();
        return;
      }
      if (target?.dataset.command === 'pick-delivery') {
        this.deliveryDraft = target.dataset.deliveryTarget!;
        this.deliveryDialog.querySelector<HTMLElement>('#factory-delivery-error')!.textContent = '';
        this.updateDeliveryPicker();
        return;
      }
      if (target?.dataset.command === 'confirm-delivery' && this.deliveryDraft !== null) {
        const destination = this.deliveryInspection?.haul?.destinations.find(value => tileKey(value.building) === this.deliveryDraft);
        if (!destination) {
          this.deliveryDialog.querySelector<HTMLElement>('#factory-delivery-error')!.textContent = 'That destination is no longer available. Choose another destination.';
          return;
        }
        const error = this.onHaulTarget({ c: destination.building.c, r: destination.building.r });
        if (error) this.deliveryDialog.querySelector<HTMLElement>('#factory-delivery-error')!.textContent = error;
        else this.closeDeliveryPicker();
        return;
      }
      if (target?.dataset.command === 'work-priority') {
        const priority = WORK_PRIORITIES.find(value => value === target.dataset.priority);
        if (priority) {
          const error = this.onWorkPriority(priority);
          if (error) this.setStatus(error, true);
        }
        return;
      }
      if (target?.dataset.command === 'retry-save') {
        this.onRetrySave();
        return;
      }
      if (target?.dataset.command === 'retry-load') {
        this.onRetryLoad();
        return;
      }
      if (target?.dataset.command === 'resume-save') {
        if (!this.resumableSave || this.settlementBusy) return;
        this.activeSettlement = true;
        this.closeSettlements();
        this.onResume();
        return;
      }
      if (target?.dataset.command === 'settlements') {
        this.openSettlements();
        return;
      }
      if (target?.dataset.command === 'cancel-settlement') {
        this.closeSettlements();
        return;
      }
      if (target?.dataset.command === 'confirm-settlement' && this.pendingReplacement) {
        void this.startSettlement();
        return;
      }
      if (target?.dataset.command === 'new-settlement') {
        if (!this.activeSettlement && !this.existingSave) void this.startSettlement();
        else {
          this.pendingReplacement = true;
          this.renderSettlementDialog(true);
        }
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
          action === 'home' || action === 'pause' || action === 'close' || action === 'focus-copper' || action === 'focus-iron' ||
          action === 'build-route' || action === 'swap-bend' || action === 'cancel-route' || action === 'undo-trail' ||
          action === 'machine-option' || action === 'focus-home')) {
        const fromCatalog = this.catalog.contains(button);
        this.closeCatalog(false);
        this.onAction(action);
        if (fromCatalog) this.buildButton.focus({ preventScroll: true });
      }
    }, { signal: this.abort.signal });
    this.root.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-resident]') : null;
      if (target) this.onResident(Number(target.dataset.resident));
    }, { signal: this.abort.signal });
    this.root.addEventListener('input', event => {
      if (event.target instanceof HTMLInputElement && event.target.id === 'factory-world-seed') this.seed = event.target.value;
      if (event.target instanceof HTMLInputElement && event.target.id === 'factory-delivery-search') this.updateDeliveryPicker();
    }, { signal: this.abort.signal });
    this.root.addEventListener('keydown', event => {
      if (this.settlementDialog.open || this.choosingAssignment) {
        event.stopPropagation();
        if (this.choosingAssignment && event.key === 'Escape') {
          event.preventDefault();
          this.closeDeliveryPicker();
        }
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

  get choosingSettlement(): boolean {
    return this.settlementDialog.open;
  }

  get choosingAssignment(): boolean {
    return this.deliveryDialog.open;
  }

  openSettlements(): void {
    this.closeDeliveryPicker(false);
    this.closeCatalog(false);
    this.pendingReplacement = false;
    this.renderSettlementDialog(false);
    this.settlementDialog.showModal();
    this.onSettlementDialog(true);
  }

  setSavedSettlement(resumable: boolean, message: string, blocked: boolean, existing: boolean): void {
    this.resumableSave = resumable;
    this.loadMessage = message;
    this.loadBlocked = blocked;
    this.existingSave = existing;
    if (this.settlementDialog.open) this.renderSettlementDialog(this.pendingReplacement);
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
    const state = this.settlementDialog.querySelector<HTMLElement>('#factory-save-state');
    if (state) {
      state.textContent = this.saveText;
      state.classList.toggle('factory-save-error', this.saveError);
    }
    const offline = this.settlementDialog.querySelector<HTMLElement>('#factory-offline-state');
    if (offline) offline.textContent = this.offlineText;
    const world = this.settlementDialog.querySelector<HTMLElement>('#factory-world-info');
    if (world) {
      world.textContent = this.worldText;
      world.hidden = !this.worldText;
    }
    const details = this.settlementDialog.querySelector<HTMLDetailsElement>('.factory-save-details');
    if (details && this.saveError) details.open = true;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-command="retry-save"]')) {
      button.hidden = !this.saveRetry;
      button.disabled = this.settlementBusy;
    }
  }

  private renderSettlementDialog(confirm: boolean): void {
    this.settlementDialog.innerHTML = confirm ? `
      <h2 id="factory-settlement-title">Replace your settlement?</h2>
      <p>Start a new settlement and replace all saved buildings, items, residents, and progress. Older saves are not converted. Your current save stays intact if saving fails.</p>
      <div class="factory-dialog-actions"><button data-command="cancel-settlement" autofocus>Keep current save</button><button data-command="confirm-settlement">Replace and start</button></div>` : `
      <h2 id="factory-settlement-title">Your settlement</h2>
      ${this.resumableSave && !this.activeSettlement ? '<button class="factory-resume-button" data-command="resume-save" autofocus>Resume</button>' : ''}
      <div class="factory-settlement-options">
        <button class="factory-settlement-card" data-command="new-settlement" ${this.resumableSave ? '' : 'autofocus'} ${this.loadBlocked ? 'disabled' : ''}><strong>New settlement</strong><span>Four residents. Grow food, arrange deliveries, and free people with better logistics.</span></button>
      </div>
      <label class="factory-seed-label" for="factory-world-seed">World seed <span>(optional)</span></label>
      <input id="factory-world-seed" class="factory-seed-input" type="text" maxlength="64" placeholder="Random world" autocomplete="off" spellcheck="false" ${this.loadBlocked ? 'disabled' : ''}>
      <p class="factory-dialog-note">Free construction. No combat yet.</p>
      ${this.activeSettlement ? '<button data-command="cancel-settlement">Back to current settlement</button>' : ''}`;
    const message = document.createElement('p');
    message.className = 'factory-load-message';
    message.setAttribute('role', 'status');
    message.textContent = this.loadMessage;
    this.settlementDialog.appendChild(message);
    const input = this.settlementDialog.querySelector<HTMLInputElement>('#factory-world-seed');
    if (input) {
      input.value = this.seed;
      input.disabled ||= this.settlementBusy;
    }
    if (this.loadBlocked) {
      const retry = document.createElement('button');
      retry.dataset.command = 'retry-load';
      retry.textContent = 'Retry loading save';
      this.settlementDialog.appendChild(retry);
    }
    const details = document.createElement('details');
    details.className = 'factory-save-details';
    details.innerHTML = `<summary>Save &amp; offline</summary><div class="factory-save-body"><span id="factory-save-state" role="status"></span><button data-command="retry-save" hidden>Retry save</button><span id="factory-offline-state"></span><span id="factory-world-info"></span><p>Autosaved in this browser. No production while closed.</p></div>`;
    this.settlementDialog.appendChild(details);
    this.updateSaveDetails();
    for (const button of this.settlementDialog.querySelectorAll<HTMLButtonElement>('button')) {
      if (this.settlementBusy) button.disabled = true;
    }
    if (this.settlementDialog.open) this.settlementDialog.querySelector<HTMLButtonElement>('[autofocus]:not(:disabled)')?.focus();
  }

  private closeSettlements(): void {
    if (this.settlementBusy) return;
    if (!this.activeSettlement) {
      this.pendingReplacement = false;
      this.renderSettlementDialog(false);
      return;
    }
    this.settlementDialog.close();
    this.pendingReplacement = false;
    this.onSettlementDialog(false);
    this.root.querySelector<HTMLButtonElement>('.factory-settlement-button')!.focus();
  }

  private async startSettlement(): Promise<void> {
    if (this.settlementBusy || this.loadBlocked) return;
    this.settlementBusy = true;
    this.renderSettlementDialog(this.pendingReplacement);
    const success = await this.onNewSettlement(this.seed);
    this.settlementBusy = false;
    if (success) {
      this.activeSettlement = true;
      this.closeSettlements();
    } else this.renderSettlementDialog(this.pendingReplacement);
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
          : tool === 'miner' ? `Ore deposit · ${DIRECTION_NAMES[direction]} output`
            : tool === 'woodcutting-site' ? 'Clear land beside a grove'
              : tool === 'kitchen' ? 'Keep adjacent land clear' : `Output faces ${DIRECTION_NAMES[direction]}`}</strong></div>`;
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
    this.closeDeliveryPicker(false);
    this.deliveryInspection = null;
    this.residentId = null;
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
        ${building.kind === 'home' || building.kind === 'kitchen' ? '' : `<div><dt>${building.kind === 'splitter' ? 'Outputs' : 'Output faces'}</dt><dd>${outputDirections(building).length > 1
          ? outputDirections(building).map(direction => DIRECTION_NAMES[direction]).join(' / ') : DIRECTION_NAMES[building.direction]}</dd></div>`}
        ${building.kind === 'splitter' ? '<div><dt>Next preferred</dt><dd id="factory-next-output"></dd></div>' : ''}
        ${building.kind === 'home' ? '' : '<div><dt>Activity</dt><dd id="factory-machine-state"></dd></div>'}
        ${building.kind === 'woodcutting-site' || building.kind === 'food-plot' ? '' : `<div><dt>${building.kind === 'storage' ? 'Stored' : isConveyor(building.kind) ? 'Cargo'
          : building.kind === 'miner' ? 'Source'
            : building.kind === 'home' ? 'Residents' : building.kind === 'kitchen' ? 'Food' : 'Input'}</dt><dd id="factory-machine-input"></dd></div>
        `}
        ${building.kind === 'miner' || building.kind === 'furnace' || building.kind === 'assembler' || building.kind === 'food-plot' || building.kind === 'woodcutting-site'
          ? `<div><dt>${building.kind === 'food-plot' ? 'Ready' : 'Output'}</dt><dd id="factory-machine-output"></dd></div>` : ''}
        ${building.kind === 'furnace' || building.kind === 'assembler' ? '<div><dt>Recipe</dt><dd id="factory-machine-recipe"></dd></div>' : ''}
        ${building.kind === 'home' ? ''
          : `<div id="factory-machine-pace-row"><dt>${building.kind === 'kitchen' ? 'Serving' : 'Pace'}</dt><dd id="factory-machine-pace"></dd></div>`}
      </dl>
      ${building.kind === 'home' ? '' : `<div class="factory-progress-label"><span id="factory-progress-label"></span><span id="factory-progress-value"></span></div>
      <div class="factory-progress" role="progressbar" aria-label="Machine progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>`}
      ${building.kind === 'storage' ? `<details class="factory-depot-recovery" hidden ${recoveryOpen ? 'open' : ''}>
        <summary>Recovered items <output aria-label="Items available to recover"></output></summary>
        <p class="factory-recovered-items"></p>
        <small>Kept safely when buildings are removed or routes undone.</small>
        <button class="factory-recover-button" data-action="recover">Store items here</button>
        <p class="factory-recover-reason"></p>
      </details>` : ''}
      ${building.kind === 'storage' ? '<p class="factory-depot-next" hidden></p>' : ''}
      ${building.kind === 'miner' ? '<button class="factory-machine-option" data-action="machine-option"></button>' : ''}
      ${this.settlement && !isConveyor(building.kind) && !['home', 'kitchen'].includes(building.kind) ? `
        <section class="factory-labor-card factory-assignment-card" aria-label="Automatic staffing">
          <span class="factory-overline">WORK PRIORITY</span>
          <div class="factory-work-priorities" role="group" aria-label="Work priority">
            ${WORK_PRIORITIES.map(priority => `<button data-command="work-priority" data-priority="${priority}" aria-pressed="${priority === (building.workPriority ?? 'normal')}">${priority[0].toUpperCase()}${priority.slice(1)}</button>`).join('')}
          </div>
          <p id="factory-staffing" role="status"></p>
          <small>Shared labor for ${building.kind === 'food-plot' || building.kind === 'woodcutting-site' ? 'production and deliveries' : 'deliveries only'}.</small>
        </section>` : ''}
      ${this.settlement ? `
        <section class="factory-delivery-card factory-assignment-card" aria-label="Resident deliveries" hidden>
          <span class="factory-overline">DELIVER TO</span>
          <div class="factory-assignment-identity"><span class="factory-assignment-avatar" hidden></span>
            <div><strong id="factory-delivery-name">No destination chosen</strong><span id="factory-delivery-state"></span></div></div>
          <div class="factory-assignment-actions"><button data-command="choose-delivery" aria-haspopup="dialog" aria-controls="factory-delivery-picker">Choose destination</button>
            <button data-command="clear-delivery" hidden>Stop deliveries</button></div>
        </section>` : ''}
      ${building.kind === 'home' ? '<div class="factory-resident-list"></div>' : ''}
      ${building.kind === 'home' ? '' : `<div class="factory-inspector-actions">
        <button class="factory-inspector-rotate" data-action="rotate" aria-label="Rotate selected building clockwise" title="Rotate selected building (R)">${ROTATE_ICON}<span>Rotate</span><kbd>R</kbd></button>
        <button class="factory-inspector-remove" data-action="remove" aria-label="Remove selected building" title="Remove this building. Its items go to the recovery tray.">${icon('remove')}<span>Remove</span></button>
      </div>`}
      <details class="factory-machine-help"><summary>Field notes</summary><p>${DESCRIPTIONS[building.kind]}</p>
        ${this.settlement && ['storage', 'miner', 'furnace', 'assembler'].includes(building.kind)
          ? '<p>Residents carry one item at a time; leave access beside both buildings. A connected conveyor frees carriers.</p>' : ''}</details>`;
    if (focused) {
      this.inspector.querySelector<HTMLButtonElement>(`[data-action="${focused}"]`)?.focus({ preventScroll: true });
    }
  }

  inspectResident(resident: Resident): void {
    this.closeDeliveryPicker(false);
    this.deliveryInspection = null;
    this.inspectedBuilding = null;
    this.residentId = resident.id;
    this.inspector.hidden = false;
    this.root.classList.add('has-selection');
    this.inspector.innerHTML = `<button class="factory-inspector-close" data-action="close" aria-label="Close inspector">&times;</button>
      <span class="factory-overline">RESIDENT</span><h2>${residentName(resident.id)}</h2>
      <dl><div><dt>Activity</dt><dd id="factory-resident-activity"></dd></div>
      <div><dt>Position</dt><dd id="factory-resident-position"></dd></div>
      <div><dt>Destination</dt><dd id="factory-resident-destination"></dd></div>
      <div><dt>Carrying</dt><dd id="factory-resident-cargo"></dd></div></dl>
      <details class="factory-machine-help"><summary>Field notes</summary><p>Choose work priorities and deliveries at buildings. Residents finish their harvest or cargo trip before choosing new work.</p></details>`;
    this.updateResident(resident);
  }

  private updateResident(resident: Resident): void {
    this.inspector.querySelector<HTMLElement>('#factory-resident-activity')!.textContent = this.residentActivity(resident);
    this.inspector.querySelector<HTMLElement>('#factory-resident-position')!.textContent = `${resident.tile.c}, ${resident.tile.r}`;
    const target = resident.job?.kind === 'gather' ? resident.job.tree
      : resident.job?.kind === 'deliver' ? resident.job.destination : resident.job?.source;
    const building = target && this.buildingChoices.get(tileKey(target));
    this.inspector.querySelector<HTMLElement>('#factory-resident-destination')!.textContent = target
      ? `${resident.job?.kind === 'gather' ? 'Tree · ' : building ? `${NAMES[building.kind]} · ` : ''}${target.c}, ${target.r}` : 'None';
    this.inspector.querySelector<HTMLElement>('#factory-resident-cargo')!.textContent = resident.cargo ? `1 ${ITEM_NAMES[resident.cargo]}` : 'Empty';
  }

  private residentActivity(resident: Resident): string {
    if (!resident.job) return resident.note;
    if (resident.job.kind === 'gather' || resident.job.kind === 'return-wood') return resident.note;
    if (resident.job.kind === 'farm') return resident.note === 'Farming' ? 'Growing food'
      : resident.job.path.length ? 'On the way to the plot' : resident.note;
    const item = resident.job.item === 'food-unit' ? 'food'
      : resident.job.item ? ITEM_NAMES[resident.job.item].toLowerCase() : 'items';
    if (resident.job.kind === 'collect') return `Collecting ${item}`;
    const destination = resident.job.destination && this.buildingChoices.get(tileKey(resident.job.destination));
    return destination ? `Taking ${item} to the ${destination.kind === 'kitchen' ? 'kitchen' : NAMES[destination.kind].toLowerCase()}`
      : `Carrying ${item}`;
  }

  private setText(element: HTMLElement, text: string): void {
    if (element.textContent !== text) element.textContent = text;
  }

  private deliveryItemsText(items: readonly Item[]): string {
    return items.length === ITEMS.length ? 'matching stock' : items.map(item => ITEM_NAMES[item].toLowerCase()).join(' or ');
  }

  private updateDeliveryCard(): void {
    const card = this.inspector.querySelector<HTMLElement>('.factory-delivery-card');
    const inspection = this.deliveryInspection;
    if (!card || !inspection) return;
    card.hidden = !inspection.haul;
    if (!inspection.haul) return;
    const target = inspection.machine.building.haulTo;
    const destination = target && this.buildingChoices.get(tileKey(target));
    this.setText(card.querySelector<HTMLElement>('#factory-delivery-name')!, destination
      ? `${NAMES[destination.kind]} · ${destination.c}, ${destination.r}` : target ? 'Destination missing' : 'No destination chosen');
    const avatar = card.querySelector<HTMLElement>('.factory-assignment-avatar')!;
    const avatarKey = destination ? `${tileKey(destination)}:${destination.kind}` : '';
    if (avatar.dataset.destination !== avatarKey) {
      avatar.innerHTML = destination ? icon(destination.kind) : '';
      avatar.dataset.destination = avatarKey;
    }
    avatar.hidden = !destination;
    const choice = target && inspection.haul.destinations.find(value => tileKey(value.building) === tileKey(target));
    const activity = card.querySelector<HTMLElement>('#factory-delivery-state')!;
    this.setText(activity, inspection.haul.error ?? (choice?.full ? 'Full; deliveries wait for space.'
      : target ? `Residents carry ${this.deliveryItemsText(choice?.items ?? inspection.haul.items)} here.`
        : 'Choose where residents carry goods.'));
    activity.classList.toggle('factory-delivery-invalid', !!inspection.haul.error);
    this.setText(card.querySelector<HTMLButtonElement>('[data-command="choose-delivery"]')!, target ? 'Change' : 'Choose destination');
    card.querySelector<HTMLButtonElement>('[data-command="clear-delivery"]')!.hidden = !target;
  }

  private openDeliveryPicker(): void {
    const inspection = this.deliveryInspection;
    if (!inspection?.haul || !this.inspectedBuilding) return;
    this.closeCatalog(false);
    this.deliverySource = { c: this.inspectedBuilding.c, r: this.inspectedBuilding.r };
    this.deliveryDraft = null;
    this.deliveryRows.clear();
    this.deliveryReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.deliveryDialog.innerHTML = `
      <header class="factory-picker-header"><div><span class="factory-overline">${NAMES[this.inspectedBuilding.kind]} · ${this.deliverySource.c}, ${this.deliverySource.r}</span>
        <h2 id="factory-delivery-title">Choose a destination</h2></div><button data-command="close-delivery-picker" aria-label="Close delivery picker">&times;</button></header>
      <div class="factory-picker-body">
        <p id="factory-delivery-note" class="factory-picker-note">Only destinations that accept this source's goods are shown. Full destinations stay selectable.</p>
        <label class="factory-picker-search" for="factory-delivery-search">Search by building or coordinates<input id="factory-delivery-search" type="search" autocomplete="off" placeholder="Depot or 15, 10"></label>
        <div class="factory-picker-filters"><span>Compatible destinations</span><span id="factory-delivery-count" role="status"></span></div>
        <div class="factory-picker-results" aria-label="Delivery destinations"><p class="factory-picker-empty" hidden></p></div>
      </div>
      <footer class="factory-picker-footer"><p id="factory-delivery-preview" class="factory-picker-preview">Choose a destination to review this delivery route.</p>
        <p id="factory-delivery-error" class="factory-picker-error" role="alert"></p><div><button data-command="close-delivery-picker">Cancel</button>
          <button data-command="confirm-delivery" disabled>Set destination</button></div></footer>`;
    this.updateDeliveryPicker();
    this.deliveryDialog.showModal();
    this.onAssignmentDialog(true);
    const initial = window.matchMedia('(max-width: 700px), (max-height: 560px)').matches
      ? this.deliveryDialog.querySelector<HTMLButtonElement>('[aria-label="Close delivery picker"]')!
      : this.deliveryDialog.querySelector<HTMLInputElement>('#factory-delivery-search')!;
    initial.focus({ preventScroll: true });
  }

  private closeDeliveryPicker(restoreFocus = true): void {
    if (!this.deliveryDialog.open) return;
    this.deliveryDialog.close();
    this.deliverySource = null;
    this.deliveryDraft = null;
    this.onAssignmentDialog(false);
    if (restoreFocus && this.deliveryReturnFocus?.isConnected) this.deliveryReturnFocus.focus({ preventScroll: true });
    this.deliveryReturnFocus = null;
  }

  private updateDeliveryPicker(): void {
    const inspection = this.deliveryInspection;
    if (!this.deliverySource || !inspection?.haul || tileKey(inspection.machine.building) !== tileKey(this.deliverySource)) return;
    const results = this.deliveryDialog.querySelector<HTMLElement>('.factory-picker-results')!;
    const search = this.deliveryDialog.querySelector<HTMLInputElement>('#factory-delivery-search')!.value.trim().toLowerCase().replace(/\s*,\s*/g, ',');
    const current = inspection.machine.building.haulTo;
    const keys = new Set<string>();
    let count = 0;
    for (const destination of inspection.haul.destinations) {
      const target = destination.building;
      const key = tileKey(target);
      keys.add(key);
      let row = this.deliveryRows.get(key);
      if (!row) {
        row = document.createElement('button');
        row.className = 'factory-picker-row';
        row.dataset.command = 'pick-delivery';
        row.dataset.deliveryTarget = key;
        row.innerHTML = `${icon(target.kind)}<span><strong>${NAMES[target.kind]} · ${target.c}, ${target.r}</strong><span class="factory-picker-activity"></span><small class="factory-picker-workplace"></small></span><span class="factory-picker-choice" aria-hidden="true"></span>`;
        results.appendChild(row);
        this.deliveryRows.set(key, row);
      }
      const visible = `${NAMES[target.kind]} ${key}`.toLowerCase().includes(search);
      if (row.hidden === visible) row.hidden = !visible;
      const selected = this.deliveryDraft === key;
      if (row.getAttribute('aria-pressed') !== String(selected)) row.setAttribute('aria-pressed', String(selected));
      this.setText(row.querySelector<HTMLElement>('.factory-picker-activity')!, `Receives ${this.deliveryItemsText(destination.items)}`);
      this.setText(row.querySelector<HTMLElement>('.factory-picker-workplace')!, destination.full ? 'Full; deliveries wait for space' : 'Space available');
      this.setText(row.querySelector<HTMLElement>('.factory-picker-choice')!, selected ? 'Selected' : current && tileKey(current) === key ? 'Current' : 'Choose');
      if (visible) count++;
    }
    for (const [key, row] of this.deliveryRows) {
      if (keys.has(key)) continue;
      if (row === document.activeElement) this.deliveryDialog.querySelector<HTMLInputElement>('#factory-delivery-search')!.focus({ preventScroll: true });
      row.remove();
      this.deliveryRows.delete(key);
    }
    this.setText(this.deliveryDialog.querySelector<HTMLElement>('#factory-delivery-count')!, `${count} ${count === 1 ? 'destination' : 'destinations'}`);
    const empty = results.querySelector<HTMLElement>('.factory-picker-empty')!;
    empty.hidden = count > 0;
    this.setText(empty, search ? 'No destinations match. Try a building name or coordinates.'
      : 'No compatible destinations. Build a receiver for these goods.');
    const selected = inspection.haul.destinations.find(value => tileKey(value.building) === this.deliveryDraft);
    const alreadyCurrent = !!selected && !!current && tileKey(selected.building) === tileKey(current);
    const confirm = this.deliveryDialog.querySelector<HTMLButtonElement>('[data-command="confirm-delivery"]')!;
    const disabled = !selected || alreadyCurrent;
    if (confirm.disabled !== disabled) confirm.disabled = disabled;
    this.setText(this.deliveryDialog.querySelector<HTMLElement>('#factory-delivery-preview')!, selected
      ? alreadyCurrent ? 'This is already the current destination.'
        : `Residents will carry ${this.deliveryItemsText(selected.items)} to ${NAMES[selected.building.kind]} · ${selected.building.c}, ${selected.building.r}.${selected.full ? ' Delivery waits for space.' : ''} Interrupted cargo goes safely to recovery.`
      : this.deliveryDraft ? 'That destination is no longer available. Choose another destination.'
        : 'Choose a destination to review this delivery route.');
  }

  setMachine(inspection: MachineInspection, paused: boolean): void {
    this.deliveryInspection = inspection;
    this.updateDeliveryCard();
    this.updateDeliveryPicker();
    const { machine, status, cycleTicks, recipe: machineRecipe } = inspection;
    const kind = machine.building.kind;
    const state = this.inspector.querySelector<HTMLElement>('#factory-machine-state');
    if (state) {
      state.textContent = paused ? 'Paused' : kind === 'kitchen' ? machine.input['food-unit'] ? 'Kitchen stocked' : 'Food shortage' : status;
      state.classList.toggle('factory-machine-blocked', /blocked|full|disconnected|incompatible/i.test(status) ||
        kind === 'kitchen' && !machine.input['food-unit']);
    }
    const input = this.inspector.querySelector<HTMLElement>('#factory-machine-input');
    if (input) input.textContent = isConveyor(kind) ? machine.item ? `1/1 · ${ITEM_NAMES[machine.item]}` : '0/1 · Empty'
      : `${itemCount(machine.input)}/${inspection.inputCapacity} · ${inventoryText(machine.input)}`;
    const output = this.inspector.querySelector<HTMLElement>('#factory-machine-output');
    if (output) output.textContent = `${itemCount(machine.output)}/${inspection.outputCapacity} · ${inventoryText(machine.output)}`;
    if (kind === 'miner' && input) input.textContent = `${inspection.deposit === 'copper' ? 'Copper' : 'Iron'} deposit`;
    const staffing = this.inspector.querySelector<HTMLElement>('#factory-staffing');
    if (staffing) this.setText(staffing, inspection.staffing ?? '');
    for (const button of this.inspector.querySelectorAll<HTMLButtonElement>('[data-command="work-priority"]')) {
      button.setAttribute('aria-pressed', String(button.dataset.priority === (machine.building.workPriority ?? 'normal')));
    }
    if (kind === 'home' && input) input.textContent = String(inspection.population);
    if (kind === 'assembler' && input) input.textContent = inspection.inputLimits.map(limit =>
      `${ITEM_NAMES[limit.item].split(' ')[0]} ${machine.input[limit.item]}/${limit.capacity}`).join(' · ');
    if (kind === 'splitter') this.inspector.querySelector<HTMLElement>('#factory-next-output')!.textContent =
      DIRECTION_NAMES[outputDirections(machine.building)[machine.nextOutput]];
    const pace = this.inspector.querySelector<HTMLElement>('#factory-machine-pace');
    if (pace) {
      const unit = kind === 'miner' ? 'ore' : kind === 'furnace' ? 'plate' : kind === 'assembler' ? 'supply'
        : kind === 'woodcutting-site' ? 'wood' : kind === 'food-plot' || kind === 'kitchen' ? 'food unit' : 'item';
      pace.textContent = `${machineRecipe?.output.quantity ?? 1} ${unit} / ${cycleTicks * STEP_MS / 1000}s${kind === 'woodcutting-site' ? ' gathering + walking' : ''}`;
    }
    const recipe = this.inspector.querySelector<HTMLElement>('#factory-machine-recipe');
    if (recipe && machineRecipe) recipe.textContent = kind === 'assembler'
      ? `${machineRecipe.inputs.map(ingredient =>
        `${ingredient.quantity} ${ITEM_NAMES[ingredient.item].toLowerCase().replace(/s$/, ingredient.quantity === 1 ? '' : 's')}`).join(' + ')} → ${machineRecipe.output.quantity} supply`
      : `${machineRecipe.inputs[0].quantity} ore → ${machineRecipe.output.quantity} matching plate`;
    const progress = inspection.progress;
    const percent = Math.round(progress * 100);
    const progressLabel = this.inspector.querySelector<HTMLElement>('#factory-progress-label');
    if (progressLabel) {
      progressLabel.textContent = kind === 'storage' || kind === 'kitchen' ? 'Capacity used'
        : kind === 'woodcutting-site' ? 'Gathering' : kind === 'food-plot' ? 'Harvest' : kind === 'assembler' ? 'Assembly'
          : isConveyor(kind) ? 'Transport' : kind === 'miner' ? 'Extraction' : 'Smelting';
      this.inspector.querySelector<HTMLElement>('#factory-progress-value')!.textContent = `${percent}%`;
      this.inspector.querySelector<HTMLElement>('.factory-progress')!.setAttribute('aria-valuenow', String(percent));
      this.inspector.querySelector<HTMLElement>('.factory-progress > span')!.style.width = `${percent}%`;
    }
    if (kind === 'miner') {
      const { enabled } = inspection.option!;
      const option = this.inspector.querySelector<HTMLButtonElement>('[data-action="machine-option"]')!;
      option.setAttribute('aria-pressed', String(!!enabled));
      option.textContent = enabled ? 'Use standard extractor'
        : `Upgrade to ${UPGRADED_EXTRACT_TICKS * STEP_MS / 1000}s / ore`;
    }
    if (kind === 'storage') {
      const next = inspection.nextStoredItem;
      const nextLabel = this.inspector.querySelector<HTMLElement>('.factory-depot-next')!;
      nextLabel.textContent = next ? `Next: ${ITEM_NAMES[next]}` : '';
      nextLabel.hidden = !next;
      const recovery = this.inspector.querySelector<HTMLDetailsElement>('.factory-depot-recovery')!;
      if (!this.recoveredCount && recovery.contains(document.activeElement)) {
        this.inspector.querySelector<HTMLButtonElement>('.factory-inspector-close')!.focus({ preventScroll: true });
      }
      recovery.hidden = !this.recoveredCount;
      if (!this.recoveredCount) recovery.open = false;
      recovery.querySelector<HTMLOutputElement>('output')!.textContent = String(this.recoveredCount);
      recovery.querySelector<HTMLElement>('.factory-recovered-items')!.textContent = this.recoveredText;
      const slots = inspection.availableInput;
      const count = Math.min(slots, this.recoveredCount);
      const reserved = inspection.inputCapacity - itemCount(machine.input) - slots;
      const reason = !slots ? reserved ? 'Remaining space is reserved for deliveries. Recovered items remain safely stored.'
        : 'Depot full. Recovered items remain safely stored.'
        : 'Stock is stored here. Choose resident hauling or connect a conveyor.';
      const recover = this.inspector.querySelector<HTMLButtonElement>('[data-action="recover"]')!;
      recover.disabled = !count;
      recover.textContent = count ? `Store ${count} ${count === 1 ? 'item' : 'items'} here`
        : reserved ? 'Space reserved for deliveries' : 'Depot full';
      recover.title = reason;
      this.inspector.querySelector<HTMLElement>('.factory-recover-reason')!.textContent = reason;
    }
  }

  setSummary(summary: FactorySummary): void {
    this.settlement = summary.settlement;
    this.root.querySelector<HTMLButtonElement>('.factory-people-button')!.hidden = !this.settlement;
    if (this.residentId !== null && this.settlement) {
      const resident = this.settlement.residents.find(value => value.id === this.residentId);
      if (!resident) throw new Error('Selected resident is missing');
      this.updateResident(resident);
    }
    const residents = this.inspector.querySelector<HTMLElement>('.factory-resident-list');
    if (residents && this.settlement) {
      if (!residents.childElementCount) residents.innerHTML = this.settlement.residents.map(resident =>
        `<button data-resident="${resident.id}"><strong>${residentName(resident.id)}</strong><span></span></button>`).join('');
      for (const resident of this.settlement.residents) residents.querySelector<HTMLElement>(`[data-resident="${resident.id}"] span`)!.textContent =
        this.residentActivity(resident);
    }
    this.recoveredCount = itemCount(summary.recovered);
    this.recoveredText = inventoryText(summary.recovered);
  }

  setBuildings(buildings: ReadonlyMap<string, Building>): void {
    this.buildingChoices = buildings;
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
    this.closeDeliveryPicker(false);
    this.abort.abort();
    if (this.statusTimer !== null) clearTimeout(this.statusTimer);
    this.footerObserver.disconnect();
    this.root.remove();
  }
}
