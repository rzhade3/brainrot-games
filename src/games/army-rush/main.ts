import Phaser from 'phaser';
import ArmyScene from './ArmyScene';
import { getRenderScale } from '../../core/createGame';

const GAME_MAX_W = 430;

const dpr = getRenderScale();
const gameW = Math.min(window.innerWidth, GAME_MAX_W);
const gameH = window.innerHeight;

// Center the game container on desktop
const root = document.getElementById('game-root')!;
root.style.maxWidth = `${GAME_MAX_W}px`;
root.style.margin = '0 auto';
root.style.height = '100vh';
root.style.position = 'relative';
root.style.overflow = 'hidden';

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game-root',
  backgroundColor: '#0d0221',
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.floor(gameW * dpr),
    height: Math.floor(gameH * dpr),
    zoom: 1 / dpr,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: ArmyScene,
});

const resize = () => {
  const w = Math.min(window.innerWidth, GAME_MAX_W);
  const h = window.innerHeight;
  game.scale.resize(Math.floor(w * dpr), Math.floor(h * dpr));
  game.scene.getScene('ArmyScene')?.scale?.emit('resize');
};
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
