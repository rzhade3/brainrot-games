import Phaser from 'phaser';
import { COLORS, getRenderScale } from '../../core/createGame';
import { submitScore } from '../../core/scores';
import { Grid, GridLayout, tileCenter, worldToTile } from './grid';
import { Building, BuildingKind, BuildingManager, BUILDINGS } from './buildings';
import { Economy } from './economy';
import { Enemy } from './enemies';
import { WaveManager } from './waves';
import type { Hud } from './hud';

const HUB_URL = '../../';
const COLS = 13;
const ROWS = 13;
const STARTING_ORE = 60;
const CASTLE_MAX_HP = 300;

interface Shot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

/**
 * Castle Defense: a Factorio-flavoured tower defense. Mine ore with miners on
 * ore patches, power miners/turrets with generators, and defend a central
 * castle against escalating enemy waves. All simulation runs in `update`; the
 * DOM HUD renders resource/wave UI and captures build intent.
 */
export default class TowerDefenseScene extends Phaser.Scene {
  private hud!: Hud;
  private grid!: Grid;
  private buildings!: BuildingManager;
  private economy!: Economy;
  private waves!: WaveManager;

  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private castleHp = CASTLE_MAX_HP;
  private gameOver = false;

  private layout: GridLayout = { originX: 0, originY: 0, tile: 32 };
  private dpr = 1;

  private gridGfx!: Phaser.GameObjects.Graphics;
  private dynGfx!: Phaser.GameObjects.Graphics;
  private castleText!: Phaser.GameObjects.Text;
  private buildingTexts = new Map<Building, Phaser.GameObjects.Text>();

  private selectedKind: BuildingKind | null = null;
  private hoverTile = { c: -1, r: -1 };

  constructor() {
    super('TowerDefenseScene');
  }

  create(): void {
    this.dpr = getRenderScale();
    this.hud = this.registry.get('hud') as Hud;

    this.gridGfx = this.add.graphics().setDepth(0);
    this.dynGfx = this.add.graphics().setDepth(1);
    this.castleText = this.add.text(0, 0, '🏰', {}).setOrigin(0.5).setDepth(2);

    this.hud.onSelectBuild = (kind) => this.toggleBuild(kind);
    this.hud.onStartWave = () => this.waves.startWave();
    this.hud.onRestart = () => this.resetGame();
    this.hud.onHub = () => {
      window.location.href = HUB_URL;
    };

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));

    this.scale.on('resize', () => this.relayout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hud?.destroy());

    this.resetGame();
  }

  private resetGame(): void {
    this.grid = Grid.generate(COLS, ROWS);
    this.buildings = new BuildingManager();
    this.economy = new Economy(STARTING_ORE);
    this.waves = new WaveManager(COLS, ROWS);
    this.enemies = [];
    this.shots = [];
    this.castleHp = CASTLE_MAX_HP;
    this.gameOver = false;
    this.selectedKind = null;

    for (const t of this.buildingTexts.values()) t.destroy();
    this.buildingTexts.clear();

    this.hud.hideGameOver();
    this.relayout();
    this.syncHud();
  }

  // ── Layout ────────────────────────────────────────────
  private relayout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const top = 150 * this.dpr;
    const bottom = 150 * this.dpr;
    const side = 12 * this.dpr;
    const availW = Math.max(1, W - 2 * side);
    const availH = Math.max(1, H - top - bottom);

    const tile = Math.max(8, Math.floor(Math.min(availW / COLS, availH / ROWS)));
    const gridW = tile * COLS;
    const gridH = tile * ROWS;
    this.layout = {
      tile,
      originX: (W - gridW) / 2,
      originY: top + Math.max(0, (availH - gridH) / 2),
    };

    this.drawTerrain();
    this.repositionSprites();
  }

  private repositionSprites(): void {
    const fs = `${Math.round(this.layout.tile * 0.62)}px`;
    const castle = tileCenter(this.layout, this.grid.castle.c, this.grid.castle.r);
    this.castleText.setPosition(castle.x, castle.y).setFontSize(fs);
    for (const [b, t] of this.buildingTexts) {
      const p = tileCenter(this.layout, b.c, b.r);
      t.setPosition(p.x, p.y).setFontSize(fs);
    }
  }

  private drawTerrain(): void {
    const g = this.gridGfx;
    const { tile, originX, originY } = this.layout;
    g.clear();
    this.grid.forEach((c, r, type) => {
      const x = originX + c * tile;
      const y = originY + r * tile;
      let fill = COLORS.bgSoft;
      if (type === 'ore') fill = 0x4a3a12;
      else if (type === 'castle') fill = 0x3a1a6a;
      g.fillStyle(fill, 1);
      g.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      if (type === 'ore') {
        g.fillStyle(0xffb020, 0.9);
        g.fillCircle(x + tile / 2, y + tile / 2, tile * 0.16);
      }
    });
  }

  // ── Input ─────────────────────────────────────────────
  private toggleBuild(kind: BuildingKind): void {
    this.selectedKind = this.selectedKind === kind ? null : kind;
    this.syncHud();
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    this.hoverTile = worldToTile(this.layout, p.x, p.y);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.gameOver) return;
    const { c, r } = worldToTile(this.layout, p.x, p.y);
    this.hoverTile = { c, r };
    if (!this.selectedKind) return;

    const kind = this.selectedKind;
    if (this.buildings.validate(this.grid, kind, c, r) !== null) return;
    if (!this.economy.canAfford(BUILDINGS[kind].cost)) return;

    this.economy.spend(BUILDINGS[kind].cost);
    const b = this.buildings.place(kind, c, r);
    const pos = tileCenter(this.layout, c, r);
    const t = this.add
      .text(pos.x, pos.y, b.def.emoji, { fontSize: `${Math.round(this.layout.tile * 0.62)}px` })
      .setOrigin(0.5)
      .setDepth(2);
    this.buildingTexts.set(b, t);
    this.syncHud();
  }

  private removeBuilding(b: Building): void {
    this.buildings.remove(b);
    const t = this.buildingTexts.get(b);
    if (t) {
      t.destroy();
      this.buildingTexts.delete(b);
    }
  }

  // ── Simulation ────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.gameOver) {
      this.render();
      return;
    }
    const dt = Math.min(delta / 1000, 0.05);

    this.buildings.tick(this.economy, dt);
    const cleared = this.waves.update(dt, this.enemies);
    if (cleared) this.economy.addOre(20 + this.waves.number * 5);

    this.updateEnemies(dt);
    this.updateTurrets();
    this.reapEnemies();

    for (const s of this.shots) s.life -= dt;
    this.shots = this.shots.filter((s) => s.life > 0);

    if (this.castleHp <= 0) {
      this.endGame();
      return;
    }

    this.syncHud();
    this.render();
  }

  private updateEnemies(dt: number): void {
    const cx = this.grid.castle.c + 0.5;
    const cy = this.grid.castle.r + 0.5;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      let dx = cx - e.x;
      let dy = cy - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist;
      dy /= dist;

      const step = e.speed * dt;
      const nx = e.x + dx * step;
      const ny = e.y + dy * step;
      const tc = Math.floor(nx);
      const tr = Math.floor(ny);

      if (tc === this.grid.castle.c && tr === this.grid.castle.r) {
        this.castleHp -= e.dps * dt;
        continue; // hold at the wall of the castle
      }
      const blocker = this.buildings.at(tc, tr);
      if (blocker) {
        blocker.hp -= e.dps * dt;
        if (blocker.hp <= 0) this.removeBuilding(blocker);
        continue;
      }
      e.x = nx;
      e.y = ny;
    }
  }

  private updateTurrets(): void {
    const throttle = this.economy.throttle;
    for (const b of this.buildings.all) {
      if (b.kind !== 'turret') continue;
      if (b.cooldown > 0) continue;
      const effRate = b.def.fireRate * throttle;
      if (effRate <= 0) continue;

      const tx = b.c + 0.5;
      const ty = b.r + 0.5;
      let best: Enemy | null = null;
      let bestD = b.def.range;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - tx, e.y - ty);
        if (d <= bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) continue;

      best.hp -= b.def.damage;
      if (best.hp <= 0) {
        best.alive = false;
        this.economy.addOre(best.reward);
      }
      b.cooldown = 1 / effRate;

      const from = tileCenter(this.layout, b.c, b.r);
      const to = {
        x: this.layout.originX + best.x * this.layout.tile,
        y: this.layout.originY + best.y * this.layout.tile,
      };
      this.shots.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, life: 0.08 });
    }
  }

  private reapEnemies(): void {
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private endGame(): void {
    this.gameOver = true;
    this.castleHp = 0;
    const survived = this.waves.phase === 'wave' ? Math.max(0, this.waves.number - 1) : this.waves.number;
    const best = submitScore('tower-defense', survived);
    this.syncHud();
    this.render();
    this.hud.showGameOver(survived, best);
  }

  // ── HUD + rendering ───────────────────────────────────
  private syncHud(): void {
    this.hud.setOre(this.economy.ore);
    this.hud.setEnergy(this.economy.energyProduced, this.economy.energyDemand);
    this.hud.setWave(this.waves.number, this.waves.phase, this.waves.prepTimeLeft, this.enemies.length);
    this.hud.setCastleHp(this.castleHp, CASTLE_MAX_HP);
    this.hud.updateBuildMenu(this.economy.ore, this.selectedKind);
  }

  private render(): void {
    const g = this.dynGfx;
    const { tile, originX, originY } = this.layout;
    g.clear();

    // Placement preview.
    if (this.selectedKind && this.grid.inBounds(this.hoverTile.c, this.hoverTile.r)) {
      const { c, r } = this.hoverTile;
      const valid =
        this.buildings.validate(this.grid, this.selectedKind, c, r) === null &&
        this.economy.canAfford(BUILDINGS[this.selectedKind].cost);
      const color = valid ? COLORS.good : COLORS.bad;
      g.lineStyle(Math.max(2, tile * 0.06), color, 0.95);
      g.strokeRect(originX + c * tile + 1, originY + r * tile + 1, tile - 2, tile - 2);
      if (valid && BUILDINGS[this.selectedKind].range > 0) {
        g.lineStyle(1, COLORS.node, 0.35);
        g.strokeCircle(originX + (c + 0.5) * tile, originY + (r + 0.5) * tile, BUILDINGS[this.selectedKind].range * tile);
      }
    }

    // Building tiles + damage bars.
    for (const b of this.buildings.all) {
      const x = originX + b.c * tile;
      const y = originY + b.r * tile;
      g.fillStyle(0x2a1a55, 1);
      g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      if (b.hp < b.def.maxHp) {
        const pct = Math.max(0, b.hp / b.def.maxHp);
        g.fillStyle(0x000000, 0.5);
        g.fillRect(x + 3, y + tile - 6, tile - 6, 3);
        g.fillStyle(COLORS.good, 1);
        g.fillRect(x + 3, y + tile - 6, (tile - 6) * pct, 3);
      }
    }

    // Enemies.
    const rad = tile * 0.26;
    for (const e of this.enemies) {
      const ex = originX + e.x * tile;
      const ey = originY + e.y * tile;
      g.fillStyle(COLORS.bad, 1);
      g.fillCircle(ex, ey, rad);
      g.fillStyle(0x2a0010, 1);
      g.fillCircle(ex, ey, rad * 0.45);
      const pct = Math.max(0, e.hp / e.maxHp);
      if (pct < 1) {
        g.fillStyle(0x000000, 0.6);
        g.fillRect(ex - rad, ey - rad - 5, rad * 2, 3);
        g.fillStyle(COLORS.node, 1);
        g.fillRect(ex - rad, ey - rad - 5, rad * 2 * pct, 3);
      }
    }

    // Turret shots.
    for (const s of this.shots) {
      g.lineStyle(Math.max(2, tile * 0.06), COLORS.node, s.life / 0.08);
      g.lineBetween(s.x1, s.y1, s.x2, s.y2);
    }
  }
}
