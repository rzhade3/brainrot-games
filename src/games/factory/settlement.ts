import { Building, DIRECTIONS, Tile, tileKey } from './model';
import { FactoryWorld } from './world';
import { Item, ITEMS, MachineState, requireSave, saveCount, saveObject, saveTile } from './simulation';
import { acceptsInventoryItem, inputSlots, outputCapacity } from './machineRules';
export { KITCHEN_CAPACITY } from './machineRules';

export const WALK_TICKS = 3;
export const FARM_TICKS = 20;
export const MEAL_TICKS = 25;
export const STARTER_FOOD = 8;
export const RESIDENT_NAMES = ['Ada', 'Emil', 'Mira', 'Owen'] as const;

export interface ResidentJob {
  kind: 'farm' | 'collect' | 'deliver';
  source: Tile;
  destination: Tile | null;
  item: Item | null;
  path: Tile[];
}
export interface Resident {
  id: number;
  tile: Tile;
  travel: number;
  cargo: Item | null;
  job: ResidentJob | null;
  note: string;
}
export interface SettlementSave {
  version: 1;
  residents: Resident[];
  starterFood: number;
  producedFood: number;
  consumedFood: number;
  missedMeals: number;
  mealClock: number;
}
interface Host {
  machines: Map<string, MachineState>;
  world: FactoryWorld;
  automated: (machine: MachineState) => boolean;
  recover: (item: Item) => void;
}

export class Settlement {
  readonly state: SettlementSave;
  private revision = 0;
  private unreachable = new Map<string, number>();

  constructor(private host: Host, state?: SettlementSave) {
    this.state = state ?? {
      version: 1, starterFood: STARTER_FOOD, producedFood: 0, consumedFood: 0,
      missedMeals: 0, mealClock: 0,
      residents: [{ c: 11, r: 11 }, { c: 12, r: 11 }, { c: 12, r: 12 }, { c: 11, r: 13 }]
        .map((tile, id) => ({ id, tile, travel: 0, cargo: null, job: null, note: 'Looking for work' })),
    };
  }

  serialize(): SettlementSave {
    return structuredClone(this.state);
  }

  static restore(value: unknown, host: Host): Settlement {
    const source = saveObject(value);
    requireSave(source.version === 1, 'unsupported settlement version');
    const state: SettlementSave = {
      version: 1, residents: [], starterFood: saveCount(source.starterFood),
      producedFood: saveCount(source.producedFood), consumedFood: saveCount(source.consumedFood),
      missedMeals: saveCount(source.missedMeals), mealClock: saveCount(source.mealClock),
    };
    requireSave(state.starterFood === STARTER_FOOD && state.mealClock < MEAL_TICKS, 'invalid settlement food clock or grant');
    requireSave(Array.isArray(source.residents) && source.residents.length === RESIDENT_NAMES.length, 'invalid resident population');
    for (let i = 0; i < source.residents.length; i++) {
      const entry = saveObject(source.residents[i]);
      requireSave(entry.id === i, 'invalid resident identity');
      const resident: Resident = {
        id: i, tile: saveTile(entry.tile), travel: saveCount(entry.travel), cargo: null, job: null, note: '',
      };
      requireSave(entry.cargo === null || ITEMS.includes(entry.cargo as Item), 'invalid resident cargo');
      resident.cargo = entry.cargo as Item | null;
      requireSave(typeof entry.note === 'string' && entry.note.length <= 160, 'invalid resident status');
      resident.note = entry.note;
      requireSave(resident.travel < WALK_TICKS, 'invalid resident movement');
      if (entry.job !== null) {
        const job = saveObject(entry.job);
        requireSave(job.kind === 'farm' || job.kind === 'collect' || job.kind === 'deliver', 'invalid resident job');
        requireSave(job.item === null || ITEMS.includes(job.item as Item), 'invalid reserved cargo');
        requireSave(Array.isArray(job.path) && job.path.length <= host.world.size * host.world.size, 'invalid resident route');
        resident.job = {
          kind: job.kind, source: saveTile(job.source), destination: job.destination === null ? null : saveTile(job.destination),
          item: job.item as Item | null, path: job.path.map(saveTile),
        };
        const route = [resident.tile, ...resident.job.path];
        requireSave(route.every((tile, n) => n === 0 ||
          Math.abs(tile.c - route[n - 1].c) + Math.abs(tile.r - route[n - 1].r) === 1), 'nonadjacent resident route');
        const machine = host.machines.get(tileKey(resident.job.source));
        requireSave(machine && (job.kind !== 'farm' || machine.building.kind === 'food-plot'), 'missing resident source');
        requireSave(job.kind === 'farm' ? resident.cargo === null && job.item === null && job.destination === null
          : job.kind === 'collect' ? resident.cargo === null && job.item !== null && job.destination !== null
            : resident.cargo === job.item && job.item !== null && job.destination !== null, 'inconsistent resident job cargo');
        const target = job.kind === 'deliver' ? resident.job.destination! : resident.job.source;
        const end = route[route.length - 1];
        requireSave(Math.abs(end.c - target.c) + Math.abs(end.r - target.r) === 1, 'invalid resident access point');
      }
      requireSave(resident.job?.path.length || resident.travel === 0, 'movement without a route');
      requireSave(resident.cargo === null || resident.job?.kind === 'deliver', 'carried cargo without a delivery job');
      state.residents.push(resident);
    }
    const settlement = new Settlement(host, state);
    requireSave(state.residents.every(resident => settlement.walkable(resident.tile) &&
      (!resident.job || resident.job.path.every(tile => settlement.walkable(tile)))), 'resident outside walkable land');
    for (const machine of host.machines.values()) {
      for (const item of ITEMS) {
        requireSave(settlement.reservedSource(machine.building, item) <= settlement.stock(machine)[item], 'overreserved resident source');
      }
      const inbound = state.residents.filter(resident => resident.job?.destination &&
        tileKey(resident.job.destination) === tileKey(machine.building));
      for (const resident of inbound) requireSave(settlement.compatible(machine, resident.job!.item!), 'incompatible resident destination');
      requireSave(inbound.length <= settlement.capacity(machine), 'overreserved resident destination');
      for (const item of ITEMS) if (settlement.compatible(machine, item)) {
        requireSave(settlement.reservedDestination(machine.building, item) <=
          settlement.capacity(machine, item), 'overreserved resident ingredient');
      }
      requireSave(state.residents.filter(resident => resident.job?.kind === 'farm' &&
        tileKey(resident.job.source) === tileKey(machine.building)).length <= 1, 'duplicate farmer assignment');
    }
    requireSave(state.residents.every(resident => !resident.job?.destination ||
      host.machines.has(tileKey(resident.job.destination))), 'missing resident destination');
    return settlement;
  }

  reservedSource(tile: Tile, item: Item): number {
    return this.state.residents.filter(resident => resident.job?.kind === 'collect' &&
      tileKey(resident.job.source) === tileKey(tile) && resident.job.item === item).length;
  }

  reservedDestination(tile: Tile, item: Item | null): number {
    const kind = this.host.machines.get(tileKey(tile))?.building.kind;
    return this.state.residents.filter(resident => resident.job?.destination &&
      tileKey(resident.job.destination) === tileKey(tile) && (kind !== 'assembler' || resident.job.item === item)).length;
  }

  occupied(tile: Tile): boolean {
    return this.state.residents.some(resident => tileKey(resident.tile) === tileKey(tile) ||
      resident.job?.path[0] && tileKey(resident.job.path[0]) === tileKey(tile));
  }

  layoutChanged(): void {
    this.revision++;
    this.unreachable.clear();
    for (const resident of this.state.residents) {
      resident.travel = 0;
      const job = resident.job;
      if (!job) continue;
      const target = job.kind === 'deliver' ? job.destination : job.source;
      const source = this.host.machines.get(tileKey(job.source));
      const destination = job.destination && this.host.machines.get(tileKey(job.destination));
      if (!target || !source || job.kind !== 'farm' && (!destination || !this.compatible(destination, job.item!))) {
        this.cancel(resident);
        continue;
      }

      const path = this.route(resident.tile, target);
      if (!path) { this.cancel(resident); resident.note = 'Route blocked; looking for another job'; }
      else job.path = path;
    }
  }

  assignmentChanged(tile: Tile): void {
    for (const resident of this.state.residents) {
      if (resident.job?.kind !== 'farm' && resident.job && tileKey(resident.job.source) === tileKey(tile)) this.cancel(resident);
    }
    this.layoutChanged();
  }

  private cancel(resident: Resident): void {
    if (resident.cargo) { this.host.recover(resident.cargo); resident.cargo = null; }
    resident.job = null;
    resident.travel = 0;
  }

  private walkable(tile: Tile): boolean {
    return this.host.world.contains(tile) && !this.host.machines.has(tileKey(tile)) &&
      this.host.world.terrainAt(tile) !== 'water' && this.host.world.terrainAt(tile) !== 'tree';
  }

  private route(start: Tile, target: Tile): Tile[] | null {
    const cache = `${tileKey(start)}>${tileKey(target)}`;
    if (this.unreachable.get(cache) === this.revision) return null;
    const size = this.host.world.size;
    const initial = start.r * size + start.c;
    const previous = new Int32Array(size * size).fill(-2);
    const queue = new Int32Array(size * size);
    previous[initial] = -1;
    queue[0] = initial;
    let read = 0;
    let write = 1;
    while (read < write) {
      const index = queue[read++];
      const tile = { c: index % size, r: Math.floor(index / size) };
      if (Math.abs(tile.c - target.c) + Math.abs(tile.r - target.r) === 1) {
        const path: Tile[] = [];
        for (let at = index; previous[at] !== -1; at = previous[at]) path.push({ c: at % size, r: Math.floor(at / size) });
        return path.reverse();
      }
      for (const vector of DIRECTIONS) {
        const next = { c: tile.c + vector.c, r: tile.r + vector.r };
        if (!this.walkable(next)) continue;
        const key = next.r * size + next.c;
        if (previous[key] !== -2) continue;
        previous[key] = index;
        queue[write++] = key;
      }
    }
    this.unreachable.set(cache, this.revision);
    return null;
  }

  private stock(machine: MachineState) {
    return machine.building.kind === 'storage' ? machine.input : machine.output;
  }

  private compatible(machine: MachineState, item: Item): boolean {
    return acceptsInventoryItem(machine.building.kind, item);
  }

  private capacity(machine: MachineState, item?: Item): number {
    return inputSlots(machine, item);
  }

  private assign(resident: Resident): void {
    const priority = (machine: MachineState) => machine.building.haulTo &&
      this.host.machines.get(tileKey(machine.building.haulTo))?.building.kind === 'kitchen' ? 0 : 1;
    const machines = [...this.host.machines.values()].sort((a, b) => priority(a) - priority(b) ||
      a.building.c - b.building.c || a.building.r - b.building.r);
    for (const machine of machines) {
      if (machine.building.kind !== 'food-plot' || this.state.residents.some(worker =>
        worker.job?.kind === 'farm' && tileKey(worker.job.source) === tileKey(machine.building))) continue;
      const path = this.route(resident.tile, machine.building);
      if (!path) continue;
      resident.job = { kind: 'farm', source: { c: machine.building.c, r: machine.building.r }, destination: null, item: null, path };
      resident.note = 'Walking to farm';
      return;
    }
    let blocked = false;
    for (const machine of machines) {
      const target = machine.building.haulTo;
      if (!target || this.host.automated(machine)) continue;
      const destination = this.host.machines.get(tileKey(target));
      if (!destination) { blocked = true; continue; }
      for (const item of ITEMS) {
        if (this.stock(machine)[item] <= this.reservedSource(machine.building, item)) continue;
        if (!this.compatible(destination, item) ||
            this.capacity(destination, item) <= this.reservedDestination(target, item)) { blocked = true; continue; }
        const path = this.route(resident.tile, machine.building);
        const delivery = path && this.route(path[path.length - 1] ?? resident.tile, target);
        if (!path || !delivery) { blocked = true; continue; }
        resident.job = { kind: 'collect', source: { c: machine.building.c, r: machine.building.r },
          destination: { ...target }, item, path };
        resident.note = 'Walking to collect';
        return;
      }
    }
    resident.note = blocked ? 'Hauling blocked: check destination or access' : 'Available for work';
  }

  step(tick: number): void {
    for (const machine of this.host.machines.values()) if (machine.building.kind === 'food-plot') machine.running = false;
    for (const resident of this.state.residents) {
      if (!resident.job) {
        if (tick % 5 === resident.id) this.assign(resident);
        continue;
      }
      const job = resident.job;
      if (job.path.length) {
        resident.note = job.kind === 'deliver' ? 'Carrying cargo' : job.kind === 'farm' ? 'Walking to farm' : 'Walking to collect';
        if (++resident.travel >= WALK_TICKS) {
          resident.tile = job.path.shift()!;
          resident.travel = 0;
        }
        continue;
      }
      const source = this.host.machines.get(tileKey(job.source))!;
      if (job.kind === 'farm') {
        resident.note = source.output['food-unit'] >= outputCapacity(source.building.kind) ? 'Plot full; waiting for transport' : 'Farming';
        if (source.output['food-unit'] >= outputCapacity(source.building.kind)) continue;
        source.running = true;
        if (++source.progress >= FARM_TICKS) {
          source.progress = 0;
          source.output['food-unit']++;
          this.state.producedFood++;
        }
      } else if (job.kind === 'collect') {
        const path = this.route(resident.tile, job.destination!);
        if (!path || this.stock(source)[job.item!] <= 0) { this.cancel(resident); resident.note = 'Route blocked; cargo retained'; continue; }
        this.stock(source)[job.item!]--;
        resident.cargo = job.item;
        job.kind = 'deliver';
        job.path = path;
        resident.note = 'Carrying cargo';
      } else {
        const destination = this.host.machines.get(tileKey(job.destination!))!;
        destination.input[resident.cargo!]++;
        resident.cargo = null;
        resident.job = null;
        resident.note = 'Delivery complete';
      }
    }
    if (++this.state.mealClock >= MEAL_TICKS) {
      this.state.mealClock = 0;
      const kitchen = [...this.host.machines.values()].filter(machine => machine.building.kind === 'kitchen' &&
        machine.input['food-unit'] > 0).sort((a, b) => a.building.c - b.building.c || a.building.r - b.building.r)[0];
      if (kitchen) { kitchen.input['food-unit']--; this.state.consumedFood++; }
      else this.state.missedMeals++;
    }
  }

  home(): Building | undefined {
    return [...this.host.machines.values()].find(machine => machine.building.kind === 'home')?.building;
  }
}
