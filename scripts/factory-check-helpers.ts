import assert from 'node:assert/strict';
import { createSave, restoreSave } from '../src/games/factory/session/persistence';
import { FactorySimulation } from '../src/games/factory/game/simulation';
import { Building, BuildingKind, Direction, tileKey } from '../src/games/factory/game/model';

export function createDemo(): Map<string, Building> {
  const buildings = new Map<string, Building>();
  const add = (kind: BuildingKind, c: number, r: number, direction: Direction = 0) => {
    const building = { kind, c, r, direction };
    buildings.set(tileKey(building), building);
  };
  add('miner', 7, 10);
  for (let c = 8; c <= 11; c++) add('belt', c, 10);
  add('furnace', 12, 10);
  add('belt', 13, 10);
  add('belt', 14, 10, 1);
  add('belt', 14, 11, 1);
  add('storage', 14, 12, 1);
  add('miner', 9, 14);
  for (let c = 10; c <= 12; c++) add('belt', c, 14);
  add('furnace', 13, 14);
  add('belt', 14, 14);
  add('storage', 15, 14);
  return buildings;
}

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

export function emptyFactory(): FactorySimulation {
  const save = FactorySimulation.create().serialize();
  save.machines = save.machines.filter(machine => machine.building.kind === 'home');
  save.recovered['food-unit'] = save.settlement.starterFood;
  for (const resident of save.settlement.residents) {
    resident.tile = { c: resident.id % 2, r: Math.floor(resident.id / 2) };
  }
  return FactorySimulation.restore(save);
}

export function factoryFrom(buildings: ReadonlyMap<string, Building>): FactorySimulation {
  const sim = emptyFactory();
  for (const building of buildings.values()) assert.equal(sim.place(building), null);
  return sim;
}
