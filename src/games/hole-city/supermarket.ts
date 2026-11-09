import type { Item, ItemRoute, Kind } from './engine';
import { advanceTraffic, parkingRoutes, shopperRoutes, trafficBays } from './traffic';

const stock = {
  fruit: { size: .5, points: 1 },
  can: { size: .6, points: 2 },
  milk: { size: .55, points: 2 },
  bread: { size: .65, points: 2 },
  basket: { size: 2.05, points: 7 },
  cart: { size: 2.85, points: 12 },
  shopper: { size: 1.5, points: 4 },
  'promo-bin': { size: 2.85, points: 20 },
  checkout: { size: 4, points: 40 },
  'bakery-case': { size: 4, points: 50 },
  'parked-car': { size: 4, points: 60 },
  'produce-stand': { size: 6.5, points: 25 },
  fridge: { size: 6.5, points: 150 },
  shelf: { size: 9.5, points: 220 },
  'delivery-van': { size: 9.5, points: 340 },
} satisfies Partial<Record<Kind, { size: number; points: number }>>;

export type Grocery = keyof typeof stock;
export function isGrocery(kind: Kind): kind is Grocery { return kind in stock; }

export const supermarketSpawns = [
  { x: 45, z: 47 }, { x: -58, z: 33 }, { x: -8, z: 36 },
  { x: -59, z: -59 }, { x: -10, z: -56 }, { x: 59, z: -70 },
];
export const produceArea = { left: 20, right: 82, back: -10, front: 54 };
export const storefront = 55;
export const parkingRows = [66, 81] as const;
export const parkingSpaces = [-72, -62, -52, -42, -32, -22, -12, -2, 8, 18, 28, 60, 70, 80];
export const produceTiers = [
  { x: -2.2, height: 2.35 }, { x: 0, height: 1.75 }, { x: 2.2, height: 1.15 },
];
export const produceBins = [-1.65, 1.65];
export const shelfDecks = [.55, 1.7, 2.85];
export const fridgeDecks = [1, 2.35, 3.7];
export const bakeryDeck = 1.25;
export const promoDeck = .9;

export const groceryGrowth = [
  { name: 'Loose change', menu: 'BASKETS' },
  { name: 'Hand basket', menu: 'CARTS & PROMO BINS' },
  { name: 'Cart full', menu: 'COUNTERS & CARS' },
  { name: 'Express lane', menu: 'FRIDGES & DISPLAYS' },
  { name: 'Cold case raider', menu: 'SHELVES & VANS' },
  { name: 'Aisle sweep', menu: null },
  { name: 'Bottomless', menu: null },
] as const;

export function supermarket(seed = 718): Item[] {
  const items: Item[] = [];
  const jitter = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296 - .5;
  };
  const add = (x: number, z: number, kind: Grocery, options?: Pick<Item, 'elevation' | 'stockedOn' | 'variant' | 'stack'>) => {
    const item: Item = { x, z, kind, ...stock[kind], eaten: false, ...options };
    items.push(item);
    return item;
  };
  const addTraffic = (kind: 'shopper' | 'parked-car', routes: ItemRoute[]) => {
    for (const [variant, route] of routes.entries()) {
      const item = add(0, 0, kind, { variant: variant % 4 });
      if (kind === 'shopper') {
        item.pushedCart = add(0, 0, 'cart', { variant: item.variant });
        item.pushedCart.beingPushed = true;
      }
      item.route = route;
      advanceTraffic(item, 0);
    }
  };

  // Stepped produce islands flank the entrance and continue along the fresh-food side.
  let display = 0;
  for (const x of [29, 45, 61]) for (const z of [-2, 13, 28, 43]) {
    const stand = add(x, z, 'produce-stand');
    for (const [tier, deck] of produceTiers.entries()) for (const [bin, center] of produceBins.entries()) {
      const variant = (display + tier + bin) % 3;
      const placement = { elevation: deck.height, variant, stockedOn: stand };
      const rows = [-.85, 0, .85].map(dz => [-.47, .47].map(dx =>
        add(x + deck.x + dx + jitter() * .16, z + center + dz + jitter() * .16, 'fruit', placement)));
      for (const dz of [-.43, .43]) {
        const supports = [...rows[1], ...rows[dz < 0 ? 0 : 2]];
        add(x + deck.x + jitter() * .16, z + center + dz, 'fruit', { ...placement, stack: { rise: .58, supports } });
      }
    }
    display++;
    if (z === 43 || (x === 45 && z === 13)) {
      add(x + 5.2, z + 2 + jitter(), 'basket');
      add(x + 6.8, z + 2 + jitter(), 'basket');
    }
    if ((x === 61 && z === 43) || z === 28 || z === -2) {
      add(x - 5.2, z - 2 + jitter(), 'cart');
    }
  }

  // Parallel, double-sided grocery aisles open onto cross aisles and the checkout queue.
  for (const [aisle, x] of [-72, -53, -34, -15, 4].entries()) {
    for (const z of [-63, -46, -24, -7, 14, 31]) {
      const shelf = add(x, z, 'shelf');
      for (const [tier, elevation] of shelfDecks.entries()) for (const side of [-1, 1]) {
        for (const dz of [-5.3, -4.4, -.8, .1, 3.8, 4.7]) {
          add(x + side * 1.6, z + dz + jitter() * .12, 'can', { elevation, variant: (aisle + tier) % 4, stockedOn: shelf });
        }
      }
    }
    for (const z of [-70, -32, 4, 39]) add(x + 4, z, 'basket');
    for (const z of [-67, -33, 6, 41]) add(x - 5, z, 'cart');
  }
  for (const x of [28, 44, 61, 76]) for (const z of [-55, -26]) {
    const bakery = add(x, z, 'bakery-case');
    for (const dx of [-2.55, -1.7, -.85, 0, .85, 1.7, 2.55]) for (const dz of [-.75, .7]) {
      add(x + dx, z + dz + jitter() * .14, 'bread', { elevation: bakeryDeck, stockedOn: bakery });
    }
  }
  for (const z of [-46, -18, 9, 28]) {
    const display = add(13, z, 'promo-bin');
    for (const dx of [-.85, 0, .85]) for (const dz of [-.8, .15, 1.1]) {
      add(13 + dx, z + dz, 'can', { elevation: promoDeck, stockedOn: display, variant: 2 });
    }
  }
  addTraffic('shopper', shopperRoutes());
  for (const x of [-73, -61, -49, -37, -25, -13, -1]) {
    for (const z of [41, 50]) add(x, z, 'checkout');
    add(x + 3.5, 43, 'basket');
    add(x + 3.5, 53, 'cart');
  }
  for (let x = -77; x <= 77; x += 11) {
    const fridge = add(x, -81, 'fridge');
    for (const [tier, elevation] of fridgeDecks.entries()) for (const dx of [-2.5, -1.5, -.5, .5, 1.5, 2.5]) {
      add(x + dx + jitter() * .13, -79.5, 'milk', { elevation, variant: (Math.round(x / 11) + tier + 8) % 4, stockedOn: fridge });
    }
  }
  for (const [row, z] of parkingRows.entries()) for (const [space, x] of parkingSpaces.entries()) {
    if (trafficBays.some(bays => bays[row] === x) || (row === 0 && x === 80)) continue;
    if ((space + row * 2) % 5 === 1) continue;
    const kind = row === 1 && [-72, -22, 18, 70].includes(x) ? 'delivery-van' : 'parked-car';
    const vehicle = add(x + jitter() * 1.1, z + jitter() * 1.1, kind, { variant: (space + row * 3) % 4 });
    vehicle.heading = row === 0 ? Math.PI : 0;
  }
  addTraffic('parked-car', parkingRoutes(parkingRows));
  for (const x of [34, 39]) for (const z of [59, 63, 67]) add(x, z, 'cart');
  for (const [x, z] of [[-73, 46], [-43, 45], [-20, 48], [-30, 58], [-15, 73], [52, 60], [52, 73], [52, 82], [23, -38], [61, -74]]) {
    items.push({ x, z, kind: 'person', size: .45, points: 3, eaten: false });
  }
  return items;
}
