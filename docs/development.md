# Development guide

## Author levels

The [repo-local skills](../.agents/skills/) cover all 11 playable games. Open the relevant `SKILL.md` for the authoring workflow. If your agent supports skill invocation, you can use a prompt like “Use `$breakout-levels` to add a brick chamber” or “Use `$chroma-circuit-levels` to add a mosaic.” Each skill points to the playable entry point, progress or replay details where relevant, and the game’s validation commands. The Top Down route is a placeholder awaiting gameplay.

## Add a game

1. Add an entry page in `games/<id>/` and implementation in `src/games/<id>/`.
2. Register the entry page in `vite.config.ts`.
3. Add its metadata to [src/catalog.ts](../src/catalog.ts).

The homepage derives cards, filters, and counts from the catalog. Keep its description at 12 words or fewer. Optional `preview` names an SVG without the extension or a WebP with its extension in `public/assets/arcade/`; omit it for an emoji fallback. Optional `score` supplies an existing score key and display unit; omit it for games without a meaningful high score. Add a category only when needed. The homepage hides unused categories.

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

Use `npm run` for the full list of generation, validation, and simulation commands. Cube Lines generation is documented in its [game guide](cube-lines.md); Break Rot has a [level-authoring guide](../src/games/breakout/levels/README.md).

## Integrate worktrees

Use [`$merge-agent`](../.agents/skills/merge-agent/SKILL.md) to integrate changes from another worktree, check whether local `main` is in sync, publish tested commits to GitHub, or close a finished worktree and archive its associated chat. The chat-management steps use Codex tools.
