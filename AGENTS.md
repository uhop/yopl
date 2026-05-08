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
git clone https://github.com/uhop/yopl.git
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

- **Solver core** (`src/solve.js`) — the synchronous callback-style solver and the main public
  entry. Drives unification (via `deep6`) over a rule database using an explicit goal stack.
- **Solver drivers** (`src/solvers/`) — alternative execution strategies sharing the same proof
  loop:
  - `gen.js` — synchronous generator yielding one `Env` per solution.
  - `async.js` — async callback-based driver for `await`-bearing predicates.
  - `asyncGen.js` — async generator combining the two.
- **Rule library** (`src/rules/`) — built-in predicates:
  - `system.js` — helpers (`head`, `term`, `list`, `listHead`, `rest`) and control predicates
    (`call`, `cut`, `fail`, `halt`, `isBound`, `not`, `true`, `eq`, `once`, `map`, `filter`,
    `foldl`, `foldr`, …).
  - `comp.js` — comparisons (`lt`/`le`/`gt`/`ge`, `nz`).
  - `math.js` — arithmetic (`add`/`sub`/`mul`/`div`/`neg`).
  - `bits.js` — bitwise (`bitAnd`/`bitOr`/`bitXor`/`bitNot`).
  - `logic.js` — boolean logic (`logicalAnd`/`logicalOr`/`logicalXor`/`logicalNot`).

Per-module documentation lives in the [wiki](https://github.com/uhop/yopl/wiki).

## Writing tests

- Tests live in `tests/test-*.js`, dispatched via `tests/tests.js`.
- The test harness (`tests/harness.js`) is the same lightweight one used by `deep6`. Each test
  module exports a default array of named test functions; the dispatcher concatenates them and
  runs them with `runAllTests`.
- Use the `submit` / `TEST` helpers from `harness.js` to record assertions:
  `eval(TEST('unify(result, [1, 2, 3])'));`.
- Shared list/timeout helpers live in `tests/helpers.js`.
- Run with `npm test`. The CommonJS interop smoke test lives at `tests/test-cjs.cjs` and is run
  manually with `node tests/test-cjs.cjs`.
- TypeScript typings are exercised separately by `tests/test-types.ts` via `npm run ts-check`.

## When reading the codebase

- Start with this file ([AGENTS.md](./AGENTS.md)) for rules and constraints.
- Consult [ARCHITECTURE.md](./ARCHITECTURE.md) for module relationships.
- `src/solve.js` is the core — read it first.
- Run `npm test` and `npm run lint:fix` after any changes.
