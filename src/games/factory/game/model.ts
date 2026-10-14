import { Building, BuildingKind, Direction, DIRECTIONS, isConveyor, nextDirection, Tile, tileKey } from './domain';
import { DEFAULT_WORLD, FactoryWorld, WORLD_SIZE } from './world';
export * from './domain';

export const MAP_SIZE = WORLD_SIZE;

export type Terrain = 'grass' | 'water' | 'iron' | 'copper' | 'tree';
export function outputDirections(building: Building): readonly Direction[] {
  if (building.kind === 'home' || building.kind === 'kitchen' || building.kind === 'house') return [];
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
  const mining = kind === 'miner' || kind === 'mining-site';
  if (mining && terrain !== 'iron' && terrain !== 'copper') return `${kind === 'miner' ? 'Extractors' : 'Mining sites'} need an ore deposit`;
  if (!mining && !isConveyor(kind) && (terrain === 'iron' || terrain === 'copper')) {
    return 'Leave deposits free for mining';
  }
  return null;
}

export function createSettlement(): Map<string, Building> {
  return new Map([
    ['11,12', { kind: 'home', c: 11, r: 12, direction: 0 }],
    ['14,12', { kind: 'kitchen', c: 14, r: 12, direction: 0 }],
    ['10,9', { kind: 'food-plot', c: 10, r: 9, direction: 0, haulTo: { c: 14, r: 12 } }],
  ]);
}
