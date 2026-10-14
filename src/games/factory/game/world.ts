import type { Tile } from './domain';
import { FactorySaveError, requireCompatibleSave } from '../session/saveErrors';

export const WORLD_SIZE = 256;
export const CHUNK_SIZE = 32;
export const GENERATOR_VERSION = 1;
export const DEFAULT_SEED = 'north-bank';
export const BIOMES = ['meadow', 'riverbank', 'upland'] as const;
export type Biome = typeof BIOMES[number];
export type Ground = 'land' | 'water';
export type Deposit = 'iron' | 'copper' | null;
export type Decoration = 'tree' | null;
export interface WorldTile {
  biome: Biome;
  ground: Ground;
  deposit: Deposit;
  decoration: Decoration;
  variant: number;
}
export interface WorldIdentity {
  id: 'seeded-world';
  generatorVersion: number;
  size: number;
  seed: string;
  terrainChanges: [];
}

export function normalizeSeed(seed: string): string {
  const normalized = seed.trim();
  if (!normalized || normalized.length > 64) throw new Error('World seed must contain 1-64 characters.');
  return normalized;
}

export function hashSeed(seed: string): number {
  let result = 2166136261;
  for (let i = 0; i < seed.length; i++) result = Math.imul(result ^ seed.charCodeAt(i), 16777619);
  return result >>> 0;
}

export function randomAt(seed: number, c: number, r: number): number {
  let value = Math.imul(c, 374761393) ^ Math.imul(r, 668265263) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function noise(seed: number, c: number, r: number, scale: number): number {
  const x = c / scale;
  const y = r / scale;
  const left = Math.floor(x);
  const top = Math.floor(y);
  const sx = (x - left) ** 2 * (3 - 2 * (x - left));
  const sy = (y - top) ** 2 * (3 - 2 * (y - top));
  const a = randomAt(seed, left, top);
  const b = randomAt(seed, left + 1, top);
  const d = randomAt(seed, left, top + 1);
  const e = randomAt(seed, left + 1, top + 1);
  return (a + (b - a) * sx) * (1 - sy) + (d + (e - d) * sx) * sy;
}

export class FactoryWorld {
  readonly size = WORLD_SIZE;
  readonly seed: string;
  readonly start: Readonly<Tile> = Object.freeze({ c: 11, r: 11 });
  readonly iron: Readonly<Tile> = Object.freeze({ c: 7, r: 10 });
  readonly copper: Readonly<Tile> = Object.freeze({ c: 9, r: 14 });
  private cells = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
  private seedHash: number;

  constructor(seed = DEFAULT_SEED) {
    this.seed = normalizeSeed(seed);
    this.seedHash = hashSeed(this.seed);
    const riverBase = 76 + randomAt(this.seedHash, 1, 2) * 56;
    const riverPhase = randomAt(this.seedHash, 2, 3) * Math.PI * 2;
    const hillC = 180 + randomAt(this.seedHash, 3, 4) * 40;
    const hillR = 150 + randomAt(this.seedHash, 4, 5) * 50;
    for (let r = 0; r < WORLD_SIZE; r++) {
      const river = riverBase + Math.sin(r / 34 + riverPhase) * 17 + Math.sin(r / 83) * 10;
      for (let c = 0; c < WORLD_SIZE; c++) {
        const elevation = noise(this.seedHash, c, r, 64) * 0.75 + noise(this.seedHash ^ 731, c, r, 27) * 0.25;
        const moisture = noise(this.seedHash ^ 17539, c, r, 48);
        const riverDistance = Math.abs(c - river);
        const hill = ((c - hillC) / 45) ** 2 + ((r - hillR) / 50) ** 2;
        let biome = riverDistance < 16 || moisture > 0.68 ? 1 : elevation > 0.62 || hill < 1 ? 2 : 0;
        let water = riverDistance < 2.3 + moisture * 1.5;
        let deposit = 0;
        let tree = !water && randomAt(this.seedHash ^ 29, c, r) < (biome === 1 ? 0.22 : biome === 2 ? 0.025 : 0.015);
        const veinC = Math.floor(c / 16);
        const veinR = Math.floor(r / 16);
        const vein = randomAt(this.seedHash ^ 8923, veinC, veinR);
        const centerC = veinC * 16 + 4 + randomAt(this.seedHash ^ 19, veinC, veinR) * 8;
        const centerR = veinR * 16 + 4 + randomAt(this.seedHash ^ 83, veinC, veinR) * 8;
        if (!water && vein > 0.65 && ((c - centerC) / 2.5) ** 2 + ((r - centerR) / 2) ** 2 < 1) {
          deposit = vein > 0.83 ? 2 : 1;
          tree = false;
        }
        // Reserve a compact, connected starter clearing before any decorative placement.
        if (c <= 23 && r <= 23) {
          biome = 0;
          water = false;
          tree = false;
          deposit = c >= 6 && c <= 8 && r >= 9 && r <= 11 ? 1
            : c >= 8 && c <= 10 && r >= 13 && r <= 15 ? 2 : 0;
        }
        this.cells[r * WORLD_SIZE + c] = biome | (water ? 4 : 0) | (deposit << 3) | (tree ? 32 : 0);
      }
    }
    this.validateStart();
  }

  identity(): WorldIdentity {
    return { id: 'seeded-world', generatorVersion: GENERATOR_VERSION, size: this.size, seed: this.seed, terrainChanges: [] };
  }

  contains(tile: Tile): boolean {
    return Number.isInteger(tile.c) && Number.isInteger(tile.r) &&
      tile.c >= 0 && tile.r >= 0 && tile.c < this.size && tile.r < this.size;
  }

  at(tile: Tile): WorldTile {
    if (!this.contains(tile)) throw new Error('World tile is outside the map.');
    const cell = this.cells[tile.r * this.size + tile.c];
    const deposit = (cell >>> 3) & 3;
    return {
      biome: BIOMES[cell & 3], ground: cell & 4 ? 'water' : 'land',
      deposit: deposit === 1 ? 'iron' : deposit === 2 ? 'copper' : null,
      decoration: cell & 32 ? 'tree' : null,
      variant: Math.floor(randomAt(this.seedHash ^ 239, tile.c, tile.r) * 4),
    };
  }

  terrainAt(tile: Tile): 'grass' | 'water' | 'iron' | 'copper' | 'tree' {
    if (!this.contains(tile)) return 'water';
    const cell = this.at(tile);
    return cell.ground === 'water' ? 'water' : cell.deposit ?? cell.decoration ?? 'grass';
  }

  private validateStart(): void {
    for (let r = 0; r <= 23; r++) {
      for (let c = 0; c <= 23; c++) {
        const cell = this.at({ c, r });
        if (cell.ground !== 'land' || cell.decoration !== null) throw new Error('Generated starter clearing is obstructed.');
      }
    }
    if (this.at(this.iron).deposit !== 'iron' || this.at(this.copper).deposit !== 'copper') {
      throw new Error('Generated world is missing starter resources.');
    }
  }
}

export const DEFAULT_WORLD = new FactoryWorld();
let restoredWorld: FactoryWorld | null = null;

export function restoreWorld(value: unknown): FactoryWorld {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FactorySaveError('damaged', 'Corrupt factory save: missing world identity');
  const source = value as Record<string, unknown>;
  requireCompatibleSave(source.id === 'seeded-world' && source.generatorVersion === GENERATOR_VERSION && source.size === WORLD_SIZE,
    'Unsupported factory map version');
  if (typeof source.seed !== 'string' || source.seed !== source.seed.trim() || !source.seed || source.seed.length > 64 ||
      !Array.isArray(source.terrainChanges) || source.terrainChanges.length !== 0) {
    throw new FactorySaveError('damaged', 'Corrupt factory save: invalid generated world identity');
  }
  if (source.seed === DEFAULT_SEED) return DEFAULT_WORLD;
  if (restoredWorld?.seed !== source.seed) restoredWorld = new FactoryWorld(source.seed);
  return restoredWorld;
}
