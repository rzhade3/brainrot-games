import { createGame } from '../../core/createGame';
import UntangleScene from './UntangleScene';
import { createHud } from './hud';
import { showOnboardHint } from '../../core/onboardHint';

showOnboardHint({
  key: 'untangle',
  line1: 'Drag nodes to untangle the web',
  line2: 'No strings should cross. Solve it and the web grows.',
});

const hud = createHud();
const game = createGame({ scene: UntangleScene });
game.registry.set('hud', hud);
