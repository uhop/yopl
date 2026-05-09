# Compile / IR design

The IR is the data structure that yopl front-ends emit and that
`src/compile/lower.js` consumes. This doc explains what's in it,
why each piece is shaped the way it is, and the coverage argument
that it is **minimal but sufficient** to represent every rule pattern
already in `src/rules/`.

The IR is the contract front-ends and the lowering pass share. If the
runtime rule shape changes, only `lower.js` follows; the IR and
front-ends are insulated. That decoupling is the whole point.

## Pipeline

```
front-end          IR             lower.js              src/solve.js
─────────────────  ─────────────  ────────────────────  ─────────────
clause`...`        Rule {         function (...vars) {  rules[name] =
prolog`...`          name           ...                    [fn1, fn2,
ir.Rule(...)         arity        }                         ...]
                     clauses[]    function (...vars) {
                   }                ...
                                  }
                                  → rules dict
```

Front-ends have no knowledge of `head(...)`, `term(...)`, `cut(sys)`,
`call(...)`, `listHead(...)`, or the `length+1` var-allocation
contract. They emit pure data. `lower.js` is the only place that
encodes how IR maps to runtime.

## Coverage requirements

Survey of patterns in `src/rules/{system,comp,math,bits,logic}.js`.
Anything the IR cannot represent is a coverage failure.

| #   | Pattern                     | Example                                                              | IR shape needed                           |
| --- | --------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Single-clause head with var | `eq: X => [head(X, X)]`                                              | `Clause` with var-only head, empty body   |
| 2   | Multi-clause rule           | `notEq: [..., () => [head(_, _)]]`                                   | `Rule.clauses[]` with multiple `Clause`s  |
| 3   | Wildcard in head            | `() => [head(_, _)]`                                                 | wildcard term                             |
| 4   | Literal in head             | `() => [head(0, _, 0)]` (math.mul)                                   | literal term                              |
| 5   | Body call with args         | `term('filter', P, Xt, Yt)`                                          | `Call(name, args)`                        |
| 6   | Bare-string body call       | `'true'` (rare, but proof loop accepts)                              | `Call(name)` zero args                    |
| 7   | Cut in body                 | `cut(sys)` (system, math, bits)                                      | `Cut` goal                                |
| 8   | Explicit fail               | `fail` (notEq, not)                                                  | `Fail` goal                               |
| 9   | Inline JS goal              | `env => X.isBound(env) && ...` (comp, math)                          | `Js(factory)` goal                        |
| 10  | Inline JS using `sys`       | reversible `(env, goals, stack) => { cut(sys)(...) ... }` (math.add) | `Js` factory with `sys` access            |
| 11  | List pattern in head        | `head(F, listHead(X, Xt), ...)` (map)                                | `Cons(head, tail)` term                   |
| 12  | Empty list (`null`)         | `head(_, null, null)` (map base)                                     | `Lit(null)` term                          |
| 13  | Compound term as data       | `term('eq', X, Y)` inside `term('not', ...)`                         | `Compound(name, args)` term               |
| 14  | Variable as goal name       | `term(F, X, Y)` in goal position (map, filter)                       | `Call(Var('F'), args)` — dynamic dispatch |
| 15  | Variable as compound name   | `term(F, X)` as data passed to another goal                          | `Compound(Var('F'), args)`                |

The IR has 5 Term kinds + 4 Goal kinds + Clause + Rule. The table above
maps every pattern in the existing rule library to one of those — the
"sufficient" half of the minimality argument.

## Data shapes

### Term — what appears in heads and inside arguments

| Kind       | Shape                                                    | Use                                             |
| ---------- | -------------------------------------------------------- | ----------------------------------------------- |
| `var`      | `{kind: 'var', name: string}`                            | user-named logic variable                       |
| `wildcard` | `{kind: 'wildcard'}`                                     | anonymous match-anything slot                   |
| `literal`  | `{kind: 'literal', value: any}`                          | JS value: `null`, number, string, boolean, etc. |
| `cons`     | `{kind: 'cons', head: Term, tail: Term}`                 | one cell of a list (`{value, next}`)            |
| `compound` | `{kind: 'compound', name: string \| Term, args: Term[]}` | a `{name, args}` structure                      |

`compound.name` accepts a Term IR for the dynamic case (`term(F, ...)`
where `F` is a variable). When used as data passed to another goal
(pattern 15), the runtime stores `name` as the bound Variable; when
unified, deep6 handles the binding.

### Goal — what appears in a clause body

| Kind   | Shape                                                | Lowers to                                                             |
| ------ | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `call` | `{kind: 'call', name: string \| Term, args: Term[]}` | static: `name` or `{name, args}`; dynamic: `call(...)` runtime helper |
| `cut`  | `{kind: 'cut'}`                                      | `cut(sys)` (sys captured from clause activation)                      |
| `fail` | `{kind: 'fail'}`                                     | reference to runtime `fail`                                           |
| `js`   | `{kind: 'js', factory: (vars, sys) => GoalFn}`       | `factory(vars, sys)` invoked per activation                           |

### Clause and Rule

```
Clause { head: Term[], body: Goal[], vars?: string[] }
Rule   { name: string, arity: number, clauses: Clause[] }
```

`Rule.arity` must equal `clause.head.length` for every clause. The
validator enforces this; this is the single largest static-error class
the compiler exists to catch (the 2026-05-08 bug cluster was 5 instances
of arity drift).

## Decisions

### Plain objects, not classes

The IR has no methods. Front-ends, lowering, validation, pretty-printing,
and tests all want to walk it as data. Classes would buy nothing here
— there is no behavior to attach. The IR survives `JSON.stringify` /
`structuredClone` round-trips, which is occasionally useful for
debugging and would matter if we ever serialize compiled rules.

### Term and Goal are distinct kinds (not unified)

A compound term and a call goal share the runtime shape `{name, args}`
but have different validation rules:

- A `call`'s `name` (when static) must resolve to a known rule, or be
  a Var/Compound for dynamic dispatch.
- A `compound`'s `name` is just data — no rule-resolution required.

Unifying them as one kind would force the validator to know positional
context. Keeping them distinct localizes that knowledge: terms appear
inside `Term[]` slots, goals inside `body: Goal[]`. The position
already disambiguates.

### `call` handles both static and dynamic dispatch

`Call('member', [X, Y])` and `Call(Var('F'), [X, Y])` are the same kind
with different `name` types. Lowering decides:

- string name + empty args → bare `'name'` runtime form
- string name + non-empty args → `{name, args}`
- non-string name (Var or Compound) → wrap in runtime `call(...)`

Front-ends auto-emit the right `call` shape based on what they parsed.
This is exactly the bug class the compiler exists to fix: in the old
encoding, the user had to remember to write `call(term(F, X))` instead
of `term(F, X)` in goal position. The compiler emits the correct form
unconditionally.

### `cut` is its own kind, not a magic name

Lowering injects `sys` (the choice-point frame slot) automatically.
Users never see `sys`; they write `Cut()`. The historical bug "wrong
arity in inline goal lambda" (project-refresh perf doc, C1) was caused
by hand-wiring `cut(sys)` with the wrong parameter shape. The compiler
removes that footgun.

### `js` is a factory, not a goal-function literal

The factory pattern lets the IR stay declarative and lets lowering
decide when to instantiate the goal function. Each clause activation
gets a fresh closure capturing the activation's Variables. The cost
is one extra closure allocation per activation, which is small
compared to deep6 unification.

The factory takes `(vars, sys)` rather than a single merged record.
`vars` is `Record<string, Variable>` keyed by user-var name; `sys` is
the choice-point frame slot used by `cut`. Two args, not one, because
`sys` is conceptually a separate axis (auto-managed, never user-declared)
and merging it into `vars` makes the static type heterogeneous —
clean `Variable` keys plus one stowaway array — which TS can only
express via a union that hurts every destructured user var.

```js
Js(({X, Y}, sys) => (env, goals, stack) => {
  // X, Y are Variables for this activation; sys[0] is the frame.
  // cut(sys) is callable directly inside inline JS that needs it.
  ...
});
```

### Wildcard is a first-class kind

We could collapse `Wild()` to `Var('_')` or `Lit(_)`, but neither is
right: `_` has unification semantics (matches anything, doesn't bind),
and `Var('_')` would mislead the var-collector. A separate kind makes
intent explicit and validation simple.

At lowering time, each `Wild` becomes the deep6 `_` sentinel. The
sentinel's match-anything semantics happen inside deep6/unify; the IR
does not need to manufacture fresh anonymous variables per occurrence.

### Lists are sugar at the parser, `cons` at the IR

`[X, Y, Z | T]` is convenient but redundant — `Cons(X, Cons(Y, Cons(Z, T)))`
is the canonical form. Parsers translate sugar to cons cells. The IR
includes the `List(items, tail?)` helper so programmatic-API users
don't need to nest by hand.

### No disjunction kind in MVP

Prolog's `(A ; B)` becomes two separate clauses. Per-clause splitting
keeps the IR simple, makes cut wiring obvious (each clause has its own
choice-point frame), and matches how the existing rule library is
already written. A `Disjunction` kind can be added later as parser
sugar that desugars before reaching the IR.

### Var names are strings, not Symbols

Variables in the runtime use `Symbol` identity for env keying, but at
the IR level, names are strings. Strings give meaningful error messages
("undeclared variable `Yt`" — see foldl bug B4 in solver-perf.md),
parse cleanly from source, and let `collectVars` deduplicate via a Set.
Lowering creates the runtime `Variable` instances per activation; IR
strings map 1:1 to those instances within a clause.

### `Compound` over `Term` for the kind name

The IR uses "Term" as the umbrella for the five term kinds. Calling one
of those subkinds also "term" was confusing, so the compound-term kind
is named `compound`. Constructor: `Compound`. The runtime helper
`term(name, ...args)` keeps its name; the IR-level constructor avoids
the collision.

### Clause.vars is optional

The walker `collectVars` derives the var list from head + body. It
skips inside `js` factory bodies (closures are opaque). Front-ends with
a parser that sees the JS destructure pattern can pass `vars` explicitly
to capture vars used only in inline JS. This keeps the simple case simple
and the precise case possible.

## Coverage proof — pattern by pattern

The 15 patterns from the coverage requirements section, with their IR.

| #   | Source                                                                     | IR                                                                                            |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | `eq: X => [head(X, X)]`                                                    | `Rule('eq', 2, [Clause([Var('X'), Var('X')])])`                                               |
| 2   | `notEq: [(X, ...sys) => [head(X, X), cut(sys), fail], () => [head(_, _)]]` | `Rule('notEq', 2, [Clause([Var('X'), Var('X')], [Cut(), Fail()]), Clause([Wild(), Wild()])])` |
| 3   | `head(_, _)`                                                               | `[Wild(), Wild()]`                                                                            |
| 4   | `head(0, _, 0)`                                                            | `[Lit(0), Wild(), Lit(0)]`                                                                    |
| 5   | `term('filter', P, Xt, Yt)`                                                | `Call('filter', [Var('P'), Var('Xt'), Var('Yt')])`                                            |
| 6   | `'true'` (zero-arg)                                                        | `Call('true', [])`                                                                            |
| 7   | `cut(sys)`                                                                 | `Cut()`                                                                                       |
| 8   | `fail`                                                                     | `Fail()`                                                                                      |
| 9   | `env => X.isBound(env) && ...`                                             | `Js(({X}, _sys) => env => X.isBound(env) && ...)`                                             |
| 10  | reversible `(env, goals, stack) => { cut(sys)(...) ... }`                  | `Js(({X, Y, Z}, sys) => (env, goals, stack) => { ... cut(sys)(env, goals, stack); ... })`     |
| 11  | `head(F, listHead(X, Xt), ...)`                                            | `[Var('F'), Cons(Var('X'), Var('Xt')), ...]`                                                  |
| 12  | `head(_, null, null)`                                                      | `[Wild(), Lit(null), Lit(null)]`                                                              |
| 13  | `term('not', term('eq', X, Y))` (compound as data)                         | `Compound('not', [Compound('eq', [Var('X'), Var('Y')])])`                                     |
| 14  | `call(term(F, X, Y))` (variable in goal position)                          | `Call(Var('F'), [Var('X'), Var('Y')])`                                                        |
| 15  | `term(F, X)` as data                                                       | `Compound(Var('F'), [Var('X')])`                                                              |

Map of `src/rules/system.js` to IR is mechanical from the above. The
`/rules/{math,bits,logic}.js` reversible operators reduce to rule #10 +
small literal-head clauses (4, 12).

## Practical patterns

### Object literals as data with structural unification

JSON-style objects flow through the IR as `Lit(value)`. The runtime
sets `env.options.openObjects = true` (`src/solve.js:68`), so deep6
performs structural unification — head and query objects match
field-by-field, with subset semantics.

```js
import solve from 'yopl';
import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import {rule, clause} from 'yopl/compile/clause/index.js';
import {Lit} from 'yopl/compile/ir.js';
import {lowerRules} from 'yopl/compile/lower.js';

const rules = lowerRules([rule('person', 1)(clause`(${Lit({name: 'Alice', age: 30})})`, clause`(${Lit({name: 'Bob', age: 25})})`)]);

// 1. ground match
solve(rules, 'person', [{name: 'Alice', age: 30}], () => console.log('hit'));

// 2. bind a field
const A = v('A');
solve(rules, 'person', [{name: 'Alice', age: A}], env => {
  console.log(assemble(A, env)); // → 30
});

// 3. enumerate
const N = v('N'),
  B = v('B');
solve(rules, 'person', [{name: N, age: B}], env => {
  console.log(assemble(N, env), assemble(B, env)); // Alice 30, then Bob 25
});

// 4. subset query — works because openObjects is on
solve(rules, 'person', [{name: 'Alice'}], () => console.log('subset hit'));
```

Three constraints worth knowing:

1. **Multi-clause rules go in one `rule(...)` call.** `lowerRules`
   keys by `rule.name` (`src/compile/lower.js:75`), so two separate
   `rule('person', 1)(...)` invocations would overwrite.

2. **Variables inside `Lit({...})` in clause heads are unsound.**
   `lowerTerm` returns `term.value` verbatim across activations
   (`src/compile/lower.js:25`); a logic Variable baked into the
   object would alias every activation. For partial structure with
   clause-scoped vars on the head side, fall back to a `Js` body
   goal that decomposes the object manually.

3. **Per-value match-mode wrappers from deep6 propagate.**
   `Lit(open({...}))` locks subset matching regardless of env
   options; `Lit(soft({...}))` extends both sides with each other's
   keys. Both `open` and `soft` are `Unifier` factories exported
   from `deep6/unify.js` and survive `Lit` wrapping without
   ceremony.

### Per-call unification options via `unifyOpts/3`

`unifyOpts(X, Y, Opts)` runs deep6's unification with an options bag
scoped to a single call — the env's baseline options are restored
before the goal returns. Useful when one clause needs tighter or
looser semantics than the env default.

```js
const rules = lowerRules([
  // strictEq opts OUT of openObjects so both sides must have the same
  // key set. solve() puts openObjects: true on the env (subset
  // semantics); strictEq overrides for this call only.
  rule('strictEq', 2)(clause`(X, Y) :- unifyOpts(X, Y, ${Lit({openObjects: false})})`)
]);
```

**Wrap the options bag with `Lit({...})` in clause source.** Raw
plain-object interpolation throws via the auto-wrap fence ("must wrap
explicitly"); `Lit` is the explicit pass-through. Same rule as any
other JSON-style data literal flowing through the IR.

For runtime-decided options, call `unifyOpts/3` from `solve(...)`
with the bag as the third arg — no `Lit` at the runtime boundary:

```js
solve(rules, 'unifyOpts', [a, b, {openObjects: false}], cb);
```

Recognized option keys (deep6 v1.3 baseline; see `deep6/src/unify.js`
for the authoritative list). `new Env()` initializes `options = {}`,
so every flag starts `undefined` (falsy); `solve()` flips
`openObjects` on (`src/solve.js:68`) and leaves the rest alone.

| Key               | Default under `solve()` | Effect                                                   |
| ----------------- | ----------------------- | -------------------------------------------------------- |
| `openObjects`     | **`true`**              | plain objects: unify only the keys present in both sides |
| `openArrays`      | falsy                   | arrays: unify only at common indices                     |
| `openMaps`        | falsy                   | `Map`s: unify only at common keys                        |
| `openSets`        | falsy                   | `Set`s: open-membership semantics                        |
| `loose`           | falsy                   | `==` instead of `===` for primitives (`1 == "1"`)        |
| `circular`        | falsy                   | track visited nodes; safe with cyclic structures         |
| `ignoreFunctions` | falsy                   | skip function-vs-function comparison                     |
| `signedZero`      | falsy                   | distinguish `+0` and `-0`                                |
| `symbols`         | falsy                   | also compare symbol-keyed properties                     |

## What is deliberately NOT in the IR (yet)

| Concern                         | Why deferred                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disjunction `(A ; B)`           | Parser sugar; desugars to multiple clauses pre-IR.                                                                                                   |
| Source maps `{file, line, col}` | Useful for runtime errors; add as optional `source` field on Clause/Term/Goal once a parser exists. Adding later is non-breaking.                    |
| Doc strings                     | Doc comments live in `.d.ts` per project convention; IR is data only.                                                                                |
| First-arg indexing hints        | WAM-style optimization; out of scope and would couple IR to dispatch strategy. See solver-perf.md "bigger optimizations not pursued".                |
| Type annotations on vars        | yopl is dynamically typed; types belong in `.d.ts`, not in IR.                                                                                       |
| Module / namespace              | All rules currently live in one flat `rules` dict. Add only when it becomes painful.                                                                 |
| Negation `\+ G` as a kind       | Desugars to `Call('not', [G])` — `not` is just a rule.                                                                                               |
| Pre-built clause body arrays    | Clause bodies must be reconstructed per activation because head args contain fresh Variables; pre-building would freeze them. Lowering handles this. |

## Open points

- **Source-map field placement.** When a parser lands, decide whether
  the `source` field hangs off `Clause` only (per-clause is usually
  enough for error reporting) or also off `Term` / `Goal` (finer
  attribution at the cost of IR bloat). Lean toward Clause-only.
- **Performance of the closure-walk lowering.** The straightforward
  lowering is "walk IR per activation, allocate runtime values inline."
  An alternative is code-generated lowering — emit a JS string and
  `Function`-construct it, hoisting the walk to compile time. Defer
  until benchmarks show it matters.
- **Validation strictness on dynamic call names.** When `Call.name` is
  a `Compound` (e.g., `Call(Compound(Var('F'), [...]), [...])`),
  lowering must wrap in `call(...)` — but is the args field on the
  outer `Call` redundant or additive? Decide: the inner `Compound`
  carries args, the outer `Call` shouldn't repeat them. Validator
  rejects `Call(Compound(...), nonEmpty)`.
- **Exposing IR as public API.** Per design doc this happens at the
  iter-2 release alongside the Prolog front-end. The shapes documented
  here become the public contract. Anything we'd want to change should
  change before that release.

## See also

- `wiki/Compiler-design.md` (TBD) — user-facing documentation, once
  the per-clause front-end ships.
- `dev-docs/solver-perf.md` — the bug-cluster + perf notes that
  motivated the compiler.
- `src/compile/ir.js` — the implementation.
- `projects/yopl/queue.md` § Rule compiler / DSL (in the vault) — the
  work plan and sequencing.
- `topics/yopl-rule-compiler-design` (in the vault) — the high-level
  design write-up this doc grounds.
