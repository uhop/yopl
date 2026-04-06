# yopl — Claude Code Project Guide

> Canonical source is [AGENTS.md](./AGENTS.md) — this file provides quick navigation to all AI documentation.

## Start Here

1. **Project Rules** → [AGENTS.md](./AGENTS.md) — critical rules, code style, architecture quick reference
2. **Architecture** → [ARCHITECTURE.md](./ARCHITECTURE.md) — module map, dependency graph, algorithm details
3. **Quick API** → [llms.txt](./llms.txt) — concise API reference for LLMs
4. **Full API** → [llms-full.txt](./llms-full.txt) — complete API reference with examples
5. **Usage** → [README.md](./README.md) — installation and examples
6. **Codebase Quick Ref** → [CODEBASE.md](./CODEBASE.md) — one-liner, entry points, key patterns

## Commands

| Command         | Description               |
| --------------- | ------------------------- |
| `npm test`      | Run test suite            |
| `npm run debug` | Debug with Node inspector |

## Project Identity

`yopl` is an ES6 mini-library implementing a Prolog-style logic solver. It supports:

- Rule-based logic programming
- Multiple driver styles (sync generator, async callback, async generator)
- A built-in rule library (logic, comparison, arithmetic, bitwise, system)
- Unification powered by [`deep6`](https://www.npmjs.com/package/deep6) — its only runtime dependency

## Key Conventions

- **Single runtime dependency** — only `deep6`
- **ES6 modules** — use `import`/`export` syntax
- **Code style** — 2-space indent, single quotes, semicolons required (Prettier)
- **No comments** — don't add or remove comments unless asked
- **Keep tests intact** — don't modify test expectations without understanding

## Import Patterns

```js
// Main solver
import solve from 'yopl';

// Alternative drivers
import solveGen from 'yopl/solvers/gen.js';
import solveAsync from 'yopl/solvers/async.js';
import solveAsyncGen from 'yopl/solvers/asyncGen.js';

// Built-in rules
import logic from 'yopl/rules/logic.js';
import comp from 'yopl/rules/comp.js';
import math from 'yopl/rules/math.js';
import bits from 'yopl/rules/bits.js';
import system from 'yopl/rules/system.js';
```

## For AI Assistants

When working on yopl:

1. Read [AGENTS.md](./AGENTS.md) first for rules and constraints
2. Consult [ARCHITECTURE.md](./ARCHITECTURE.md) for module relationships
3. Use [llms.txt](./llms.txt) for quick API lookup
4. Reference [CODEBASE.md](./CODEBASE.md) for algorithm details
5. Run `npm test` and `npm run lint:fix` after any changes
