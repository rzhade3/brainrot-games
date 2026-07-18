import { createGame } from '../../core/createGame';
import TowerDefenseScene from './TowerDefenseScene';
import { createHud } from './hud';

const hud = createHud();
const game = createGame({ scene: TowerDefenseScene });
game.registry.set('hud', hud);
