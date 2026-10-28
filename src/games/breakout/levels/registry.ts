import { LEVEL_DEFINITIONS } from './catalog';
import { compileChambers } from './compile-chambers';
import { compileClassic } from './compile-classic';
import { compileTileMap, type TileMap } from './tile-map';
import { generateLevel, type LevelGenerator } from './generation';
import { twinVaults } from './twin-vaults';

/** Plain authored maps need no procedural parameters or custom generator implementation. */
export function authoredMap(id: string, version: number, map: TileMap): LevelGenerator {
  const compile = () => compileTileMap(map);
  return { id, version, generate: compile, fallback: compile };
}

// Compatibility adapters preserve existing authored boards, including reward ordering.
// New families may use authoredMap(), a parameterized map, or any LevelGenerator.
export const LEGACY_GENERATORS: readonly LevelGenerator[] = LEVEL_DEFINITIONS.map((definition) => {
  const compile: LevelGenerator['generate'] = (context) =>
    definition.kind === 'chambers'
      ? compileChambers(definition, context.difficulty.cycle)
      : compileClassic(definition, context.wave, context.difficulty.cycle);
  return { id: definition.id, version: 0, generate: compile, fallback: compile };
});
export const GENERATORS = LEGACY_GENERATORS.map((generator) =>
  generator.id === twinVaults.id ? twinVaults : generator,
);

export function generateWave(
  wave: number,
  seed: number,
  options: { procedural?: boolean; allowFallback?: boolean } = {},
) {
  if (!Number.isFinite(wave)) throw Error('Wave must be finite');
  const normalized = Math.max(1, Math.floor(wave));
  const generators = options.procedural === false ? LEGACY_GENERATORS : GENERATORS;
  const generator = generators[(normalized - 1) % generators.length];
  return generateLevel(
    generator,
    { seed, wave: normalized, difficulty: { cycle: Math.floor((normalized - 1) / generators.length) } },
    options.allowFallback,
  );
}
