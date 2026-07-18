import { createGame } from '../../core/createGame';
import UntangleScene from './UntangleScene';
import { createHud } from './hud';

const hud = createHud();
const game = createGame({ scene: UntangleScene });
game.registry.set('hud', hud);
