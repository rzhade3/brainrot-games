import type { Level, Power } from './types';
import { validateBoard } from './validate-board';

export interface GenerationContext {
  seed: number;
  wave: number;
  difficulty: { cycle: number };
}
export interface LevelGenerator {
  id: string;
  version: number;
  generate(context: GenerationContext): Level;
  /** A fresh authored board, validated through the same contract as generated candidates. */
  fallback(context: GenerationContext): Level;
  requiredRewards?: Partial<Record<Power, number>>;
}
export interface GenerationResult {
  board: Level;
  replay: GenerationContext & { generatorId: string; generatorVersion: number };
  diagnostics: { attemptSeeds: number[]; failures: string[][]; fallback: boolean };
}
export function deriveSeed(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}
export function random(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
/** Custom generators and map adapters share this boundary; there is no operation DSL. */
export function generateLevel(
  generator: LevelGenerator,
  context: GenerationContext,
  allowFallback = false,
): GenerationResult {
  if (
    !Number.isInteger(context.seed) ||
    context.seed < 0 ||
    context.seed > 0xffffffff ||
    !Number.isInteger(context.wave) ||
    context.wave < 1 ||
    !Number.isInteger(context.difficulty.cycle) ||
    context.difficulty.cycle < 0
  )
    throw Error('Invalid generation context');
  const diagnostics: GenerationResult['diagnostics'] = { attemptSeeds: [], failures: [], fallback: false };
  const replay = {
    ...context,
    difficulty: { ...context.difficulty },
    generatorId: generator.id,
    generatorVersion: generator.version,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = deriveSeed(context.seed, attempt);
    diagnostics.attemptSeeds.push(seed);
    // Programming/schema errors propagate immediately. Only invalid generated placements retry.
    const board = generator.generate({ ...context, seed, difficulty: { ...context.difficulty } });
    const errors = validateBoard(board, generator.requiredRewards);
    if (!errors.length) return { board, replay, diagnostics };
    diagnostics.failures.push(errors);
  }
  if (!allowFallback)
    throw Error(
      `${generator.id}@${generator.version}: exhausted generation attempts for seed ${context.seed}: ${JSON.stringify(diagnostics.failures)}`,
    );
  const board = generator.fallback(context);
  const errors = validateBoard(board, generator.requiredRewards);
  if (errors.length) throw Error(`${generator.id}: invalid fallback: ${errors.join(', ')}`);
  diagnostics.fallback = true;
  return { board, replay, diagnostics };
}
