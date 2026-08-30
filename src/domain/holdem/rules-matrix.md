# Rules Audit Matrix

| Rule area | Focused coverage |
| --- | --- |
| Buttons, blinds, heads-up order | `engine.test.ts`: `uses heads-up button small blind and correct preflop/postflop order`; blind all-in regressions |
| Preflop/postflop sequence | `engine.test.ts`: `advances through a six-player check/call preflop and check-around flop` |
| Per-player reopening and raising rights | `reopening.test.ts`: cases 1-10 and reopening regressions; `stress.test.ts`: `runs five reproducible seeds through multiple hands with legal actions and per-transition invariants` |
| All-in runout and calls | `engine.test.ts` all-in fixtures; `stress.test.ts` deterministic short-all-in raise and all-in-call-for-less scenarios |
| Pots and unmatched excess | `settlement.test.ts`: deterministic payout settlement fixtures, including unmatched returns, side pots, and ties |
| Elimination and rotation | `engine.test.ts`: `eliminates only after settlement, skips the busted seat, and rotates four deterministic hands`; `stress.test.ts` multi-match transitions |
| Public lifecycle A-K | `lifecycle.test.ts`: `public match lifecycle privacy` tests A-K |
| Sentinel-card leak prevention | `lifecycle.test.ts`: `expectNoPrivateCards` exercised by A-K, plus `public.test.ts`: `omits deck, burned cards, and unrevealed CPU hole-card properties` |
| CPU lifecycle boundary | `lifecycle.test.ts`: `allows only the acting CPU private cards across preflop, streets, all-ins, and next hands` |
| CPU context ownership | `lifecycle.test.ts`: `changes private cards with the acting CPU and owns every mutable context value` |
| React public-type boundary | `PokerTable.tsx` `PokerTableProps` accepts `PublicMatchState`; `Seat.tsx` `SeatProps` accepts only `PublicMatchPlayer | PublicHandPlayer`; `App.tsx` projects before rendering |
| Conservation and per-transition invariants | `stress.test.ts`: `runs five reproducible seeds through multiple hands with legal actions and per-transition invariants` |
| Observed action categories | `stress.test.ts` exact deterministic counts for folds, checks, calls, bets, full raises, short all-in raises, all-in calls for less, full all-ins, side pots, showdowns, uncontested wins, and eliminations; tied-pot proof remains `settlement.test.ts`: `splits a board-only tie` |
| Multi-hand and match completion stress | `stress.test.ts`: five fixed seeds, 37 hands, five multi-hand completed matches, and five three-handed-to-heads-up transitions |
| CPU personality assessment and legality | `cpu.test.ts`: `CPU assessments and deterministic personalities` |
| CPU hidden-information invariance | `cpu.test.ts`: `is hidden-information invariant and does not mutate its context for every personality` |
| CPU profile separation | `cpu.test.ts`: `profiles retain materially distinct documented parameters` |
