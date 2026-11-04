import './arcade.css';
import { getAllBestScores } from './core/scores';
import { categories, games, type GameEntry } from './catalog';

const bestScores = getAllBestScores();
function card(game: GameEntry): string {
  const best = game.score ? bestScores[game.score.key] : undefined;
  return `<li class="arcade-item" data-category="${game.category}">
    <a class="arcade-card" href="/games/${game.id}/" style="--game-color:${game.color}" aria-labelledby="title-${game.id}" aria-describedby="description-${game.id}">
      <div class="arcade-preview" aria-hidden="true"><span>${game.emoji}</span>${game.preview ? `<img src="/assets/arcade/${game.preview}.svg" alt="" width="400" height="220" loading="lazy">` : ''}</div>
      <div class="arcade-card-body"><span class="arcade-category">${game.category}</span><h3 id="title-${game.id}">${game.title}</h3><p id="description-${game.id}">${game.description}</p>
      <div class="arcade-card-foot">${typeof best === 'number' && Number.isFinite(best) && best > 0 ? `<span class="arcade-best">Best: ${best.toLocaleString()} ${game.score!.unit}</span>` : '<span></span>'}<span class="arcade-play">Play <span aria-hidden="true">↗</span></span></div></div>
    </a></li>`;
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="arcade-skip" href="#games">Skip to games</a>
  <header class="arcade-header" id="top"><a class="arcade-brand" href="/" aria-label="Brainrot Games homepage">brainrot</a></header>
  <main class="arcade-main">
    <section class="arcade-library" aria-labelledby="games-title"><div class="arcade-library-head"><h1 id="games-title">The arcade</h1><p id="arcade-count" role="status" aria-live="polite">${games.length} games</p></div>
    <div class="arcade-filters" role="group" aria-label="Filter games">${categories.filter(category => category === 'All games' || games.some(game => game.category === category)).map(category => `<button type="button" data-filter="${category}" aria-label="${category}" aria-pressed="${category === 'All games'}">${category === 'All games' ? 'All' : category}</button>`).join('')}</div>
    <ul class="arcade-grid" id="games" tabindex="-1">${games.map(card).join('')}</ul></section>
  </main><footer class="arcade-footer"><a href="#top">Back to top ↑</a></footer>`;

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => button.addEventListener('click', () => {
  const selected = button.dataset.filter as typeof categories[number];
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
  document.querySelectorAll<HTMLElement>('.arcade-item').forEach(item => { item.hidden = selected !== 'All games' && item.dataset.category !== selected; });
  const count = games.filter(game => selected === 'All games' || game.category === selected).length;
  document.getElementById('arcade-count')!.textContent = `${count} ${count === 1 ? 'game' : 'games'}`;
}));
document.querySelectorAll<HTMLImageElement>('.arcade-preview img').forEach(img => {
  img.addEventListener('error', () => img.remove(), { once: true });
});
