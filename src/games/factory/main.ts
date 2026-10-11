import { registerSW } from 'virtual:pwa-register';
import FactoryScene from './FactoryScene';
import { FactoryHud } from './hud';
import { createFactoryGame } from './rendering/platform';
import './style.css';

const hud = new FactoryHud();
export const game = createFactoryGame(new FactoryScene(hud));

if (import.meta.env.DEV) {
  hud.setOfflineStatus('Offline cache: production build only');
} else if (!('serviceWorker' in navigator)) {
  hud.setOfflineStatus('Offline launch unavailable in this browser');
} else {
  const ready = () => hud.setOfflineStatus('Offline ready · resources cached');
  registerSW({
    immediate: true,
    onOfflineReady: ready,
    onRegisteredSW: (_url, registration) => {
      if (registration?.active?.state === 'activated') ready();
      const worker = registration?.installing ?? registration?.waiting;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'activated') ready();
        else if (worker.state === 'redundant') hud.setOfflineStatus('Offline cache failed · reconnect and reload');
      });
    },
    onRegisterError: error => {
      hud.setOfflineStatus(`Offline cache failed: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}
