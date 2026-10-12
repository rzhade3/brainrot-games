import Phaser from 'phaser';
import { drawBuilding, drawMachineActivity, drawPreview, drawResident } from './rendering/art';
import { pickBuilding } from './assets/picking';
import { BeltRoute, commitRoute, planRoute, routeStartError, undoRoute } from './game/beltRoute';
import { inView, tileDepth, WorldView } from './rendering/chunks';
import { CATALOG, GATHER_RADIUS } from './game/domain';
import { Action, FactoryHud } from './hud';
import {
  Building, Direction, HALF_HEIGHT, HALF_WIDTH,
  inBounds, isBuildingKind, MAP_SIZE, NAMES, nextDirection,
  Point, project, Tile, tileKey, Tool, unproject,
} from './game/model';
import { getRenderScale, reducedMotionPreference } from './rendering/platform';
import { FactorySession } from './session/session';
import { Resident, WALK_TICKS } from './game/settlement';
import { FactorySimulation, inventoryText, itemCount } from './game/simulation';
import WorldRenderer from './rendering/WorldRenderer';

interface Contact extends Point {
  startX: number;
  startY: number;
  dragged: boolean;
  world: Point;
}

export default class FactoryScene extends Phaser.Scene {
  private session: FactorySession;
  private machineArt = new Map<string, Phaser.GameObjects.Graphics>();
  private motionArt = new Map<string, Phaser.GameObjects.Graphics>();
  private residentArt = new Map<number, Phaser.GameObjects.Graphics>();
  private residentFacing = new Map<number, Point>();
  private terrain!: WorldRenderer;
  private lastMachineView = '';
  private tool: Tool = 'inspect';
  private direction: Direction = 0;
  private selected: Building | null = null;
  private selectedResident: number | null = null;
  private hover: Tile | null = null;
  private preview!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private contacts = new Map<number, Contact>();
  private multiGesture = false;
  private routeStart: Tile | null = null;
  private routeEnd: Tile | null = null;
  private routePreview: BeltRoute | null = null;
  private horizontalFirst = true;
  private routeMobile = false;
  private routeReady = false;
  private lastTrail: Building[] = [];
  private abort = new AbortController();
  private dpr = 1;
  private zoom = 1;
  private cameraSize: Point = { x: 0, y: 0 };
  private choosingSettlement = false;
  private reducedMotion = reducedMotionPreference();
  private motionPaused = this.reducedMotion.matches;
  private resetElapsed = false;

  constructor(private hud: FactoryHud) {
    super('FactoryScene');
    this.session = new FactorySession(hud, (simulation, paused, resumed) => {
      this.startSettlement(simulation);
      this.paused = paused;
      this.hud.setPaused(paused);
      this.refreshSimulationHud();
      if (resumed) this.hud.setStatus('Factory resumed');
    });
  }

  private get simulation(): FactorySimulation { return this.session.simulation; }
  private set simulation(value: FactorySimulation) { this.session.simulation = value; }
  private get paused(): boolean { return this.session.paused; }
  private set paused(value: boolean) { this.session.paused = value; }
  private get renderInterpolation(): number {
    return this.paused || this.motionPaused ? 0 : this.simulation.interpolation;
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
    this.hud.onHaulTarget = target => {
      if (!this.selected) return 'Choose a source of goods first.';
      const error = this.simulation.setHaulTarget(this.selected, target);
      this.hud.setStatus(error ?? (target ? 'Resident destination updated. Any interrupted cargo is safe in recovery.'
        : 'Resident hauling disabled. Any interrupted cargo is safe in recovery.'), !!error);
      if (!error) { this.refreshSimulationHud(); this.saveChange(); }
      return error;
    };
    this.hud.onResident = id => {
      const resident = this.simulation.residents.find(resident => resident.id === id);
      if (!resident) return;
      this.selected = null;
      this.selectedResident = id;
      this.tool = 'inspect';
      const position = project(resident.tile.c, resident.tile.r);
      this.cameras.main.centerOn(position.x, position.y - 15);
      this.hud.inspectResident(resident);
      this.refreshTools();
    };
    this.hud.onWorkPriority = priority => {
      if (!this.selected) return 'Choose a building first.';
      const error = this.simulation.setWorkPriority(this.selected, priority);
      this.hud.setStatus(error ?? 'Work priority updated. Residents finish their current trip or harvest.', !!error);
      if (!error) { this.refreshSimulationHud(); this.saveChange(); }
      return error;
    };
    this.hud.onAssignmentDialog = () => {
      this.cancelRoute();
      this.contacts.clear();
      this.multiGesture = false;
      this.hover = null;
      this.renderPreview();
    };
    this.hud.onNewSettlement = seed => this.session.replace(seed);
    this.hud.onResume = () => this.session.resume();
    this.hud.onRetrySave = () => { void this.session.save(true); };
    this.hud.onRetryLoad = () => { void this.session.load(); };
    this.hud.onSettlementDialog = open => {
      this.choosingSettlement = open;
      this.cancelRoute();
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
    this.hud.openSettlements();
    void this.session.load();
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      this.session.close();
      this.terrain.destroy();
      this.scale.off('resize', this.onResize, this);
      this.hud.destroy();
    });
    this.game.canvas.setAttribute('aria-label', 'Isometric factory. Choose Conveyor and click a start and destination to connect. On touch, tap both endpoints, then Build. Drag to pan on touch; two fingers pan or zoom without discarding the route.');
  }

  private saveChange(): void {
    this.session.changed();
  }

  private startSettlement(simulation: FactorySimulation): void {
    this.simulation = simulation;
    this.lastTrail = [];
    this.cancelRoute();
    this.tool = 'inspect';
    this.direction = 0;
    this.selected = null;
    this.selectedResident = null;
    this.hover = null;
    this.paused = false;
    this.resetElapsed = true;
    this.hud.inspect(null);
    this.hud.setPaused(false);
    this.replaceTerrain();
    this.redrawMachines();
    this.refreshTools();
    this.home();
    this.refreshSimulationHud();
    this.hud.setStatus('');
    this.hud.setStatus('Welcome. People grow and carry food automatically. Inspect the plot to choose deliveries; People shows their work.');
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
    this.terrain.setBuildings(this.buildings);
    for (const art of this.machineArt.values()) art.destroy();
    for (const art of this.motionArt.values()) art.destroy();
    this.machineArt.clear();
    this.motionArt.clear();
    for (const art of this.residentArt.values()) art.destroy();
    this.residentArt.clear();
    this.residentFacing.clear();
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
      drawBuilding(art, building, this.buildings);
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
    const compact = window.innerWidth <= 700 || window.innerHeight <= 560;
    this.zoom = Math.max(this.minimumZoom(), compact ? 1 : Math.min(1.25, window.innerWidth / 700));
    this.cameras.main.setZoom(this.zoom * this.dpr);
    const center = project(this.simulation.world.start.c, this.simulation.world.start.r);
    this.cameras.main.centerOn(center.x, center.y - 15);
    const screen = this.hud.mapCenter();
    const rect = this.game.canvas.getBoundingClientRect();
    const framed = this.worldPoint({
      x: (screen.x - rect.left) * this.scale.width / rect.width,
      y: (screen.y - rect.top) * this.scale.height / rect.height,
    });
    this.cameras.main.scrollX += center.x - framed.x;
    this.cameras.main.scrollY += center.y - 15 - framed.y;
    this.cameraSize = { x: this.cameras.main.width, y: this.cameras.main.height };
    this.hud.setZoom(this.zoom);
    this.renderPreview();
    this.terrain.update(this.view());
    this.syncVisibleMachines(this.view());
  }

  private onResize(): void {
    this.contacts.clear();
    this.multiGesture = false;
    const camera = this.cameras.main;
    const center = { x: camera.scrollX + this.cameraSize.x / 2, y: camera.scrollY + this.cameraSize.y / 2 };
    const minimum = this.minimumZoom();
    this.zoom = Phaser.Math.Clamp(this.zoom, minimum, Math.max(2.1, minimum));
    camera.setZoom(this.zoom * this.dpr);
    camera.centerOn(center.x, center.y);
    this.cameraSize = { x: camera.width, y: camera.height };
    this.hud.setZoom(this.zoom);
    this.renderPreview();
    this.terrain.update(this.view());
    this.syncVisibleMachines(this.view());
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
      if (event.button !== 0 || this.choosingSettlement || this.hud.choosingAssignment) return;
      event.preventDefault();
      const point = this.screenPoint(event);
      canvas.setPointerCapture(event.pointerId);
      this.contacts.set(event.pointerId, { ...point, startX: point.x, startY: point.y,
        dragged: false, world: this.worldPoint(point) });
      if (this.contacts.size > 1) {
        this.multiGesture = true;
        this.hover = null;
        this.renderPreview();
      } else {
        const world = this.worldPoint(point);
        this.hover = unproject(world.x, world.y);
        if (this.tool !== 'belt') this.renderPreview(true);
      }
    }, options);
    canvas.addEventListener('pointermove', event => {
      const point = this.screenPoint(event);
      const contact = this.contacts.get(event.pointerId);
      if (contact) {
        if (this.tool === 'belt' && event.pointerType !== 'touch' && this.contacts.size === 1 && !this.multiGesture) {
          if (!contact.dragged && Math.hypot(point.x - contact.startX, point.y - contact.startY) > 7 * this.dpr) {
            contact.dragged = true;
            if (!this.routeStart) this.beginRoute(contact.world, false);
          }
          contact.x = point.x;
          contact.y = point.y;
          if (contact.dragged && this.routeStart) this.updateRouteEnd(this.worldPoint(point));
          return;
        }
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
        if (event.pointerType === 'touch') return;
      }
      const world = this.worldPoint(point);
      this.hover = unproject(world.x, world.y);
      if (this.tool === 'belt' && this.routeStart && !this.routeMobile) {
        this.updateRouteEnd(world);
        return;
      }
      this.renderPreview(true);
    }, options);
    canvas.addEventListener('pointerup', event => {
      const contact = this.contacts.get(event.pointerId);
      const click = contact && !contact.dragged && !this.multiGesture &&
        Math.hypot(this.screenPoint(event).x - contact.startX, this.screenPoint(event).y - contact.startY) <= 7 * this.dpr;
      this.contacts.delete(event.pointerId);
      const onMap = document.elementFromPoint(event.clientX, event.clientY) === canvas;
      if (onMap && !this.multiGesture && (click || contact?.dragged && event.pointerType !== 'touch' && this.tool === 'belt')) {
        if (this.tool === 'belt') {
          const world = this.worldPoint(this.screenPoint(event));
          if (!this.routeStart) this.beginRoute(world, event.pointerType === 'touch');
          else {
            this.routeMobile = event.pointerType === 'touch';
            this.updateRouteEnd(world);
            this.routeReady = true;
            if (!this.routeMobile) this.finishRoute();
          }
        } else if (click) this.tap(this.worldPoint(this.screenPoint(event)));
      }
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
      if (this.hud.choosingSettlement || this.hud.choosingAssignment || event.ctrlKey || event.metaKey || event.altKey ||
          event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable]')) return;
      const shortcuts: Record<string, Action> = {
        '1': 'inspect', ...Object.fromEntries(CATALOG.map(entry => [entry.shortcut, entry.kind])),
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
      if (document.hidden) void this.session.save();
    }, options);
    window.addEventListener('pagehide', () => {
      this.cancelRoute();
      this.contacts.clear();
      this.multiGesture = false;
      this.hover = null;
      this.renderPreview();
      this.simulation.resetClock();
      this.resetElapsed = true;
      void this.session.save();
    }, options);
  }

  private act(action: Action): void {
    if (this.choosingSettlement || this.hud.choosingAssignment) return;
    if (action === 'swap-bend') {
      this.horizontalFirst = !this.horizontalFirst;
      this.renderPreview();
      return;
    }
    if (action === 'build-route') {
      if (this.routeReady) this.finishRoute();
      return;
    }
    if (action === 'cancel-route') {
      this.cancelRoute();
      this.renderPreview();
      return;
    }
    if (!['zoom-in', 'zoom-out', 'home', 'pause'].includes(action)) this.cancelRoute();
    if (action === 'undo-trail') {
      const result = undoRoute(this.simulation, this.lastTrail);
      this.lastTrail = [];
      if (this.selected && !this.buildings.has(tileKey(this.selected))) {
        this.selected = null;
        this.hud.inspect(null);
      }
      this.redrawMachines();
      this.refreshSimulationHud();
      this.refreshTools();
      this.hud.setStatus(result.removed
        ? `Undid ${result.removed} conveyors.${itemCount(result.recovered) ? ` Recovered ${inventoryText(result.recovered)}.` : ''}`
        : 'No conveyors from that route remain.');
      if (result.removed) this.saveChange();
      this.renderPreview();
      return;
    }
    if (action === 'zoom-in' || action === 'zoom-out') {
      this.zoomAt(action === 'zoom-in' ? 1.2 : 1 / 1.2, { x: this.scale.width / 2, y: this.scale.height / 2 });
    } else if (action === 'home') {
      this.home();
    } else if (action === 'focus-home') {
      this.act('close');
      const home = [...this.buildings.values()].find(building => building.kind === 'home');
      if (!home) return;
      this.selected = home;
      this.hud.inspect(home);
      this.refreshSimulationHud();
      this.refreshTools();
      const point = project(home.c, home.r);
      this.cameras.main.centerOn(point.x, point.y - 15);
    } else if (action === 'focus-copper' || action === 'focus-iron') {
      this.act('close');
      const world = this.simulation.world;
      const tile = action === 'focus-copper' ? world.copper : world.iron;
      const point = project(tile.c, tile.r);
      this.cameras.main.centerOn(point.x, point.y - 15);
    } else if (action === 'machine-option') {
      if (!this.selected || this.tool !== 'inspect') return;
      const error = this.simulation.setMachineOption(this.selected);
      this.hud.setStatus(error ?? 'Machine setting updated. Blocked output retains its stock.', !!error);
      if (!error) {
        this.redrawMachines();
        this.hud.inspect(this.selected);
        this.refreshSimulationHud();
        this.saveChange();
      }
    } else if (action === 'pause') {
      this.paused = !this.paused;
      this.simulation.resetClock();
      this.resetElapsed = true;
      this.hud.setPaused(this.paused);
      this.refreshSimulationHud();
      this.saveChange();
    } else if (action === 'rotate') {
      if (this.tool === 'inspect' && this.selected) {
        if (this.selected.kind === 'home') {
          this.hud.setStatus('This founding building stays in place.', true);
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
      if (this.selected.kind === 'home') {
        this.hud.setStatus('This founding building stays in place.', true);
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
        ? `Stored ${inventoryText(result.moved)}. Tray: ${inventoryText(result.remaining)}.`
        : itemCount(result.remaining) ? 'Depot full; recovered items remain in the tray.' : 'Recovery tray empty.', !itemCount(result.moved));
    } else if (action === 'close') {
      this.tool = 'inspect';
      this.selected = null;
      this.selectedResident = null;
      this.hud.inspect(null);
      this.hover = null;
      this.refreshTools();
    } else {
      this.tool = action;
      this.selected = null;
      this.selectedResident = null;
      this.hud.inspect(null);
      this.refreshTools();
    }
    this.renderPreview();
  }

  private refreshTools(): void {
    this.hud.setTool(this.tool, this.direction, !!this.selected || this.selectedResident !== null);
    this.hud.setUndo(this.lastTrail.filter(building => this.buildings.get(tileKey(building)) === building).length);
    this.game.canvas.style.cursor = this.tool === 'inspect' ? 'grab' : 'crosshair';
    this.hud.setStatus('');
  }

  private tap(world: Point): void {
    const tile = unproject(world.x, world.y);
    if (this.tool === 'inspect') {
      const resident = this.simulation.residents.find(value => {
        const position = this.residentPosition(value, this.renderInterpolation);
        return Math.abs(world.x - position.x) < 10 && world.y >= position.y - 28 && world.y <= position.y + 4;
      });
      if (resident) {
        this.selected = null;
        this.selectedResident = resident.id;
        this.hud.inspectResident(resident);
        this.refreshTools();
        return;
      }
      this.selectedResident = null;
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
    this.preview.setDepth(this.tool === 'belt' ? 200002 : 200000);
    this.ghost.clear();
    if (this.tool === 'belt') {
      this.routePreview = this.routeStart && this.routeEnd
        ? planRoute(this.simulation, this.routeStart, this.routeEnd, this.horizontalFirst, this.direction) : null;
      const buildings = this.routePreview?.buildings ?? [];
      const previewBuildings = new Map(this.buildings);
      for (const building of buildings) previewBuildings.set(tileKey(building), building);
      this.ghost.setDepth(200001);
      for (const building of buildings) {
        drawPreview(this.preview, building.c, building.r, 0x347875);
        drawBuilding(this.ghost, building, previewBuildings);
      }
      const blocked = this.routePreview?.blocked;
      if (blocked) drawPreview(this.preview, blocked.tile.c, blocked.tile.r, 0xa75b44);
      for (const [tile, color] of [[this.routeStart, 0x347875], [this.routeEnd, blocked ? 0xa75b44 : 0x347875]] as const) {
        if (!tile) continue;
        const point = project(tile.c, tile.r);
        this.preview.lineStyle(2, color, 1);
        this.preview.strokeCircle(point.x, point.y - 8, 7);
        this.preview.fillStyle(color, 1);
        this.preview.fillCircle(point.x, point.y - 8, 2);
      }
      this.hud.setRouteControls({
        enabled: true, anchored: !!this.routeStart, ready: this.routeReady, mobile: this.routeMobile,
        count: buildings.length, canSwap: !!this.routePreview?.canSwap,
        error: blocked?.error ?? (this.routePreview && !buildings.length ? 'Already connected' : null),
      });
      return;
    }
    if (this.selected) drawPreview(this.preview, this.selected.c, this.selected.r, 0x347875);
    if (!this.hover || !inBounds(this.hover) || !isBuildingKind(this.tool)) return;
    const { c, r } = this.hover;
    if (this.tool === 'woodcutting-site') {
      for (let dc = -GATHER_RADIUS; dc <= GATHER_RADIUS; dc++) {
        for (let dr = -GATHER_RADIUS; dr <= GATHER_RADIUS; dr++) {
          if (Math.abs(dc) + Math.abs(dr) > GATHER_RADIUS || !this.simulation.world.contains({ c: c + dc, r: r + dr })) continue;
          drawPreview(this.preview, c + dc, r + dr, this.simulation.world.terrainAt({ c: c + dc, r: r + dr }) === 'tree'
            ? 0xd8a653 : 0x347875);
        }
      }
    }
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
      drawBuilding(this.ghost, { c, r, kind: this.tool, direction: this.direction }, this.buildings);
    }
    if (reportPlacement) {
      this.hud.setStatus(error ?? '', !!error);
    }
  }

  private routeTile(world: Point): Tile {
    const building = pickBuilding(world, this.buildings);
    return building ? { c: building.c, r: building.r } : unproject(world.x, world.y);
  }

  private beginRoute(world: Point, mobile: boolean): void {
    const tile = this.routeTile(world);
    const error = routeStartError(this.simulation, tile);
    if (error) {
      this.hud.setStatus(error, true);
      return;
    }
    this.routeStart = tile;
    this.routeEnd = null;
    this.routeMobile = mobile;
    this.routeReady = false;
    this.horizontalFirst = true;
    this.hud.setStatus('');
    this.renderPreview();
  }

  private updateRouteEnd(world: Point): void {
    this.routeEnd = this.routeTile(world);
    this.renderPreview();
  }

  private cancelRoute(): void {
    this.routeStart = this.routeEnd = null;
    this.routePreview = null;
    this.routeReady = false;
    this.hud.setRouteControls({ enabled: this.tool === 'belt', anchored: false, ready: false,
      mobile: this.routeMobile, count: 0, canSwap: false, error: null });
  }

  private finishRoute(): void {
    if (!this.routePreview || this.routePreview.blocked || !this.routePreview.buildings.length) return;
    const result = commitRoute(this.simulation, this.routePreview, this.direction);
    if (result.error) {
      this.renderPreview();
      this.hud.setStatus(result.error, true);
      return;
    }
    this.lastTrail = result.placed;
    this.cancelRoute();
    this.hover = null;
    if (result.placed.length) {
      this.direction = result.placed[result.placed.length - 1].direction;
      this.redrawMachines();
      this.refreshSimulationHud();
      this.refreshTools();
      this.saveChange();
    }
    this.hud.setStatus(`${result.placed.length} conveyors connected.`);
    this.renderPreview();
  }

  private refreshSimulationHud(): void {
    this.hud.setBuildings(this.buildings);
    this.hud.setSummary(this.simulation.summary());
    if (this.selected) {
      if (this.simulation.getState(this.selected)) {
        this.hud.setMachine(this.simulation.inspectMachine(this.selected), this.paused);
      }
    }
  }

  update(_time: number, delta: number): void {
    const view = this.view();
    this.terrain.update(view);
    this.syncVisibleMachines(view);
    if (!this.paused && !this.choosingSettlement && !document.hidden) {
      if (this.resetElapsed) this.resetElapsed = false;
      else {
        if (this.simulation.advance(delta)) {
          this.session.changed(false);
          this.refreshSimulationHud();
        }
      }
    } else this.simulation.resetClock();
    this.session.update(delta, document.hidden || this.choosingSettlement);
    const interpolation = this.renderInterpolation;
    for (const resident of this.simulation.residents) {
      let art = this.residentArt.get(resident.id);
      if (!art) { art = this.add.graphics(); this.residentArt.set(resident.id, art); }
      art.clear();
      const position = this.residentPosition(resident, interpolation);
      if (!inView(position, view)) continue;
      const next = resident.job?.path[0] ?? resident.tile;
      const t = (resident.travel + interpolation) / WALK_TICKS;
      art.setDepth(this.depth({ c: resident.tile.c + (next.c - resident.tile.c) * t,
        r: resident.tile.r + (next.r - resident.tile.r) * t }) + 0.2);
      const moving = !!resident.job?.path.length;
      if (moving) this.residentFacing.set(resident.id, project(next.c - resident.tile.c, next.r - resident.tile.r));
      const farming = (resident.job?.kind === 'farm' || resident.job?.kind === 'gather') && !moving;
      drawResident(art, position.x, position.y, resident.id,
        this.paused || this.motionPaused || !moving && !farming ? 0 : (this.simulation.ticks + interpolation) * 0.7,
        resident.cargo, farming, this.residentFacing.get(resident.id) ?? { x: 0, y: 1 });
      if (this.selectedResident === resident.id) {
        art.lineStyle(1.5, 0x347875).strokeEllipse(position.x, position.y + 1, 22, 10);
      }
    }
    for (const [key, g] of this.motionArt) {
      g.clear();
      const b = this.buildings.get(key)!;
      const state = this.simulation.getState(b)!;
      drawMachineActivity(g, state, this.simulation.ticks, interpolation, this.paused, this.motionPaused);
    }
  }

  private residentPosition(resident: Resident, interpolation: number): Point {
    const next = resident.job?.path[0] ?? resident.tile;
    const t = (resident.travel + interpolation) / WALK_TICKS;
    return project(resident.tile.c + (next.c - resident.tile.c) * t, resident.tile.r + (next.r - resident.tile.r) * t);
  }
}
