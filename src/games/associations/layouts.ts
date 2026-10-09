import data from './layouts.json';
import { LEVELS } from './levels';
import type { GameState } from './rules';

interface LayoutData {
  version: number;
  layouts: GameState[];
}

const layoutData = data as LayoutData;

if (layoutData.version !== 1 || layoutData.layouts.length !== LEVELS.length) {
  throw new Error('Associations level layouts are missing or incompatible.');
}

layoutData.layouts.forEach((layout, index) => {
  const level = index + 1;
  const spec = LEVELS[index];
  const ordered = layout.categories.filter((category) => category.ordered).length;
  if (
    layout.level !== level ||
    layout.columns.length !== spec.columns ||
    layout.slots.length !== spec.slots ||
    layout.categories.length !== spec.groups ||
    ordered !== spec.ordered ||
    layout.movesLeft !== layout.movesTotal ||
    layout.movesTotal <= 0
  ) {
    throw new Error(`Associations level ${level} does not match its specification.`);
  }
});

export function getLevelLayout(level: number): GameState {
  const layout = layoutData.layouts[level - 1];
  if (!layout) throw new RangeError(`Unknown Associations level: ${level}`);

  return {
    ...layout,
    categories: layout.categories.map((category) => ({ ...category })),
    columns: layout.columns.map((column) => column.map((card) => ({ ...card }))),
    stock: layout.stock.map((card) => ({ ...card })),
    waste: layout.waste.map((card) => ({ ...card })),
    slots: layout.slots.map((slot) => slot ? { ...slot } : null),
  };
}

export function getLevelCardCount(level: number): number {
  const layout = layoutData.layouts[level - 1];
  return layout ? layout.categories.reduce((total, category) => total + category.size + 1, 0) : 0;
}
