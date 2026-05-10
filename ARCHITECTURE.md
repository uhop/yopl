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
├── compile/              # Rule compiler (IR + lowering + two front-ends)
│   ├── index.js          # Public barrel: IR + lowering + validation re-exports
│   ├── ir.js             # 5 Term + 4 Goal IR kinds, Clause, Rule, IR_KINDS, IR symbol
│   ├── lower.js          # IR → runtime rule fns (incl. the Lit-walker)
│   ├── validate.js       # Static-bug-class checks
│   ├── parse/            # Lexer, cursor, Pratt expr/body-expr parsers (shared)
│   ├── clause/           # Per-clause DSL: rule(name, arity)(clause`...`)
│   └── prolog/           # Strict-Prolog parsers: prolog`...`, prologClause`...`
└── rules/                # Built-in rule library
    ├── logic.js          # Logical connectives
    ├── comp.js           # Comparison rules
    ├── math.js           # Arithmetic rules
    ├── bits.js           # Bitwise rules
    ├── system.js         # Generic logic predicates
    └── native.js         # JS-native bridges (Array/Map/Set/Date)
bench/                    # Performance benchmarks (nano-benchmark)
tests/                    # Tests grouped in test-*.js, dispatched by tests.js
dev-docs/                 # Internal design notes (compiler-ir.md, native-objects.md, …)
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

### Rule compiler

`src/compile/` provides a pure-data IR plus a lowering pass that turns it into runtime rule
functions. Two front-ends emit IR — the per-clause tagged-template DSL in `compile/clause/`
and the strict-Prolog tagged-template parsers in `compile/prolog/` — both producing identical
IR for the shared subset. Lowering is the only place that knows the runtime rule shape. The
IR has 5 Term kinds (`var`, `wildcard`, `literal`, `cons`, `compound`) and 4 Goal kinds
(`call`, `cut`, `fail`, `js`), plus `Clause` and `Rule`.

Three public subpath exports cover the compiler surface: `yopl/compile` (IR + lowering +
validation barrel), `yopl/compile/clause` (per-clause DSL), `yopl/compile/prolog`
(strict-Prolog whole-program / single-clause parsers).

The **`Lit`-walker** (in `lower.js`) descends into plain objects and arrays inside a literal's
value, recursively lowering any nested IR node with the activation's fresh logic Variables. So
`Lit({age: Var('A')})` doubles as both a pattern matcher and a constructor — `A` binds when
the head matches an incoming object, and the same template renders an object when `A` is
bound. Maps, Sets, Dates, and `Wrap`-wrapped values (`open`/`soft`) pass through unchanged.

`yopl/compile` re-exports `open`, `soft`, `_`, and `any` from `deep6` for fine-grained match
control on `Lit`-wrapped values. See `dev-docs/compiler-ir.md` for the full design.

### Built-in rules

`src/rules/` provides a small standard library of predicates, split by domain:

- **`system.js`** — generic logic-programming primitives. Term builders (`head`, `term`,
  `list`, `listHead`, `rest`); control (`call`, `cut`, `fail`, `halt`, `isBound`, `not`,
  `true`, `once`, `eq` (≡ `unify`), `notEq` (≡ `notUnifiable`), `unifyOpts`, `isUnifiable`,
  `conjunction`, `disjunction`, `counterExample`, `implies`); generic type tests (`isVar`,
  `isNonVar`, `isNumber`, `isString`, `isNull`, `isUndefined`); higher-order (`map`,
  `filter`, `foldl`, `foldr`, `compose`, `converse`). `unifyOpts(X, Y, Opts)` invokes deep6
  unification with a per-call options bag (`{openObjects, openArrays, openMaps, openSets,
circular, loose, ignoreFunctions, signedZero, symbols}`); env baseline restored before the
  goal returns.
- **`native.js`** — JS-native bridges. Type tests: `isArray`, `isMap`, `isSet`, `isDate`.
  Array: `arrayList` (bidir array ↔ cons list),
  `arrayGet` (forward indexed lookup), `arraySet` (immutable single-index override),
  `arrayLength`. Map: `mapEntries` (bidir M ↔ list of `[K, V]` pairs), `mapGet`, `mapHas`.
  Set: `setItems` (bidir S ↔ list), `setHas`. Date: `dateTimestamp` (bidir D ↔ epoch ms),
  `dateComponents` / `dateComponentsUTC` (bidir D ↔ component bag, local + UTC variants).
  See `dev-docs/native-objects.md`.
- **`comp.js`** — comparison and ordering predicates.
- **`math.js`** — arithmetic predicates (each reversible).
- **`bits.js`** — bitwise predicates.
- **`logic.js`** — boolean logic (`logicalAnd`, `logicalOr`, `logicalXor`, `logicalNot`).

## Module dependency graph

```
src/solve.js               ── deep6/unify.js (unify, Env, variable)
src/solvers/gen.js         ── deep6/unify.js
src/solvers/async.js       ── deep6/unify.js
src/solvers/asyncGen.js    ── deep6/unify.js

src/compile/ir.js          ── deep6/unify.js (open, soft), deep6/env.js (_)
src/compile/lower.js       ── src/compile/ir.js, src/rules/system-runtime.js (call/cut/fail helpers)
src/compile/validate.js    ── src/compile/ir.js
src/compile/index.js       ── src/compile/{ir,lower,validate}.js  (public barrel)
src/compile/clause/        ── src/compile/ir.js, src/compile/parse/
src/compile/prolog/        ── src/compile/ir.js, src/compile/parse/, src/compile/lower.js
src/compile/parse/         ── src/compile/ir.js  (lexer + cursor + Pratt + body-expr)

src/rules/system-runtime.js ── deep6/env.js (cut/fail/halt/call leaf module)
src/rules/system.js        ── deep6/env.js (_, isVariable), deep6/unify.js (unify),
                              src/compile/prolog/, src/rules/system-runtime.js
src/rules/native.js        ── deep6/env.js (isVariable), deep6/unify.js (unify),
                              src/compile/lower.js, src/compile/clause/
src/rules/comp.js          ── deep6/env.js (_), src/compile/prolog/
src/rules/math.js          ── deep6/env.js (_), src/rules/system.js (cut),
                              src/compile/prolog/
src/rules/bits.js          ── deep6/env.js (_), src/rules/system.js (cut),
                              src/compile/prolog/
src/rules/logic.js         ── src/compile/prolog/
```

The solver drivers are independent — none of them imports the others or the rule library.
`src/rules/system.js` and `src/compile/lower.js` form a minor cycle resolved by ESM live
bindings: `lower.js` imports `call`/`cut`/`fail` from `system.js` for use inside lowered
closures (which run only at proof time), while `system.js` itself uses `lower.js` to compile
its own rule definitions.

## Import paths

```js
// Main solver
import solve from 'yopl';

// Drivers
import solveGen from 'yopl/solvers/gen.js';
import solveAsync from 'yopl/solvers/async.js';
import solveAsyncGen from 'yopl/solvers/asyncGen.js';

// Compiler — IR + lowering + validation barrel
import {
  Var,
  Wild,
  Lit,
  Cons,
  Compound,
  Call,
  Cut,
  Fail,
  Js,
  Clause,
  Rule,
  IR,
  lowerRules,
  lowerRule,
  validate,
  validateOrThrow,
  open,
  soft,
  _,
  any
} from 'yopl/compile';

// Per-clause tagged-template DSL
import {rule, clause} from 'yopl/compile/clause';

// Strict-Prolog tagged-template parsers (whole program + single clause)
import {prolog, prologClause} from 'yopl/compile/prolog';

// Rules — spread to compose
import {rules as systemRules} from 'yopl/rules/system.js';
import {rules as nativeRules} from 'yopl/rules/native.js';
import {rules as compRules} from 'yopl/rules/comp.js';
import {rules as mathRules} from 'yopl/rules/math.js';
import {rules as bitsRules} from 'yopl/rules/bits.js';
import {rules as logicRules} from 'yopl/rules/logic.js';
```

## Testing

- **Run all:** `npm test`
- **Single dispatcher:** `node tests/tests.js`
- **Debug:** `npm run debug` (Node inspector)
