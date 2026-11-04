import Phaser from 'phaser';
import './style.css';
import UntangleScene from './UntangleScene';
import { createHud } from './hud';
import { getRenderScale } from '../../core/createGame';

const hud = createHud();
const board = document.querySelector<HTMLElement>('#game-root')!;
const dpr = getRenderScale();
const game = new Phaser.Game({
  type: Phaser.CANVAS, parent: board, backgroundColor: '#0b1418',
  scale: { mode: Phaser.Scale.NONE, width: Math.max(1, Math.floor(board.clientWidth * dpr)), height: Math.max(1, Math.floor(board.clientHeight * dpr)), zoom: 1 / dpr },
  callbacks: { preBoot: game => game.registry.set('hud', hud) },
  scene: UntangleScene,
});
const observer = new ResizeObserver(() => game.scale.resize(Math.max(1, Math.floor(board.clientWidth * dpr)), Math.max(1, Math.floor(board.clientHeight * dpr))));
observer.observe(board);
if (import.meta.hot) import.meta.hot.dispose(() => { observer.disconnect(); game.destroy(true); hud.destroy(); });
