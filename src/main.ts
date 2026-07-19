import './style.css';

type GameEntry = {
  title: string;
  emoji: string;
  description: string;
  href: string;
  ready: boolean;
};

const games: GameEntry[] = [
  {
    title: 'Untangle',
    emoji: '🧶',
    description: 'Untangle clusters so no strings cross. They collapse, zoom out, and never end.',
    href: './games/untangle/',
    ready: true,
  },
  {
    title: 'Type Rot',
    emoji: '⌨️',
    description: 'Type the words before they escape. They only get faster.',
    href: './games/typing/',
    ready: true,
  },
  {
    title: 'Tower Defense',
    emoji: '🏰',
    description: 'Mine ore, power turrets, and defend your castle from escalating waves.',
    href: './games/tower-defense/',
    ready: true,
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

app.innerHTML = `
  <a class="skip-link" href="#game-list">Skip to games</a>
  <header class="hub-header">
    <h1>Brainrot Games</h1>
    <p>A little arcade of browser games. Installable, offline-ready.</p>
  </header>
  <main class="game-grid" id="game-list" role="list">
    ${games
      .map(
        (g) => `
      <a class="game-card ${g.ready ? '' : 'disabled'}" ${g.ready ? `href="${g.href}"` : 'aria-disabled="true" tabindex="-1"'} role="listitem">
        <span class="emoji" aria-hidden="true">${g.emoji}</span>
        <h2>${g.title}</h2>
        <p>${g.description}</p>
        <span class="badge ${g.ready ? '' : 'soon'}">${g.ready ? 'Play' : 'Coming soon'}</span>
      </a>`
      )
      .join('')}
  </main>
`;
