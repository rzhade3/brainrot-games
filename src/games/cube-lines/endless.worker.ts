import { generateLevel, endlessSpec, GenerationExhaustedError } from './generate';
import type { Layout } from './rules';
import { GENERATOR_EDITION, puzzleSignature, type GenerationRequest, type GenerationResponse } from './endless';
import { selectEndlessPreset, parsePuzzleCode } from './puzzle-code';
import { CATALOG, catalogKey } from './catalog';
import { catalogQuality } from './catalog-quality';

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
    const candidates = CATALOG.presets[preset].filter(seed =>
      !(data.catalogSeen ?? []).includes(catalogKey({ edition: GENERATOR_EDITION, preset, seed })) &&
      !data.recent.some(item => item.seed === seed));
    for (let attempt = 0; attempt < 8; attempt++) {
      const random = crypto.getRandomValues(new Uint32Array(1))[0];
      const fromCatalog = candidates.length > 0;
      const seed = fromCatalog
        ? candidates.splice(Math.floor(random / 0x100000000 * candidates.length), 1)[0]
        : random;
      if (data.recent.some(item => item.seed === seed)) continue;
      if ((data.catalogSeen ?? []).includes(catalogKey({ edition: GENERATOR_EDITION, preset, seed }))) continue;
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
    throw new Error('Could not find a fresh puzzle within the generation budget.');
  } catch (error) {
    respond({ ok: false, error: error instanceof Error ? error.message : 'Unknown generation error.' });
  }
});
