import { BuildableKind, CATALOG, HOUSE_WOOD_COST, Inventory, Item, ITEMS } from './domain';

/** Buildings available in every new settlement. */
export const STARTING_KINDS: readonly BuildableKind[] = ['food-plot', 'kitchen', 'woodcutting-site', 'house', 'storage'];

export interface DiscoveryProgress {
  /** Houses with all their wood installed right now. */
  completedHouses: number;
  /** Ore produced by any means, counted once. */
  mined: number;
  /** Plates smelted, counted once. */
  smelted: number;
}

export interface Discovery {
  kinds: readonly BuildableKind[];
  /** Short instruction shown on the next locked catalog card. */
  condition: string;
  required: number;
  current: (progress: DiscoveryProgress) => number;
}

export const ORE_FOR_SMELTER = 10;
export const PLATES_FOR_EXTRACTOR = 20;

/**
 * Ordered settlement discoveries. Each is earned from actual work, is permanent,
 * and never takes away an earlier capability. The assembler has no settlement
 * use yet, so it stays undiscovered unless an older save already built one.
 */
export const DISCOVERIES: readonly Discovery[] = [
  { kinds: ['mining-site'], condition: 'Finish a house', required: 1, current: progress => progress.completedHouses },
  { kinds: ['furnace'], condition: 'Dig ore by hand', required: ORE_FOR_SMELTER, current: progress => progress.mined },
  { kinds: ['belt', 'splitter'], condition: 'Smelt a plate', required: 1, current: progress => progress.smelted },
  { kinds: ['miner'], condition: 'Smelt plates', required: PLATES_FOR_EXTRACTOR, current: progress => progress.smelted },
];

export function discoveryProgress(houses: readonly Readonly<Inventory>[], mined: Readonly<Inventory>, smelted: Readonly<Inventory>): DiscoveryProgress {
  return {
    completedHouses: houses.filter(house => house.wood >= HOUSE_WOOD_COST).length,
    mined: ITEMS.reduce((sum, item) => sum + mined[item], 0),
    smelted: ITEMS.reduce((sum, item) => sum + smelted[item], 0),
  };
}

/** Kinds newly earned by this progress, in catalog order. */
export function newlyDiscovered(discovered: ReadonlySet<BuildableKind>, progress: DiscoveryProgress): BuildableKind[] {
  return DISCOVERIES.filter(discovery => discovery.current(progress) >= discovery.required)
    .flatMap(discovery => discovery.kinds).filter(kind => !discovered.has(kind));
}

/** The first discovery still to earn, with its progress. */
export function nextDiscovery(discovered: ReadonlySet<BuildableKind>, progress: DiscoveryProgress):
  { discovery: Discovery; current: number } | null {
  const discovery = DISCOVERIES.find(value => value.kinds.some(kind => !discovered.has(kind)));
  return discovery ? { discovery, current: Math.min(discovery.required, discovery.current(progress)) } : null;
}

export function sortKinds(kinds: Iterable<BuildableKind>): BuildableKind[] {
  const set = new Set(kinds);
  return CATALOG.map(entry => entry.kind).filter(kind => set.has(kind));
}

/** Items that the settlement can meet with its discovered buildings. */
export function discoveredItems(discovered: ReadonlySet<BuildableKind>): Set<Item> {
  const items = new Set<Item>(['food-unit', 'wood']);
  if (discovered.has('mining-site') || discovered.has('miner')) {
    items.add('iron-ore');
    items.add('copper-ore');
  }
  if (discovered.has('furnace')) {
    items.add('iron-plate');
    items.add('copper-plate');
  }
  if (discovered.has('assembler')) items.add('defense-supply');
  return items;
}
