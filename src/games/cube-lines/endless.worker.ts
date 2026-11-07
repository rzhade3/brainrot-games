import { generateLevel, endlessSpec, GenerationExhaustedError } from './generate';
import type { Layout } from './rules';
import { GENERATOR_EDITION, puzzleSignature, type GenerationRequest, type GenerationResponse } from './endless';
import { selectEndlessPreset, parsePuzzleCode } from './puzzle-code';
import { CATALOG, catalogKey } from './catalog';
import { catalogQuality } from './catalog-quality';

const FRESH_ATTEMPTS = 8;

// This file is built as a dedicated module worker, not imported into the gameplay thread.
function respond(message: GenerationResponse): void {
  self.postMessage(message);
}

self.addEventListener('message', ({ data }: MessageEvent<GenerationRequest>) => {
  try {
    if (data.code !== undefined) {
      const code = parsePuzzleCode(data.code);
      const layout = generateLevel(endlessSpec(code.preset * 5), code.seed);
      respond({ ok: true, puzzle: { ...code, layout } });
      return;
    }
    const preset = selectEndlessPreset(data.cleared);
    const spec = endlessSpec(preset * 5);
    const recentSeeds = new Set(data.recent.map(item => item.seed));
    const seen = new Set(data.catalogSeen);
    const unseenCatalog: number[] = [];
    const playedCatalog: number[] = [];
    for (const seed of CATALOG.presets[preset]) {
      if (recentSeeds.has(seed)) continue;
      const pool = seen.has(catalogKey({ edition: GENERATOR_EDITION, preset, seed })) ? playedCatalog : unseenCatalog;
      pool.push(seed);
    }

    // Prefer unseen puzzles. If the fresh search runs out, finish checking the
    // curated pool at this preset, including cubes outside the recent window.
    for (let attempt = 0; attempt < FRESH_ATTEMPTS || unseenCatalog.length || playedCatalog.length; attempt++) {
      const candidates = unseenCatalog.length ? unseenCatalog : attempt >= FRESH_ATTEMPTS ? playedCatalog : [];
      const random = crypto.getRandomValues(new Uint32Array(1))[0];
      const fromCatalog = candidates.length > 0;
      const seed = fromCatalog
        ? candidates.splice(Math.floor(random / 0x100000000 * candidates.length), 1)[0]
        : random;
      if (!fromCatalog && (recentSeeds.has(seed) || seen.has(catalogKey({ edition: GENERATOR_EDITION, preset, seed })))) continue;
      let layout: Layout;
      try {
        layout = generateLevel(spec, seed);
      } catch (error) {
        if (!(error instanceof GenerationExhaustedError)) throw error;
        console.warn('Cube Lines skipped an exhausted seed:', seed, error.message);
        continue;
      }
      if (!fromCatalog && !catalogQuality(layout).accepted) continue;
      const signature = puzzleSignature(layout);
      if (data.recent.some(item => item.signature === signature)) continue;
      respond({ ok: true, puzzle: { edition: GENERATOR_EDITION, preset, seed, layout } });
      return;
    }
    throw new Error('Could not find a non-recent puzzle within the generation budget.');
  } catch (error) {
    respond({ ok: false, error: error instanceof Error ? error.message : 'Unknown generation error.' });
  }
});
