export interface LaborDemand {
  key: string;
  weight: number;
  capacity: number;
}

export function weightedLaborTargets(demands: readonly LaborDemand[], population: number): Map<string, number> {
  const targets = new Map(demands.map(demand => [demand.key, 0]));
  let pending = demands.filter(demand => demand.capacity > 0);
  let remaining = population;
  while (pending.length && remaining > 0) {
    const unit = remaining / pending.reduce((sum, demand) => sum + demand.weight, 0);
    const capped = pending.filter(demand => demand.capacity <= demand.weight * unit);
    if (!capped.length) {
      for (const demand of pending) targets.set(demand.key, demand.weight * unit);
      break;
    }
    for (const demand of capped) {
      targets.set(demand.key, demand.capacity);
      remaining -= demand.capacity;
    }
    const keys = new Set(capped.map(demand => demand.key));
    pending = pending.filter(demand => !keys.has(demand.key));
  }
  return targets;
}
