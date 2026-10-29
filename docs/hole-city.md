# Hole City

Open `/games/hole-city/` or choose **Hole City** in the arcade. Move with WASD,
arrow keys, or drag anywhere in the city using a mouse or touch. Eat smaller
objects to grow from pedestrians and bins to trees, cars, houses, towers, and landmark skyscrapers. Every match uses a fresh city seed,
with six sidewalk starts, continuous snack trails, parks, and traffic routes.
Compete against five local AI rivals for the highest score in up to two minutes.
Rivals seek food, hunt smaller holes, and flee larger holes. The match finishes
immediately when every city object is eaten, with a city-clear summary and the
time left. If nobody can eat any remaining object or grow by swallowing a rival,
the feast ends early too. The HUD counts down the remaining objects.
A hole can swallow another when its radius is more than 30% larger. The swallowed
hole loses 20% of its score to the attacker, shrinks accordingly, and returns at
the opposite edge after five seconds. Captures transfer points rather than
creating score from repeated respawns.
Pause with P, Escape, or the header button. Leaving the window pauses the match.
Nearby edible props have gold ground rings. Rival rims turn mint when swallowable
and red when dangerous; a nearby-rival label explains size parity. The growth
bar reports points until the next milestone. A running bite tally rewards
continuous routes visually; it is not a score multiplier.

Objects stay at their world position while falling. The hole must cover their
whole horizontal footprint until the top clears the ground. Moving away too
quickly catches the rim and the object settles back uneaten; scoring and growth
happen only after a completed swallow. Trees include the crown in their footprint,
and buildings include roof corners. A larger opening gives more room to move.
Small snacks fall quickly; trees, vehicles, and buildings need a longer hold.
AI rivals hold their bites unless fleeing danger. Being swallowed releases any
objects that were still falling. These are conservative footprint checks rather
than rigid-body physics; objects do not tip, slide, or transfer between mouths.

Small props use shared instanced geometry to keep the denser city efficient.

Best scores appear in the shared arcade score store under `hole-city-classic-v2`.
Earlier scores remain stored but are not compared against this retuned economy.
The timer uses elapsed active time, independent of capped movement steps.
Rivals run locally; there is no network multiplayer.

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

## Classic pacing checks

`node --import tsx scripts/simulate-hole-city.ts` runs five seeded two-minute
matches with a greedy, threat-aware player and five rivals. It reports the first
consumed object of each tier, final score, and remaining food. This probe ignores
rendering and human decision time; it does not establish subjective fun.

With continuous rim checks and a 30 Hz simulation step, seeds 718, 42, 2026,
891, and 15 reached cars at 13.5–14.8 seconds and houses at 27.6–34.1 seconds.
Three runs reached towers at 54.6–66 seconds and landmarks at 89.5–102.7 seconds;
the other two lost ground to rivals. All five retained food through 120 seconds.
The script rejects stalled economies, clears before 90 seconds, openings taking
over 35 seconds to reach houses, or captures creating extra total score.
The house milestone was reduced from 600 to 450 points to account for bite holds.
The previous instant-consumption pacing measurements no longer apply.

The original version's nearest-food AI and size curve are different, so these
figures compare tuning candidates, not equivalent before/after human sessions.
