# IR → JS source backend — research notes + POC plan

Research summary and proof-of-concept plan for an alternative lowering
target: emit JS source text from yopl IR (compiled per-clause and
loaded via `new Function`), instead of returning closures built by
`src/compile/lower.js`. Filed as research, not committed work.
Companion to [`wasm-backend.md`](wasm-backend.md) and
[`compiler-ir.md`](compiler-ir.md).

The user-facing motivation is the same as the WASM backend: yopl's
per-call cost is the bottleneck on O(N!) workloads (see
[`../wiki/Search-feasibility.md`](../wiki/Search-feasibility.md)).
Of the three IR-backend research items, this is the **lowest
infrastructure cost** path — no new runtime, no boundary, no
toolchain dependency. If it wins, ship; if not, the negative result
informs the WASM POC's expectations.

## The hypothesis

`src/compile/lower.js` is 112 lines. The lowered rule function it
returns (`lowerClause` at lines 85-104) walks the IR on **every
activation**:

```js
const fn = (...allVars) => {
  const vars = {};
  for (let i = 0; i < varNames.length; ++i) vars[varNames[i]] = allVars[i];
  const sys = allVars.slice(varNames.length);
  const headArgs = clause.head.map(t => lowerTerm(t, vars));
  const body = clause.body.map(g => lowerGoal(g, vars, sys));
  return [{args: headArgs}, ...body];
};
```

Per activation, for a clause with N vars + H head terms + B body
goals:

- One `{}` allocation for `vars`.
- N property assignments to populate it.
- One `allVars.slice(varNames.length)` array allocation for `sys`.
- One `.map` over `clause.head` (allocates the result array; H
  recursive `lowerTerm` walks; each walk type-tests `term.kind` and
  dispatches).
- One `.map` over `clause.body` (allocates the result array; B
  recursive `lowerGoal` walks; same dispatch shape).
- One `[{args: headArgs}, ...body]` allocation (head + spread).

This is **a lot of work per activation**. A recursive rule walking
a 100-element list pays it 100 times. The IR doesn't change across
activations — only the input variables do. The per-activation walk
re-derives the same dispatch decisions every time.

**Hypothesis**: pre-specialize the head/body construction at compile
time. Emit a JS function per clause whose body literally constructs
the head args and goal sequence with no IR walk, no `vars` dict,
no dispatch. V8/JSC see a stable per-clause function and tier it up
to TurboFan/FTL with full type specialization. Estimated win: 2-5×
on per-activation cost, in the same ballpark as the EnvMap swap
(3-6×). Testable.

## Design-space taxonomy — "less per-activation work"

The current per-activation work isn't a single thing. It's a stack
of avoidable layers on top of one **unavoidable** core given the
current architecture: runtime values that contain Variable
references must be fresh per activation (load-bearing for
backtracking correctness — `solve.js` mints fresh
`variable(Symbol(N))` per clause attempt so concurrent activations
of the same clause don't share binding-storage keys).

Four regimes:

| Regime                            | Approach                                                                                                                                                           | Where it lives                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **A. Status quo**                 | Per-activation IR walk via `lower.js` closure factory                                                                                                              | `lower.js` today                     |
| **B. Codegen**                    | Pre-specialize the per-activation walk via `new Function`                                                                                                          | This POC                             |
| **B'. Codegen + constant-output** | B plus shared-constant return for ground clauses                                                                                                                   | Standalone analysis pass; add to POC |
| **C. Re-imagined runtime**        | Architecture change — different rule-fn shape, possibly different proof loop, possibly different unifier. The "outlandish JS-based alternative runtime" queue item | Major redesign; see below            |

A → B is a codegen change. B → B' is an analysis pass. B' → C is a
broader architecture change that propagates beyond `lower.js`. Each
step buys more perf at increasing implementation cost and increasing
distance from the current architecture.

The JS-source POC is **regime B + B'**. Regime C is an adjacent
research path discussed at the end of this doc.

## Input is IR (or source); the rules dict is one possible output

The current runtime rules-dict shape (`{name: [fn, ...]}` where each
`fn` returns `[{args}, ...goals]`) was the **practical** basis for
the four existing solvers — a concrete contract they could all
agree on. It is not part of the design contract for new backends.
The **abstract** basis going forward is IR (user direction
2026-05-10).

A new backend's input is one of:

- The **IR** directly (5 Term + 4 Goal kinds + Clause + Rule), or
- **Source text** — Prolog (`prolog\`...\``), per-clause
(`clause\`...\``), or whatever new front-end is convenient — which
converts to IR via the compiler's existing parse path. No new
parser needed; source-text consumers reuse `compile/prolog/`,
`compile/clause.js`, and `compile/ir.js`.

A new backend's output is **whatever serves its runtime best**.
The current rules-dict shape is one option (drop-in for the four
solvers). Alternatives:

- A flat `Int32Array` of opcodes the runtime dispatches via a single
  big `switch`.
- A single monolithic dispatch function with all rules inlined.
- A specialized graph of clause structures linked by predicate name
  (no per-name array indirection).
- A WASM module exporting a `solve` entry — the WASM backend's case.
- Something else entirely.

If the output shape diverges from the rules dict, the backend
brings its own runtime + proof loop + driver family. Functionality
must stay on par (the four delivery shapes — sync push, sync pull,
async push, async pull — all present); the internals are free.

**Even regimes B and B' aren't forced to produce the current rules
dict shape.** The hypothesis section above assumes they do (it's
the conservative, drop-in path), and that's the right shape for the
POC to start at because it minimizes blast radius. But if a
different output JITs measurably better, it's on the table. The
bench is the arbiter; rules-dict-shape preservation is a convenience
inherited from regime A's solver contract, not a requirement of the
IR.

## What V8 and JSC do with dynamically-created functions

V8 has a four-tier compilation pipeline: Ignition (interpreter) →
Sparkplug (baseline) → Maglev (mid-tier) → TurboFan (top-tier).
JavaScriptCore (Bun, Safari) has a parallel four-tier shape: LLInt
→ Baseline → DFG → FTL. Functions tier up based on invocation count
and loop iterations; specialization is driven by type feedback
collected at the lower tiers.

**`eval` vs `new Function`** — this is decisive:

- **`eval`** captures the enclosing lexical scope. The engine must
  conservatively assume eval'd code can read or modify any local
  variable in the calling function, so it **disables optimizations
  for the entire enclosing function**: locals stay in memory rather
  than registers, inline caches are disabled, the eval'd code itself
  stays at Ignition / LLInt. Benchmarks show `new Function()` is
  ~54× faster than `eval()` in V8 for the equivalent code.
- **`new Function(arg1, arg2, body)`** creates a function with **no
  access to the enclosing lexical scope** — only globals and its
  declared parameters. The engine compiles it like any regular
  function declaration. It tiers up to TurboFan/FTL normally.
  Inline caches work. Type specialization works.

**Decisive: use `new Function`, not `eval`.**

**Code caching** — V8 has two layers:

- In-memory cache keyed on source string: the second compile of the
  same source string (in the same V8 instance) is faster.
- Persistent on-disk cache via Node's `vm.Script` with `cachedData`:
  serialize once, reuse across processes. The cache is versioned by
  `v8.cachedDataVersionTag()` so it auto-invalidates on V8 upgrade.

For yopl, the in-memory cache is automatic and free — if `solve()`
is called repeatedly with the same rules dict, V8 caches the
compiled functions. `vm.Script` cachedData is opt-in and only
relevant for long-running processes (servers, persistent workers);
defer until post-POC.

## Codegen variants

(Variant numbers below are independent of the regime letters above
— "variant" refers to **how** to emit code inside regime B; "regime"
refers to **which** of the four design-space points the POC sits at.)

Four shapes considered for IR → JS source:

| Variant                                              | Function shape                                                                                                        | Trade-off                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **V1. eval'd closures, same shape as today**         | `eval` returns the same closure factory `lower.js` produces, just from source text                                    | No win — V8 sees the same shape either way; `eval` overhead negates it               |
| **V2. Per-clause `new Function`, head/body inlined** | One `new Function(...vars, body)` per clause; head args constructed as literal expressions; body goals emitted inline | Best win/effort ratio. **Default.**                                                  |
| **V3. Whole rules dict → one module**                | Emit a JS module string; load via dynamic `import()` of a `data:` or `blob:` URL                                      | Async load; full module scoping; bundler-unfriendly; deferred                        |
| **V4. `new Function` returning an array literal**    | Like V2, but the whole body is one `return [...]` expression with no statements                                       | Marginally smaller; V8 likely inlines either way; not worth the syntactic constraint |

**Variant V2** is the right default. The generated function for
`member(X, [X | _])` would look like:

```js
new Function(
  'X',
  'argN', // varNames + sys passed positionally
  'return [' + '{args: [X, {value: X, next: variable()}]}' + '];'
);
```

And for `member(X, [_ | T]) :- member(X, T)`:

```js
new Function('X', 'T', 'argN', 'return [' + '{args: [X, {value: variable(), next: T}]}, ' + '{name: "member", args: [X, T]}' + '];');
```

Compared to the closure factory `lower.js` produces today, V2:

1. **Skips the `vars` dict** — variables are positional parameters.
   Saves one object allocation + N property assignments per activation.
2. **Skips the IR walk** — head structure is inlined as literal
   expressions. Saves H recursive `lowerTerm` calls + their
   type-tests.
3. **Skips per-goal dispatch** — body goals are emitted directly.
   Saves B recursive `lowerGoal` calls + their type-tests.
4. **Skips `.map` allocations** — array elements are inlined in the
   `return [...]` literal. Saves two intermediate arrays per
   activation.
5. **Reaches TurboFan/FTL** — the function has stable shape across
   activations (same arity, same return-array length, same
   per-element type at each slot); V8/JSC specialize it normally.

Per-activation cost should drop from "walk + dispatch + multiple
allocations" to "evaluate a literal expression sequence."

## Where the savings live — yopl-specific

Three places the codegen wins:

**1. Hot-path elimination of dispatch.** The current `lowerTerm` /
`lowerGoal` switches dispatch on `term.kind` / `goal.kind` every
activation. The kind is known at compile time; emitting the right
constructor expression directly is strictly cheaper. For
`bench-proof-loop.js` (the deepest call-path bench in the suite),
this is the biggest single saving.

**2. `Lit`-walker pre-resolution.** `lowerLitValue` recursively
walks `Lit` values per activation, substituting nested IR nodes.
The walk is deterministic given the literal's structure — if the
literal contains no IR nodes (a plain `Lit(42)`, `Lit({a: 1})`,
`Lit([1, 2])`), the codegen emits the literal directly with no
runtime walk. If it does contain IR (`Lit({tag: Var('X')})`), the
codegen emits a constructor expression that builds the result.
Either way: zero runtime walk for any pre-resolved literal.

**3. Inline JS goal fast-path.** The `js` goal kind already invokes
`goal.factory(vars, sys)` at activation time to mint the JS goal
function. The codegen emits the call directly: same JIT-friendly
shape, no per-call wrapping in `.map`. For `native.js` rules with
many inline-JS goals, this is the second-biggest win.

What's **not** saved: the proof loop's own per-call cost (env
push/pop, unify, choice-point management). That's `solve.js`'s
domain, not `lower.js`'s. The codegen only reduces the cost of
**constructing the goal sequence** the proof loop then evaluates.
If the proof loop's per-call cost dominates (most likely on deep
recursion with simple bodies), the codegen win is bounded by what
regime B can offer; regime C is where the proof-loop cost itself
gets attacked.

## Regime B' — constant-output clauses as a free specialization

Many clauses produce **the same runtime terms on every activation**
because they have no `Var`, no `Wild()`, and no `Lit` containing IR.
Examples:

- Ground facts: `parent(tom, bob).`
- 0-ary atoms: `green.`
- Any clause whose head and body are entirely literal.

For these, the lowered function can return a **shared constant**:
the `[{args}, ...body]` tree is built once at compile time and the
same object is returned from every activation. Unification doesn't
mutate the head args (only `env`); the proof loop's mutating field
(`goals.index`) lives on the frame, not on `terms`. Sharing is safe.

Compile-time classification: a clause is constant-output iff
`collectVars(clause).length === 0` AND no `Wild()` term appears
recursively AND every `Lit` value contains no IR (gated on the
closed `IR_KINDS` set, same logic as `lowerLitValue`).

This is **a standalone optimization independent of the JS-source
codegen** — could land as its own POC. Per
[`implementation-discipline.md`](implementation-discipline.md), it
lives as a new module (e.g., `src/compile/analysis/constant-output.js`

- a new lowering entrypoint that consumes it), **not as edits to
  `lower.js`**. The existing closure-factory path stays untouched as
  the baseline. Worth measuring during the POC: **how much of yopl's
  representative workload is constant-output?** If 30%+ of clause
  activations land in that class, B' is a meaningful win on its own.
  If < 10%, it's a footnote.

There's also a partial variant: a clause whose **`Lit` values
contain no IR** but whose head/body has `Var`s elsewhere can have
those Lit substructures pre-resolved at compile time and embedded
directly in the codegen output, skipping `lowerLitValue`'s
per-activation walk. Strict win, ~10 lines of code, slot into the
emitter.

## Commonalities with existing solvers

This is the big architectural advantage over the WASM backend.
**The proof loop, drivers, and runtime stay unchanged.**

| Component                                                         | Lives in                | Touched by JS-source codegen?                                                                   |
| ----------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `prove(rules, goals, env)`                                        | `src/solve.js:14-74`    | **No** — same proof loop, same algorithm, same env push/pop, same unify call                    |
| `solve(rules, name, args, callback)`                              | `src/solve.js:75-80`    | No — push driver, unchanged                                                                     |
| `solversGen` (pull)                                               | `src/solvers/gen.js`    | No                                                                                              |
| `solversAsync` / `solversAsyncGen`                                | `src/solvers/async*.js` | No                                                                                              |
| `generateVariables(count)`                                        | All four solvers        | No — Variable allocation owned by proof loop                                                    |
| `EnvMap` / unify / sentinels                                      | deep6                   | No                                                                                              |
| Rules dict shape (`{name: [fn1, fn2, ...]}`)                      | Calling convention      | **No** — emitted functions are call-compatible with what `lower.js` produces today              |
| Rule function calling convention (`(...vars) => [head, ...body]`) | `lower.js`'s output     | **Compatible** — emitted functions have the same `(positional vars) → [{args}, ...goals]` shape |

The only change is `src/compile/lower.js`'s output shape: instead
of closures over IR, emitted functions. The proof loop calls them
the same way (`fn(...vars)`) and gets back the same
`[{args}, ...body]` array.

This means **the four solvers all benefit automatically** under
regimes B and B' — same codegen, same speedup, four drivers. No
driver fork. No alternative solver to write.

**Feature-detection dispatch** lives at `lowerRules` entry: pick the
codegen target (closure-factory today; JS-source after this lands;
WASM if available + tail-call supported, after WASM POC ships).
Single IR, multiple lowering backends, one feature-detection
point.

**Caveat on the "no driver fork" property**: this only holds while
the backend chooses to **preserve the rules dict shape**. Per the
"Input is IR; rules dict is one possible output" section above,
that preservation is a convenience, not a requirement. A regime-B
codegen that emits something different from `{name: [fn, ...]}` —
say, a single packed dispatch function — would bring its own proof
loop and driver family. The default POC path preserves the dict
shape to minimize blast radius; the alternative is open. Regime C
explicitly diverges. Either way, functionality stays on par across
the four delivery shapes.

## Commonalities with the potential WASM backend

Both backends emit code from the same IR. The shared work:

| Shared concern                                                    | Current state                                        | Could move to a shared module                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Variable scope analysis**                                       | `collectVars(clause)` in `ir.js`                     | Already shared. Both backends consume                                                                                                                                                                             |
| **Head-pattern normalization**                                    | `lowerTerm` walks per activation                     | Extractable: a "head-arg-construction plan" — a sequence of (allocate variable, build cons cell, build compound, embed literal) ops. JS-source emits as expression text; WASM emits as `i32.store` ops. Same plan |
| **Body-goal sequencing**                                          | `lowerGoal` walks per activation                     | Extractable: a "body-goal plan" — a sequence of (call rule, cut, fail, inline-js) entries. JS-source emits as object literals; WASM emits as `call_indirect` ops                                                  |
| **`Lit`-walker**                                                  | `lowerLitValue` in `lower.js`                        | Hardest to share. JS-source can emit literal expressions for static portions; WASM has to either pre-translate to linear-memory cells at query entry or hold via `externref`. Diverges                            |
| **Source-position threading**                                     | `clause.source: {file?, line, col}` on Clause IR     | Already shared. JS-source emits `//# sourceURL=` or a source-map blob; WASM emits a `.debug_*` custom section. Same input                                                                                         |
| **Validation**                                                    | `validate.js` (arity-mismatch, undeclared-var, etc.) | Already shared. Pre-codegen                                                                                                                                                                                       |
| **The IR itself**                                                 | `ir.js` (5 Term + 4 Goal kinds + Clause + Rule)      | Already shared. **The whole point**                                                                                                                                                                               |
| **Variable lifetime analysis** (first-use / last-use / dead vars) | Not done today                                       | Both backends benefit. JS-source could elide vars in single-use positions; WASM could reuse heap cells. Worth doing once, in a shared analysis pass                                                               |

**Refactor opportunity**: extract `lower.js` into two layers:

```
ir-to-plan.js          ─ IR → backend-neutral plan (head + body + var-lifetimes)
plan-to-closure.js     ─ plan → current closure-factory output (today's lower.js, restructured)
plan-to-js-source.js   ─ plan → new Function (this POC)
plan-to-wasm.js        ─ plan → WASM binary (future WASM POC)
```

This refactor is **not** required for the JS-source POC. The POC
can hand-write the IR → JS-source emitter as a parallel `lower.js`
sibling, prove the speedup, then refactor. If the POC stops at
the decision gate (no win), the refactor was avoided.

If both POCs ship, the refactor pays for itself in deduplication.

## POC — minimum experiment that answers the question

Don't refactor first. Don't generalize first. Build the minimum
that puts a number on "does emitting JS source from yopl IR beat
the current closure factory?"

All POC files are new (per
[`implementation-discipline.md`](implementation-discipline.md)).
`src/compile/lower.js` stays untouched as the baseline.

1. **Constant-output classifier first (regime B')** — new file:
   `src/compile/analysis/constant-output.js`, ~30 lines. Classifies
   each clause as constant-output or var-dependent given its IR.
   Plus a new lowering entrypoint (`src/compile/lower-const.js`)
   that wraps the existing lowerRule from `lower.js` but returns
   `() => SHARED_TERMS` for constant-output clauses (the shared
   constant is the existing lower.js's one-time result, memoized).
   Measure the constant-output fraction on the existing test corpus
   while you're there — that number informs how to weight regime
   B vs regime C if the codegen win is small.
2. **Write `src/compile/lower-jsrc.js`** — parallel to `lower.js`,
   same export surface (`lowerRule`, `lowerRules`). Internally
   uses `new Function` to emit per-clause functions whose body is
   the literal head + body sequence. Skip the refactor; ~150-250
   lines of straightforward string building. Variable lifetime
   analysis is **not** needed for the POC — emit naïvely; optimize
   only if the bench warrants it.
3. **Two new bench files** (siblings, not replacements):
   - `bench/bench-proof-loop-jsrc.js` — same workload as
     `bench-proof-loop.js`, but built via `lower-jsrc.js`. Compares
     activation cost.
   - `bench/bench-inline-goals-jsrc.js` — same as
     `bench-inline-goals.js`. Tests the `js`-goal-factory path
     specifically.
4. **Run the existing parity bench** (`bench-handwritten-vs-compiled.js`)
   in a new sibling (`bench-handwritten-vs-jsrc.js`) with the new
   lowering target as a third column.
5. **Decision gates** (decisions only — file reorganization is a
   separate later pass per implementation-discipline.md):
   - JS-source is **≥ 3× faster** on the proof-loop bench
     **and** ≥ 2× on the inline-goals bench → recommend as the new
     default lowering. Decide rename/reorganization in a separate
     cleanup PR.
   - JS-source is **1.5-3× faster** → ship as an opt-in (`lowerRules(rules, {target: 'js-source'})`).
     Keep the closure factory default until variable-lifetime
     analysis is added and re-benched.
   - JS-source is **roughly neutral** → file the negative result.
     The IR walk wasn't the bottleneck; proof-loop cost dominates.
     **Reroute to regime C** (the adjacent JS-runtime path below)
     before reaching for the WASM POC — same cost-attack at lower
     infrastructure cost.

The constant-output classifier in step 1 is a strict win regardless
of whether step 2 ships — file it as a small standalone PR even if
the codegen result is neutral. Same discipline applies: new files,
no edits to `lower.js`.

Estimated POC effort: 1-2 days. No new dependencies. No new
toolchain. The bench scaffold already exists.

## Open questions for the POC to answer

- Does the in-memory code cache work for `new Function`? Calling
  `new Function(args, sameSource)` repeatedly — does V8 reuse the
  compiled code? Or does each call re-parse? (Documentation says
  the cache is keyed on source string. Worth a microbench to
  confirm.)
- For a clause with no `Lit`-walker-resolvable substructure
  (every `Lit` contains IR), the emitted function still has to
  call into a runtime helper to walk per-activation. Does the
  win bound by the IR-free fraction of the rules dict?
- Source maps: a generated function's stack frames currently show
  as `<anonymous>`. Can `//# sourceURL=...` direct devtools at the
  yopl source? (For Node's stack traces specifically.)
- Inline `${jsFunction}` goals — does the codegen embed the
  function reference (via a closed-over const) or does it call back
  through the rules dict? The former is faster but requires the
  emitted code to close over the IR's `factory` references.
  `new Function` can't close over locals. **Resolution**: pass the
  factory references as additional parameters to the emitted
  function, or store on a shared "builtins" object passed in.

## Regime C — re-imagined runtime architecture

Filed in the queue as "outlandish JS-based alternative runtime as
IR target." User context 2026-05-10: this item is **not specifically
about reproducing WAM in JS**. Prior research (predating yopl's
current architecture) concluded that classical WAM techniques —
tagged pointers, linear-memory heap, mutation-based unification,
backtracking via heap-pointer reset — don't translate cleanly to JS.
JS engines fight pointer-tagging tricks, GC fights heap-reset
backtracking, and the perf wins WAM gets in C/Rust evaporate. yopl's
current shape (deep6 `unify` + `Env` + four solvers + rule system)
IS the result of that earlier "what's the right JS-native shape"
exploration.

Regime C is about **re-imagining the architecture again**, with the
benefit of the IR yopl now has and the data points the bench
scaffold can produce. The constraints are loose (per user direction
2026-05-10):

- Not required to use the existing `unify()`. `deep6.unify` is a
  general-purpose value-matcher (plain objects, arrays, Maps, Sets,
  Dates, circular, open/soft, signed zero, etc.); LP needs a much
  narrower subset and could ship a specialized unifier.
- Not required to keep the four-solver shape. The four delivery
  shapes (sync push, sync pull, async push, async pull) must still
  exist with on-par functionality, but the internals can diverge.
- Not required to keep the current rule-fn calling convention.
- The existing IR (5 Term + 4 Goal kinds + Clause + Rule) is a
  reasonable starting basis.
- Rule structure itself is loosenable if the gains warrant it.

The success criterion is **measurable speedup** over regime A/B/B'
on the existing benches, with functionality on par. The shape isn't
specified in advance — the prior WAM exploration found that the
"obvious" WAM-style shape isn't the right answer for JS, so the
design space is genuinely open.

### Design dimensions to explore

Each of these is independently movable; a regime-C experiment picks
one or two to vary and holds the rest fixed:

| Dimension              | Current (regime A)                                      | Alternative                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unifier**            | `deep6.unify` — fully general-purpose                   | LP-specialized: only the IR shapes (Var, Cons, Compound, Lit-of-primitive, atoms-as-strings); narrower dispatch, no circular/open/soft path on the hot loop |
| **Env / bindings**     | `EnvMap` (Map per frame; push/pop snapshots)            | Trail array of `[name, prevValue]` pairs; flat typed-array with a pointer; pool by depth                                                                    |
| **Variable instances** | Minted per activation by `generateVariables(count)`     | Pre-allocated pool keyed by clause-id + activation-depth; reused after `env.pop`                                                                            |
| **Rule fn shape**      | `(...vars) → [{args}, ...goals]` (returns tree)         | Mutates-in-place + continuation; or yields a generator of solutions; or emits bytecode                                                                      |
| **Goal sequencing**    | Array of `{name, args}` objects walked by `goals.index` | `Int32Array` of opcodes the proof loop dispatches via a single big switch; or explicit Goal-graph traversal                                                 |
| **Proof loop**         | Explicit-stack iterative in `solve.js`'s `prove`        | Same shape with smaller frames; or trampolined; or split sync-fast-path + async-slow-path                                                                   |
| **Choice points**      | Implicit (frames on the stack)                          | Explicit choice-point objects with stored continuation                                                                                                      |

### What might genuinely work in JS that didn't in classical WAM

The prior research's negative results were specifically about
WAM-classical techniques. Adjacent ideas that didn't get tried
then, or that map better onto current V8/JSC:

- **Engine-friendly object shapes for rules.** Keep regime-A's
  return-a-tree calling convention but make the returned tree more
  monomorphic — same length per clause, same property order, no
  optional fields. Sparkplug / DFG-Baseline likes monomorphic
  shapes; TurboFan / FTL specializes them. Closer to a polished
  regime B than a regime-C redesign; might capture most of the
  available win without architecture change.
- **Bytecode-on-an-array goal representation.** Instead of arrays
  of `{name, args}` objects, an `Int32Array` of opcodes the proof
  loop dispatches via a single big `switch`. V8 specializes
  switch-on-i32 well (this is how Ignition itself works). May
  lower the per-goal dispatch cost below what regime B can.
- **Specialized LP-unifier.** Independent of any regime-C
  architectural change. A ~100-line unifier covering only the IR's
  Term shapes could be 2-3× faster on yopl's actual workload than
  `deep6.unify` is. Could ship as a deep6 alternative entrypoint
  (`deep6/unify-lp.js`) or as a yopl-internal module. **The
  cheapest experiment in the regime-C space** — measurable on
  `bench-proof-loop.js` without any other change.
- **Trail-based binding store** instead of `EnvMap`'s push/pop.
  A flat array of `[name, prevValue]` entries, with a per-frame
  pointer for backtracking. Common in WAM but the failure mode is
  GC-vs-pointer-reset; pure-JS arrays sidestep that.

### Two trigger conditions for starting

The recommendation in the POC section above stands: don't start a
broad regime-C effort until either (a) regimes B/B' hit a ceiling
on the proof-loop bench, or (b) the WASM POC stalls on boundary
cost. Both conditions imply the per-activation IR walk isn't the
bottleneck — which is exactly what regime C attacks.

**Exception**: the LP-specialized unifier is cheap and standalone.
File as a separable experiment ahead of the regime-C umbrella.

### Relationship to the WASM backend

WASM is a more permissive environment for WAM-classical techniques
than JS: linear memory works, tagged pointers work, heap-reset
backtracking works, no GC interference. The WAM-in-WASM design in
[`wasm-backend.md`](wasm-backend.md) takes advantage of all of
these. **Regime C in JS does not have to look like the WASM
backend** — JS's tradeoffs are different, and the prior WAM
research already established that the WASM-friendly shape doesn't
JIT well in JS. The two are siblings, not the same design compiled
to different targets.

That said, **if** a regime-C JS design and the WASM backend
converge on a similar plan-IR (head ops + body sequence + var
lifetimes), the codegen pass can share that intermediate
representation even if the emitters and the runtimes differ.

## Out of scope for this POC

- Whole-program codegen (variant V3). Per-clause is simpler and
  benchmarks the same hypothesis.
- `vm.Script` + persistent code cache. Defer until JS-source ships
  and a long-running-process consumer surfaces.
- Source maps. Easy to add via `//# sourceURL=` after the win is
  confirmed.
- Variable lifetime analysis. Emit naïvely; revisit if the bench
  warrants it.
- The shared `ir-to-plan.js` refactor. Only do this if both POCs
  succeed.
- CSP-restricted environments. `new Function` is blocked under
  strict CSP. yopl will keep the closure-factory backend as the
  CSP-compatible fallback; document the constraint, don't try to
  work around it.

## See also

- [`compiler-ir.md`](compiler-ir.md) — the IR the JS-source backend
  consumes.
- [`wasm-backend.md`](wasm-backend.md) — sibling research item;
  shared planning concerns (see "Commonalities" above).
- [`solver-perf.md`](solver-perf.md) — the perf baseline this
  backend has to beat.
- [`implementation-discipline.md`](implementation-discipline.md) —
  new-files-only convention for POC work.
- [`../wiki/Search-feasibility.md`](../wiki/Search-feasibility.md)
  — user-facing motivation (Mitigation 2, yopl-side).
- `src/compile/lower.js` — the 112-line current lowering, the
  baseline to beat. **Untouched by this POC.**

## Research sources

Background reading consulted while drafting this note.

### V8 / JSC JIT pipelines and dynamic-code treatment

- [Digging into the TurboFan JIT (V8)](https://v8.dev/blog/turbofan-jit)
  — TurboFan's role in V8's tiering and what it specializes.
- [TurboFan documentation (V8)](https://v8.dev/docs/turbofan)
  — type specialization, inline caches, deoptimization model.
- [Understanding Just-In-Time (JIT) Compilation in V8](https://medium.com/@rahul.jindal57/understanding-just-in-time-jit-compilation-in-v8-a-deep-dive-c98b09c6bf0c)
  — Ignition → Sparkplug → Maglev → TurboFan tiering overview.
- [JavaScriptCore documentation (WebKit)](https://docs.webkit.org/Deep%20Dive/JSC/JavaScriptCore.html)
  — JSC's LLInt → Baseline → DFG → FTL tiering; relevant for Bun
  and Safari behavior.
- [JavaScriptCore Internals Part II: The LLInt and Baseline JIT](https://zon8.re/posts/jsc-internals-part2-the-llint-and-baseline-jit/)
  — tier thresholds (Baseline @ 6 invocations, DFG @ 60, FTL @ thousands).
- [Speculation in JavaScriptCore (WebKit blog)](https://webkit.org/blog/10308/speculation-in-javascriptcore/)
  — JSC's speculative compilation; analogue to V8's TurboFan.

### eval vs new Function — the decisive comparison

- [eval() vs Function() in JavaScript (educative.io)](https://www.educative.io/answers/eval-vs-function-in-javascript)
  — V8-specific benchmark showing `new Function()` is ~54× faster
  than `eval()` due to scope-capture optimizations.
- [Benchmark: eval vs new Function (MeasureThat.net)](https://www.measurethat.net/Benchmarks/Show/2858/0/eval-vs-new-function)
  — independent benchmark confirming the gap.
- [JavaScript's eval() and Function() constructor](https://dfkaye.com/posts/2021/06/02/javascripts-eval-and-function-constructor/)
  — semantics of the two; why `new Function` doesn't capture
  enclosing scope.

### Code caching — Node `vm.Script` + V8 in-memory cache

- [Improved code caching (V8 blog)](https://v8.dev/blog/improved-code-caching)
  — in-memory cache keyed on source string; ~20-40% reduction in
  parse + compile time for repeat compiles.
- [Code caching for JavaScript developers (V8)](https://v8.dev/blog/code-caching-for-devs)
  — how to take advantage of the cache as a consumer.
- [Code caching (V8 blog)](https://v8.dev/blog/code-caching)
  — earlier overview of the caching architecture.
- [Node.js `vm` module documentation](https://nodejs.org/api/vm.html)
  — `vm.Script` with `cachedData` / `produceCachedData`; the
  persistent on-disk path.
- [v8-perf — snapshots and code caching (thlorenz)](https://github.com/thlorenz/v8-perf/blob/master/snapshots+code-caching.md)
  — practical notes on what's cached and when.
- [v8-compile-cache (npm)](https://www.npmjs.com/package/v8-compile-cache)
  — example consumer; opt-in CLI-startup speedup via the same mechanism.

### Codegen techniques — emitting JS from a source language

- [JavaScript code generator (Lisperator.net "Pratt parsing tutorial")](https://lisperator.net/pltut/compiler/js-codegen)
  — recursive AST → JS source pattern; relevant for our IR → JS
  emitter shape.
- [Compiler code generation (Wave Beem)](https://www.wavebeem.com/blog/2016/compiler-code-generation/)
  — overview of compile-to-JS as an output target.
- [Prepack — partial evaluator for JavaScript](https://prepack.io/)
  — partial evaluation of JS at the AST level; informs the
  "pre-resolve `Lit` values at compile time" technique.
- [Compilation of JavaScript to Wasm, Part 2: AOT vs JIT (cfallin.org)](https://cfallin.org/blog/2024/08/27/aot-js/)
  — adjacent topic (JS → WASM AOT), useful for the trade-off
  framing between "interpret IR per activation" vs "specialize at
  compile time."
- [Compilation of JavaScript to Wasm, Part 3: Partial Evaluation (cfallin.org)](https://cfallin.org/blog/2024/08/28/weval/)
  — partial-evaluation perspective; relevant to the
  `Lit`-walker-pre-resolution win.
