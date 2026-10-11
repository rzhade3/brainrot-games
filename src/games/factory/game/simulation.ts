import {
  BELT_TICKS,
  canHaulFrom, canHaulTo,
  compareTiles,
  EXTRACT_TICKS,
  firstItem, inventory, Inventory, Item,
  ITEM_NAMES,
  itemCount,
  ITEMS,
  MEAL_TICKS,
  moveInventory,
  RATE_WINDOW_TICKS, STEP_MS, UPGRADED_EXTRACT_TICKS,
} from './domain';
import {
  acceptsInventoryItem, ASSEMBLER_RECIPE, depotNextItem, inputCapacity, inputSlots,
  machineCycleTicks,
  MachineRecipe, machineRecipe,
  MachineState,
  outputCapacity, produceMachine, ProductionLedger,
  recoverContents, transferMachines, TransportHost,
} from './machines';
import {
  acceptsConveyorInput, Building, BuildingKind, createGuided,
  Direction, DIRECTION_NAMES,
  DIRECTIONS,
  isConveyor,
  nextDirection, OUTPOST,
  outputDirections, placementError, Scenario, Tile, tileKey,
} from './model';
import { LegacyProgression, ObjectiveSummary, ORDERS, ProjectId, PROJECTS, ProjectState, ProjectSummary } from './progression';
import { assertConservation, copyMachine, requireSave, restoreMachine, saveCount, saveInventory, saveObject, saveTile } from '../session/saveState';
import { Resident, residentName, Settlement, SettlementSave, STARTER_FOOD } from './settlement';
import { DEFAULT_WORLD, FactoryWorld, GUIDED_SEED, restoreWorld, WorldIdentity } from './world';
export { BELT_TICKS, EXTRACT_TICKS, inventory, inventoryText, ITEM_NAMES, itemCount, ITEMS, RATE_WINDOW_TICKS, STEP_MS, UPGRADED_EXTRACT_TICKS } from './domain';
export type { Inventory, Item } from './domain';
export { ASSEMBLE_TICKS, BUFFER_CAPACITY, DEPOT_CAPACITY, depotNextItem, SMELT_TICKS } from './machines';
export type { MachineState } from './machines';
export { ORDERS, PROJECTS } from './progression';
export type { ObjectiveSummary, ProjectId, ProjectState, ProjectSummary } from './progression';
export { requireSave, saveCount, saveObject, saveTile } from '../session/saveState';

export interface MachineInspection {
  machine: Readonly<MachineState>;
  status: string;
  inputCapacity: number;
  outputCapacity: number;
  availableInput: number;
  recipe: MachineRecipe | null;
  cycleTicks: number;
  inputLimits: readonly { item: Item; capacity: number }[];
  deposit: 'iron' | 'copper' | null;
  farmerName: string | null;
  population: number;
  delivery: { item: Item; quantity: number; accepted: number } | null;
  progress: number;
  nextStoredItem: Item | null;
  option: { unlocked: boolean; enabled: boolean; project: typeof PROJECTS[number] } | null;
}

export interface FactorySummary {
  stored: Inventory;
  recovered: Inventory;
  mined: Inventory;
  smelted: Inventory;
  assembled: Inventory;
  recipeConsumed: Inventory;
  delivered: Inventory;
  objective: ObjectiveSummary | null;
  projects: ProjectSummary;
  scenario: Scenario;
  ticks: number;
  settlement: SettlementSave | null;
}

export interface SimulationSave {
  world: WorldIdentity;
  scenario: Scenario;
  ticks: number;
  accumulator: number;
  machines: MachineState[];
  lastSource: [string, Tile][];
  recovered: Inventory;
  mined: Inventory;
  smelted: Inventory;
  assembled: Inventory;
  recipeConsumed: Inventory;
  delivered: Inventory;
  stage: number;
  orderStarted: number;
  orderCompleted: number | null;
  deliveryTicks: number[];
  projects: ProjectState;
  ruleset: 'factory-v1' | 'settlement-v1';
  settlement: SettlementSave | null;
}

export class FactorySimulation {
  private placed = new Map<string, Building>();
  private machines = new Map<string, MachineState>();
  private lastSource = new Map<string, Tile>();
  private recovered = inventory();
  private progression = new LegacyProgression();
  private accumulator = 0;
  private settlement: Settlement | null = null;
  private orderedMachines: MachineState[] | null = null;
  private readonly productionLedger: ProductionLedger = {
    mined: inventory(), smelted: inventory(), assembled: inventory(), recipeConsumed: inventory(),
  };
  private readonly transportHost: TransportHost = {
    outgoing: machine => this.outgoing(machine),
    destination: (building, direction) => this.destination(building, direction),
    accepts: (machine, source, item) => this.accepts(machine, source, item),
    freeSlots: (machine, item) => this.freeSlots(machine, item),
    receive: (machine, item) => this.receive(machine, item),
  };
  ticks = 0;

  constructor(buildings: ReadonlyMap<string, Building> = new Map(), readonly scenario: Scenario = 'free-play',
    readonly world: FactoryWorld = DEFAULT_WORLD) {
    for (const building of [...buildings.values()].sort(compareTiles)) {
      if (building.outputEnabled !== undefined || building.upgraded !== undefined) throw new Error('Initial machines must use default settings');
      const error = building.kind === 'outpost' && scenario === 'guided' && tileKey(building) === tileKey(OUTPOST)
        ? placementError(building, building.kind, this.placed, this.world) : this.placementError(building, building.kind);
      if (error) throw new Error(`Invalid initial factory at ${tileKey(building)}: ${error}`);
      this.addMachine(building);
    }
  }

  static forScenario(scenario: Scenario, seed = GUIDED_SEED): FactorySimulation {
    const world = seed === GUIDED_SEED || scenario === 'guided' ? DEFAULT_WORLD : new FactoryWorld(seed);
    const sim = new FactorySimulation(scenario === 'guided' ? createGuided() : new Map(), scenario, world);
    if (scenario === 'settlement') {
      sim.addMachine({ kind: 'home', c: 11, r: 12, direction: 0 });
      sim.addMachine({ kind: 'kitchen', c: 14, r: 12, direction: 0 });
      sim.addMachine({ kind: 'food-plot', c: 10, r: 9, direction: 0, haulTo: { c: 14, r: 12 } });
      sim.machines.get('14,12')!.input['food-unit'] = STARTER_FOOD;
      sim.settlement = new Settlement(sim.settlementHost());
    }
    return sim;
  }

  private settlementHost() {
    return {
      machines: this.machines, world: this.world,
      automated: (machine: MachineState) => outputDirections(machine.building).some(direction => {
        const destination = this.destination(machine.building, direction);
        const item = firstItem(machine.building.kind === 'storage' ? machine.input : machine.output);
        return !!destination && !!item && this.accepts(destination, machine.building, item);
      }),
      recover: (item: Item) => { this.recovered[item]++; },
    };
  }

  serialize(): SimulationSave {
    return {
      world: this.world.identity(), scenario: this.scenario, ticks: this.ticks, accumulator: this.accumulator,
      machines: [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building)).map(copyMachine),
      lastSource: [...this.lastSource.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, source]) => [key, { ...source }]),
      recovered: { ...this.recovered }, mined: { ...this.productionLedger.mined }, smelted: { ...this.productionLedger.smelted },
      assembled: { ...this.productionLedger.assembled }, recipeConsumed: { ...this.productionLedger.recipeConsumed }, delivered: { ...this.progression.delivered },
      stage: this.progression.stage, orderStarted: this.progression.orderStarted, orderCompleted: this.progression.orderCompleted,
      deliveryTicks: [...this.progression.deliveryTicks],
      projects: { active: this.progression.projects.active, accepted: { ...this.progression.projects.accepted } },
      ruleset: this.scenario === 'settlement' ? 'settlement-v1' : 'factory-v1',
      settlement: this.settlement?.serialize() ?? null,
    };
  }

  static restore(value: unknown): FactorySimulation {
    const source = saveObject(value);
    requireSave(source.scenario === 'guided' || source.scenario === 'free-play' || source.scenario === 'settlement', 'unknown scenario');
    const legacy = source.ruleset === undefined && source.scenario !== 'settlement';
    requireSave(legacy || source.ruleset === (source.scenario === 'settlement' ? 'settlement-v1' : 'factory-v1'), 'invalid factory ruleset');
    const world = restoreWorld(source.world);
    requireSave(source.scenario !== 'guided' || world.seed === GUIDED_SEED, 'invalid guided world seed');
    const sim = new FactorySimulation(new Map(), source.scenario, world);
    sim.ticks = saveCount(source.ticks);
    requireSave(typeof source.accumulator === 'number' && Number.isFinite(source.accumulator) &&
      source.accumulator >= 0 && source.accumulator < STEP_MS, 'invalid clock remainder');
    sim.accumulator = source.accumulator;
    sim.progression.stage = saveCount(source.stage);
    sim.progression.orderStarted = saveCount(source.orderStarted);
    sim.progression.orderCompleted = source.orderCompleted === null ? null : saveCount(source.orderCompleted);
    requireSave(sim.progression.stage <= ORDERS.length && sim.progression.orderStarted <= (sim.progression.orderCompleted ?? sim.ticks) &&
      (sim.progression.orderCompleted === null || sim.progression.orderCompleted <= sim.ticks), 'invalid objective timing');
    sim.recovered = saveInventory(source.recovered, legacy);
    sim.productionLedger.mined = saveInventory(source.mined, legacy);
    sim.productionLedger.smelted = saveInventory(source.smelted, legacy);
    sim.productionLedger.assembled = saveInventory(source.assembled, legacy);
    sim.productionLedger.recipeConsumed = saveInventory(source.recipeConsumed, legacy);
    sim.progression.delivered = saveInventory(source.delivered, legacy);
    if (source.projects !== undefined) {
      const projects = saveObject(source.projects);
      requireSave(projects.active === null || PROJECTS.some(project => project.id === projects.active), 'unknown project');
      const accepted = saveObject(projects.accepted);
      requireSave(Object.keys(accepted).length === PROJECTS.length, 'invalid project fields');
      for (const project of PROJECTS) {
        const count = saveCount(accepted[project.id]);
        requireSave(count <= project.quantity, 'project over quota');
        sim.progression.projects.accepted[project.id] = count;
      }
      sim.progression.projects.active = projects.active as ProjectId | null;
      requireSave(sim.progression.projects.active === null || !sim.projectComplete(sim.progression.projects.active), 'completed active project');
      requireSave(sim.projectsAvailable || sim.progression.projects.active === null && Object.values(sim.progression.projects.accepted).every(count => count === 0),
        'projects before commissioning');
    }
    requireSave(Array.isArray(source.machines) && source.machines.length <= world.size * world.size, 'invalid machine list');
    for (const entry of source.machines) {
      const machine = restoreMachine(entry, world, legacy);
      const { building } = machine;
      const fixedOutpost = building.kind === 'outpost' && building.direction === 0 &&
        (sim.scenario === 'guided' ? tileKey(building) === tileKey(OUTPOST)
          : source.projects !== undefined && !sim.receiver);
      requireSave(building.kind !== 'outpost' || fixedOutpost, 'invalid fixed outpost');
      requireSave(!building.upgraded || sim.projectComplete('extraction'), 'locked extractor upgrade');
      requireSave(!building.outputEnabled || sim.scenario === 'settlement' || sim.projectComplete('buffering'), 'locked depot output');
      requireSave(!building.haulTo || sim.scenario === 'settlement' && canHaulFrom(building.kind), 'invalid hauling source');
      const fixedHome = building.kind === 'home' && sim.scenario === 'settlement' && building.c === 11 && building.r === 12 && building.direction === 0;
      requireSave(building.kind !== 'home' || fixedHome, 'invalid founding home');
      requireSave(!(fixedOutpost ? placementError(building, building.kind, sim.placed, world)
        : fixedHome ? placementError(building, building.kind, sim.placed, world)
          : sim.placementError(building, building.kind)), 'invalid machine placement or locked building');
      const key = tileKey(building);
      sim.placed.set(key, building);
      sim.machines.set(key, machine);
    }
    requireSave(sim.scenario !== 'guided' || sim.placed.get(tileKey(OUTPOST))?.kind === 'outpost', 'missing outpost');
    if (sim.scenario === 'settlement') {
      requireSave(sim.machines.get('11,12')?.building.kind === 'home', 'missing founding home');
      sim.settlement = Settlement.restore(source.settlement, sim.settlementHost());
      requireSave(sim.settlement.state.mealClock === sim.ticks % MEAL_TICKS &&
        sim.settlement.state.consumedFood + sim.settlement.state.missedMeals === Math.floor(sim.ticks / MEAL_TICKS),
        'inconsistent resident consumption clock');
      for (const machine of sim.machines.values()) if (machine.building.haulTo) {
        requireSave(sim.machines.has(tileKey(machine.building.haulTo)), 'missing hauling target');
      }
    } else requireSave(source.settlement === undefined || source.settlement === null, 'residents in legacy factory');
    requireSave(sim.progression.projects.active === null && Object.values(sim.progression.projects.accepted).every(count => count === 0) || sim.receiver,
      'missing project receiver');
    requireSave(Array.isArray(source.lastSource) && source.lastSource.length <= sim.machines.size, 'invalid transfer history');
    for (const entry of source.lastSource) {
      requireSave(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' &&
        sim.machines.has(entry[0]) && !sim.lastSource.has(entry[0]), 'invalid transfer destination');
      const tile = saveTile(entry[1]);
      const destination = sim.machines.get(entry[0])!.building;
      requireSave(Math.abs(tile.c - destination.c) + Math.abs(tile.r - destination.r) === 1, 'nonadjacent transfer history');
      sim.lastSource.set(entry[0], tile);
    }
    requireSave(Array.isArray(source.deliveryTicks) && source.deliveryTicks.length <= 16, 'invalid delivery history');
    sim.progression.deliveryTicks = source.deliveryTicks.map(saveCount);
    const end = sim.progression.orderCompleted ?? sim.ticks;
    requireSave(sim.progression.deliveryTicks.every((tick, i) => tick > sim.progression.orderStarted && tick <= end &&
      tick > end - RATE_WINDOW_TICKS && (i === 0 || tick >= sim.progression.deliveryTicks[i - 1])), 'invalid delivery rate window');
    requireSave((sim.progression.stage === ORDERS.length) === (sim.progression.orderCompleted !== null), 'inconsistent completion');
    if (sim.scenario !== 'guided') {
      requireSave(sim.progression.stage === 0 && sim.progression.orderStarted === 0 && itemCount(sim.progression.delivered) === 0 &&
        sim.progression.deliveryTicks.length === 0, 'objectives in Free Play');
    } else {
      const copper = sim.progression.delivered['copper-plate'];
      const supplies = sim.progression.delivered['defense-supply'];
      requireSave(sim.progression.stage === 0 ? copper < 16 && supplies === 0 && sim.progression.orderStarted === 0
        : copper === 16 && (sim.progression.stage === 1 ? supplies < 12 : supplies === 12), 'inconsistent order or unlock');
      requireSave(sim.progression.deliveryTicks.length <= sim.progression.delivered[ORDERS[Math.min(sim.progression.stage, 1)].item], 'excess delivery history');
    }
    assertConservation(sim.machines.values(), sim.recovered, sim.productionLedger, sim.progression, sim.settlement?.state ?? null);
    return sim;
  }

  get assemblerUnlocked(): boolean {
    return this.progression.assemblerUnlocked(this.scenario);
  }

  get projectsAvailable(): boolean {
    return this.progression.available(this.scenario);
  }

  get receiver(): Tile | null {
    const building = [...this.placed.values()].find(building => building.kind === 'outpost');
    return building ? { c: building.c, r: building.r } : null;
  }

  projectComplete(id: ProjectId): boolean {
    return this.progression.projectComplete(id);
  }

  projectConsumed(item: Item): number {
    return this.progression.projectConsumed(item);
  }

  selectProject(id: ProjectId | null): string | null {
    if (!this.projectsAvailable) return 'Finish guided commissioning first';
    if (id !== null && (!PROJECTS.some(project => project.id === id) || this.projectComplete(id))) return 'Project already complete or unavailable';
    if (id !== null && !this.receiver) {
      let tile: Tile | null = null;
      for (let radius = 0; radius < this.world.size && !tile; radius++) {
        for (let c = Math.max(0, OUTPOST.c - radius); c <= Math.min(this.world.size - 1, OUTPOST.c + radius) && !tile; c++) {
          for (let r = Math.max(0, OUTPOST.r - radius); r <= Math.min(this.world.size - 1, OUTPOST.r + radius); r++) {
            if (Math.max(Math.abs(c - OUTPOST.c), Math.abs(r - OUTPOST.r)) !== radius) continue;
            const accessible = DIRECTIONS.some((vector, direction) => {
              const neighbor = { c: c - vector.c, r: r - vector.r };
              const source = this.placed.get(tileKey(neighbor));
              return source ? outputDirections(source).includes(direction as Direction)
                : !placementError(neighbor, 'belt', this.placed, this.world);
            });
            if (accessible && !placementError({ c, r }, 'outpost', this.placed, this.world)) { tile = { c, r }; break; }
          }
        }
      }
      if (!tile) return 'No clear tile available for a project receiver';
      this.addMachine({ ...tile, kind: 'outpost', direction: 0 });
    }
    this.progression.projects.active = id;
    return null;
  }

  setMachineOption(tile: Tile): string | null {
    const machine = this.machines.get(tileKey(tile));
    if (!machine) return 'Select an extractor or depot';
    const { building } = machine;
    if (building.kind === 'miner') {
      if (!this.projectComplete('extraction')) return 'Complete the extraction commission first';
      building.upgraded = !building.upgraded;
      machine.progress = Math.min(machine.progress, (building.upgraded ? UPGRADED_EXTRACT_TICKS : EXTRACT_TICKS) - 1);
    } else if (building.kind === 'storage') {
      if (this.scenario !== 'settlement' && !this.projectComplete('buffering')) return 'Complete the buffering commission first';
      building.outputEnabled = !building.outputEnabled;
      machine.progress = 0;
    } else return 'Select an extractor or depot';
    return null;
  }

  private activeDelivery(): { item: Item; quantity: number; accepted: number } | null {
    return this.progression.activeDelivery(this.scenario);
  }

  get buildings(): ReadonlyMap<string, Building> {
    return this.placed;
  }

  get residents(): readonly Resident[] {
    return this.settlement?.state.residents ?? [];
  }

  get interpolation(): number {
    return this.accumulator / STEP_MS;
  }

  getState(tile: Tile): Readonly<MachineState> | null {
    return this.machines.get(tileKey(tile)) ?? null;
  }

  inspectMachine(tile: Tile): MachineInspection {
    const machine = this.machines.get(tileKey(tile));
    if (!machine) throw new Error('Cannot inspect a missing building');
    const { kind } = machine.building;
    const recipe = machineRecipe(machine);
    const cycleTicks = machineCycleTicks(machine);
    const delivery = this.activeDelivery();
    const farmer = kind === 'food-plot' ? this.residents.find(resident =>
      resident.job?.kind === 'farm' && tileKey(resident.job.source) === tileKey(tile)) : null;
    const project = kind === 'miner' ? PROJECTS[0] : PROJECTS[1];
    return {
      machine, status: this.status(tile), inputCapacity: isConveyor(kind) ? 1 : inputCapacity(kind),
      outputCapacity: outputCapacity(kind),
      availableInput: kind === 'assembler' ? ASSEMBLER_RECIPE.inputs.reduce((sum, ingredient) =>
        sum + this.freeSlots(machine, ingredient.item), 0) : this.freeSlots(machine),
      recipe,
      cycleTicks,
      inputLimits: recipe?.inputs.map(ingredient => ({
        item: ingredient.item, capacity: inputCapacity(kind, ingredient.item),
      })) ?? [],
      deposit: kind === 'miner' ? this.world.at(machine.building).deposit : null,
      farmerName: farmer ? residentName(farmer.id) : null,
      population: this.residents.length,
      delivery,
      progress: kind === 'kitchen' ? machine.input['food-unit'] / inputCapacity(kind)
        : kind === 'storage' ? itemCount(machine.input) / inputCapacity(kind)
          : kind === 'outpost' ? delivery ? delivery.accepted / delivery.quantity : 0 : machine.progress / cycleTicks,
      nextStoredItem: kind === 'storage' ? depotNextItem(machine) : null,
      option: kind === 'miner' || kind === 'storage' ? {
        unlocked: kind === 'storage' && this.scenario === 'settlement' || this.projectComplete(project.id),
        enabled: !!(kind === 'miner' ? machine.building.upgraded : machine.building.outputEnabled), project,
      } : null,
    };
  }

  place(building: Building): string | null {
    const error = this.placementError(building, building.kind);
    if (error) return error;
    if (building.outputEnabled !== undefined || building.upgraded !== undefined || building.haulTo !== undefined) return 'Place first, then choose the machine option';
    this.addMachine(building);
    if (building.kind === 'food-plot' && this.settlement) {
      const kitchen = [...this.placed.values()].find(value => value.kind === 'kitchen');
      if (kitchen) this.machines.get(tileKey(building))!.building.haulTo = { c: kitchen.c, r: kitchen.r };
    }
    this.settlement?.layoutChanged();
    return null;
  }

  placementError(tile: Tile, kind: BuildingKind): string | null {
    if (kind === 'home') return 'The founding home stays in place';
    if (this.scenario !== 'settlement' && (kind === 'food-plot' || kind === 'kitchen')) return 'Start a settlement to build food infrastructure';
    if (this.settlement?.occupied(tile)) return 'A resident is using this tile';
    if (kind === 'outpost') return 'The outpost is fixed; it cannot be built or moved';
    if (kind === 'assembler' && !this.assemblerUnlocked) return 'Deliver 16 copper plates to the outpost to unlock the assembler';
    return placementError(tile, kind, this.placed, this.world);
  }

  private addMachine(building: Building): void {
    this.orderedMachines = null;
    const copy = { ...building };
    const key = tileKey(copy);
    this.placed.set(key, copy);
    this.machines.set(key, {
      building: copy, input: inventory(), output: inventory(), progress: 0,
      processing: null, lastProcessed: null, item: null, enteredFrom: copy.direction, nextOutput: 0, nextItem: 0, running: false,
    });
  }

  rotate(tile: Tile): Building['direction'] {
    const machine = this.machines.get(tileKey(tile));
    if (!machine) throw new Error('Cannot rotate a missing building');
    if (machine.building.kind === 'outpost' || machine.building.kind === 'home') throw new Error('Cannot rotate the fixed building');
    machine.building.direction = nextDirection(machine.building.direction);
    return machine.building.direction;
  }

  remove(tile: Tile): Inventory {
    const key = tileKey(tile);
    const machine = this.machines.get(key);
    if (!machine) throw new Error('Cannot remove a missing building');
    if (machine.building.kind === 'outpost' || machine.building.kind === 'home') throw new Error('Cannot remove the fixed building');
    const contents = recoverContents(machine, this.recovered);
    this.placed.delete(key);
    this.machines.delete(key);
    this.orderedMachines = null;
    this.lastSource.delete(key);
    for (const other of this.machines.values()) if (other.building.haulTo && tileKey(other.building.haulTo) === key) delete other.building.haulTo;
    this.settlement?.layoutChanged();
    return contents;
  }

  transferRecovered(tile: Tile): { moved: Inventory; remaining: Inventory } {
    const machine = this.machines.get(tileKey(tile));
    if (!machine || machine.building.kind !== 'storage') throw new Error('Recovered items need a selected depot');
    const moved = inventory();
    let slots = this.freeSlots(machine);
    for (const item of ITEMS) {
      const count = Math.min(slots, this.recovered[item]);
      moved[item] = count;
      moveInventory(this.recovered, machine.input, item, count);
      slots -= count;
    }
    return { moved, remaining: { ...this.recovered } };
  }

  setHaulTarget(source: Tile, target: Tile | null): string | null {
    if (!this.settlement) return 'Hauling is available in settlements';
    const machine = this.machines.get(tileKey(source));
    if (!machine || !canHaulFrom(machine.building.kind)) return 'Choose a production source or depot';
    if (target) {
      const destination = this.machines.get(tileKey(target));
      if (!destination || tileKey(source) === tileKey(target) ||
        !canHaulTo(destination.building.kind)) return 'Choose a kitchen, depot, or production input';
      machine.building.haulTo = { ...target };
    } else delete machine.building.haulTo;
    this.settlement.assignmentChanged(source);
    return null;
  }

  objective(): ObjectiveSummary | null {
    return this.progression.objective(this.scenario, this.ticks);
  }

  resetClock(): void {
    this.accumulator = 0;
  }

  advance(elapsedMs: number): boolean {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Factory elapsed time must be finite and nonnegative');
    // Discard long suspension gaps instead of fast-forwarding the factory on resume.
    this.accumulator += Math.min(elapsedMs, 250);
    let changed = false;
    while (this.accumulator + 0.000001 >= STEP_MS) {
      this.accumulator = Math.max(0, this.accumulator - STEP_MS);
      this.step();
      changed = true;
    }
    return changed;
  }

  step(): void {
    this.ticks++;
    const machines = this.orderedMachines ??= [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building));
    for (const machine of machines) produceMachine(machine, this.world, this.productionLedger);
    this.settlement?.step(this.ticks);
    transferMachines(machines, this.lastSource, this.transportHost);
    this.progression.update(this.scenario, this.ticks);
  }

  private receive(machine: MachineState, item: Item): void {
    if (machine.building.kind === 'outpost') {
      this.progression.accept(this.scenario, item, this.ticks);
    } else machine.input[item]++;
  }

  private destination(building: Building, direction = building.direction): MachineState | null {
    const vector = DIRECTIONS[direction];
    return this.machines.get(tileKey({ c: building.c + vector.c, r: building.r + vector.r })) ?? null;
  }

  private outgoing(machine: MachineState): Item | null {
    if (machine.building.kind === 'storage') {
      const item = machine.building.outputEnabled && machine.progress >= BELT_TICKS ? depotNextItem(machine) : null;
      return item && machine.input[item] > (this.settlement?.reservedSource(machine.building, item) ?? 0) ? item : null;
    }
    if (machine.building.kind === 'outpost' || machine.building.kind === 'home' || machine.building.kind === 'kitchen') return null;
    if (isConveyor(machine.building.kind)) return machine.progress >= BELT_TICKS ? machine.item : null;
    return ITEMS.find(item => machine.output[item] > (this.settlement?.reservedSource(machine.building, item) ?? 0)) ?? null;
  }

  private freeSlots(machine: MachineState, item: Item | null = null): number {
    const reserved = this.settlement?.reservedDestination(machine.building, item) ?? 0;
    switch (machine.building.kind) {
      case 'belt':
      case 'splitter': return machine.item ? 0 : 1;
      case 'outpost': {
        const order = this.activeDelivery();
        return order && item === order.item ? order.quantity - order.accepted : 0;
      }
      default: return inputSlots(machine, item, reserved);
    }
  }

  private accepts(machine: MachineState, source: Building, item: Item): boolean {
    if (machine.building.kind === 'outpost') return item === this.activeDelivery()?.item;
    if (isConveyor(machine.building.kind)) return acceptsConveyorInput(machine.building, source);
    return acceptsInventoryItem(machine.building.kind, item);
  }

  private blockage(machine: MachineState, item: Item | null, direction = machine.building.direction): string | null {
    const target = this.destination(machine.building, direction);
    if (!target) return 'Output disconnected';
    if (target.building.kind === 'outpost') {
      const order = this.activeDelivery();
      if (!order) return 'Order complete or project paused; items retained';
      if (item !== order.item) return `Outpost needs ${ITEM_NAMES[order.item].toLowerCase()}`;
    }
    if (item && !this.accepts(target, machine.building, item)) return 'Output incompatible';
    if (this.freeSlots(target, item) <= 0) return 'Output blocked';
    return null;
  }

  status(tile: Tile): string {
    const machine = this.machines.get(tileKey(tile));
    if (!machine) throw new Error('Cannot inspect a missing building');
    switch (machine.building.kind) {
      case 'home': return this.residents.length === 4 ? 'Four residents; farming and hauling automatically'
        : `${this.residents.length} residents; farming and hauling automatically`;
      case 'food-plot': {
        const worker = this.settlement?.state.residents.find(resident => resident.job?.kind === 'farm' &&
          tileKey(resident.job.source) === tileKey(tile));
        return !worker ? 'No farmer available or access blocked'
          : itemCount(machine.output) >= outputCapacity(machine.building.kind) ? 'Plot full; transport needed'
            : worker.job?.path.length ? 'Farmer approaching' : 'Growing food';
      }
      case 'kitchen': return machine.input['food-unit'] > 0 ? this.residents.length === 4 ? 'Provisioning four residents'
        : `Provisioning ${this.residents.length} residents` : 'Food shortage; residents keep working';
      case 'storage':
        if (!machine.building.outputEnabled) return this.freeSlots(machine) === 0 ? 'Depot full' : 'Receiving (storage only)';
        return !depotNextItem(machine) ? 'Waiting for stock'
          : this.blockage(machine, depotNextItem(machine)) ?? (machine.progress < BELT_TICKS ? 'Preparing output' : 'Ready to transfer');
      case 'belt':
        if (!machine.item) return 'Waiting for items';
        return machine.progress < BELT_TICKS ? 'Transporting' : this.blockage(machine, machine.item) ?? 'Ready to transfer';
      case 'splitter': {
        if (!machine.item) return 'Waiting for rear input';
        if (machine.progress < BELT_TICKS) return 'Transporting';
        const directions = outputDirections(machine.building);
        const preferred = directions[machine.nextOutput];
        const alternate = directions[machine.nextOutput === 0 ? 1 : 0];
        const blocked = this.blockage(machine, machine.item, preferred);
        const fallback = this.blockage(machine, machine.item, alternate);
        return !blocked ? `Ready to route ${DIRECTION_NAMES[preferred]}`
          : !fallback ? `Ready to route ${DIRECTION_NAMES[alternate]}` : `Both outputs blocked: ${blocked}; ${fallback}`;
      }
      case 'miner':
        return itemCount(machine.output) >= outputCapacity(machine.building.kind)
          ? this.blockage(machine, firstItem(machine.output)) ?? 'Output full' : 'Extracting';
      case 'furnace':
        if (itemCount(machine.output) >= outputCapacity(machine.building.kind)) return this.blockage(machine, firstItem(machine.output)) ?? 'Output full';
        return machine.processing || itemCount(machine.input) > 0 ? 'Smelting' : 'Waiting for ore';
      case 'assembler': {
        if (itemCount(machine.output) >= outputCapacity(machine.building.kind)) return this.blockage(machine, ASSEMBLER_RECIPE.output.item) ?? 'Output full';
        const missing = ASSEMBLER_RECIPE.inputs.filter(ingredient => machine.input[ingredient.item] < ingredient.quantity);
        if (missing.length === ASSEMBLER_RECIPE.inputs.length) return `Needs ${missing.map(ingredient =>
          `${ingredient.quantity} ${ingredient.item === 'iron-plate' ? 'iron' : 'copper'}`).join(' + ')} plate`;
        if (missing.length) return `Needs ${missing[0].quantity} ${ITEM_NAMES[missing[0].item].toLowerCase().replace(/s$/, missing[0].quantity === 1 ? '' : 's')}`;
        return 'Assembling';
      }
      case 'outpost':
        return this.activeDelivery() ? `Receiving ${ITEM_NAMES[this.activeDelivery()!.item].toLowerCase()}`
          : this.scenario === 'guided' ? 'Factory preparation complete; optional projects available' : 'No active project';
    }
  }

  summary(): FactorySummary {
    const stored = inventory();
    for (const machine of this.machines.values()) {
      if (machine.building.kind === 'storage') {
        for (const item of ITEMS) stored[item] += machine.input[item];
      }
    }
    return {
      stored, recovered: { ...this.recovered }, mined: { ...this.productionLedger.mined }, smelted: { ...this.productionLedger.smelted },
      assembled: { ...this.productionLedger.assembled }, recipeConsumed: { ...this.productionLedger.recipeConsumed }, delivered: { ...this.progression.delivered },
      objective: this.objective(), projects: { active: this.progression.projects.active, accepted: { ...this.progression.projects.accepted },
        available: this.projectsAvailable, receiver: this.receiver }, scenario: this.scenario, ticks: this.ticks,
      settlement: this.settlement?.serialize() ?? null,
    };
  }

  snapshot() {
    return {
      ...this.summary(),
      machines: [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building)).map(copyMachine),
      lastSource: [...this.lastSource.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, source]) => [key, { ...source }]),
    };
  }
}
