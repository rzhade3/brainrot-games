import { DEFAULT_WORLD, FactoryWorld, WORLD_SIZE } from './world';

export const MAP_SIZE = WORLD_SIZE;
export const HALF_WIDTH = 38;
export const HALF_HEIGHT = 19;

export type Terrain = 'grass' | 'water' | 'iron' | 'copper' | 'tree';
export type BuildingKind = 'belt' | 'splitter' | 'miner' | 'furnace' | 'storage' | 'assembler' | 'outpost' | 'home' | 'food-plot' | 'kitchen';
export type BuildableKind = Exclude<BuildingKind, 'outpost' | 'home'>;
export type Tool = 'inspect' | BuildableKind;
export type Scenario = 'free-play' | 'guided' | 'settlement';
export const OUTPOST: Tile = { c: 16, r: 12 };
export type Direction = 0 | 1 | 2 | 3;
export interface Tile { c: number; r: number }
export interface Point { x: number; y: number }
export interface Building extends Tile {
  kind: BuildingKind;
  direction: Direction;
  outputEnabled?: boolean;
  upgraded?: boolean;
  haulTo?: Tile;
}

export const DIRECTIONS: readonly Tile[] = [
  { c: 1, r: 0 }, { c: 0, r: 1 }, { c: -1, r: 0 }, { c: 0, r: -1 },
];
export const DIRECTION_NAMES = ['East', 'South', 'West', 'North'] as const;
export const NAMES: Record<BuildingKind, string> = {
  belt: 'Conveyor', miner: 'Extractor', furnace: 'Smelter', storage: 'Depot',
  splitter: 'Splitter', assembler: 'Assembler', outpost: 'Outpost',
  home: 'Homestead', 'food-plot': 'Food plot', kitchen: 'Communal kitchen',
};
export const DESCRIPTIONS: Record<BuildingKind, string> = {
  belt: 'Items enter from behind or either side and leave toward the arrow. Merging branches take turns.',
  splitter: 'Rear input alternates between straight and right outputs. A blocked branch is skipped; both blocked means the item waits.',
  miner: 'Place on an ore deposit; deposits do not run out on this site. The arrow feeds a neighboring conveyor or machine.',
  furnace: 'Ore keeps its metal type when smelted. Items arrive from neighboring outputs; plates leave toward the arrow.',
  storage: 'The buffering project unlocks optional output; stock types take turns, and a blocked type waits. Removed contents go to recovery.',
  assembler: 'Plates arrive from neighboring outputs; supplies leave toward the arrow.',
  outpost: 'This fixed receiver consumes only the active order. Accepted deliveries stay counted when projects change or pause.',
  home: 'Residents farm and carry goods automatically, even during food shortages. The founding home stays in place; population is fixed for now.',
  'food-plot': 'Keep a clear tile beside the plot; farming pauses when it is full. A connected conveyor frees its carriers.',
  kitchen: 'Food feeds the whole household at each serving, not when delivered. Shortages do not harm residents or stop their work.',
};

export function tileKey(tile: Tile): string {
  return `${tile.c},${tile.r}`;
}

export function isConveyor(kind: BuildingKind): boolean {
  return kind === 'belt' || kind === 'splitter';
}

export function outputDirections(building: Building): readonly Direction[] {
  if (building.kind === 'storage' && !building.outputEnabled || building.kind === 'outpost' ||
      building.kind === 'home' || building.kind === 'kitchen') return [];
  return building.kind === 'splitter' ? [building.direction, nextDirection(building.direction)] : [building.direction];
}

export function acceptsConveyorInput(building: Building, source: Tile): boolean {
  const front = DIRECTIONS[building.direction];
  return building.kind === 'splitter'
    ? source.c === building.c - front.c && source.r === building.r - front.r
    : source.c !== building.c + front.c || source.r !== building.r + front.r;
}

export function conveyorInputs(building: Building, buildings: ReadonlyMap<string, Building>): Direction[] {
  const inputs: Direction[] = [];
  for (const direction of [0, 1, 2, 3] as const) {
    const vector = DIRECTIONS[direction];
    const source = buildings.get(tileKey({ c: building.c - vector.c, r: building.r - vector.r }));
    if (source && acceptsConveyorInput(building, source) && outputDirections(source).includes(direction)) inputs.push(direction);
  }
  return inputs;
}

export function project(c: number, r: number): Point {
  return { x: (c - r) * HALF_WIDTH, y: (c + r) * HALF_HEIGHT };
}

export function unproject(x: number, y: number): Tile {
  return {
    c: Math.floor((x / HALF_WIDTH + y / HALF_HEIGHT) / 2 + 0.5),
    r: Math.floor((y / HALF_HEIGHT - x / HALF_WIDTH) / 2 + 0.5),
  };
}

export function inBounds(tile: Tile): boolean {
  return Number.isInteger(tile.c) && Number.isInteger(tile.r) &&
    tile.c >= 0 && tile.r >= 0 && tile.c < MAP_SIZE && tile.r < MAP_SIZE;
}

export function variation(c: number, r: number): number {
  const hash = Math.imul(c + 41, 374761393) ^ Math.imul(r + 73, 668265263);
  return ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
}

export function terrainAt(tile: Tile, world: FactoryWorld = DEFAULT_WORLD): Terrain {
  return world.terrainAt(tile);
}

export function placementError(
  tile: Tile, kind: BuildingKind, buildings: ReadonlyMap<string, Building>, world: FactoryWorld = DEFAULT_WORLD,
): string | null {
  if (!world.contains(tile)) return 'Outside the world';
  if (buildings.has(tileKey(tile))) return 'Tile already occupied';
  const terrain = terrainAt(tile, world);
  if (terrain === 'water') return 'Cannot build on water';
  if (terrain === 'tree') return 'Choose a clear tile';
  if (kind === 'miner' && terrain !== 'iron' && terrain !== 'copper') return 'Extractors need an ore deposit';
  if (kind !== 'miner' && !isConveyor(kind) && (terrain === 'iron' || terrain === 'copper')) {
    return 'Leave deposits free for extractors';
  }
  return null;
}

export function createDemo(): Map<string, Building> {
  const buildings = new Map<string, Building>();
  const add = (kind: BuildingKind, c: number, r: number, direction: Direction = 0) => {
    const building = { kind, c, r, direction };
    buildings.set(tileKey(building), building);
  };
  add('miner', 7, 10);
  for (let c = 8; c <= 11; c++) add('belt', c, 10);
  add('furnace', 12, 10);
  add('belt', 13, 10);
  add('belt', 14, 10, 1);
  add('belt', 14, 11, 1);
  add('storage', 14, 12, 1);
  add('miner', 9, 14);
  for (let c = 10; c <= 12; c++) add('belt', c, 14);
  add('furnace', 13, 14);
  add('belt', 14, 14);
  add('storage', 15, 14);
  return buildings;
}

export function createGuided(): Map<string, Building> {
  const buildings = new Map([...createDemo()].filter(([, building]) => building.r <= 12));
  buildings.set(tileKey(OUTPOST), { ...OUTPOST, kind: 'outpost', direction: 0 });
  return buildings;
}

export function nextDirection(direction: Direction): Direction {
  return ((direction + 1) % 4) as Direction;
}

export function isBuildingKind(value: string): value is BuildableKind {
  return value === 'belt' || value === 'splitter' || value === 'miner' || value === 'furnace' || value === 'storage' ||
    value === 'assembler' || value === 'food-plot' || value === 'kitchen';
}

export function isTool(value: string): value is Tool {
  return value === 'inspect' || isBuildingKind(value);
}

function contains(points: Point[], point: Point): boolean {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 0.0001) continue;
    const nextSign = Math.sign(cross);
    if (sign && sign !== nextSign) return false;
    sign = nextSign;
  }
  return true;
}

export function pickBuilding(point: Point, buildings: ReadonlyMap<string, Building>): Building | null {
  const sorted = [...buildings.values()].sort((a, b) => (b.c + b.r) - (a.c + a.r) || b.c - a.c);
  for (const building of sorted) {
    const { x, y } = project(building.c, building.r);
    const w = isConveyor(building.kind) ? 35 : 28;
    const h = w / 2;
    const height = isConveyor(building.kind) ? 5 : building.kind === 'storage' ? 42 : 44;
    const outline = [
      { x: x - w, y: y - height }, { x, y: y - h - height },
      { x: x + w, y: y - height }, { x: x + w, y },
      { x, y: y + h }, { x: x - w, y },
    ];
    if (contains(outline, point)) return building;
    if (building.kind === 'furnace' &&
        point.x >= x - 2 && point.x <= x + 12 && point.y >= y - 67 && point.y <= y - 38) {
      return building;
    }
    if (building.kind === 'outpost' && contains([
      { x: x + 19, y: y - 61 }, { x: x + 31, y: y - 55 }, { x: x + 19, y: y - 50 },
    ], point)) return building;
  }
  return null;
}
