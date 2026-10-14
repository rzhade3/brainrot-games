import { inventory, Inventory, ITEMS, STEP_MS } from './domain';

/** Resource flow is measured over the last 20 seconds of simulation time. */
export const FLOW_TICKS = 20_000 / STEP_MS;
/** Rates are reported per simulation minute. */
export const MINUTE_TICKS = 60_000 / STEP_MS;
export const FLOW_SAMPLE_TICKS = 1000 / STEP_MS;
/** Rates are withheld until this much simulation time has been observed. */
export const FLOW_MIN_TICKS = 5 * FLOW_SAMPLE_TICKS;

export interface FlowTotals {
  made: Inventory;
  used: Inventory;
  missedFood: number;
}

export interface FlowRates {
  /** Simulation ticks covered by the rates; zero while still measuring. */
  ticks: number;
  /** Units per simulation minute. */
  made: Inventory;
  used: Inventory;
  missedFood: number;
}

interface Sample extends FlowTotals {
  tick: number;
}

/**
 * Rolling, unsaved record of cumulative production and use. Restoring a save
 * starts a fresh measurement rather than inventing past flow.
 */
export class FlowTracker {
  private samples: Sample[] = [];

  sample(tick: number, totals: FlowTotals): void {
    this.samples.push({ tick, made: { ...totals.made }, used: { ...totals.used }, missedFood: totals.missedFood });
    while (this.samples.length > 1 && tick - this.samples[1].tick >= FLOW_TICKS) this.samples.shift();
  }

  rates(): FlowRates {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const ticks = first && last ? last.tick - first.tick : 0;
    const made = inventory();
    const used = inventory();
    if (ticks < FLOW_MIN_TICKS) return { ticks: 0, made, used, missedFood: 0 };
    const scale = MINUTE_TICKS / ticks;
    for (const item of ITEMS) {
      made[item] = (last.made[item] - first.made[item]) * scale;
      used[item] = (last.used[item] - first.used[item]) * scale;
    }
    return { ticks, made, used, missedFood: last.missedFood - first.missedFood };
  }
}
