import Phaser from 'phaser';

export const COLORS = {
  bg: 0x0d0221,
  bgSoft: 0x1b1035,
  accent: 0xb958ff,
  accent2: 0xff2e97,
  node: 0x00e5ff,
  good: 0x3ddc97,
  bad: 0xff2e97,
  text: 0xf5f3ff,
  muted: 0xa99fd6,
};

/**
 * Device pixel ratio used to size the rendering buffer, capped so we don't
 * allocate an enormous canvas on 3x+ displays.
 */
export function getRenderScale(): number {
  return Math.min(window.devicePixelRatio || 1, 3);
}

/**
 * Whether the user prefers reduced motion. Games should check this and
 * skip/shorten non-essential animations (e.g. collapse sequences, idle drift).
 */
export const prefersReducedMotion: boolean =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type CreateGameOptions = {
  scene: Phaser.Types.Scenes.SceneType | Phaser.Types.Scenes.SceneType[];
  backgroundColor?: string;
};

/**
 * Shared Phaser.Game factory. Renders the canvas at native device resolution
 * (like PixiJS `autoDensity`) so lines and shapes stay crisp on Hi-DPI/Retina
 * displays: the drawing buffer is sized to CSS pixels * devicePixelRatio, and
 * `zoom` scales the canvas element back down to CSS size.
 */
export function createGame(options: CreateGameOptions): Phaser.Game {
  const dpr = getRenderScale();
  const root = document.getElementById('game-root')!;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    parent: root,
    backgroundColor: options.backgroundColor ?? '#0d0221',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.floor(root.clientWidth * dpr),
      height: Math.floor(root.clientHeight * dpr),
      zoom: 1 / dpr,
    },
    render: {
      antialias: true,
      roundPixels: false,
    },
    scene: options.scene,
    callbacks: {
      postBoot(game) {
        const observer = new ResizeObserver(() => {
          const width = Math.floor(root.clientWidth * dpr);
          const height = Math.floor(root.clientHeight * dpr);
          if (width > 0 && height > 0 && (width !== game.scale.width || height !== game.scale.height)) {
            game.scale.resize(width, height);
          }
        });
        observer.observe(root);
        game.events.once(Phaser.Core.Events.DESTROY, () => observer.disconnect());
      },
    },
  };

  return new Phaser.Game(config);
}
