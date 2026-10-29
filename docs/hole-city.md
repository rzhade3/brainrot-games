# Hole City

Open `/games/hole-city/` or choose **Hole City** in the arcade. Move with WASD,
arrow keys, or drag anywhere in the city using a mouse or touch. Eat smaller
objects to grow from pedestrians and bins to trees, cars, houses, and towers.
Compete against five local AI rivals for the highest score in two minutes.
A hole can swallow another when its radius is at least 30% larger. The swallowed
hole returns at the opposite edge after three seconds and retains its size.
Pause with P, Escape, or the header button. Leaving the window pauses the match.
Best scores appear in the shared arcade score store. No network multiplayer.

## Visual references and assets

Reviewed online image search results for Hole.io, especially the tilted city view,
colored hole rims, street props, and growth from small objects to buildings:

- [Hole.io screenshot gallery](https://www.4gamer.net/games/810/G081004/screenshot.html)
- [Gameplay screenshots](https://www.gamekarma.com/g/hole-io/)
- [Official Google Play listing](https://play.google.com/store/apps/details?id=io.voodoo.holeio)

All city meshes are original procedural Three.js geometry: houses and rooftop
vents, windowed towers, low-poly trees, cars, bins, and pedestrians. Materials,
road markings, and hole rings are generated locally. There are no downloaded
models, textures, fonts, or runtime asset requests. Three.js was already a project
dependency. Original presentation inspired by Hole.io; no affiliation with Voodoo.

## Validation

`npm run test:hole-city` checks consumption thresholds, growth caps, normalized
movement, world boundaries, and reproducible city generation. `npm run build`
type-checks and builds the arcade, including the new route in the PWA cache.
