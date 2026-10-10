import Phaser from 'phaser';
import { drawOre, drawTree } from './art';
import { HALF_HEIGHT, HALF_WIDTH, project, tileKey } from './model';
import { CHUNK_SIZE, FactoryWorld, WORLD_SIZE } from './world';
import { Chunk, inView, MAX_RESIDENT_CHUNKS, tileDepth, visibleChunks, visibleTileBounds, WorldView } from './chunks';

const RESOLUTION = 0.5;
const PREVIEW_RESOLUTION = 0.0625;
const TEXTURE_WIDTH = CHUNK_SIZE * HALF_WIDTH * 2 * RESOLUTION;
const TEXTURE_HEIGHT = (CHUNK_SIZE * HALF_HEIGHT * 2 + 12) * RESOLUTION;
const COLORS = {
  meadow: ['#9baa83', '#a0ae86', '#a4b18b', '#9dac84'],
  riverbank: ['#839d81', '#8ba387', '#91a98c', '#879f84'],
  upland: ['#aaa994', '#b0b09c', '#a4a68f', '#b5b39e'],
  water: ['#83ada8', '#89b0a9', '#8eb5ac', '#86aaa5'],
};

export default class WorldRenderer {
  private chunks = new Map<string, { image: Phaser.GameObjects.Image; texture: string; ready: boolean }>();
  private props = new Map<string, Phaser.GameObjects.Image>();
  private atlas: string[] = [];
  private lastView = '';
  readonly stats = { chunks: 0, props: 0, textureBytes: 0, maxBuildMs: 0, built: 0 };

  constructor(private scene: Phaser.Scene, readonly world: FactoryWorld) {
    const g = scene.add.graphics();
    for (const kind of ['tree', 'iron', 'copper'] as const) {
      for (let variant = 0; variant < 4; variant++) {
        const key = `factory-prop-${kind}-${variant}`;
        this.atlas.push(key);
        if (scene.textures.exists(key)) continue;
        g.clear();
        if (kind === 'tree') drawTree(g, 64, 88, variant * 7, variant * 3);
        else drawOre(g, 64, 88, kind === 'copper', variant * 7, variant * 3);
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

  private buildChunk(chunk: Chunk, detailed: boolean): void {
    const resolution = detailed ? RESOLUTION : PREVIEW_RESOLUTION;
    const key = `factory-ground-${chunk.key}-${detailed ? 'detail' : 'preview'}`;
    const texture = this.scene.textures.createCanvas(key, CHUNK_SIZE * HALF_WIDTH * 2 * resolution,
      (CHUNK_SIZE * HALF_HEIGHT * 2 + 12) * resolution);
    if (!texture) throw new Error('Could not allocate a factory terrain texture.');
    const ctx = texture.context;
    const c0 = chunk.c * CHUNK_SIZE;
    const r0 = chunk.r * CHUNK_SIZE;
    const left = (c0 - r0) * HALF_WIDTH - CHUNK_SIZE * HALF_WIDTH;
    const top = (c0 + r0) * HALF_HEIGHT - HALF_HEIGHT;
    ctx.scale(resolution, resolution);
    ctx.translate(-left, -top);
    for (let sum = 0; sum <= (CHUNK_SIZE - 1) * 2; sum++) {
      for (let dc = 0; dc < CHUNK_SIZE; dc++) {
        const dr = sum - dc;
        if (dr < 0 || dr >= CHUNK_SIZE) continue;
        const tile = { c: c0 + dc, r: r0 + dr };
        const cell = this.world.at(tile);
        const p = project(tile.c, tile.r);
        ctx.fillStyle = cell.ground === 'water' ? COLORS.water[cell.variant]
          : cell.deposit === 'iron' ? '#a5b1a0' : cell.deposit === 'copper' ? '#b8ad87' : COLORS[cell.biome][cell.variant];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - HALF_HEIGHT - 0.5);
        ctx.lineTo(p.x + HALF_WIDTH + 0.5, p.y);
        ctx.lineTo(p.x, p.y + HALF_HEIGHT + 0.5);
        ctx.lineTo(p.x - HALF_WIDTH - 0.5, p.y);
        ctx.closePath();
        ctx.fill();
        if (detailed && cell.ground === 'water') {
          ctx.strokeStyle = '#c6d9cb80';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - 11, p.y);
          ctx.lineTo(p.x + 6, p.y);
          ctx.stroke();
        } else if (detailed) {
          ctx.fillStyle = '#71846a50';
          ctx.fillRect(p.x - 9 + cell.variant * 4, p.y - 2, 2, 1);
          ctx.fillRect(p.x + 8 - cell.variant * 3, p.y + 5, 2, 1);
        }
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
    texture.refresh();
    const previous = this.chunks.get(chunk.key);
    const image = previous?.image ?? this.scene.add.image(left, top, key).setOrigin(0).setDepth(-100);
    image.setTexture(key).setScale(1 / resolution);
    if (previous) this.scene.textures.remove(previous.texture);
    this.chunks.set(chunk.key, { image, texture: key, ready: detailed });
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
          this.props.set(key, this.scene.add.image(p.x, p.y, `factory-prop-${kind}-${cell.variant}`)
            .setOrigin(0.5, 88 / 112).setDepth(kind === 'tree' ? tileDepth(tile) : 0));
        }
      }
    }
    for (const [key, prop] of this.props) {
      if (!visible.has(key)) {
        prop.destroy();
        this.props.delete(key);
      }
    }
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
  }
}
