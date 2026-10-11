import { HALF_HEIGHT, HALF_WIDTH, project, Tile } from './model';
import { BIOMES, FactoryWorld, hashSeed, noise, randomAt, WorldTile } from './world';

const GROUND = [0xa2b789, 0x819d82, 0xb6b5a0];
const MOTIFS = [null, 'grass', 'flowers', 'reeds', 'stone', 'scrub', 'lichen'] as const;
const CORNERS = [
  { x: HALF_WIDTH, y: 0 }, { x: 0, y: HALF_HEIGHT },
  { x: -HALF_WIDTH, y: 0 }, { x: 0, y: -HALF_HEIGHT },
];
const FLOWERS = [
  { x: -10, y: -3 }, { x: -4, y: 1 }, { x: 4, y: -4 }, { x: 10, y: 1 },
  { x: -1, y: -6 }, { x: 2, y: 5 }, { x: 9, y: -4 }, { x: -8, y: 4 },
];
const FLOWER_COLORS = [
  ['#ecebd4', '#d4bd78'], ['#e5cf90', '#f0ead1'],
  ['#c6bfd1', '#e6e7d0'], ['#d4b2a4', '#eee5cd'],
];
type Motif = typeof MOTIFS[number];
export interface LandscapeTile {
  color: number;
  motif: Motif;
  shore: number;
  variant: number;
}

// Direction order matches the logical grid: east, south, west, north.
const NEIGHBORS = [{ c: 1, r: 0 }, { c: 0, r: 1 }, { c: -1, r: 0 }, { c: 0, r: -1 }];
const BLEND = Array.from({ length: 25 }, (_, i) => {
  const c = i % 5 - 2;
  const r = Math.floor(i / 5) - 2;
  return { c, r, weight: (3 - Math.abs(c)) * (3 - Math.abs(r)) };
});

export class Landscape {
  private colors: Uint32Array;
  private features: Uint16Array;
  private regions: Uint8Array;
  private seed: number;
  readonly byteLength: number;

  constructor(readonly world: FactoryWorld) {
    this.colors = new Uint32Array(world.size * world.size);
    this.features = new Uint16Array(world.size * world.size);
    this.regions = new Uint8Array(world.size * world.size);
    this.byteLength = this.colors.byteLength + this.features.byteLength + this.regions.byteLength;
    this.seed = hashSeed(world.seed) ^ 0x51f27;
    for (let r = 0; r < world.size; r++) for (let c = 0; c < world.size; c++) {
      const cell = world.at({ c, r });
      this.regions[r * world.size + c] = BIOMES.indexOf(cell.biome) | (cell.ground === 'water' ? 4 : 0);
    }
  }

  at(tile: Tile, cell: WorldTile = this.world.at(tile)): LandscapeTile {
    const index = tile.r * this.world.size + tile.c;
    if (!this.colors[index]) {
      const weights = [0, 0, 0];
      let shore = 0;
      let nearWater = false;
      for (const offset of BLEND) {
        const c = tile.c + offset.c;
        const r = tile.r + offset.r;
        if (c < 0 || r < 0 || c >= this.world.size || r >= this.world.size) continue;
        const region = this.regions[r * this.world.size + c];
        if (region & 4) nearWater = true;
        weights[region & 3] += offset.weight;
      }
      for (let direction = 0; direction < NEIGHBORS.length; direction++) {
        const offset = NEIGHBORS[direction];
        const c = tile.c + offset.c;
        const r = tile.r + offset.r;
        if (c >= 0 && r >= 0 && c < this.world.size && r < this.world.size &&
          Boolean(this.regions[r * this.world.size + c] & 4) !== (cell.ground === 'water')) shore |= 1 << direction;
      }
      const patch = noise(this.seed, tile.c, tile.r, 14);
      const detail = randomAt(this.seed ^ 71, tile.c, tile.r);
      let color = 0;
      let motif: Motif = null;
      if (cell.ground === 'water') {
        color = tint(0x7da9a4, (patch - 0.5) * 10);
      } else {
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        for (const shift of [0, 8, 16]) {
          const channel = GROUND.reduce((sum, rgb, i) => sum + ((rgb >>> shift) & 255) * weights[i], 0) / total;
          color |= Math.round(channel) << shift;
        }
        color = tint(color, (patch - 0.5) * 14 + (detail - 0.5) * 3);
        const region = detail * total;
        const starter = tile.c < 24 && tile.r < 24;
        const biome = starter || region < weights[0] ? 'meadow' : region < weights[0] + weights[1] ? 'riverbank' : 'upland';
        const density = randomAt(this.seed ^ 193, tile.c, tile.r);
        if (!cell.deposit) {
          if (biome === 'meadow') motif = density < 0.22 + patch * 0.32 && (starter || patch > 0.38) ? 'flowers' : density < 0.82 ? 'grass' : null;
          else if (biome === 'riverbank') motif = nearWater && density < 0.48 ? 'reeds' : density < 0.3 ? 'scrub' : null;
          else motif = density < 0.28 ? 'stone' : density < 0.44 ? 'lichen' : density < 0.55 ? 'scrub' : density < 0.65 ? 'grass' : null;
        }
      }
      this.colors[index] = color;
      this.features[index] = MOTIFS.indexOf(motif) | (shore << 3) |
        ((Math.floor(randomAt(this.seed ^ 853, tile.c, tile.r) * 64) | (Math.floor(patch * 4) << 6)) << 7);
    }
    const feature = this.features[index];
    return { color: this.colors[index], motif: MOTIFS[feature & 7], shore: (feature >>> 3) & 15, variant: feature >>> 7 };
  }
}

function tint(color: number, amount: number): number {
  let result = 0;
  for (const shift of [0, 8, 16]) result |= Math.max(0, Math.min(255, Math.round(((color >>> shift) & 255) + amount))) << shift;
  return result;
}

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function drawGround(
  ctx: CanvasRenderingContext2D, tile: Tile, cell: WorldTile, look: LandscapeTile, overscan: number,
): void {
  const p = project(tile.c, tile.r);
  ctx.fillStyle = css(look.color);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - HALF_HEIGHT - overscan);
  ctx.lineTo(p.x + HALF_WIDTH + overscan, p.y);
  ctx.lineTo(p.x, p.y + HALF_HEIGHT + overscan);
  ctx.lineTo(p.x - HALF_WIDTH - overscan, p.y);
  ctx.closePath();
  ctx.fill();
  for (let direction = 0; direction < 4; direction++) {
    if (!(look.shore & (1 << direction))) continue;
    const a = CORNERS[direction];
    const b = CORNERS[(direction + 1) % 4];
    if (cell.ground === 'land') {
      ctx.fillStyle = '#c2b99a';
      ctx.beginPath();
      ctx.moveTo(p.x + a.x, p.y + a.y);
      ctx.lineTo(p.x + b.x, p.y + b.y);
      ctx.lineTo(p.x + b.x * 0.78, p.y + b.y * 0.78);
      ctx.lineTo(p.x + a.x * 0.78, p.y + a.y * 0.78);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = '#d2dfcf90';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x + a.x * 0.88, p.y + a.y * 0.88);
      ctx.lineTo(p.x + b.x * 0.88, p.y + b.y * 0.88);
      ctx.stroke();
    }
  }

  const x = p.x + (look.variant % 8 - 3.5) * 2;
  const y = p.y + (Math.floor(look.variant / 8) % 8 - 3.5) * 0.8;
  if (cell.biome === 'meadow' && (look.motif === 'grass' || look.motif === 'flowers')) {
    const w = 24;
    ctx.fillStyle = look.variant % 2 ? '#829e6824' : '#c0cd9628';
    ctx.beginPath();
    ctx.moveTo(p.x - w, p.y);
    ctx.quadraticCurveTo(p.x - 12, p.y - 8, p.x + 4, p.y - 6);
    ctx.quadraticCurveTo(p.x + w, p.y - 7, p.x + w, p.y + 1);
    ctx.quadraticCurveTo(p.x + 10, p.y + 9, p.x - 5, p.y + 6);
    ctx.quadraticCurveTo(p.x - w, p.y + 5, p.x - w, p.y);
    ctx.fill();
  }
  if (cell.ground === 'water') {
    if (look.variant % 3 !== 0) return;
    ctx.strokeStyle = '#c5dacf70';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 1);
    ctx.quadraticCurveTo(x, y - 1, x + 9, y + 1);
    ctx.stroke();
  } else if (look.motif === 'flowers') {
    drawFlowers(ctx, x, y, look.variant);
  } else if (look.motif === 'lichen') {
    ctx.fillStyle = '#a6b08d80';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 7, y - 4);
    ctx.lineTo(x + 2, y - 3);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x + 4, y + 4);
    ctx.lineTo(x - 4, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d2d0b390';
    ctx.fillRect(x - 6, y - 1, 3, 1.5);
    ctx.fillRect(x + 2, y + 1, 2, 1.5);
  } else if (look.motif === 'stone') {
    ctx.fillStyle = '#93998970';
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x - 3, y - 4);
    ctx.lineTo(x + 10, y - 2);
    ctx.lineTo(x + 13, y + 1);
    ctx.lineTo(x + 1, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ddd9bd90';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.lineTo(x + 1, y - 2);
    ctx.lineTo(x + 7, y);
    ctx.stroke();
  } else if (look.motif) {
    const reed = look.motif === 'reeds';
    const upland = cell.biome === 'upland';
    const height = reed ? 7 : upland ? 5 + look.variant % 3 : 3;
    ctx.strokeStyle = reed ? '#667b55' : upland ? '#858368a0' : '#6f895c90';
    ctx.lineWidth = reed ? 1.4 : 1;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const dx = x - 6 + i * 5;
      const dy = y + (i % 2) * 2;
      ctx.moveTo(dx - 2, dy + 3);
      ctx.quadraticCurveTo(dx - 3, dy, dx - 2 + i * 2, dy - height);
    }
    ctx.stroke();
    if (reed) {
      ctx.fillStyle = '#a79767';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 8 + i * 6, y - 7 + i % 2, 1.5, 3);
    } else if (look.motif === 'scrub' || look.variant % 3 === 0) {
      ctx.fillStyle = upland ? '#81916b90' : '#74955f80';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 8 + i * 5, y - height + i % 2, 3, 2);
    }
  }
}

function drawFlowers(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
  const count = 6 + variant % 3;
  const colors = FLOWER_COLORS[variant >>> 6];
  ctx.strokeStyle = '#758e6390';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const flower = FLOWERS[i];
    ctx.moveTo(x + flower.x - 1, y + flower.y + 3);
    ctx.lineTo(x + flower.x, y + flower.y);
  }
  ctx.stroke();
  for (let group = 0; group < 2; group++) {
    ctx.fillStyle = colors[group];
    for (let i = 0; i < count; i++) {
      if ((i % 3 === 0 ? 1 : 0) !== group) continue;
      const flower = FLOWERS[i];
      ctx.fillRect(x + flower.x - 2.5, y + flower.y - 1, 5, 2);
      ctx.fillRect(x + flower.x - 1, y + flower.y - 2, 2, 4);
    }
  }
  ctx.fillStyle = '#ac9967';
  for (let i = 0; i < count; i++) ctx.fillRect(x + FLOWERS[i].x - 0.6, y + FLOWERS[i].y - 0.6, 1.2, 1.2);
}
