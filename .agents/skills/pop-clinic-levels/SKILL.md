---
name: pop-clinic-levels
description: Add Pop Clinic patient cases or author treatment chains, tools, and mark placement.
---

# Pop Clinic level authoring

Define or reuse an `Area` in `src/games/pop-clinic/cases.ts`. Each treatment chain is ordered internally. Independent chains can interleave, so use mark dependencies such as `requiresClear` for genuine prerequisites. Match step targets to `field.marks` and the artwork in `art.ts`, and use `treatment.ts` to check how marks appear, clear, and gate progress.

Add the patient to the end of `patientCatalog`, then add that catalog index to `patientSaveSlots` at the intended place in the live queue. The catalog index is the persistence identifier, so preserve existing indices even when reordering live cases. Run `npm run test:pop-clinic`. The live-case test explores reachable treatment orders and checks the final marks. Play the new case to confirm tool targets and completion with touch or pointer input.
