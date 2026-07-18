/**
 * Tile-grid model for Castle Defense. The grid holds only *terrain* (empty,
 * ore, castle). Building occupancy lives in the BuildingManager so terrain and
 * placed structures stay decoupled. Coordinates are in tile units; the scene
 * owns the pixel `GridLayout` used to convert to/from world space.
 */

export type TileType = 'empty' | 'ore' | 'castle';

export interface TileCoord {
  c: number;
  r: number;
}

/** Pixel placement of the grid on screen, computed by the scene each layout. */
export interface GridLayout {
  originX: number;
  originY: number;
  tile: number;
}

export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly castle: TileCoord;
  private tiles: TileType[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Array(cols * rows).fill('empty');
    this.castle = { c: Math.floor(cols / 2), r: Math.floor(rows / 2) };
    this.tiles[this.idx(this.castle.c, this.castle.r)] = 'castle';
  }

  idx(c: number, r: number): number {
    return r * this.cols + c;
  }

  inBounds(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  typeAt(c: number, r: number): TileType {
    if (!this.inBounds(c, r)) return 'empty';
    return this.tiles[this.idx(c, r)];
  }

  private setType(c: number, r: number, t: TileType): void {
    if (this.inBounds(c, r)) this.tiles[this.idx(c, r)] = t;
  }

  forEach(cb: (c: number, r: number, t: TileType) => void): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        cb(c, r, this.tiles[this.idx(c, r)]);
      }
    }
  }

  /** Chebyshev distance in tiles from a coord to the castle. */
  distToCastle(c: number, r: number): number {
    return Math.max(Math.abs(c - this.castle.c), Math.abs(r - this.castle.r));
  }

  /**
   * Generate a fresh map: castle at center surrounded by a clear buildable
   * ring, with several ore clusters scattered toward the outer regions so the
   * player must expand outward to mine.
   */
  static generate(cols: number, rows: number): Grid {
    const grid = new Grid(cols, rows);
    const clusters = 3 + Math.floor(Math.random() * 2); // 3–4 patches
    let placed = 0;
    let guard = 0;

    while (placed < clusters && guard++ < 200) {
      const cc = 1 + Math.floor(Math.random() * (cols - 2));
      const cr = 1 + Math.floor(Math.random() * (rows - 2));
      // Keep patches away from the castle's clear building ring.
      if (grid.distToCastle(cc, cr) < 3) continue;

      const size = 3 + Math.floor(Math.random() * 4); // 3–6 tiles per patch
      let grown = 0;
      let gi = 0;
      let hx = cc;
      let hy = cr;
      while (grown < size && gi++ < 40) {
        if (grid.inBounds(hx, hy) && grid.typeAt(hx, hy) === 'empty' && grid.distToCastle(hx, hy) >= 2) {
          grid.setType(hx, hy, 'ore');
          grown++;
        }
        hx += Math.floor(Math.random() * 3) - 1;
        hy += Math.floor(Math.random() * 3) - 1;
      }
      if (grown > 0) placed++;
    }

    return grid;
  }
}

/** Center of tile (c,r) in world pixels for the given layout. */
export function tileCenter(layout: GridLayout, c: number, r: number): { x: number; y: number } {
  return {
    x: layout.originX + c * layout.tile + layout.tile / 2,
    y: layout.originY + r * layout.tile + layout.tile / 2,
  };
}

/** Convert a world pixel position to the tile that contains it. */
export function worldToTile(layout: GridLayout, x: number, y: number): TileCoord {
  return {
    c: Math.floor((x - layout.originX) / layout.tile),
    r: Math.floor((y - layout.originY) / layout.tile),
  };
}
