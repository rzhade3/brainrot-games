export const categories = ['All games', 'Arcade', 'Puzzles', 'Strategy'] as const;
export type Category = Exclude<typeof categories[number], 'All games'>;
export interface GameEntry {
  id: string;
  title: string;
  category: Category;
  description: string;
  emoji: string;
  color: string;
  preview?: string;
  score?: { key: string; unit: string };
}

// Add a game here. Its route is /games/{id}/; preview artwork is optional.
export const games: readonly GameEntry[] = [
  { id: 'pop-clinic', title: 'Pop Clinic', category: 'Arcade', description: 'Snip, pop, and peel through a queue of tiny makeovers.', emoji: '🩹', color: '#ffc1ac', preview: 'pop-clinic.webp' },
  { id: 'hole-city', title: 'Hole City', category: 'Arcade', description: 'Swallow the city and outgrow your rivals before time runs out.', emoji: '🕳️', color: '#eedbb6', preview: 'hole-city', score: { key: 'hole-city-classic-v2', unit: 'pts' } },
  { id: 'cube-lines', title: 'Cube Lines', category: 'Puzzles', description: 'Rotate the cube to find a clear exit for every arrow.', emoji: '🧊', color: '#c8bcff', preview: 'cube-lines', score: { key: 'cube-lines', unit: 'levels' } },
  { id: 'untangle', title: 'Untangle', category: 'Puzzles', description: 'Move the dots until no strings cross, then unravel the next web.', emoji: '🧶', color: '#bfe9d6', preview: 'untangle' },
  { id: 'gate-runner', title: 'Gate Runner', category: 'Arcade', description: 'Grow your squad through multiplier gates and survive the enemies ahead.', emoji: '🚀', color: '#b7d8fc', preview: 'gate-runner', score: { key: 'gate-runner', unit: 'pts' } },
  { id: 'breakout', title: 'Break Rot', category: 'Arcade', description: 'Keep multiplying balls in play as you smash through brick chambers.', emoji: '🧱', color: '#ffb8ac', preview: 'breakout', score: { key: 'breakout-v3', unit: 'pts' } },
  { id: 'fieldwork', title: 'Fieldwork', category: 'Strategy', description: 'Plough every acre without running out of fuel.', emoji: '🚜', color: '#d5dfa5', preview: 'fieldwork', score: { key: 'fieldwork-fuel', unit: 'pts' } },
  { id: 'typing', title: 'Type Rot', category: 'Arcade', description: 'Type the escaping words as the pace keeps climbing.', emoji: '⌨️', color: '#f5c8e6', preview: 'typing', score: { key: 'typing', unit: 'pts' } },
  { id: 'tower-defense', title: 'Tower Defense', category: 'Strategy', description: 'Mine resources and build defenses to keep your castle standing.', emoji: '🏰', color: '#f0cb86', preview: 'tower-defense', score: { key: 'tower-defense', unit: 'waves' } },
  { id: 'associations', title: 'Associations', category: 'Puzzles', description: 'Solitaire with words: sort each category before your moves run out.', emoji: '🃏', color: '#c3d1fc', preview: 'associations', score: { key: 'associations', unit: 'levels' } },
];
