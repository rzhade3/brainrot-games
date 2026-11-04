# Arcade asset benchmark

Measured from the production build on 2026-11-04. Full-arcade precaching is intentional:
after installation, every game should remain available offline. This audit leaves that behavior unchanged.

## Results

The complete offline pack, including the service worker and Workbox runtime, is **3.21 MiB raw**,
**1.23 MiB with gzip**, or **1.18 MiB with Brotli**. Cache/disk use is closer to raw size;
compressed figures estimate transfer size, not memory use or actual on-device storage overhead.

| Cold page and its assets | Raw KiB | Gzip KiB |
| --- | ---: | ---: |
| associations | 120.1 | 27.1 |
| breakout | 52.1 | 21.0 |
| cube-lines | 865.2 | 179.1 |
| fieldwork | 31.8 | 13.1 |
| gate-runner | 451.9 | 426.0 |
| hole-city | 515.3 | 135.6 |
| top-down | 1466.7 | 339.4 |
| tower-defense | 1481.2 | 344.6 |
| typing | 237.8 | 221.4 |
| untangle | 1471.2 | 342.2 |
| Arcade homepage | 27.7 | 13.4 |

These are independent cold-page estimates, **not additional downloads once the offline pack is cached**.
Do not sum the rows: Phaser, Three.js, utilities, icons and other assets are shared.
Top Down is an unlisted placeholder but is still built and precached.
The homepage itself is small; its first production visit also triggers the full background precache.
Updates normally reuse unchanged assets rather than downloading the entire pack again.

## Main contributors

- Phaser shared bundle: 1,444.6 KiB raw / 329.7 KiB gzip. Used by Untangle, Tower Defense and Top Down.
- Three.js: 479.4 KiB raw / 121.1 KiB gzip. Shared by Cube Lines and Hole City.
- Cube Lines code and embedded puzzle data: 342.0 KiB raw / 40.2 KiB gzip.
- Gate Runner artwork: 388.7 KiB raw; these WebP images are already compressed.
- Type Rot's two JetBrains Mono weights: 184.7 KiB; WOFF2 is already compressed.
- Barlow Condensed is duplicated byte-for-byte under Gate Runner and Type Rot: about 21.9 KiB potential savings.

## Recommendation

Keep the full offline pack. Its size is reasonable for this arcade, and predictable offline availability
is more valuable than aggressively minimizing installation bytes.

Do not introduce custom engine builds, runtime-only game caching, or a font-subsetting pipeline solely
for this budget. Font subsetting might save roughly 150 KiB, but that is an estimate, not a measured
optimized result. It adds tooling and glyph-coverage maintenance. Deduplicating Barlow is simple but
only saves about 22 KiB of transfer (under 2% of the gzip pack). Neither is urgent.
If an actual performance problem appears, measure startup/parse/frame time separately: a large
JavaScript file can affect execution even when its transfer is small. Verify hosting serves compressed
JS/CSS/HTML before considering more intrusive asset changes.

## Reproduce and limitations

Run `npm run benchmark:assets`. The script builds with Vite's manifest and walks each HTML entry's
import graph, styles, declared icons, public media URLs and worker URLs. It includes all homepage
previews, even though offscreen previews are lazy-loaded. Public runtime files and Workbox precache
URLs are included; repeated URLs are counted once. The JSON includes the individual file lists,
largest assets and byte-identical duplicates.

Compression estimates use gzip level 9 and Brotli quality 6 on each file. This is a reproducible asset
benchmark, not measured network traffic, install duration, runtime memory, or a throttled device test.
Actual transfer depends on hosting compression and cache state; icon and lazy-image requests depend
on device/viewport. Future public assets referenced through new computed paths may require extending
the scanner. The service-worker install total remains authoritative for the full offline asset set.
