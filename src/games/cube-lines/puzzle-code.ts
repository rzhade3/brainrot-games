import { GENERATOR_EDITION } from './endless';

export interface PuzzleCode {
  edition: number;
  preset: number;
  seed: number;
}

export function endlessPreset(cleared: number): number {
  if (!Number.isSafeInteger(cleared) || cleared < 0) throw new Error('Invalid endless progress.');
  return Math.min(5, Math.floor(cleared / 5));
}

export function selectEndlessPreset(cleared: number): number {
  const unlocked = endlessPreset(cleared);
  if (!unlocked) return 0;
  const position = cleared % 5;
  if (position === 1) return unlocked - 1;
  if (position === 3) return Math.floor(cleared / 5) % unlocked;
  return unlocked;
}

export function formatPuzzleCode(code: PuzzleCode): string {
  if (code.edition !== GENERATOR_EDITION || !Number.isInteger(code.preset) || code.preset < 0 || code.preset > 5 ||
    !Number.isInteger(code.seed) || code.seed < 0 || code.seed > 0xffffffff) {
    throw new Error('This puzzle cannot be shared by this generator edition.');
  }
  return `CL${code.edition}-T${code.preset + 1}-${code.seed.toString(16).padStart(8, '0').toUpperCase()}`;
}

export function parsePuzzleCode(text: string): PuzzleCode {
  const match = /^CL(\d+)-T([1-6])-([0-9A-F]{8})$/.exec(text.trim().toUpperCase());
  if (!match) throw new Error('Use a full puzzle code, for example CL1-T1-0000002A.');
  const edition = Number(match[1]);
  if (edition !== GENERATOR_EDITION) throw new Error(`Generator edition ${match[1]} is not supported by this version.`);
  return { edition, preset: Number(match[2]) - 1, seed: Number.parseInt(match[3], 16) };
}
