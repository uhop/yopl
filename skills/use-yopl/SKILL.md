---
name: use-yopl
description: Use the yopl Prolog-style logic engine in a JavaScript/TypeScript project. Use when adding rule-based search, pattern matching with extraction, constraint solving, type inference, planning, or expert-system style logic to a project that depends on `yopl`.
---

# Use yopl

`yopl` is an embeddable Prolog-style logic engine for JavaScript. It gives you
declarative rules, unification (via `deep6`), backtracking search, and four
solver drivers (sync/async × callback/generator). It is ES-modules only and has
a single runtime dependency (`deep6`).

When in doubt, the canonical references are
`node_modules/yopl/llms.txt` (concise) and `node_modules/yopl/llms-full.txt`
(complete with examples). Read them before guessing.

## When to reach for yopl

Pick yopl when the problem is naturally expressed as _rules + queries_:

- Pattern matching where you also need to **extract** parts of the input.
- Multi-solution search with backtracking (planners, constraint puzzles, layout).
- Type inference, dataflow analysis, simple theorem proving.
- Policy / authorization rules.
- Anything you'd otherwise hand-roll as nested `if`/`for` over a small relational model.

Do **not** reach for yopl for plain validation, simple lookups, or anything a
single SQL query / array filter handles cleanly.

## Installation

```bash
npm install yopl
```

`yopl` requires Node 18+ (or modern Deno / Bun) and `"type": "module"` (or
`.mjs` files).

## Imports

```js
// Default sync callback solver
import solve from 'yopl';

// Alternative drivers
import gen from 'yopl/solvers/gen.js'; // sync generator → yields Env per solution
import asyncSolve from 'yopl/solvers/async.js'; // async callback (await-able predicates)
import asyncGen from 'yopl/solvers/asyncGen.js'; // async generator

// Built-in rule libraries (each exports a spreadable `rules` object)
import {rules as systemRules} from 'yopl/rules/system.js';
import {rules as compRules} from 'yopl/rules/comp.js';
import {rules as mathRules} from 'yopl/rules/math.js';
import {rules as bitsRules} from 'yopl/rules/bits.js';
import {rules as logicRules} from 'yopl/rules/logic.js';

// Variables and value extraction come from deep6
import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
```

## Defining rules

A _rule database_ is a plain object keyed by `'name/arity'`. Each entry is one
clause function (or an array of clause functions, tried in order):

```js
const rules = {
  // member(X, [X | _]).
  // member(X, [_ | T]) :- member(X, T).
  'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X, T) => [{args: [{value: V, next: X}, T]}, {name: 'member/2', args: [X, T]}]]
};
```

A clause is a function whose parameters become **fresh logical variables** for
that invocation. It returns an array of _terms_:

- The **first** term is the rule head: `{args: [...]}`.
- The remaining terms are body goals: either `{name: 'foo/N', args: [...]}` to
  call another rule, or an inline guard `env => boolean` for native checks.

## Composing the rule database

Combine your own rules with the built-ins via spread:

```js
import {rules as systemRules} from 'yopl/rules/system.js';
import {rules as compRules} from 'yopl/rules/comp.js';
import {rules as mathRules} from 'yopl/rules/math.js';

const rules = {
  ...systemRules,
  ...compRules,
  ...mathRules,
  'positive/1': X => [{args: [X]}, {name: 'gt/2', args: [X, 0]}],
  'square/2': (X, Y) => [{args: [X, Y]}, {name: 'mul/3', args: [X, X, Y]}]
};
```

## Running queries

### Sync, callback (default `solve`)

```js
import solve from 'yopl';
import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';

const X = v('X');
const results = [];
solve(rules, 'square/2', [5, X], env => {
  results.push(assemble(X, env));
});
// results === [25]
```

The callback is invoked **once per solution**. Return `false` from it to stop
the search early.

### Sync generator

```js
import gen from 'yopl/solvers/gen.js';

const X = v('X');
for (const env of gen(rules, 'member/2', [X, list])) {
  console.log(assemble(X, env));
}
```

### Async (callback or generator)

Use `yopl/solvers/async.js` or `yopl/solvers/asyncGen.js` when any rule body
needs `await` (database lookups, HTTP, fs, etc.).

```js
import asyncGen from 'yopl/solvers/asyncGen.js';

for await (const env of asyncGen(rules, 'lookup/2', [key, X])) {
  // ...
}
```

## Extracting values

Variables are not "results" by themselves — they're placeholders. After a
successful solve, call `assemble(variable, env)` from
`deep6/traverse/assemble.js` to walk the bindings and produce a plain value
(deeply, including nested terms and lists).

## Common patterns

- **List membership / search:** use `member/2` (built-in via your own clauses
  or via `system.js` helpers like `list`, `listHead`, `rest`).
- **Higher-order:** `system.js` provides `map`, `filter`, `foldl`, `foldr`,
  `compose`, `converse` — all expressed as logic rules.
- **Negation as failure:** `not`, `counterExample`.
- **Reversible arithmetic:** `add`, `sub`, `mul`, `div`, `neg` from `math.js`
  work in any direction as long as enough arguments are bound.
- **Cut / control:** `cut`, `once`, `fail`, `halt`, `call` from `system.js`.
- **Type tests:** `isVar`, `isNonVar`, `isNumber`, `isString`, `isArray`, etc.

## Pitfalls

- **Arity matters.** `'foo/2'` is _only_ called when the goal arity is 2.
  Mismatched arity silently produces no solutions.
- **Guards on unbound variables.** An inline guard `env => X.get(env) > 0`
  will throw or behave wrongly if `X` isn't bound yet. Gate it:
  `env => X.isBound(env) && X.get(env) > 0`.
- **Recursion needs a base case.** Otherwise the solver backtracks forever or
  blows the stack.
- **Don't share captured variables across clauses.** Each clause function gets
  its own fresh variables via its parameters.
- **Async drivers require async consumption.** Don't call `asyncSolve`
  fire-and-forget — `await` it (or iterate `asyncGen` with `for await`).

## Picking a driver

| Need                                      | Driver                     |
| ----------------------------------------- | -------------------------- |
| Simple, sync, one callback per solution   | `yopl` (default `solve`)   |
| Sync, want to pull solutions lazily       | `yopl/solvers/gen.js`      |
| Any rule body needs `await`               | `yopl/solvers/async.js`    |
| Async + want lazy `for await` consumption | `yopl/solvers/asyncGen.js` |

## Where to look next

- `node_modules/yopl/llms.txt` — concise API reference.
- `node_modules/yopl/llms-full.txt` — full API reference with examples.
- `node_modules/yopl/AGENTS.md` — rules, conventions, architecture quick ref.
- [Wiki](https://github.com/uhop/yopl/wiki) — per-module documentation, including each built-in rule.
