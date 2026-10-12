import { registerSW } from 'virtual:pwa-register';
import FactoryScene from './FactoryScene';
import { FactoryHud } from './hud';
import { createFactoryGame } from './rendering/platform';
import './style.css';

const hud = new FactoryHud();
export const game = createFactoryGame(new FactoryScene(hud));

if (import.meta.env.DEV) {
  hud.setOfflineStatus('Offline access is disabled in development');
} else if (!('serviceWorker' in navigator)) {
  hud.setOfflineStatus('This browser cannot open the game offline');
} else {
  const ready = () => hud.setOfflineStatus('Ready to open offline');
  registerSW({
    immediate: true,
    onOfflineReady: ready,
    onRegisteredSW: (_url, registration) => {
      if (registration?.active?.state === 'activated') ready();
      const worker = registration?.installing ?? registration?.waiting;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'activated') ready();
        else if (worker.state === 'redundant') hud.setOfflineStatus('Offline access is not ready. Connect to the internet and reload.');
      });
    },
    onRegisterError: error => {
      console.error('Pocket Factory offline setup failed.', error);
      hud.setOfflineStatus('Could not prepare offline access. Connect to the internet and reload.');
    },
  });
}
