---
name: type-rot-levels
description: Add Type Rot typing content or tune its endless difficulty, spawn pacing, and word pool.
---

# Type Rot level authoring

Type Rot uses a single endless run. Add words to `src/games/typing/dictionary.txt` as one lowercase entry per line. `engine.ts` matches against trimmed, lowercased player input. Keep words typeable with the game’s current input handling. Inspect the keyboard handler in `main.ts` before adding punctuation or non-ASCII entries.

Tune spawn probability and speed progression in `src/games/typing/main.ts`. If the request calls for authored stages, use the existing round loop and reset path as the integration point. Run `npm run test:typing` for matching and scoring, then play a run to check the new words, speed ramp, and restart behavior.
