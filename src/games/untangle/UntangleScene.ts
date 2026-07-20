import Phaser from 'phaser';
import { COLORS, getRenderScale, prefersReducedMotion } from '../../core/createGame';
import { submitScore } from '../../core/scores';
import { Point, segmentsIntersect, edgesShareNode } from './geometry';
import { generateClusterGraph } from './clusters';
import type { Hud } from './hud';

// A single tangled graph fills the screen. Untangle it fully and it collapses
// into one super-node; the world then "zooms out" so that node becomes one
// vertex of the next graph. World is centred on (0,0) and sized relative to a
// constant `viewRadius`, so the camera never moves. The zoom-out is faked by
// `zoomScale`: a freshly revealed graph starts enlarged/spread out (zoomScale =
// GROWTH) and shrinks its nodes, edges and positions down to true size
// (zoomScale = 1). Coordinates therefore never exceed ~GROWTH × viewRadius, so
// they stay well within 32-bit float precision no matter how many levels pass —
// the old approach grew the world unboundedly and nodes vanished around level 15+.
const INITIAL_VIEW_RADIUS = 1000;
const GROWTH = 2; // apparent zoom-out factor applied to each freshly revealed graph
const PAD = 1.12; // fraction of extra margin around the fitted view
const NODE_FRAC = 0.04; // base node radius as a fraction of viewRadius
const EDGE_FRAC = 0.006; // edge line width as a fraction of viewRadius
const GRAB_PX = 34; // pointer pickup radius, in screen pixels
const MOBILE_UI_SCALE = 1.8; // enlarge nodes / strings / hit-area on touch devices
const BASE_SIZE = 12; // starting node count (~ old "Level 6")
const MAX_SIZE = 20;
const FLOAT_AMP = prefersReducedMotion ? 0 : 0.3;
const WIN_HOLD_MS = prefersReducedMotion ? 100 : 650;
const MERGE_MS = prefersReducedMotion ? 1 : 200;
const POP_MS = prefersReducedMotion ? 1 : 190;
const SETTLE_MS = prefersReducedMotion ? 1 : 130;
const MOVE_MS = prefersReducedMotion ? 1 : 450;
const POP_IN_MS = prefersReducedMotion ? 1 : 360;

interface GNode {
  id: number;
  bx: number; // base world position (target the node "wants" to sit at)
  by: number;
  x: number; // live display position (base + idle drift)
  y: number;
  ph1: number; // per-node drift phases / speeds for organic motion
  ph2: number;
  sp1: number;
  sp2: number;
  arc: Phaser.GameObjects.Arc;
}

interface Graph {
  nodeIds: number[];
  edges: [number, number][]; // pairs of local indices into nodeIds
}

export default class UntangleScene extends Phaser.Scene {
  private nodes = new Map<number, GNode>();
  private graph: Graph | null = null;
  private edgeGfx!: Phaser.GameObjects.Graphics;
  private hud!: Hud;

  private dpr = 1;
  private uiScale = 1; // >1 on mobile so nodes / strings are easier to see & grab
  private viewRadius = INITIAL_VIEW_RADIUS; // constant sizing base; the camera never moves
  private zoomScale = 1; // >1 during a reveal to fake a zoom-out, animating back to 1
  private depth = 0;
  private score = 0; // cumulative nodes untangled

  private nextNodeId = 0;

  private dragId = -1;
  private hoverId = -1;
  private revealing = false;

  constructor() {
    super('UntangleScene');
  }

  create(): void {
    this.dpr = getRenderScale();
    this.uiScale = this.isMobile() ? MOBILE_UI_SCALE : 1;
    this.edgeGfx = this.add.graphics().setDepth(1);
    this.hud = this.registry.get('hud') as Hud;

    this.ensureSparkTexture();

    this.hud.onShuffle = () => this.reshuffle();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', () => this.onPointerUp());
    this.input.on('pointerupoutside', () => this.onPointerUp());

    this.scale.on('resize', () => this.fitCamera());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hud?.destroy());

    this.cameras.main.centerOn(0, 0);
    this.fitCamera();

    this.hud.setScore(0);
    this.hud.setDepth(0);
    this.buildGraph(null);
    this.redraw();
  }

  /** Per-frame idle drift: nodes gently float around their (scaled) base positions. */
  update(time: number): void {
    if (this.nodes.size === 0) return;
    const s = this.zoomScale;
    const amp = this.nodeBaseRadius * FLOAT_AMP * s;
    for (const n of this.nodes.values()) {
      if (n.id === this.dragId) continue; // dragged node tracks the pointer exactly
      n.x = n.bx * s + Math.sin(time * n.sp1 + n.ph1) * amp;
      n.y = n.by * s + Math.cos(time * n.sp2 + n.ph2) * amp;
      n.arc.setPosition(n.x, n.y);
    }
    this.redraw();
  }

  // ── Sizing helpers (all relative to the current view radius) ──────────────
  private isMobile(): boolean {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const small = Math.min(window.innerWidth, window.innerHeight) < 768;
    return coarse || small;
  }
  private get nodeBaseRadius(): number {
    return this.viewRadius * NODE_FRAC * this.uiScale;
  }
  private nodeRadius(): number {
    return this.nodeBaseRadius * this.zoomScale;
  }
  private get edgeWidth(): number {
    return this.viewRadius * EDGE_FRAC * this.uiScale * this.zoomScale;
  }
  private get grabRadiusWorld(): number {
    return Math.max(
      this.nodeRadius() * 2.2,
      (GRAB_PX * this.uiScale * this.dpr) / this.cameras.main.zoom
    );
  }
  private graphSize(): number {
    return Math.min(BASE_SIZE + this.depth, MAX_SIZE);
  }

  private fitCamera(): void {
    const cam = this.cameras.main;
    const zoom = Math.min(cam.width, cam.height) / (2 * this.viewRadius * PAD);
    cam.centerOn(0, 0);
    cam.setZoom(zoom);
  }

  /**
   * Half the visible world extent on each axis for the current view, matching
   * `fitCamera`. Layouts map the unit square across this so the tangle fills the
   * whole screen — including the long axis on a portrait phone — not just a
   * centred blob.
   */
  private visibleHalf(): { x: number; y: number } {
    const cam = this.cameras.main;
    const minHalf = this.viewRadius * PAD;
    const wide = cam.width >= cam.height;
    const ratio = wide ? cam.width / cam.height : cam.height / cam.width;
    return wide ? { x: minHalf * ratio, y: minHalf } : { x: minHalf, y: minHalf * ratio };
  }

  private localToWorld(local: Point): { x: number; y: number } {
    const h = this.visibleHalf();
    return { x: (local.x - 0.5) * 2 * h.x, y: (local.y - 0.5) * 2 * h.y };
  }

  // ── Node / graph construction ─────────────────────────────────────────────
  private makeNode(x: number, y: number): number {
    const id = this.nextNodeId++;
    const r = this.nodeRadius();
    const arc = this.add.circle(x, y, r, COLORS.node).setDepth(4);
    arc.setStrokeStyle(Math.max(1, r * 0.18), 0xffffff, 0.9);
    this.nodes.set(id, {
      id,
      bx: x,
      by: y,
      x,
      y,
      ph1: Math.random() * Math.PI * 2,
      ph2: Math.random() * Math.PI * 2,
      sp1: Phaser.Math.FloatBetween(0.00018, 0.00042),
      sp2: Phaser.Math.FloatBetween(0.00018, 0.00042),
      arc,
    });
    return id;
  }

  /**
   * Build a fresh tangled graph filling the current view. If `carryId` is set,
   * that (super-)node is reused as one vertex of the new graph — the rest are
   * freshly created base nodes.
   */
  private buildGraph(carryId: number | null): void {
    const size = this.graphSize();
    const g = generateClusterGraph(size);

    const pool: number[] = [];
    if (carryId != null) pool.push(carryId);
    while (pool.length < size) pool.push(this.makeNode(0, 0));
    Phaser.Utils.Array.Shuffle(pool);

    const nodeIds: number[] = [];
    for (let k = 0; k < size; k++) {
      const id = pool[k];
      const w = this.localToWorld(g.start[k]);
      this.placeNode(id, w.x, w.y);
      nodeIds.push(id);
    }

    this.graph = { nodeIds, edges: g.edges };
  }

  /** Move a node's base position, retweening + resizing if it already exists. */
  private placeNode(id: number, x: number, y: number): void {
    const n = this.nodes.get(id);
    if (!n) return;
    const r = this.nodeRadius();
    n.arc.setRadius(r);
    n.arc.setStrokeStyle(Math.max(1, r * 0.18), 0xffffff, 0.9);
    if (n.bx === 0 && n.by === 0 && n.x === 0 && n.y === 0) {
      // Freshly created at origin — pop into place instead of sliding from 0,0.
      n.bx = x;
      n.by = y;
      n.x = x;
      n.y = y;
      n.arc.setPosition(x, y).setScale(0);
      this.tweens.add({ targets: n.arc, scale: 1, duration: POP_IN_MS, ease: 'Back.easeOut' });
    } else {
      // Slide the base position; the update loop renders base + idle drift.
      this.tweens.add({ targets: n, bx: x, by: y, duration: MOVE_MS, ease: 'Sine.easeInOut' });
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private nearest(worldX: number, worldY: number): { id: number; dist: number } {
    let best = -1;
    let bestDist = Infinity;
    for (const n of this.nodes.values()) {
      const d = Phaser.Math.Distance.Between(worldX, worldY, n.x, n.y);
      if (d < bestDist) {
        bestDist = d;
        best = n.id;
      }
    }
    return { id: best, dist: bestDist };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.revealing) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const { id, dist } = this.nearest(wp.x, wp.y);
    if (id >= 0 && dist <= this.grabRadiusWorld) {
      this.dragId = id;
      const n = this.nodes.get(id)!;
      n.arc.setDepth(6).setScale(1.2);
      this.input.setDefaultCursor('grabbing');
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    if (this.dragId >= 0) {
      const n = this.nodes.get(this.dragId);
      if (!n) return;
      n.bx = wp.x;
      n.by = wp.y;
      n.x = wp.x;
      n.y = wp.y;
      n.arc.setPosition(wp.x, wp.y);
      this.redraw();
      return;
    }

    const { id, dist } = this.nearest(wp.x, wp.y);
    const hovered = id >= 0 && dist <= this.grabRadiusWorld ? id : -1;
    if (hovered !== this.hoverId) {
      const prev = this.nodes.get(this.hoverId);
      if (prev) prev.arc.setScale(1);
      this.hoverId = hovered;
      const now = this.nodes.get(hovered);
      if (now) now.arc.setScale(1.15);
      this.input.setDefaultCursor(hovered >= 0 ? 'grab' : 'default');
    }
  }

  private onPointerUp(): void {
    if (this.dragId < 0) return;
    const n = this.nodes.get(this.dragId);
    if (n) n.arc.setDepth(4).setScale(1);
    this.dragId = -1;
    this.hoverId = -1;
    this.input.setDefaultCursor('default');
    this.redraw();
    this.checkSolved();
  }

  // ── Crossing detection & rendering ────────────────────────────────────────
  private nodePoint(id: number): Point {
    const n = this.nodes.get(id)!;
    return { x: n.x, y: n.y };
  }

  private crossings(graph: Graph): boolean[] {
    const { edges, nodeIds } = graph;
    const crossing = new Array(edges.length).fill(false);
    for (let a = 0; a < edges.length; a++) {
      for (let b = a + 1; b < edges.length; b++) {
        if (edgesShareNode(edges[a], edges[b])) continue;
        const [a1, a2] = edges[a];
        const [b1, b2] = edges[b];
        if (
          segmentsIntersect(
            this.nodePoint(nodeIds[a1]),
            this.nodePoint(nodeIds[a2]),
            this.nodePoint(nodeIds[b1]),
            this.nodePoint(nodeIds[b2])
          )
        ) {
          crossing[a] = true;
          crossing[b] = true;
        }
      }
    }
    return crossing;
  }

  private redraw(): void {
    this.edgeGfx.clear();
    if (!this.graph) {
      this.hud.setStatus('Zooming out…', false);
      return;
    }

    const graph = this.graph;
    const lineW = this.edgeWidth;
    const crossing = this.crossings(graph);
    let crossingEdges = 0;

    graph.edges.forEach(([u, v], idx) => {
      const p1 = this.nodePoint(graph.nodeIds[u]);
      const p2 = this.nodePoint(graph.nodeIds[v]);
      if (crossing[idx]) {
        crossingEdges++;
        this.edgeGfx.lineStyle(lineW * 3, COLORS.bad, 0.14);
        this.edgeGfx.lineBetween(p1.x, p1.y, p2.x, p2.y);
      }
      const color = crossing[idx] ? COLORS.bad : COLORS.good;
      this.edgeGfx.lineStyle(lineW, color, crossing[idx] ? 0.98 : 0.75);
      this.edgeGfx.lineBetween(p1.x, p1.y, p2.x, p2.y);
    });

    const solved = crossingEdges === 0;
    for (const id of graph.nodeIds) {
      const n = this.nodes.get(id);
      if (n) n.arc.setFillStyle(solved ? COLORS.good : COLORS.node);
    }

    this.hud.setStatus(solved ? 'Untangled!' : `Tangled strings: ${crossingEdges}`, solved);
  }

  // ── Collapse & zoom-out ───────────────────────────────────────────────────
  private checkSolved(): void {
    if (this.revealing || !this.graph) return;
    if (this.crossings(this.graph).some(Boolean)) return;
    // Solved: block input and hold the all-green win state for a beat, then merge.
    this.revealing = true;
    this.redraw();
    this.spawnWinBurst();
    this.time.delayedCall(WIN_HOLD_MS, () => this.collapse());
  }

  /** Build a soft round spark texture once, reused by the win particle burst. */
  private ensureSparkTexture(): void {
    if (this.textures.exists('ug-spark')) return;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 14);
    g.generateTexture('ug-spark', 32, 32);
    g.destroy();
  }

  /** Celebratory particle burst from every node when the graph is solved. */
  private spawnWinBurst(): void {
    if (!this.graph) return;
    const vr = this.viewRadius;
    const emitter = this.add
      .particles(0, 0, 'ug-spark', {
        lifespan: 750,
        speed: { min: vr * 0.12, max: vr * 0.55 },
        scale: { start: vr * 0.0016 * this.uiScale, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: [COLORS.good, COLORS.good, COLORS.node, COLORS.accent, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(10);

    for (const id of this.graph.nodeIds) {
      const n = this.nodes.get(id);
      if (n) emitter.explode(9, n.x, n.y);
    }
    this.time.delayedCall(900, () => emitter.destroy());
  }

  private collapse(): void {
    const graph = this.graph;
    if (!graph) return;
    this.graph = null;
    this.revealing = true;
    this.redraw();

    const members = graph.nodeIds.map((id) => this.nodes.get(id)!).filter(Boolean);
    const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
    const cy = members.reduce((s, n) => s + n.y, 0) / members.length;

    const arcs = members.map((n) => n.arc);
    for (const n of members) this.nodes.delete(n.id);

    this.score += members.length;
    this.hud.setScore(this.score);
    submitScore('untangle', this.score);

    this.tweens.add({
      targets: arcs,
      x: cx,
      y: cy,
      scale: 0,
      duration: MERGE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        arcs.forEach((a) => a.destroy());
        const id = this.makeNode(cx, cy);
        const n = this.nodes.get(id)!;
        n.arc.setScale(0);
        this.tweens.add({ targets: n.arc, scale: 1, duration: POP_MS, ease: 'Back.easeOut' });
        this.hud.pulseCollapse();
        // Let the lone super-node sit for a beat, then zoom out around it.
        this.time.delayedCall(SETTLE_MS, () => this.reveal(id));
      },
    });
  }

  private reveal(superId: number): void {
    this.depth++;
    this.hud.setDepth(this.depth);

    this.buildGraph(superId);
    this.zoomOutReveal();
    this.redraw();
  }

  /**
   * Fake a zoom-out without moving the camera: the freshly built graph starts
   * enlarged and spread out (`zoomScale` = GROWTH) and shrinks to its true size
   * (`zoomScale` = 1). Positions (via `update`), node radii and edge widths are
   * all derived from `zoomScale`, so the whole graph appears to recede into
   * place. Because coordinates never exceed ~GROWTH × viewRadius, 32-bit float
   * precision stays intact no matter how deep the run goes.
   */
  private zoomOutReveal(): void {
    this.zoomScale = GROWTH;
    this.applyNodeScale();
    this.tweens.add({
      targets: this,
      zoomScale: 1,
      duration: MOVE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.applyNodeScale(),
      onComplete: () => {
        this.zoomScale = 1;
        this.applyNodeScale();
        this.revealing = false;
        this.redraw();
      },
    });
  }

  /** Resize every node's arc to match the current `zoomScale`. */
  private applyNodeScale(): void {
    const r = this.nodeRadius();
    for (const n of this.nodes.values()) {
      n.arc.setRadius(r);
      n.arc.setStrokeStyle(Math.max(1, r * 0.18), 0xffffff, 0.9);
    }
  }

  // ── Shuffle (re-scramble the current graph) ───────────────────────────────
  private reshuffle(): void {
    if (this.revealing || !this.graph) return;
    const graph = this.graph;
    const g = generateClusterGraph(graph.nodeIds.length);
    graph.edges = g.edges;
    graph.nodeIds.forEach((id, k) => {
      const w = this.localToWorld(g.start[k]);
      this.placeNode(id, w.x, w.y);
    });
    this.redraw();
  }
}
