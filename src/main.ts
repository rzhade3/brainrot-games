import './style.css';
import { getAllBestScores } from './core/scores';

type GameEntry = {
  title: string;
  emoji: string;
  description: string;
  href: string;
  ready: boolean;
  /** Key matching the scores module (used for hub best-score display). */
  scoreKey?: string;
  /** Label for the score (e.g. "pts", "waves", "nodes"). */
  scoreLabel?: string;
};

const games: GameEntry[] = [
  { title: 'Hole City', emoji: '🕳️', description: 'A little hole. A big appetite. Swallow the city and outgrow five rivals in two minutes.', href: './games/hole-city/', ready: true, scoreKey: 'hole-city-classic-v2', scoreLabel: 'pts' },
  {
    title: 'Fieldwork',
    emoji: '🚜',
    description: 'Neat furrows. Tight turns. Work every acre with three ploughs and six increasingly tricky fields.',
    href: './games/fieldwork/',
    ready: true,
    scoreKey: 'fieldwork-fuel',
    scoreLabel: 'pts',
  },
  {
    title: 'Break Rot',
    emoji: '🧱',
    description: 'Breach packed chambers, multiply your swarm, and catch the fallout. A fresh ball every wave.',
    href: './games/breakout/',
    ready: true,
    scoreKey: 'breakout-v3',
    scoreLabel: 'pts',
  },
  {
    title: 'Cube Lines',
    emoji: '🧊',
    description: 'Turn the cube, trace the arrows, and clear all six sides. Thirty puzzles. No rush.',
    href: './games/cube-lines/',
    ready: true,
    scoreKey: 'cube-lines',
    scoreLabel: 'levels',
  },
  {
    title: 'Untangle',
    emoji: '🧶',
    description: 'Untangle clusters so no strings cross. They collapse, zoom out, and never end.',
    href: './games/untangle/',
    ready: true,
    scoreKey: 'untangle',
    scoreLabel: 'nodes',
  },
  {
    title: 'Type Rot',
    emoji: '⌨️',
    description: 'Type the words before they escape. They only get faster.',
    href: './games/typing/',
    ready: true,
    scoreKey: 'typing',
    scoreLabel: 'pts',
  },
  {
    title: 'Tower Defense',
    emoji: '🏰',
    description: 'Mine ore, power turrets, and defend your castle from escalating waves.',
    href: './games/tower-defense/',
    ready: true,
    scoreKey: 'tower-defense',
    scoreLabel: 'waves',
  },
  {
    title: 'Associations',
    emoji: '🃏',
    description: 'Word solitaire: stack every word on its category before your moves run out.',
    href: './games/associations/',
    ready: true,
    scoreKey: 'associations',
    scoreLabel: 'levels',
  },
  {
    title: 'Top Down',
    emoji: '🕹️',
    description: 'A top-down adventure. Coming soon.',
    href: './games/top-down/',
    ready: false,
  },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
const bestScores = getAllBestScores();

app.innerHTML = `
  <a class="skip-link" href="#game-list">Skip to games</a>
  <header class="hub-header">
    <h1>Brainrot Games</h1>
    <p>A little arcade of browser games. Installable, offline-ready.</p>
  </header>
  <main class="game-grid" id="game-list" role="list">
    ${games
      .map(
        (g) => {
          const best = g.scoreKey ? bestScores[g.scoreKey] : undefined;
          const bestBadge = best != null && best > 0
            ? `<span class="best-score" aria-label="Best score: ${best} ${g.scoreLabel}">Best: ${best} ${g.scoreLabel}</span>`
            : '';
          return `
      <a class="game-card ${g.ready ? '' : 'disabled'}" ${g.ready ? `href="${g.href}"` : 'aria-disabled="true" tabindex="-1"'} role="listitem">
        <span class="emoji" aria-hidden="true">${g.emoji}</span>
        <h2>${g.title}</h2>
        <p>${g.description}</p>
        ${bestBadge}
        <span class="badge ${g.ready ? '' : 'soon'}">${g.ready ? 'Play' : 'Coming soon'}</span>
      </a>`;
        }
      )
      .join('')}
  </main>
`;
