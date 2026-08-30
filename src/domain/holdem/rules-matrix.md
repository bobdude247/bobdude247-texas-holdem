# Rules Audit Matrix

| Rule area | Focused coverage |
| --- | --- |
| Buttons, blinds, heads-up order | `engine.test.ts` position fixtures; blind all-in acting-order and zero-action runout regressions |
| Preflop/postflop sequence | `engine.test.ts` street-order fixture |
| Per-player reopening and raising rights | `reopening.test.ts` cases 1-10: cumulative short all-ins, full-raise and street resets; regressions: BB option, short postflop opening all-in, personal baseline reset, immutability, and public projection privacy |
| All-in runout and calls | `engine.test.ts` all-in fixtures; blind all-in runout and survivor-progression regressions |
| Pots and unmatched excess | `engine.test.ts` pot-construction fixture; detailed payout fixtures remain pending |
| Elimination and rotation | `engine.test.ts` single elimination fixture; deterministic four-hand rotation skips an eliminated seat and verifies elimination occurs only at settlement |
| Hidden information | `public.test.ts` public-projection fixture |
| Conservation and stress | `stress.test.ts` seeded legal-action sequence |
