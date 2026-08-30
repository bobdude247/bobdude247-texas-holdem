# Rules Audit Matrix

| Rule area | Focused coverage |
| --- | --- |
| Buttons, blinds, heads-up order | `engine.test.ts` position fixtures |
| Preflop/postflop sequence | `engine.test.ts` street-order fixture |
| Full/short raises | `engine.test.ts` reopening fixtures |
| All-in runout and calls | `engine.test.ts` all-in fixtures |
| Pots, returns, payouts, ties | `payouts.test.ts` deterministic fixtures |
| Elimination and rotation | `engine.test.ts` rotation fixture |
| Hidden information | `public.test.ts` public-projection fixtures |
| Conservation and stress | `stress.test.ts` seeded legal-action sequence |
