import {
  Building, BuildingKind, createGuided, DIRECTIONS, nextDirection, OUTPOST,
  inBounds, isBuildingKind, placementError, Scenario, terrainAt, Tile, tileKey,
} from './model';
import { DEFAULT_WORLD, FactoryWorld, GUIDED_SEED, restoreWorld, WorldIdentity } from './world';

export const STEP_MS = 100;
export const EXTRACT_TICKS = 10;
export const SMELT_TICKS = 16;
export const BELT_TICKS = 8;
export const BUFFER_CAPACITY = 4;
export const DEPOT_CAPACITY = 64;
export const ASSEMBLE_TICKS = 20;
export const RATE_WINDOW_TICKS = 300;

export const ITEMS = ['iron-ore', 'copper-ore', 'iron-plate', 'copper-plate', 'defense-supply'] as const;
export type Item = typeof ITEMS[number];
type Ore = 'iron-ore' | 'copper-ore';
export type Inventory = Record<Item, number>;
export const ITEM_NAMES: Record<Item, string> = {
  'iron-ore': 'Iron ore', 'copper-ore': 'Copper ore',
  'iron-plate': 'Iron plates', 'copper-plate': 'Copper plates',
  'defense-supply': 'Defense supplies',
};

export const ORDERS = [
  { title: 'Copper commissioning', item: 'copper-plate', quantity: 16, reward: 'Unlock the assembler' },
  { title: 'Factory preparation', item: 'defense-supply', quantity: 12, reward: 'Complete factory preparation' },
] as const;

export interface ObjectiveSummary {
  stage: number;
  title: string;
  item: Item;
  quantity: number;
  accepted: number;
  reward: string;
  complete: boolean;
  assemblerUnlocked: boolean;
  rate: number;
  windowSeconds: number;
}

export interface MachineState {
  building: Building;
  input: Inventory;
  output: Inventory;
  progress: number;
  processing: Ore | null;
  lastProcessed: Ore | null;
  item: Item | null;
  enteredFrom: Building['direction'];
  running: boolean;
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
  scenario: Scenario;
  ticks: number;
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
}

export function requireSave(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Corrupt factory save: ${message}`);
}

export function saveObject(value: unknown): Record<string, unknown> {
  requireSave(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected an object');
  return value as Record<string, unknown>;
}

function saveCount(value: unknown): number {
  requireSave(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, 'invalid item count or tick');
  return value;
}

function saveInventory(value: unknown): Inventory {
  const source = saveObject(value);
  const result = inventory();
  requireSave(Object.keys(source).length === ITEMS.length, 'invalid inventory fields');
  for (const item of ITEMS) result[item] = saveCount(source[item]);
  requireSave(Number.isSafeInteger(itemCount(result)), 'inventory overflow');
  return result;
}

function saveTile(value: unknown): Tile {
  const source = saveObject(value);
  const tile = { c: saveCount(source.c), r: saveCount(source.r) };
  requireSave(inBounds(tile), 'tile outside the map');
  return tile;
}

function saveDirection(value: unknown): Building['direction'] {
  requireSave(value === 0 || value === 1 || value === 2 || value === 3, 'invalid direction');
  return value;
}

function saveOre(value: unknown): Ore | null {
  requireSave(value === null || value === 'iron-ore' || value === 'copper-ore', 'invalid smelter recipe');
  return value;
}

function saveMachine(value: unknown, world: FactoryWorld): MachineState {
  const source = saveObject(value);
  const building = saveObject(source.building);
  requireSave(typeof building.kind === 'string' && (isBuildingKind(building.kind) || building.kind === 'outpost'), 'unknown machine');
  const machine: MachineState = {
    building: { ...saveTile(building), kind: building.kind, direction: saveDirection(building.direction) },
    input: saveInventory(source.input), output: saveInventory(source.output),
    progress: saveCount(source.progress), processing: saveOre(source.processing), lastProcessed: saveOre(source.lastProcessed),
    item: null, enteredFrom: saveDirection(source.enteredFrom), running: false,
  };
  requireSave(source.item === null || typeof source.item === 'string' && ITEMS.some(item => item === source.item), 'unknown cargo');
  machine.item = source.item as Item | null;
  requireSave(typeof source.running === 'boolean', 'invalid machine activity');
  machine.running = source.running;
  const { kind } = machine.building;
  const inputItems: readonly Item[] = kind === 'furnace' ? ['iron-ore', 'copper-ore']
    : kind === 'assembler' ? ['iron-plate', 'copper-plate'] : kind === 'storage' ? ITEMS : [];
  const outputItems: readonly Item[] = kind === 'miner'
    ? [terrainAt(machine.building, world) === 'copper' ? 'copper-ore' : 'iron-ore']
    : kind === 'furnace' ? ['iron-plate', 'copper-plate'] : kind === 'assembler' ? ['defense-supply'] : [];
  for (const item of ITEMS) {
    requireSave(inputItems.includes(item) || machine.input[item] === 0, 'incompatible machine input');
    requireSave(outputItems.includes(item) || machine.output[item] === 0, 'incompatible machine output');
  }
  requireSave(itemCount(machine.output) <= BUFFER_CAPACITY, 'machine output over capacity');
  requireSave(kind === 'assembler' ? machine.input['iron-plate'] <= 4 && machine.input['copper-plate'] <= 4
    : itemCount(machine.input) <= (kind === 'storage' ? DEPOT_CAPACITY : BUFFER_CAPACITY), 'machine input over capacity');
  requireSave(kind === 'belt' || machine.item === null, 'cargo outside a conveyor');
  requireSave(kind === 'furnace' || machine.processing === null && machine.lastProcessed === null, 'recipe outside a smelter');
  requireSave(!machine.processing || machine.input[machine.processing] > 0, 'smelter recipe missing its input');
  const max = kind === 'belt' ? BELT_TICKS + 1 : kind === 'miner' ? EXTRACT_TICKS
    : kind === 'furnace' ? SMELT_TICKS : kind === 'assembler' ? ASSEMBLE_TICKS : 1;
  requireSave(machine.progress < max, 'invalid machine progress');
  requireSave(kind !== 'belt' || machine.item !== null || machine.progress === 0, 'empty conveyor in progress');
  requireSave(kind !== 'furnace' || machine.processing !== null || machine.progress === 0, 'smelter missing its recipe');
  requireSave(kind !== 'assembler' || machine.progress === 0 || machine.input['iron-plate'] >= 2 && machine.input['copper-plate'] >= 1,
    'assembler missing its recipe inputs');
  return machine;
}

export function inventory(): Inventory {
  return { 'iron-ore': 0, 'copper-ore': 0, 'iron-plate': 0, 'copper-plate': 0, 'defense-supply': 0 };
}

export function itemCount(items: Readonly<Inventory>): number {
  return ITEMS.reduce((sum, item) => sum + items[item], 0);
}

export function inventoryText(items: Readonly<Inventory>): string {
  return ITEMS.filter(item => items[item] > 0).map(item => `${items[item]} ${ITEM_NAMES[item].toLowerCase()}`).join(', ') || 'Empty';
}

function compareTiles(a: Tile, b: Tile): number {
  return a.c - b.c || a.r - b.r;
}

function firstItem(items: Inventory): Item | null {
  return ITEMS.find(item => items[item] > 0) ?? null;
}

function isOre(item: Item): item is Ore {
  return item === 'iron-ore' || item === 'copper-ore';
}

function plateFor(ore: Ore): Item {
  return ore === 'iron-ore' ? 'iron-plate' : 'copper-plate';
}

export class FactorySimulation {
  private placed = new Map<string, Building>();
  private machines = new Map<string, MachineState>();
  private lastSource = new Map<string, Tile>();
  private recovered = inventory();
  private mined = inventory();
  private smelted = inventory();
  private assembled = inventory();
  private recipeConsumed = inventory();
  private delivered = inventory();
  private stage = 0;
  private orderStarted = 0;
  private orderCompleted: number | null = null;
  private deliveryTicks: number[] = [];
  private accumulator = 0;
  ticks = 0;

  constructor(buildings: ReadonlyMap<string, Building> = new Map(), readonly scenario: Scenario = 'free-play',
    readonly world: FactoryWorld = DEFAULT_WORLD) {
    for (const building of [...buildings.values()].sort(compareTiles)) {
      const error = building.kind === 'outpost' && scenario === 'guided' && tileKey(building) === tileKey(OUTPOST)
        ? placementError(building, building.kind, this.placed, this.world) : this.placementError(building, building.kind);
      if (error) throw new Error(`Invalid initial factory at ${tileKey(building)}: ${error}`);
      this.addMachine(building);
    }
  }

  static forScenario(scenario: Scenario, seed = GUIDED_SEED): FactorySimulation {
    const world = seed === GUIDED_SEED || scenario === 'guided' ? DEFAULT_WORLD : new FactoryWorld(seed);
    return new FactorySimulation(scenario === 'guided' ? createGuided() : new Map(), scenario, world);
  }

  serialize(): SimulationSave {
    return {
      world: this.world.identity(), scenario: this.scenario, ticks: this.ticks, accumulator: this.accumulator,
      machines: [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building)).map(machine => ({
        ...machine, building: { ...machine.building }, input: { ...machine.input }, output: { ...machine.output },
      })),
      lastSource: [...this.lastSource.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, source]) => [key, { ...source }]),
      recovered: { ...this.recovered }, mined: { ...this.mined }, smelted: { ...this.smelted },
      assembled: { ...this.assembled }, recipeConsumed: { ...this.recipeConsumed }, delivered: { ...this.delivered },
      stage: this.stage, orderStarted: this.orderStarted, orderCompleted: this.orderCompleted,
      deliveryTicks: [...this.deliveryTicks],
    };
  }

  static restore(value: unknown): FactorySimulation {
    const source = saveObject(value);
    requireSave(source.scenario === 'guided' || source.scenario === 'free-play', 'unknown scenario');
    const world = restoreWorld(source.world);
    requireSave(source.scenario !== 'guided' || world.seed === GUIDED_SEED, 'invalid guided world seed');
    const sim = new FactorySimulation(new Map(), source.scenario, world);
    sim.ticks = saveCount(source.ticks);
    requireSave(typeof source.accumulator === 'number' && Number.isFinite(source.accumulator) &&
      source.accumulator >= 0 && source.accumulator < STEP_MS, 'invalid clock remainder');
    sim.accumulator = source.accumulator;
    sim.stage = saveCount(source.stage);
    sim.orderStarted = saveCount(source.orderStarted);
    sim.orderCompleted = source.orderCompleted === null ? null : saveCount(source.orderCompleted);
    requireSave(sim.stage <= ORDERS.length && sim.orderStarted <= (sim.orderCompleted ?? sim.ticks) &&
      (sim.orderCompleted === null || sim.orderCompleted <= sim.ticks), 'invalid objective timing');
    sim.recovered = saveInventory(source.recovered);
    sim.mined = saveInventory(source.mined);
    sim.smelted = saveInventory(source.smelted);
    sim.assembled = saveInventory(source.assembled);
    sim.recipeConsumed = saveInventory(source.recipeConsumed);
    sim.delivered = saveInventory(source.delivered);
    requireSave(Array.isArray(source.machines) && source.machines.length <= world.size * world.size, 'invalid machine list');
    for (const entry of source.machines) {
      const machine = saveMachine(entry, world);
      const { building } = machine;
      const fixedOutpost = building.kind === 'outpost' && sim.scenario === 'guided' &&
        tileKey(building) === tileKey(OUTPOST) && building.direction === 0;
      requireSave(building.kind !== 'outpost' || fixedOutpost, 'invalid fixed outpost');
      requireSave(!(fixedOutpost ? placementError(building, building.kind, sim.placed, world)
        : sim.placementError(building, building.kind)), 'invalid machine placement or locked building');
      const key = tileKey(building);
      sim.placed.set(key, building);
      sim.machines.set(key, machine);
    }
    requireSave(sim.scenario !== 'guided' || sim.placed.get(tileKey(OUTPOST))?.kind === 'outpost', 'missing outpost');
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
    sim.deliveryTicks = source.deliveryTicks.map(saveCount);
    const end = sim.orderCompleted ?? sim.ticks;
    requireSave(sim.deliveryTicks.every((tick, i) => tick > sim.orderStarted && tick <= end &&
      tick > end - RATE_WINDOW_TICKS && (i === 0 || tick >= sim.deliveryTicks[i - 1])), 'invalid delivery rate window');
    requireSave((sim.stage === ORDERS.length) === (sim.orderCompleted !== null), 'inconsistent completion');
    for (const item of ITEMS) {
      requireSave(item.endsWith('-ore') || sim.mined[item] === 0, 'invalid extraction ledger');
      requireSave(item.endsWith('-plate') || sim.smelted[item] === 0 && sim.recipeConsumed[item] === 0, 'invalid recipe ledger');
      requireSave(item === 'defense-supply' || sim.assembled[item] === 0, 'invalid assembly ledger');
      requireSave(item === 'copper-plate' || item === 'defense-supply' || sim.delivered[item] === 0, 'invalid delivery ledger');
    }
    if (sim.scenario === 'free-play') {
      requireSave(sim.stage === 0 && sim.orderStarted === 0 && itemCount(sim.delivered) === 0 &&
        sim.deliveryTicks.length === 0, 'objectives in Free Play');
    } else {
      const copper = sim.delivered['copper-plate'];
      const supplies = sim.delivered['defense-supply'];
      requireSave(sim.stage === 0 ? copper < 16 && supplies === 0 && sim.orderStarted === 0
        : copper === 16 && (sim.stage === 1 ? supplies < 12 : supplies === 12), 'inconsistent order or unlock');
      requireSave(sim.deliveryTicks.length <= sim.delivered[ORDERS[Math.min(sim.stage, 1)].item], 'excess delivery history');
    }
    const held = { ...sim.recovered };
    for (const machine of sim.machines.values()) {
      for (const item of ITEMS) held[item] += machine.input[item] + machine.output[item];
      if (machine.item) held[machine.item]++;
    }
    for (const metal of ['iron', 'copper'] as const) {
      const ore = `${metal}-ore` as const;
      const plate = `${metal}-plate` as const;
      requireSave(held[ore] + sim.smelted[plate] === sim.mined[ore] &&
        held[plate] + sim.delivered[plate] + sim.recipeConsumed[plate] === sim.smelted[plate], 'material accounting mismatch');
    }
    requireSave(held['defense-supply'] + sim.delivered['defense-supply'] === sim.assembled['defense-supply'] &&
      sim.recipeConsumed['iron-plate'] === sim.assembled['defense-supply'] * 2 &&
      sim.recipeConsumed['copper-plate'] === sim.assembled['defense-supply'], 'assembly accounting mismatch');
    return sim;
  }

  get assemblerUnlocked(): boolean {
    return this.scenario === 'free-play' || this.stage >= 1;
  }

  get buildings(): ReadonlyMap<string, Building> {
    return this.placed;
  }

  get interpolation(): number {
    return this.accumulator / STEP_MS;
  }

  getState(tile: Tile): Readonly<MachineState> | null {
    return this.machines.get(tileKey(tile)) ?? null;
  }

  place(building: Building): string | null {
    const error = this.placementError(building, building.kind);
    if (error) return error;
    this.addMachine(building);
    return null;
  }

  placementError(tile: Tile, kind: BuildingKind): string | null {
    if (kind === 'outpost') return 'The outpost is fixed; it cannot be built or moved';
    if (kind === 'assembler' && !this.assemblerUnlocked) return 'Deliver 16 copper plates to the outpost to unlock the assembler';
    return placementError(tile, kind, this.placed, this.world);
  }

  private addMachine(building: Building): void {
    const copy = { ...building };
    const key = tileKey(copy);
    this.placed.set(key, copy);
    this.machines.set(key, {
      building: copy, input: inventory(), output: inventory(), progress: 0,
      processing: null, lastProcessed: null, item: null, enteredFrom: copy.direction, running: false,
    });
  }

  rotate(tile: Tile): Building['direction'] {
    const machine = this.machines.get(tileKey(tile));
    if (!machine) throw new Error('Cannot rotate a missing building');
    if (machine.building.kind === 'outpost') throw new Error('Cannot rotate the fixed outpost');
    machine.building.direction = nextDirection(machine.building.direction);
    return machine.building.direction;
  }

  remove(tile: Tile): Inventory {
    const key = tileKey(tile);
    const machine = this.machines.get(key);
    if (!machine) throw new Error('Cannot remove a missing building');
    if (machine.building.kind === 'outpost') throw new Error('Cannot remove the fixed outpost');
    const contents = inventory();
    for (const item of ITEMS) contents[item] = machine.input[item] + machine.output[item];
    if (machine.item) contents[machine.item]++;
    for (const item of ITEMS) this.recovered[item] += contents[item];
    this.placed.delete(key);
    this.machines.delete(key);
    this.lastSource.delete(key);
    return contents;
  }

  transferRecovered(tile: Tile): { moved: Inventory; remaining: Inventory } {
    const machine = this.machines.get(tileKey(tile));
    if (!machine || machine.building.kind !== 'storage') throw new Error('Recovered items need a selected depot');
    const moved = inventory();
    let slots = DEPOT_CAPACITY - itemCount(machine.input);
    for (const item of ITEMS) {
      const count = Math.min(slots, this.recovered[item]);
      moved[item] = count;
      machine.input[item] += count;
      this.recovered[item] -= count;
      slots -= count;
    }
    return { moved, remaining: { ...this.recovered } };
  }

  objective(): ObjectiveSummary | null {
    if (this.scenario !== 'guided') return null;
    const complete = this.stage === ORDERS.length;
    const order = ORDERS[complete ? ORDERS.length - 1 : this.stage];
    const end = this.orderCompleted ?? this.ticks;
    const window = Math.min(RATE_WINDOW_TICKS, end - this.orderStarted);
    const count = this.deliveryTicks.filter(tick => tick > end - window).length;
    return {
      stage: this.stage, ...order, accepted: this.delivered[order.item], complete,
      assemblerUnlocked: this.assemblerUnlocked,
      rate: window ? count * 600 / window : 0, windowSeconds: window * STEP_MS / 1000,
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
    const machines = [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building));
    for (const machine of machines) this.produce(machine);

    const proposals = new Map<string, { source: MachineState; destination: MachineState; item: Item }[]>();
    for (const source of machines) {
      const item = this.outgoing(source);
      if (!item) continue;
      const destination = this.destination(source.building);
      if (!destination || !this.accepts(destination, source.building, item)) continue;
      const key = tileKey(destination.building);
      const group = proposals.get(key) ?? [];
      group.push({ source, destination, item });
      proposals.set(key, group);
    }

    // Reserve from a snapshot before moving anything: items cannot hop multiple
    // tiles in a tick, or enter a slot only because its occupant just left.
    const accepted: { source: MachineState; destination: MachineState; item: Item }[] = [];
    for (const [key, group] of proposals) {
      const last = this.lastSource.get(key);
      const start = last ? group.findIndex(proposal => compareTiles(proposal.source.building, last) > 0) : 0;
      const ordered = start > 0 ? [...group.slice(start), ...group.slice(0, start)] : group;
      const reserved = inventory();
      for (const proposal of ordered) {
        const used = proposal.destination.building.kind === 'assembler' ? reserved[proposal.item] : itemCount(reserved);
        if (used >= this.freeSlots(proposal.destination, proposal.item)) continue;
        accepted.push(proposal);
        reserved[proposal.item]++;
        this.lastSource.set(key, { c: proposal.source.building.c, r: proposal.source.building.r });
      }
    }
    for (const { source, destination, item } of accepted) {
      if (source.building.kind === 'belt') {
        source.item = null;
        source.progress = 0;
      } else {
        source.output[item]--;
      }
      if (destination.building.kind === 'belt') {
        destination.item = item;
        destination.progress = 0;
        destination.enteredFrom = source.building.direction;
      } else if (destination.building.kind === 'outpost') {
        this.delivered[item]++;
        this.deliveryTicks.push(this.ticks);
      } else {
        destination.input[item]++;
      }
    }
    if (this.orderCompleted === null) this.deliveryTicks = this.deliveryTicks.filter(tick => tick > this.ticks - RATE_WINDOW_TICKS);
    if (this.scenario === 'guided' && this.stage < ORDERS.length) {
      const order = ORDERS[this.stage];
      if (this.delivered[order.item] === order.quantity) {
        this.stage++;
        if (this.stage === ORDERS.length) this.orderCompleted = this.ticks;
        else {
          this.orderStarted = this.ticks;
          this.deliveryTicks = [];
        }
      }
    }
  }

  private produce(machine: MachineState): void {
    const { kind } = machine.building;
    machine.running = false;
    if (kind === 'miner') {
      if (itemCount(machine.output) >= BUFFER_CAPACITY) return;
      machine.running = true;
      if (++machine.progress >= EXTRACT_TICKS) {
        const ore: Ore = terrainAt(machine.building, this.world) === 'copper' ? 'copper-ore' : 'iron-ore';
        machine.output[ore]++;
        this.mined[ore]++;
        machine.progress = 0;
      }
    } else if (kind === 'furnace') {
      if (itemCount(machine.output) >= BUFFER_CAPACITY) return;
      const preferred: Ore = machine.lastProcessed === 'iron-ore' ? 'copper-ore' : 'iron-ore';
      const fallback: Ore = preferred === 'iron-ore' ? 'copper-ore' : 'iron-ore';
      machine.processing ??= machine.input[preferred] > 0 ? preferred
        : machine.input[fallback] > 0 ? fallback : null;
      if (!machine.processing) return;
      machine.running = true;
      if (++machine.progress >= SMELT_TICKS) {
        const plate = plateFor(machine.processing);
        machine.input[machine.processing]--;
        machine.output[plate]++;
        this.smelted[plate]++;
        machine.lastProcessed = machine.processing;
        machine.processing = null;
        machine.progress = 0;
      }
    } else if (kind === 'assembler') {
      if (itemCount(machine.output) >= BUFFER_CAPACITY ||
          machine.input['iron-plate'] < 2 || machine.input['copper-plate'] < 1) return;
      machine.running = true;
      if (++machine.progress >= ASSEMBLE_TICKS) {
        machine.input['iron-plate'] -= 2;
        machine.input['copper-plate']--;
        this.recipeConsumed['iron-plate'] += 2;
        this.recipeConsumed['copper-plate']++;
        machine.output['defense-supply']++;
        this.assembled['defense-supply']++;
        machine.progress = 0;
      }
    } else if (kind === 'belt' && machine.item) {
      machine.progress = Math.min(BELT_TICKS, machine.progress + 1);
      machine.running = machine.progress < BELT_TICKS;
    }
  }

  private destination(building: Building): MachineState | null {
    const vector = DIRECTIONS[building.direction];
    return this.machines.get(tileKey({ c: building.c + vector.c, r: building.r + vector.r })) ?? null;
  }

  private outgoing(machine: MachineState): Item | null {
    if (machine.building.kind === 'storage' || machine.building.kind === 'outpost') return null;
    if (machine.building.kind === 'belt') return machine.progress >= BELT_TICKS ? machine.item : null;
    return firstItem(machine.output);
  }

  private freeSlots(machine: MachineState, item: Item | null = null): number {
    switch (machine.building.kind) {
      case 'belt': return machine.item ? 0 : 1;
      case 'furnace': return BUFFER_CAPACITY - itemCount(machine.input);
      case 'storage': return DEPOT_CAPACITY - itemCount(machine.input);
      case 'miner': return 0;
      case 'assembler': return item === 'iron-plate' || item === 'copper-plate' ? BUFFER_CAPACITY - machine.input[item] : 0;
      case 'outpost': {
        const order = this.stage < ORDERS.length ? ORDERS[this.stage] : null;
        return order && item === order.item ? order.quantity - this.delivered[order.item] : 0;
      }
    }
  }

  private accepts(machine: MachineState, source: Building, item: Item): boolean {
    if (machine.building.kind === 'miner') return false;
    if (machine.building.kind === 'furnace') return isOre(item);
    if (machine.building.kind === 'assembler') return item === 'iron-plate' || item === 'copper-plate';
    if (machine.building.kind === 'outpost') return this.stage < ORDERS.length && item === ORDERS[this.stage].item;
    if (machine.building.kind === 'belt') {
      const front = DIRECTIONS[machine.building.direction];
      return source.c !== machine.building.c + front.c || source.r !== machine.building.r + front.r;
    }
    return true;
  }

  private blockage(machine: MachineState, item: Item | null): string | null {
    const target = this.destination(machine.building);
    if (!target) return 'Output disconnected';
    if (target.building.kind === 'outpost') {
      if (this.stage === ORDERS.length) return 'Order complete; items retained';
      if (item !== ORDERS[this.stage].item) return `Outpost needs ${ITEM_NAMES[ORDERS[this.stage].item].toLowerCase()}`;
    }
    if (item && !this.accepts(target, machine.building, item)) return 'Output incompatible';
    if (this.freeSlots(target, item) <= 0) return 'Output blocked';
    return null;
  }

  status(tile: Tile): string {
    const machine = this.machines.get(tileKey(tile));
    if (!machine) throw new Error('Cannot inspect a missing building');
    switch (machine.building.kind) {
      case 'storage': return this.freeSlots(machine) === 0 ? 'Depot full' : 'Receiving';
      case 'belt':
        if (!machine.item) return 'Waiting for items';
        return machine.progress < BELT_TICKS ? 'Transporting' : this.blockage(machine, machine.item) ?? 'Ready to transfer';
      case 'miner':
        return itemCount(machine.output) >= BUFFER_CAPACITY
          ? this.blockage(machine, firstItem(machine.output)) ?? 'Output full' : 'Extracting';
      case 'furnace':
        if (itemCount(machine.output) >= BUFFER_CAPACITY) return this.blockage(machine, firstItem(machine.output)) ?? 'Output full';
        return machine.processing || itemCount(machine.input) > 0 ? 'Smelting' : 'Waiting for ore';
      case 'assembler':
        if (itemCount(machine.output) >= BUFFER_CAPACITY) return this.blockage(machine, 'defense-supply') ?? 'Output full';
        if (machine.input['iron-plate'] < 2 && !machine.input['copper-plate']) return 'Needs 2 iron + 1 copper plate';
        if (machine.input['iron-plate'] < 2) return 'Needs 2 iron plates';
        if (!machine.input['copper-plate']) return 'Needs 1 copper plate';
        return 'Assembling';
      case 'outpost':
        return this.stage === ORDERS.length ? 'Factory preparation complete' : `Receiving ${ITEM_NAMES[ORDERS[this.stage].item].toLowerCase()}`;
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
      stored, recovered: { ...this.recovered }, mined: { ...this.mined }, smelted: { ...this.smelted },
      assembled: { ...this.assembled }, recipeConsumed: { ...this.recipeConsumed }, delivered: { ...this.delivered },
      objective: this.objective(), scenario: this.scenario, ticks: this.ticks,
    };
  }

  snapshot() {
    return {
      ...this.summary(),
      machines: [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building)).map(machine => ({
        ...machine, building: { ...machine.building }, input: { ...machine.input }, output: { ...machine.output },
      })),
      lastSource: [...this.lastSource.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, source]) => [key, { ...source }]),
    };
  }
}
