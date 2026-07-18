/**
 * Resource ledger for Castle Defense.
 *
 * Ore is a *stockpile* — mined over time and spent to build. Energy is a *flow*
 * resource: it is not stored, only produced (generators) and demanded (miners,
 * turrets) each tick. When demand exceeds production, every powered building is
 * throttled by the same factor `production / demand`, so under-powering slows
 * mining and turret fire instead of hard-stopping the base.
 */
export class Economy {
  ore: number;
  energyProduced = 0;
  energyDemand = 0;

  constructor(startingOre = 60) {
    this.ore = startingOre;
  }

  /** 0–1 multiplier applied to powered buildings when demand > production. */
  get throttle(): number {
    if (this.energyDemand <= 0) return 1;
    return Math.min(1, this.energyProduced / this.energyDemand);
  }

  canAfford(cost: number): boolean {
    return this.ore >= cost;
  }

  spend(cost: number): boolean {
    if (this.ore < cost) return false;
    this.ore -= cost;
    return true;
  }

  addOre(amount: number): void {
    this.ore += amount;
  }

  /** Reset the per-tick energy accumulators before summing building demand. */
  beginEnergyTick(): void {
    this.energyProduced = 0;
    this.energyDemand = 0;
  }
}
