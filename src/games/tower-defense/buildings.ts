/**
 * Data-driven building definitions and the BuildingManager that tracks placed
 * structures, validates placement, and runs per-tick production/consumption.
 *
 * Adding a new building type (or a building that produces/consumes a future
 * third resource) is a matter of adding an entry to BUILDINGS and, if it has
 * novel behaviour, a small branch in `tick`/turret handling — the sim loop
 * itself iterates definitions generically.
 */
import { Economy } from './economy';
import { Grid } from './grid';

export type BuildingKind = 'miner' | 'generator' | 'turret' | 'wall';

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  emoji: string;
  cost: number;
  maxHp: number;
  /** Continuous energy demand while active (miner, turret). */
  energyUse: number;
  /** Continuous energy production (generator). */
  energyProduce: number;
  /** Must sit on an ore tile (miner). */
  requiresOre: boolean;
  /** Ore mined per second at full power (miner). */
  oreRate: number;
  /** Turret targeting range in tiles. */
  range: number;
  /** Turret shots per second at full power. */
  fireRate: number;
  /** Turret damage per shot. */
  damage: number;
}

const base: Omit<BuildingDef, 'kind' | 'name' | 'emoji' | 'cost' | 'maxHp'> = {
  energyUse: 0,
  energyProduce: 0,
  requiresOre: false,
  oreRate: 0,
  range: 0,
  fireRate: 0,
  damage: 0,
};

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  miner: {
    ...base,
    kind: 'miner',
    name: 'Miner',
    emoji: '⛏️',
    cost: 20,
    maxHp: 40,
    energyUse: 2,
    requiresOre: true,
    oreRate: 1.5,
  },
  generator: {
    ...base,
    kind: 'generator',
    name: 'Generator',
    emoji: '⚡',
    cost: 25,
    maxHp: 40,
    energyProduce: 6,
  },
  turret: {
    ...base,
    kind: 'turret',
    name: 'Turret',
    emoji: '🔫',
    cost: 30,
    maxHp: 60,
    energyUse: 3,
    range: 2.6,
    fireRate: 2,
    damage: 6,
  },
  wall: {
    ...base,
    kind: 'wall',
    name: 'Wall',
    emoji: '🧱',
    cost: 8,
    maxHp: 120,
  },
};

export const BUILD_ORDER: BuildingKind[] = ['miner', 'generator', 'turret', 'wall'];

export interface Building {
  kind: BuildingKind;
  def: BuildingDef;
  c: number;
  r: number;
  hp: number;
  /** Turret fire cooldown accumulator, in seconds. */
  cooldown: number;
}

export type PlacementError = null | 'out-of-bounds' | 'occupied' | 'needs-ore' | 'blocked-tile';

function key(c: number, r: number): string {
  return `${c},${r}`;
}

export class BuildingManager {
  private map = new Map<string, Building>();

  get all(): Building[] {
    return [...this.map.values()];
  }

  at(c: number, r: number): Building | undefined {
    return this.map.get(key(c, r));
  }

  clear(): void {
    this.map.clear();
  }

  /** Why placement of `kind` at (c,r) is invalid, or null if allowed. */
  validate(grid: Grid, kind: BuildingKind, c: number, r: number): PlacementError {
    if (!grid.inBounds(c, r)) return 'out-of-bounds';
    if (this.map.has(key(c, r))) return 'occupied';
    const terrain = grid.typeAt(c, r);
    if (terrain === 'castle') return 'blocked-tile';
    const def = BUILDINGS[kind];
    if (def.requiresOre && terrain !== 'ore') return 'needs-ore';
    if (!def.requiresOre && terrain === 'ore') return 'blocked-tile';
    return null;
  }

  place(kind: BuildingKind, c: number, r: number): Building {
    const def = BUILDINGS[kind];
    const b: Building = { kind, def, c, r, hp: def.maxHp, cooldown: 0 };
    this.map.set(key(c, r), b);
    return b;
  }

  remove(b: Building): void {
    this.map.delete(key(b.c, b.r));
  }

  /**
   * Accumulate this tick's energy production/demand, then apply throttled ore
   * mining. Turret firing is handled separately in the scene (needs enemies).
   */
  tick(economy: Economy, dt: number): void {
    economy.beginEnergyTick();
    for (const b of this.map.values()) {
      economy.energyProduced += b.def.energyProduce;
      economy.energyDemand += b.def.energyUse;
    }
    const throttle = economy.throttle;
    for (const b of this.map.values()) {
      if (b.kind === 'miner') {
        economy.addOre(b.def.oreRate * throttle * dt);
      }
      if (b.cooldown > 0) b.cooldown = Math.max(0, b.cooldown - dt);
    }
  }
}
