import { LEVEL_DEFINITIONS } from './levels/catalog';
import { compileChambers } from './levels/compile-chambers';
import { compileClassic } from './levels/compile-classic';
import type { Level } from './levels/types';
export type { Brick, Power, Obstacle, Chamber, Level } from './levels/types';
export { LEVEL_DEFINITIONS } from './levels/catalog';

export const LEVEL_NAMES = LEVEL_DEFINITIONS.map((level) => level.name);

export function makeLevel(wave: number): Level {
  const normalized = Math.max(1, Math.floor(wave));
  const definition = LEVEL_DEFINITIONS[(normalized - 1) % LEVEL_DEFINITIONS.length];
  const cycle = Math.floor((normalized - 1) / LEVEL_DEFINITIONS.length);
  return definition.kind === 'chambers'
    ? compileChambers(definition, cycle)
    : compileClassic(definition, normalized, cycle);
}
