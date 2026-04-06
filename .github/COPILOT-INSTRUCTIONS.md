# yopl — GitHub Copilot Instructions

> Canonical source is [AGENTS.md](../AGENTS.md) — this file provides quick context for GitHub Copilot.

## Project Identity

`yopl` is an ES6 mini-library implementing a Prolog-style logic solver. It supports rule-based logic
programming with both callback and generator drivers. Its only runtime dependency is
[`deep6`](https://www.npmjs.com/package/deep6), itself a zero-dependency library, used for unification.

## Key Conventions

- **Single runtime dependency** — only `deep6` is allowed in `dependencies`
- **ES6 modules** — `import`/`export` syntax (project is `"type": "module"`)
- **Code style** — 2-space indent, single quotes, semicolons required (Prettier enforced)

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

## Testing

- Tests grouped in `tests/test-*.js`, dispatched via `tests/tests.js`
- Run: `npm test`
- Lint: `npm run lint:fix` (run after any changes)
- Debug: `npm run debug`

## Documentation Files

- **Rules:** [AGENTS.md](../AGENTS.md)
- **Architecture:** [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Quick API:** [llms.txt](../llms.txt)
- **Full API:** [llms-full.txt](../llms-full.txt)
- **Usage:** [README.md](../README.md)
- **Wiki:** https://github.com/uhop/yopl/wiki
