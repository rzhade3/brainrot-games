import Phaser from 'phaser';
import { COLORS, getRenderScale } from '../../core/createGame';
import { getBestScore, submitScore } from '../../core/scores';

// ── Constants ──────────────────────────────────────────────────────────────

const GAME_MAX_W = 430;
const LANE_PAD = 26;                 // px from screen edge army can reach
const ARMY_SCREEN_Y_RATIO = 0.78;   // army sits this far down the screen
const BASE_MARCH_SPEED = 230;        // px / s at level 1
const MARCH_SPEED_INC = 22;          // added per level
const GATE_H = 78;                   // height of gate frame in px
const SECTION = 340;                 // world-space gap between objects
const ENEMY_RADIUS = 7;              // radius of each enemy unit circle
const BOSS_RADIUS = 50;
const LEVEL_BANNER_MS = 1000;
const COMBAT_MS = 650;               // enemy-wall fight animation duration
const BOSS_FIGHT_MS = 1800;          // boss fight animation duration
const HUB_URL = '../../';
const SCORE_KEY = 'army-rush';

// ── Types ──────────────────────────────────────────────────────────────────

type GamePhase =
  | 'start'
  | 'level_start'
  | 'running'
  | 'combat'
  | 'boss_fight'
  | 'level_complete'
  | 'game_over';

interface Gate {
  op: '+' | '-' | '*' | '/';
  value: number;
  label: string;
  isPositive: boolean;
}

interface WorldGate {
  type: 'gate';
  worldY: number;
  left: Gate;
  right: Gate;
  triggered: boolean;
  chosenSide: 'left' | 'right' | null;
}

interface HordeUnit {
  dx: number;
  dy: number;
  phase: number;   // random phase offset for wobble animation
}

interface WorldEnemies {
  type: 'enemies';
  worldY: number;
  count: number;
  triggered: boolean;
  offsets: HordeUnit[];
}

interface WorldBoss {
  type: 'boss';
  worldY: number;
  hp: number;
  maxHp: number;
  triggered: boolean;
}

type WorldObject = WorldGate | WorldEnemies | WorldBoss;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Sunflower / Fibonacci packing — produces organic cluster positions */
function buildHordeOffsets(n: number, spread: number): HordeUnit[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: HordeUnit[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(i / Math.max(n - 1, 1)) * spread;
    const theta = i * golden;
    out.push({ dx: Math.cos(theta) * r, dy: Math.sin(theta) * r * 0.7, phase: Math.random() * Math.PI * 2 });
  }
  return out;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function makeGate(op: '+' | '-' | '*' | '/', value: number): Gate {
  const label =
    op === '+' ? `+${value}` :
    op === '-' ? `−${value}` :
    op === '*' ? `×${value}` :
    `÷${value}`;
  const isPositive =
    op === '+' ||
    (op === '*' && value > 1) ||
    (op === '/' && value < 1);
  return { op, value, label, isPositive };
}

function applyGate(size: number, gate: Gate): number {
  let r = size;
  if (gate.op === '+') r = size + gate.value;
  else if (gate.op === '-') r = size - gate.value;
  else if (gate.op === '*') r = Math.round(size * gate.value);
  else r = Math.round(size / gate.value);
  return Math.max(1, r);
}

function buildGatePair(level: number, armyEst: number): { left: Gate; right: Gate } {
  const addMax = Math.max(5, Math.min(level * 6, 60));
  const mulMax = Math.min(2 + Math.floor(level / 2), 5);
  const subMax = Math.max(3, Math.min(level * 4, Math.floor(armyEst * 0.5)));
  const divMax = Math.min(2 + Math.floor(level / 3), 4);

  type O = ['+' | '-' | '*' | '/', number];
  const pos: O[] = [['+', randInt(Math.max(2, level), addMax)], ['*', randInt(2, mulMax)]];
  const neg: O[] = [['-', randInt(1, subMax)], ['/', randInt(2, divMax)]];

  const roll = Math.random();
  let L: O, R: O;
  if (roll < 0.4) {
    const s = [...pos].sort(() => Math.random() - 0.5);
    [L, R] = [s[0], s[1]];
  } else if (roll < 0.8) {
    const pi = randInt(0, pos.length - 1);
    const ni = randInt(0, neg.length - 1);
    [L, R] = Math.random() < 0.5 ? [pos[pi], neg[ni]] : [neg[ni], pos[pi]];
  } else {
    const s = [...neg].sort(() => Math.random() - 0.5);
    [L, R] = [s[0], s[1]];
  }

  return { left: makeGate(L[0], L[1]), right: makeGate(R[0], R[1]) };
}

/**
 * Builds a level guaranteed to be passable with optimal play.
 *
 * Algorithm:
 *   1. Generate gate pairs using the player's actual current army for scaling.
 *   2. Simulate the optimal path (always take the numerically better gate).
 *   3. After each gate, cap the enemy-wall count so it never exceeds half
 *      the optimal army, ensuring ≥ half always survives each wall.
 *   4. Set boss HP = 75 % of the optimal army that arrives at the boss
 *      (beatable by anyone who played reasonably, not just perfectly).
 */
function buildLevel(level: number, gameW: number, startArmy: number): WorldObject[] {
  const gateCount = 2 + Math.floor(level / 2);
  const maxCols = Math.floor((gameW - LANE_PAD * 2) / (ENEMY_RADIUS * 2 + 5));

  const gatePairs: { left: Gate; right: Gate }[] = [];
  const enemyCounts: number[] = [];

  // Simulate optimal path while generating, adjusting enemy counts as needed.
  let optArmy = Math.max(startArmy, 1);

  for (let i = 0; i < gateCount; i++) {
    const pair = buildGatePair(level, optArmy);
    gatePairs.push(pair);

    // Optimal choice: whichever gate yields the larger army
    const afterLeft  = applyGate(optArmy, pair.left);
    const afterRight = applyGate(optArmy, pair.right);
    optArmy = Math.max(afterLeft, afterRight);

    // Enemy wall: cap at half the optimal army so the player always survives
    const rawCount = Math.min(4 + level * 2 + i * 2, maxCols * 2);
    const count = Math.max(0, Math.min(rawCount, Math.floor(optArmy / 2)));
    enemyCounts.push(count);
    optArmy -= count;
  }

  // Safety floor so boss HP maths can't go negative
  optArmy = Math.max(optArmy, 2);

  // Boss is strictly beatable with optimal play; requires decent play in practice
  const bossHp = Math.min(Math.floor(optArmy * 0.75), optArmy - 1);

  // Build world objects
  const objects: WorldObject[] = [];
  let y = SECTION * 0.6;

  for (let i = 0; i < gateCount; i++) {
    objects.push({ type: 'gate', worldY: y, left: gatePairs[i].left, right: gatePairs[i].right, triggered: false, chosenSide: null });
    y += SECTION;

    const count = enemyCounts[i];
    const spread = 12 + Math.sqrt(Math.max(count, 1)) * 5;
    objects.push({ type: 'enemies', worldY: y, count, triggered: false, offsets: buildHordeOffsets(count, spread) });
    y += SECTION;
  }

  objects.push({ type: 'boss', worldY: y, hp: bossHp, maxHp: bossHp, triggered: false });
  return objects;
}

// ── Scene ──────────────────────────────────────────────────────────────────

export default class ArmyScene extends Phaser.Scene {
  // Layout
  private gameW = 390;
  private gameH = 700;
  private dpr = 1;
  private armyScreenY = 0;

  // Army control
  private armyX = 195;
  private pointerDown = false;

  // World
  private cameraY = 0;
  private marchSpeed = BASE_MARCH_SPEED;
  private worldObjects: WorldObject[] = [];

  // Horde rendering
  private soldierOffsets: HordeUnit[] = [];
  private elapsed = 0;

  // State
  private phase: GamePhase = 'start';
  private level = 1;
  private armySize = 10;
  private bestScore = 0;
  private phaseTimer = 0;

  // Combat/boss animation
  private flashArmyStart = 0;
  private flashArmyEnd = 0;
  private flashEnemyStart = 0;
  private flashEnemyEnd = 0;
  private flashDuration = COMBAT_MS;
  private flashWin = true;

  // Gate result flash (shown while running, no pause)
  private gateFlashTimer = 0;
  private gateFlashLabel = '';
  private gateFlashColor = '#3ddc97';

  // Graphics layers
  private bgGfx!: Phaser.GameObjects.Graphics;
  private worldGfx!: Phaser.GameObjects.Graphics;
  private armyGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;

  // Text objects
  private armyCountText!: Phaser.GameObjects.Text;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlaySub!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private bestScoreText!: Phaser.GameObjects.Text;
  private gateFlashText!: Phaser.GameObjects.Text;
  private vsText!: Phaser.GameObjects.Text;
  private combatArmyNum!: Phaser.GameObjects.Text;
  private combatEnemyNum!: Phaser.GameObjects.Text;
  private combatArmyLabel!: Phaser.GameObjects.Text;
  private combatEnemyLabel!: Phaser.GameObjects.Text;

  // Label pool (gates, enemy counts, boss hp)
  private labelPool: Phaser.GameObjects.Text[] = [];
  private labelUsed = 0;

  constructor() {
    super('ArmyScene');
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.dpr = getRenderScale();
    this.bestScore = getBestScore(SCORE_KEY);
    this.relayout();

    // Pre-compute soldier positions for max expected army size
    this.soldierOffsets = buildHordeOffsets(150, 42);

    this.bgGfx = this.add.graphics().setDepth(0);
    this.worldGfx = this.add.graphics().setDepth(1);
    this.armyGfx = this.add.graphics().setDepth(2);
    this.overlayGfx = this.add.graphics().setDepth(4);

    const base: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#f5f3ff',
    };

    this.armyCountText = this.add.text(0, 0, '', { ...base, fontSize: '38px', fontStyle: 'bold', color: '#00e5ff' }).setOrigin(0.5, 1).setDepth(3);
    this.levelText = this.add.text(0, 0, '', { ...base, fontSize: '17px', color: '#a99fd6' }).setOrigin(0, 0).setDepth(3);
    this.bestScoreText = this.add.text(0, 0, '', { ...base, fontSize: '15px', color: '#a99fd6' }).setOrigin(1, 0).setDepth(3);
    this.gateFlashText = this.add.text(0, 0, '', { ...base, fontSize: '30px', fontStyle: 'bold' }).setOrigin(0.5, 0.5).setDepth(3).setVisible(false);

    this.overlayTitle = this.add.text(0, 0, '', { ...base, fontSize: '46px', fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0.5).setDepth(5);
    this.overlaySub = this.add.text(0, 0, '', { ...base, fontSize: '19px', color: '#a99fd6', align: 'center' }).setOrigin(0.5, 0.5).setDepth(5);

    this.vsText = this.add.text(0, 0, '⚔', { ...base, fontSize: '40px' }).setOrigin(0.5, 0.5).setDepth(5).setVisible(false);
    this.combatArmyNum = this.add.text(0, 0, '', { ...base, fontSize: '58px', fontStyle: 'bold', color: '#00e5ff' }).setOrigin(0.5, 0.5).setDepth(5).setVisible(false);
    this.combatEnemyNum = this.add.text(0, 0, '', { ...base, fontSize: '58px', fontStyle: 'bold', color: '#ff2e97' }).setOrigin(0.5, 0.5).setDepth(5).setVisible(false);
    this.combatArmyLabel = this.add.text(0, 0, 'YOUR ARMY', { ...base, fontSize: '13px', color: '#00e5ff' }).setOrigin(0.5, 0.5).setDepth(5).setVisible(false);
    this.combatEnemyLabel = this.add.text(0, 0, 'ENEMY', { ...base, fontSize: '13px', color: '#ff2e97' }).setOrigin(0.5, 0.5).setDepth(5).setVisible(false);

    this.add
      .text(12, 14, '← Hub', { ...base, fontSize: '15px', color: '#a99fd6', backgroundColor: '#1b1035', padding: { x: 8, y: 4 } })
      .setDepth(6)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { window.location.href = HUB_URL; });

    this.scale.on('resize', () => this.relayout());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerDown = true;
      this.updateArmyX(p.x);
      this.onTap(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pointerDown) this.updateArmyX(p.x);
    });
    this.input.on('pointerup', () => { this.pointerDown = false; });

    this.transitionTo('start');
  }

  private relayout(): void {
    const newW = Math.min(Math.floor(this.scale.width / this.dpr), GAME_MAX_W);
    if (newW !== this.gameW && this.gameW > 0) {
      this.armyX = clamp((this.armyX / this.gameW) * newW, LANE_PAD, newW - LANE_PAD);
    }
    this.gameW = newW;
    this.gameH = Math.floor(this.scale.height / this.dpr);
    this.armyScreenY = Math.floor(this.gameH * ARMY_SCREEN_Y_RATIO);
  }

  private updateArmyX(rawPx: number): void {
    this.armyX = clamp(rawPx / this.dpr, LANE_PAD + 8, this.gameW - LANE_PAD - 8);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    this.relayout();

    switch (this.phase) {
      case 'level_start':   this.tickLevelStart(dt); break;
      case 'running':       this.tickRunning(dt);    break;
      case 'combat':        this.tickCombat(dt);     break;
      case 'boss_fight':    this.tickBossFight(dt);  break;
      case 'level_complete':this.phaseTimer += dt * 1000; break;
    }

    this.render();
  }

  // ── Phase transitions ──────────────────────────────────────────────────────

  private transitionTo(next: GamePhase): void {
    this.phase = next;
    this.phaseTimer = 0;

    // Hide all overlays first
    this.overlayTitle.setVisible(false);
    this.overlaySub.setVisible(false);
    this.vsText.setVisible(false);
    this.combatArmyNum.setVisible(false);
    this.combatEnemyNum.setVisible(false);
    this.combatArmyLabel.setVisible(false);
    this.combatEnemyLabel.setVisible(false);
    this.gateFlashText.setVisible(false);

    switch (next) {
      case 'start':          this.enterStart();         break;
      case 'level_start':    this.enterLevelStart();    break;
      case 'running':        /* army just marches */    break;
      case 'level_complete': this.enterLevelComplete(); break;
      case 'game_over':      this.enterGameOver();      break;
    }
  }

  // ── Start screen ───────────────────────────────────────────────────────────

  private enterStart(): void {
    this.armySize = 10;
    this.level = 1;
    this.armyX = this.gameW / 2;
    this.cameraY = 0;
    this.worldObjects = [];
    this.gateFlashTimer = 0;
    this.bestScore = getBestScore(SCORE_KEY);

    this.overlayTitle.setText('ARMY RUSH').setStyle({ fontSize: '52px', fontStyle: 'bold', color: '#00e5ff' }).setVisible(true);
    this.overlaySub.setText('Drag to steer through gates\nRun into enemies to fight\nDefeat the boss to advance\n\nTap to start').setStyle({ fontSize: '18px', color: '#a99fd6' }).setVisible(true);
  }

  // ── Level start ────────────────────────────────────────────────────────────

  private enterLevelStart(): void {
    this.cameraY = 0;
    this.gateFlashTimer = 0;
    this.worldObjects = buildLevel(this.level, this.gameW, this.armySize);
    this.marchSpeed = BASE_MARCH_SPEED + (this.level - 1) * MARCH_SPEED_INC;

    this.overlayTitle.setText(`LEVEL ${this.level}`).setStyle({ fontSize: '52px', fontStyle: 'bold', color: '#b958ff' }).setVisible(true);
    this.overlaySub.setText(`Army: ${this.armySize}`).setStyle({ fontSize: '22px', color: '#a99fd6' }).setVisible(true);
  }

  private tickLevelStart(dt: number): void {
    this.phaseTimer += dt * 1000;
    if (this.phaseTimer >= LEVEL_BANNER_MS) this.transitionTo('running');
  }

  // ── Running ────────────────────────────────────────────────────────────────

  private tickRunning(dt: number): void {
    this.cameraY += this.marchSpeed * dt;

    // Tick gate flash
    if (this.gateFlashTimer > 0) {
      this.gateFlashTimer -= dt * 1000;
      if (this.gateFlashTimer <= 0) this.gateFlashText.setVisible(false);
    }

    // Trigger world objects when army reaches them
    for (const obj of this.worldObjects) {
      if (obj.triggered) continue;
      if (this.cameraY >= obj.worldY) {
        obj.triggered = true;
        if (obj.type === 'gate')    this.triggerGate(obj);
        if (obj.type === 'enemies') this.triggerEnemies(obj);
        if (obj.type === 'boss')    this.triggerBoss(obj);
      }
    }
  }

  private triggerGate(gate: WorldGate): void {
    const lx = this.gameW * 0.25;
    const rx = this.gameW * 0.75;
    const side = Math.abs(this.armyX - lx) <= Math.abs(this.armyX - rx) ? 'left' : 'right';
    gate.chosenSide = side;
    const chosen = side === 'left' ? gate.left : gate.right;
    const before = this.armySize;
    this.armySize = applyGate(this.armySize, chosen);

    // Brief non-blocking flash
    this.gateFlashLabel = `${chosen.label}  →  ${this.armySize}`;
    this.gateFlashColor = this.armySize >= before ? '#3ddc97' : '#ff2e97';
    this.gateFlashTimer = 750;
    this.gateFlashText
      .setText(this.gateFlashLabel)
      .setStyle({ color: this.gateFlashColor, fontSize: '30px' })
      .setPosition(this.gameW / 2, this.armyScreenY - 65)
      .setVisible(true);
  }

  private triggerEnemies(wall: WorldEnemies): void {
    // Empty wall (capped to 0 by level builder) — just pass through
    if (wall.count <= 0) return;

    this.flashArmyStart  = this.armySize;
    this.flashEnemyStart = wall.count;
    this.flashDuration   = COMBAT_MS;

    if (this.armySize > wall.count) {
      this.flashArmyEnd  = this.armySize - wall.count;
      this.flashEnemyEnd = 0;
      this.flashWin = true;
    } else {
      this.flashArmyEnd  = 0;
      this.flashEnemyEnd = wall.count - this.armySize;
      this.flashWin = false;
    }

    this.combatEnemyLabel.setText('ENEMIES');
    this.transitionTo('combat');
  }

  private triggerBoss(boss: WorldBoss): void {
    this.flashArmyStart  = this.armySize;
    this.flashEnemyStart = boss.hp;
    this.flashDuration   = BOSS_FIGHT_MS;

    if (this.armySize > boss.hp) {
      this.flashArmyEnd  = this.armySize - boss.hp;
      this.flashEnemyEnd = 0;
      this.flashWin = true;
    } else {
      this.flashArmyEnd  = 0;
      this.flashEnemyEnd = boss.hp - this.armySize;
      this.flashWin = false;
    }

    this.combatEnemyLabel.setText('BOSS');
    this.transitionTo('boss_fight');
  }

  // ── Combat animation ───────────────────────────────────────────────────────

  private tickCombat(dt: number): void {
    this.phaseTimer += dt * 1000;
    const t = Math.min(this.phaseTimer / this.flashDuration, 1);

    const armyNow   = Math.round(this.flashArmyStart  + (this.flashArmyEnd  - this.flashArmyStart)  * t);
    const enemyNow  = Math.round(this.flashEnemyStart + (this.flashEnemyEnd - this.flashEnemyStart) * t);
    this.updateCombatTexts(armyNow, enemyNow);

    if (this.phaseTimer >= this.flashDuration) {
      this.armySize = this.flashArmyEnd;
      this.transitionTo(this.flashWin ? 'running' : 'game_over');
    }
  }

  private tickBossFight(dt: number): void {
    this.phaseTimer += dt * 1000;
    const t = Math.min(this.phaseTimer / this.flashDuration, 1);

    const armyNow  = Math.round(this.flashArmyStart  + (this.flashArmyEnd  - this.flashArmyStart)  * t);
    const enemyNow = Math.round(this.flashEnemyStart + (this.flashEnemyEnd - this.flashEnemyStart) * t);
    this.updateCombatTexts(armyNow, enemyNow);

    if (this.phaseTimer >= this.flashDuration) {
      this.armySize = this.flashArmyEnd;
      if (this.flashWin) {
        this.bestScore = submitScore(SCORE_KEY, this.level);
        this.transitionTo('level_complete');
      } else {
        this.transitionTo('game_over');
      }
    }
  }

  private updateCombatTexts(armyNow: number, enemyNow: number): void {
    const cx = this.gameW / 2;
    const cy = this.gameH / 2;

    this.combatArmyNum.setText(String(armyNow)).setPosition(cx * 0.45, cy).setVisible(true);
    this.combatEnemyNum.setText(String(enemyNow)).setPosition(cx + cx * 0.55, cy).setVisible(true);
    this.vsText.setPosition(cx, cy).setVisible(true);
    this.combatArmyLabel.setPosition(cx * 0.45, cy - 52).setVisible(true);
    this.combatEnemyLabel.setPosition(cx + cx * 0.55, cy - 52).setVisible(true);
  }

  // ── Level complete / game over ─────────────────────────────────────────────

  private enterLevelComplete(): void {
    this.overlayTitle.setText(`LEVEL ${this.level}\nCLEARED! 🎉`)
      .setStyle({ fontSize: '42px', fontStyle: 'bold', color: '#3ddc97' }).setVisible(true);
    this.overlaySub.setText(`Army: ${this.armySize}\n\nTap to continue`)
      .setStyle({ fontSize: '20px', color: '#a99fd6' }).setVisible(true);
  }

  private enterGameOver(): void {
    this.bestScore = submitScore(SCORE_KEY, this.level - 1);
    this.overlayTitle.setText('GAME OVER')
      .setStyle({ fontSize: '52px', fontStyle: 'bold', color: '#ff2e97' }).setVisible(true);
    this.overlaySub.setText(`Reached Level ${this.level}\nArmy: ${this.armySize}\nBest: ${this.bestScore} levels\n\nTap to restart`)
      .setStyle({ fontSize: '19px', color: '#a99fd6' }).setVisible(true);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onTap(p: Phaser.Input.Pointer): void {
    const px = p.x / this.dpr;
    if (px < 80 && p.y / this.dpr < 50) return;

    switch (this.phase) {
      case 'start':
        this.level = 1;
        this.armySize = 10;
        this.armyX = this.gameW / 2;
        this.transitionTo('level_start');
        break;
      case 'level_complete':
        if (this.phaseTimer >= 600) {
          this.level++;
          this.armyX = this.gameW / 2;
          this.transitionTo('level_start');
        }
        break;
      case 'game_over':
        this.level = 1;
        this.armySize = 10;
        this.armyX = this.gameW / 2;
        this.transitionTo('start');
        break;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  private render(): void {
    this.bgGfx.clear();
    this.worldGfx.clear();
    this.armyGfx.clear();
    this.overlayGfx.clear();

    this.drawBackground();

    const showWorld = this.phase === 'running' || this.phase === 'combat' ||
                      this.phase === 'boss_fight' || this.phase === 'level_start';
    if (showWorld) {
      this.beginLabels();
      this.drawWorldObjects();
      this.drawArmy();
    } else {
      this.beginLabels(); // hide all pooled labels
    }

    const isFight = this.phase === 'combat' || this.phase === 'boss_fight';
    if (isFight) this.drawFightOverlay();

    this.drawHud();

    // Position overlay texts
    const cx = this.gameW / 2;
    const cy = this.gameH / 2;
    this.overlayTitle.setPosition(cx, cy - 60);
    this.overlaySub.setPosition(cx, cy + 55);
    this.levelText.setPosition(12, this.gameH - 36);
    this.bestScoreText.setPosition(this.gameW - 12, 14);
  }

  private drawBackground(): void {
    this.bgGfx.fillStyle(COLORS.bg);
    this.bgGfx.fillRect(0, 0, this.gameW, this.gameH);

    // Scrolling dot grid — gives sense of forward motion
    const interval = 54;
    const cols = Math.ceil(this.gameW / interval) + 1;
    const rows = Math.ceil(this.gameH / interval) + 2;
    const offsetY = this.cameraY % interval;
    this.bgGfx.fillStyle(COLORS.bgSoft, 0.55);
    for (let r = -1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.bgGfx.fillCircle(c * interval, r * interval - offsetY, 1.5);
      }
    }

    // Lane edge lines
    this.bgGfx.lineStyle(1, COLORS.muted, 0.16);
    this.bgGfx.beginPath();
    this.bgGfx.moveTo(LANE_PAD, 0);
    this.bgGfx.lineTo(LANE_PAD, this.gameH);
    this.bgGfx.moveTo(this.gameW - LANE_PAD, 0);
    this.bgGfx.lineTo(this.gameW - LANE_PAD, this.gameH);
    this.bgGfx.strokePath();

    // Army zone tint
    this.bgGfx.fillStyle(COLORS.bgSoft, 0.22);
    this.bgGfx.fillRect(0, this.armyScreenY + 8, this.gameW, this.gameH - this.armyScreenY - 8);
  }

  // screen Y of a world object given current cameraY
  private objScreenY(worldY: number): number {
    // army is at armyScreenY on screen; army's worldY = cameraY.
    // object ahead: worldY > cameraY → screenY < armyScreenY (above army).
    return this.armyScreenY - (worldY - this.cameraY);
  }

  private drawWorldObjects(): void {
    for (const obj of this.worldObjects) {
      const sy = this.objScreenY(obj.worldY);
      if (sy < -(BOSS_RADIUS + GATE_H) || sy > this.gameH + BOSS_RADIUS) continue;
      if (obj.type === 'gate')    this.drawGate(obj, sy);
      if (obj.type === 'enemies') this.drawEnemyWall(obj, sy);
      if (obj.type === 'boss')    this.drawBossMarker(obj, sy);
    }
  }

  private drawGate(gate: WorldGate, sy: number): void {
    const gw = Math.floor(this.gameW / 2 - LANE_PAD - 4);
    const gh = GATE_H;
    const y  = sy - gh / 2;
    const lx = LANE_PAD;
    const rx = this.gameW / 2 + 4;

    const lCX = lx + gw / 2;
    const rCX = rx + gw / 2;
    const targetLeft = !gate.triggered &&
      Math.abs(this.armyX - lCX) < Math.abs(this.armyX - rCX);

    const sides: Array<{ x: number; g: Gate; targeted: boolean }> = [
      { x: lx, g: gate.left,  targeted: targetLeft },
      { x: rx, g: gate.right, targeted: !targetLeft },
    ];

    for (const { x, g, targeted } of sides) {
      const color = g.isPositive ? COLORS.good : COLORS.bad;
      const fa = gate.triggered ? 0.06 : targeted ? 0.32 : 0.10;
      const sa = gate.triggered ? 0.2  : targeted ? 1.0  : 0.4;
      const sw = targeted ? 3 : 1.5;

      this.worldGfx.fillStyle(color, fa);
      this.worldGfx.fillRoundedRect(x, y, gw, gh, 10);
      this.worldGfx.lineStyle(sw, color, sa);
      this.worldGfx.strokeRoundedRect(x, y, gw, gh, 10);

      // Posts above and below gate
      this.worldGfx.lineStyle(2, color, sa * 0.45);
      this.worldGfx.beginPath();
      this.worldGfx.moveTo(x,      y - 30); this.worldGfx.lineTo(x,      y);
      this.worldGfx.moveTo(x + gw, y - 30); this.worldGfx.lineTo(x + gw, y);
      this.worldGfx.moveTo(x,      y + gh); this.worldGfx.lineTo(x,      y + gh + 30);
      this.worldGfx.moveTo(x + gw, y + gh); this.worldGfx.lineTo(x + gw, y + gh + 30);
      this.worldGfx.strokePath();
    }

    // Guide line from army to targeted gate
    if (!gate.triggered) {
      const targetCX = targetLeft ? lCX : rCX;
      this.worldGfx.lineStyle(1.5, COLORS.node, 0.22);
      this.worldGfx.beginPath();
      this.worldGfx.moveTo(this.armyX, this.armyScreenY - 18);
      this.worldGfx.lineTo(targetCX, y + gh + 30);
      this.worldGfx.strokePath();
    }

    // Gate labels
    const lLabel = this.getLabel();
    lLabel.setText(gate.left.label)
      .setPosition(lx + gw / 2, sy)
      .setStyle({ color: gate.left.isPositive ? '#3ddc97' : '#ff2e97', fontSize: '26px', fontStyle: 'bold' });

    const rLabel = this.getLabel();
    rLabel.setText(gate.right.label)
      .setPosition(rx + gw / 2, sy)
      .setStyle({ color: gate.right.isPositive ? '#3ddc97' : '#ff2e97', fontSize: '26px', fontStyle: 'bold' });
  }

  private drawEnemyWall(wall: WorldEnemies, sy: number): void {
    if (wall.triggered) return;
    const cx = this.gameW / 2;
    const t = this.elapsed;

    for (let i = 0; i < wall.offsets.length; i++) {
      const o = wall.offsets[i];
      const wobble = Math.sin(t * 2.8 + o.phase) * 2;
      const ex = cx + o.dx;
      const ey = sy + o.dy + wobble;
      this.worldGfx.fillStyle(COLORS.bad, 0.92);
      this.worldGfx.fillCircle(ex, ey, ENEMY_RADIUS);
      this.worldGfx.fillStyle(0xffffff, 0.2);
      this.worldGfx.fillCircle(ex - 1.2, ey - 1.5, 2.5);
    }

    // Count label above cluster
    const topY = sy + wall.offsets.reduce((m, o) => Math.min(m, o.dy), 0) - ENEMY_RADIUS - 6;
    const lbl = this.getLabel();
    lbl.setText(String(wall.count))
      .setPosition(cx, topY)
      .setStyle({ color: '#ff2e97', fontSize: '22px', fontStyle: 'bold' });
  }

  private drawBossMarker(boss: WorldBoss, sy: number): void {
    if (boss.triggered) return;
    const r = BOSS_RADIUS;

    this.worldGfx.lineStyle(6, 0xff4400, 0.18);
    this.worldGfx.strokeCircle(this.gameW / 2, sy, r + 16);

    this.worldGfx.fillStyle(0xcc2200, 0.95);
    this.worldGfx.fillCircle(this.gameW / 2, sy, r);
    this.worldGfx.lineStyle(3, 0xff4400, 0.9);
    this.worldGfx.strokeCircle(this.gameW / 2, sy, r);

    // HP bar
    const bw = r * 3;
    const bh = 8;
    const bx = this.gameW / 2 - bw / 2;
    const by = sy - r - 20;
    this.worldGfx.fillStyle(0x3a1a2e, 0.9);
    this.worldGfx.fillRect(bx, by, bw, bh);
    this.worldGfx.fillStyle(0xff4400, 0.9);
    this.worldGfx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), bh);

    const lbl = this.getLabel();
    lbl.setText(`💀  ${boss.hp} HP`)
      .setPosition(this.gameW / 2, by - 10)
      .setStyle({ color: '#ffcc66', fontSize: '14px', fontStyle: 'normal' });
  }

  private drawArmy(): void {
    const cx = this.armyX;
    const cy = this.armyScreenY + 18;
    const visible = Math.min(this.armySize, this.soldierOffsets.length);
    const t = this.elapsed;

    for (let i = 0; i < visible; i++) {
      const o = this.soldierOffsets[i];
      const wobble = Math.sin(t * 3.5 + o.phase) * 1.8;
      const ex = cx + o.dx;
      const ey = cy + o.dy + wobble;
      this.armyGfx.fillStyle(COLORS.node, 0.92);
      this.armyGfx.fillCircle(ex, ey, 5);
      // Lighter highlight dot
      this.armyGfx.fillStyle(0xffffff, 0.3);
      this.armyGfx.fillCircle(ex - 1.2, ey - 1.5, 2);
    }

    const showCount = this.phase !== 'start' && this.phase !== 'game_over';
    this.armyCountText.setText(String(this.armySize)).setPosition(cx, this.armyScreenY - 38).setVisible(showCount);
  }

  // ── Fight overlay (drawn on top during combat / boss_fight) ───────────────

  private drawFightOverlay(): void {
    // Dark tint over the world
    this.overlayGfx.fillStyle(0x000000, 0.52);
    this.overlayGfx.fillRect(0, 0, this.gameW, this.gameH);

    // Title
    const isBoss = this.phase === 'boss_fight';
    const title = isBoss ? '💀  BOSS FIGHT!' : '⚔  FIGHT!';
    const titleColor = isBoss ? '#ff6600' : '#ffcc66';
    const cy = this.gameH / 2;
    const cx = this.gameW / 2;

    // Draw title via uiGfx — but we use the overlayTitle text object instead
    this.overlayTitle
      .setText(title)
      .setStyle({ fontSize: isBoss ? '36px' : '38px', fontStyle: 'bold', color: titleColor })
      .setPosition(cx, cy - 100)
      .setVisible(true);
  }

  private drawHud(): void {
    const active = this.phase !== 'start';
    this.levelText.setText(`Level ${this.level}`).setVisible(active);
    this.bestScoreText.setText(this.bestScore > 0 ? `Best: ${this.bestScore}` : '').setVisible(true);
  }

  // ── Label pool ─────────────────────────────────────────────────────────────

  private beginLabels(): void {
    this.labelUsed = 0;
    for (const t of this.labelPool) t.setVisible(false);
  }

  private getLabel(): Phaser.GameObjects.Text {
    if (this.labelUsed < this.labelPool.length) {
      const t = this.labelPool[this.labelUsed++];
      t.setVisible(true);
      return t;
    }
    const t = this.add.text(0, 0, '', {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f5f3ff',
    }).setOrigin(0.5, 0.5).setDepth(2);
    this.labelPool.push(t);
    this.labelUsed++;
    return t;
  }
}
