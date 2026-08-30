# bobdude247 Texas Hold'em

A polished, browser-based single-player no-limit Texas Hold'em game with five deterministic heuristic opponents.

## Play

Press **Deal Hand**, then use the enabled Fold, Check/Call, Raise-to, or All-in controls when it is your turn. After a hand, use **Next Hand** until one funded player remains.

## Opponents

- **The Rock**: tight, patient, and value-first.
- **The Shark**: balanced, position-aware pressure.
- **The Maniac**: loose, volatile, relentless pressure.
- **The Grinder**: disciplined, controlled-pot poker.
- **The Caller**: loose, sticky, and rarely raises.

Strategies consume only `CpuDecisionContext`: the acting CPU's cards plus public board, pots, positions, stacks, action history, and legal actions. They never receive opponents' cards, deck order, burns, future board cards, or engine state. The opponents use documented hand/draw heuristics rather than machine learning; injected randomness makes a seed reproducible in tests.

Default rules are six seats, $10,000,000 starting stacks, $25,000 small blind, $50,000 big blind, no ante, and fixed blind levels. All monetary values are safe integer chip amounts.

## Development

Requires Node.js 24 or later.

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm test
npm run build
```

## Architecture

- `src/domain/cards.ts`, `deck.ts`, and `evaluator.ts`: pure poker primitives.
- `src/domain/holdem/`: framework-independent match configuration, positions, pots, CPU boundary, immutable hand transitions, and `cpu.ts` personality profiles/assessment/sizing strategies.
- `src/components/` and `src/presentation/`: React presentation and table-specific configuration only.

Bet and raise actions use a canonical **raise-to** amount: the total amount a player has committed on the current street, not an incremental amount. The engine exposes legal action bounds and rejects invalid/out-of-turn actions without mutating prior state.

A full raise reopens raising rights for all opponents still able to act. A short all-in raise increases the call amount but does not by itself reopen a player who already acted; players who have not acted retain their normal legal options. The engine tracks a per-player reopen threshold, so consecutive short all-ins reopen a prior player's raising right once their cumulative increase reaches a full raise.

## Deployment

The production build uses relative asset URLs so it deploys correctly under a GitHub Pages repository subpath. The Pages workflow must be enabled in the repository's Pages settings with **GitHub Actions** as the source.

## Roadmap

Blind progression, game-speed controls, persistence, further visual/accessibility polish, and eventual multiplayer networking remain future milestones.
