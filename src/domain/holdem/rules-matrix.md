# Rules Audit Matrix

| Rule area | Focused coverage |
| --- | --- |
| Buttons, blinds, heads-up order | `engine.test.ts` position fixtures |
| Preflop/postflop sequence | `engine.test.ts` street-order fixture |
| Full/short raises | `engine.test.ts` reopening fixtures |
| All-in runout and calls | `engine.test.ts` all-in fixtures |
| Pots and unmatched excess | `engine.test.ts` pot-construction fixture; detailed payout fixtures remain pending |
| Elimination and rotation | `engine.test.ts` single elimination fixture; multi-hand rotation remains pending |
| Hidden information | `public.test.ts` public-projection fixture |
| Conservation and stress | `stress.test.ts` seeded legal-action sequence |
