/**
 * First-play hint overlay. Shows once per game, dismisses on tap/click/keypress.
 * Respects localStorage so returning players skip it.
 */

const SEEN_PREFIX = 'brainrot-hint-seen:';

export interface OnboardHintOptions {
  /** Unique key per game (e.g. 'untangle', 'typing', 'tower-defense') */
  key: string;
  /** Primary instruction line */
  line1: string;
  /** Secondary detail (optional) */
  line2?: string;
  /** Auto-dismiss after this many ms (default: none) */
  autoHideMs?: number;
}

export function showOnboardHint(opts: OnboardHintOptions): () => void {
  const storageKey = SEEN_PREFIX + opts.key;

  // Don't show if already seen
  try {
    if (localStorage.getItem(storageKey)) return () => {};
  } catch {
    /* storage unavailable — show anyway */
  }

  const el = document.createElement('div');
  el.className = 'onboard-hint';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `
    <p class="onboard-line1">${opts.line1}</p>
    ${opts.line2 ? `<p class="onboard-line2">${opts.line2}</p>` : ''}
    <span class="onboard-dismiss">Press any key or tap to start</span>
  `;

  document.body.appendChild(el);

  // Force reflow then add visible class for entrance animation
  void el.offsetWidth;
  el.classList.add('onboard-visible');

  const dismiss = () => {
    if (!el.parentElement) return;
    el.classList.remove('onboard-visible');
    el.classList.add('onboard-exit');

    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }

    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // Fallback removal if transition doesn't fire
    setTimeout(() => el.remove(), 400);
  };

  // Dismiss on any interaction
  const handler = () => {
    dismiss();
    document.removeEventListener('pointerdown', handler, true);
    document.removeEventListener('keydown', handler, true);
  };

  // Small delay so the hint is visible before being instantly dismissed
  setTimeout(() => {
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('keydown', handler, true);
  }, 300);

  if (opts.autoHideMs) {
    setTimeout(dismiss, opts.autoHideMs);
  }

  return dismiss;
}
