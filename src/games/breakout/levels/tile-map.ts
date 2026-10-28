import type { Brick, Level, Obstacle, Power } from './types';

export type Tile =
  | {
      kind: 'brick';
      hp?: number;
      power?: Power;
      gate?: boolean;
      group?: number;
      color?: string;
      span?: number;
      gap?: number;
    }
  | { kind: 'steel'; vent?: number };
export interface TileMap {
  name: string;
  hint: string;
  rows: readonly string[];
  legend: Readonly<Record<string, Tile>>;
  origin: { x: number; y: number };
  pitch: number;
  /** Optional shared behavior: bricks and retracting floors reference a group index. */
  groups?: readonly { color: string }[];
}

/** Literal placement only: no reward searches, implicit walls, or skipped tiles. */
export function compileTileMap(map: TileMap): Level {
  const width = map.rows[0]?.length ?? 0;
  if (!width || !map.rows.length || map.rows.some((row) => row.length !== width))
    throw Error(`${map.name}: ragged or empty map`);
  if (!Number.isFinite(map.pitch) || map.pitch <= 0) throw Error(`${map.name}: invalid pitch`);
  const bricks: Brick[] = [],
    obstacles: Obstacle[] = [];
  const occupied = new Set<string>();
  for (const [r, row] of map.rows.entries())
    for (let c = 0; c < row.length; c++) {
      const symbol = row[c];
      if (symbol === '.') continue;
      const tile = map.legend[symbol];
      if (!tile) throw Error(`${map.name}: unknown tile '${symbol}' at ${c},${r}`);
      const span = tile.kind === 'brick' ? (tile.span ?? 1) : 1;
      if (!Number.isInteger(span) || span < 1 || c + span > width)
        throw Error(`${map.name}: invalid tile span at ${c},${r}`);
      for (let i = 0; i < span; i++) {
        const key = `${c + i},${r}`;
        if (occupied.has(key) || (i > 0 && row[c + i] !== '.'))
          throw Error(`${map.name}: overlapping tile footprint at ${key}`);
        occupied.add(key);
      }
      const x = map.origin.x + c * map.pitch,
        y = map.origin.y + r * map.pitch;
      if (tile.kind === 'steel')
        obstacles.push({
          kind: 'steel',
          x,
          y,
          w: map.pitch,
          h: map.pitch,
          ...(tile.vent !== undefined ? { vent: tile.vent } : {}),
        });
      else {
        const hp = tile.hp ?? 1,
          gap = tile.gap ?? 2;
        if (!Number.isInteger(hp) || hp < 1 || !Number.isFinite(gap) || gap < 0 || gap >= map.pitch)
          throw Error(`${map.name}: invalid brick at ${c},${r}`);
        bricks.push({
          x,
          y,
          w: map.pitch * span - gap,
          h: map.pitch - gap,
          hp,
          maxHp: hp,
          ...(tile.power ? { power: tile.power } : {}),
          ...(tile.gate ? { gate: true } : {}),
          ...(tile.group !== undefined ? { chamber: tile.group } : {}),
          ...(tile.color ? { color: tile.color } : {}),
        });
      }
    }
  const chambers = map.groups?.map((group, id) => {
    const initial = bricks.filter((b) => b.chamber === id).length;
    return { id, color: group.color, initial, remaining: initial, activeTime: 0, opened: false };
  });
  return { name: map.name, hint: map.hint, bricks, obstacles, ...(chambers ? { chambers } : {}) };
}
