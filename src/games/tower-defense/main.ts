import { createGame } from '../../core/createGame';
import TowerDefenseScene from './TowerDefenseScene';
import { createHud } from './hud';
import { showOnboardHint } from '../../core/onboardHint';

showOnboardHint({
  key: 'tower-defense',
  line1: 'Defend your castle from enemy waves',
  line2: 'Place buildings to mine ore and power turrets. Hit "Start wave" when ready.',
});

const hud = createHud();
const game = createGame({ scene: TowerDefenseScene });
game.registry.set('hud', hud);
