import type { BuildingKind } from './model';
import type { Inventory, Item, MachineState } from './simulation';
import type { Deposit } from './world';

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
  return kind === 'miner' || kind === 'furnace' || kind === 'assembler' || kind === 'food-plot' ? BUFFER_CAPACITY : 0;
}

export function producesInventoryItem(kind: BuildingKind, item: Item, deposit: Deposit): boolean {
  switch (kind) {
    case 'miner': return item === (deposit === 'copper' ? 'copper-ore' : 'iron-ore');
    case 'furnace': return Object.values(SMELTER_RECIPES).some(recipe => recipe.output.item === item);
    case 'assembler': return item === ASSEMBLER_RECIPE.output.item;
    case 'food-plot': return item === 'food-unit';
    default: return false;
  }
}
