/**
 * Shared high-score persistence for all Brainrot Games.
 *
 * Stores per-game best scores under a single namespaced localStorage key.
 * Extensible: new games just call `submitScore('game-key', value)`.
 *
 * Storage format: JSON object keyed by game slug.
 *   { "typing": 1200, "tower-defense": 14, "untangle": 87 }
 */

const STORAGE_KEY = 'brainrot-scores';

export interface GameScores {
  [gameKey: string]: number;
}

function readAll(): GameScores {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const scores: GameScores = raw ? JSON.parse(raw) : {};

    // One-time migration from the old typing high-score key
    if (!scores['typing']) {
      const legacy = localStorage.getItem('brainrotTypingHighScore');
      if (legacy) {
        const val = parseInt(legacy, 10);
        if (val > 0) scores['typing'] = val;
        writeAll(scores);
        localStorage.removeItem('brainrotTypingHighScore');
      }
    }

    return scores;
  } catch {
    return {};
  }
}

function writeAll(scores: GameScores): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    /* storage unavailable — silently degrade */
  }
}

/** Get the best score for a game, or 0 if none recorded. */
export function getBestScore(gameKey: string): number {
  return readAll()[gameKey] ?? 0;
}

/**
 * Submit a score for a game. Persists only if it beats the current best.
 * Returns the new best (which may be the old best if the submission didn't beat it).
 */
export function submitScore(gameKey: string, value: number): number {
  const scores = readAll();
  const prev = scores[gameKey] ?? 0;
  if (value > prev) {
    scores[gameKey] = value;
    writeAll(scores);
    return value;
  }
  return prev;
}

/** Get all recorded best scores (for the hub page). */
export function getAllBestScores(): GameScores {
  return readAll();
}
