# Contributing to yopl

Thank you for your interest in contributing!

## Getting started

```bash
git clone git@github.com:uhop/yopl.git
cd yopl
npm install
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module map and dependency graph.

## Development workflow

1. Make your changes in `src/`.
2. Test: `npm test`
3. Type check: `npm run ts-check`
4. Lint: `npm run lint:fix`

## Code style

- ES6 modules (`import`/`export`) in source.
- Formatted with Prettier — see `.prettierrc` for settings.
- Single runtime dependency: only `deep6` is allowed in `dependencies`.

## AI agents

If you are an AI coding agent, see [AGENTS.md](./AGENTS.md) for detailed project conventions, commands, and architecture.
