# Hole City

Open `/games/hole-city/` or choose **Hole City** in the arcade. Move with WASD, arrow keys, or drag anywhere in the city using a mouse or touch. Eat smaller objects to grow from pedestrians and bins to trees, cars, houses, towers, and landmark skyscrapers. Every match uses a fresh city seed, with six sidewalk starts, continuous snack trails, parks, and traffic routes. Compete against five local AI rivals for the highest score in up to two minutes. Rivals look for edible clusters and growth milestones, aim ahead of moving prey, and look for safe escape routes around larger holes. At full pace they move at 92.2% of the speed of a same-sized player. When they have no target, they scout different sectors at a slower pace, favoring quieter areas and skipping recent destinations. The match finishes immediately when every city object is eaten, with a city-clear summary and the time left. If nobody can eat any remaining object or grow by swallowing a rival, the feast ends early too. The HUD counts down the remaining objects. A hole can swallow another when its radius is more than 30% larger. The swallowed hole loses 20% of its score to the attacker, shrinks accordingly, and returns at the opposite edge after five seconds. Captures transfer points rather than creating score from repeated respawns. Pause with P, Escape, or the header button. Leaving the window pauses the match. Nearby edible props have gold ground rings. Rival rims turn mint when swallowable and red when dangerous; a nearby-rival label explains size parity. The growth bar reports points until the next milestone. A running bite tally rewards continuous routes visually; it is not a score multiplier.

Floor objects fall straight down. Stock on displays slides toward the spot where the hole caught it. Bites allow substantial rim overlap and a 100 ms grace period if the opening slips away. Once 45% of the fall has completed while supported, the bite is secured and you can move on. Falls are shorter too: trees take 180 ms, cars 240 ms, and buildings 400–700 ms. Moving well away before securing the bite still restores the object uneaten. Points arrive only when the fall completes; a respawning owner still releases pending food. AI rivals resume moving as soon as a bite is secured.

Small props use shared instanced geometry to keep the denser city efficient.

Choose **Downtown** or **Supermarket** from the launch screen. Downtown has pedestrians on the sidewalks and moving cars in the streets. In Supermarket, pull individual fruit from stepped displays, sweep the aisles for cans, and visit the bakery tables and dairy cases. Shoppers abandon their carts and sprint away from nearby holes. You can swallow the carts separately once you reach cart size. Cars pull into and back out of spaces in the parking lot. Produce gives you a start, and the other departments have the points needed to reach the large fixtures. Any remaining stock drops to the floor when you eat its fixture. You can replay the same map or change maps from the pause and results screens.

Each map has its own personal best. The arcade card shows Downtown's score, stored as `hole-city-classic-v2`. The rebalanced Supermarket uses `hole-city-supermarket-v2` for its personal best in the map picker and match results. Earlier Supermarket scores stay in their original storage entry. The timer uses elapsed active time, independent of capped movement steps. Rivals run locally; there is no network multiplayer.

## Visual references and assets

Reviewed online image search results for Hole.io, especially the tilted city view, colored hole rims, street props, and growth from small objects to buildings:

- [Hole.io screenshot gallery](https://www.4gamer.net/games/810/G081004/screenshot.html)
- [Gameplay screenshots](https://www.gamekarma.com/g/hole-io/)
- [Official Google Play listing](https://play.google.com/store/apps/details?id=io.voodoo.holeio)

All city meshes are original procedural Three.js geometry: houses and rooftop vents, windowed towers, low-poly trees, cars, bins, and pedestrians. Materials, road markings, and hole rings are generated locally. There are no downloaded models, textures, fonts, or runtime asset requests. Three.js was already a project dependency. Original presentation inspired by Hole.io; no affiliation with Voodoo.

## Validation

`npm run test:hole-city` checks consumption thresholds, growth caps, normalized movement, world boundaries, and reproducible city generation. `npm run build` type-checks and builds the arcade, including the new route in the PWA cache.

## Classic pacing checks

`node --import tsx scripts/simulate-hole-city.ts` runs five seeded two-minute matches with a fixed greedy player and the in-game rivals. Add `--supermarket` to probe the grocery map, including whether competitors reach whole shelves. Use `--produce-only` to confine the player to produce and check whether camping still wins or unlocks large fixtures. Add `--classic-rivals` to compare the previous opponents against the same benchmark player. The report includes the simulated player's unlock times, final score, rank, captures against the player, and remaining food. This probe ignores rendering and human decision time.

The simulator uses a 30 Hz step. Its opening guard checks that a competitor eats a house in Downtown or a counter or car in Supermarket within 35 seconds. It also rejects stalled economies, clears before 90 seconds, and score inflation. Earlier strict-rim timing measurements no longer apply to this more forgiving version.

The original version's nearest-food AI and size curve are different, so these figures compare tuning candidates, not equivalent before/after human sessions.
