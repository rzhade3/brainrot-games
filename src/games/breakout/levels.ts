import { LEVEL_DEFINITIONS } from './levels/catalog';
import { generateWave } from './levels/registry';
export type { Brick, Power, Obstacle, Chamber, Level } from './levels/types';
export { LEVEL_DEFINITIONS } from './levels/catalog';
export { generateWave } from './levels/registry';

export const LEVEL_NAMES = LEVEL_DEFINITIONS.map(level => level.name);

/** Compatibility entry point for the original boards and their regression fixtures. */
export function makeLevel(wave: number) {
  return generateWave(wave, 0, { procedural: false }).board;
}
