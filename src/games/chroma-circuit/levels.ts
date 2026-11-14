import { artwork, palette, SIZE, type Color } from './art';
import { lap, SLOT_COUNT, type Level, type Source } from './engine';

type Move = [Source, number];

const colors = Object.keys(palette) as Color[];

function buildLevel(art: typeof artwork[number], index: number): { level: Level; solution: Move[] } {
  const lanes: Level['lanes'] = Array.from({ length: SLOT_COUNT }, () => []);
  const solution: Move[] = [];
  const tiles = [...art.tiles];
  const limit = [29, 27, 25, 23, 21, 19][index];

  while (tiles.some(Boolean)) {
    const opening = index === 0 && solution.length === 0;
    const options = colors.map(color => {
      const board = [...tiles];
      const hits = lap(board, color, opening ? SIZE * 4 : limit);
      const extra = opening ? lap(board, color, limit) : 0;
      return { color, hits, extra, board };
    });
    // The tutorial opens with a shooter that needs a second pass.
    options.sort((a, b) => Number(b.extra > 0) - Number(a.extra > 0) || b.hits - a.hits);
    const { color, hits, extra, board } = options[0];
    tiles.splice(0, tiles.length, ...board);
    const step = solution.length;
    const slot = (step * 3 + Math.floor(step / SLOT_COUNT) * index) % SLOT_COUNT;
    lanes[slot].push({ color, ammo: hits + extra });
    solution.push(['supply', slot]);
    if (extra > 0) solution.push(['waiting', 0]);
  }

  return { level: { ...art, lanes }, solution };
}

// Build in the original order to preserve the ammo and lanes used in playtesting.
const originalPuzzles = artwork.map(buildLevel);
export const originalLevelNames = originalPuzzles.map(({ level }) => level.name);

const [panda, cottage, koi, observatory, sundae, terrarium] = originalPuzzles;
export const puzzles = [panda, sundae, observatory, cottage, koi, terrarium];
