# bobdude247 Texas Hold'em

A polished, browser-based single-player no-limit Texas Hold'em game. This first milestone establishes independently testable poker rules and the static table presentation that later milestones will connect to hand and betting state.

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

The production build uses relative asset URLs so it deploys correctly under a GitHub Pages repository subpath. The Pages workflow must be enabled in the repository's Pages settings with **GitHub Actions** as the source.
