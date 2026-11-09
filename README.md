# Brainrot Games

An installable arcade PWA built with TypeScript and Vite. All games are cached for offline play.

## Get started

With Node.js and npm installed:

```sh
npm install
npm run dev
```

For a production build and local preview:

```sh
npm run build
npm run preview
```

Use the production preview to test installation and offline behavior; the development server is for live editing. Install through your browser’s install or Add to Home Screen action. Let the initial cache finish while online before testing offline play.

## Games

| Game | Goal |
| --- | --- |
| [Pop Clinic](games/pop-clinic/) | Complete tiny makeovers with snips, pops, and peels. |
| [Hole City](docs/hole-city.md) | Swallow a city and outgrow your rivals. |
| [Cube Lines](docs/cube-lines.md) | Rotate a cube and release blocked arrows. |
| [Untangle](src/games/untangle/) | Move dots until no strings cross. |
| [Gate Runner](docs/gate-runner-difficulty.md) | Grow a squad and survive enemy waves. |
| [Break Rot](docs/breakout.md) | Keep balls in play and clear brick chambers. |
| [Fieldwork](docs/fieldwork.md) | Plough a field with limited fuel. |
| [Type Rot](src/games/typing/) | Type moving words before they escape. Desktop recommended. |
| [Tower Defense](src/games/tower-defense/) | Mine resources, build defenses, and protect a castle. |
| [Associations](src/games/associations/) | Group word cards in a solitaire-style puzzle. |

Scores and supported puzzle saves stay on the device. Hole City and Cube Lines require WebGL.

## Add a game

1. Add an entry page in `games/<id>/` and implementation in `src/games/<id>/`.
2. Register the entry page in `vite.config.ts`.
3. Add its metadata to [src/catalog.ts](src/catalog.ts).

The homepage derives cards, filters, and counts from the catalog. Keep its description at 12 words or fewer. Optional `preview` names an SVG without the extension or a WebP with its extension in `public/assets/arcade/`; omit it for an emoji fallback. Optional `score` supplies an existing score key and display unit; omit it for games without a meaningful high score. Add a category only when needed—unused categories are hidden.

Homepage styles live in `src/arcade.css`. Keep new game styles alongside their implementation so changing one game does not restyle the others. Older Phaser games still use `src/style.css`.

## Checks and tooling

Run the relevant game’s tests after a change, then the production build:

```sh
npm run test:cube-lines
npm run test:untangle
npm run test:typing
npm run test:hole-city
npm run test:gate-runner
npm run test:breakout
npm run test:fieldwork
npm run build
```

Use `npm run` for the full list of generation, validation, and simulation commands. Cube Lines generation is documented in its [game guide](docs/cube-lines.md); Break Rot has a [level-authoring guide](src/games/breakout/levels/README.md).

## Offline assets

The service worker precaches the entire arcade so every game is available offline after installation. Unchanged assets can be reused on updates. The measured offline pack is about 3.2 MiB raw, or 1.2 MiB transferred with gzip; actual transfer depends on the host.

Run `npm run benchmark:assets` to rebuild and measure. See the [asset benchmark](docs/asset-benchmark.md) for per-game figures, methodology, and limitations.

## Fonts and license

Game code is [MIT licensed](LICENSE). Bundled fonts retain their own licenses:

- **Barlow Condensed:** [license](public/assets/gate-runner/FONT-LICENSE.txt).
- **JetBrains Mono:** copyright 2020 The JetBrains Mono Project Authors, under the [SIL Open Font License 1.1](public/assets/typing/JetBrainsMono-OFL.txt).

Type Rot pairs JetBrains Mono gameplay text with Barlow Condensed headings. Fonts are self-hosted and cached for offline use; full notices accompany the font files.
