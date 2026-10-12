import Phaser from 'phaser';
import { BUILDING_KINDS, Direction, ITEMS, ITEM_NAMES, Item, NAMES, nextDirection } from '../game/domain';
import { createFactoryGame, getRenderScale, reducedMotionPreference } from '../rendering/platform';
import { drawBuilding, drawBuildingActivity, drawOre, drawResident, drawTree } from './art';
import { BUILDING_SHAPES } from './picking';

const facing = document.querySelector<HTMLSelectElement>('#facing')!;
const cargo = document.querySelector<HTMLSelectElement>('#cargo')!;
const progress = document.querySelector<HTMLInputElement>('#progress')!;
const running = document.querySelector<HTMLInputElement>('#running')!;
const motion = document.querySelector<HTMLInputElement>('#motion')!;
const shapes = document.querySelector<HTMLInputElement>('#shapes')!;
for (const item of ITEMS) cargo.add(new Option(ITEM_NAMES[item], item));
const reducedMotion = reducedMotionPreference();

class AssetPreview extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private clock = 0;

  create(): void {
    this.graphics = this.add.graphics();
    for (let i = 0; i < BUILDING_KINDS.length; i++) {
      this.add.text(100 + i % 5 * 180, 200 + Math.floor(i / 5) * 170, NAMES[BUILDING_KINDS[i]], {
        fontFamily: 'system-ui', fontSize: '14px', color: '#344b48',
      }).setOrigin(0.5);
    }
    this.add.text(460, 530, 'Residents, carried cargo, trees, and deposits', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#344b48',
    }).setOrigin(0.5);
    const fit = () => {
      const scale = Math.min(window.innerWidth / 920, Math.max(100, window.innerHeight - 110) / 490);
      this.cameras.main.setZoom(scale * getRenderScale()).centerOn(460, 300);
    };
    fit();
    this.scale.on('resize', fit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', fit));
  }

  update(_time: number, delta: number): void {
    if (motion.checked && !reducedMotion.matches) this.clock += Math.min(delta, 250) / 100;
    const direction = Number(facing.value) as Direction;
    const item = cargo.value === '' ? null : cargo.value as Item;
    const fraction = Number(progress.value) / 100;
    const g = this.graphics;
    g.clear();
    for (let i = 0; i < BUILDING_KINDS.length; i++) {
      const kind = BUILDING_KINDS[i];
      const origin = { x: 100 + i % 5 * 180, y: 160 + Math.floor(i / 5) * 170 };
      drawBuilding(g, {
        kind, origin, direction, inputs: [direction, nextDirection(direction)],
        variant: { c: i, r: 0 }, upgraded: running.checked, completed: fraction >= 1,
      });
      drawBuildingActivity(g, {
        kind, origin, direction, enteredFrom: direction, preferredOutput: nextDirection(direction),
        cargo: item, progress: fraction, running: running.checked, time: this.clock, motionPaused: !motion.checked || reducedMotion.matches,
      });
      if (shapes.checked) {
        g.lineStyle(1, 0x3f7774, 0.7);
        for (const outline of BUILDING_SHAPES[kind].selection) g.strokePoints(outline.map(point =>
          ({ x: point.x + origin.x, y: point.y + origin.y })), true);
        g.fillStyle(0xd8a653).fillCircle(origin.x, origin.y, 2);
      }
    }
    for (let id = 0; id < 4; id++) {
      drawResident(g, 160 + id * 65, 480, id, this.clock * 0.7, item, running.checked, { x: direction < 2 ? 38 : -38, y: direction % 2 ? 19 : -19 });
    }
    drawTree(g, 490, 480, 0, 0, 'meadow');
    drawTree(g, 570, 480, 7, 3, 'riverbank');
    drawTree(g, 650, 480, 14, 6, 'upland');
    drawOre(g, 740, 480, false, 0, 0);
    drawOre(g, 810, 480, true, 0, 0);
  }
}

export const game = createFactoryGame(new AssetPreview());
