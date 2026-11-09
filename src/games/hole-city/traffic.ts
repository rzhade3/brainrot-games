import type { Hole, Item, ItemRoute } from './engine';

type Stop = readonly [x: number, z: number, wait?: number, reverse?: boolean];

function circuit(stops: readonly Stop[], speed: number, phase: number): ItemRoute {
  const segments: ItemRoute['segments'] = [];
  const bearings = stops.map(([x, z, , reverse], index) => {
    const [nextX, nextZ] = stops[(index + 1) % stops.length];
    return Math.atan2(nextX - x, nextZ - z) + (reverse ? Math.PI : 0);
  });
  for (const [index, [x, z, wait]] of stops.entries()) {
    const [nextX, nextZ] = stops[(index + 1) % stops.length];
    const dx = nextX - x, dz = nextZ - z;
    if (wait) segments.push({ x, z, dx: 0, dz: 0, duration: wait, heading: bearings[(index + stops.length - 1) % stops.length] });
    segments.push({ x, z, dx, dz, duration: Math.hypot(dx, dz) / speed, heading: bearings[index] });
  }
  const duration = segments.reduce((total, segment) => total + segment.duration, 0);
  return { time: phase * duration, duration, segments };
}

function wrapTime(route: ItemRoute, time: number) {
  const wrapped = time % route.duration;
  return wrapped < 0 ? wrapped + route.duration : wrapped;
}

function routePose(route: ItemRoute, time: number) {
  let elapsed = wrapTime(route, time);
  for (const [index, segment] of route.segments.entries()) {
    if (elapsed >= segment.duration && index < route.segments.length - 1) {
      elapsed -= segment.duration;
      continue;
    }
    const progress = elapsed / segment.duration;
    const x = segment.x + segment.dx * progress;
    const z = segment.z + segment.dz * progress;
    const previous = route.segments[(index + route.segments.length - 1) % route.segments.length].heading;
    const turn = Math.atan2(Math.sin(segment.heading - previous), Math.cos(segment.heading - previous));
    const heading = previous + turn * Math.min(1, elapsed / Math.min(.4, segment.duration));
    return { x, z, heading, bearing: segment.heading };
  }
  throw new Error('Traffic route has no segments');
}

function shopperPace(item: Item, route: ItemRoute, dt: number, holes: readonly Hole[]) {
  const shopper = route.shopper!;
  let danger: Hole | undefined, clearance = 3.5;
  for (const hole of holes) {
    if (hole.respawn > 0 || hole.radius <= (item.pushedCart?.size ?? item.size)) continue;
    const gap = Math.hypot(item.x - hole.x, item.z - hole.z) - hole.radius;
    if (gap < clearance) { danger = hole; clearance = gap; }
  }
  if (danger) {
    releaseCart(item);
    const forward = routePose(route, route.time + .9);
    const backward = routePose(route, route.time - .9);
    const forwardGap = Math.hypot(forward.x - danger.x, forward.z - danger.z);
    const backwardGap = Math.hypot(backward.x - danger.x, backward.z - danger.z);
    // Favor the route that creates space. Keep the current choice on near ties at corners.
    if (Math.abs(forwardGap - backwardGap) > (shopper.alert ? 1.8 : .15)) {
      shopper.direction = forwardGap > backwardGap ? 1 : -1;
    }
    shopper.alert = .8;
  } else {
    shopper.alert = Math.max(0, shopper.alert - dt);
  }
  return shopper.direction * (shopper.alert > 0 ? 1.65 : 1);
}

export function releaseCart(item: Item) {
  if (!item.pushedCart) return;
  item.pushedCart.beingPushed = false;
  item.pushedCart = undefined;
}

export function advanceTraffic(item: Item, dt: number, holes: readonly Hole[] = []): boolean {
  const route = item.route;
  if (!route || item.eaten || item.falling) return false;
  const shopper = route.shopper;
  const pushedCart = item.pushedCart;
  const pace = shopper ? shopperPace(item, route, dt, holes) : 1;
  route.time = wrapTime(route, route.time + dt * pace);
  const { x, z, heading: routeHeading, bearing } = routePose(route, route.time);
  let heading = routeHeading;
  if (shopper) {
    const target = bearing + (shopper.direction === -1 ? Math.PI : 0);
    const current = item.heading ?? target;
    const turn = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    heading = current + turn * Math.min(1, dt * (shopper.alert ? 15 : 9));
    if (dt > 0) shopper.phase += Math.hypot(x - item.x, z - item.z) * 3.5;
    shopper.stride = Math.sin(shopper.phase) * (shopper.alert ? .55 : .29);
  }
  const moved = item.x !== x || item.z !== z || item.heading !== heading || pushedCart !== item.pushedCart;
  item.x = x; item.z = z; item.heading = heading;
  if (item.pushedCart) {
    const cart = item.pushedCart;
    cart.x = x + Math.sin(heading) * 2.12;
    cart.z = z + Math.cos(heading) * 2.12;
    cart.heading = heading + Math.PI;
  }
  return moved;
}

export function shopperRoutes(): ItemRoute[] {
  const routes = [
    circuit([[-63, -33], [-63, 4], [-43, 4], [-43, -33]], 4.7, .24),
    circuit([[-42, -70], [-42, -35], [-24, -35], [-24, -70]], 4.5, .57),
    circuit([[-24, 5], [-24, 22], [-6, 22], [-6, 5]], 4.4, .44),
    circuit([[10, -69], [10, -35], [19, -35], [19, -69]], 4.8, .18),
    circuit([[20, -11], [20, 37], [37, 37], [37, 8], [20, 8]], 4.6, .19),
    circuit([[53, -58], [53, -39], [72, -39], [72, -58]], 4.5, .65),
  ];
  for (const route of routes) route.shopper = { direction: 1, alert: 0, phase: 0, stride: 0 };
  return routes;
}

// Each car serves its own pair of bays so parked cars and circulating cars never share a space.
export const trafficBays = [[-72, -52], [-32, -12], [8, 28], [60, 80]] as const;

export function parkingRoutes([front, back]: readonly [number, number]): ItemRoute[] {
  return trafficBays.map(([near, far], index) => {
    const lane = (front + back) / 2;
    const waypoints: Stop[] = [
      [near, front, 3 + index, true], [near, lane - 2, 0, true], [near + 4, lane],
      [far - 4, lane], [far, lane + 2], [far, back, 5 - index, true],
      [far, lane + 2, 0, true], [far - 4, lane], [near + 4, lane], [near, lane - 2],
    ];
    if (index === trafficBays.length - 1) {
      // The east driveway extends past the bays into the outer access lane.
      waypoints.splice(7, 1, [86, lane + 1], [86, front - 5], [83, front - 4], [83, lane], [far - 4, lane]);
    }
    return circuit(waypoints, 7.2, .12 + index * .19);
  });
}

export function addCityTraffic(items: Item[]) {
  const putOnRoute = (kind: 'car' | 'person', route: ItemRoute) => {
    const { x, z } = route.segments[0];
    let closest: Item | undefined, distance = Infinity;
    for (const item of items) {
      if (item.kind !== kind || item.route) continue;
      const candidate = Math.hypot(item.x - x, item.z - z);
      if (candidate < distance) { closest = item; distance = candidate; }
    }
    if (closest) {
      closest.route = route;
      advanceTraffic(closest, 0);
    }
  };
  for (const [index, x] of [-75, -45, -15, 15, 45, 75].entries()) {
    putOnRoute('car', circuit([[x - .9, -78], [x - .9, 77], [x + .9, 79], [x + .9, -76]], 7.7 + index * .35, .08 + index * .14));
  }
  for (const [index, x] of [-60, -30, 0, 30, 60].entries()) for (const z of [-60, 0, 60]) {
    putOnRoute('person', circuit([[x - 12, z - 12], [x + 12, z - 12], [x + 12, z + 12, 1], [x - 12, z + 12]], 3 + index * .2, .12 + index * .13 + (z + 60) / 300));
  }
}
