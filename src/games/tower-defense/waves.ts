/**
 * Wave scheduler. Alternates between a `prep` phase (player builds; a timer
 * counts down, or the player starts the wave early) and a `wave` phase
 * (enemies spawn on an interval and must be cleared). Clearing a wave advances
 * the wave number and returns to prep with a tougher composition.
 */
import { Enemy, makeEnemy, randomEdgeSpawn, waveComposition, WaveComposition } from './enemies';

export type Phase = 'prep' | 'wave';

const FIRST_PREP = 25;
const PREP = 18;

export class WaveManager {
  number = 0;
  phase: Phase = 'prep';
  prepTimeLeft = FIRST_PREP;

  private comp: WaveComposition = waveComposition(1);
  private toSpawn = 0;
  private spawnTimer = 0;

  private cols: number;
  private rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  reset(): void {
    this.number = 0;
    this.phase = 'prep';
    this.prepTimeLeft = FIRST_PREP;
    this.comp = waveComposition(1);
    this.toSpawn = 0;
    this.spawnTimer = 0;
  }

  /** Begin the next wave immediately, skipping any remaining prep time. */
  startWave(): void {
    if (this.phase !== 'prep') return;
    this.number += 1;
    this.comp = waveComposition(this.number);
    this.toSpawn = this.comp.count;
    this.spawnTimer = 0;
    this.phase = 'wave';
  }

  /**
   * Advance the scheduler. During `wave`, spawns due enemies (pushed into
   * `enemies`). Returns true when a wave has just been fully cleared so the
   * caller can award a bonus / relayout.
   */
  update(dt: number, enemies: Enemy[]): boolean {
    if (this.phase === 'prep') {
      this.prepTimeLeft -= dt;
      if (this.prepTimeLeft <= 0) this.startWave();
      return false;
    }

    // wave phase: spawn on interval until the budget is exhausted
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      while (this.spawnTimer <= 0 && this.toSpawn > 0) {
        const p = randomEdgeSpawn(this.cols, this.rows);
        enemies.push(makeEnemy(this.comp, p.x, p.y));
        this.toSpawn -= 1;
        this.spawnTimer += this.comp.spawnInterval;
      }
    }

    const cleared = this.toSpawn === 0 && enemies.length === 0;
    if (cleared) {
      this.phase = 'prep';
      this.prepTimeLeft = PREP;
    }
    return cleared;
  }
}
