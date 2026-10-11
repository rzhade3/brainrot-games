import {
  acceptsConveyorInput, Building, Direction, DIRECTIONS, inBounds, isConveyor,
  outputDirections, Tile, tileKey,
} from './model';
import { FactorySimulation, inventory, Inventory, ITEMS } from './simulation';

export interface BeltRoute {
  start: Tile;
  end: Tile;
  horizontalFirst: boolean;
  buildings: Building[];
  blocked: { tile: Tile; error: string } | null;
  canSwap: boolean;
}

function directionBetween(from: Tile, to: Tile): Direction {
  for (const direction of [0, 1, 2, 3] as const) {
    const vector = DIRECTIONS[direction];
    if (to.c - from.c === vector.c && to.r - from.r === vector.r) return direction;
  }
  throw new Error('Conveyor route contains nonadjacent tiles');
}

function line(start: Tile, end: Tile, horizontalFirst: boolean): Tile[] {
  const path = [{ ...start }];
  let { c, r } = start;
  const columns = () => {
    while (c !== end.c) {
      c += Math.sign(end.c - c);
      path.push({ c, r });
    }
  };
  const rows = () => {
    while (r !== end.r) {
      r += Math.sign(end.r - r);
      path.push({ c, r });
    }
  };
  if (horizontalFirst) { columns(); rows(); }
  else { rows(); columns(); }
  return path;
}

export function routeStartError(simulation: FactorySimulation, tile: Tile): string | null {
  const building = simulation.buildings.get(tileKey(tile));
  return building ? outputDirections(building).length ? null : 'This building has no output; choose a source'
    : simulation.placementError(tile, 'belt');
}

export function planRoute(
  simulation: FactorySimulation, start: Tile, end: Tile, horizontalFirst = true, fallback: Direction = 0,
): BeltRoute {
  const route: BeltRoute = {
    start: { c: start.c, r: start.r }, end: { c: end.c, r: end.r },
    horizontalFirst, buildings: [], blocked: null, canSwap: false,
  };
  const fail = (tile: Tile, error: string) => {
    route.blocked = { tile: { c: tile.c, r: tile.r }, error };
    return route;
  };
  const startError = routeStartError(simulation, start);
  if (startError) return fail(start, startError);
  if (!inBounds(end)) return fail(end, 'Outside the world');
  const source = simulation.buildings.get(tileKey(start));
  const receiver = simulation.buildings.get(tileKey(end));
  if (receiver?.kind === 'miner') return fail(end, 'Extractors have no input; choose a receiver');
  if (source && tileKey(start) === tileKey(end)) return fail(end, 'Choose a different destination');
  const starts = source ? outputDirections(source).map(direction => {
    const vector = DIRECTIONS[direction];
    return { c: start.c + vector.c, r: start.r + vector.r };
  }) : [start];
  if (receiver && starts.some(tile => tileKey(tile) === tileKey(end)) &&
      (!isConveyor(receiver.kind) || acceptsConveyorInput(receiver, start))) return route;
  const ends = receiver ? DIRECTIONS.map(vector => ({ c: end.c - vector.c, r: end.r - vector.r }))
    .filter(tile => !isConveyor(receiver.kind) || acceptsConveyorInput(receiver, tile)) : [end];
  const options = [horizontalFirst, !horizontalFirst].map(bend => {
    const candidates: { path: Tile[]; turns: number }[] = [];
    for (const first of starts) {
      for (const last of ends) {
        const path = line(first, last, bend);
        if (source) path.unshift(start);
        if (receiver) path.push(end);
        if (new Set(path.map(tileKey)).size !== path.length) continue;
        let turns = 0;
        for (let i = 2; i < path.length; i++) {
          if (directionBetween(path[i - 2], path[i - 1]) !== directionBetween(path[i - 1], path[i])) turns++;
        }
        candidates.push({ path, turns });
      }
    }
    candidates.sort((a, b) => a.path.length - b.path.length || a.turns - b.turns);
    return candidates[0];
  });
  const candidate = options[0] ?? options[1];
  if (!candidate) return fail(end, 'No compatible ports; choose a different destination');
  route.canSwap = !!options[0] && !!options[1] &&
    options[0].path.map(tileKey).join(';') !== options[1].path.map(tileKey).join(';');
  const path = candidate.path;
  const tiles = path.slice(source ? 1 : 0, receiver ? -1 : undefined);
  route.buildings = tiles.map(tile => {
    const i = path.findIndex(value => tileKey(value) === tileKey(tile));
    const next = path[i + 1];
    const previous = path[i - 1];
    return { ...tile, kind: 'belt', direction: next ? directionBetween(tile, next)
      : previous ? directionBetween(previous, tile) : fallback };
  });
  for (const building of route.buildings) {
    const error = simulation.placementError(building, 'belt');
    if (error) return fail(building, error);
  }
  return route;
}

export function commitRoute(
  simulation: FactorySimulation, preview: BeltRoute, fallback: Direction = 0,
): { placed: Building[]; error: string | null } {
  // Replan before writing so a stale endpoint or obstruction cannot produce a partial route.
  const route = planRoute(simulation, preview.start, preview.end, preview.horizontalFirst, fallback);
  if (route.blocked) return { placed: [], error: route.blocked.error };
  if (!route.buildings.length) return { placed: [], error: 'These ports are already connected' };
  if (preview.blocked || route.buildings.length !== preview.buildings.length ||
      route.buildings.some((building, i) => {
        const previous = preview.buildings[i];
        return tileKey(building) !== tileKey(previous) || building.direction !== previous.direction;
      })) return { placed: [], error: 'Route changed; review the updated preview before building' };
  const placed: Building[] = [];
  for (const building of route.buildings) {
    const error = simulation.place(building);
    if (error) throw new Error(`Prevalidated conveyor route failed: ${error}`);
    placed.push(simulation.buildings.get(tileKey(building))!);
  }
  return { placed, error: null };
}

export function undoRoute(simulation: FactorySimulation, route: readonly Building[]): { removed: number; recovered: Inventory } {
  const recovered = inventory();
  let removed = 0;
  for (const building of route) {
    if (simulation.buildings.get(tileKey(building)) !== building) continue;
    const contents = simulation.remove(building);
    for (const item of ITEMS) recovered[item] += contents[item];
    removed++;
  }
  return { removed, recovered };
}
