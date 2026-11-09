import './pwa-game-gestures.css';

const standalone = window.matchMedia('(display-mode: standalone)');
const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
const listenerOptions = { capture: true, passive: false };

function preventViewportZoom(event: Event): void {
  event.preventDefault();
}

function preventWheelZoom(event: WheelEvent): void {
  if (event.ctrlKey) preventViewportZoom(event);
}

function updateGestureLock(): void {
  const locked = standalone.matches || navigatorWithStandalone.standalone === true;
  document.documentElement.classList.toggle('pwa-game', locked);

  // Trackpad pinch arrives as Ctrl+wheel in Chromium and a gesture event in Safari.
  // Cancel the browser action without stopping game handlers from receiving the input.
  if (locked) {
    window.addEventListener('wheel', preventWheelZoom, listenerOptions);
    window.addEventListener('gesturestart', preventViewportZoom, listenerOptions);
    window.addEventListener('gesturechange', preventViewportZoom, listenerOptions);
  } else {
    window.removeEventListener('wheel', preventWheelZoom, listenerOptions);
    window.removeEventListener('gesturestart', preventViewportZoom, listenerOptions);
    window.removeEventListener('gesturechange', preventViewportZoom, listenerOptions);
  }
}

updateGestureLock();
standalone.addEventListener('change', updateGestureLock);
