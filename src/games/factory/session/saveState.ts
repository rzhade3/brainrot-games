import { BELT_TICKS, Building, inventory, Inventory, isBuildingKind, isConveyor, Item, itemCount, ITEMS, Tile, WORK_PRIORITIES } from '../game/domain';
import {
  acceptsInventoryItem, ASSEMBLER_RECIPE, hasRecipeInputs, inputSlots, isOre, machineCycleTicks, MachineState, Ore,
  outputCapacity, producesInventoryItem,
  ProductionLedger,
  SMELTER_RECIPES,
} from '../game/machines';
import { inBounds } from '../game/model';
import type { SettlementSave } from '../game/settlement';
import type { FactoryWorld } from '../game/world';
import { FactorySaveError } from './saveErrors';

export function requireSave(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FactorySaveError('damaged', `Corrupt factory save: ${message}`);
}

export function saveObject(value: unknown): Record<string, unknown> {
  requireSave(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected an object');
  return value as Record<string, unknown>;
}

export function saveCount(value: unknown): number {
  requireSave(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, 'invalid item count or tick');
  return value;
}

export function saveInventory(value: unknown): Inventory {
  const source = saveObject(value);
  const result = inventory();
  requireSave(Object.keys(source).length === ITEMS.length, 'invalid inventory fields');
  for (const item of ITEMS) result[item] = saveCount(source[item]);
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

export function restoreMachine(value: unknown, world: FactoryWorld): MachineState {
  const source = saveObject(value);
  const building = saveObject(source.building);
  requireSave(typeof building.kind === 'string' && (isBuildingKind(building.kind) || building.kind === 'home'), 'unknown machine');
  const machine: MachineState = {
    building: { ...saveTile(building), kind: building.kind, direction: saveDirection(building.direction) },
    input: saveInventory(source.input), output: saveInventory(source.output),
    progress: saveCount(source.progress), processing: saveOre(source.processing), lastProcessed: saveOre(source.lastProcessed),
    item: null, enteredFrom: saveDirection(source.enteredFrom), nextOutput: 0, nextItem: 0, running: false,
  };
  // Older saves contain this setting; validate it, but depot output is now automatic.
  if (building.outputEnabled !== undefined) {
    requireSave(machine.building.kind === 'storage' && typeof building.outputEnabled === 'boolean', 'invalid machine option');
  }
  if (building.upgraded !== undefined) {
    requireSave(machine.building.kind === 'miner' && typeof building.upgraded === 'boolean', 'invalid machine option');
    machine.building.upgraded = building.upgraded;
  }
  if (building.haulTo !== undefined) machine.building.haulTo = saveTile(building.haulTo);
  if (building.workPriority !== undefined) {
    requireSave(WORK_PRIORITIES.some(priority => priority === building.workPriority), 'invalid work priority');
    requireSave(!isConveyor(machine.building.kind) && !['home', 'kitchen', 'house'].includes(machine.building.kind), 'priority without resident work');
    machine.building.workPriority = building.workPriority as Building['workPriority'];
  }
  const nextItem = saveCount(source.nextItem);
  requireSave(nextItem < ITEMS.length && (machine.building.kind === 'storage' || nextItem === 0), 'invalid depot routing');
  machine.nextItem = nextItem;
  requireSave(source.item === null || typeof source.item === 'string' && ITEMS.some(item => item === source.item), 'unknown cargo');
  machine.item = source.item as Item | null;
  requireSave(typeof source.running === 'boolean', 'invalid machine activity');
  machine.running = source.running;
  const { kind } = machine.building;
  const nextOutput = source.nextOutput;
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
  const max = isConveyor(kind) || kind === 'storage' ? BELT_TICKS + 1
    : kind === 'miner' || kind === 'furnace' || kind === 'assembler' || kind === 'food-plot' || kind === 'woodcutting-site' || kind === 'mining-site' ? machineCycleTicks(machine) : 1;
  requireSave(machine.progress < max, 'invalid machine progress');
  requireSave(!isConveyor(kind) || machine.item !== null || machine.progress === 0, 'empty conveyor in progress');
  requireSave(kind !== 'furnace' || machine.processing !== null || machine.progress === 0, 'smelter missing its recipe');
  requireSave(kind !== 'assembler' || machine.progress === 0 || hasRecipeInputs(machine.input, ASSEMBLER_RECIPE),
    'assembler missing its recipe inputs');
  return machine;
}

export function copyMachine(machine: Readonly<MachineState>): MachineState {
  return {
    ...machine, building: { ...machine.building, ...(machine.building.haulTo ? { haulTo: { ...machine.building.haulTo } } : {}) },
    input: { ...machine.input }, output: { ...machine.output },
  };
}

export function assertConservation(
  machines: Iterable<MachineState>, recovered: Inventory, production: ProductionLedger,
  settlement: SettlementSave,
): void {
  for (const item of ITEMS) {
    requireSave(item.endsWith('-ore') || production.mined[item] === 0, 'invalid extraction ledger');
    requireSave(item.endsWith('-plate') || production.smelted[item] === 0 && production.recipeConsumed[item] === 0, 'invalid recipe ledger');
    requireSave(item === 'defense-supply' || production.assembled[item] === 0, 'invalid assembly ledger');
  }
  const held = { ...recovered };
  let kitchenFood = 0;
  for (const machine of machines) {
    if (machine.building.kind === 'kitchen') kitchenFood += machine.input['food-unit'];
    for (const item of ITEMS) held[item] += machine.input[item] + machine.output[item];
    if (machine.item) held[machine.item]++;
  }
  for (const resident of settlement.residents) if (resident.cargo) held[resident.cargo]++;
  requireSave(held.wood === settlement.producedWood, 'wood accounting mismatch');
  requireSave(held['food-unit'] + settlement.consumedFood ===
    settlement.starterFood + settlement.producedFood, 'food accounting mismatch');
  requireSave(kitchenFood + settlement.consumedFood + settlement.kitchenRemoved ===
    settlement.starterFood + settlement.kitchenDelivered, 'kitchen replenishment accounting mismatch');
  for (const metal of ['iron', 'copper'] as const) {
    const ore = `${metal}-ore` as const;
    const recipe = SMELTER_RECIPES[ore];
    const plate = recipe.output.item;
    requireSave(held[ore] + production.smelted[plate] / recipe.output.quantity * recipe.inputs[0].quantity === production.mined[ore] &&
      held[plate] + production.recipeConsumed[plate] === production.smelted[plate],
    'material accounting mismatch');
  }
  const supply = ASSEMBLER_RECIPE.output;
  requireSave(held[supply.item] === production.assembled[supply.item] &&
    ASSEMBLER_RECIPE.inputs.every(ingredient => production.recipeConsumed[ingredient.item] ===
      production.assembled[supply.item] / supply.quantity * ingredient.quantity), 'assembly accounting mismatch');
}
