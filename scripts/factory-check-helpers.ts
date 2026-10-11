import assert from 'node:assert/strict';
import { createSave, restoreSave } from '../src/games/factory/session/persistence';
import { FactorySimulation } from '../src/games/factory/game/simulation';

export function advanceTicks(simulation: FactorySimulation, count: number): void {
  for (let tick = 0; tick < count; tick++) simulation.step();
}

export function roundTrip(simulation: FactorySimulation): FactorySimulation {
  const restored = restoreSave(JSON.parse(JSON.stringify(createSave(simulation, true, 'factory-check')))).simulation;
  assert.deepEqual(restored.serialize(), simulation.serialize());
  return restored;
}

export function assertInvariants(simulation: FactorySimulation): void {
  const restored = FactorySimulation.restore(simulation.serialize());
  assert.deepEqual(restored.serialize(), simulation.serialize());
}
