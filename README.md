# yopl [![NPM version][npm-image]][npm-url]

[npm-image]: https://img.shields.io/npm/v/yopl.svg
[npm-url]: https://npmjs.org/package/yopl

`yopl` is an ES6 mini-library that implements a Prolog-style logic solver in JavaScript. It provides:

- A small core solver with multiple driver styles: callback, generator, async callback, async generator.
- A built-in rule library: helpers and control predicates, comparisons, arithmetic, bitwise, and boolean logic.

Its only runtime dependency is [`deep6`](https://www.npmjs.com/package/deep6), itself a zero-dependency library that provides the unification engine.

## Installation

```bash
npm install --save yopl
```

## Quick start

```js
import {variable} from 'deep6/env.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from 'yopl';

const rules = {
  member: [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]]
};

const list = {value: 1, next: {value: 2, next: {value: 3, next: null}}};
const X = variable('X');

solve(rules, 'member', [list, X], env => {
  console.log('X =', assemble(X, env));
});
// X = 1
// X = 2
// X = 3
```

## Modules

| Module                     | Purpose                                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| `yopl` (`src/solve.js`)    | Synchronous callback solver — main entry point.                                 |
| `yopl/solvers/gen.js`      | Synchronous generator solver.                                                   |
| `yopl/solvers/async.js`    | Async callback solver.                                                          |
| `yopl/solvers/asyncGen.js` | Async generator solver.                                                         |
| `yopl/rules/system.js`     | Helpers + control predicates (`head`, `term`, `list`, `cut`, `call`, `not`, …). |
| `yopl/rules/comp.js`       | Comparisons: `lt`, `le`, `gt`, `ge`, `nz`.                                      |
| `yopl/rules/math.js`       | Arithmetic: `add`, `sub`, `mul`, `div`, `neg`.                                  |
| `yopl/rules/bits.js`       | Bitwise: `bitAnd`, `bitOr`, `bitXor`, `bitNot`.                                 |
| `yopl/rules/logic.js`      | Boolean logic: `logicalAnd`, `logicalOr`, `logicalXor`, `logicalNot`.           |

Per-module documentation lives in the [wiki](https://github.com/uhop/yopl/wiki).

## CommonJS

`yopl` ships as ESM only. CommonJS consumers can use Node's built-in dynamic `import()`:

```js
const {default: solve} = await import('yopl');
```

A full CJS interop demo lives in `tests/test-cjs.cjs` (run it with `node tests/test-cjs.cjs`).

## Development

```bash
git clone git@github.com:uhop/yopl.git
cd yopl
npm install
npm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow and [AGENTS.md](./AGENTS.md) for AI-agent rules.

## Release history

- 1.1.4 — updated dependencies.
- 1.1.3 — updated dependencies.
- 1.1.2 — updated dependencies.
- 1.1.1 — updated dependencies.
- 1.1.0 — [deep6](https://npmjs.org/package/deep6) was extracted from this package and is now a dependency.
- 1.0.1 — added the `exports` statement.
- 1.0.0 — first 1.0 release.
