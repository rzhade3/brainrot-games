export type Power = 'triple' | 'add' | 'wide' | 'fire' | 'bomb' | 'shield' | 'slow';
export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  power?: Power;
  chamber?: number;
  gate?: boolean;
  color?: string;
}
export type Obstacle =
  | { kind: 'steel'; x: number; y: number; w: number; h: number; vent?: number }
  | { kind: 'bumper'; x: number; y: number; radius: number };
export interface Chamber {
  id: number;
  color: string;
  initial: number;
  remaining: number;
  activeTime: number;
  opened: boolean;
}
export interface Level {
  name: string;
  hint: string;
  bricks: Brick[];
  obstacles: Obstacle[];
  chambers?: Chamber[];
}

export interface RewardPocket {
  power: Power;
  /** 0 = top of the room's brick carpet; 1 = bottom. */
  depth: number;
}
export interface Opening {
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Offset from the left (horizontal wall) or top (vertical wall), in tiles. */
  offset: number;
  length: number;
}
export interface RoomDefinition {
  id: string;
  /** Tile coordinates, including the perimeter walls. */
  column: number;
  row: number;
  columns: number;
  rows: number;
  color: string;
  openings: readonly Opening[];
  rewards: readonly RewardPocket[];
}
export interface ChamberDefinition {
  kind: 'chambers';
  id: string;
  name: string;
  hint: string;
  /** Rooms paint in order. Nested rooms must follow their enclosing room. */
  rooms: readonly RoomDefinition[];
}
export interface ClassicDefinition {
  kind: 'classic';
  id: string;
  name: string;
  hint: string;
  /** Exactly 20 rows of 14 cells: # = brick, . = empty. */
  tiles: readonly string[];
  /** Stable armor variation seed; independent of catalog order. */
  armorPattern: number;
  obstacles: readonly Obstacle[];
}
export type LevelDefinition = ChamberDefinition | ClassicDefinition;
