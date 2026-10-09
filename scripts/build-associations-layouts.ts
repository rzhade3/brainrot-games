import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { generateFromSpec } from '../src/games/associations/layoutGenerator';
import { LEVELS } from '../src/games/associations/levels';
import { solve } from '../src/games/associations/solver';
import type { GameState } from '../src/games/associations/rules';

const OUTPUT = resolve(fileURLToPath(new URL('..', import.meta.url)), 'src/games/associations/layouts.json');
const CHECK_ONLY = process.argv.includes('--check');
const VALIDATION_NODE_LIMIT = 2_000_000;

function seededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLayouts(): GameState[] {
  return LEVELS.map((spec, index) => {
    const level = index + 1;
    const state = generateFromSpec(level, spec, seededRng(0x4153534f + level * 0x9e3779b1));
    const result = solve(state, {
      budget: state.movesTotal,
      nodeLimit: VALIDATION_NODE_LIMIT,
      firstOnly: true,
    });
    if (!result.solved) {
      throw new Error(`Level ${level} failed solver validation after ${result.nodes} nodes.`);
    }
    console.log(
      `Level ${String(level).padStart(2, '0')}: ${state.categories.length} groups, ` +
      `${state.movesTotal} moves, solution ${result.length}`
    );
    return state;
  });
}

const output = `${JSON.stringify({ version: 1, layouts: buildLayouts() })}\n`;

if (CHECK_ONLY) {
  const existing = await readFile(OUTPUT, 'utf8');
  if (existing !== output) {
    throw new Error('Associations layouts are stale. Run npm run build:associations-layouts.');
  }
  console.log(`Validated ${LEVELS.length} deterministic Associations layouts.`);
} else {
  await writeFile(OUTPUT, output);
  console.log(`Wrote ${LEVELS.length} deterministic Associations layouts to ${OUTPUT}.`);
}
