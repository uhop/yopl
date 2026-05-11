# yopl [![NPM version][npm-image]][npm-url]

[npm-image]: https://img.shields.io/npm/v/yopl.svg
[npm-url]: https://npmjs.org/package/yopl

`yopl` is an ES6 mini-library that implements a Prolog-style logic solver in JavaScript. It provides:

- A small core solver with multiple driver styles: callback, generator, async callback, async generator.
- A built-in rule library: helpers and control predicates, comparisons, arithmetic, bitwise, boolean logic, and JS-native bridges (Array / Map / Set / Date).
- A rule compiler with two tagged-template front-ends — a per-clause DSL (`clause\`...\``) and a strict-Prolog whole-program parser (`prolog\`...\``) — write rules declaratively, catch arity drift at compile time.

Its only runtime dependency is [`deep6`](https://www.npmjs.com/package/deep6), itself a zero-dependency library that provides the unification engine.

## What it does and when to use it

`yopl` lets you describe a problem as a set of _rules_ over JavaScript values and ask the solver to find values that satisfy them. You write declarative rules; the engine handles search, unification, and backtracking. You stay inside JavaScript — there is no embedded DSL to parse, no separate Prolog runtime, and rules can call back into plain JS (sync or async) whenever a piece of logic is easier to express that way.

It is useful when a problem is awkward to express as straight-line code but natural to express as constraints or relations:

- Pattern matching and shape validation against deeply nested data, where you also want to _extract_ values during the match.
- Searching configurations, dependency graphs, or rule sets for combinations that satisfy several conditions at once.
- Type-inference-like or tag-propagation passes over an AST or IR.
- Small expert systems, planners, permission/policy checks, and "find me an X such that Y" queries embedded inside a larger JS app.
- Test fixtures and property-style checks that need to enumerate all values matching a spec.

If you only need single-direction pattern matching, a regex or a destructuring assignment is simpler. Reach for `yopl` when you need _bidirectional_ matching (unification), backtracking across alternative rules, or enumeration of all solutions — and you want all of that without leaving your JavaScript codebase.

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

| Module                     | Purpose                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `yopl` (`src/solve.js`)    | Synchronous callback solver — main entry point.                                                                                             |
| `yopl/solvers/gen.js`      | Synchronous generator solver.                                                                                                               |
| `yopl/solvers/async.js`    | Async callback solver.                                                                                                                      |
| `yopl/solvers/asyncGen.js` | Async generator solver.                                                                                                                     |
| `yopl/compile`             | IR constructors (`Var`, `Lit`, `Compound`, …) + `lowerRule`/`lowerRules` + `validate`/`validateOrThrow` + `IR` symbol + deep6 re-exports.   |
| `yopl/compile/clause`      | Per-clause tagged-template DSL: `rule(name, arity)(clause\`...\`)`.                                                                         |
| `yopl/compile/prolog`      | Strict-Prolog tagged-template parsers: `prolog\`...\``, `prologClause\`...\``.                                                              |
| `yopl/compile/prolog/file` | Filesystem-backed loaders: `prologFile`, `prologFileAsync` (Node / Bun / Deno).                                                             |
| `yopl/rules/system.js`     | Generic logic primitives: helpers + `eq`, `notEq`, `unifyOpts`, `not`, `map`, `filter`, type tests, …                                       |
| `yopl/rules/native.js`     | JS-native bridges: `Array` / `Map` / `Set` / `Date` predicates + type tests (`isArray`, `isMap`, …).                                        |
| `yopl/rules/comp.js`       | Comparisons: `lt`, `le`, `gt`, `ge`, `nz`.                                                                                                  |
| `yopl/rules/math.js`       | Arithmetic: `add`, `sub`, `mul`, `div`, `neg` (each reversible); `is/2` arithmetic-expression evaluator; `=:=`/`=\=` arithmetic comparison. |
| `yopl/rules/bits.js`       | Bitwise: `bitAnd`, `bitOr`, `bitXor`, `bitNot`.                                                                                             |
| `yopl/rules/logic.js`      | Boolean logic: `logicalAnd`, `logicalOr`, `logicalXor`, `logicalNot`.                                                                       |

Per-module documentation lives in the [wiki](https://github.com/uhop/yopl/wiki).

## CommonJS

`yopl` ships as ESM only. CommonJS consumers can use Node's built-in dynamic `import()`:

```js
const {default: solve} = await import('yopl');
```

A full CJS interop demo lives in `tests/test-cjs.cjs` (run it with `node tests/test-cjs.cjs`).

## Development

```bash
git clone https://github.com/uhop/yopl.git
cd yopl
npm install
npm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow and [AGENTS.md](./AGENTS.md) for AI-agent rules.

## Release history

- 1.4.0 — strict-Prolog tagged-template parser, bugfixes, major perf improvements.
- 1.3.0 — rule compiler, JS-native predicate library (`Array` / `Map` / `Set` / `Date`), `unifyOpts/3`.
- 1.2.0 — removed CJS build, restructured tests, added TypeScript typings, simplified list creation, bug fixes and performance improvements, expanded docs and wiki.
- 1.1.4 — updated dependencies.
- 1.1.3 — updated dependencies.
- 1.1.2 — updated dependencies.
- 1.1.1 — updated dependencies.
- 1.1.0 — [deep6](https://npmjs.org/package/deep6) was extracted from this package and is now a dependency.
- 1.0.1 — added the `exports` statement.
- 1.0.0 — first 1.0 release.

The full release notes are in the wiki: [Release notes](https://github.com/uhop/yopl/wiki/Release-notes).
