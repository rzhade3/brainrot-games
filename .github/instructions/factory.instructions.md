---
applyTo: "src/games/factory/**,scripts/check-factory-*.ts,FACTORY-PLAN.md"
---

# Pocket Factory: field-notebook writing

Scope: Pocket Factory only, not the other games. Follow this guide when writing
player-facing copy, planning interfaces, or reviewing changes to this game.

## Voice

Write like someone recording a small working settlement: calm, observant,
concrete, and lightly warm. The notebook is a way of noticing things, not an
excuse for lore or decorative prose. Prefer ordinary words and short fragments.
Let the paper, ink, spacing, and illustrations carry most of the theme.
The notebook is the presentation language, not a second screen to monitor.

- Use "Growing food", "Waiting for ore", or "Kitchen stocked", not explanations
  of the simulation engine.
- Keep actions literal: Build, Rotate, Remove, Deliver to. Do not give essential
  controls poetic names.
- Avoid sales pitches, exclamation marks, faux-antique language, invented
  journal entries, and repeated FIELD NOTES labels.
- Do not imply unimplemented behavior. The current kitchen consumes raw food;
  it does not cook. Residents do not die or stop working during shortages.
- Preserve meaningful names and units across surfaces. A food unit is not a
  cooked meal; legacy defense supplies are not tools.

## Personality without clutter

The notebook should have an observer's voice, not read like an equipment manual.
Keep building purpose lines practical; put character inside existing contextual
information and small visual moments. "Taking food to the kitchen" describes a
resident's actual work more naturally than "Carrying cargo", without adding a
second sentence. Warmth and restrained wit must not obscure state or actions.

Do not add a margins sidebar, notebook feed, event log, milestone commentary,
unsolicited character chatter, or a persistent extra panel. Routine deliveries
and harvests do not need notifications. Show information at the building or
resident where the player can act on it; reserve global warnings for global
issues such as failed saves. The world communicates activity through animation
and carried items, not extra text over every resident.

Residents can gain recognizable voices and small habits in future work, but
do not invent preferences, memories, relationships, or survival mechanics in
copy before they are intentionally designed. Personality can also come from
illustration and animation; it does not have to add words.

## Put each fact where it helps a decision

**Build catalog:** icon, existing building name, one short purpose line, and
the existing shortcut. Aim for 3-6 words in the purpose line. Choose one idea,
not a recipe plus speed plus capacity plus instructions. Show a placement
restriction when selecting or previewing placement, rather than burying it in
the catalog. A future construction cost belongs here only when implemented.

The catalog uses these purpose lines (an unavailable building may instead show
its unlock condition):

| Building | Purpose line |
| --- | --- |
| Food plot | Grows food for residents |
| Communal kitchen | Keeps residents fed |
| House | Makes room for a resident |
| Extractor | Draws ore from deposits |
| Smelter | Turns ore into plates |
| Conveyor | Carries items onward |
| Splitter | Divides a delivery route |
| Depot | Holds items for later |
| Assembler | Assembles defense supplies |

**Selected building:** prioritize its current state, contents, and available
actions. Add only the recipe, capacity, rate, or destination needed for the
current decision. Use compact labeled values rather than narrative paragraphs.
Do not repeat a catalog purpose line or static instructions beside live data.
For example: "Growing food", "Ready: 2 / 4", "Deliver to: Communal kitchen".
Recipes and pace belong here, not on catalog cards. The homestead shows the
resident count, the work split ("2 at sites · 1 carrying · 1 free") and
individual activities, not a decorative population meter
or routine lifetime production totals.
Houses show delivered/installed wood, occupancy and food readiness beside Invite.
Installed wood is not available stock. Kitchens show demand for the current
population, not the old household-wide serving rate.

**Field notes (collapsed help):** explain only non-obvious behavior or a useful
exception in one or two short sentences. For example: "Keep a clear tile beside
the plot. Connect a conveyor to free its carriers." Splitter fallback behavior,
depot stock routing, and scenario-specific rules belong here, not on every card.
Do not delete necessary help just to meet a word count; move detail to its
relevant control or context.

**Feedback:** one observation, then one action when needed. For example:
"No clear path. Leave access beside both buildings." Keep failures, save
warnings, replacement consequences, and recovery behavior explicit and accurate;
never soften them into ambiguous notebook flavor. Keep accessible names clear.
Distinguish an incompatible save from a damaged one. Show one recovery instruction,
not raw validation details followed by another instruction. Replacement confirmation
explains what will be lost; replacement failures must say that no save was replaced.
Use the shared item-name helpers so quantities have the correct singular or plural form.

## Before finishing

Check copy against the implemented ruleset and shared simulation constants;
do not hard-code changing quantities in new prose. Read the default view as a
whole: each fact should appear once, where useful, and the map should remain
the focus. Check narrow layouts after UI changes; do not rely on hover-only
help. Review expanded notes as well as the collapsed view.

This file is the canonical writing guide. Keep examples and guidance here,
not in parallel agent-specific copies. Update it alongside intentional changes
to the game's writing direction.
