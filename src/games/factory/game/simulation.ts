import {
  BELT_TICKS,
  compareTiles,
  EXTRACT_TICKS,
  firstItem, inventory, Inventory, Item,
  itemCount, itemText,
  ITEMS,
  HOUSE_WOOD_COST,
  moveInventory,
  WorkPriority, WORK_PRIORITIES,
  STEP_MS, UPGRADED_EXTRACT_TICKS,
} from './domain';
import {
  acceptsInventoryItem, ASSEMBLER_RECIPE, canHaulBetween, depotNextItem, haulItems, inputCapacity, inputSlots,
  machineCycleTicks, producesInventoryItem,
  MachineRecipe, machineRecipe,
  MachineState,
  outputCapacity, produceMachine, ProductionLedger,
  recoverContents, transferMachines, TransportHost,
} from './machines';
import {
  acceptsConveyorInput, Building, BuildingKind, createSettlement,
  DIRECTION_NAMES,
  DIRECTIONS,
  isConveyor,
  nextDirection,
  NAMES,
  outputDirections, placementError, Tile, tileKey,
} from './model';
import { assertConservation, copyMachine, requireSave, restoreMachine, saveCount, saveInventory, saveObject, saveTile } from '../session/saveState';
import { requireCompatibleSave } from '../session/saveErrors';
import { HousingInspection, Resident, Settlement, SettlementSave, STARTER_FOOD } from './settlement';
import { gatheringAccess } from './gathering';
import { DEFAULT_WORLD, FactoryWorld, DEFAULT_SEED, restoreWorld, WorldIdentity } from './world';
export { BELT_TICKS, EXTRACT_TICKS, inventory, inventoryText, ITEM_NAMES, itemCount, ITEMS, STEP_MS, UPGRADED_EXTRACT_TICKS } from './domain';
export type { Inventory, Item } from './domain';
export { ASSEMBLE_TICKS, BUFFER_CAPACITY, DEPOT_CAPACITY, depotNextItem, SMELT_TICKS } from './machines';
export type { MachineState } from './machines';
export { requireSave, saveCount, saveObject, saveTile } from '../session/saveState';

export interface HaulDestination {
  building: Readonly<Building>;
  items: readonly Item[];
  full: boolean;
}

export interface HaulInspection {
  items: readonly Item[];
  destinations: readonly HaulDestination[];
  error: string | null;
}

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
  staffing: string | null;
  population: number;
  progress: number;
  nextStoredItem: Item | null;
  option: { enabled: boolean } | null;
  haul: HaulInspection | null;
  housing: HousingInspection | null;
}

export interface FactorySummary {
  stored: Inventory;
  recovered: Inventory;
  mined: Inventory;
  smelted: Inventory;
  assembled: Inventory;
  recipeConsumed: Inventory;
  ticks: number;
  settlement: SettlementSave;
}

export type ResourceLocation = {
  key: string;
  quantity: number;
  role: 'Stored' | 'In transit' | 'Produces and uses' | 'Produces' | 'Uses' | 'Holds' | 'Construction' | 'Installed';
  status: string;
} & ({ building: Readonly<Building>; residentId: null } | { building: null; residentId: number });

export interface ResourceInspection {
  item: Item;
  total: number;
  depots: number;
  buildings: number;
  inTransit: number;
  recovered: number;
  locations: ResourceLocation[];
}

export interface SimulationSave {
  world: WorldIdentity;
  ticks: number;
  accumulator: number;
  machines: MachineState[];
  lastSource: [string, Tile][];
  recovered: Inventory;
  mined: Inventory;
  smelted: Inventory;
  assembled: Inventory;
  recipeConsumed: Inventory;
  ruleset: 'settlement-v7';
  settlement: SettlementSave;
}

export class FactorySimulation {
  private placed = new Map<string, Building>();
  private machines = new Map<string, MachineState>();
  private lastSource = new Map<string, Tile>();
  private recovered = inventory();
  private accumulator = 0;
  private settlement: Settlement;
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

  constructor(readonly world: FactoryWorld = DEFAULT_WORLD) {
    for (const building of [...createSettlement().values()].sort(compareTiles)) {
      const error = placementError(building, building.kind, this.placed, this.world);
      if (error) throw new Error(`Invalid initial factory at ${tileKey(building)}: ${error}`);
      this.addMachine(building);
    }
    this.machines.get('14,12')!.input['food-unit'] = STARTER_FOOD;
    this.settlement = new Settlement(this.settlementHost());
  }

  static create(seed = DEFAULT_SEED): FactorySimulation {
    return new FactorySimulation(seed === DEFAULT_SEED ? DEFAULT_WORLD : new FactoryWorld(seed));
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
      receive: (machine: MachineState, item: Item) => this.receive(machine, item),
      ticks: () => this.ticks,
    };
  }

  serialize(): SimulationSave {
    return {
      world: this.world.identity(), ticks: this.ticks, accumulator: this.accumulator,
      machines: [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building)).map(copyMachine),
      lastSource: [...this.lastSource.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, source]) => [key, { ...source }]),
      recovered: { ...this.recovered }, mined: { ...this.productionLedger.mined }, smelted: { ...this.productionLedger.smelted },
      assembled: { ...this.productionLedger.assembled }, recipeConsumed: { ...this.productionLedger.recipeConsumed },
      ruleset: 'settlement-v7',
      settlement: this.settlement.serialize(),
    };
  }

  static restore(value: unknown): FactorySimulation {
    const source = saveObject(value);
    requireCompatibleSave(source.ruleset === 'settlement-v7', 'unsupported settlement ruleset');
    requireCompatibleSave(!['scenario', 'delivered', 'stage', 'orderStarted', 'orderCompleted', 'deliveryTicks', 'projects']
      .some(field => Object.hasOwn(source, field)), 'legacy factory fields');
    const world = restoreWorld(source.world);
    const sim = new FactorySimulation(world);
    sim.placed.clear();
    sim.machines.clear();
    sim.ticks = saveCount(source.ticks);
    requireSave(typeof source.accumulator === 'number' && Number.isFinite(source.accumulator) &&
      source.accumulator >= 0 && source.accumulator < STEP_MS, 'invalid clock remainder');
    sim.accumulator = source.accumulator;
    sim.recovered = saveInventory(source.recovered);
    sim.productionLedger.mined = saveInventory(source.mined);
    sim.productionLedger.smelted = saveInventory(source.smelted);
    sim.productionLedger.assembled = saveInventory(source.assembled);
    sim.productionLedger.recipeConsumed = saveInventory(source.recipeConsumed);
    requireSave(Array.isArray(source.machines) && source.machines.length <= world.size * world.size, 'invalid machine list');
    for (const entry of source.machines) {
      const machine = restoreMachine(entry, world);
      const { building } = machine;
      requireSave(!building.haulTo || haulItems(building, world).length > 0, 'invalid hauling source');
      const fixedHome = building.kind === 'home' && building.c === 11 && building.r === 12 && building.direction === 0;
      requireSave(building.kind !== 'home' || fixedHome, 'invalid founding home');
      requireSave(!placementError(building, building.kind, sim.placed, world), 'invalid machine placement');
      const key = tileKey(building);
      sim.placed.set(key, building);
      sim.machines.set(key, machine);
    }
    requireSave(sim.machines.get('11,12')?.building.kind === 'home', 'missing founding home');
    sim.settlement = Settlement.restore(source.settlement, sim.settlementHost());
    for (const machine of sim.machines.values()) if (machine.building.haulTo) {
      requireSave(sim.machines.has(tileKey(machine.building.haulTo)), 'missing hauling target');
    }
    requireSave(Array.isArray(source.lastSource) && source.lastSource.length <= sim.machines.size, 'invalid transfer history');
    for (const entry of source.lastSource) {
      requireSave(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' &&
        sim.machines.has(entry[0]) && !sim.lastSource.has(entry[0]), 'invalid transfer destination');
      const tile = saveTile(entry[1]);
      const destination = sim.machines.get(entry[0])!.building;
      requireSave(Math.abs(tile.c - destination.c) + Math.abs(tile.r - destination.r) === 1, 'nonadjacent transfer history');
      sim.lastSource.set(entry[0], tile);
    }
    assertConservation(sim.machines.values(), sim.recovered, sim.productionLedger, sim.settlement.state);
    return sim;
  }

  setMachineOption(tile: Tile): string | null {
    const machine = this.machines.get(tileKey(tile));
    if (!machine || machine.building.kind !== 'miner') return 'Select an extractor';
    const { building } = machine;
    building.upgraded = !building.upgraded;
    machine.progress = Math.min(machine.progress, (building.upgraded ? UPGRADED_EXTRACT_TICKS : EXTRACT_TICKS) - 1);
    return null;
  }

  get buildings(): ReadonlyMap<string, Building> {
    return this.placed;
  }

  get residents(): readonly Resident[] {
    return this.settlement.state.residents;
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
      staffing: haulItems(machine.building, this.world).length ? this.staffing(machine) : null,
      population: this.residents.length,
      progress: kind === 'kitchen' ? machine.input['food-unit'] / inputCapacity(kind)
        : kind === 'storage' || kind === 'house' ? itemCount(machine.input) / inputCapacity(kind)
          : machine.progress / cycleTicks,
      nextStoredItem: kind === 'storage' ? depotNextItem(machine) : null,
      option: kind === 'miner' ? { enabled: !!machine.building.upgraded } : null,
      haul: this.inspectHauling(machine),
      housing: kind === 'house' ? this.settlement.housing(tile) : null,
    };
  }

  place(building: Building): string | null {
    const error = this.placementError(building, building.kind);
    if (error) return error;
    if (building.upgraded !== undefined || building.haulTo !== undefined || building.workPriority !== undefined) return 'Place first, then choose the machine option';
    this.addMachine(building);
    if (building.kind === 'food-plot') {
      const kitchen = [...this.placed.values()].find(value => value.kind === 'kitchen');
      if (kitchen) this.machines.get(tileKey(building))!.building.haulTo = { c: kitchen.c, r: kitchen.r };
    }
    this.settlement.layoutChanged();
    return null;
  }

  placementError(tile: Tile, kind: BuildingKind): string | null {
    if (kind === 'home') return 'The homestead stays in place';
    if (this.settlement.occupied(tile)) return 'A resident is using this tile';
    const error = placementError(tile, kind, this.placed, this.world);
    if (error) return error;
    if (this.settlement.blocksExit(tile)) return 'Leave a clear exit beside the occupied work site.';
    return kind === 'woodcutting-site' && !gatheringAccess(tile, this.placed, this.world).length
      ? 'No accessible trees nearby. Choose clear land beside a grove.' : null;
  }

  setWorkPriority(tile: Tile, priority: WorkPriority): string | null {
    const machine = this.machines.get(tileKey(tile));
    if (!machine || !haulItems(machine.building, this.world).length) return 'Choose a building with resident work';
    if (!WORK_PRIORITIES.includes(priority)) return 'Choose Low, Normal or High';
    machine.building.workPriority = priority;
    return null;
  }

  private staffing(machine: MachineState): string {
    const workers = this.residents.filter(resident => resident.job &&
      tileKey(resident.job.source) === tileKey(machine.building));
    if (workers.length) return `Working · ${workers.length} ${workers.length === 1 ? 'resident' : 'residents'}`;
    const { kind } = machine.building;
    if (kind === 'food-plot' || kind === 'woodcutting-site') {
      const item = kind === 'food-plot' ? 'food-unit' : 'wood';
      if (machine.output[item] >= outputCapacity(kind)) return 'Output full';
      if (kind === 'woodcutting-site' && !gatheringAccess(machine.building, this.buildings, this.world).length) return 'Grove access blocked';
      return 'Waiting for a resident or a clear path';
    }
    if (this.settlementHost().automated(machine)) return 'Delivery handled by conveyors';
    const target = machine.building.haulTo;
    if (!target) return 'No delivery destination';
    const destination = this.machines.get(tileKey(target));
    const stock = kind === 'storage' ? machine.input : machine.output;
    if (!destination || !ITEMS.some(item => stock[item] > 0 && acceptsInventoryItem(destination.building.kind, item)))
      return 'Waiting for matching goods';
    if (!ITEMS.some(item => stock[item] > 0 && acceptsInventoryItem(destination.building.kind, item) &&
      this.freeSlots(destination, item) > 0)) return 'Destination full';
    return 'Waiting for a resident or a clear path';
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
    if (machine.building.kind === 'home') throw new Error('Cannot rotate the fixed building');
    machine.building.direction = nextDirection(machine.building.direction);
    return machine.building.direction;
  }

  remove(tile: Tile): Inventory {
    const key = tileKey(tile);
    const machine = this.machines.get(key);
    if (!machine) throw new Error('Cannot remove a missing building');
    if (machine.building.kind === 'home') throw new Error('Cannot remove the fixed building');
    const error = this.removalError(tile);
    if (error) throw new Error(error);
    if (machine.building.kind === 'kitchen') this.settlement.foodRemoved(machine.input['food-unit']);
    const contents = recoverContents(machine, this.recovered);
    this.placed.delete(key);
    this.machines.delete(key);
    this.orderedMachines = null;
    this.lastSource.delete(key);
    for (const other of this.machines.values()) if (other.building.haulTo && tileKey(other.building.haulTo) === key) delete other.building.haulTo;
    this.settlement.layoutChanged();
    return contents;
  }

  removalError(tile: Tile): string | null {
    const building = this.placed.get(tileKey(tile));
    if (building?.kind === 'home') return 'The homestead stays in place.';
    return building?.kind === 'house' && this.residents.some(resident => tileKey(resident.home) === tileKey(tile))
      ? 'House occupied. Residents need their home.' : null;
  }

  inviteResident(tile: Tile): string | null {
    if (this.placed.get(tileKey(tile))?.kind !== 'house') return 'Select a house first.';
    return this.settlement.invite(tile);
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
    const machine = this.machines.get(tileKey(source));
    if (!machine || !haulItems(machine.building, this.world).length) return 'Choose a source of goods';
    if (target) {
      const error = this.haulDestinationError(machine.building, target);
      if (error) return error;
      machine.building.haulTo = { c: target.c, r: target.r };
    } else delete machine.building.haulTo;
    this.settlement.assignmentChanged(source);
    return null;
  }

  private haulDestinationError(source: Building, target: Tile): string | null {
    const destination = this.machines.get(tileKey(target));
    if (!destination || tileKey(source) === tileKey(target)) {
      return 'Choose another destination';
    }
    return canHaulBetween(source, destination.building, this.world) ? null
      : `${NAMES[destination.building.kind]} cannot accept goods from this ${NAMES[source.kind].toLowerCase()}. Choose another destination.`;
  }

  private inspectHauling(machine: Readonly<MachineState>): HaulInspection | null {
    const source = machine.building;
    const items = haulItems(source, this.world);
    if (!items.length) return null;
    const destinations = [...this.machines.values()].filter(target => canHaulBetween(source, target.building, this.world))
      .sort((a, b) => compareTiles(a.building, b.building)).map(target => {
        const matching = items.filter(item => acceptsInventoryItem(target.building.kind, item));
        return { building: target.building, items: matching, full: matching.every(item => this.freeSlots(target, item) <= 0) };
      });
    return {
      items, destinations,
      // Keep previously saved routes visible so the player can repair them without losing their settlement.
      error: source.haulTo ? this.haulDestinationError(source, source.haulTo) : null,
    };
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
    this.settlement.step();
    transferMachines(machines, this.lastSource, this.transportHost);
  }

  private receive(machine: MachineState, item: Item): void {
    machine.input[item]++;
    if (machine.building.kind === 'kitchen' && item === 'food-unit') this.settlement.foodDelivered();
  }

  private destination(building: Building, direction = building.direction): MachineState | null {
    const vector = DIRECTIONS[direction];
    return this.machines.get(tileKey({ c: building.c + vector.c, r: building.r + vector.r })) ?? null;
  }

  private outgoing(machine: MachineState): Item | null {
    if (machine.building.kind === 'storage') {
      const item = machine.progress >= BELT_TICKS ? depotNextItem(machine) : null;
      return item && machine.input[item] > this.settlement.reservedSource(machine.building, item) ? item : null;
    }
    if (machine.building.kind === 'home' || machine.building.kind === 'kitchen') return null;
    if (isConveyor(machine.building.kind)) return machine.progress >= BELT_TICKS ? machine.item : null;
    return ITEMS.find(item => machine.output[item] > this.settlement.reservedSource(machine.building, item)) ?? null;
  }

  private freeSlots(machine: MachineState, item: Item | null = null): number {
    const reserved = this.settlement.reservedDestination(machine.building, item);
    switch (machine.building.kind) {
      case 'belt':
      case 'splitter': return machine.item ? 0 : 1;
      default: return inputSlots(machine, item, reserved);
    }
  }

  private accepts(machine: MachineState, source: Building, item: Item): boolean {
    if (isConveyor(machine.building.kind)) return acceptsConveyorInput(machine.building, source);
    return acceptsInventoryItem(machine.building.kind, item);
  }

  private blockage(machine: MachineState, item: Item | null, direction = machine.building.direction): string | null {
    const target = this.destination(machine.building, direction);
    if (!target) return 'Output disconnected';
    if (item && !this.accepts(target, machine.building, item)) return 'Output incompatible';
    if (this.freeSlots(target, item) <= 0) return 'Output blocked';
    return null;
  }

  status(tile: Tile): string {
    const machine = this.machines.get(tileKey(tile));
    if (!machine) throw new Error('Cannot inspect a missing building');
    switch (machine.building.kind) {
      case 'home': return `${this.residents.length} residents sharing the work`;
      case 'house': return machine.input.wood < HOUSE_WOOD_COST
        ? `Building house · ${machine.input.wood}/${HOUSE_WOOD_COST} wood`
        : this.residents.some(resident => tileKey(resident.home) === tileKey(tile)) ? 'House occupied' : 'House ready';
      case 'food-plot': {
        const worker = this.settlement.state.residents.find(resident => resident.job?.kind === 'farm' &&
          tileKey(resident.job.source) === tileKey(tile));
        return itemCount(machine.output) >= outputCapacity(machine.building.kind) ? 'Plot full · waiting for transport'
          : !worker ? 'Waiting for a resident or a clear path'
            : worker.job?.path.length ? 'On the way to the plot' : 'Growing food';
      }
      case 'woodcutting-site': {
        const worker = this.residents.find(resident => (resident.job?.kind === 'gather' || resident.job?.kind === 'return-wood') &&
          tileKey(resident.job.source) === tileKey(tile));
        if (itemCount(machine.output) >= outputCapacity(machine.building.kind)) return 'Site full · waiting for transport';
        if (!worker) return gatheringAccess(tile, this.buildings, this.world).length ? 'Waiting for a resident or a clear path' : 'Grove access blocked';
        if (worker.job?.kind === 'return-wood') return 'Taking wood back to the site';
        if (worker.job?.kind === 'gather') {
          return worker.job.path.length ? 'On the way to the grove' : 'Gathering wood';
        }
        return worker.note;
      }
      case 'kitchen': return machine.input['food-unit'] > 0 ? 'Kitchen stocked' : 'Food shortage · residents keep working';
      case 'storage':
        if (!this.destination(machine.building)) return this.freeSlots(machine) === 0 ? 'Depot full' : 'Storing goods';
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
        const reason = (value: string) => value === 'Output disconnected' ? 'not connected'
          : value === 'Output incompatible' ? 'incompatible' : 'full';
        return !blocked ? `Ready to route ${DIRECTION_NAMES[preferred]}`
          : !fallback ? `Ready to route ${DIRECTION_NAMES[alternate]}`
            : blocked === fallback ? `Both outputs ${reason(blocked)}`
              : `${DIRECTION_NAMES[preferred]}: ${reason(blocked)} · ${DIRECTION_NAMES[alternate]}: ${reason(fallback)}`;
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
        if (missing.length) return `Needs ${missing.map(ingredient => itemText(ingredient.item, ingredient.quantity)).join(' + ')}`;
        return 'Assembling';
      }
    }
  }

  inspectResources(): ResourceInspection[] {
    const resources: ResourceInspection[] = ITEMS.map(item => ({
      item, total: 0, depots: 0, buildings: 0, inTransit: 0,
      recovered: this.recovered[item], locations: [],
    }));
    for (const machine of this.machines.values()) {
      const building = machine.building;
      const deposit = this.world.at(building).deposit;
      const status = this.status(building);
      const routeError = building.haulTo ? this.haulDestinationError(building, building.haulTo) : null;
      const haulTarget = building.haulTo ? this.machines.get(tileKey(building.haulTo)) : null;
      for (const resource of resources) {
        const item = resource.item;
        const quantity = machine.input[item] + machine.output[item] + (machine.item === item ? 1 : 0);
        const produces = producesInventoryItem(building.kind, item, deposit);
        const consumes = building.kind !== 'storage' && acceptsInventoryItem(building.kind, item);
        if (building.kind === 'storage') resource.depots += quantity;
        else if (isConveyor(building.kind)) resource.inTransit += quantity;
        else resource.buildings += quantity;
        if (!quantity && !produces && !consumes && building.kind !== 'storage') continue;
        resource.locations.push({
          key: tileKey(building), building: { ...building }, residentId: null, quantity,
          role: building.kind === 'house' ? quantity === HOUSE_WOOD_COST ? 'Installed' : 'Construction'
            : building.kind === 'storage' ? 'Stored'
            : isConveyor(building.kind) ? 'In transit'
              : produces && consumes ? 'Produces and uses' : produces ? 'Produces' : consumes ? 'Uses' : 'Holds',
          status: routeError ? `${status} · ${routeError}`
            : haulTarget && acceptsInventoryItem(haulTarget.building.kind, item) && this.freeSlots(haulTarget, item) <= 0
              ? `${status} · Delivery destination full` : status,
        });
      }
    }
    for (const resident of this.residents) {
      if (!resident.cargo) continue;
      const resource = resources.find(value => value.item === resident.cargo)!;
      resource.inTransit++;
      resource.locations.push({
        key: `resident:${resident.id}`, building: null, residentId: resident.id, quantity: 1,
        role: 'In transit', status: resident.note,
      });
    }
    for (const resource of resources) {
      resource.total = resource.depots + resource.buildings + resource.inTransit + resource.recovered;
      resource.locations.sort((a, b) => b.quantity - a.quantity || a.key.localeCompare(b.key));
    }
    return resources;
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
      assembled: { ...this.productionLedger.assembled }, recipeConsumed: { ...this.productionLedger.recipeConsumed }, ticks: this.ticks,
      settlement: this.settlement.serialize(),
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
