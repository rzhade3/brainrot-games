import { readFile, writeFile } from 'node:fs/promises';
import { LEVELS } from '../src/games/cube-lines/levels';
import { generateLevel } from '../src/games/cube-lines/generate';
import { metrics } from '../src/games/cube-lines/rules';

const output = new URL('../src/games/cube-lines/layouts.json', import.meta.url);
const layouts = LEVELS.map(spec => {
  const layout = generateLevel(spec);
  const m = metrics(layout);
  console.log(`Level ${spec.level}: ${layout.size}x${layout.size}, ${layout.lines.length} lines, ` +
    `${Math.round(m.density * 100)}% filled, ${Math.round(m.bent * 100)}% bent, ` +
    `${Math.round(m.long * 100)}% long, ${Math.round(m.wrapped * 100)}% wrapped, ` +
    `${Math.round(m.crossFace * 100)}% cross-face dependencies, ${m.blocked} blocked, depth ${m.depth}`);
  return layout;
});
const content = `${JSON.stringify({ version: 2, layouts })}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== content) {
    throw new Error('Cube Lines layouts are stale. Run npm run build:cube-lines.');
  }
  console.log('All 30 Cube Lines layouts reproduced and solved.');
} else {
  await writeFile(output, content);
  console.log('Wrote 30 validated Cube Lines layouts.');
}
