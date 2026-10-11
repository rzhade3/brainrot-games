import {
  acceptsConveyorInput, Building, BuildingKind, createGuided, DIRECTIONS, Direction, DIRECTION_NAMES, nextDirection, OUTPOST,
  inBounds, isBuildingKind, isConveyor, outputDirections, placementError, Scenario, terrainAt, Tile, tileKey,
} from './model';
import { DEFAULT_WORLD, FactoryWorld, GUIDED_SEED, restoreWorld, WorldIdentity } from './world';
import { FARM_TICKS, MEAL_TICKS, Resident, Settlement, SettlementSave, STARTER_FOOD } from './settlement';
import {
  acceptsInventoryItem, ASSEMBLER_RECIPE, hasRecipeInputs, inputCapacity, inputSlots, isOre,
  MachineRecipe, Ore, outputCapacity, producesInventoryItem, SMELTER_RECIPES,
} from './machineRules';
export { ASSEMBLE_TICKS, BUFFER_CAPACITY, DEPOT_CAPACITY, SMELT_TICKS } from './machineRules';

export const STEP_MS = 100;
export const EXTRACT_TICKS = 10;
export const UPGRADED_EXTRACT_TICKS = 8;
export const BELT_TICKS = 8;
export const RATE_WINDOW_TICKS = 300;

export const ITEMS = ['iron-ore', 'copper-ore', 'iron-plate', 'copper-plate', 'defense-supply', 'food-unit'] as const;
export type Item = typeof ITEMS[number];
export type Inventory = Record<Item, number>;
export const ITEM_NAMES: Record<Item, string> = {
  'iron-ore': 'Iron ore', 'copper-ore': 'Copper ore',
  'iron-plate': 'Iron plates', 'copper-plate': 'Copper plates',
  'defense-supply': 'Defense supplies',
  'food-unit': 'Food units',
};

export const ORDERS = [
  { title: 'Copper commissioning', item: 'copper-plate', quantity: 16, reward: 'Unlock the assembler' },
  { title: 'Factory preparation', item: 'defense-supply', quantity: 12, reward: 'Complete factory preparation' },
] as const;

export const PROJECTS = [
  { id: 'extraction', title: 'Extraction commission', item: 'defense-supply', quantity: 8,
    reward: 'Optional extractor upgrade: 1 ore every 0.8s',
    guide: 'Feed parallel iron smelters and a copper smelter into an assembler. Deliver supplies here; the upgrade helps an extractor feed two smelters.' },
  { id: 'buffering', title: 'Buffering commission', item: 'iron-plate', quantity: 16,
    reward: 'Optional depot output: 1 item every 0.8s',
    guide: 'Route iron plates here instead of into storage. Unlock reusable buffers: stored ore, plates and recovered stock can feed production again.' },
] as const;
export type ProjectId = typeof PROJECTS[number]['id'];
export interface ProjectState {
  active: ProjectId | null;
  accepted: Record<ProjectId, number>;
}
export interface ProjectSummary extends ProjectState {
  available: boolean;
  receiver: Tile | null;
}

export function depotNextItem(machine: Readonly<MachineState>): Item | null {
  for (let offset = 0; offset < ITEMS.length; offset++) {
    const item = ITEMS[(machine.nextItem + offset) % ITEMS.length];
    if (machine.input[item] > 0) return item;
  }
  return null;
}

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
  nextOutput: 0 | 1;
  nextItem: number;
  running: boolean;
}

export interface MachineInspection {
  machine: Readonly<MachineState>;
  status: string;
  inputCapacity: number;
  outputCapacity: number;
  availableInput: number;
  recipe: MachineRecipe | null;
  cycleTicks: number;
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

export function requireSave(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Corrupt factory save: ${message}`);
}

export function saveObject(value: unknown): Record<string, unknown> {
  requireSave(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected an object');
  return value as Record<string, unknown>;
}

export function saveCount(value: unknown): number {
  requireSave(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, 'invalid item count or tick');
  return value;
}

function saveInventory(value: unknown, legacy = false): Inventory {
  const source = saveObject(value);
  const result = inventory();
  const old = legacy && !Object.hasOwn(source, 'food-unit');
  requireSave(Object.keys(source).length === ITEMS.length - (old ? 1 : 0), 'invalid inventory fields');
  for (const item of ITEMS) result[item] = old && item === 'food-unit' ? 0 : saveCount(source[item]);
  requireSave(Number.isSafeInteger(itemCount(result)), 'inventory overflow');
  return result;
}

export function saveTile(value: unknown): Tile {
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
  requireSave(value === null || isOre(value), 'invalid smelter recipe');
  return value;
}

function saveMachine(value: unknown, world: FactoryWorld, legacy = false): MachineState {
  const source = saveObject(value);
  const building = saveObject(source.building);
  requireSave(typeof building.kind === 'string' && (isBuildingKind(building.kind) || building.kind === 'outpost' || building.kind === 'home'), 'unknown machine');
  const machine: MachineState = {
    building: { ...saveTile(building), kind: building.kind, direction: saveDirection(building.direction) },
    input: saveInventory(source.input, legacy), output: saveInventory(source.output, legacy),
    progress: saveCount(source.progress), processing: saveOre(source.processing), lastProcessed: saveOre(source.lastProcessed),
    item: null, enteredFrom: saveDirection(source.enteredFrom), nextOutput: 0, nextItem: 0, running: false,
  };
  for (const [field, kind] of [['outputEnabled', 'storage'], ['upgraded', 'miner']] as const) {
    if (building[field] !== undefined) {
      requireSave(machine.building.kind === kind && typeof building[field] === 'boolean', 'invalid machine option');
      machine.building[field] = building[field];
    }
    if (building.haulTo !== undefined) machine.building.haulTo = saveTile(building.haulTo);
  }
  const nextItem = source.nextItem === undefined ? 0 : saveCount(source.nextItem);
  requireSave(nextItem < ITEMS.length && (machine.building.kind === 'storage' || nextItem === 0), 'invalid depot routing');
  machine.nextItem = nextItem;
  requireSave(source.item === null || typeof source.item === 'string' && ITEMS.some(item => item === source.item), 'unknown cargo');
  machine.item = source.item as Item | null;
  requireSave(typeof source.running === 'boolean', 'invalid machine activity');
  machine.running = source.running;
  const { kind } = machine.building;
  // Saves made before splitters have no routing field on their existing machines.
  const nextOutput = source.nextOutput === undefined && kind !== 'splitter' ? 0 : source.nextOutput;
  requireSave(nextOutput === 0 || kind === 'splitter' && nextOutput === 1, 'invalid splitter routing state');
  machine.nextOutput = nextOutput;
  for (const item of ITEMS) {
    requireSave(acceptsInventoryItem(kind, item) || machine.input[item] === 0, 'incompatible machine input');
    requireSave(producesInventoryItem(kind, item, world.at(machine.building).deposit) || machine.output[item] === 0,
      'incompatible machine output');
  }
  requireSave(itemCount(machine.output) <= outputCapacity(kind), 'machine output over capacity');
  requireSave(kind === 'assembler' ? ASSEMBLER_RECIPE.inputs.every(ingredient => inputSlots(machine, ingredient.item) >= 0)
    : inputSlots(machine) >= 0, 'machine input over capacity');
  requireSave(isConveyor(kind) || machine.item === null, 'cargo outside a conveyor');
  requireSave(kind === 'furnace' || machine.processing === null && machine.lastProcessed === null, 'recipe outside a smelter');
  requireSave(!machine.processing || hasRecipeInputs(machine.input, SMELTER_RECIPES[machine.processing]), 'smelter recipe missing its input');
  const max = isConveyor(kind) || kind === 'storage' && machine.building.outputEnabled ? BELT_TICKS + 1
    : kind === 'miner' ? machine.building.upgraded ? UPGRADED_EXTRACT_TICKS : EXTRACT_TICKS
    : kind === 'furnace' ? SMELTER_RECIPES['iron-ore'].ticks : kind === 'assembler' ? ASSEMBLER_RECIPE.ticks : kind === 'food-plot' ? FARM_TICKS : 1;
  requireSave(machine.progress < max, 'invalid machine progress');
  requireSave(!isConveyor(kind) || machine.item !== null || machine.progress === 0, 'empty conveyor in progress');
  requireSave(kind !== 'furnace' || machine.processing !== null || machine.progress === 0, 'smelter missing its recipe');
  requireSave(kind !== 'assembler' || machine.progress === 0 || hasRecipeInputs(machine.input, ASSEMBLER_RECIPE),
    'assembler missing its recipe inputs');
  return machine;
}

export function inventory(): Inventory {
  return { 'iron-ore': 0, 'copper-ore': 0, 'iron-plate': 0, 'copper-plate': 0, 'defense-supply': 0, 'food-unit': 0 };
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
  private projects: ProjectState = { active: null, accepted: { extraction: 0, buffering: 0 } };
  private accumulator = 0;
  private settlement: Settlement | null = null;
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
      machines: [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building)).map(machine => ({
        ...machine, building: { ...machine.building, ...(machine.building.haulTo ? { haulTo: { ...machine.building.haulTo } } : {}) },
        input: { ...machine.input }, output: { ...machine.output },
      })),
      lastSource: [...this.lastSource.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, source]) => [key, { ...source }]),
      recovered: { ...this.recovered }, mined: { ...this.mined }, smelted: { ...this.smelted },
      assembled: { ...this.assembled }, recipeConsumed: { ...this.recipeConsumed }, delivered: { ...this.delivered },
      stage: this.stage, orderStarted: this.orderStarted, orderCompleted: this.orderCompleted,
      deliveryTicks: [...this.deliveryTicks],
      projects: { active: this.projects.active, accepted: { ...this.projects.accepted } },
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
    sim.stage = saveCount(source.stage);
    sim.orderStarted = saveCount(source.orderStarted);
    sim.orderCompleted = source.orderCompleted === null ? null : saveCount(source.orderCompleted);
    requireSave(sim.stage <= ORDERS.length && sim.orderStarted <= (sim.orderCompleted ?? sim.ticks) &&
      (sim.orderCompleted === null || sim.orderCompleted <= sim.ticks), 'invalid objective timing');
    sim.recovered = saveInventory(source.recovered, legacy);
    sim.mined = saveInventory(source.mined, legacy);
    sim.smelted = saveInventory(source.smelted, legacy);
    sim.assembled = saveInventory(source.assembled, legacy);
    sim.recipeConsumed = saveInventory(source.recipeConsumed, legacy);
    sim.delivered = saveInventory(source.delivered, legacy);
    if (source.projects !== undefined) {
      const projects = saveObject(source.projects);
      requireSave(projects.active === null || PROJECTS.some(project => project.id === projects.active), 'unknown project');
      const accepted = saveObject(projects.accepted);
      requireSave(Object.keys(accepted).length === PROJECTS.length, 'invalid project fields');
      for (const project of PROJECTS) {
        const count = saveCount(accepted[project.id]);
        requireSave(count <= project.quantity, 'project over quota');
        sim.projects.accepted[project.id] = count;
      }
      sim.projects.active = projects.active as ProjectId | null;
      requireSave(sim.projects.active === null || !sim.projectComplete(sim.projects.active), 'completed active project');
      requireSave(sim.projectsAvailable || sim.projects.active === null && Object.values(sim.projects.accepted).every(count => count === 0),
        'projects before commissioning');
    }
    requireSave(Array.isArray(source.machines) && source.machines.length <= world.size * world.size, 'invalid machine list');
    for (const entry of source.machines) {
      const machine = saveMachine(entry, world, legacy);
      const { building } = machine;
      const fixedOutpost = building.kind === 'outpost' && building.direction === 0 &&
        (sim.scenario === 'guided' ? tileKey(building) === tileKey(OUTPOST)
          : source.projects !== undefined && !sim.receiver);
      requireSave(building.kind !== 'outpost' || fixedOutpost, 'invalid fixed outpost');
      requireSave(!building.upgraded || sim.projectComplete('extraction'), 'locked extractor upgrade');
      requireSave(!building.outputEnabled || sim.scenario === 'settlement' || sim.projectComplete('buffering'), 'locked depot output');
      requireSave(!building.haulTo || sim.scenario === 'settlement' && ['food-plot', 'storage', 'miner', 'furnace', 'assembler'].includes(building.kind), 'invalid hauling source');
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
    requireSave(sim.projects.active === null && Object.values(sim.projects.accepted).every(count => count === 0) || sim.receiver,
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
    if (sim.scenario !== 'guided') {
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
    for (const resident of sim.settlement?.state.residents ?? []) if (resident.cargo) held[resident.cargo]++;
    requireSave(sim.settlement ? held['food-unit'] + sim.settlement.state.consumedFood ===
      sim.settlement.state.starterFood + sim.settlement.state.producedFood : held['food-unit'] === 0, 'food accounting mismatch');
    for (const metal of ['iron', 'copper'] as const) {
      const ore = `${metal}-ore` as const;
      const recipe = SMELTER_RECIPES[ore];
      const plate = recipe.output.item;
      requireSave(held[ore] + sim.smelted[plate] / recipe.output.quantity * recipe.inputs[0].quantity === sim.mined[ore] &&
        held[plate] + sim.delivered[plate] + sim.projectConsumed(plate) + sim.recipeConsumed[plate] === sim.smelted[plate], 'material accounting mismatch');
    }
    const supply = ASSEMBLER_RECIPE.output;
    requireSave(held[supply.item] + sim.delivered[supply.item] + sim.projectConsumed(supply.item) === sim.assembled[supply.item] &&
      ASSEMBLER_RECIPE.inputs.every(ingredient => sim.recipeConsumed[ingredient.item] ===
        sim.assembled[supply.item] / supply.quantity * ingredient.quantity), 'assembly accounting mismatch');
    return sim;
  }

  get assemblerUnlocked(): boolean {
    return this.scenario !== 'guided' || this.stage >= 1;
  }

  get projectsAvailable(): boolean {
    return this.scenario === 'free-play' || this.stage === ORDERS.length;
  }

  get receiver(): Tile | null {
    const building = [...this.placed.values()].find(building => building.kind === 'outpost');
    return building ? { c: building.c, r: building.r } : null;
  }

  projectComplete(id: ProjectId): boolean {
    return this.projects.accepted[id] === PROJECTS.find(project => project.id === id)!.quantity;
  }

  projectConsumed(item: Item): number {
    return PROJECTS.reduce((sum, project) => sum + (project.item === item ? this.projects.accepted[project.id] : 0), 0);
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
    this.projects.active = id;
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
    if (this.scenario === 'guided' && this.stage < ORDERS.length) {
      const order = ORDERS[this.stage];
      return { ...order, accepted: this.delivered[order.item] };
    }
    const project = PROJECTS.find(project => project.id === this.projects.active);
    return project ? { ...project, accepted: this.projects.accepted[project.id] } : null;
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
    const recipe = kind === 'furnace' ? SMELTER_RECIPES[machine.processing ?? machine.lastProcessed ?? 'iron-ore']
      : kind === 'assembler' ? ASSEMBLER_RECIPE : null;
    return {
      machine, status: this.status(tile), inputCapacity: isConveyor(kind) ? 1 : inputCapacity(kind),
      outputCapacity: outputCapacity(kind),
      availableInput: kind === 'assembler' ? ASSEMBLER_RECIPE.inputs.reduce((sum, ingredient) =>
        sum + this.freeSlots(machine, ingredient.item), 0) : this.freeSlots(machine),
      recipe,
      cycleTicks: recipe?.ticks ?? (kind === 'miner' ? machine.building.upgraded ? UPGRADED_EXTRACT_TICKS : EXTRACT_TICKS
        : kind === 'food-plot' ? FARM_TICKS : kind === 'kitchen' ? MEAL_TICKS : BELT_TICKS),
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
    const contents = inventory();
    for (const item of ITEMS) contents[item] = machine.input[item] + machine.output[item];
    if (machine.item) contents[machine.item]++;
    for (const item of ITEMS) this.recovered[item] += contents[item];
    this.placed.delete(key);
    this.machines.delete(key);
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
      machine.input[item] += count;
      this.recovered[item] -= count;
      slots -= count;
    }
    return { moved, remaining: { ...this.recovered } };
  }

  setHaulTarget(source: Tile, target: Tile | null): string | null {
    if (!this.settlement) return 'Hauling is available in settlements';
    const machine = this.machines.get(tileKey(source));
    if (!machine || !['food-plot', 'storage', 'miner', 'furnace', 'assembler'].includes(machine.building.kind)) return 'Choose a production source or depot';
    if (target) {
      const destination = this.machines.get(tileKey(target));
      if (!destination || tileKey(source) === tileKey(target) ||
        !['storage', 'kitchen', 'furnace', 'assembler'].includes(destination.building.kind)) return 'Choose a kitchen, depot, or production input';
      machine.building.haulTo = { ...target };
    } else delete machine.building.haulTo;
    this.settlement.assignmentChanged(source);
    return null;
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
    this.settlement?.step(this.ticks);

    type Transfer = { source: MachineState; destination: MachineState; item: Item; direction: Direction; output: 0 | 1 };
    const proposals = new Map<string, Transfer[]>();
    const propose = (source: MachineState, output: 0 | 1) => {
      const item = this.outgoing(source);
      if (!item) return;
      const direction = outputDirections(source.building)[output];
      const destination = this.destination(source.building, direction);
      if (!destination || !this.accepts(destination, source.building, item)) return;
      const key = tileKey(destination.building);
      const group = proposals.get(key) ?? [];
      group.push({ source, destination, item, direction, output });
      proposals.set(key, group);
    };
    for (const source of machines) propose(source, source.building.kind === 'splitter' ? source.nextOutput : 0);

    // Reserve from a snapshot before moving anything: items cannot hop multiple
    // tiles in a tick, or enter a slot only because its occupant just left.
    const accepted: Transfer[] = [];
    const sent = new Set<MachineState>();
    const reservations = new Map<string, Inventory>();
    const reserve = () => {
      for (const [key, group] of proposals) {
        const last = this.lastSource.get(key);
        const start = last ? group.findIndex(proposal => compareTiles(proposal.source.building, last) > 0) : 0;
        const ordered = start > 0 ? [...group.slice(start), ...group.slice(0, start)] : group;
        const reserved = reservations.get(key) ?? inventory();
        reservations.set(key, reserved);
        for (const proposal of ordered) {
          const used = proposal.destination.building.kind === 'assembler' ? reserved[proposal.item] : itemCount(reserved);
          if (used >= this.freeSlots(proposal.destination, proposal.item)) continue;
          accepted.push(proposal);
          sent.add(proposal.source);
          reserved[proposal.item]++;
          this.lastSource.set(key, { c: proposal.source.building.c, r: proposal.source.building.r });
        }
      }
    };
    reserve();
    // A splitter that lost its preferred slot may use its other branch, without
    // double-sending or reusing a slot reserved by the first pass.
    proposals.clear();
    for (const source of machines) {
      if (source.building.kind === 'splitter' && !sent.has(source)) propose(source, source.nextOutput === 0 ? 1 : 0);
    }
    reserve();
    for (const { source, destination, item, direction, output } of accepted) {
      if (isConveyor(source.building.kind)) {
        source.item = null;
        source.progress = 0;
        if (source.building.kind === 'splitter') source.nextOutput = output === 0 ? 1 : 0;
      } else {
        if (source.building.kind === 'storage') {
          source.input[item]--;
          source.progress = 0;
          source.nextItem = (ITEMS.indexOf(item) + 1) % ITEMS.length;
        } else source.output[item]--;
      }
      if (isConveyor(destination.building.kind)) {
        destination.item = item;
        destination.progress = 0;
        destination.enteredFrom = direction;
      } else if (destination.building.kind === 'outpost') {
        if (this.scenario === 'guided' && this.stage < ORDERS.length) {
          this.delivered[item]++;
          this.deliveryTicks.push(this.ticks);
        } else if (this.projects.active) this.projects.accepted[this.projects.active]++;
      } else {
        destination.input[item]++;
      }
      if (this.projects.active && this.projectComplete(this.projects.active)) this.projects.active = null;
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
      if (itemCount(machine.output) >= outputCapacity(kind)) return;
      machine.running = true;
      if (++machine.progress >= (machine.building.upgraded ? UPGRADED_EXTRACT_TICKS : EXTRACT_TICKS)) {
        const ore: Ore = terrainAt(machine.building, this.world) === 'copper' ? 'copper-ore' : 'iron-ore';
        machine.output[ore]++;
        this.mined[ore]++;
        machine.progress = 0;
      }
    } else if (kind === 'furnace') {
      if (itemCount(machine.output) >= outputCapacity(kind)) return;
      const preferred: Ore = machine.lastProcessed === 'iron-ore' ? 'copper-ore' : 'iron-ore';
      const fallback: Ore = preferred === 'iron-ore' ? 'copper-ore' : 'iron-ore';
      machine.processing ??= hasRecipeInputs(machine.input, SMELTER_RECIPES[preferred]) ? preferred
        : hasRecipeInputs(machine.input, SMELTER_RECIPES[fallback]) ? fallback : null;
      if (!machine.processing) return;
      const recipe = SMELTER_RECIPES[machine.processing];
      machine.running = true;
      if (++machine.progress >= recipe.ticks) {
        for (const ingredient of recipe.inputs) machine.input[ingredient.item] -= ingredient.quantity;
        machine.output[recipe.output.item] += recipe.output.quantity;
        this.smelted[recipe.output.item] += recipe.output.quantity;
        machine.lastProcessed = machine.processing;
        machine.processing = null;
        machine.progress = 0;
      }
    } else if (kind === 'assembler') {
      if (itemCount(machine.output) >= outputCapacity(kind) || !hasRecipeInputs(machine.input, ASSEMBLER_RECIPE)) return;
      machine.running = true;
      if (++machine.progress >= ASSEMBLER_RECIPE.ticks) {
        for (const ingredient of ASSEMBLER_RECIPE.inputs) {
          machine.input[ingredient.item] -= ingredient.quantity;
          this.recipeConsumed[ingredient.item] += ingredient.quantity;
        }
        machine.output[ASSEMBLER_RECIPE.output.item] += ASSEMBLER_RECIPE.output.quantity;
        this.assembled[ASSEMBLER_RECIPE.output.item] += ASSEMBLER_RECIPE.output.quantity;
        machine.progress = 0;
      }
    } else if (kind === 'storage' && machine.building.outputEnabled) {
      if (!depotNextItem(machine)) { machine.progress = 0; return; }
      machine.progress = Math.min(BELT_TICKS, machine.progress + 1);
      machine.running = machine.progress < BELT_TICKS;
    } else if (isConveyor(kind) && machine.item) {
      machine.progress = Math.min(BELT_TICKS, machine.progress + 1);
      machine.running = machine.progress < BELT_TICKS;
    }
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
      case 'home': return 'Four residents; farming and hauling automatically';
      case 'food-plot': {
        const worker = this.settlement?.state.residents.find(resident => resident.job?.kind === 'farm' &&
          tileKey(resident.job.source) === tileKey(tile));
        return !worker ? 'No farmer available or access blocked'
          : itemCount(machine.output) >= outputCapacity(machine.building.kind) ? 'Plot full; transport needed'
            : worker.job?.path.length ? 'Farmer approaching' : 'Growing food';
      }
      case 'kitchen': return machine.input['food-unit'] > 0 ? 'Provisioning four residents' : 'Food shortage; residents keep working';
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
      stored, recovered: { ...this.recovered }, mined: { ...this.mined }, smelted: { ...this.smelted },
      assembled: { ...this.assembled }, recipeConsumed: { ...this.recipeConsumed }, delivered: { ...this.delivered },
      objective: this.objective(), projects: { active: this.projects.active, accepted: { ...this.projects.accepted },
        available: this.projectsAvailable, receiver: this.receiver }, scenario: this.scenario, ticks: this.ticks,
      settlement: this.settlement?.serialize() ?? null,
    };
  }

  snapshot() {
    return {
      ...this.summary(),
      machines: [...this.machines.values()].sort((a, b) => compareTiles(a.building, b.building)).map(machine => ({
        ...machine, building: { ...machine.building, ...(machine.building.haulTo ? { haulTo: { ...machine.building.haulTo } } : {}) },
        input: { ...machine.input }, output: { ...machine.output },
      })),
      lastSource: [...this.lastSource.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, source]) => [key, { ...source }]),
    };
  }
}
