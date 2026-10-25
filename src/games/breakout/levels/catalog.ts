import { CHAMBER_LEVELS } from './chamber-layouts';
import { CLASSIC_LEVELS } from './classic-layouts';
import { validateCatalog } from './validate';
import type { LevelDefinition } from './types';

/** Play order only. Add a blueprint to either collection; compilers need no changes. */
export const LEVEL_DEFINITIONS: readonly LevelDefinition[] = [...CHAMBER_LEVELS, ...CLASSIC_LEVELS];
validateCatalog(LEVEL_DEFINITIONS);
