export const BUILDING_KINDS = ['belt', 'splitter', 'miner', 'furnace', 'storage', 'assembler', 'home', 'food-plot', 'kitchen', 'woodcutting-site'] as const;
export type BuildingKind = typeof BUILDING_KINDS[number];
export type BuildableKind = Exclude<BuildingKind, 'home'>;
export type Tool = 'inspect' | BuildableKind;
export type Direction = 0 | 1 | 2 | 3;
export interface Tile { c: number; r: number }
export interface Point { x: number; y: number }
export const WORK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type WorkPriority = typeof WORK_PRIORITIES[number];
export interface Building extends Tile {
  kind: BuildingKind;
  direction: Direction;
  upgraded?: boolean;
  haulTo?: Tile;
  workPriority?: WorkPriority;
}

export const DIRECTIONS: readonly Tile[] = [
  { c: 1, r: 0 }, { c: 0, r: 1 }, { c: -1, r: 0 }, { c: 0, r: -1 },
];
export const DIRECTION_NAMES = ['East', 'South', 'West', 'North'] as const;

export function tileKey(tile: Tile): string {
  return `${tile.c},${tile.r}`;
}

export function compareTiles(a: Tile, b: Tile): number {
  return a.c - b.c || a.r - b.r;
}

export function nextDirection(direction: Direction): Direction {
  return ((direction + 1) % 4) as Direction;
}

export function isConveyor(kind: BuildingKind): boolean {
  return kind === 'belt' || kind === 'splitter';
}

export const HALF_WIDTH = 38;
export const HALF_HEIGHT = 19;
export const STEP_MS = 100;
export const EXTRACT_TICKS = 10;
export const UPGRADED_EXTRACT_TICKS = 8;
export const BELT_TICKS = 8;
export const WALK_TICKS = 3;
export const FARM_TICKS = 20;
export const GATHER_TICKS = 20;
export const GATHER_RADIUS = 4;
export const MEAL_TICKS = 25;

export function project(c: number, r: number): Point {
  return { x: (c - r) * HALF_WIDTH, y: (c + r) * HALF_HEIGHT };
}

export function unproject(x: number, y: number): Tile {
  return {
    c: Math.floor((x / HALF_WIDTH + y / HALF_HEIGHT) / 2 + 0.5),
    r: Math.floor((y / HALF_HEIGHT - x / HALF_WIDTH) / 2 + 0.5),
  };
}

export function variation(c: number, r: number): number {
  const hash = Math.imul(c + 41, 374761393) ^ Math.imul(r + 73, 668265263);
  return ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
}

export const ITEMS = ['iron-ore', 'copper-ore', 'iron-plate', 'copper-plate', 'defense-supply', 'food-unit', 'wood'] as const;
export type Item = typeof ITEMS[number];
export type Inventory = Record<Item, number>;
export const ITEM_NAMES: Record<Item, string> = {
  'iron-ore': 'Iron ore', 'copper-ore': 'Copper ore',
  'iron-plate': 'Iron plates', 'copper-plate': 'Copper plates',
  'defense-supply': 'Defense supplies', 'food-unit': 'Food units', wood: 'Wood',
};
const ITEM_UNIT_NAMES: Record<Item, string> = {
  'iron-ore': 'iron ore', 'copper-ore': 'copper ore',
  'iron-plate': 'iron plate', 'copper-plate': 'copper plate',
  'defense-supply': 'defense supply', 'food-unit': 'food unit', wood: 'wood',
};

export function itemName(item: Item, quantity = 1): string {
  return quantity === 1 ? ITEM_UNIT_NAMES[item] : ITEM_NAMES[item].toLowerCase();
}

export function itemText(item: Item, quantity: number): string {
  return `${quantity} ${itemName(item, quantity)}`;
}

export function inventory(): Inventory {
  return { 'iron-ore': 0, 'copper-ore': 0, 'iron-plate': 0, 'copper-plate': 0, 'defense-supply': 0, 'food-unit': 0, wood: 0 };
}

export function itemCount(items: Readonly<Inventory>): number {
  return ITEMS.reduce((sum, item) => sum + items[item], 0);
}

export function inventoryText(items: Readonly<Inventory>): string {
  return ITEMS.filter(item => items[item] > 0).map(item => itemText(item, items[item])).join(', ') || 'Empty';
}

export function firstItem(items: Readonly<Inventory>): Item | null {
  return ITEMS.find(item => items[item] > 0) ?? null;
}

export function moveInventory(source: Inventory, destination: Inventory, item: Item, quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || source[item] < quantity ||
      !Number.isSafeInteger(destination[item] + quantity)) throw new Error('Invalid inventory transfer');
  source[item] -= quantity;
  destination[item] += quantity;
}

export const NAMES: Record<BuildingKind, string> = {
  belt: 'Conveyor', splitter: 'Splitter', miner: 'Extractor', furnace: 'Smelter',
  storage: 'Depot', assembler: 'Assembler', home: 'Homestead',
  'food-plot': 'Food plot', kitchen: 'Communal kitchen',
  'woodcutting-site': 'Woodcutting site',
};

export const DESCRIPTIONS: Record<BuildingKind, string> = {
  belt: 'Items enter from behind or either side and leave toward the arrow. Merging branches take turns.',
  splitter: 'Items enter from behind and alternate between the straight and right outputs. A blocked branch is skipped; if both are blocked, the item waits.',
  miner: 'Deposits do not run out. The arrow sends ore to a neighboring conveyor or building.',
  furnace: 'Iron ore becomes iron plates; copper ore becomes copper plates. The arrow sends plates to the next building.',
  storage: 'The arrow sends stored goods to a neighboring conveyor or building. Item types take turns; a blocked type waits.',
  assembler: 'Iron and copper plates become defense supplies. The arrow sends supplies to the next building.',
  home: 'Residents share farming, gathering and deliveries automatically. They keep working during food shortages.',
  'food-plot': 'The farmer works inside the plot; keep one clear exit. Farming pauses when the plot is full; a conveyor frees its carriers.',
  kitchen: 'Each serving uses one food unit for the whole household. Shortages do not harm residents or stop their work.',
  'woodcutting-site': 'Workers gather on the tree tile, then carry wood back; keep one clear exit beside the tree. Trees remain in place, and a conveyor frees carriers, not the woodcutter.',
};

export const CATALOG = [
  { kind: 'food-plot', category: 'production', note: 'Grows food for residents', shortcut: '9' },
  { kind: 'woodcutting-site', category: 'production', note: 'Gathers wood from groves', shortcut: '6' },
  { kind: 'kitchen', category: 'storage', note: 'Keeps residents fed', shortcut: '0' },
  { kind: 'miner', category: 'production', note: 'Draws ore from deposits', shortcut: '3' },
  { kind: 'furnace', category: 'production', note: 'Turns ore into plates', shortcut: '4' },
  { kind: 'belt', category: 'logistics', note: 'Carries items onward', shortcut: '2' },
  { kind: 'splitter', category: 'logistics', note: 'Divides a delivery route', shortcut: '8' },
  { kind: 'storage', category: 'storage', note: 'Holds items for later', shortcut: '5' },
  { kind: 'assembler', category: 'production', note: 'Assembles defense supplies', shortcut: '7' },
] as const satisfies readonly { kind: BuildableKind; category: string; note: string; shortcut: string }[];

export function isBuildingKind(value: string): value is BuildableKind {
  return CATALOG.some(entry => entry.kind === value);
}

export function isTool(value: string): value is Tool {
  return value === 'inspect' || isBuildingKind(value);
}
