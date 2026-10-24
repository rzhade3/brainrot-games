# Gate Runner UX pass

Applied the official pbakaus/impeccable skill (4.7.1): critique, distill, clarify, animate and polish guidance. Two independent assessments identified weak event feedback, ambiguous automatic firing, tiny secondary copy, inconsistent stage terminology and misleading enemy-removal effects. Initial heuristic assessment: 21/40. Questions were skipped because implementation scope was already authorized.

Changes: restrained interface with self-hosted Barlow Condensed, readable instructions, actual upgrade previews, single-action retries and upgrade continuation, accessible modal focus, optional sound, and reduced-motion support. Explicit engine events drive actual health/squad deltas, hit flashes, target brackets, muzzle flashes, distinct kill and damage effects, and announcements. Breaches and collisions no longer look like rewarded kills.

Every living soldier is rendered (up to the gameplay cap of 180). Stable formation slots leave gaps after casualties; the removed sprite is replaced briefly by an impact mark, never a lingering living unit. Reinforcements fill empty slots with new identities.

Validation: production build; 18 tests including actual collision losses, formation removal above 25 and at 180, and observational events preserving simulation state. 2,100 deterministic runs retain prior win counts: idle/random/sweep 0, squad 69, damage 247, balanced 292, delayed/noisy reactive 30 of 300 each. Official final detector returned [] (static scan, not proof of visual quality). Mobile touch-device testing is not available through the current cloud browser; pointer cancellation and responsive styles were reviewed in source.
