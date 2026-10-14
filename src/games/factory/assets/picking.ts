import { Building, BuildingKind, Point, project } from '../game/domain';

function contains(points: readonly Point[], point: Point): boolean {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 0.0001) continue;
    const nextSign = Math.sign(cross);
    if (sign && sign !== nextSign) return false;
    sign = nextSign;
  }
  return true;
}

export interface AssetShape {
  bounds: { left: number; top: number; right: number; bottom: number };
  selection: readonly (readonly Point[])[];
}

function shape(width: number, height: number, extra: readonly (readonly Point[])[] = []): AssetShape {
  const halfHeight = width / 2;
  const selection = [[
    { x: -width, y: -height }, { x: 0, y: -halfHeight - height },
    { x: width, y: -height }, { x: width, y: 0 }, { x: 0, y: halfHeight }, { x: -width, y: 0 },
  ], ...extra];
  return {
    bounds: {
      left: Math.min(...selection.flat().map(point => point.x)),
      top: Math.min(...selection.flat().map(point => point.y)),
      right: Math.max(...selection.flat().map(point => point.x)),
      bottom: Math.max(...selection.flat().map(point => point.y)),
    },
    selection,
  };
}

export const BUILDING_SHAPES: Record<BuildingKind, AssetShape> = {
  belt: shape(35, 5), splitter: shape(35, 5), miner: shape(28, 44),
  furnace: shape(28, 44, [[{ x: -2, y: -67 }, { x: 12, y: -67 }, { x: 12, y: -38 }, { x: -2, y: -38 }]]),
  storage: shape(28, 42), assembler: shape(28, 44),
  home: shape(28, 44), house: shape(31, 53), 'food-plot': shape(32, 8), kitchen: shape(28, 44),
  'woodcutting-site': shape(32, 34),
  'mining-site': shape(32, 32),
};

export function containsBuilding(kind: BuildingKind, point: Point): boolean {
  return BUILDING_SHAPES[kind].selection.some(outline => contains(outline, point));
}

export function pickBuilding(point: Point, buildings: ReadonlyMap<string, Building>): Building | null {
  const sorted = [...buildings.values()].sort((a, b) => (b.c + b.r) - (a.c + a.r) || b.c - a.c);
  for (const building of sorted) {
    const { x, y } = project(building.c, building.r);
    if (containsBuilding(building.kind, { x: point.x - x, y: point.y - y })) return building;
  }
  return null;
}
