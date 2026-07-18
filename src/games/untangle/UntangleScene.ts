import Phaser from 'phaser';
import { COLORS, getRenderScale } from '../../core/createGame';
import { Point, segmentsIntersect } from './geometry';
import { generateLevel, Level } from './levels';
import type { Hud } from './hud';

type NodeObj = Phaser.GameObjects.Arc;

const HUB_URL = '../../';

export default class UntangleScene extends Phaser.Scene {
  private level!: Level;
  private nodes: NodeObj[] = [];
  private norm: Point[] = []; // normalized 0..1 positions (source of truth)
  private edgeGfx!: Phaser.GameObjects.Graphics;
  private hud!: Hud;

  private field = { x: 0, y: 0, w: 0, h: 0 };
  private radius = 16;
  private dpr = 1;
  private solved = false;

  private dragIndex = -1;
  private hoverIndex = -1;

  private levelIndex = 0;

  constructor() {
    super('UntangleScene');
  }

  create(): void {
    this.dpr = getRenderScale();
    this.edgeGfx = this.add.graphics();
    this.hud = this.registry.get('hud') as Hud;

    this.hud.onShuffle = () => this.reload();
    this.hud.onNext = () => this.loadLevel(this.levelIndex + 1);
    this.hud.onHub = () => {
      window.location.href = HUB_URL;
    };

    // Nearest-node pickup: grab whichever node center is closest to the
    // pointer within a generous threshold. Robust to overlapping nodes and
    // forgiving on touch — no per-node hit areas to keep in sync.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', () => this.onPointerUp());
    this.input.on('pointerupoutside', () => this.onPointerUp());

    this.scale.on('resize', () => this.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hud?.destroy());

    this.loadLevel(this.levelIndex);
  }

  private reload(): void {
    this.loadLevel(this.levelIndex);
  }

  private loadLevel(index: number): void {
    this.levelIndex = index;
    this.level = generateLevel(index);
    this.norm = this.level.start.map((p) => ({ ...p }));
    this.solved = false;
    this.dragIndex = -1;
    this.hoverIndex = -1;
    this.hud.hideWin();
    this.hud.setLevel(index + 1);

    this.nodes.forEach((n) => n.destroy());
    this.nodes = [];

    this.level.start.forEach((_p, i) => {
      const c = this.add.circle(0, 0, this.radius, COLORS.node).setDepth(4);
      c.setStrokeStyle(3 * this.dpr, 0xffffff, 0.9);
      c.setData('index', i);
      this.nodes.push(c);
    });

    this.layout();
  }

  /** Pickup radius: how close the pointer must be to a node center to grab it. */
  private get grabRadius(): number {
    return Math.max(this.radius * 2.4, 30 * this.dpr);
  }

  private nearestNode(x: number, y: number): { index: number; dist: number } {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const p = this.nodePixel(i);
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return { index: best, dist: bestDist };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const { index, dist } = this.nearestNode(p.x, p.y);
    if (index >= 0 && dist <= this.grabRadius) {
      this.dragIndex = index;
      const node = this.nodes[index];
      node.setDepth(6);
      node.setScale(1.2);
      this.input.setDefaultCursor('grabbing');
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.dragIndex >= 0) {
      const nx = Phaser.Math.Clamp((p.x - this.field.x) / this.field.w, 0, 1);
      const ny = Phaser.Math.Clamp((p.y - this.field.y) / this.field.h, 0, 1);
      this.norm[this.dragIndex] = { x: nx, y: ny };
      this.nodes[this.dragIndex].setPosition(
        this.field.x + nx * this.field.w,
        this.field.y + ny * this.field.h
      );
      this.redraw();
      return;
    }

    // Hover feedback: highlight the grabbable node under the pointer.
    const { index, dist } = this.nearestNode(p.x, p.y);
    const hovered = index >= 0 && dist <= this.grabRadius ? index : -1;
    if (hovered !== this.hoverIndex) {
      if (this.hoverIndex >= 0 && this.nodes[this.hoverIndex]) {
        this.nodes[this.hoverIndex].setScale(1);
      }
      this.hoverIndex = hovered;
      if (hovered >= 0) this.nodes[hovered].setScale(1.15);
      this.input.setDefaultCursor(hovered >= 0 ? 'grab' : 'default');
    }
  }

  private onPointerUp(): void {
    if (this.dragIndex >= 0) {
      const node = this.nodes[this.dragIndex];
      node.setDepth(4);
      node.setScale(1);
      this.dragIndex = -1;
      this.hoverIndex = -1;
      this.input.setDefaultCursor('default');
      // Only now (after release) do we check for a win.
      this.redraw();
    }
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.radius = Phaser.Math.Clamp(Math.min(W, H) * 0.024, 10 * this.dpr, 22 * this.dpr);

    const marginX = Math.max(40 * this.dpr, W * 0.06);
    const topMargin = 80 * this.dpr;
    const bottomMargin = 40 * this.dpr;
    this.field = {
      x: marginX,
      y: topMargin,
      w: W - marginX * 2,
      h: H - topMargin - bottomMargin,
    };

    this.nodes.forEach((n, i) => {
      n.setRadius(this.radius);
      n.setPosition(
        this.field.x + this.norm[i].x * this.field.w,
        this.field.y + this.norm[i].y * this.field.h
      );
    });

    this.redraw();
  }

  private nodePixel(i: number): Point {
    return {
      x: this.field.x + this.norm[i].x * this.field.w,
      y: this.field.y + this.norm[i].y * this.field.h,
    };
  }

  private redraw(): void {
    const edges = this.level.edges;
    const crossing = new Array(edges.length).fill(false);

    for (let a = 0; a < edges.length; a++) {
      for (let b = a + 1; b < edges.length; b++) {
        const [a1, a2] = edges[a];
        const [b1, b2] = edges[b];
        if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;
        if (
          segmentsIntersect(this.nodePixel(a1), this.nodePixel(a2), this.nodePixel(b1), this.nodePixel(b2))
        ) {
          crossing[a] = true;
          crossing[b] = true;
        }
      }
    }

    this.edgeGfx.clear();
    edges.forEach(([u, v], idx) => {
      const p1 = this.nodePixel(u);
      const p2 = this.nodePixel(v);
      // Neon glow under tangled strings so the eye is drawn to what's left.
      if (crossing[idx]) {
        this.edgeGfx.lineStyle(11 * this.dpr, COLORS.bad, 0.14);
        this.edgeGfx.beginPath();
        this.edgeGfx.moveTo(p1.x, p1.y);
        this.edgeGfx.lineTo(p2.x, p2.y);
        this.edgeGfx.strokePath();
      }
      const color = crossing[idx] ? COLORS.bad : COLORS.good;
      this.edgeGfx.lineStyle(3.5 * this.dpr, color, crossing[idx] ? 0.98 : 0.75);
      this.edgeGfx.beginPath();
      this.edgeGfx.moveTo(p1.x, p1.y);
      this.edgeGfx.lineTo(p2.x, p2.y);
      this.edgeGfx.strokePath();
    });

    const intersectingEdges = crossing.filter(Boolean).length;

    this.hud.setStatus(
      intersectingEdges === 0 ? 'Solved!' : `Tangled strings: ${intersectingEdges}`,
      intersectingEdges === 0
    );

    this.nodes.forEach((n) => n.setFillStyle(intersectingEdges === 0 ? COLORS.good : COLORS.node));

    // Only celebrate once the player has released the node they were dragging,
    // so "solved" never flashes mid-drag while passing through a solution.
    if (intersectingEdges === 0 && !this.solved && this.dragIndex < 0) {
      this.solved = true;
      this.hud.showWin(this.levelIndex + 1);
    }
  }
}
