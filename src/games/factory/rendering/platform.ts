import Phaser from 'phaser';
export const RENDER_POLICY = {
  maxDeviceScale: 3,
  groundResolution: 0.5,
  previewResolution: 0.0625,
  propWidth: 128,
  propHeight: 112,
  propAnchorX: 64,
  propAnchorY: 88,
} as const;

export function getRenderScale(): number {
  return Math.min(window.devicePixelRatio || 1, RENDER_POLICY.maxDeviceScale);
}

export function reducedMotionPreference(): MediaQueryList {
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

export function createFactoryGame(scene: Phaser.Types.Scenes.SceneType): Phaser.Game {
  const dpr = getRenderScale();
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-root',
    backgroundColor: '#dce3d7',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.floor(window.innerWidth * dpr),
      height: Math.floor(window.innerHeight * dpr),
      zoom: 1 / dpr,
    },
    render: { antialias: true, roundPixels: false },
    scene,
  });
  const abort = new AbortController();
  const resize = () => game.scale.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr));
  window.addEventListener('resize', resize, { signal: abort.signal });
  window.addEventListener('orientationchange', resize, { signal: abort.signal });
  game.events.once(Phaser.Core.Events.DESTROY, () => abort.abort());
  return game;
}
