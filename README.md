# bobdude247 Texas Hold'em

A polished, browser-based single-player no-limit Texas Hold'em game. The current build supports complete hands against five intentionally simple temporary CPUs.

## Play

Press **Deal Hand**, then use the enabled Fold, Check/Call, Raise-to, or All-in controls when it is your turn. CPUs check when possible, otherwise call, and otherwise fold. After a hand, use **Next Hand** until one funded player remains.

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
- `src/domain/holdem/`: framework-independent match configuration, positions, pots, CPU boundary, and immutable hand transitions.
- `src/components/` and `src/presentation/`: React presentation and table-specific configuration only.

Bet and raise actions use a canonical **raise-to** amount: the total amount a player has committed on the current street, not an incremental amount. The engine exposes legal action bounds and rejects invalid/out-of-turn actions without mutating prior state.

A full raise reopens raising rights for all opponents still able to act. A short all-in raise increases the call amount but does not by itself reopen a player who already acted; players who have not acted retain their normal legal options. The engine tracks a per-player reopen threshold, so consecutive short all-ins reopen a prior player's raising right once their cumulative increase reaches a full raise.

## Deployment

The production build uses relative asset URLs so it deploys correctly under a GitHub Pages repository subpath. The Pages workflow must be enabled in the repository's Pages settings with **GitHub Actions** as the source.

## Roadmap

Milestone 3 will add distinct CPU personalities, blind progression, game-speed controls, persistence, further visual/accessibility polish, and eventually multiplayer networking.
