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
    description: 'Drag the nodes so none of the strings cross. Pure planarity brainrot.',
    href: './games/untangle/',
    ready: true,
  },
  {
    title: 'Tower Defense',
    emoji: '🏰',
    description: 'Place towers, stop the creeps. Coming soon.',
    href: './games/tower-defense/',
    ready: false,
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
  <header class="hub-header">
    <h1>Brainrot Games</h1>
    <p>A little arcade of browser games. Installable, offline-ready.</p>
  </header>
  <main class="game-grid">
    ${games
      .map(
        (g) => `
      <a class="game-card ${g.ready ? '' : 'disabled'}" href="${g.href}">
        <span class="emoji">${g.emoji}</span>
        <h2>${g.title}</h2>
        <p>${g.description}</p>
        <span class="badge ${g.ready ? '' : 'soon'}">${g.ready ? 'Play' : 'Coming soon'}</span>
      </a>`
      )
      .join('')}
  </main>
`;
