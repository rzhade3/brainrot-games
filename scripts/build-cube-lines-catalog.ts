import { writeFile } from 'node:fs/promises';
import { endlessSpec, generateLevel } from '../src/games/cube-lines/generate';
import { catalogQuality } from '../src/games/cube-lines/catalog-quality';
import { puzzleSignature } from '../src/games/cube-lines/endless';

const signatures = new Set<string>();
const presets: number[][] = [];
for (let preset = 0; preset < 6; preset++) {
  const spec = endlessSpec(preset * 5);
  const candidates: { seed: number; score: number; signature: string }[] = [];
  for (let i = 0; i < 128; i++) {
    const seed = (Math.imul(0x9e3779b9, i + 1) + preset * 7919) >>> 0;
    const layout = generateLevel(spec, seed);
    const quality = catalogQuality(layout);
    if (!quality.accepted) continue;
    candidates.push({ seed, score: quality.score, signature: puzzleSignature(layout) });
  }
  const selected = candidates.sort((a, b) => b.score - a.score || a.seed - b.seed)
    .filter(candidate => !signatures.has(candidate.signature)).slice(0, preset < 4 ? 17 : 16);
  if (selected.length !== (preset < 4 ? 17 : 16)) throw new Error(`Insufficient candidates for preset ${preset}.`);
  presets.push(selected.map(candidate => candidate.seed));
  selected.forEach(candidate => signatures.add(candidate.signature));
  console.log(`T${preset + 1}: screened 128 seeds, selected ${selected.length} cross-face puzzles.`);
}
await writeFile(new URL('../src/games/cube-lines/catalog.json', import.meta.url),
  `${JSON.stringify({ edition: 1, presets }, null, 2)}\n`);
