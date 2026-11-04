import Phaser from 'phaser';
import { getRenderScale, prefersReducedMotion } from '../../core/createGame';
import { crossingFlags, newPuzzle, readPuzzle, SAVE_KEY, type PuzzleSave } from './state';
import type { Hud } from './hud';
import { activeNode, idle, project, unproject, type Interaction } from './interaction';

type Phase = { kind: 'playing' } | { kind: 'solved'; next: PuzzleSave } | { kind: 'revealing' };

const INK = { node: 0xf0f1e7, mint: 0x75e3b3, coral: 0xff8376, lime: 0xd4f77a };

export default class UntangleScene extends Phaser.Scene {
  private hud!: Hud;
  private puzzle!: PuzzleSave;
  private graphics!: Phaser.GameObjects.Graphics;
  private dpr = getRenderScale();
  private interaction: Interaction = idle();
  private phase: Phase = { kind: 'playing' };
  private dirty = true;
  private appearance = 1;

  constructor() { super('UntangleScene'); }

  create(): void {
    this.hud = this.registry.get('hud') as Hud;
    this.graphics = this.add.graphics();
    try { this.puzzle = readPuzzle(localStorage.getItem(SAVE_KEY)) ?? newPuzzle(0); }
    catch { this.puzzle = newPuzzle(0); this.hud.warnSave(); }
    this.hud.setProgress(this.puzzle.solved);
    this.hud.onNew = () => {
      if (this.phase.kind !== 'playing') return;
      this.release(false);
      this.install(newPuzzle(this.puzzle.solved));
    };
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.phase.kind !== 'playing' || this.interaction.kind === 'drag') return;
      const id = this.nearest(pointer.x, pointer.y);
      if (id < 0) return;
      const point = this.screen(id);
      this.interaction = { kind: 'drag', node: id, pointer: pointer.id,
        offset: { x: point.x - pointer.x, y: point.y - pointer.y } };
      this.input.setDefaultCursor('grabbing');
      this.dirty = true;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.phase.kind !== 'playing') return;
      const input = this.interaction;
      if (input.kind === 'drag' && pointer.id === input.pointer) {
        this.move(input.node, pointer.x + input.offset.x, pointer.y + input.offset.y);
      } else if (input.kind === 'idle' && !pointer.wasTouch) {
        const hovered = this.nearest(pointer.x, pointer.y);
        if (hovered === input.hovered) return;
        this.interaction = { kind: 'idle', hovered };
        this.input.setDefaultCursor(hovered < 0 ? 'default' : 'grab');
        this.dirty = true;
      }
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (this.interaction.kind === 'drag' && p.id === this.interaction.pointer) this.release(true);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => this.release(true));
    this.scale.on('resize', () => { this.release(false); this.dirty = true; });

    const canvas = this.game.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Untangle board. Enter selects the next dot. Arrow keys move the selected dot. Hold Shift for larger steps.');
    const keydown = (event: KeyboardEvent) => {
      if (this.phase.kind !== 'playing' || !['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      this.release(false);
      this.input.setDefaultCursor('default');
      const previous = this.interaction.kind === 'keyboard' ? this.interaction.node : -1;
      const node = event.key === 'Enter' || event.key === ' ' ? (previous + 1) % this.puzzle.points.length : Math.max(0, previous);
      this.interaction = { kind: 'keyboard', node };
      if (event.key.startsWith('Arrow')) {
        const point = this.screen(node), step = (event.shiftKey ? 24 : 6) * this.dpr;
        this.move(node, point.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), point.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
        this.persist();
        this.checkSolved();
      }
      if (this.phase.kind === 'playing') this.hud.announceSelection(node + 1, this.puzzle.points.length, crossingFlags(this.puzzle).filter(Boolean).length);
      this.dirty = true;
    };
    const blur = () => { this.release(true); this.interaction = idle(); this.dirty = true; };
    const save = () => { this.persist(); };
    const visibility = () => { if (document.hidden) blur(); };
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    canvas.addEventListener('keydown', keydown, options);
    canvas.addEventListener('blur', blur, options);
    window.addEventListener('blur', blur, options);
    window.addEventListener('pagehide', save, options);
    document.addEventListener('visibilitychange', visibility, options);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.persist();
      listeners.abort();
    });
    this.persist();
    this.checkSolved();
  }

  private get board() { return { width: this.scale.width, height: this.scale.height, padding: 30 * this.dpr }; }
  private get radius(): number { return (window.matchMedia('(pointer: coarse)').matches ? 13 : 11) * this.dpr; }
  private screen(id: number) { return project(this.puzzle.points[id], this.board, this.appearance); }
  private nearest(x: number, y: number): number {
    let best = -1, distance = 30 * this.dpr;
    this.puzzle.points.forEach((_, id) => {
      const p = this.screen(id), d = Math.hypot(x - p.x, y - p.y);
      if (d < distance) { best = id; distance = d; }
    });
    return best;
  }
  private move(id: number, x: number, y: number): void {
    this.puzzle.points[id] = unproject({ x, y }, this.board);
    this.dirty = true;
  }
  private release(check: boolean): void {
    if (this.interaction.kind !== 'drag') return;
    this.interaction = idle();
    this.input.setDefaultCursor('default');
    this.persist();
    this.dirty = true;
    if (check) this.checkSolved();
  }
  private persist(): void {
    const value = this.phase.kind === 'solved' ? this.phase.next : this.puzzle;
    if (!value) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(value)); }
    catch { this.hud.warnSave(); }
  }
  private install(puzzle: PuzzleSave): void {
    this.puzzle = puzzle;
    this.interaction = idle();
    this.hud.setProgress(puzzle.solved);
    this.persist();
    this.dirty = true;
  }

  private checkSolved(): void {
    if (this.phase.kind !== 'playing' || crossingFlags(this.puzzle).some(Boolean)) return;
    const next = newPuzzle(this.puzzle.solved + 1);
    this.phase = { kind: 'solved', next };
    this.hud.setBusy(true);
    this.persist();
    this.interaction = idle();
    this.dirty = true;
    this.time.delayedCall(prefersReducedMotion ? 350 : 1100, () => {
      const reveal = () => {
        this.phase = { kind: 'revealing' };
        this.install(next);
        this.appearance = prefersReducedMotion ? 1 : .3;
        this.tweens.add({ targets: this, appearance: 1, duration: prefersReducedMotion ? 1 : 350,
          onUpdate: () => { this.dirty = true; }, onComplete: () => { this.phase = { kind: 'playing' }; this.hud.setBusy(false); this.dirty = true; } });
      };
      if (prefersReducedMotion) { reveal(); return; }
      this.tweens.add({ targets: this, appearance: 0, duration: 260, ease: 'Sine.easeIn', onUpdate: () => { this.dirty = true; }, onComplete: reveal });
    });
  }

  update(): void {
    if (!this.dirty || !this.puzzle) return;
    this.dirty = false;
    const g = this.graphics;
    g.clear();
    const flags = crossingFlags(this.puzzle);
    const tangled = flags.filter(Boolean).length, clear = tangled === 0;
    const active = activeNode(this.interaction);
    this.puzzle.edges.forEach(([a, b], i) => {
      const from = this.screen(a), to = this.screen(b);
      const attached = active === a || active === b;
      const color = clear ? INK.lime : flags[i] ? INK.coral : INK.mint;
      g.lineStyle(this.dpr * (attached ? 4 : flags[i] ? 2.6 : 2.2), color, 1);
      g.lineBetween(from.x, from.y, to.x, to.y);
    });
    this.puzzle.points.forEach((_, id) => {
      const p = this.screen(id), radius = this.radius * this.appearance * (active === id ? 1.15 : 1);
      if (active === id) {
        g.lineStyle(2 * this.dpr, 0xffffff, 1);
        g.strokeCircle(p.x, p.y, radius + 6 * this.dpr);
      }
      g.fillStyle(clear ? INK.lime : INK.node, 1);
      g.fillCircle(p.x, p.y, radius);
      g.lineStyle(2 * this.dpr, 0x0b1418, 1);
      g.strokeCircle(p.x, p.y, radius);
    });
    this.hud.setStatus(tangled);
  }
}
