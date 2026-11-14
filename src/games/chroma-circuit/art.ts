export const SIZE = 26;

export const palette = {
  ink: { name: 'Plum', fill: '#634477', mark: '✦' },
  rust: { name: 'Scarlet', fill: '#e55660', mark: '◆' },
  gold: { name: 'Marigold', fill: '#ffc460', mark: '●' },
  cream: { name: 'Vanilla', fill: '#fff0cf', mark: '+' },
  pink: { name: 'Peony', fill: '#f695be', mark: '♥' },
  leaf: { name: 'Mint', fill: '#60dbab', mark: '■' },
  blue: { name: 'Sky', fill: '#6cc8ef', mark: '▲' },
  lilac: { name: 'Lilac', fill: '#b5a3f4', mark: '✕' },
} as const;

export type Color = keyof typeof palette;
export type Mosaic = (Color | null)[];

class PixelArt {
  readonly tiles: Mosaic = Array(SIZE * SIZE).fill(null);

  rect(color: Color, x: number, y: number, w = 1, h = 1): void {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) this.tiles[row * SIZE + col] = color;
    }
  }

  oval(color: Color, x: number, y: number, w: number, h: number): void {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        if (((col + 0.5) / w - 0.5) ** 2 + ((row + 0.5) / h - 0.5) ** 2 <= 0.25) {
          this.rect(color, x + col, y + row);
        }
      }
    }
  }

  polygon(color: Color, ...points: [number, number][]): void {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [ax, ay] = points[i];
          const [bx, by] = points[j];
          if ((ay > y + 0.5) !== (by > y + 0.5) && x + 0.5 < (bx - ax) * (y + 0.5 - ay) / (by - ay) + ax) {
            inside = !inside;
          }
        }
        if (inside) this.rect(color, x, y);
      }
    }
  }

  sparkle(color: Color, x: number, y: number): void {
    this.rect(color, x - 1, y, 3);
    this.rect(color, x, y - 1, 1, 3);
  }
}

function panda(p: PixelArt): void {
  p.sparkle('gold', 3, 7); p.sparkle('gold', 22, 5); p.sparkle('pink', 22, 16);
  p.rect('gold', 4, 19); p.rect('pink', 23, 10); p.rect('gold', 2, 14);
  p.oval('ink', 6, 16, 14, 8); p.oval('rust', 8, 17, 10, 6);
  p.oval('ink', 6, 20, 5, 4); p.oval('ink', 15, 20, 5, 4);
  for (const x of [4, 16]) {
    p.oval('ink', x, 3, 6, 8); p.oval('cream', x + 1, 4, 4, 5); p.oval('rust', x + 2, 5, 2, 4);
  }
  p.oval('ink', 4, 7, 18, 13); p.oval('rust', 5, 7, 16, 12);
  p.oval('gold', 7, 8, 12, 8); p.oval('rust', 6, 11, 14, 7);
  p.oval('cream', 5, 12, 7, 5); p.oval('cream', 14, 12, 7, 5);
  p.oval('cream', 9, 15, 8, 4);
  p.rect('ink', 8, 12, 2, 2); p.rect('ink', 16, 12, 2, 2);
  p.rect('pink', 6, 14, 2); p.rect('pink', 18, 14, 2);
  p.rect('ink', 12, 15, 2); p.rect('ink', 12, 17, 2);
  p.oval('ink', 14, 19, 10, 5); p.oval('rust', 15, 19, 8, 4);
  p.rect('gold', 17, 20, 2, 3); p.rect('gold', 21, 20, 1, 2);
}

function cottage(p: PixelArt): void {
  p.sparkle('gold', 4, 5); p.sparkle('lilac', 21, 4); p.rect('pink', 23, 9);
  p.oval('leaf', 2, 20, 22, 4); p.oval('ink', 7, 11, 13, 12); p.oval('cream', 8, 12, 11, 10);
  p.oval('ink', 3, 4, 21, 12); p.oval('rust', 4, 4, 19, 10);
  p.oval('pink', 6, 5, 13, 7); p.oval('cream', 8, 6, 4, 3); p.oval('cream', 14, 8, 5, 4);
  p.rect('cream', 5, 10, 2, 2); p.rect('cream', 19, 10, 2);
  p.oval('ink', 10, 16, 6, 7); p.oval('gold', 11, 17, 4, 6); p.rect('rust', 13, 20);
  p.rect('ink', 16, 15, 3, 3); p.rect('blue', 17, 16);
  p.rect('leaf', 3, 18, 1, 3); p.sparkle('pink', 3, 17);
  p.rect('leaf', 22, 17, 1, 4); p.sparkle('gold', 22, 16);
  p.rect('lilac', 10, 24, 6); p.rect('lilac', 12, 23, 2);
}

function pond(p: PixelArt): void {
  p.oval('ink', 1, 3, 24, 21); p.oval('lilac', 2, 3, 22, 20); p.oval('blue', 3, 5, 20, 16);
  p.oval('leaf', 4, 6, 8, 5); p.rect('blue', 8, 6, 1, 2);
  p.sparkle('pink', 7, 8); p.rect('cream', 7, 8);
  p.oval('leaf', 16, 15, 6, 4); p.rect('blue', 19, 15, 1, 2);
  p.polygon('rust', [4, 15], [9, 13], [10, 15], [8, 19], [7, 17], [4, 18]);
  p.polygon('ink', [7, 14], [12, 11], [17, 8], [20, 9], [21, 12], [17, 15], [11, 17], [8, 17]);
  p.polygon('cream', [8, 14], [12, 12], [17, 9], [19, 9], [20, 12], [17, 14], [11, 16], [8, 16]);
  p.oval('rust', 13, 10, 5, 4); p.rect('gold', 15, 11, 2, 2);
  p.rect('ink', 18, 11); p.rect('rust', 10, 14, 2);
  p.rect('cream', 12, 6, 3); p.rect('cream', 11, 19, 3); p.rect('cream', 4, 12, 2);
}

function observatory(p: PixelArt): void {
  p.oval('lilac', 3, 2, 20, 22); p.oval('ink', 4, 3, 18, 19);
  p.sparkle('gold', 9, 7); p.sparkle('blue', 17, 12); p.rect('cream', 12, 4);
  p.oval('gold', 14, 5, 6, 6); p.oval('ink', 16, 4, 5, 5);
  p.polygon('lilac', [3, 20], [8, 14], [12, 17], [17, 14], [23, 20], [20, 23], [6, 23]);
  p.polygon('blue', [3, 21], [8, 17], [13, 20], [18, 17], [23, 21], [18, 24], [8, 24]);
  p.oval('ink', 8, 14, 10, 10); p.oval('cream', 9, 15, 8, 8);
  p.rect('ink', 9, 19, 8); p.rect('rust', 10, 20, 6, 3); p.rect('pink', 11, 20, 3);
  p.rect('ink', 12, 20, 2, 3);
  p.polygon('ink', [11, 17], [9, 15], [14, 10], [17, 12], [16, 14], [13, 17]);
  p.polygon('cream', [11, 15], [14, 11], [16, 12], [13, 15]);
  p.sparkle('pink', 3, 10); p.sparkle('gold', 23, 14);
}

function sundae(p: PixelArt): void {
  p.sparkle('blue', 5, 8); p.sparkle('gold', 22, 6); p.sparkle('pink', 4, 16);
  p.oval('ink', 5, 22, 16, 3); p.oval('lilac', 6, 22, 14, 2);
  p.polygon('ink', [5, 13], [21, 13], [17, 20], [15, 21], [17, 23], [9, 23], [11, 21], [9, 20]);
  p.polygon('blue', [6, 14], [20, 14], [16, 19], [14, 20], [15, 22], [11, 22], [12, 20], [10, 19]);
  p.polygon('cream', [8, 15], [10, 15], [12, 18], [11, 18]);
  p.oval('ink', 5, 9, 10, 8); p.oval('leaf', 6, 9, 8, 7);
  p.oval('ink', 12, 9, 10, 8); p.oval('pink', 13, 9, 8, 7);
  p.oval('ink', 9, 5, 9, 9); p.oval('cream', 10, 5, 7, 8);
  p.oval('rust', 11, 3, 5, 4); p.rect('gold', 12, 3); p.rect('ink', 14, 1, 1, 2);
  p.rect('cream', 7, 12, 2); p.rect('cream', 17, 11, 2);
  p.rect('rust', 16, 13); p.rect('lilac', 19, 14);
}

function terrarium(p: PixelArt): void {
  p.sparkle('pink', 4, 5); p.sparkle('gold', 21, 7); p.rect('blue', 2, 12);
  p.oval('ink', 3, 5, 20, 19); p.oval('blue', 4, 6, 18, 17); p.oval('lilac', 6, 7, 14, 15);
  p.rect('ink', 8, 4, 10, 3); p.rect('gold', 9, 4, 8, 2); p.rect('cream', 10, 3, 6);
  p.oval('ink', 5, 16, 16, 7); p.oval('leaf', 6, 16, 14, 6);
  p.rect('leaf', 9, 10, 1, 8); p.rect('leaf', 16, 12, 1, 7);
  p.oval('pink', 6, 9, 7, 5); p.oval('rust', 13, 11, 7, 5);
  p.rect('gold', 9, 10, 1, 2); p.rect('cream', 16, 12, 1, 2);
  p.polygon('ink', [8, 18], [12, 17], [14, 18], [16, 17], [18, 19], [17, 21], [9, 21]);
  p.oval('gold', 9, 17, 5, 4); p.oval('cream', 13, 18, 5, 3); p.rect('ink', 16, 18);
  p.rect('cream', 5, 11, 1, 4); p.rect('cream', 6, 9, 1, 2); p.rect('cream', 20, 13, 1, 3);
  p.rect('ink', 8, 23, 10); p.rect('pink', 23, 18); p.sparkle('blue', 3, 21);
}

export const artwork = [
  { name: 'Red Panda', draw: panda },
  { name: 'Mushroom Cottage', draw: cottage },
  { name: 'Koi Pond', draw: pond },
  { name: 'Moon Observatory', draw: observatory },
  { name: 'Cherry Sundae', draw: sundae },
  { name: 'Snail Terrarium', draw: terrarium },
].map(({ name, draw }) => {
  const art = new PixelArt();
  draw(art);
  return { name, tiles: art.tiles };
});
