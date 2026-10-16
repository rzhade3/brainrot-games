import { attemptMove, type Layout, type PuzzleLine } from './rules';

export class PuzzleSession {
  layout: Layout;
  busy = false;
  private revision = 0;

  constructor(readonly initial: Layout) {
    this.layout = initial;
  }

  restart(): void {
    this.revision++;
    this.busy = false;
    this.layout = this.initial;
  }

  begin(id: string): { blockedBy: readonly PuzzleLine[]; commit: (() => boolean) | null } | null {
    if (this.busy || !this.layout.lines.some(line => line.id === id)) return null;
    const move = attemptMove(this.layout, id);
    if (!move.removed) return { blockedBy: move.blockedBy, commit: null };
    this.busy = true;
    const revision = ++this.revision;
    return {
      blockedBy: [],
      commit: () => {
        if (revision !== this.revision || !this.busy) return false;
        this.layout = move.layout;
        this.busy = false;
        return true;
      },
    };
  }
}

export interface Save {
  version: 1;
  level: number;
  completed: number;
  removed: string[];
  introduced: boolean;
}

export function readSave(raw: string | null, layouts: readonly Layout[], best: number): Save {
  const completed = Number.isInteger(best) ? Math.max(0, Math.min(layouts.length, best)) : 0;
  if (!raw) return { version: 1, level: Math.min(completed + 1, layouts.length), completed, removed: [], introduced: completed > 0 };
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null ||
    !('version' in data) || data.version !== 1 ||
    !('completed' in data) || typeof data.completed !== 'number' || !Number.isInteger(data.completed) ||
    data.completed < 0 || data.completed > layouts.length ||
    !('level' in data) || typeof data.level !== 'number' || !Number.isInteger(data.level) ||
    data.level < 1 || data.level > Math.min(Math.max(completed, data.completed) + 1, layouts.length) ||
    ('introduced' in data && typeof data.introduced !== 'boolean') ||
    !('removed' in data) || !Array.isArray(data.removed) || !data.removed.every(id => typeof id === 'string')) {
    throw new Error('The saved puzzle is invalid.');
  }
  const level = data.level;
  let layout = layouts[level - 1];
  const removed: string[] = [];
  for (const id of data.removed) {
    const move = attemptMove(layout, id);
    if (!move.removed) throw new Error('The saved removal sequence does not match this puzzle.');
    removed.push(id);
    layout = move.layout;
  }
  return {
    version: 1, level, completed: Math.max(completed, data.completed), removed,
    introduced: ('introduced' in data && data.introduced === true) || completed > 0 || data.completed > 0 || removed.length > 0,
  };
}
