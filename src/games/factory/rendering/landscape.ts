import type { LandscapeTile } from '../assets/landscape';
import { GROUND, MOTIFS, tint } from '../assets/landscape';
import type { Tile } from '../game/domain';
import { BIOMES, FactoryWorld, hashSeed, noise, randomAt, WorldTile } from '../game/world';

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
      let motif: LandscapeTile['motif'] = null;
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
