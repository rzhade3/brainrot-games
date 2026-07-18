import Phaser from 'phaser';
import { getRenderScale } from './createGame';

/**
 * Reusable "coming soon" scene for games that are scaffolded but not yet
 * implemented. Pass a title/emoji via scene init data.
 */
export default class PlaceholderScene extends Phaser.Scene {
  private title = 'Coming soon';
  private emoji = '🚧';

  constructor() {
    super('PlaceholderScene');
  }

  init(data: { title?: string; emoji?: string }): void {
    if (data.title) this.title = data.title;
    if (data.emoji) this.emoji = data.emoji;
  }

  create(): void {
    const dpr = getRenderScale();
    const px = (n: number) => `${Math.round(n * dpr)}px`;

    const draw = () => {
      const W = this.scale.width;
      const H = this.scale.height;
      this.children.removeAll();

      this.add.text(W / 2, H / 2 - 70 * dpr, this.emoji, { fontSize: px(72) }).setOrigin(0.5);
      this.add
        .text(W / 2, H / 2 + 10 * dpr, this.title, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: px(34),
          color: '#f5f3ff',
        })
        .setOrigin(0.5);
      this.add
        .text(W / 2, H / 2 + 55 * dpr, 'Coming soon', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: px(20),
          color: '#a99fd6',
        })
        .setOrigin(0.5);

      const btn = this.add
        .text(W / 2, H / 2 + 120 * dpr, 'Back to hub', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: px(18),
          color: '#f5f3ff',
          backgroundColor: '#3a1a6a',
          padding: { x: 14 * dpr, y: 9 * dpr },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        window.location.href = '../../';
      });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#4a248a' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#3a1a6a' }));
    };

    draw();
    this.scale.on('resize', draw);
  }
}
