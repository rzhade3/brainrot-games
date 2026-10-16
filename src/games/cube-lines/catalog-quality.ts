import { metrics, removable, type Layout } from './rules';

export function catalogQuality(layout: Layout) {
  const m = metrics(layout);
  let lines = layout.lines;
  let forced = 0;
  let run = 0;
  let longestForcedRun = 0;
  while (lines.length) {
    const choices = removable(lines, layout.size);
    if (!choices.length) throw new Error('Catalog puzzle has no solution.');
    // Ignore the final three cleanup moves when measuring forced sequences.
    if (lines.length > 3) {
      run = choices.length === 1 ? run + 1 : 0;
      if (run) forced++;
      longestForcedRun = Math.max(longestForcedRun, run);
    }
    const id = choices[0].id;
    lines = lines.filter(line => line.id !== id);
  }
  const openingChoices = layout.lines.length - m.blocked;
  const forcedRatio = forced / Math.max(1, layout.lines.length - 3);
  const accepted = openingChoices >= 3 && openingChoices <= 8 &&
    m.depth <= layout.lines.length * 0.65 && m.wrapped >= 0.65 && m.crossFace >= 0.4 &&
    longestForcedRun <= 6 && forcedRatio <= 0.35;
  const score = m.crossFace + m.wrapped - Math.abs(m.depth / layout.lines.length - 0.4) - forcedRatio;
  return { accepted, score, openingChoices, longestForcedRun, forcedRatio };
}
