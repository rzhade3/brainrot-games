import type Phaser from 'phaser';
import type { BuildingAppearance } from '../assets/art';
import { drawBuilding as drawAsset, drawBuildingActivity } from '../assets/art';
import { Building, isConveyor, project } from '../game/domain';
import type { MachineState } from '../game/machines';
import { machineCycleTicks } from '../game/machines';
import { conveyorInputs, outputDirections } from '../game/model';

export { diamond, drawOre, drawParcel, drawPreview, drawResident, drawTree, PALETTE, polygon } from '../assets/art';

export function buildingAppearance(building: Building, buildings?: ReadonlyMap<string, Building>): BuildingAppearance {
  return {
    kind: building.kind, origin: project(building.c, building.r), direction: building.direction,
    inputs: buildings && building.kind === 'belt' ? conveyorInputs(building, buildings) : [],
    variant: { c: building.c, r: building.r }, upgraded: !!building.upgraded, outputEnabled: !!building.outputEnabled,
  };
}

export function drawBuilding(
  graphics: Phaser.GameObjects.Graphics, building: Building, buildings?: ReadonlyMap<string, Building>,
): void {
  drawAsset(graphics, buildingAppearance(building, buildings));
}

export function drawMachineActivity(
  graphics: Phaser.GameObjects.Graphics, machine: Readonly<MachineState>,
  ticks: number, interpolation: number, paused: boolean, reducedMotion: boolean,
): void {
  const building = machine.building;
  const cycleTicks = machineCycleTicks(machine);
  drawBuildingActivity(graphics, {
    kind: building.kind, origin: project(building.c, building.r), direction: building.direction,
    enteredFrom: machine.enteredFrom, preferredOutput: outputDirections(building)[machine.nextOutput] ?? building.direction,
    cargo: machine.item, progress: (machine.progress + (building.kind === 'miner' && !machine.running ? 0 : interpolation)) / cycleTicks,
    running: machine.running,
    time: ticks + interpolation + (building.c * 7 + building.r * 11) * 34 / 31,
    motionPaused: reducedMotion || paused && !isConveyor(building.kind) && building.kind !== 'miner',
  });
}
