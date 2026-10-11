import Phaser from 'phaser';
import { drawOre, drawTree } from './art';
import { Building, HALF_HEIGHT, HALF_WIDTH, project, Tile, tileKey } from './model';
import { BIOMES, CHUNK_SIZE, FactoryWorld, WORLD_SIZE } from './world';
import { Chunk, inView, MAX_RESIDENT_CHUNKS, tileDepth, visibleChunks, visibleTileBounds, WorldView } from './chunks';
import { drawGround, Landscape } from './landscape';

const RESOLUTION = 0.5;
const PREVIEW_RESOLUTION = 0.0625;
const GROUND_PADDING = 4;
const TEXTURE_WIDTH = (CHUNK_SIZE * HALF_WIDTH * 2 + GROUND_PADDING * 2) * RESOLUTION;
const TEXTURE_HEIGHT = (CHUNK_SIZE * HALF_HEIGHT * 2 + 12 + GROUND_PADDING * 2) * RESOLUTION;
const CANOPY_BEHIND = [
  { c: -1, r: 0 }, { c: 0, r: -1 }, { c: -1, r: -1 },
  { c: -2, r: -1 }, { c: -1, r: -2 },
];

export default class WorldRenderer {
  private chunks = new Map<string, { image: Phaser.GameObjects.Image; texture: string; ready: boolean }>();
  private props = new Map<string, Phaser.GameObjects.Image>();
  private atlas: string[] = [];
  private lastView = '';
  private landscape: Landscape;
  private previewSurface: HTMLCanvasElement;
  private previewContext: CanvasRenderingContext2D;
  private previewPixels: ImageData;
  private buildings: ReadonlyMap<string, Building> = new Map();
  readonly stats = { chunks: 0, props: 0, textureBytes: 0, landscapeBytes: 0, maxBuildMs: 0, built: 0 };

  constructor(private scene: Phaser.Scene, readonly world: FactoryWorld) {
    this.landscape = new Landscape(world);
    this.stats.landscapeBytes = this.landscape.byteLength;
    this.previewSurface = document.createElement('canvas');
    this.previewSurface.width = CHUNK_SIZE;
    this.previewSurface.height = CHUNK_SIZE;
    const context = this.previewSurface.getContext('2d');
    if (!context) throw new Error('Could not allocate a factory terrain preview.');
    this.previewContext = context;
    this.previewPixels = context.createImageData(CHUNK_SIZE, CHUNK_SIZE);
    const g = scene.add.graphics();
    for (const kind of [...BIOMES, 'iron', 'copper'] as const) {
      for (let variant = 0; variant < 4; variant++) {
        const key = `factory-prop-${kind}-${variant}`;
        this.atlas.push(key);
        if (scene.textures.exists(key)) continue;
        g.clear();
        if (kind === 'iron' || kind === 'copper') drawOre(g, 64, 88, kind === 'copper', variant * 7, variant * 3);
        else drawTree(g, 64, 88, variant * 7, variant * 3, kind);
        g.generateTexture(key, 128, 112);
      }
    }
    g.destroy();
  }

  update(view: WorldView): void {
    const desired = visibleChunks(view);
    if (desired.length > MAX_RESIDENT_CHUNKS) throw new Error('Factory camera exceeded its chunk residency budget.');
    const keys = new Set(desired.map(chunk => chunk.key));
    for (const [key, chunk] of this.chunks) {
      if (!keys.has(key)) {
        chunk.image.destroy();
        this.scene.textures.remove(chunk.texture);
        this.chunks.delete(key);
      }
    }
    const start = performance.now();
    for (const chunk of desired) {
      if (!this.chunks.has(chunk.key)) this.buildChunk(chunk, false);
    }
    let built = 0;
    for (const chunk of desired) {
      if (this.chunks.get(chunk.key)!.ready) continue;
      this.buildChunk(chunk, true);
      built++;
      if (built >= 2 || performance.now() - start >= 4) break;
    }
    if (built) {
      this.stats.maxBuildMs = Math.max(this.stats.maxBuildMs, performance.now() - start);
      this.stats.built += built;
    }
    const signature = `${Math.floor(view.x / 48)},${Math.floor(view.y / 48)},${Math.ceil(view.width)},${Math.ceil(view.height)}`;
    if (signature !== this.lastView) {
      this.lastView = signature;
      this.updateProps(view);
    }
    this.stats.chunks = this.chunks.size;
    this.stats.props = this.props.size;
    this.stats.textureBytes = this.chunks.size * TEXTURE_WIDTH * TEXTURE_HEIGHT * 4 + this.atlas.length * 128 * 112 * 4;
  }

  setBuildings(buildings: ReadonlyMap<string, Building>): void {
    this.buildings = buildings;
    this.lastView = '';
  }

  private buildChunk(chunk: Chunk, detailed: boolean): void {
    const resolution = detailed ? RESOLUTION : PREVIEW_RESOLUTION;
    const key = `factory-ground-${chunk.key}-${detailed ? 'detail' : 'preview'}`;
    const texture = this.scene.textures.createCanvas(key, Math.ceil((CHUNK_SIZE * HALF_WIDTH * 2 + GROUND_PADDING * 2) * resolution),
      Math.ceil((CHUNK_SIZE * HALF_HEIGHT * 2 + 12 + GROUND_PADDING * 2) * resolution));
    if (!texture) throw new Error('Could not allocate a factory terrain texture.');
    const ctx = texture.context;
    const c0 = chunk.c * CHUNK_SIZE;
    const r0 = chunk.r * CHUNK_SIZE;
    const left = (c0 - r0) * HALF_WIDTH - CHUNK_SIZE * HALF_WIDTH - GROUND_PADDING;
    const top = (c0 + r0) * HALF_HEIGHT - HALF_HEIGHT - GROUND_PADDING;
    if (!detailed) this.drawPreviewGround(ctx, c0, r0, resolution);
    else {
      ctx.scale(resolution, resolution);
      ctx.translate(-left, -top);
      for (let sum = 0; sum <= (CHUNK_SIZE - 1) * 2; sum++) {
        for (let dc = 0; dc < CHUNK_SIZE; dc++) {
          const dr = sum - dc;
          if (dr < 0 || dr >= CHUNK_SIZE) continue;
          const tile = { c: c0 + dc, r: r0 + dr };
          const cell = this.world.at(tile);
          const p = project(tile.c, tile.r);
          drawGround(ctx, tile, cell, this.landscape.at(tile, cell), 2 / resolution);
          if (tile.c === WORLD_SIZE - 1 || tile.r === WORLD_SIZE - 1) {
            ctx.fillStyle = '#71866b';
            ctx.beginPath();
            ctx.moveTo(p.x - HALF_WIDTH, p.y);
            ctx.lineTo(p.x, p.y + HALF_HEIGHT);
            ctx.lineTo(p.x + HALF_WIDTH, p.y);
            ctx.lineTo(p.x + HALF_WIDTH, p.y + 8);
            ctx.lineTo(p.x, p.y + HALF_HEIGHT + 8);
            ctx.lineTo(p.x - HALF_WIDTH, p.y + 8);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    texture.refresh();
    const previous = this.chunks.get(chunk.key);
    const image = previous?.image ?? this.scene.add.image(left, top, key).setOrigin(0).setDepth(-100);
    image.setTexture(key).setScale(1 / resolution);
    if (previous) this.scene.textures.remove(previous.texture);
    this.chunks.set(chunk.key, { image, texture: key, ready: detailed });
  }

  private drawPreviewGround(ctx: CanvasRenderingContext2D, c0: number, r0: number, resolution: number): void {
    const pixels = this.previewPixels.data;
    for (let r = 0; r < CHUNK_SIZE; r++) for (let c = 0; c < CHUNK_SIZE; c++) {
      const color = this.landscape.at({ c: c0 + c, r: r0 + r }).color;
      const i = (r * CHUNK_SIZE + c) * 4;
      pixels[i] = color >>> 16;
      pixels[i + 1] = (color >>> 8) & 255;
      pixels[i + 2] = color & 255;
      pixels[i + 3] = 255;
    }
    this.previewContext.putImageData(this.previewPixels, 0, 0);
    ctx.setTransform(HALF_WIDTH * resolution, HALF_HEIGHT * resolution,
      -HALF_WIDTH * resolution, HALF_HEIGHT * resolution,
      (CHUNK_SIZE * HALF_WIDTH + GROUND_PADDING) * resolution, GROUND_PADDING * resolution);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.previewSurface, 0, 0);
  }

  private updateProps(view: WorldView): void {
    const bounds = visibleTileBounds(view);
    const visible = new Set<string>();
    for (let r = bounds.minR; r <= bounds.maxR; r++) {
      for (let c = bounds.minC; c <= bounds.maxC; c++) {
        const tile = { c, r };
        const p = project(c, r);
        if (!inView(p, view)) continue;
        const cell = this.world.at(tile);
        const kind = cell.deposit ?? cell.decoration;
        if (!kind) continue;
        const key = tileKey(tile);
        visible.add(key);
        if (!this.props.has(key)) {
          this.props.set(key, this.scene.add.image(p.x, p.y, `factory-prop-${kind === 'tree' ? cell.biome : kind}-${cell.variant}`)
            .setOrigin(0.5, 88 / 112).setDepth(kind === 'tree' ? tileDepth(tile) : 0));
        }
        if (kind === 'tree') this.props.get(key)!.setAlpha(this.treeAlpha(tile));
      }
    }
    for (const [key, prop] of this.props) {
      if (!visible.has(key)) {
        prop.destroy();
        this.props.delete(key);
      }
    }
  }

  private treeAlpha(tile: Tile): number {
    // Fade only canopies in front of machines; the tree remains an obstacle.
    return CANOPY_BEHIND.some(offset => this.buildings.has(tileKey({ c: tile.c + offset.c, r: tile.r + offset.r }))) ? 0.45 : 1;
  }

  destroy(): void {
    for (const chunk of this.chunks.values()) {
      chunk.image.destroy();
      this.scene.textures.remove(chunk.texture);
    }
    for (const prop of this.props.values()) prop.destroy();
    for (const key of this.atlas) this.scene.textures.remove(key);
    this.chunks.clear();
    this.props.clear();
    this.previewSurface.width = 0;
    this.previewSurface.height = 0;
  }
}
