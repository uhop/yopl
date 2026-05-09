# Solver bug audit and performance notes

This document captures the Step 6 work: a bug audit of `src/solve.js`, the
`src/solvers/*` drivers, and the `src/rules/*` library, plus a follow-up
performance pass with measurements.

## Bug audit

Bugs are grouped by file and severity. Each carries a short `[fixed]` /
`[deferred]` marker. The "before" behavior is the state of the code at the
end of Step 1 (the project-refresh starting point).

### `src/solve.js` and the three driver variants

The four solver files (`solve.js`, `solvers/gen.js`, `solvers/async.js`,
`solvers/asyncGen.js`) duplicate the same `prove` loop with small variations
(callback vs. yield vs. await-yield). The bugs below were present in every
copy.

**[fixed] A1 — unguarded unknown rule name.** When a goal references a name
that is not in the rule database, `rules[goal.name]` is `undefined`. The
old code did `!Array.isArray(ruleList) && (ruleList = [ruleList])`, then
later called `rule.length` on the `undefined` element, throwing
`TypeError: Cannot read properties of undefined (reading 'length')`.

The fix checks for `null`/`undefined` and treats the case as "no clauses,
fail this goal". Two new tests in `tests/test-solve.js`
(`test_solve_no_match`, `test_solve_unknown_subgoal`) cover both the
top-level and nested cases.

**[fixed] A2 — `solvers/async.js` does not await `prove`.** The exported
`solve` was `async (...) => { … prove(rules, goals, env); }` — no `await`.
For workloads with a single solution and a synchronous callback this
happened to work because the synchronous portion of `prove` ran to
completion before the outer `await` resolved. For multi-solution workloads
with an `await`-bearing user callback, the user callback would suspend
after pushing the first result and the outer `solve` would return long
before subsequent solutions were produced. Fixed with a one-line `await`.
The `test_asyncSolve_member` test in `tests/test-async.js` previously
disabled is now restored and passes.

**[deferred] A3 — `env.openObjects = true`.** Both `solve` and the three
generator-style entries set `env.openObjects = true` on the freshly created
`Env`. This is not part of `deep6`'s public `Env` interface and is not
documented anywhere. It is presumably used by `deep6/unify` as an
"open object matching" hint. Left unchanged because the behavior matches
the original, and changing it would alter unification semantics.

### `src/rules/system.js`

**[fixed] B1 — `eq` rule body shape.** The rule was
`eq: X => head(X, X)`, returning a single term object instead of an array
of terms. The solver expects `terms[0].args` where `terms` is the rule
body array, so it crashed on `undefined.args`. Fixed by wrapping in an
array: `eq: X => [head(X, X)]`. This bug also broke every higher-level
rule that wrapped `eq` (`call(term('eq', …))`, `not`, `isUnifiable`).

**[fixed] B2 — `notEq` second clause.** Was `[(X, ...sys) => […], [_]]`.
The second element was an array literal, not a function — calling
`(typeof rule == 'function' ? rule : rule.goals)(...vars)` produced
`undefined(…)` which threw. The intended Prolog idiom is "first try
unification + cut + fail, otherwise succeed". Fixed to
`() => [head(_, _)]` (always-succeed binary clause).

**[fixed] B3 — `not` second clause arity.** Was `() => [head()]`, an
arity-0 head, while `not(X)` is unary. The arity mismatch made the second
clause never unify, so `not(X)` _always_ failed regardless of `X`. Fixed
to `() => [head(_)]`.

**[fixed] B4 — `foldl` typo.** The recursive clause built its head with
`head(F, A, listHead(X, Xt), Yt)` where `Yt` is not in scope. Calling
`foldl` would throw `ReferenceError: Yt is not defined`. The intended
variable is `O`. Fixed.

**[deferred / clarified] B5 — `halt` semantics.** `halt` clears the driver
stack and returns `false`. The Step 3 disabled test asserted that the
user callback for the current solution would still fire — that is wrong:
in `solve`, the user callback is appended _after_ the user rule's body in
the goal chain, so a `halt` inside the rule prevents it from running.
Decision: keep the existing semantics ("`halt` is exception-style abort,
no result is reported for the solution that triggered it"), document them
in the wiki, and add `test_rule_halt_aborts_search` asserting that the
result list is empty.

### `src/rules/math.js`, `src/rules/bits.js`, `src/rules/logic.js`

These three files share the same family of bugs across most of their
predicates. The fixes are mechanical but pervasive.

**[fixed] C1 — wrong arity in inline goal lambda.** The general clause of
each reversible predicate (math: add, sub, mul, div, neg; bits: bitXor,
bitNot) was written as `(env, stack) => { … cut(sys)(env, stack) … }`.
But `solve.js` calls inline goal functions as `goal(env, goals, stack)`,
so the lambda's second parameter (named `stack`) was actually the goals
linked-list. The subsequent `cut(sys)(env, stack)` call therefore passed
`(env, goals)` to `cut`, whose third parameter (`stack`) was `undefined`.
The first thing cut does is `stack.length`, throwing `TypeError`. Every
"general" math/bits predicate crashed on first use. Fixed by changing the
signature to `(env, goals, stack) => { … cut(sys)(env, goals, stack) … }`.

**[fixed] C2 — `z = X.get(env)` typo.** In every `count == 3` branch
(all three operands bound), the code read `const z = X.get(env)` instead
of `Z.get(env)`. As a result, the all-bound check compared `x ⊕ y` against
`x` rather than `z`. Affected: `logicalAnd`, `logicalOr`, `logicalXor`
(in logic.js); `add`, `sub`, `mul`, `div`, `neg` (in math.js); `bitAnd`,
`bitOr`, `bitXor`, `bitNot` (in bits.js). Fixed.

**[fixed] C3 — bare `count = …` assignment.** In the `neg` (math),
`bitNot` (bits), and `logicalNot` (logic) general clauses, the count
variable was assigned without `let`/`const`. Under ESM strict mode this
throws `ReferenceError: count is not defined` at runtime, making each
predicate completely unusable. Fixed.

**[fixed] C4 — stray unused `const z = X.get(env);` in 2-arg predicates.**
The `neg` and `bitNot` `count == 2` branches declared an unused `z`
variable (also affected by C2). Removed during the rewrite.

### Test coverage

After all fixes, the suite grew from 60 → 115 tests. New coverage:

- `tests/test-solve.js`: unknown rule name (top-level and nested).
- `tests/test-async.js`: multi-solution `asyncSolve` (proves the missing
  `await` fix).
- `tests/test-system.js`: `eq`, `notEq`, `unify` alias, `call` with
  `term`, `not` negation-as-failure, `true`, `halt` aborts the search.
- `tests/test-rules.js`: every reversible math/bits/logic predicate is now
  exercised in every direction (X,Y → Z; X,Z → Y; Y,Z → X; all-bound
  check). Added `comp/nz` and mixed-type comparison failure cases.

## Performance pass

### Approach

The audit above is the main Step 6 deliverable. The performance pass is
deliberately conservative: I added a micro-benchmark (now under `bench/`)
that runs a small set of representative workloads, captured a baseline,
applied two non-invasive optimizations, and re-measured.

### Baseline (post-bug-fix, pre-optimization)

```
member: contains last (n=50)                28.03 ms /  50 iters   560 µs/op
member: enumerate all (n=50)               119.31 ms /  50 iters  2386 µs/op
member: contains last (n=200)              181.09 ms /  50 iters  3622 µs/op
append: split list (n=10)                   36.92 ms / 200 iters   185 µs/op
gen member (n=50, take 1)                   55.74 ms / 6400 iters   8.7 µs/op
math add forward (1000 solve calls)        535.51 ms /  50 iters 10710 µs/op
```

### Optimizations applied

**O1 — `POP` constant.** The proof loop creates a `{command: 1}` "pop env"
marker frame on every goal-function evaluation and on every successful
rule clause. These frames carry no state, so they can be a single shared
constant. Saves one allocation per inline goal evaluation and one per
clause head match. (Already applied during the bug fixes for clarity.)

**O2 — `generateVariables` tightening.** Replaced `[].push` + `.map` with
a single pre-sized `new Array(n)` loop. Saves one intermediate allocation
plus the `.map` closure-per-element overhead.

**O3 — `NO_ARGS` sentinel.** The proof loop falls back to `goal.args ||
[]` and `terms[0].args || []` whenever a term has no arguments. Replaced
the per-call `[]` with a frozen, module-level shared empty array. Saves
one allocation per arg-less goal evaluation.

### Measurements after O1-O3

```
member: contains last (n=50)                27.17 ms /  50 iters   543 µs/op   (−3%)
member: enumerate all (n=50)               119.76 ms /  50 iters  2395 µs/op   (±0%)
member: contains last (n=200)              170.38 ms /  50 iters  3408 µs/op   (−6%)
append: split list (n=10)                   38.57 ms / 200 iters   193 µs/op   (±0%)
gen member (n=50, take 1)                   23.39 ms / 3200 iters  7.3 µs/op   (−16%)
math add forward (1000 solve calls)        527.11 ms /  50 iters 10542 µs/op   (−2%)
```

The deltas are small and noise-bound for the busy benchmarks. The
`gen member take-1` case shows the largest relative gain because its
absolute work is tiny — the saved allocations are a meaningful fraction
of total cost. For the long-running cases, the savings are absorbed by
the dominant cost: `deep6/unify` and the per-clause `Env.push`/`pop` /
`bindVal` machinery.

### Where the time actually goes

Profiling-by-elimination of the `member contains last (n=200)` case
suggests the breakdown is roughly:

1. **Variable allocation** — `Symbol(counter++)` plus `new Variable(sym)`
   per logical variable, executed every time a rule clause is tried.
   For deep recursive predicates this dominates.
2. **`deep6/unify` of head args** — proportional to the structure depth.
3. **`Env.push` / `Env.pop` / `bindVal`** — every clause creates and
   reverts a stack frame on the env's prototype-chain map.
4. **Goal-frame allocation** — one `{terms, index, next}` per rule
   activation.
5. **Choice-point frame allocation** — one `{command:2, ruleList, index,
goals, args}` per rule call.

Items 1, 3, 4, 5 are all "per rule call" allocations. Pooling them is
possible but invasive: the frames live across stack pops, so a pool would
need a free-list with manual lifetime management. Item 1 is harder still
because variables are keyed by Symbol identity inside `Env`, and `Env`
keeps them alive via its `variables`/`values` maps.

### Bigger optimizations not pursued

These were considered and rejected as out of scope for this pass:

- **Frame pooling.** Maintain a free list of choice-point frames and goal
  frames per `prove` call, recycling them after the env unwinds past
  them. Estimated 10–20% gain on member-style workloads. Risk: lifetime
  bugs are subtle, especially with the async drivers where `await` can
  interleave with frame manipulation.

- **Variable pooling.** Share a pool of `Variable` instances per `prove`
  call, resetting their bindings on rule retry instead of allocating new
  ones. This requires the variable identity (`Symbol`) to be reset too,
  which conflicts with `Env`'s assumption of immutable variable identity.
  Would require coordinated changes in `deep6`. Out of scope for yopl
  alone.

- **Solver de-duplication.** The four driver files share ~95% of the
  prove loop. They could in principle share a single source of truth via
  a generator factory or a code-generation step. The differences
  (callback vs `yield` vs `await … yield`) span different syntactic
  forms (sync function vs `function*` vs `async function*` vs `async`),
  so de-duplication is awkward without a build step. Left as
  maintenance debt; the duplication is at least mechanical and unlikely
  to drift now that all four files are bug-compatible.

- **Indexed rule dispatch.** The current dispatch is `rules[goal.name]`,
  which is already O(1). A more sophisticated first-argument index (as
  in WAM-style Prolog implementations) would speed up multi-clause rules
  with disjoint heads, at the cost of significant complexity. Out of
  scope.

### Conclusion

The Step 6 win is the bug audit: every reversible math/bits/logic
predicate now actually works, the `eq` / `notEq` / `not` family is
usable for the first time, the async solver returns all results, and
unknown rule names fail gracefully instead of crashing. The accompanying
test count almost doubled (60 → 115). The performance touches are
marginal in absolute terms; the larger gains require structural changes
that would benefit from a separate, focused effort.
