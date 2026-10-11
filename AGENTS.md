# Agent guidance

For Pocket Factory work (`src/games/factory/`, `scripts/check-factory-*.ts`, or
`FACTORY-PLAN.md`), read `.github/instructions/factory.instructions.md` before
writing or changing player-facing text or planning UI. It is the canonical
field-notebook writing guide; it does not apply to the other games.
The notebook shapes existing contextual UI, not a separate feed or sidebar.

For artwork or renderer architecture, also read the proposed asset boundary
under **Agreed visual direction** in `FACTORY-PLAN.md`. It separates asset-only
visual changes from gameplay changes; the new asset package is not implemented
yet, so do not assume its proposed files or interfaces already exist.

When delegating relevant work, explicitly include the applicable guide and design
references in the handoff. Do not assume another agent inherits this conversation
or loads repository instructions. Keep each guide in one place rather than
copying it into individual agent prompts or configuration files.
