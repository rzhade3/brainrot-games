import { FACES, headFace, metrics, solve, turns, validateLayout, type Layout } from './rules';
import { GenerationIndex, generationSurface } from './generation-index';
import type { LevelSpec } from './levels';

export class GenerationExhaustedError extends Error {}

function random(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function meetsSpec(layout: Layout, spec: LevelSpec): boolean {
  const m = metrics(layout);
  return meetsTargets(layout.lines.length, m,
    layout.lines.filter(line => turns(line) >= 2).length / layout.lines.length, spec) &&
    FACES.every(face => layout.lines.filter(line => headFace(line) === face).length >= 2 &&
      layout.lines.reduce((count, line) => count + line.cells.filter(cell => cell.face === face).length, 0) >= spec.size ** 2 * 0.4);
}

function meetsTargets(count: number, m: ReturnType<typeof metrics>, multiTurn: number, spec: LevelSpec): boolean {
  return count >= spec.minLines &&
    m.faceGroups === 1 && count - m.blocked >= 3 && m.depth <= Math.ceil(count * 0.8) &&
    m.density >= spec.minDensity && m.bent >= spec.minBent &&
    m.blocked / count >= spec.minBlockedRatio && m.depth >= spec.minDepth &&
    m.long >= spec.minLong && m.wrapped >= spec.minWrapped && m.crossFace >= spec.minCrossFace &&
    multiTurn >= spec.minMultiTurn;
}

export function generateLevel(spec: LevelSpec, seed = 0x43554245 + spec.level * 7919): Layout {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Cube Lines: seed must be an unsigned 32-bit integer.');
  }
  const rng = random(seed);
  const integer = (max: number) => Math.floor(rng() * max);
  const surface = generationSurface(spec.size);
  let best: GenerationIndex | null = null;
  let bestCount = 0;
  const used = new Uint32Array(surface.count);
  let stamp = 0;
  for (let attempt = 0; attempt < 100; attempt++) {
    const index = new GenerationIndex(surface);
    let exits: number[] = [];
    for (let trial = 0; trial < 12000 * (spec.size / 8) ** 2; trial++) {
      let start: number;
      if (exits.length && rng() < 0.35) start = exits[integer(exits.length)];
      else {
        const face = integer(6);
        const x = integer(spec.size);
        const y = integer(spec.size);
        start = face * spec.size ** 2 + y * spec.size + x;
      }
      if (index.owner[start] !== -1) continue;
      const cells: number[] = [start];
      const wanted = 4 + integer(spec.maxLength - 3);
      if (++stamp === 0xffffffff) {
        used.fill(0);
        stamp = 1;
      }
      used[start] = stamp;
      let crossings = 0;
      for (let i = 1; i < wanted; i++) {
        const previous = cells[cells.length - 1];
        const previousFace = surface.faces[previous];
        const choices: number[] = [];
        for (let d = 0; d < 4; d++) {
          const cell = surface.neighbors[previous * 4 + d];
          // Two seam crossings already limit a path to at most three distinct faces.
          if (index.owner[cell] === -1 && used[cell] !== stamp &&
            (surface.faces[cell] === previousFace || crossings < 2)) choices.push(cell);
        }
        if (!choices.length) break;
        const crossing = choices.find(cell => surface.faces[cell] !== previousFace);
        const next = crossing !== undefined && rng() < 0.8 ? crossing : choices[integer(choices.length)];
        if (surface.faces[next] !== previousFace) crossings++;
        cells.push(next);
        used[next] = stamp;
      }
      if (cells.length < 3) continue;
      const ray = surface.exitRay(cells[cells.length - 2], cells[cells.length - 1]);
      if (!ray.length && rng() < 0.95) continue;
      if (ray.some(cell => used[cell] === stamp || index.owner[cell] !== -1)) continue;
      const obstructs = index.obstructedBy(cells);
      if (index.bodies.length && !obstructs.length && rng() < 0.99) continue;
      if (obstructs.length && !obstructs.some(id => index.blockerCounts[id] === 0) && rng() < 0.6) continue;
      // Reward dependencies between different head faces, not just lines painted over a seam.
      if (obstructs.length && !obstructs.some(id => index.headFaces[id] !== surface.faces[cells[cells.length - 1]]) && rng() < 0.5) continue;
      index.add(cells, ray, obstructs);
      exits = index.freeExits();
      if (index.bodies.length > bestCount) {
        best = index;
        bestCount = index.bodies.length;
      }
      // Preserve rounding at exact density thresholds so old seeds keep their layouts.
      if (index.occupied < spec.minDensity * 6 * spec.size ** 2 || index.bodies.length < spec.minLines) continue;
      const m = index.metrics();
      if (!meetsTargets(index.bodies.length, m, m.multiTurn, spec) ||
        !index.faceHeads.every((heads, face) => heads >= 2 && index.faceCoverage[face] >= spec.size ** 2 * 0.4)) continue;
      const layout = index.layout();
      validateLayout(layout);
      if (!meetsSpec(layout, spec)) throw new Error('Cube Lines: indexed quality metrics differ from production rules.');
      if (solve(layout)?.length !== layout.lines.length) throw new Error('Cube Lines: reverse construction produced an unsolvable puzzle.');
      return layout;
    }
  }
  const diagnostic = best?.layout() ?? { size: spec.size, lines: [] };
  throw new GenerationExhaustedError(`Cube Lines level ${spec.level}, seed ${seed}: generation exhausted. ` +
    `Best candidate: ${diagnostic.lines.length} lines, ${JSON.stringify(metrics(diagnostic))}. Retry with a new seed.`);
}

// Edition-one code presets are independent of campaign tuning. Preserve exact numeric values.
const EDITION_ONE_PRESETS: readonly Readonly<LevelSpec>[] = [
  { level: 1, size: 8, minLines: 24, maxLength: 18, minDensity: 0.65, minBent: 0.75,
    minMultiTurn: 0.6, minBlockedRatio: 0.6, minDepth: 5, minLong: 0.35, minWrapped: 0.3, minCrossFace: 0.2 },
  { level: 1, size: 9, minLines: 27, maxLength: 23, minDensity: 0.65, minBent: 0.75,
    minMultiTurn: 0.6, minBlockedRatio: 0.61, minDepth: 5, minLong: 0.35, minWrapped: 0.325, minCrossFace: 0.225 },
  { level: 1, size: 10, minLines: 30, maxLength: 28, minDensity: 0.65, minBent: 0.75,
    minMultiTurn: 0.6, minBlockedRatio: 0.62, minDepth: 6, minLong: 0.35, minWrapped: 0.35, minCrossFace: 0.25 },
  { level: 1, size: 11, minLines: 33, maxLength: 33, minDensity: 0.65, minBent: 0.75,
    minMultiTurn: 0.6, minBlockedRatio: 0.63, minDepth: 6, minLong: 0.35, minWrapped: 0.375, minCrossFace: 0.275 },
  { level: 1, size: 12, minLines: 36, maxLength: 38, minDensity: 0.65, minBent: 0.75,
    minMultiTurn: 0.6, minBlockedRatio: 0.64, minDepth: 7, minLong: 0.35, minWrapped: 0.4, minCrossFace: 0.30000000000000004 },
  { level: 1, size: 12, minLines: 36, maxLength: 38, minDensity: 0.66, minBent: 0.75,
    minMultiTurn: 0.6, minBlockedRatio: 0.655, minDepth: 7, minLong: 0.35, minWrapped: 0.4, minCrossFace: 0.30000000000000004 },
];

export function endlessSpec(cleared: number): LevelSpec {
  if (!Number.isSafeInteger(cleared) || cleared < 0) throw new Error('Cube Lines: invalid endless progress.');
  return { ...EDITION_ONE_PRESETS[Math.min(5, Math.floor(cleared / 5))] };
}
