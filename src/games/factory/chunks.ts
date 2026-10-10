import { HALF_HEIGHT, HALF_WIDTH, Point, project, Tile, unproject } from './model';
import { CHUNK_SIZE, WORLD_SIZE } from './world';

export const MAX_RESIDENT_CHUNKS = 24;
export const VIEW_PADDING = 112;
export interface WorldView { x: number; y: number; width: number; height: number }
export interface Chunk extends Tile { key: string; center: Point }

export function visibleChunks(view: WorldView): Chunk[] {
  const left = view.x - VIEW_PADDING;
  const top = view.y - VIEW_PADDING;
  const right = view.x + view.width + VIEW_PADDING;
  const bottom = view.y + view.height + VIEW_PADDING;
  const result: Chunk[] = [];
  for (let r = 0; r < WORLD_SIZE / CHUNK_SIZE; r++) {
    for (let c = 0; c < WORLD_SIZE / CHUNK_SIZE; c++) {
      const center = project(c * CHUNK_SIZE + (CHUNK_SIZE - 1) / 2, r * CHUNK_SIZE + (CHUNK_SIZE - 1) / 2);
      const dx = Math.max(left - center.x, 0, center.x - right);
      const dy = Math.max(top - center.y, 0, center.y - bottom);
      if (dx / (CHUNK_SIZE * HALF_WIDTH) + dy / (CHUNK_SIZE * HALF_HEIGHT) <= 1) {
        result.push({ c, r, key: `${c},${r}`, center });
      }
    }
  }
  return result.sort((a, b) => Math.hypot(a.center.x - view.x - view.width / 2, a.center.y - view.y - view.height / 2) -
    Math.hypot(b.center.x - view.x - view.width / 2, b.center.y - view.y - view.height / 2));
}

export function visibleTileBounds(view: WorldView): { minC: number; maxC: number; minR: number; maxR: number } {
  const corners = [
    unproject(view.x - VIEW_PADDING, view.y - VIEW_PADDING),
    unproject(view.x + view.width + VIEW_PADDING, view.y - VIEW_PADDING),
    unproject(view.x - VIEW_PADDING, view.y + view.height + VIEW_PADDING),
    unproject(view.x + view.width + VIEW_PADDING, view.y + view.height + VIEW_PADDING),
  ];
  return {
    minC: Math.max(0, Math.min(...corners.map(tile => tile.c)) - 1),
    maxC: Math.min(WORLD_SIZE - 1, Math.max(...corners.map(tile => tile.c)) + 1),
    minR: Math.max(0, Math.min(...corners.map(tile => tile.r)) - 1),
    maxR: Math.min(WORLD_SIZE - 1, Math.max(...corners.map(tile => tile.r)) + 1),
  };
}

export function inView(point: Point, view: WorldView): boolean {
  return point.x >= view.x - VIEW_PADDING && point.x <= view.x + view.width + VIEW_PADDING &&
    point.y >= view.y - VIEW_PADDING && point.y <= view.y + view.height + VIEW_PADDING;
}

export function tileDepth(tile: Tile): number {
  return 10 + (tile.c + tile.r) * WORLD_SIZE + tile.c;
}
