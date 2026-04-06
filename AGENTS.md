# AGENTS.md — yopl

> `yopl` is an ES6 mini-library implementing a Prolog-style logic solver. It supports rule-based
> logic programming with both callback and generator drivers. Its only runtime dependency is
> [`deep6`](https://www.npmjs.com/package/deep6), itself a zero-dependency library that provides
> the unification engine.

## AI Documentation

- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md) — module map, dependency graph, algorithm details
- **Quick API:** [llms.txt](./llms.txt) — concise API reference for LLMs
- **Full API:** [llms-full.txt](./llms-full.txt) — complete API reference with examples
- **Codebase Quick Ref:** [CODEBASE.md](./CODEBASE.md) — one-liner, entry points, key patterns
- **Usage:** [README.md](./README.md) — installation and examples

For detailed usage docs see the [wiki](https://github.com/uhop/yopl/wiki).

## Setup

```bash
git clone git@github.com:uhop/yopl.git
cd yopl
npm install
```

## Commands

- **Install:** `npm install`
- **Test:** `npm test`
- **Debug:** `npm run debug` — run tests with Node inspector
- **Type check:** `npm run ts-check` — TypeScript type checking
- **Lint:** `npm run lint` — Prettier check
- **Lint fix:** `npm run lint:fix` — Prettier write

## Project structure

```
yopl/
├── package.json          # Package config
├── src/                  # ES6 source code
│   ├── solve.js          # Solver core / main entry
│   ├── solvers/          # Alternative driver styles
│   │   ├── gen.js        # Synchronous generator-based solver
│   │   ├── async.js      # Async callback-based solver
│   │   └── asyncGen.js   # Async generator-based solver
│   └── rules/            # Built-in rule library
│       ├── logic.js      # Logical connectives
│       ├── comp.js       # Comparison rules
│       ├── math.js       # Arithmetic rules
│       ├── bits.js       # Bitwise rules
│       └── system.js     # System / utility rules
├── tests/                # Test files (grouped test-*.js, dispatched by tests.js)
└── .github/              # CI workflows, funding, dependabot
```

## Code style

- **ES6 modules** (`"type": "module"` in package.json).
- **Single runtime dependency.** Only `deep6` is allowed in `dependencies`.
- **Prettier** for formatting (see `.prettierrc`): 2-space indent, single quotes, semicolons required, no trailing commas.

## Critical rules

- **ES6 modules.** Use `import`/`export` syntax in source.
- **Single runtime dependency.** Do not add packages to `dependencies` other than `deep6`.
- **Do not modify or delete test expectations** without understanding why they changed.
- **Do not add or remove comments** unless explicitly asked.
- **Keep `src/` in sync.** Run `npm test` and `npm run lint:fix` after changes.

## Architecture

<!-- TODO(step 5): expand this section once modules are documented in wiki/. -->

- **Solver core** (`src/solve.js`) — the main solver entry. Drives unification (via `deep6`) over a
  rule database to satisfy goals.
- **Solver drivers** (`src/solvers/`) — alternative execution strategies built on the same core:
  - `gen.js` — synchronous generator yielding solutions on demand.
  - `async.js` — async callback-based driver.
  - `asyncGen.js` — async generator driver.
- **Rule library** (`src/rules/`) — built-in predicates grouped by domain (logic, comparison,
  arithmetic, bitwise, system).

## Writing tests

<!-- TODO(step 3): document the test harness once it has been adapted from deep6/tests/. -->

- Tests live in `tests/test-*.js`, dispatched via `tests/tests.js`.
- Run with `npm test`.

## When reading the codebase

- Start with this file ([AGENTS.md](./AGENTS.md)) for rules and constraints.
- Consult [ARCHITECTURE.md](./ARCHITECTURE.md) for module relationships.
- `src/solve.js` is the core — read it first.
- Run `npm test` and `npm run lint:fix` after any changes.
