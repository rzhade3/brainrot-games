/**
 * Enemy definitions, spawning, and per-wave difficulty scaling.
 *
 * Enemies live in tile-space float coordinates (x,y) and march toward the
 * castle. Their movement/collision against player buildings is resolved in the
 * scene sim loop (it needs the grid + building occupancy); this module owns
 * enemy data, spawning, and how tough each wave is.
 */

export interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Tiles per second. */
  speed: number;
  /** Damage per second dealt to the castle or a blocking building. */
  dps: number;
  /** Ore granted to the player when killed. */
  reward: number;
  alive: boolean;
}

export interface WaveComposition {
  count: number;
  enemyHp: number;
  enemySpeed: number;
  enemyDps: number;
  reward: number;
  /** Seconds between spawns. */
  spawnInterval: number;
}

/** Difficulty curve for wave `n` (1-based). Endless and escalating. */
export function waveComposition(n: number): WaveComposition {
  return {
    count: 4 + Math.floor(n * 1.5),
    enemyHp: 20 * (1 + (n - 1) * 0.35),
    enemySpeed: Math.min(2.2, 1.0 + n * 0.03),
    enemyDps: 8 + n * 1.5,
    reward: 4 + n,
    spawnInterval: Math.max(0.35, 1.2 - n * 0.05),
  };
}

/** Create an enemy of the given wave strength at a spawn point (tile coords). */
export function makeEnemy(comp: WaveComposition, x: number, y: number): Enemy {
  return {
    x,
    y,
    hp: comp.enemyHp,
    maxHp: comp.enemyHp,
    speed: comp.enemySpeed,
    dps: comp.enemyDps,
    reward: comp.reward,
    alive: true,
  };
}

/** Pick a random spawn point on the outer edge of a cols×rows grid. */
export function randomEdgeSpawn(cols: number, rows: number): { x: number; y: number } {
  const side = Math.floor(Math.random() * 4);
  switch (side) {
    case 0:
      return { x: Math.random() * cols, y: 0 };
    case 1:
      return { x: cols - 0.01, y: Math.random() * rows };
    case 2:
      return { x: Math.random() * cols, y: rows - 0.01 };
    default:
      return { x: 0, y: Math.random() * rows };
  }
}
