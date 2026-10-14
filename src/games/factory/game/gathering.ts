import { DIRECTIONS, GATHER_RADIUS, Tile, tileKey } from './domain';
import type { FactoryWorld } from './world';

export interface TreeAccess {
  tree: Tile;
  access: Tile;
}

export function gatheringAccess(
  site: Tile, occupied: ReadonlyMap<string, unknown>, world: FactoryWorld,
): TreeAccess[] {
  const inRange = (tile: Tile) => world.contains(tile) &&
    Math.abs(tile.c - site.c) + Math.abs(tile.r - site.r) <= GATHER_RADIUS;
  const clear = (tile: Tile) => inRange(tile) && tileKey(tile) !== tileKey(site) &&
    !occupied.has(tileKey(tile)) && !['water', 'tree'].includes(world.terrainAt(tile));
  const queue = DIRECTIONS.map(vector => ({ c: site.c + vector.c, r: site.r + vector.r })).filter(clear);
  const seen = new Set(queue.map(tileKey));
  const result: TreeAccess[] = [];
  for (let read = 0; read < queue.length; read++) {
    const access = queue[read];
    for (const vector of DIRECTIONS) {
      const next = { c: access.c + vector.c, r: access.r + vector.r };
      if (!inRange(next)) continue;
      if (world.terrainAt(next) === 'tree') result.push({ tree: next, access });
      else if (clear(next) && !seen.has(tileKey(next))) {
        seen.add(tileKey(next));
        queue.push(next);
      }
    }
  }
  return result;
}
