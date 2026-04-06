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

<!-- TODO(step 5): write up the solver model — goals, rules, unification, backtracking, drivers. -->

### Solver core

`src/solve.js` is the heart of yopl. It evaluates goals against a rule database, using `deep6`
for unification and managing backtracking and choice points.

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

<!-- TODO(step 5): fill in once typings/docs are in place. -->

```
src/solve.js  ── deep6
src/solvers/* ── src/solve.js
src/rules/*   ── src/solve.js (and possibly deep6)
```

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
