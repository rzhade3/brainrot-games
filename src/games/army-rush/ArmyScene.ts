import Phaser from 'phaser';
import { COLORS, getRenderScale } from '../../core/createGame';
import { getBestScore, submitScore } from '../../core/scores';

// ── Constants ──────────────────────────────────────────────────────────────

const GAME_MAX_W = 430;
const ARMY_BOTTOM_MARGIN = 90; // px from bottom
const BULLET_SPEED = 500; // px/s
const SHOOT_INTERVAL = 220; // ms between volleys
const GATE_DESCENT_SPEED = 130; // px/s
const GATE_HALT_Y_OFFSET = 220; // halts this far above army
const GATE_W = 150;
const GATE_H = 70;
const ENEMY_RADIUS = 18;
const BOSS_RADIUS = 42;
const BOSS_SPEED = 28;
const ENEMY_SPACING_X = 52;
const ENEMY_SPACING_Y = 52;
const LEVEL_BANNER_DURATION = 1800; // ms

const HUB_URL = '../../';
const SCORE_KEY = 'army-rush';

type GamePhase =
  | 'start'
  | 'level_start'
  | 'gates'
  | 'combat'
  | 'boss'
  | 'level_complete'
  | 'game_over';

interface Gate {
  op: '+' | '-' | '*' | '/';
  value: number;
  label: string;
  isPositive: boolean;
  x: number; // center x
  y: number;
}

interface GatePair {
  left: Gate;
  right: Gate;
}

interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  dead: boolean;
}

interface Boss {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  dead: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vy: number; // velocity y (negative = upward)
  dead: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function applyGate(armySize: number, gate: Gate): number {
  let result = armySize;
  switch (gate.op) {
    case '+':
      result = armySize + gate.value;
      break;
    case '-':
      result = armySize - gate.value;
      break;
    case '*':
      result = Math.round(armySize * gate.value);
      break;
    case '/':
      result = Math.round(armySize / gate.value);
      break;
  }
  return Math.max(1, result);
}

function gateIsPositive(op: string, value: number): boolean {
  if (op === '+') return true;
  if (op === '-') return false;
  if (op === '*') return value > 1;
  if (op === '/') return value < 1;
  return true;
}

function makeGate(op: '+' | '-' | '*' | '/', value: number, x: number): Gate {
  const isPositive = gateIsPositive(op, value);
  let label = '';
  if (op === '+') label = `+${value}`;
  else if (op === '-') label = `−${value}`;
  else if (op === '*') label = `×${value}`;
  else label = `÷${value}`;
  return { op, value, label, isPositive, x, y: -GATE_H / 2 - 20 };
}

function generateGatePair(level: number, armySize: number, gameW: number): GatePair {
  const leftX = gameW * 0.25;
  const rightX = gameW * 0.75;

  const addMax = Math.max(5, Math.min(level * 5, 50));
  const mulMax = Math.min(2 + Math.floor(level / 2), 5);
  const subMax = Math.max(3, Math.min(level * 3, Math.floor(armySize * 0.4)));
  const divMax = Math.min(2 + Math.floor(level / 3), 4);

  type OpChoice = ['+' | '-' | '*' | '/', number];

  const positiveOps: OpChoice[] = [
    ['+', randInt(Math.max(2, level), addMax)],
    ['*', randInt(2, mulMax)],
  ];
  const negativeOps: OpChoice[] = [
    ['-', randInt(1, subMax)],
    ['/', randInt(2, divMax)],
  ];

  // 40% chance both positive; 40% mixed; 20% both negative
  const roll = Math.random();
  let leftOp: OpChoice;
  let rightOp: OpChoice;

  if (roll < 0.4) {
    // both positive
    const shuffled = [...positiveOps].sort(() => Math.random() - 0.5);
    [leftOp, rightOp] = [shuffled[0], shuffled[1]];
  } else if (roll < 0.8) {
    // mixed
    const posIdx = Math.floor(Math.random() * positiveOps.length);
    const negIdx = Math.floor(Math.random() * negativeOps.length);
    if (Math.random() < 0.5) {
      leftOp = positiveOps[posIdx];
      rightOp = negativeOps[negIdx];
    } else {
      leftOp = negativeOps[negIdx];
      rightOp = positiveOps[posIdx];
    }
  } else {
    // both negative
    const shuffled = [...negativeOps].sort(() => Math.random() - 0.5);
    [leftOp, rightOp] = [shuffled[0], shuffled[1]];
  }

  return {
    left: makeGate(leftOp[0], leftOp[1], leftX),
    right: makeGate(rightOp[0], rightOp[1], rightX),
  };
}

function generateEnemyWave(level: number, gameW: number): Enemy[] {
  const count = 10 + level * 5;
  const hp = 1 + Math.floor(level / 3);
  const speed = 55 + level * 6;
  const cols = Math.min(count, Math.floor((gameW - 40) / ENEMY_SPACING_X));
  const enemies: Enemy[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const totalRowW = cols * ENEMY_SPACING_X;
    const startX = (gameW - totalRowW) / 2 + ENEMY_SPACING_X / 2;
    enemies.push({
      x: startX + col * ENEMY_SPACING_X,
      y: -ENEMY_RADIUS - row * ENEMY_SPACING_Y - 30,
      hp,
      maxHp: hp,
      speed,
      radius: ENEMY_RADIUS,
      dead: false,
    });
  }
  return enemies;
}

function generateBoss(level: number, gameW: number): Boss {
  const hp = Math.round(150 * Math.pow(1.5, level - 1));
  return {
    x: gameW / 2,
    y: -BOSS_RADIUS - 20,
    hp,
    maxHp: hp,
    speed: BOSS_SPEED,
    radius: BOSS_RADIUS,
    dead: false,
  };
}

// ── Phaser Scene ───────────────────────────────────────────────────────────

export default class ArmyScene extends Phaser.Scene {
  // Layout
  private gameW = 390;
  private gameH = 700;
  private dpr = 1;
  private armyY = 0;

  // Game state
  private phase: GamePhase = 'start';
  private level = 1;
  private armySize = 10;
  private bestScore = 0;

  // Gates
  private pendingGatePairs: GatePair[] = [];
  private currentGatePair: GatePair | null = null;
  private gatesHalted = false;
  private gateChoiceMade = false;
  private gateChoiceTimer = 0;

  // Combat
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private shootTimer = 0;

  // Boss
  private boss: Boss | null = null;

  // Timing
  private phaseTimer = 0;

  // Graphics
  private bgGfx!: Phaser.GameObjects.Graphics;
  private gateGfx!: Phaser.GameObjects.Graphics;
  private entityGfx!: Phaser.GameObjects.Graphics;
  private armyGfx!: Phaser.GameObjects.Graphics;
  private uiGfx!: Phaser.GameObjects.Graphics;

  // Text objects
  private armyCountText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
  private overlaySubText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private gateChoiceText!: Phaser.GameObjects.Text;
  private bestScoreText!: Phaser.GameObjects.Text;

  constructor() {
    super('ArmyScene');
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  create(): void {
    this.dpr = getRenderScale();
    this.bestScore = getBestScore(SCORE_KEY);
    this.relayout();

    this.bgGfx = this.add.graphics().setDepth(0);
    this.gateGfx = this.add.graphics().setDepth(1);
    this.entityGfx = this.add.graphics().setDepth(2);
    this.armyGfx = this.add.graphics().setDepth(3);
    this.uiGfx = this.add.graphics().setDepth(4);

    const textBase: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#f5f3ff',
    };

    this.armyCountText = this.add
      .text(0, 0, '', { ...textBase, fontSize: '36px', fontStyle: 'bold', color: '#00e5ff' })
      .setOrigin(0.5, 1)
      .setDepth(5);

    this.levelText = this.add
      .text(0, 0, '', { ...textBase, fontSize: '18px', color: '#a99fd6' })
      .setOrigin(0, 0)
      .setDepth(5);

    this.overlayText = this.add
      .text(0, 0, '', { ...textBase, fontSize: '42px', fontStyle: 'bold', align: 'center' })
      .setOrigin(0.5, 0.5)
      .setDepth(6);

    this.overlaySubText = this.add
      .text(0, 0, '', { ...textBase, fontSize: '22px', color: '#a99fd6', align: 'center' })
      .setOrigin(0.5, 0.5)
      .setDepth(6);

    this.gateChoiceText = this.add
      .text(0, 0, '', { ...textBase, fontSize: '28px', fontStyle: 'bold', align: 'center' })
      .setOrigin(0.5, 0.5)
      .setDepth(6);

    this.add
      .text(12, 14, '← Hub', {
        ...textBase,
        fontSize: '15px',
        color: '#a99fd6',
        backgroundColor: '#1b1035',
        padding: { x: 8, y: 4 },
      })
      .setDepth(7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.location.href = HUB_URL;
      });

    this.bestScoreText = this.add
      .text(0, 14, '', { ...textBase, fontSize: '15px', color: '#a99fd6' })
      .setOrigin(1, 0)
      .setDepth(7);

    this.scale.on('resize', () => this.relayout());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    this.transitionTo('start');
  }

  private relayout(): void {
    this.gameW = Math.min(Math.floor(this.scale.width / this.dpr), GAME_MAX_W);
    this.gameH = Math.floor(this.scale.height / this.dpr);
    this.armyY = this.gameH - ARMY_BOTTOM_MARGIN;
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.relayout();

    switch (this.phase) {
      case 'level_start':
        this.updateLevelStart(dt);
        break;
      case 'gates':
        this.updateGates(dt);
        break;
      case 'combat':
        this.updateCombat(dt);
        break;
      case 'boss':
        this.updateBoss(dt);
        break;
      case 'level_complete':
        this.updateLevelComplete(dt);
        break;
    }

    this.render();
  }

  // ── Phase transitions ───────────────────────────────────────────────────

  private transitionTo(phase: GamePhase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    this.gateChoiceText.setVisible(false);
    this.overlayText.setVisible(false);
    this.overlaySubText.setVisible(false);

    switch (phase) {
      case 'start':
        this.showStartScreen();
        break;
      case 'level_start':
        this.startLevelAnnouncement();
        break;
      case 'gates':
        this.startGatesPhase();
        break;
      case 'combat':
        this.startCombatPhase();
        break;
      case 'boss':
        this.startBossPhase();
        break;
      case 'level_complete':
        this.showLevelComplete();
        break;
      case 'game_over':
        this.showGameOver();
        break;
    }
  }

  // ── Start screen ────────────────────────────────────────────────────────

  private showStartScreen(): void {
    this.armySize = 10;
    this.level = 1;
    this.enemies = [];
    this.bullets = [];
    this.boss = null;
    this.currentGatePair = null;
    this.bestScore = getBestScore(SCORE_KEY);

    this.overlayText
      .setText('ARMY RUSH')
      .setStyle({ fontSize: '52px', fontStyle: 'bold', color: '#00e5ff' })
      .setVisible(true);

    this.overlaySubText
      .setText(
        'Tap left/right to pick gates\nShoot down the enemy wave\nThen defeat the boss!\n\nTap to start'
      )
      .setStyle({ fontSize: '18px', color: '#a99fd6' })
      .setVisible(true);
  }

  // ── Level start announcement ─────────────────────────────────────────────

  private startLevelAnnouncement(): void {
    this.enemies = [];
    this.bullets = [];
    this.boss = null;
    this.shootTimer = 0;

    this.overlayText
      .setText(`LEVEL ${this.level}`)
      .setStyle({ fontSize: '52px', fontStyle: 'bold', color: '#b958ff' })
      .setVisible(true);
    this.overlaySubText
      .setText(`Army: ${this.armySize}`)
      .setStyle({ fontSize: '22px', color: '#a99fd6' })
      .setVisible(true);
  }

  private updateLevelStart(dt: number): void {
    this.phaseTimer += dt * 1000;
    if (this.phaseTimer >= LEVEL_BANNER_DURATION) {
      this.transitionTo('gates');
    }
  }

  // ── Gates phase ─────────────────────────────────────────────────────────

  private startGatesPhase(): void {
    const numPairs = 2 + Math.floor(this.level / 2);
    this.pendingGatePairs = Array.from({ length: numPairs }, () =>
      generateGatePair(this.level, this.armySize, this.gameW)
    );
    this.currentGatePair = null;
    this.gatesHalted = false;
    this.gateChoiceMade = false;
    this.spawnNextGatePair();
  }

  private spawnNextGatePair(): void {
    if (this.pendingGatePairs.length === 0) {
      this.transitionTo('combat');
      return;
    }
    this.currentGatePair = this.pendingGatePairs.shift()!;
    this.currentGatePair.left.y = -GATE_H / 2 - 20;
    this.currentGatePair.right.y = -GATE_H / 2 - 20;
    this.gatesHalted = false;
    this.gateChoiceMade = false;
    this.gateChoiceTimer = 0;
  }

  private updateGates(dt: number): void {
    if (!this.currentGatePair) return;

    const { left, right } = this.currentGatePair;
    const haltY = this.armyY - GATE_HALT_Y_OFFSET;

    if (!this.gateChoiceMade && !this.gatesHalted) {
      left.y += GATE_DESCENT_SPEED * dt;
      right.y += GATE_DESCENT_SPEED * dt;
      if (left.y >= haltY) {
        left.y = haltY;
        right.y = haltY;
        this.gatesHalted = true;
      }
    }

    // Show instruction text when halted
    if (this.gatesHalted && !this.gateChoiceMade) {
      this.gateChoiceText
        .setText('Tap left or right to choose!')
        .setPosition(this.gameW / 2, this.armyY - 140)
        .setStyle({ fontSize: '16px', color: '#ffcc66' })
        .setVisible(true);
    }

    if (this.gateChoiceMade) {
      this.gateChoiceTimer += dt * 1000;
      if (this.gateChoiceTimer >= 600) {
        this.gateChoiceText.setVisible(false);
        this.currentGatePair = null;
        this.spawnNextGatePair();
      }
    }
  }

  private chooseGate(side: 'left' | 'right'): void {
    if (!this.currentGatePair || this.gateChoiceMade) return;
    const chosen = side === 'left' ? this.currentGatePair.left : this.currentGatePair.right;
    const newSize = applyGate(this.armySize, chosen);
    const diff = newSize - this.armySize;
    this.armySize = newSize;
    this.gateChoiceMade = true;
    this.gateChoiceTimer = 0;
    this.gateChoiceText
      .setText(`${chosen.label} → ${this.armySize}`)
      .setPosition(this.gameW / 2, this.armyY - 140)
      .setStyle({
        fontSize: '28px',
        fontStyle: 'bold',
        color: diff >= 0 ? '#3ddc97' : '#ff2e97',
      })
      .setVisible(true);
  }

  // ── Combat phase ─────────────────────────────────────────────────────────

  private startCombatPhase(): void {
    this.enemies = generateEnemyWave(this.level, this.gameW);
    this.bullets = [];
    this.shootTimer = 0;
  }

  private updateCombat(dt: number): void {
    // Move enemies down
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.y += enemy.speed * dt;

      // Enemy hits army
      if (enemy.y + enemy.radius >= this.armyY - 20) {
        enemy.dead = true;
        this.armySize = Math.max(0, this.armySize - 1);
        if (this.armySize <= 0) {
          this.transitionTo('game_over');
          return;
        }
      }
    }

    // Shoot timer
    this.shootTimer += dt * 1000;
    if (this.shootTimer >= SHOOT_INTERVAL) {
      this.shootTimer = 0;
      this.fireAtEnemies();
    }

    // Move bullets
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.y += b.vy * dt;
      if (b.y < -10) b.dead = true;
    }

    // Bullet vs enemy collision
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy <= e.radius * e.radius) {
          e.hp--;
          b.dead = true;
          if (e.hp <= 0) e.dead = true;
          break;
        }
      }
    }

    // Cleanup
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);

    if (this.enemies.length === 0) {
      this.transitionTo('boss');
    }
  }

  private fireAtEnemies(): void {
    const alive = this.enemies.filter((e) => !e.dead);
    if (alive.length === 0) return;

    // Sort by y descending (lowest = closest to army = most dangerous)
    alive.sort((a, b) => b.y - a.y);

    const shots = Math.max(1, Math.floor(Math.sqrt(this.armySize)));
    for (let i = 0; i < shots; i++) {
      const target = alive[i % alive.length];
      // Spawn bullet from random position within army cluster, aimed toward target
      const bx = clamp(
        target.x + rand(-target.radius, target.radius),
        10,
        this.gameW - 10
      );
      this.bullets.push({
        x: bx,
        y: this.armyY - 10,
        vy: -BULLET_SPEED,
        dead: false,
      });
    }
  }

  // ── Boss phase ───────────────────────────────────────────────────────────

  private startBossPhase(): void {
    this.boss = generateBoss(this.level, this.gameW);
    this.bullets = [];
    this.shootTimer = 0;
  }

  private updateBoss(dt: number): void {
    if (!this.boss || this.boss.dead) return;

    this.boss.y += this.boss.speed * dt;

    // Boss hits army
    if (this.boss.y + this.boss.radius >= this.armyY - 20) {
      this.transitionTo('game_over');
      return;
    }

    // Shoot at boss
    this.shootTimer += dt * 1000;
    if (this.shootTimer >= SHOOT_INTERVAL) {
      this.shootTimer = 0;
      this.fireAtBoss();
    }

    // Move bullets
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.y += b.vy * dt;
      if (b.y < -10) b.dead = true;
    }

    // Bullet vs boss
    for (const b of this.bullets) {
      if (b.dead) continue;
      const dx = b.x - this.boss.x;
      const dy = b.y - this.boss.y;
      if (dx * dx + dy * dy <= this.boss.radius * this.boss.radius) {
        this.boss.hp--;
        b.dead = true;
        if (this.boss.hp <= 0) {
          this.boss.dead = true;
          this.boss = null;
          this.bullets = [];
          const newBest = submitScore(SCORE_KEY, this.level);
          this.bestScore = newBest;
          this.transitionTo('level_complete');
          return;
        }
      }
    }

    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  private fireAtBoss(): void {
    if (!this.boss) return;
    const shots = Math.max(1, Math.floor(Math.sqrt(this.armySize)));
    for (let i = 0; i < shots; i++) {
      const spread = Math.min(60, this.boss.radius * 1.5);
      const bx = this.gameW / 2 + rand(-spread / 2, spread / 2);
      this.bullets.push({
        x: bx,
        y: this.armyY - 10,
        vy: -BULLET_SPEED,
        dead: false,
      });
    }
  }

  // ── Level complete ───────────────────────────────────────────────────────

  private showLevelComplete(): void {
    this.enemies = [];
    this.bullets = [];
    this.boss = null;

    this.overlayText
      .setText(`LEVEL ${this.level}\nCLEARED!`)
      .setStyle({ fontSize: '44px', fontStyle: 'bold', color: '#3ddc97' })
      .setVisible(true);
    this.overlaySubText
      .setText(`Army: ${this.armySize}\n\nTap to continue`)
      .setStyle({ fontSize: '20px', color: '#a99fd6' })
      .setVisible(true);
  }

  private updateLevelComplete(dt: number): void {
    this.phaseTimer += dt * 1000;
  }

  // ── Game over ────────────────────────────────────────────────────────────

  private showGameOver(): void {
    const reached = this.level;
    const newBest = submitScore(SCORE_KEY, reached - 1); // completed levels (not reached boss)
    this.bestScore = newBest;

    this.enemies = [];
    this.bullets = [];
    this.boss = null;

    this.overlayText
      .setText('GAME OVER')
      .setStyle({ fontSize: '52px', fontStyle: 'bold', color: '#ff2e97' })
      .setVisible(true);
    this.overlaySubText
      .setText(
        `Reached Level ${reached}\nArmy: ${this.armySize}\nBest: ${this.bestScore} levels\n\nTap to restart`
      )
      .setStyle({ fontSize: '20px', color: '#a99fd6' })
      .setVisible(true);
  }

  // ── Input ────────────────────────────────────────────────────────────────

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const px = p.x / this.dpr;

    // Ignore taps on the back link area
    if (px < 80 && p.y / this.dpr < 50) return;

    switch (this.phase) {
      case 'start':
        this.level = 1;
        this.armySize = 10;
        this.transitionTo('level_start');
        break;

      case 'gates':
        if (this.gatesHalted && !this.gateChoiceMade) {
          this.chooseGate(px < this.gameW / 2 ? 'left' : 'right');
        }
        break;

      case 'level_complete':
        if (this.phaseTimer >= 600) {
          this.level++;
          this.transitionTo('level_start');
        }
        break;

      case 'game_over':
        this.level = 1;
        this.armySize = 10;
        this.transitionTo('start');
        break;
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private render(): void {
    this.bgGfx.clear();
    this.gateGfx.clear();
    this.entityGfx.clear();
    this.armyGfx.clear();
    this.uiGfx.clear();

    this.drawBackground();

    if (this.phase === 'gates') this.drawGates();
    if (this.phase === 'combat' || this.phase === 'boss') this.drawEnemies();
    if (this.phase === 'boss' && this.boss) this.drawBoss();
    if (this.phase === 'combat' || this.phase === 'boss') this.drawBullets();
    if (
      this.phase !== 'start' &&
      this.phase !== 'level_start' &&
      this.phase !== 'game_over'
    ) {
      this.drawArmy();
      this.drawArmyLine();
    }
    this.drawHud();

    // Position overlay texts
    const cx = this.gameW / 2;
    const cy = this.gameH / 2;
    this.overlayText.setPosition(cx, cy - 60);
    this.overlaySubText.setPosition(cx, cy + 50);
    this.bestScoreText.setPosition(this.gameW - 12, 14);
    this.levelText.setPosition(12, this.gameH - 38);
  }

  private drawBackground(): void {
    this.bgGfx.fillStyle(COLORS.bg);
    this.bgGfx.fillRect(0, 0, this.gameW, this.gameH);

    // Subtle gradient-like bands
    this.bgGfx.fillStyle(COLORS.bgSoft, 0.3);
    this.bgGfx.fillRect(0, this.armyY + 10, this.gameW, this.gameH - this.armyY - 10);
  }

  private drawArmyLine(): void {
    // Dividing line between army zone and combat zone
    this.uiGfx.lineStyle(1, COLORS.muted, 0.25);
    this.uiGfx.beginPath();
    this.uiGfx.moveTo(0, this.armyY - 30);
    this.uiGfx.lineTo(this.gameW, this.armyY - 30);
    this.uiGfx.strokePath();
  }

  private drawArmy(): void {
    const cx = this.gameW / 2;
    const cy = this.armyY + 10;
    const visible = Math.min(this.armySize, 80);
    const cols = Math.ceil(Math.sqrt(visible * 2));
    const spacing = clamp((this.gameW - 40) / cols, 6, 14);
    const rows = Math.ceil(visible / cols);
    const startX = cx - (cols / 2) * spacing + spacing / 2;
    const startY = cy - (rows / 2) * spacing;

    for (let i = 0; i < visible; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacing;
      const y = startY + row * spacing;
      this.armyGfx.fillStyle(COLORS.node, 0.9);
      this.armyGfx.fillCircle(x, y, spacing * 0.35);
    }

    // Count label
    this.armyCountText
      .setText(String(this.armySize))
      .setPosition(cx, this.armyY - 34)
      .setVisible(true);
  }

  private drawGates(): void {
    if (!this.currentGatePair) return;
    const { left, right } = this.currentGatePair;
    const gw = GATE_W;
    const gh = GATE_H;
    const radius = 12;

    for (const gate of [left, right]) {
      const x = gate.x - gw / 2;
      const y = gate.y - gh / 2;
      const borderColor = gate.isPositive ? COLORS.good : COLORS.bad;
      const fillAlpha = this.gateChoiceMade ? 0.15 : 0.22;

      // Fill
      this.gateGfx.fillStyle(gate.isPositive ? COLORS.good : COLORS.bad, fillAlpha);
      this.gateGfx.fillRoundedRect(x, y, gw, gh, radius);

      // Border
      this.gateGfx.lineStyle(2.5, borderColor, 0.9);
      this.gateGfx.strokeRoundedRect(x, y, gw, gh, radius);

      // Vertical gate posts
      this.gateGfx.lineStyle(3, borderColor, 0.6);
      this.gateGfx.beginPath();
      this.gateGfx.moveTo(gate.x - gw / 2, y);
      this.gateGfx.lineTo(gate.x - gw / 2, y + gh + 30);
      this.gateGfx.moveTo(gate.x + gw / 2, y);
      this.gateGfx.lineTo(gate.x + gw / 2, y + gh + 30);
      this.gateGfx.strokePath();
    }

    // Gate labels rendered via a temporary text approach (draw text on graphics is limited)
    // We use fixed-position text objects pooled; here we update via Graphics text fallback.
    // Since Phaser Graphics can't draw text, we render operation labels using the scene's
    // Text pool. We store them as cached objects on the scene.
    this.drawGateLabel(left);
    this.drawGateLabel(right);
  }

  // Pool for gate label text objects
  private gateTextPool: Phaser.GameObjects.Text[] = [];
  private gateTextUsed = 0;

  private getGateLabelText(): Phaser.GameObjects.Text {
    if (this.gateTextUsed < this.gateTextPool.length) {
      const t = this.gateTextPool[this.gateTextUsed++];
      t.setVisible(true);
      return t;
    }
    const t = this.add
      .text(0, 0, '', {
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#f5f3ff',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(3);
    this.gateTextPool.push(t);
    this.gateTextUsed++;
    return t;
  }

  private beginGateLabels(): void {
    this.gateTextUsed = 0;
    for (const t of this.gateTextPool) t.setVisible(false);
  }

  private drawGateLabel(gate: Gate): void {
    const t = this.getGateLabelText();
    t.setText(gate.label)
      .setPosition(gate.x, gate.y)
      .setStyle({ color: gate.isPositive ? '#3ddc97' : '#ff2e97', fontSize: '28px' });
  }

  private drawEnemies(): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      // Enemy circle
      this.entityGfx.fillStyle(COLORS.bad, 0.9);
      this.entityGfx.fillCircle(e.x, e.y, e.radius);
      this.entityGfx.lineStyle(1.5, 0xff6bb0, 0.6);
      this.entityGfx.strokeCircle(e.x, e.y, e.radius);

      // HP bar (only if enemy has more than 1 max HP)
      if (e.maxHp > 1) {
        const bw = e.radius * 2;
        const bh = 4;
        const bx = e.x - e.radius;
        const by = e.y - e.radius - 8;
        const pct = e.hp / e.maxHp;
        this.entityGfx.fillStyle(0x3a1a2e, 0.8);
        this.entityGfx.fillRect(bx, by, bw, bh);
        this.entityGfx.fillStyle(pct > 0.5 ? COLORS.good : COLORS.bad, 0.9);
        this.entityGfx.fillRect(bx, by, bw * pct, bh);
      }
    }
  }

  private drawBoss(): void {
    if (!this.boss) return;
    const b = this.boss;
    const pct = b.hp / b.maxHp;

    // Outer glow ring
    this.entityGfx.lineStyle(4, 0xff6000, 0.3);
    this.entityGfx.strokeCircle(b.x, b.y, b.radius + 10);

    // Body
    this.entityGfx.fillStyle(0xcc2200, 0.95);
    this.entityGfx.fillCircle(b.x, b.y, b.radius);
    this.entityGfx.lineStyle(3, 0xff4400, 0.8);
    this.entityGfx.strokeCircle(b.x, b.y, b.radius);

    // HP bar
    const bw = b.radius * 3;
    const bh = 8;
    const bx = b.x - bw / 2;
    const by = b.y - b.radius - 16;
    this.entityGfx.fillStyle(0x3a1a2e, 0.9);
    this.entityGfx.fillRect(bx, by, bw, bh);
    this.entityGfx.fillStyle(pct > 0.5 ? 0xff8800 : pct > 0.25 ? 0xff4400 : 0xff0000, 0.95);
    this.entityGfx.fillRect(bx, by, bw * pct, bh);
    this.entityGfx.lineStyle(1, 0x661100, 0.7);
    this.entityGfx.strokeRect(bx, by, bw, bh);

    // HP text above bar
    this.uiGfx.fillStyle(COLORS.text, 0.9);
    // (rendered via boss HP label text below)
  }

  private bossHpText: Phaser.GameObjects.Text | null = null;

  private ensureBossHpText(): Phaser.GameObjects.Text {
    if (!this.bossHpText) {
      this.bossHpText = this.add
        .text(0, 0, '', {
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '13px',
          color: '#ffcc66',
        })
        .setOrigin(0.5, 1)
        .setDepth(5);
    }
    return this.bossHpText;
  }

  private drawBullets(): void {
    for (const b of this.bullets) {
      if (b.dead) continue;
      this.entityGfx.fillStyle(0xffdd44, 1);
      this.entityGfx.fillCircle(b.x, b.y, 3.5);
      // Trail
      this.entityGfx.fillStyle(0xffaa00, 0.4);
      this.entityGfx.fillCircle(b.x, b.y + 8, 2);
    }
  }

  private drawHud(): void {
    // Level indicator bottom-left
    this.levelText.setText(`Level ${this.level}`).setVisible(this.phase !== 'start');

    // Best score top-right
    this.bestScoreText
      .setText(this.bestScore > 0 ? `Best: ${this.bestScore}` : '')
      .setVisible(true);

    // Boss HP label
    const bossHpLabel = this.ensureBossHpText();
    if (this.phase === 'boss' && this.boss) {
      bossHpLabel
        .setText(`BOSS  ${this.boss.hp} / ${this.boss.maxHp} HP`)
        .setPosition(this.gameW / 2, this.boss.y - this.boss.radius - 20)
        .setVisible(true);
    } else {
      bossHpLabel.setVisible(false);
    }

    // Gate labels refresh each frame
    this.beginGateLabels();
    if (this.phase === 'gates' && this.currentGatePair) {
      this.drawGateLabel(this.currentGatePair.left);
      this.drawGateLabel(this.currentGatePair.right);
    }

    // Army count visibility
    this.armyCountText.setVisible(
      this.phase !== 'start' && this.phase !== 'level_start' && this.phase !== 'game_over'
    );
  }
}
