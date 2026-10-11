import { Building, BuildingKind, Direction, DIRECTIONS, isConveyor, nextDirection, Tile, tileKey } from './domain';
import { DEFAULT_WORLD, FactoryWorld, WORLD_SIZE } from './world';
export * from './domain';

export const MAP_SIZE = WORLD_SIZE;

export type Terrain = 'grass' | 'water' | 'iron' | 'copper' | 'tree';
export const OUTPOST: Tile = { c: 16, r: 12 };
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

export function inBounds(tile: Tile): boolean {
  return Number.isInteger(tile.c) && Number.isInteger(tile.r) &&
    tile.c >= 0 && tile.r >= 0 && tile.c < MAP_SIZE && tile.r < MAP_SIZE;
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
