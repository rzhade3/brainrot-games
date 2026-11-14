---
name: untangle-levels
description: Design Untangle puzzles or tune procedural graph complexity and difficulty progression.
---

# Untangle level authoring

Start at `newPuzzle(solved)` in `src/games/untangle/state.ts` for the node-count curve and in `clusters.ts` for graph shape and starting positions. The generator constructs a planar solution before scrambling. An authored board should likewise have a known crossing-free embedding, and `crossingFlags()` should detect a crossing in its starting arrangement so it has something to solve.

Puzzles persist their points and edges. Keep coordinates normalized, edge endpoints within the point array, and the existing save parser’s 20-point cap in mind when enlarging boards. Run `npm run test:untangle` and try the changed boards at small and large viewport sizes to check that densely crossed edges and nodes can still be manipulated.
