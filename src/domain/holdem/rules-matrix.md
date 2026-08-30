# Rules Audit Matrix

| Rule area | Focused coverage |
| --- | --- |
| Buttons, blinds, heads-up order | `engine.test.ts` position fixtures |
| Preflop/postflop sequence | `engine.test.ts` street-order fixture |
| Full/short raises and cumulative reopening | `engine.test.ts` reopening fixtures; `reopening.test.ts` 10-case per-player cumulative short-all-in suite |
| All-in runout and calls | `engine.test.ts` all-in fixtures |
| Pots and unmatched excess | `engine.test.ts` pot-construction fixture; detailed payout fixtures remain pending |
| Elimination and rotation | `engine.test.ts` single elimination fixture; multi-hand rotation remains pending |
| Hidden information | `public.test.ts` public-projection fixture |
| Conservation and stress | `stress.test.ts` seeded legal-action sequence |
