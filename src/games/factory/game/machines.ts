import {
  BELT_TICKS,
  Building, BuildingKind, compareTiles, Direction,
  EXTRACT_TICKS, FARM_TICKS, GATHER_TICKS,
  Inventory, inventory, isConveyor, Item, itemCount, ITEMS,
  RESIDENT_FOOD_TICKS, HOUSE_WOOD_COST,
  moveInventory, tileKey,
  UPGRADED_EXTRACT_TICKS,
} from './domain';
import { outputDirections } from './model';
import type { Deposit, FactoryWorld } from './world';

export interface MachineState {
  building: Building;
  input: Inventory;
  output: Inventory;
  progress: number;
  processing: Ore | null;
  lastProcessed: Ore | null;
  item: Item | null;
  enteredFrom: Direction;
  nextOutput: 0 | 1;
  nextItem: number;
  running: boolean;
}

export function depotNextItem(machine: Readonly<MachineState>): Item | null {
  for (let offset = 0; offset < ITEMS.length; offset++) {
    const item = ITEMS[(machine.nextItem + offset) % ITEMS.length];
    if (machine.input[item] > 0) return item;
  }
  return null;
}

export const BUFFER_CAPACITY = 4;
export const DEPOT_CAPACITY = 64;
export const KITCHEN_CAPACITY = 16;

export interface MachineRecipe {
  readonly inputs: readonly { readonly item: Item; readonly quantity: number }[];
  readonly output: { readonly item: Item; readonly quantity: number };
  readonly ticks: number;
}

export const SMELTER_RECIPES = {
  'iron-ore': {
    inputs: [{ item: 'iron-ore', quantity: 1 }],
    output: { item: 'iron-plate', quantity: 1 }, ticks: 16,
  },
  'copper-ore': {
    inputs: [{ item: 'copper-ore', quantity: 1 }],
    output: { item: 'copper-plate', quantity: 1 }, ticks: 16,
  },
} as const satisfies Record<string, MachineRecipe>;

export const ASSEMBLER_RECIPE = {
  inputs: [{ item: 'iron-plate', quantity: 2 }, { item: 'copper-plate', quantity: 1 }],
  output: { item: 'defense-supply', quantity: 1 }, ticks: 20,
} as const satisfies MachineRecipe;

export type Ore = keyof typeof SMELTER_RECIPES;
export const SMELT_TICKS = SMELTER_RECIPES['iron-ore'].ticks;
export const ASSEMBLE_TICKS = ASSEMBLER_RECIPE.ticks;

export function machineRecipe(machine: Readonly<MachineState>): MachineRecipe | null {
  return machine.building.kind === 'furnace'
    ? SMELTER_RECIPES[machine.processing ?? machine.lastProcessed ?? 'iron-ore']
    : machine.building.kind === 'assembler' ? ASSEMBLER_RECIPE : null;
}

export function machineCycleTicks(machine: Readonly<MachineState>): number {
  const recipe = machineRecipe(machine);
  if (recipe) return recipe.ticks;
  switch (machine.building.kind) {
    case 'miner': return machine.building.upgraded ? UPGRADED_EXTRACT_TICKS : EXTRACT_TICKS;
    case 'food-plot': return FARM_TICKS;
    case 'woodcutting-site': return GATHER_TICKS;
    case 'kitchen': return RESIDENT_FOOD_TICKS;
    default: return BELT_TICKS;
  }
}

export function isOre(item: unknown): item is Ore {
  return typeof item === 'string' && Object.hasOwn(SMELTER_RECIPES, item);
}

export function hasRecipeInputs(input: Readonly<Inventory>, recipe: MachineRecipe): boolean {
  return recipe.inputs.every(ingredient => input[ingredient.item] >= ingredient.quantity);
}

export function acceptsInventoryItem(kind: BuildingKind, item: Item): boolean {
  switch (kind) {
    case 'furnace': return isOre(item);
    case 'assembler': return ASSEMBLER_RECIPE.inputs.some(ingredient => ingredient.item === item);
    case 'storage': return true;
    case 'kitchen': return item === 'food-unit';
    case 'house': return item === 'wood';
    default: return false;
  }
}

export function inputCapacity(kind: BuildingKind, item: Item | null = null): number {
  if (item && !acceptsInventoryItem(kind, item)) return 0;
  switch (kind) {
    case 'assembler': return item ? BUFFER_CAPACITY : ASSEMBLER_RECIPE.inputs.length * BUFFER_CAPACITY;
    case 'furnace': return BUFFER_CAPACITY;
    case 'storage': return DEPOT_CAPACITY;
    case 'kitchen': return KITCHEN_CAPACITY;
    case 'house': return HOUSE_WOOD_COST;
    default: return 0;
  }
}

export function inputSlots(machine: Readonly<MachineState>, item: Item | null = null, reserved = 0): number {
  const capacity = inputCapacity(machine.building.kind, item);
  if (!capacity) return 0;
  const used = machine.building.kind === 'assembler' && item ? machine.input[item]
    : Object.values(machine.input).reduce((sum, count) => sum + count, 0);
  return capacity - used - reserved;
}

export function outputCapacity(kind: BuildingKind): number {
  return kind === 'miner' || kind === 'furnace' || kind === 'assembler' || kind === 'food-plot' || kind === 'woodcutting-site' ? BUFFER_CAPACITY : 0;
}

export function producesInventoryItem(kind: BuildingKind, item: Item, deposit: Deposit): boolean {
  switch (kind) {
    case 'miner': return item === (deposit === 'copper' ? 'copper-ore' : 'iron-ore');
    case 'furnace': return Object.values(SMELTER_RECIPES).some(recipe => recipe.output.item === item);
    case 'assembler': return item === ASSEMBLER_RECIPE.output.item;
    case 'food-plot': return item === 'food-unit';
    case 'woodcutting-site': return item === 'wood';
    default: return false;
  }
}

export function haulItems(source: Readonly<Building>, world: FactoryWorld): readonly Item[] {
  // Depot routes can wait for future stock; actual jobs reserve only matching items.
  return source.kind === 'storage' ? ITEMS
    : ITEMS.filter(item => producesInventoryItem(source.kind, item, world.at(source).deposit));
}

export function canHaulBetween(source: Readonly<Building>, target: Readonly<Building>, world: FactoryWorld): boolean {
  return tileKey(source) !== tileKey(target) &&
    haulItems(source, world).some(item => acceptsInventoryItem(target.kind, item));
}

export interface ProductionLedger {
  mined: Inventory;
  smelted: Inventory;
  assembled: Inventory;
  recipeConsumed: Inventory;
}

function advanceRecipe(
  machine: MachineState, recipe: MachineRecipe, produced: Inventory, consumed?: Inventory,
): boolean {
  if (itemCount(machine.output) + recipe.output.quantity > outputCapacity(machine.building.kind) ||
      !hasRecipeInputs(machine.input, recipe)) return false;
  machine.running = true;
  if (++machine.progress < recipe.ticks) return false;
  for (const ingredient of recipe.inputs) {
    machine.input[ingredient.item] -= ingredient.quantity;
    if (consumed) consumed[ingredient.item] += ingredient.quantity;
  }
  machine.output[recipe.output.item] += recipe.output.quantity;
  produced[recipe.output.item] += recipe.output.quantity;
  machine.progress = 0;
  return true;
}

export function produceMachine(machine: MachineState, world: FactoryWorld, ledger: ProductionLedger): void {
  const { kind } = machine.building;
  machine.running = false;
  if (kind === 'miner') {
    if (itemCount(machine.output) >= outputCapacity(kind)) return;
    machine.running = true;
    if (++machine.progress >= machineCycleTicks(machine)) {
      const ore: Ore = world.at(machine.building).deposit === 'copper' ? 'copper-ore' : 'iron-ore';
      machine.output[ore]++;
      ledger.mined[ore]++;
      machine.progress = 0;
    }
  } else if (kind === 'furnace') {
    if (itemCount(machine.output) >= outputCapacity(kind)) return;
    const preferred: Ore = machine.lastProcessed === 'iron-ore' ? 'copper-ore' : 'iron-ore';
    const fallback: Ore = preferred === 'iron-ore' ? 'copper-ore' : 'iron-ore';
    machine.processing ??= hasRecipeInputs(machine.input, SMELTER_RECIPES[preferred]) ? preferred
      : hasRecipeInputs(machine.input, SMELTER_RECIPES[fallback]) ? fallback : null;
    if (!machine.processing) return;
    if (advanceRecipe(machine, SMELTER_RECIPES[machine.processing], ledger.smelted)) {
      machine.lastProcessed = machine.processing;
      machine.processing = null;
    }
  } else if (kind === 'assembler') {
    advanceRecipe(machine, ASSEMBLER_RECIPE, ledger.assembled, ledger.recipeConsumed);
  } else if (kind === 'storage') {
    if (!depotNextItem(machine)) { machine.progress = 0; return; }
    machine.progress = Math.min(BELT_TICKS, machine.progress + 1);
    machine.running = machine.progress < BELT_TICKS;
  } else if (isConveyor(kind) && machine.item) {
    machine.progress = Math.min(BELT_TICKS, machine.progress + 1);
    machine.running = machine.progress < BELT_TICKS;
  }
}

interface Transfer {
  source: MachineState;
  destination: MachineState;
  item: Item;
  direction: Direction;
  output: 0 | 1;
}

export interface TransportHost {
  outgoing(machine: MachineState): Item | null;
  destination(building: Building, direction: Direction): MachineState | null;
  accepts(machine: MachineState, source: Building, item: Item): boolean;
  freeSlots(machine: MachineState, item: Item): number;
  receive(machine: MachineState, item: Item): void;
}

export function transferMachines(
  machines: readonly MachineState[], lastSource: Map<string, { c: number; r: number }>, host: TransportHost,
): void {
  const proposals = new Map<string, Transfer[]>();
  const propose = (source: MachineState, output: 0 | 1) => {
    const item = host.outgoing(source);
    if (!item) return;
    const direction = outputDirections(source.building)[output];
    const destination = host.destination(source.building, direction);
    if (!destination || !host.accepts(destination, source.building, item)) return;
    const key = tileKey(destination.building);
    const group = proposals.get(key) ?? [];
    group.push({ source, destination, item, direction, output });
    proposals.set(key, group);
  };
  for (const source of machines) propose(source, source.building.kind === 'splitter' ? source.nextOutput : 0);

  // Slots come from one snapshot; leaving cargo cannot free a slot in this batch.
  const accepted: Transfer[] = [];
  const sent = new Set<MachineState>();
  const reservations = new Map<string, Inventory>();
  const reserve = () => {
    for (const [key, group] of proposals) {
      const last = lastSource.get(key);
      const start = last ? group.findIndex(proposal => compareTiles(proposal.source.building, last) > 0) : 0;
      const ordered = start > 0 ? [...group.slice(start), ...group.slice(0, start)] : group;
      const reserved = reservations.get(key) ?? inventory();
      reservations.set(key, reserved);
      for (const proposal of ordered) {
        const used = proposal.destination.building.kind === 'assembler' ? reserved[proposal.item] : itemCount(reserved);
        if (used >= host.freeSlots(proposal.destination, proposal.item)) continue;
        accepted.push(proposal);
        sent.add(proposal.source);
        reserved[proposal.item]++;
        lastSource.set(key, { c: proposal.source.building.c, r: proposal.source.building.r });
      }
    }
  };
  reserve();
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
    } else if (source.building.kind === 'storage') {
      source.input[item]--;
      source.progress = 0;
      source.nextItem = (ITEMS.indexOf(item) + 1) % ITEMS.length;
    } else source.output[item]--;
    if (isConveyor(destination.building.kind)) {
      destination.item = item;
      destination.progress = 0;
      destination.enteredFrom = direction;
    } else host.receive(destination, item);
  }
}

export function recoverContents(machine: MachineState, recovered: Inventory): Inventory {
  const contents = inventory();
  for (const item of ITEMS) {
    contents[item] = machine.input[item] + machine.output[item];
    moveInventory(machine.input, recovered, item, machine.input[item]);
    moveInventory(machine.output, recovered, item, machine.output[item]);
  }
  if (machine.item) {
    contents[machine.item]++;
    recovered[machine.item]++;
    machine.item = null;
  }
  return contents;
}
