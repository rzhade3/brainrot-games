import { Building, compareTiles, DIRECTIONS, FARM_TICKS, GATHER_TICKS, Item, ITEMS, FOOD_READINESS_TICKS, RESIDENT_FOOD_TICKS, HOUSE_WOOD_COST, HOUSE_CAPACITY, Tile, tileKey, WALK_TICKS, WORK_PRIORITIES } from './domain';
import { gatheringAccess, TreeAccess } from './gathering';
import { acceptsInventoryItem, inputCapacity, inputSlots, KITCHEN_CAPACITY, MachineState, outputCapacity, workerSlots } from './machines';
import { requireSave, saveCount, saveObject, saveTile } from '../session/saveState';
import { requireCompatibleSave } from '../session/saveErrors';
import { FactoryWorld } from './world';
export { FARM_TICKS, MEAL_TICKS, WALK_TICKS } from './domain';
export { KITCHEN_CAPACITY } from './machines';

export const STARTER_FOOD = 8;
/** Walking tiles one priority step outweighs when ranking hauling work. */
export const PRIORITY_TILES = 16;
/** A full source buffer counts as this many priority steps, so neglected stock rises. */
export const FULLNESS_STEPS = 3;
const ROUTE_ATTEMPTS = 4;
export const RESIDENT_NAMES = ['Ada', 'Emil', 'Mira', 'Owen'] as const;
export type ResidentJob =
  | { kind: 'farm'; source: Tile; destination: null; item: null; path: Tile[] }
  | { kind: 'gather' | 'return-wood'; source: Tile; destination: null; item: 'wood'; tree: Tile; access: Tile; path: Tile[] }
  | { kind: 'collect' | 'deliver'; source: Tile; destination: Tile; item: Item; path: Tile[] };

export interface Resident {
  id: number;
  home: Tile;
  joinedAt: number;
  tile: Tile;
  siteAccess: Tile | null;
  exit: Tile | null;
  travel: number;
  cargo: Item | null;
  job: ResidentJob | null;
  /** Production site this resident staffs; hauling fills time the site cannot use. */
  post: Tile | null;
  note: string;
}

export interface SettlementSave {
  version: 7;
  residents: Resident[];
  starterFood: number;
  producedFood: number;
  producedWood: number;
  consumedFood: number;
  missedMeals: number;
  mealClock: number;
  foodObservedSince: number;
  kitchenDelivered: number;
  kitchenRemoved: number;
  foodHistory: FoodEvent[];
}

export interface LaborSummary {
  posted: number;
  hauling: number;
  free: number;
  openPosts: number;
}

export interface FoodEvent {
  tick: number;
  harvested: number;
  delivered: number;
  removed: number;
  missed: number;
}

export interface HousingInspection {
  complete: boolean;
  occupied: number;
  capacity: number;
  population: number;
  prospective: number;
  requiredFood: number;
  stockedFood: number;
  harvestedFood: number;
  deliveredFood: number;
  observedTicks: number;
  missedFood: number;
  arrival: Tile | null;
  reason: string | null;
}

export function residentName(id: number): string {
  if (!Number.isSafeInteger(id) || id < 0) throw new Error(`Unknown resident: ${id}`);
  return RESIDENT_NAMES[id % RESIDENT_NAMES.length] + (id < RESIDENT_NAMES.length ? '' : ` ${Math.floor(id / RESIDENT_NAMES.length) + 1}`);
}

export function residentWorkTile(job: ResidentJob | null): Tile | null {
  if (job?.kind === 'farm') return job.source;
  if (job?.kind === 'gather') return job.tree;
  return null;
}

export function residentNextTile(resident: Resident): Tile {
  return resident.job?.path[0] ?? resident.exit ?? resident.tile;
}

interface Host {
  machines: Map<string, MachineState>;
  world: FactoryWorld;
  automated: (machine: MachineState) => boolean;
  recover: (item: Item) => void;
  receive: (machine: MachineState, item: Item) => void;
  ticks: () => number;
}

export class Settlement {
  readonly state: SettlementSave;
  private regions: Int32Array | null = null;
  private accessRegions = new Map<string, number[]>();
  private assignmentSources: MachineState[] | null = null;
  private treeAccess = new Map<string, TreeAccess[]>();
  private postsDirty = true;
  private routeBlocked = false;

  constructor(private host: Host, state?: SettlementSave) {
    this.state = state ?? {
      version: 7, starterFood: STARTER_FOOD, producedFood: 0, producedWood: 0, consumedFood: 0,
      missedMeals: 0, mealClock: 0, foodObservedSince: 0, kitchenDelivered: 0, kitchenRemoved: 0, foodHistory: [],
      residents: [{ c: 11, r: 11 }, { c: 12, r: 11 }, { c: 12, r: 12 }, { c: 11, r: 13 }]
        .map((tile, id) => ({ id, home: { c: 11, r: 12 }, joinedAt: 0, tile, siteAccess: null, exit: null, travel: 0, cargo: null, job: null, post: null, note: 'Looking for work' })),
    };
  }

  serialize(): SettlementSave {
    return structuredClone(this.state);
  }

  static restore(value: unknown, host: Host): Settlement {
    const source = saveObject(value);
    requireCompatibleSave(source.version === 7, 'unsupported settlement version');
    const state: SettlementSave = {
      version: 7, residents: [], starterFood: saveCount(source.starterFood), producedWood: saveCount(source.producedWood),
      producedFood: saveCount(source.producedFood), consumedFood: saveCount(source.consumedFood),
      missedMeals: saveCount(source.missedMeals), mealClock: saveCount(source.mealClock),
      foodObservedSince: saveCount(source.foodObservedSince), kitchenDelivered: saveCount(source.kitchenDelivered),
      kitchenRemoved: saveCount(source.kitchenRemoved), foodHistory: [],
    };
    requireSave(Array.isArray(source.residents) && source.residents.length >= RESIDENT_NAMES.length &&
      source.residents.length <= RESIDENT_NAMES.length + host.machines.size, 'invalid resident population');
    const population = source.residents.length;
    requireSave(state.foodObservedSince <= host.ticks(), 'invalid food observation start');
    requireSave(Array.isArray(source.foodHistory) && source.foodHistory.length <= FOOD_READINESS_TICKS + 1, 'invalid food history');
    for (const raw of source.foodHistory) {
      const entry = saveObject(raw);
      const event = { tick: saveCount(entry.tick), harvested: saveCount(entry.harvested), delivered: saveCount(entry.delivered),
        removed: saveCount(entry.removed), missed: saveCount(entry.missed) };
      requireSave(event.tick > Math.max(state.foodObservedSince, host.ticks() - FOOD_READINESS_TICKS) &&
        event.tick <= host.ticks() && (!state.foodHistory.length || event.tick > state.foodHistory[state.foodHistory.length - 1].tick),
      'invalid food history tick');
      requireSave(event.harvested + event.delivered + event.removed + event.missed > 0 &&
        event.harvested <= population && event.delivered <= host.world.size ** 2 + population &&
        event.removed <= (host.world.size ** 2) * KITCHEN_CAPACITY &&
        event.missed <= Math.ceil(population / RESIDENT_FOOD_TICKS), 'invalid food history quantities');
      state.foodHistory.push(event);
    }
    for (const [field, total] of [['harvested', state.producedFood], ['delivered', state.kitchenDelivered],
      ['removed', state.kitchenRemoved], ['missed', state.missedMeals]] as const) {
      requireSave(state.foodHistory.reduce((sum, event) => sum + event[field], 0) <= total, 'food history exceeds accounting');
    }
    requireSave(state.starterFood === STARTER_FOOD && state.mealClock < RESIDENT_FOOD_TICKS, 'invalid settlement food clock or grant');
    for (let i = 0; i < source.residents.length; i++) {
      const entry = saveObject(source.residents[i]);
      requireSave(entry.id === i, 'invalid resident identity');
      const resident: Resident = {
        id: i, home: saveTile(entry.home), joinedAt: saveCount(entry.joinedAt), tile: saveTile(entry.tile), siteAccess: entry.siteAccess === null ? null : saveTile(entry.siteAccess),
        exit: entry.exit === null ? null : saveTile(entry.exit),
        travel: saveCount(entry.travel), cargo: null, job: null, note: '',
        post: entry.post === null ? null : saveTile(entry.post),
      };
      const post = resident.post && host.machines.get(tileKey(resident.post));
      requireSave(!resident.post || post && state.residents.filter(other => other.post &&
        tileKey(other.post) === tileKey(resident.post!)).length < workerSlots(post.building.kind), 'invalid resident post');
      const home = host.machines.get(tileKey(resident.home));
      requireSave(resident.joinedAt <= host.ticks() && (i < RESIDENT_NAMES.length
        ? home?.building.kind === 'home' && resident.joinedAt === 0
        : home?.building.kind === 'house' && home.input.wood === HOUSE_WOOD_COST &&
          resident.joinedAt >= state.residents[i - 1].joinedAt + FOOD_READINESS_TICKS), 'invalid resident home or arrival');
      requireSave(i < RESIDENT_NAMES.length || !state.residents.some(other => tileKey(other.home) === tileKey(resident.home)),
        'housing over capacity');
      requireSave(entry.cargo === null || ITEMS.includes(entry.cargo as Item), 'invalid resident cargo');
      resident.cargo = entry.cargo as Item | null;
      requireSave(typeof entry.note === 'string' && entry.note.length <= 160, 'invalid resident status');
      resident.note = entry.note;
      requireSave(resident.travel < WALK_TICKS, 'invalid resident movement');
      if (entry.job !== null) {
        const job = saveObject(entry.job);
        requireSave(job.kind === 'farm' || job.kind === 'collect' || job.kind === 'deliver' ||
          job.kind === 'gather' || job.kind === 'return-wood', 'invalid resident job');
        requireSave(job.item === null || ITEMS.includes(job.item as Item), 'invalid reserved cargo');
        requireSave(Array.isArray(job.path) && job.path.length <= host.world.size * host.world.size, 'invalid resident route');
        const source = saveTile(job.source);
        const path = job.path.map(saveTile);
        if (job.kind === 'farm') {
          requireSave(job.destination === null && job.item === null, 'invalid farming assignment');
          resident.job = { kind: job.kind, source, destination: null, item: null, path };
        } else if (job.kind === 'gather' || job.kind === 'return-wood') {
          requireSave(job.destination === null && job.item === 'wood' &&
            host.machines.get(tileKey(source))?.building.kind === 'woodcutting-site', 'invalid woodcutting assignment');
          const gatheringJob: Extract<ResidentJob, { tree: Tile }> = { kind: job.kind, source, destination: null, item: 'wood',
            tree: saveTile(job.tree), access: saveTile(job.access), path };
          resident.job = gatheringJob;
          requireSave(gatheringAccess(source, host.machines, host.world).some(candidate =>
            tileKey(candidate.tree) === tileKey(gatheringJob.tree) && tileKey(candidate.access) === tileKey(gatheringJob.access)),
          'inaccessible gathering tree');
        } else {
          requireSave(job.destination !== null && job.item !== null, 'invalid hauling assignment');
          resident.job = { kind: job.kind, source, destination: saveTile(job.destination), item: job.item as Item, path };
        }
        const route = [resident.tile, ...resident.job.path];
        requireSave(route.every((tile, n) => n === 0 ||
          Math.abs(tile.c - route[n - 1].c) + Math.abs(tile.r - route[n - 1].r) === 1), 'nonadjacent resident route');
        const machine = host.machines.get(tileKey(resident.job.source));
        requireSave(machine && (job.kind !== 'farm' || machine.building.kind === 'food-plot'), 'missing resident source');
        requireSave(job.kind === 'gather' ? resident.cargo === null
          : job.kind === 'return-wood' ? resident.cargo === 'wood'
          : job.kind === 'farm' ? resident.cargo === null && job.item === null && job.destination === null
          : job.kind === 'collect' ? resident.cargo === null && job.item !== null && job.destination !== null
            : resident.cargo === job.item && job.item !== null && job.destination !== null, 'inconsistent resident job cargo');
        const target = job.kind === 'deliver' ? resident.job.destination! : resident.job.source;
        const end = route[route.length - 1];
        const workTile = residentWorkTile(resident.job);
        requireSave(workTile ? tileKey(end) === tileKey(workTile)
          : Math.abs(end.c - target.c) + Math.abs(end.r - target.r) === 1, 'invalid resident access point');
        if (resident.job.kind === 'gather') {
          const access = route.length > 1 ? route[route.length - 2] : resident.siteAccess;
          requireSave(access && tileKey(access) === tileKey(resident.job.access), 'invalid gathering entry');
        }
      }
      requireSave(resident.job?.path.length || resident.exit || resident.travel === 0, 'movement without a route');
      requireSave(!resident.exit || !resident.job && resident.siteAccess &&
        tileKey(resident.exit) === tileKey(resident.siteAccess), 'invalid resident exit');
      requireSave(resident.cargo === null || resident.job?.kind === 'deliver' || resident.job?.kind === 'return-wood',
        'carried cargo without a delivery job');
      state.residents.push(resident);
    }
    const settlement = new Settlement(host, state);
    const residentTicks = state.residents.reduce((sum, resident) => sum + host.ticks() - resident.joinedAt, 0);
    requireSave(state.mealClock === residentTicks % RESIDENT_FOOD_TICKS &&
      state.consumedFood + state.missedMeals === Math.floor(residentTicks / RESIDENT_FOOD_TICKS),
    'inconsistent resident consumption clock');
    requireSave(state.foodObservedSince === state.residents[state.residents.length - 1].joinedAt,
      'inconsistent food observation start');
    requireSave(state.residents.every(resident => {
      const workTile = residentWorkTile(resident.job);
      const inside = resident.siteAccess && settlement.canInhabit(resident.tile) &&
        settlement.walkable(resident.siteAccess) &&
        Math.abs(resident.tile.c - resident.siteAccess.c) + Math.abs(resident.tile.r - resident.siteAccess.r) === 1;
      return (resident.siteAccess ? inside && (resident.job || resident.exit) : settlement.walkable(resident.tile)) &&
        (!resident.job || resident.job.path.every((tile, index, path) => settlement.walkable(tile) ||
          workTile && index === path.length - 1 && tileKey(tile) === tileKey(workTile) && settlement.canInhabit(tile))) &&
        (!resident.exit || settlement.walkable(resident.exit));
    }), 'resident outside walkable land or assigned work site');
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
      requireSave(state.residents.filter(resident => (resident.job?.kind === 'gather' || resident.job?.kind === 'return-wood') &&
        tileKey(resident.job.source) === tileKey(machine.building)).length <= 1, 'duplicate gathering assignment');
      if (machine.building.kind === 'woodcutting-site') {
        requireSave(machine.output.wood + settlement.returningWood(machine.building) <= outputCapacity(machine.building.kind),
          'overreserved gathering output');
        requireSave(machine.progress === 0 || state.residents.some(resident => resident.job?.kind === 'gather' &&
          !resident.job.path.length && tileKey(resident.job.source) === tileKey(machine.building)),
        'gathering progress without a worker');
      }
    }
    const trees = state.residents.flatMap(resident => resident.job?.kind === 'gather' ? [tileKey(resident.job.tree)] : []);
    requireSave(new Set(trees).size === trees.length, 'duplicate gathering tree reservation');
    const occupiedSites = state.residents.filter(resident => resident.siteAccess).map(resident => tileKey(resident.tile));
    requireSave(new Set(occupiedSites).size === occupiedSites.length, 'duplicate work-site occupancy');
    requireSave(state.residents.every(resident => {
      const site = residentWorkTile(resident.job);
      return !site || !state.residents.some(other => other.id !== resident.id && other.siteAccess &&
        tileKey(other.tile) === tileKey(site));
    }), 'work site already occupied by another resident');
    requireSave(state.residents.every(resident => !resident.job?.destination ||
      host.machines.has(tileKey(resident.job.destination))), 'missing resident destination');
    return settlement;
  }

  reservedSource(tile: Tile, item: Item): number {
    return this.state.residents.filter(resident => resident.job?.kind === 'collect' &&
      tileKey(resident.job.source) === tileKey(tile) && resident.job.item === item).length;
  }

  private foodEvent(field: 'harvested' | 'delivered' | 'removed' | 'missed', quantity = 1): void {
    const tick = this.host.ticks();
    this.state.foodHistory = this.state.foodHistory.filter(event => event.tick > tick - FOOD_READINESS_TICKS);
    if (tick <= this.state.foodObservedSince || !quantity) return;
    let event = this.state.foodHistory[this.state.foodHistory.length - 1];
    if (!event || event.tick !== tick) {
      event = { tick, harvested: 0, delivered: 0, removed: 0, missed: 0 };
      this.state.foodHistory.push(event);
    }
    event[field] += quantity;
  }

  foodDelivered(): void {
    this.state.kitchenDelivered++;
    this.foodEvent('delivered');
  }

  foodRemoved(quantity: number): void {
    this.state.kitchenRemoved += quantity;
    this.foodEvent('removed', quantity);
  }

  housing(tile: Tile): HousingInspection {
    const machine = this.host.machines.get(tileKey(tile));
    const complete = machine?.building.kind === 'house' && machine.input.wood === HOUSE_WOOD_COST;
    const occupied = this.state.residents.filter(resident => tileKey(resident.home) === tileKey(tile)).length;
    const population = this.state.residents.length;
    const prospective = population + 1;
    const requiredFood = Math.ceil(prospective * FOOD_READINESS_TICKS / RESIDENT_FOOD_TICKS);
    const kitchens = [...this.host.machines.values()].filter(value => value.building.kind === 'kitchen').sort((a, b) => compareTiles(a.building, b.building));
    const stockedFood = kitchens.reduce((sum, value) => sum + value.input['food-unit'], 0);
    const history = this.state.foodHistory.filter(event => event.tick > this.host.ticks() - FOOD_READINESS_TICKS);
    const harvestedFood = history.reduce((sum, event) => sum + event.harvested, 0);
    const deliveredFood = Math.max(0, history.reduce((sum, event) => sum + event.delivered - event.removed, 0));
    const missedFood = history.reduce((sum, event) => sum + event.missed, 0);
    const observedTicks = Math.min(FOOD_READINESS_TICKS, this.host.ticks() - this.state.foodObservedSince);
    const arrival = complete ? DIRECTIONS.map(vector => ({ c: tile.c + vector.c, r: tile.r + vector.r }))
      .find(value => this.walkable(value) && !this.occupied(value) &&
        kitchens.some(kitchen => this.regionsFor(kitchen.building).includes(this.region(value)))) ?? null : null;
    const reason = !complete ? `Waiting for wood. Deliver ${HOUSE_WOOD_COST} wood to finish the house.`
      : occupied >= HOUSE_CAPACITY ? 'House occupied.'
        : !arrival ? 'No clear arrival path. Leave access beside the house and a connected kitchen.'
          : observedTicks < FOOD_READINESS_TICKS ? 'Watching food supply. Keep food arriving for the full observation period.'
            : missedFood ? 'Food ran short recently. Keep the kitchen supplied before inviting.'
              : harvestedFood < requiredFood || deliveredFood < requiredFood
                ? stockedFood >= requiredFood && kitchens.every(value => this.capacity(value) - this.reservedDestination(value.building, 'food-unit') <= 1)
                  ? 'Kitchens are nearly full. Add kitchen space so extra food can arrive before inviting.'
                  : 'Food supply is too slow for another resident. Grow and deliver more food.'
                : stockedFood < requiredFood ? 'Kitchen reserve is too low. Stock more food before inviting.' : null;
    return { complete: !!complete, occupied, capacity: HOUSE_CAPACITY, population, prospective, requiredFood,
      stockedFood, harvestedFood, deliveredFood, observedTicks, missedFood, arrival, reason };
  }

  invite(tile: Tile): string | null {
    const inspection = this.housing(tile);
    if (inspection.reason) return inspection.reason;
    if (!inspection.arrival) throw new Error('Ready house has no arrival tile');
    this.state.residents.push({
      id: this.state.residents.length, home: { c: tile.c, r: tile.r }, joinedAt: this.host.ticks(),
      tile: { ...inspection.arrival }, siteAccess: null, exit: null, travel: 0, cargo: null, job: null, post: null, note: 'Looking for work',
    });
    this.postsDirty = true;
    this.rebalance();
    this.state.foodObservedSince = this.host.ticks();
    this.state.foodHistory = [];
    return null;
  }

  reservedDestination(tile: Tile, item: Item | null): number {
    const kind = this.host.machines.get(tileKey(tile))?.building.kind;
    return this.state.residents.filter(resident => resident.job?.destination &&
      tileKey(resident.job.destination) === tileKey(tile) && (kind !== 'assembler' || resident.job.item === item)).length;
  }

  occupied(tile: Tile): boolean {
    return this.state.residents.some(resident => tileKey(resident.tile) === tileKey(tile) ||
      tileKey(residentNextTile(resident)) === tileKey(tile));
  }

  blocksExit(tile: Tile): boolean {
    return this.state.residents.some(resident => resident.siteAccess &&
      Math.abs(tile.c - resident.tile.c) + Math.abs(tile.r - resident.tile.r) === 1 &&
      !DIRECTIONS.some(vector => {
        const next = { c: resident.tile.c + vector.c, r: resident.tile.r + vector.r };
        return tileKey(next) !== tileKey(tile) && this.walkable(next);
      }));
  }

  layoutChanged(): void {
    this.regions = null;
    this.accessRegions.clear();
    this.postsDirty = true;
    this.assignmentSources = null;
    this.treeAccess.clear();
    for (const resident of this.state.residents) {
      resident.travel = 0;
      if (resident.siteAccess) {
        if (this.walkable(resident.tile)) {
          resident.siteAccess = null;
          resident.exit = null;
        } else {
          if (!this.walkable(resident.siteAccess)) {
            resident.siteAccess = DIRECTIONS.map(vector => ({ c: resident.tile.c + vector.c, r: resident.tile.r + vector.r }))
              .find(tile => this.walkable(tile)) ?? null;
            if (!resident.siteAccess) throw new Error('Occupied work site has no clear exit');
          }
          if (resident.exit) resident.exit = { ...resident.siteAccess };
        }
      }
      const job = resident.job;
      if (!job) continue;
      if (job.kind === 'gather' || job.kind === 'return-wood') {
        const source = this.host.machines.get(tileKey(job.source));
        if (job.kind === 'gather' && resident.siteAccess && tileKey(resident.tile) === tileKey(job.tree)) {
          job.access = { ...resident.siteAccess };
        }
        const valid = source && this.accessFor(job.source).some(candidate =>
          tileKey(candidate.tree) === tileKey(job.tree) && tileKey(candidate.access) === tileKey(job.access));
        const path = valid ? job.kind === 'gather'
          ? this.workRoute(resident, job.tree, job.access)
          : this.route(resident.tile, job.source, false, resident.siteAccess) : null;
        if (!path) { this.cancel(resident); resident.note = 'Grove access blocked'; }
        else {
          job.path = path;
          if (job.kind === 'gather' && path.length && source) source.progress = 0;
        }
        continue;
      }
      const target = job.kind === 'deliver' ? job.destination : job.source;
      const source = this.host.machines.get(tileKey(job.source));
      const destination = job.destination && this.host.machines.get(tileKey(job.destination));
      if (!target || !source || job.kind !== 'farm' && (!destination || !this.compatible(destination, job.item!))) {
        this.cancel(resident);
        continue;
      }

      const path = job.kind === 'farm' ? this.workRoute(resident, job.source)
        : this.route(resident.tile, target, false, resident.siteAccess);
      if (!path) { this.cancel(resident); resident.note = 'Route blocked. Looking for other work.'; }
      else job.path = path;
    }
    this.rebalance();
  }

  assignmentChanged(tile: Tile): void {
    for (const resident of this.state.residents) {
      if ((resident.job?.kind === 'collect' || resident.job?.kind === 'deliver') &&
        tileKey(resident.job.source) === tileKey(tile)) this.cancel(resident);
    }
    this.layoutChanged();
  }

  private cancel(resident: Resident): void {
    if (resident.job?.kind === 'gather') {
      const source = this.host.machines.get(tileKey(resident.job.source));
      if (source) source.progress = 0;
    }
    if (resident.cargo) { this.host.recover(resident.cargo); resident.cargo = null; }
    this.clearJob(resident);
  }

  private residentRegion(resident: Resident): number {
    return this.region(resident.siteAccess ?? resident.tile);
  }

  private clearJob(resident: Resident): void {
    resident.job = null;
    resident.exit = resident.siteAccess ? { ...resident.siteAccess } : null;
    resident.travel = 0;
  }

  private region(tile: Tile): number {
    if (!this.host.world.contains(tile)) return -2;
    const size = this.host.world.size;
    const regions = this.regions ??= new Int32Array(size * size).fill(-1);
    const initial = tile.r * size + tile.c;
    if (regions[initial] !== -1) return regions[initial];
    if (!this.walkable(tile)) return regions[initial] = -2;
    const queue = new Int32Array(size * size);
    queue[0] = initial;
    regions[initial] = initial;
    let read = 0;
    let write = 1;
    let root = initial;
    while (read < write) {
      const index = queue[read++];
      root = Math.min(root, index);
      for (const vector of DIRECTIONS) {
        const next = { c: index % size + vector.c, r: Math.floor(index / size) + vector.r };
        if (!this.host.world.contains(next)) continue;
        const key = next.r * size + next.c;
        if (regions[key] !== -1) continue;
        if (!this.walkable(next)) { regions[key] = -2; continue; }
        regions[key] = initial;
        queue[write++] = key;
      }
    }
    for (let i = 0; i < write; i++) regions[queue[i]] = root;
    return root;
  }

  private regionsFor(tile: Tile): number[] {
    const key = tileKey(tile);
    let regions = this.accessRegions.get(key);
    if (!regions) {
      regions = [...new Set(DIRECTIONS.map(vector => this.region({ c: tile.c + vector.c, r: tile.r + vector.r }))
        .filter(region => region >= 0))].sort((a, b) => a - b);
      this.accessRegions.set(key, regions);
    }
    return regions;
  }

  private accessFor(tile: Tile): TreeAccess[] {
    const key = tileKey(tile);
    let access = this.treeAccess.get(key);
    if (!access) { access = gatheringAccess(tile, this.host.machines, this.host.world); this.treeAccess.set(key, access); }
    return access;
  }

  private returningWood(tile: Tile): number {
    return this.state.residents.filter(resident => resident.job?.kind === 'return-wood' &&
      tileKey(resident.job.source) === tileKey(tile)).length;
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

  private walkable(tile: Tile): boolean {
    return this.host.world.contains(tile) && !this.host.machines.has(tileKey(tile)) &&
      this.host.world.terrainAt(tile) !== 'water' && this.host.world.terrainAt(tile) !== 'tree';
  }

  private canInhabit(tile: Tile): boolean {
    return this.host.machines.get(tileKey(tile))?.building.kind === 'food-plot' ||
      this.host.world.terrainAt(tile) === 'tree';
  }

  private workRoute(resident: Resident, site: Tile, access?: Tile): Tile[] | null {
    if (resident.siteAccess && tileKey(resident.tile) === tileKey(site)) return [];
    const path = this.route(resident.tile, access ?? site, !!access, resident.siteAccess);
    return path && [...path, { ...site }];
  }

  private walk(resident: Resident): boolean {
    const next = residentNextTile(resident);
    if (tileKey(next) === tileKey(resident.tile)) return false;
    if (++resident.travel >= WALK_TICKS) {
      const workTile = residentWorkTile(resident.job);
      if (!this.walkable(next)) {
        if (!workTile || tileKey(next) !== tileKey(workTile) || !this.canInhabit(next)) {
          throw new Error('Resident tried to enter an unassigned work site');
        }
        resident.siteAccess = { ...resident.tile };
      } else resident.siteAccess = null;
      resident.tile = { ...next };
      if (resident.job?.path.length) resident.job.path.shift();
      resident.exit = null;
      resident.travel = 0;
    }
    return true;
  }

  private treeClaimed(tree: Tile): boolean {
    return this.state.residents.some(worker => worker.job?.kind === 'gather' &&
      tileKey(worker.job.tree) === tileKey(tree) || worker.siteAccess && tileKey(worker.tile) === tileKey(tree));
  }

  private route(start: Tile, target: Tile, exact = false, siteAccess: Tile | null = null): Tile[] | null {
    const region = this.region(siteAccess ?? start);
    if (region < 0 || (exact ? this.region(target) !== region : !this.regionsFor(target).includes(region))) return null;
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
      if (this.walkable(tile) && (exact ? tileKey(tile) === tileKey(target)
        : Math.abs(tile.c - target.c) + Math.abs(tile.r - target.r) === 1)) {
        const path: Tile[] = [];
        for (let at = index; previous[at] !== -1; at = previous[at]) path.push({ c: at % size, r: Math.floor(at / size) });
        return path.reverse();
      }
      for (const vector of DIRECTIONS) {
        const next = { c: tile.c + vector.c, r: tile.r + vector.r };
        if (!this.walkable(next)) continue;
        if (siteAccess && this.region(next) !== region) continue;
        const key = next.r * size + next.c;
        if (previous[key] !== -2) continue;
        previous[key] = index;
        queue[write++] = key;
      }
    }
    return null;
  }

  private tier(machine: MachineState): number {
    return WORK_PRIORITIES.indexOf(machine.building.workPriority ?? 'normal') - 1;
  }

  private isPost(machine: MachineState | undefined): machine is MachineState {
    return !!machine && workerSlots(machine.building.kind) > 0 && this.tier(machine) >= 0;
  }

  private holders(tile: Tile): Resident[] {
    return this.state.residents.filter(resident => resident.post && tileKey(resident.post) === tileKey(tile));
  }

  /** The shared labor pool: residents at posts, carrying goods, or free, plus unstaffed posts. */
  labor(): LaborSummary {
    const carrying = (resident: Resident) => resident.job?.kind === 'collect' || resident.job?.kind === 'deliver';
    const hauling = this.state.residents.filter(carrying).length;
    const posted = this.state.residents.filter(resident => resident.post && !carrying(resident)).length;
    const free = this.state.residents.length - hauling - posted;
    const openPosts = [...this.host.machines.values()].filter(machine => this.isPost(machine))
      .reduce((sum, machine) => sum + workerSlots(machine.building.kind) - this.holders(machine.building).length, 0);
    return { posted, hauling, free, openPosts };
  }

  private reaches(resident: Resident, tile: Tile): boolean {
    return this.regionsFor(tile).includes(this.residentRegion(resident));
  }

  // Workplace slots are filled by priority, then stable tile order. A higher priority
  // slot may take a worker from a strictly lower one; otherwise posts are stable.
  private rebalance(): void {
    if (!this.postsDirty) return;
    this.postsDirty = false;
    const slots = [...this.host.machines.values()].filter(machine => this.isPost(machine))
      .sort((a, b) => this.tier(b) - this.tier(a) || compareTiles(a.building, b.building))
      .flatMap(machine => Array.from({ length: workerSlots(machine.building.kind) }, () => machine));
    const holders = new Map<string, Resident[]>();
    for (const resident of this.state.residents) {
      if (!resident.post) continue;
      const key = tileKey(resident.post);
      const machine = this.host.machines.get(key);
      const held = holders.get(key) ?? [];
      if (!this.isPost(machine) || !this.reaches(resident, resident.post) || held.length >= workerSlots(machine.building.kind)) resident.post = null;
      else holders.set(key, [...held, resident]);
    }
    const filled = new Map<string, number>();
    const assigned = slots.map(machine => {
      const key = tileKey(machine.building);
      const index = filled.get(key) ?? 0;
      filled.set(key, index + 1);
      return holders.get(key)?.[index] ?? null;
    });
    slots.forEach((machine, index) => {
      if (assigned[index]) return;
      const distance = (resident: Resident) => Math.abs(resident.tile.c - machine.building.c) + Math.abs(resident.tile.r - machine.building.r);
      let pick = this.state.residents.filter(resident => !resident.post && this.reaches(resident, machine.building))
        .sort((a, b) => distance(a) - distance(b) || a.id - b.id)[0];
      for (let lower = slots.length - 1; !pick && lower > index; lower--) {
        const holder = assigned[lower];
        if (holder && this.tier(slots[lower]) < this.tier(machine) && this.reaches(holder, machine.building)) {
          assigned[lower] = null;
          pick = holder;
        }
      }
      if (pick) {
        pick.post = { c: machine.building.c, r: machine.building.r };
        assigned[index] = pick;
      }
    });
  }

  private productionJob(resident: Resident, machine: MachineState): ResidentJob | null {
    const source = { c: machine.building.c, r: machine.building.r };
    const key = tileKey(source);
    const { kind } = machine.building;
    if (this.state.residents.some(other => other !== resident && (other.job && (other.job.kind === 'farm' ||
      other.job.kind === 'gather' || other.job.kind === 'return-wood') && tileKey(other.job.source) === key ||
      kind === 'food-plot' && other.siteAccess && tileKey(other.tile) === key))) return null;
    if (kind === 'food-plot') {
      if (machine.output['food-unit'] >= outputCapacity(kind)) return null;
      const path = this.workRoute(resident, source);
      if (!path) this.routeBlocked = true;
      return path && { kind: 'farm', source, destination: null, item: null, path };
    }
    if (machine.output.wood + this.returningWood(source) >= outputCapacity(kind)) return null;
    const region = this.residentRegion(resident);
    for (const access of this.accessFor(source)) {
      if (this.region(access.access) !== region || this.treeClaimed(access.tree)) continue;
      const path = this.workRoute(resident, access.tree, access.access);
      if (path && this.route(access.access, source)) {
        return { kind: 'gather', source, destination: null, item: 'wood', tree: { ...access.tree }, access: { ...access.access }, path };
      }
    }
    this.routeBlocked = true;
    return null;
  }

  // Hauling board: priority, unreserved source fullness and kitchen need outweigh
  // distance, so nearby work wins among equals and neglected stock rises as it accumulates.
  private haulJob(resident: Resident, sources: readonly MachineState[]): ResidentJob | null {
    const region = this.residentRegion(resident);
    const distance = (a: Tile, b: Tile) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
    const candidates: { machine: MachineState; target: Tile; item: Item; distance: number; score: number }[] = [];
    for (const machine of sources) {
      const target = machine.building.haulTo;
      const destination = target && this.host.machines.get(tileKey(target));
      if (!target || !destination || this.tier(machine) < 0 || this.host.automated(machine)) continue;
      if (!this.regionsFor(machine.building).includes(region)) continue;
      const reachable = this.regionsFor(target).includes(region);
      const capacity = machine.building.kind === 'storage' ? inputCapacity('storage') : outputCapacity(machine.building.kind);
      for (const item of ITEMS) {
        const available = this.stock(machine)[item] - this.reservedSource(machine.building, item);
        if (!this.compatible(destination, item) || available <= 0 ||
          this.capacity(destination, item) <= this.reservedDestination(target, item)) continue;
        if (!reachable) { this.routeBlocked = true; continue; }
        const fullness = Math.min(1, available / Math.max(1, capacity));
        const need = destination.building.kind === 'kitchen' ? 1 - destination.input['food-unit'] / KITCHEN_CAPACITY : 0;
        const trip = distance(resident.tile, machine.building) + distance(machine.building, target);
        candidates.push({ machine, target, item, distance: trip, score: (this.tier(machine) + FULLNESS_STEPS * fullness + need) * PRIORITY_TILES - trip });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.distance - b.distance ||
      compareTiles(a.machine.building, b.machine.building) || ITEMS.indexOf(a.item) - ITEMS.indexOf(b.item));
    for (const { machine, target, item } of candidates.slice(0, ROUTE_ATTEMPTS)) {
      const source = { c: machine.building.c, r: machine.building.r };
      const path = this.route(resident.tile, source, false, resident.siteAccess);
      const delivery = path && this.route(path[path.length - 1] ?? resident.tile, target);
      if (path && delivery) return { kind: 'collect', source, destination: { ...target }, item, path };
      this.routeBlocked = true;
    }
    return null;
  }

  private haulSources(): MachineState[] {
    return this.assignmentSources ??= [...this.host.machines.values()].filter(machine => machine.building.haulTo)
      .sort((a, b) => compareTiles(a.building, b.building));
  }

  private assign(resident: Resident): void {
    this.rebalance();
    this.routeBlocked = false;
    const post = resident.post ? this.host.machines.get(tileKey(resident.post)) : undefined;
    let job: ResidentJob | null = null;
    if (post) job = this.productionJob(resident, post);
    // Free residents carry goods first so a worker stays beside their site.
    const region = this.residentRegion(resident);
    const relieved = post && this.state.residents.some(other => !other.post && !other.job && this.residentRegion(other) === region);
    if (post && !relieved) job ??= this.haulJob(resident, [post]);
    if (!relieved) job ??= this.haulJob(resident, this.haulSources());
    if (job) {
      const next = residentNextTile(resident);
      resident.job = job;
      resident.exit = null;
      if (tileKey(next) !== tileKey(residentNextTile(resident))) resident.travel = 0;
      resident.note = job.kind === 'farm' ? 'On the way to the plot'
        : job.kind === 'gather' ? 'On the way to the grove' : 'On the way to collect goods';
      return;
    }
    const plot = post?.building.kind === 'food-plot';
    const full = post && (plot ? post.output['food-unit'] : post.output.wood) >= outputCapacity(post.building.kind);
    resident.note = this.routeBlocked ? 'Route blocked. Leave access beside both buildings.'
      : full ? `${plot ? 'Plot' : 'Site'} full · waiting for transport` : 'Available for work';
  }

  /** Recompute worker posts after a priority change. */
  prioritiesChanged(): void {
    this.postsDirty = true;
    this.rebalance();
  }

  step(): void {
    this.state.foodHistory = this.state.foodHistory.filter(event => event.tick > this.host.ticks() - FOOD_READINESS_TICKS);
    this.rebalance();
    for (const machine of this.host.machines.values()) if (machine.building.kind === 'food-plot' ||
      machine.building.kind === 'woodcutting-site') machine.running = false;
    for (let index = 0; index < this.state.residents.length; index++) {
      const resident = this.state.residents[index];
      if (!resident.job) {
        this.assign(resident);
        if (!resident.job && resident.exit) {
          resident.note = 'Leaving the work site';
          this.walk(resident);
        }
        continue;
      }
      const job = resident.job;
      if (this.walk(resident)) {
        resident.note = job.kind === 'return-wood' ? 'Taking wood back to the site' : job.kind === 'gather' ? 'On the way to the grove'
          : job.kind === 'deliver' ? 'Carrying goods' : job.kind === 'farm' ? 'On the way to the plot' : 'On the way to collect goods';
        continue;
      }
      const source = this.host.machines.get(tileKey(job.source))!;
      if (job.kind === 'farm') {
        resident.note = source.output['food-unit'] >= outputCapacity(source.building.kind) ? 'Plot full · waiting for transport' : 'Growing food';
        if (source.output['food-unit'] >= outputCapacity(source.building.kind)) { this.clearJob(resident); this.assign(resident); continue; }
        source.running = true;
        if (++source.progress >= FARM_TICKS) {
          source.progress = 0;
          source.output['food-unit']++;
          this.state.producedFood++;
          this.foodEvent('harvested');
          this.clearJob(resident);
        }
      } else if (job.kind === 'gather') {
        resident.note = 'Gathering wood';
        source.running = true;
        if (++source.progress >= GATHER_TICKS) {
          source.progress = 0;
          const path = this.route(resident.tile, job.source, false, resident.siteAccess);
          if (!path) { this.cancel(resident); resident.note = 'Grove access blocked'; continue; }
          resident.cargo = 'wood';
          this.state.producedWood++;
          job.kind = 'return-wood';
          job.path = path;
          resident.note = 'Taking wood back to the site';
        }
      } else if (job.kind === 'return-wood') {
        source.output.wood++;
        resident.cargo = null;
        this.clearJob(resident);
        resident.note = 'Wood delivered to site';
      } else if (job.kind === 'collect') {
        const path = this.route(resident.tile, job.destination);
        if (!path || this.stock(source)[job.item!] <= 0) {
          this.cancel(resident);
          resident.note = path ? 'Goods no longer available' : 'Delivery route blocked';
          continue;
        }
        this.stock(source)[job.item!]--;
        resident.cargo = job.item;
        job.kind = 'deliver';
        job.path = path;
        resident.note = 'Carrying goods';
      } else {
        const destination = this.host.machines.get(tileKey(job.destination!))!;
        this.host.receive(destination, resident.cargo!);
        resident.cargo = null;
        this.clearJob(resident);
        resident.note = 'Delivery complete';
      }
      if (!resident.job) this.assign(resident);
    }
    this.state.mealClock += this.state.residents.length;
    if (this.state.mealClock < RESIDENT_FOOD_TICKS) return;
    const kitchens = [...this.host.machines.values()].filter(machine => machine.building.kind === 'kitchen')
      .sort((a, b) => compareTiles(a.building, b.building));
    while (this.state.mealClock >= RESIDENT_FOOD_TICKS) {
      this.state.mealClock -= RESIDENT_FOOD_TICKS;
      const kitchen = kitchens.reduce<MachineState | undefined>((best, value) => value.input['food-unit'] > 0 &&
        (!best || value.input['food-unit'] > best.input['food-unit']) ? value : best, undefined);
      if (kitchen) {
        kitchen.input['food-unit']--;
        this.state.consumedFood++;
      } else {
        this.state.missedMeals++;
        this.foodEvent('missed');
      }
    }
  }

  home(): Building | undefined {
    return [...this.host.machines.values()].find(machine => machine.building.kind === 'home')?.building;
  }
}
