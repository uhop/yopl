---
name: use-yopl
description: Use the yopl Prolog-style logic engine in a JavaScript/TypeScript project. Use when adding rule-based search, pattern matching with extraction, constraint solving, type inference, planning, or expert-system style logic to a project that depends on `yopl`.
---

# Use yopl

`yopl` is an embeddable Prolog-style logic engine for JavaScript. It gives you
declarative rules, unification (via `deep6`), backtracking search, a rule
compiler with two tagged-template front-ends, and four solver drivers
(sync/async × callback/generator). It is ES-modules only and has a single
runtime dependency (`deep6`).

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

`yopl` supports all non-EOL Node versions (CI runs 22 / 24 / 26) plus current
Bun and Deno, and needs `"type": "module"` (or `.mjs` files).

## Imports

```js
// Default sync callback solver
import solve from 'yopl';

// Alternative drivers
import gen from 'yopl/solvers/gen.js'; // sync generator → yields Env per solution
import asyncSolve from 'yopl/solvers/async.js'; // async callback (await-able predicates)
import asyncGen from 'yopl/solvers/asyncGen.js'; // async generator

// Rule compiler front-ends (preferred way to write rules)
import {prolog} from 'yopl/compile/prolog';
import {rule, clause} from 'yopl/compile/clause.js';
import {lowerRules} from 'yopl/compile';
import {prologFile, prologFileAsync} from 'yopl/compile/prolog/file.js';

// Built-in rule libraries (each exports a spreadable `rules` object)
import {rules as systemRules} from 'yopl/rules/system.js';
import {rules as compRules} from 'yopl/rules/comp.js';
import {rules as mathRules} from 'yopl/rules/math.js';
import {rules as bitsRules} from 'yopl/rules/bits.js';
import {rules as logicRules} from 'yopl/rules/logic.js';
import {rules as nativeRules} from 'yopl/rules/native.js'; // Array / Map / Set / Date bridges

// Variables and value extraction come from deep6
import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
```

In CommonJS, use dynamic import: `const {solve} = await import('yopl');`.

## Defining rules — prefer the compiler

Both tagged-template front-ends catch arity drift and other static bug classes
at compile time and emit the correct runtime shapes automatically. Prefer them
over hand-written encodings for new rules.

Strict-Prolog form (multi-clause programs in one tag):

```js
import {prolog} from 'yopl/compile/prolog';

const rules = prolog`
  member(X, [X | _]).
  member(X, [_ | T]) :- member(X, T).
`;
```

Per-clause form (anonymous heads, name supplied externally, `${}`
interpolation for literals and inline JS goals):

```js
import {rule, clause} from 'yopl/compile/clause.js';
import {lowerRules} from 'yopl/compile';

const rules = lowerRules([rule('member', 2)(clause`(X, [X | _])`, clause`(X, [_ | T]) :- member(X, T)`)]);
```

The strict-Prolog form additionally supports body operators (`,`, `;`, `->`,
`\+`), goal aliases (`=` → `eq`, `<` → `lt`, …), `is/2` arithmetic, and
`:- op(P, T, N).` directives. To load `.pl` sources from disk use
`prologFile(url)` / `prologFileAsync(url)` from `yopl/compile/prolog/file.js`
(Node / Bun / Deno).

## The runtime encoding (what the compiler emits)

A _rule database_ is a plain object keyed by **rule name**. Each entry is one
clause function (or an array of clause functions, tried in order):

```js
const rules = {
  // member(X, [X | _]).
  // member(X, [_ | T]) :- member(X, T).
  member: [(X, T) => [{args: [X, {value: X, next: T}]}], (X, T) => [{args: [X, {next: T}]}, {name: 'member', args: [X, T]}]]
};
```

A clause is a function whose parameters become **fresh logical variables** for
that invocation. It returns an array of _terms_:

- The **first** term is the rule head: `{args: [...]}`.
- The remaining terms are body goals: a `{name, args}` term calling another
  rule, a bare string (a 0-arg call by name), or an inline JS function
  `(env, goals, stack) => boolean` for native checks.

Lists are cons chains: `{value: head, next: tail}`, with `null` as the empty
list.

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
  positive: X => [{args: [X]}, {name: 'gt', args: [X, 0]}],
  square: (X, Y) => [{args: [X, Y]}, {name: 'mul', args: [X, X, Y]}]
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
solve(rules, 'square', [5, X], env => {
  results.push(assemble(X, env));
});
// results === [25]
```

The callback is invoked **once per solution**, and `solve()` always explores
the whole search tree. There is no early-stop from the callback — when you
only need the first solution (or want to stop early), use the generator
driver and stop pulling.

### Sync generator

```js
import gen from 'yopl/solvers/gen.js';

const X = v('X');
for (const env of gen(rules, 'member', [X, list])) {
  console.log(assemble(X, env));
  // `break` here stops the search — nothing past this solution is explored
}

// first solution only:
const first = gen(rules, 'member', [X, list]).next().value;
```

### Async (callback or generator)

Use `yopl/solvers/async.js` or `yopl/solvers/asyncGen.js` when any rule body
needs `await` (database lookups, HTTP, fs, etc.).

```js
import asyncGen from 'yopl/solvers/asyncGen.js';

for await (const env of asyncGen(rules, 'lookup', [key, X])) {
  // ...
}
```

## Extracting values

Variables are not "results" by themselves — they're placeholders. After a
successful solve, call `assemble(variable, env)` from
`deep6/traverse/assemble.js` to walk the bindings and produce a plain value
(deeply, including nested terms and lists).

## Common patterns

- **List membership / search:** `system.js` helpers (`list`, `listHead`,
  `rest`) or your own `member` rule.
- **Higher-order:** `system.js` provides `map`, `filter`, `foldl`, `foldr`,
  `compose`, `converse` — all expressed as logic rules.
- **Negation as failure:** `not`, `counterExample`.
- **Reversible arithmetic:** `add`, `sub`, `mul`, `div`, `neg` from `math.js`
  work in any direction as long as enough arguments are bound; `is/2`
  evaluates arithmetic expressions (strict-Prolog front-end).
- **JS-native data:** `native.js` bridges `Array` / `Map` / `Set` / `Date`
  (`arrayList`, `mapGet`, `setHas`, `dateComponents`, …) plus type tests
  (`isArray`, `isMap`, …).
- **Per-call unification options:** `unifyOpts(X, Y, Opts)` runs one
  unification with a deep6 options bag (`openArrays`, `circular`, …).
- **Cut / control:** `cut`, `once`, `fail`, `halt`, `call` from `system.js`.
- **Type tests:** `isVar`, `isNonVar`, `isNumber`, `isString`, etc.

## Pitfalls

- **Arity is structural.** A goal's `args` unify against the clause head's
  `args` — a length mismatch simply fails to unify and the clause produces no
  solutions. The compiler front-ends catch arity drift statically; prefer
  them.
- **Unknown rule names throw.** Calling a goal whose name has no entry in the
  rule database is an error, not a silent failure.
- **Guards on unbound variables.** An inline guard `env => X.get(env) > 0`
  will throw or behave wrongly if `X` isn't bound yet. Gate it:
  `env => X.isBound(env) && X.get(env) > 0`.
- **Recursion needs a base case.** Otherwise the solver backtracks forever.
- **Generative queries can have infinitely many solutions.** Asking `member`
  "which lists contain X?" (unbound list argument) enumerates lists forever —
  and `solve()` never returns because it exhausts the tree. Keep argument
  order straight, and use a generator driver with a pull cap when a query is
  legitimately generative.
- **Don't share captured variables across clauses.** Each clause function gets
  its own fresh variables via its parameters.
- **Async drivers require async consumption.** Don't call `asyncSolve`
  fire-and-forget — `await` it (or iterate `asyncGen` with `for await`).

## Picking a driver

| Need                                      | Driver                     |
| ----------------------------------------- | -------------------------- |
| Simple, sync, one callback per solution   | `yopl` (default `solve`)   |
| Sync, lazy pull, early stop, first-only   | `yopl/solvers/gen.js`      |
| Any rule body needs `await`               | `yopl/solvers/async.js`    |
| Async + want lazy `for await` consumption | `yopl/solvers/asyncGen.js` |

## Where to look next

- `node_modules/yopl/llms.txt` — concise API reference.
- `node_modules/yopl/llms-full.txt` — full API reference with examples.
- [Wiki](https://github.com/uhop/yopl/wiki) — per-module documentation, including each built-in rule and both compiler front-ends.
