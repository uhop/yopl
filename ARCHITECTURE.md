# Architecture

`yopl` is an ES6 mini-library implementing a Prolog-style logic solver. It supports rule-based
logic programming with multiple driver styles. Unification is delegated to
[`deep6`](https://www.npmjs.com/package/deep6) — yopl's only runtime dependency, itself a
zero-dependency library.

## Project layout

```
package.json              # Package config
src/                      # ES6 source code
├── solve.js              # Solver core / main entry
├── solvers/              # Alternative driver styles
│   ├── gen.js            # Synchronous generator-based solver
│   ├── async.js          # Async callback-based solver
│   └── asyncGen.js       # Async generator-based solver
└── rules/                # Built-in rule library
    ├── logic.js          # Logical connectives
    ├── comp.js           # Comparison rules
    ├── math.js           # Arithmetic rules
    ├── bits.js           # Bitwise rules
    └── system.js         # System / utility rules
tests/                    # Tests grouped in test-*.js, dispatched by tests.js
.github/                  # CI workflows, funding, dependabot
```

## Core concepts

### Goals, terms, rules

A **goal** is one of:

- a string — the name of a rule with no arguments;
- a structured term `{name, args}` — invoke `name` with the given argument vector;
- a JavaScript function `(env, goals, stack) => boolean | GoalFrame` — an inline predicate
  evaluated directly by the solver.

A **rule** is a function (or array of functions for a disjunction) that receives a fresh batch
of logical variables and returns an array of terms. The first element is the rule's _head_
(`{args: [...]}`); the rest are body goals evaluated in order.

A **rule database** is a `{name: rule}` object. Spread the built-in rule libraries into your own
database to compose them: `{...systemRules, ...mathRules, myRule: …}`.

### Solver core

`src/solve.js` is the heart of yopl. It evaluates goals against a rule database, delegating
unification to `deep6`. The proof loop is non-recursive — it maintains an explicit stack of
frames so deep proofs do not blow the JS call stack — and tracks alternatives via choice-point
frames so that backtracking is just popping the stack and reverting the environment.

The synchronous callback-style `solve` is the main entry point. The `src/solvers/` modules wrap
the same proof loop in alternative drivers that yield (or `await`) per solution.

### Drivers

The `src/solvers/` modules wrap the core in alternative execution styles:

- **`gen.js`** — synchronous generator yielding solutions on demand.
- **`async.js`** — async callback-based driver for I/O-bound rules.
- **`asyncGen.js`** — async generator that combines both.

### Built-in rules

`src/rules/` provides a small standard library of predicates:

- **`logic.js`** — logical connectives (and/or/not, if-then-else, etc.).
- **`comp.js`** — comparison and ordering predicates.
- **`math.js`** — arithmetic predicates.
- **`bits.js`** — bitwise predicates.
- **`system.js`** — system/utility predicates.

## Module dependency graph

```
src/solve.js               ── deep6/unify.js (unify, Env, variable)
src/solvers/gen.js         ── deep6/unify.js
src/solvers/async.js       ── deep6/unify.js
src/solvers/asyncGen.js    ── deep6/unify.js

src/rules/system.js        ── deep6/env.js (_, isVariable)
src/rules/comp.js          ── deep6/env.js (_), src/rules/system.js
src/rules/math.js          ── deep6/env.js (_), src/rules/system.js
src/rules/bits.js          ── deep6/env.js (_), src/rules/system.js
src/rules/logic.js         ── deep6/env.js (_), src/rules/system.js
```

The solver drivers are independent — none of them imports the others, and none of them depends
on the rule library. The rule modules depend only on `deep6` and on `system.js` for shared
helpers.

## Import paths

```js
// Main solver
import solve from 'yopl';

// Drivers
import solveGen from 'yopl/solvers/gen.js';
import solveAsync from 'yopl/solvers/async.js';
import solveAsyncGen from 'yopl/solvers/asyncGen.js';

// Rules
import logic from 'yopl/rules/logic.js';
import comp from 'yopl/rules/comp.js';
import math from 'yopl/rules/math.js';
import bits from 'yopl/rules/bits.js';
import system from 'yopl/rules/system.js';
```

## Testing

- **Run all:** `npm test`
- **Single dispatcher:** `node tests/tests.js`
- **Debug:** `npm run debug` (Node inspector)
