import { GENERATOR_EDITION } from './endless';

const COMPACT_EDITION = 1;
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 7;
const SEED_COUNT = 0x100000000;
const INVALID_CODE = 'Use a full puzzle code, for example 000001A.';

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
  if (code.edition !== COMPACT_EDITION || !Number.isInteger(code.preset) || code.preset < 0 || code.preset > 5 ||
    !Number.isInteger(code.seed) || code.seed < 0 || code.seed >= SEED_COUNT) {
    throw new Error('This puzzle cannot be shared by this generator edition.');
  }
  // The preset takes three bits above the 32-bit seed. Use arithmetic to retain all 35 bits.
  let value = code.preset * SEED_COUNT + code.seed;
  let text = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    text = CODE_ALPHABET[value % CODE_ALPHABET.length] + text;
    value = Math.floor(value / CODE_ALPHABET.length);
  }
  return text;
}

export function parsePuzzleCode(text: string): PuzzleCode {
  const input = text.trim().toUpperCase();
  const legacy = /^CL(\d+)-T([1-6])-([0-9A-F]{8})$/.exec(input);
  if (legacy) {
    const edition = Number(legacy[1]);
    if (edition !== GENERATOR_EDITION) throw new Error(`Generator edition ${legacy[1]} is not supported by this version.`);
    return { edition, preset: Number(legacy[2]) - 1, seed: Number.parseInt(legacy[3], 16) };
  }

  if (input.length !== CODE_LENGTH) throw new Error(INVALID_CODE);
  const compact = input.replace(/O/g, '0').replace(/[IL]/g, '1');
  let value = 0;
  for (const character of compact) {
    const digit = CODE_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error(INVALID_CODE);
    value = value * CODE_ALPHABET.length + digit;
  }
  const preset = Math.floor(value / SEED_COUNT);
  if (preset > 5) throw new Error(INVALID_CODE);
  return { edition: COMPACT_EDITION, preset, seed: value % SEED_COUNT };
}
