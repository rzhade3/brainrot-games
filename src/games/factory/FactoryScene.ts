import Phaser from 'phaser';
import { getRenderScale, prefersReducedMotion } from '../../core/createGame';
import {
  Building, Direction, DIRECTIONS, HALF_HEIGHT, HALF_WIDTH,
  inBounds, isBuildingKind, MAP_SIZE, NAMES, nextDirection, pickBuilding,
  Point, project, Scenario, Tile, tileKey, Tool, unproject,
} from './model';
import { drawBuilding, drawParcel, drawPreview } from './art';
import { Action, FactoryHud } from './hud';
import {
  BELT_TICKS, EXTRACT_TICKS, FactorySimulation, inventoryText, itemCount,
} from './simulation';
import { createSave, FactorySave, FactorySaveStore, restoreSave, SaveConflictError } from './persistence';
import WorldRenderer from './WorldRenderer';
import { inView, tileDepth, WorldView } from './chunks';

interface Contact extends Point {
  startX: number;
  startY: number;
  dragged: boolean;
}

export default class FactoryScene extends Phaser.Scene {
  private simulation = FactorySimulation.forScenario('free-play');
  private machineArt = new Map<string, Phaser.GameObjects.Graphics>();
  private motionArt = new Map<string, Phaser.GameObjects.Graphics>();
  private terrain!: WorldRenderer;
  private lastMachineView = '';
  private tool: Tool = 'inspect';
  private direction: Direction = 0;
  private selected: Building | null = null;
  private hover: Tile | null = null;
  private preview!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private contacts = new Map<number, Contact>();
  private multiGesture = false;
  private abort = new AbortController();
  private dpr = 1;
  private zoom = 1;
  private paused = false;
  private choosingScenario = false;
  private motionPaused = prefersReducedMotion;
  private resetElapsed = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private saveStore = new FactorySaveStore();
  private savedFactory: FactorySave | null = null;
  private worldId: string | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private saveRevision = 0;
  private savedRevision = -1;
  private autosaveElapsed = 0;
  private saveConflict = false;
  private loadingSave = false;
  private replacingSave = false;

  constructor(private hud: FactoryHud) {
    super('FactoryScene');
  }

  private get buildings(): ReadonlyMap<string, Building> {
    return this.simulation.buildings;
  }

  create(): void {
    this.dpr = getRenderScale();
    this.cameras.main.setBackgroundColor('#dce3d7');
    this.terrain = new WorldRenderer(this, this.simulation.world);
    this.preview = this.add.graphics().setDepth(200000);
    this.ghost = this.add.graphics().setAlpha(0.55);
    this.home();
    this.hud.onAction = action => this.act(action);
    this.hud.onScenario = (scenario, seed) => this.replaceScenario(scenario, seed);
    this.hud.onResume = () => this.resumeFactory();
    this.hud.onRetrySave = () => { void this.autosave(true); };
    this.hud.onRetryLoad = () => { void this.loadFactory(); };
    this.hud.onScenarioDialog = open => {
      this.choosingScenario = open;
      this.contacts.clear();
      this.multiGesture = false;
      this.hover = null;
      this.simulation.resetClock();
      this.resetElapsed = true;
      this.renderPreview();
    };
    this.hud.setPaused(this.paused);
    this.refreshSimulationHud();
    this.refreshTools();
    this.bindInput();
    this.hud.openScenarios();
    void this.loadFactory();
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      this.saveStore.close();
      this.terrain.destroy();
      this.scale.off('resize', this.onResize, this);
      this.hud.destroy();
    });
    this.game.canvas.setAttribute('aria-label', 'Isometric factory study. Choose a tool, then tap a tile. Drag to pan and pinch to zoom.');
  }

  private async loadFactory(): Promise<void> {
    if (this.loadingSave || this.worldId) return;
    this.loadingSave = true;
    this.hud.setSavedScenario(null, 'Reading local save...', true, false);
    try {
      this.savedFactory = await this.saveStore.load();
      this.hud.setSavedScenario(this.savedFactory?.simulation.scenario ?? null, this.savedFactory
        ? `Last saved ${new Date(this.savedFactory.savedAt).toLocaleString()}`
        : '', false, !!this.savedFactory);
      this.hud.setSaveStatus(this.savedFactory ? 'Local save available to resume' : 'Choose a scenario to begin autosaving');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const invalid = /Corrupt factory save|Unsupported factory/.test(message);
      this.hud.setSavedScenario(null, `${message} ${invalid ? 'Start a new factory only if you want to replace this unreadable save.' : 'No save was replaced.'}`,
        !invalid, invalid);
      this.hud.setSaveStatus(`Load failed: ${message}`);
    } finally {
      this.loadingSave = false;
    }
  }

  private queueWrite(save: FactorySave): Promise<void> {
    const operation = this.saveQueue.then(() => this.saveStore.write(save));
    this.saveQueue = operation.then(() => {}, () => {});
    return operation;
  }

  private async replaceScenario(scenario: Scenario, seed: string): Promise<boolean> {
    this.replacingSave = true;
    this.hud.setSaveStatus('Saving new factory...');
    try {
      const simulation = FactorySimulation.forScenario(scenario, seed.trim() || crypto.randomUUID());
      const id = crypto.randomUUID();
      const save = createSave(simulation, false, id);
      await this.queueWrite(save);
      this.worldId = id;
      this.savedFactory = save;
      this.saveRevision = 0;
      this.savedRevision = 0;
      this.autosaveElapsed = 0;
      this.saveConflict = false;
      this.startScenario(simulation);
      this.hud.setSavedScenario(scenario, 'New factory saved on this device.', false, true);
      this.hud.setSaveStatus('Saved on this device');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.hud.setSavedScenario(this.savedFactory?.simulation.scenario ?? null, `Could not start a new factory: ${message} Your previous save was not changed.`, false, true);
      this.hud.setSaveStatus(`Save failed: ${message}`, !!this.worldId);
      return false;
    } finally {
      this.replacingSave = false;
    }
  }

  private resumeFactory(): void {
    if (!this.savedFactory) return;
    const { save, simulation } = restoreSave(this.savedFactory);
    this.simulation = simulation;
    this.worldId = save.worldId;
    this.paused = save.paused;
    this.saveRevision = 0;
    this.savedRevision = 0;
    this.selected = null;
    this.tool = 'inspect';
    this.direction = 0;
    this.resetElapsed = true;
    this.hud.inspect(null);
    this.hud.setPaused(this.paused);
    this.replaceTerrain();
    this.redrawMachines();
    this.home();
    this.refreshTools();
    this.refreshSimulationHud();
    this.hud.setStatus('Factory resumed');
    this.hud.setSaveStatus('Saved factory resumed on this device');
  }

  private async autosave(force = false): Promise<void> {
    if (!this.worldId || this.replacingSave || this.saveConflict || !force && this.savedRevision === this.saveRevision) return;
    const worldId = this.worldId;
    const revision = this.saveRevision;
    const save = createSave(this.simulation, this.paused, worldId);
    this.hud.setSaveStatus('Saving locally...');
    try {
      await this.queueWrite(save);
      if (this.worldId !== worldId) return;
      this.savedFactory = save;
      this.savedRevision = revision;
      this.hud.setSaveStatus(this.savedRevision === this.saveRevision ? 'Saved on this device' : 'Autosave active · new changes pending');
    } catch (error) {
      if (this.worldId !== worldId) return;
      if (error instanceof SaveConflictError) this.saveConflict = true;
      const message = error instanceof Error ? error.message : String(error);
      this.hud.setSaveStatus(`Not saved: ${message}`, true, !this.saveConflict);
    }
  }

  private saveChange(): void {
    this.saveRevision++;
    void this.autosave();
  }

  private startScenario(simulation: FactorySimulation): void {
    this.simulation = simulation;
    this.tool = 'inspect';
    this.direction = 0;
    this.selected = null;
    this.hover = null;
    this.paused = false;
    this.resetElapsed = true;
    this.hud.inspect(null);
    this.hud.setPaused(false);
    this.replaceTerrain();
    this.redrawMachines();
    this.home();
    this.refreshTools();
    this.refreshSimulationHud();
    this.hud.setStatus('');
  }

  private replaceTerrain(): void {
    this.terrain.destroy();
    this.terrain = new WorldRenderer(this, this.simulation.world);
    this.lastMachineView = '';
    this.hud.setWorld(this.simulation.world);
  }

  private depth(tile: Tile): number {
    return tileDepth(tile);
  }

  private redrawMachines(): void {
    for (const art of this.machineArt.values()) art.destroy();
    for (const art of this.motionArt.values()) art.destroy();
    this.machineArt.clear();
    this.motionArt.clear();
    this.lastMachineView = '';
    this.syncVisibleMachines(this.view());
  }

  private view(): WorldView {
    this.cameras.main.preRender();
    return this.cameras.main.worldView;
  }

  private syncVisibleMachines(view: WorldView): void {
    const signature = `${Math.floor(view.x / 48)},${Math.floor(view.y / 48)},${Math.ceil(view.width)},${Math.ceil(view.height)}`;
    if (signature === this.lastMachineView) return;
    this.lastMachineView = signature;
    const visible = new Set<string>();
    for (const building of this.buildings.values()) {
      if (!inView(project(building.c, building.r), view)) continue;
      const key = tileKey(building);
      visible.add(key);
      if (this.machineArt.has(key)) continue;
      const art = this.add.graphics().setDepth(this.depth(building));
      drawBuilding(art, building);
      this.machineArt.set(key, art);
      this.motionArt.set(key, this.add.graphics().setDepth(this.depth(building) + 0.1));
    }
    for (const [key, art] of this.machineArt) {
      if (!visible.has(key)) {
        art.destroy();
        this.motionArt.get(key)!.destroy();
        this.machineArt.delete(key);
        this.motionArt.delete(key);
      }
    }
  }

  private minimumZoom(): number {
    return Math.max(0.4, window.innerWidth / 4800, window.innerHeight / 2700);
  }

  private home(): void {
    this.zoom = Math.max(this.minimumZoom(), Math.min(1.25, Math.max(0.5, window.innerWidth / 700)));
    this.cameras.main.setZoom(this.zoom * this.dpr);
    const center = project(this.simulation.world.start.c, this.simulation.world.start.r);
    this.cameras.main.centerOn(center.x, center.y - 15);
    this.hud.setZoom(this.zoom);
    this.renderPreview();
    this.terrain.update(this.view());
    this.syncVisibleMachines(this.view());
  }

  private onResize(): void {
    this.contacts.clear();
    this.multiGesture = false;
    this.home();
  }

  private screenPoint(event: PointerEvent | WheelEvent): Point {
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * this.scale.width / rect.width,
      y: (event.clientY - rect.top) * this.scale.height / rect.height,
    };
  }

  private worldPoint(point: Point): Point {
    this.cameras.main.preRender();
    return this.cameras.main.getWorldPoint(point.x, point.y);
  }

  private zoomAt(amount: number, point: Point): void {
    const before = this.worldPoint(point);
    this.zoom = Phaser.Math.Clamp(this.zoom * amount, this.minimumZoom(), Math.max(2.1, this.minimumZoom()));
    this.cameras.main.setZoom(this.zoom * this.dpr);
    const after = this.worldPoint(point);
    this.cameras.main.scrollX += before.x - after.x;
    this.cameras.main.scrollY += before.y - after.y;
    this.clampCamera();
    this.hud.setZoom(this.zoom);
    this.renderPreview();
  }

  private clampCamera(): void {
    const camera = this.cameras.main;
    camera.preRender();
    const center = camera.midPoint;
    const c = (center.x / HALF_WIDTH + center.y / HALF_HEIGHT) / 2;
    const r = (center.y / HALF_HEIGHT - center.x / HALF_WIDTH) / 2;
    const clamped = project(Phaser.Math.Clamp(c, 0, MAP_SIZE - 1), Phaser.Math.Clamp(r, 0, MAP_SIZE - 1));
    camera.scrollX += clamped.x - center.x;
    camera.scrollY += clamped.y - center.y;
  }

  private bindInput(): void {
    const canvas = this.game.canvas;
    const options = { signal: this.abort.signal };
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.choosingScenario) return;
      event.preventDefault();
      const point = this.screenPoint(event);
      canvas.setPointerCapture(event.pointerId);
      this.contacts.set(event.pointerId, { ...point, startX: point.x, startY: point.y, dragged: false });
      if (this.contacts.size > 1) {
        this.multiGesture = true;
        this.hover = null;
        this.refreshTools();
        this.renderPreview();
      } else {
        const world = this.worldPoint(point);
        this.hover = unproject(world.x, world.y);
        this.renderPreview(true);
      }
    }, options);
    canvas.addEventListener('pointermove', event => {
      const point = this.screenPoint(event);
      const contact = this.contacts.get(event.pointerId);
      if (contact) {
        if (this.contacts.size === 2) {
          const other = [...this.contacts.entries()].find(([id]) => id !== event.pointerId)?.[1];
          if (other) {
            const oldDistance = Math.hypot(contact.x - other.x, contact.y - other.y);
            const newDistance = Math.hypot(point.x - other.x, point.y - other.y);
            const oldMid = { x: (contact.x + other.x) / 2, y: (contact.y + other.y) / 2 };
            const newMid = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
            if (oldDistance > 10) this.zoomAt(newDistance / oldDistance, oldMid);
            this.cameras.main.scrollX -= (newMid.x - oldMid.x) / (this.zoom * this.dpr);
            this.cameras.main.scrollY -= (newMid.y - oldMid.y) / (this.zoom * this.dpr);
          }
        } else if (this.contacts.size === 1) {
          if (!contact.dragged && Math.hypot(point.x - contact.startX, point.y - contact.startY) > 7 * this.dpr) {
            contact.dragged = true;
            this.refreshTools();
          }
          if (contact.dragged || this.multiGesture) {
            this.cameras.main.scrollX -= (point.x - contact.x) / (this.zoom * this.dpr);
            this.cameras.main.scrollY -= (point.y - contact.y) / (this.zoom * this.dpr);
          }
        }
        contact.x = point.x;
        contact.y = point.y;
        this.clampCamera();
        if (contact.dragged || this.multiGesture) {
          this.hover = null;
          this.renderPreview();
          return;
        }
      }
      const world = this.worldPoint(point);
      this.hover = unproject(world.x, world.y);
      this.renderPreview(true);
    }, options);
    canvas.addEventListener('pointerup', event => {
      const contact = this.contacts.get(event.pointerId);
      const click = contact && !contact.dragged && !this.multiGesture &&
        Math.hypot(this.screenPoint(event).x - contact.startX, this.screenPoint(event).y - contact.startY) <= 7 * this.dpr;
      this.contacts.delete(event.pointerId);
      if (click) this.tap(this.worldPoint(this.screenPoint(event)));
      if (this.contacts.size === 0) this.multiGesture = false;
      if (event.pointerType === 'touch') this.hover = null;
      this.renderPreview();
    }, options);
    const cancel = (event: PointerEvent) => {
      this.contacts.delete(event.pointerId);
      if (!this.contacts.size) this.multiGesture = false;
      this.hover = null;
      this.renderPreview();
    };
    canvas.addEventListener('pointercancel', cancel, options);
    canvas.addEventListener('lostpointercapture', cancel, options);
    canvas.addEventListener('pointerleave', () => {
      if (!this.contacts.size) {
        this.hover = null;
        this.renderPreview();
      }
    }, options);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.zoomAt(Math.exp(-event.deltaY * 0.001), this.screenPoint(event));
    }, { ...options, passive: false });
    window.addEventListener('keydown', event => {
      if (this.hud.choosingScenario || event.ctrlKey || event.metaKey || event.altKey ||
          event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable]')) return;
      const shortcuts: Record<string, Action> = {
        '1': 'inspect', '2': 'belt', '3': 'miner', '4': 'furnace', '5': 'storage', '7': 'assembler',
        r: 'rotate', Escape: 'close', '+': 'zoom-in', '-': 'zoom-out', Home: 'home',
      };
      const action = shortcuts[event.key];
      if (action) {
        event.preventDefault();
        this.act(action);
      }
    }, options);
    window.addEventListener('blur', () => {
      this.contacts.clear();
      this.multiGesture = false;
      this.hover = null;
      this.renderPreview();
    }, options);
    this.reducedMotion.addEventListener('change', event => {
      this.motionPaused = event.matches;
    }, options);
    document.addEventListener('visibilitychange', () => {
      this.simulation.resetClock();
      this.resetElapsed = true;
      this.contacts.clear();
      this.multiGesture = false;
      this.hover = null;
      this.renderPreview();
      if (document.hidden) void this.autosave();
    }, options);
    window.addEventListener('pagehide', () => {
      this.simulation.resetClock();
      this.resetElapsed = true;
      void this.autosave();
    }, options);
  }

  private act(action: Action): void {
    if (this.choosingScenario) return;
    if (action === 'zoom-in' || action === 'zoom-out') {
      this.zoomAt(action === 'zoom-in' ? 1.2 : 1 / 1.2, { x: this.scale.width / 2, y: this.scale.height / 2 });
    } else if (action === 'home') {
      this.home();
    } else if (action === 'focus-copper' || action === 'focus-iron' || action === 'focus-outpost') {
      this.act('close');
      const world = this.simulation.world;
      const tile = action === 'focus-copper' ? world.copper : action === 'focus-iron' ? world.iron : world.outpost;
      const point = project(tile.c, tile.r);
      this.cameras.main.centerOn(point.x, point.y - 15);
    } else if (action === 'pause') {
      this.paused = !this.paused;
      this.simulation.resetClock();
      this.resetElapsed = true;
      this.hud.setPaused(this.paused);
      this.refreshSimulationHud();
      this.saveChange();
    } else if (action === 'rotate') {
      if (this.tool === 'inspect' && this.selected) {
        if (this.selected.kind === 'outpost') {
          this.hud.setStatus('The outpost is fixed; it cannot be rotated.', true);
          return;
        }
        this.direction = this.simulation.rotate(this.selected);
        this.redrawMachines();
        this.hud.inspect(this.selected);
        this.refreshSimulationHud();
        this.saveChange();
      } else if (isBuildingKind(this.tool)) this.direction = nextDirection(this.direction);
      this.refreshTools();
    } else if (action === 'remove') {
      if (this.tool !== 'inspect' || !this.selected) return;
      if (this.selected.kind === 'outpost') {
        this.hud.setStatus('The outpost is fixed; it cannot be removed.', true);
        return;
      }
      const building = this.selected;
      const contents = this.simulation.remove(building);
      this.selected = null;
      this.hud.inspect(null);
      this.redrawMachines();
      this.refreshSimulationHud();
      this.refreshTools();
      this.hud.setStatus(`${NAMES[building.kind]} removed.${itemCount(contents) ? ` Recovered ${inventoryText(contents)}.` : ''}`);
      this.saveChange();
    } else if (action === 'recover') {
      if (this.tool !== 'inspect' || this.selected?.kind !== 'storage') {
        this.hud.setStatus('Select a depot to transfer recovered items.', true);
        return;
      }
      const result = this.simulation.transferRecovered(this.selected);
      this.refreshSimulationHud();
      if (itemCount(result.moved)) this.saveChange();
      this.hud.setStatus(itemCount(result.moved)
        ? `Stored ${inventoryText(result.moved)}. Tray: ${inventoryText(result.remaining)}. Depot storage does not fulfill orders.`
        : itemCount(result.remaining) ? 'Depot full; recovered items remain in the tray.' : 'Recovery tray empty.', !itemCount(result.moved));
    } else if (action === 'close') {
      this.tool = 'inspect';
      this.selected = null;
      this.hud.inspect(null);
      this.hover = null;
      this.refreshTools();
    } else {
      if (action === 'assembler' && !this.simulation.assemblerUnlocked) {
        this.hud.setStatus('Assembler locked. Deliver 16 copper plates to the outpost first.', true);
        return;
      }
      this.tool = action;
      this.selected = null;
      this.hud.inspect(null);
      this.refreshTools();
    }
    this.renderPreview();
  }

  private refreshTools(): void {
    this.hud.setTool(this.tool, this.direction, !!this.selected);
    this.game.canvas.style.cursor = this.tool === 'inspect' ? 'grab' : 'crosshair';
    this.hud.setStatus('');
  }

  private tap(world: Point): void {
    const tile = unproject(world.x, world.y);
    if (this.tool === 'inspect') {
      this.selected = pickBuilding(world, this.buildings);
      if (this.selected) this.direction = this.selected.direction;
      this.hud.inspect(this.selected);
      this.refreshSimulationHud();
      this.refreshTools();
    } else {
      const building: Building = { ...tile, kind: this.tool, direction: this.direction };
      const error = this.simulation.place(building);
      if (error) {
        this.hud.setStatus(error, true);
        return;
      }
      this.redrawMachines();
      this.refreshSimulationHud();
      this.hud.setStatus(`${NAMES[this.tool]} placed`);
      this.saveChange();
    }
  }

  private renderPreview(reportPlacement = false): void {
    if (!this.preview) return;
    this.preview.clear();
    this.ghost.clear();
    if (this.selected) drawPreview(this.preview, this.selected.c, this.selected.r, 0x347875);
    if (!this.hover || !inBounds(this.hover) || !isBuildingKind(this.tool)) return;
    const { c, r } = this.hover;
    for (let dc = -2; dc <= 2; dc++) {
      for (let dr = -2; dr <= 2; dr++) {
        if (inBounds({ c: c + dc, r: r + dr })) {
          const point = project(c + dc, r + dr);
          this.preview.lineStyle(0.8, 0xf4f0d9, 0.3);
          this.preview.strokePoints([
            { x: point.x, y: point.y - HALF_HEIGHT },
            { x: point.x + HALF_WIDTH, y: point.y },
            { x: point.x, y: point.y + HALF_HEIGHT },
            { x: point.x - HALF_WIDTH, y: point.y },
          ], true);
        }
      }
    }
    const error = this.simulation.placementError(this.hover, this.tool);
    drawPreview(this.preview, c, r, error ? 0xa75b44 : 0x347875);
    if (!error) {
      this.ghost.setDepth(this.depth(this.hover) + 0.2);
      drawBuilding(this.ghost, { c, r, kind: this.tool, direction: this.direction });
    }
    if (reportPlacement) {
      this.hud.setStatus(error ?? '', !!error);
    }
  }

  private refreshSimulationHud(): void {
    this.hud.setSummary(this.simulation.summary());
    if (this.selected) {
      const state = this.simulation.getState(this.selected);
      if (state) this.hud.setMachine(state, this.simulation.status(this.selected), this.paused, this.simulation.world);
    }
  }

  update(_time: number, delta: number): void {
    const view = this.view();
    this.terrain.update(view);
    this.syncVisibleMachines(view);
    if (!this.paused && !this.choosingScenario && !document.hidden) {
      if (this.resetElapsed) this.resetElapsed = false;
      else {
        const stage = this.simulation.objective()?.stage;
        if (this.simulation.advance(delta)) {
          this.saveRevision++;
          this.refreshSimulationHud();
          if (stage !== this.simulation.objective()?.stage) void this.autosave();
        }
      }
    } else this.simulation.resetClock();
    if (this.worldId && !document.hidden && !this.choosingScenario) {
      this.autosaveElapsed += Math.min(delta, 250);
      if (this.autosaveElapsed >= 5000) {
        this.autosaveElapsed = 0;
        void this.autosave();
      }
    }
    const interpolation = this.paused || this.motionPaused ? 0 : this.simulation.interpolation;
    for (const [key, g] of this.motionArt) {
      g.clear();
      const b = this.buildings.get(key)!;
      const state = this.simulation.getState(b)!;
      const { x, y } = project(b.c, b.r);
      if (b.kind === 'belt' && state.item) {
        const t = this.motionPaused ? 0.5 : Math.min(1, (state.progress + interpolation) / BELT_TICKS);
        const incoming = DIRECTIONS[state.enteredFrom];
        const outgoing = DIRECTIONS[b.direction];
        const c = b.c + (t < 0.5 ? incoming.c * (t - 0.5) : outgoing.c * (t - 0.5));
        const r = b.r + (t < 0.5 ? incoming.r * (t - 0.5) : outgoing.r * (t - 0.5));
        const p = project(c, r);
        drawParcel(g, p.x, p.y - 6, state.item);
      } else if (b.kind === 'miner') {
        const angle = this.motionPaused ? 0 : (state.progress + (state.running ? interpolation : 0)) / EXTRACT_TICKS * Math.PI * 2;
        g.lineStyle(2, 0xd4d7bb);
        g.lineBetween(x - 5 - Math.cos(angle) * 7, y - 46 - Math.sin(angle) * 3,
          x - 5 + Math.cos(angle) * 7, y - 46 + Math.sin(angle) * 3);
      } else if (b.kind === 'furnace' && state.running && !this.paused && !this.motionPaused) {
        for (let i = 0; i < 3; i++) {
          const t = ((this.simulation.ticks + interpolation) / 26 + i / 3) % 1;
          g.fillStyle(0xeef0dc, (1 - t) * 0.3);
          g.fillEllipse(x + 5 + t * 8, y - 65 - t * 25, 7 + t * 13, 4 + t * 8);
        }
      } else if (b.kind === 'assembler' && state.running) {
        const t = this.motionPaused || this.paused ? 0.5 : (state.progress + interpolation) / 20;
        g.fillStyle(0xd8b66f);
        g.fillCircle(x - 12 + t * 24, y - 39, 3);
      }
    }
  }
}
