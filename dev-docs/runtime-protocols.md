# Runtime protocols — research notes + POC plan

Protocol-level performance work that sits between regime B (measured
2026-07-14, ceiling: the IR walk is 4–12% end-to-end — see
[`js-source-backend.md`](js-source-backend.md) § POC results) and a
full regime-C runtime redesign. The thesis: the measured hot spots are
not in the proof loop's core but in the **protocols around it** — how
natives enumerate facts, how JS functions bridge into clauses, and how
much ceremony each activation carries. Tweaking protocols keeps all
four solvers and the rules-dict contract; regime C is the fallback if
these plateau.

Evidence base (dev-docs/authz-bench.md § Measurements, 2026-07-14):
`tuple`/`tupleIn`/`memberOf` carry ~84% of activations on the authz
mix — "scan-and-walk dominates" — and the LP-unifier promotion +
regime-B result together say construction and unification of _clause
terms_ are thin slices. What remains per activation: Variable minting
(Symbol + string coercion + object each), env push/pop, frame
allocations, closure mints in the js-goal path, and the enumeration
idiom below.

## Cost inventory

Per clause activation (command-2 path in the drivers):
`generateVariables(n+1)` → n+1 Variable mints (each a
`Symbol(counter++)`: number→string coercion, Symbol alloc, Variable
alloc); rule fn call; `env.push()`; `unifyLP`; on success two object
allocations + three stack pushes; on failure `env.pop()`.

Per `js` goal: `env.push()` (even for pure tests that never bind);
`goal.factory(vars, sys)` **mints a fresh closure per activation**
(plus the vars record); double-probe derefs (`isBound` then `get`);
success pushes `POP` + a goals frame.

Per enumerated fact under the current FFI idiom (`tupleScan` reifies a
cons list; `tupleIn`-style clauses walk it by backtracking): **two
full activations** — ~10 Variable/Symbol mints, two head
constructions, two unify walks, two rounds of frame ceremony — per
candidate. This is the 84%.

## Workstream 1 — fact-source choice points (POC first)

Let a native hand its candidates to the proof loop directly, reusing
the existing `command: 2` machinery, instead of reifying a list for
clause-level walking.

**Mechanism.** A js goal receives `(env, goals, stack)`. It can push a
choice-point frame itself:

```js
stack.push({command: 2, ruleList: thunks, index: 0, goals, args, restoreIndex: goals.index});
return false;
```

- Each `ruleList` entry is a 0-arg thunk returning a **shared** ground
  terms array `[{args: [...]}]` — share-safe per the B′ finding
  (bindings go to the env; the goals cursor lives on the frame).
  Thunks are cached on the store at index-build time, so steady-state
  queries allocate nothing per candidate.
- `args` are the goal's argument values (deref'd once in the select);
  the driver's own `unifyLP(candidate, args, env)` binds per
  candidate.
- `return false` (never `null`): in the pull drivers a null goals
  chain **is the proof-complete signal** (`gen`/`asyncGen` yield on
  `!goals`), so the seemingly-clean `return null` path — whose
  `{goals: null}` dead-end frame is harmless in `solve` — yields one
  spurious solution per call (found by the driver cross-tests, POC
  day 1). The false path is also cheaper: no extra frames; the driver
  pops the env frame it pushed, and although it rewinds `goals.index`
  onto the goal, every candidate's `restoreParent` stamp re-advances
  it — rewind-then-re-execute on rematch paths is exactly the
  walker-clause semantics.
- Cut interop is free: `cut(sys)` sets `index = Infinity` on every
  command-2 frame above the clause frame, which kills the fact-source
  choice point exactly like a clause list. `halt` splices the whole
  stack. `restoreIndex: goals.index` matches the drivers' own
  stamping, so backtrack-rematch restores correctly.
- **Enumeration order is the contract, not a nicety**: cut and
  first-solution pulls (`gen().next()`) select _which_ fact wins by
  it. Two levels:
  - **User-facing: none.** Programs use `!`, `once`-style commits, and
    backtracking exactly as over declared fact clauses — a fact-source
    predicate must be behaviorally indistinguishable from the same
    facts written as clauses. Any note telling users "don't rely on
    cut over native facts" would mean this design failed.
  - **Implementor-facing:** the store defines ONE total fact order
    (the FFI analog of clause order; `addTuple`-chronological is the
    least-surprise choice, mirroring `assertz`), and every candidate
    list handed to the engine — bucketed, filtered, flattened,
    over-approximate — must project that same order. The engine
    enumerates in `list` order (the command-2 frame walks `ruleList`
    front to back), so the arrays carry the semantics.

  POC status: `TupleStore`'s nested Map/Set structure defines a
  _grouped_ order (object → relation → subject insertion; within an
  (obj, rel) bucket = `addTuple` order); all `model-fs.js` index paths
  project it consistently, and
  `test_fact_source_cut_commits_store_order` pins the bucket case
  end-to-end (cut over a store-backed source commits to the
  first-added fact, one survivor). True `addTuple` chronology _across_
  buckets needs a per-fact sequence number — a promotion-time
  store-API decision. The legacy cons-list idiom _prepends_ while
  scanning and enumerates in reverse insertion order — never
  specified, and cut over it commits to the _last_-added fact — so
  promotion is an observable behavior change for order-sensitive
  programs, in favor of declared-facts semantics. The authz verdicts
  are immune (existence checks; its only cut guards the ground fast
  path rather than selecting among candidates), which is why both
  variants pass the oracle without pinning an order.

**Zero engine changes** — expressible today in all four drivers (their
js-goal branches are identical). Per candidate the cost drops to one
thunk call + one Variable mint (the sys var) + one unifyLP over ground
args — vs two activations + ~10 mints + two constructions + two
unifies. Back-of-envelope 3–5× on the scan path; the authz mix is
~84% scan-and-walk, so plausibly 2–3× end-to-end on checkMix. The
bench decides.

**POC files** (implementation-discipline.md: new files, baselines
untouched):

1. `src/rules/fact-source.js` — the generic helper:
   `factSource(select)` → js-goal factory; `select(env, vars)` returns
   `{args, list}` or null/empty for fail.
2. `bench/authz/model-fs.js` — thunk-index build over `TupleStore` +
   `makeNativesFS` (reuses `makeNatives`' ground fast-path natives).
   Prebuilt indexes: forward by obj→rel, groups-only variants (the
   group-expansion clause is the hot caller), reverse by subj→rel,
   flattened + global fallbacks, parents.
3. `bench/authz/rules-fs.js` — the policy program with
   `tuple(O,R,S) :- ${n.tupleFacts}.` replacing the scan clause;
   `tupleIn`/`parentIn` walker rules deleted.
4. `tests/test-fact-source.js` — synthetic source (enumeration order,
   backtracking re-entry with a failing later goal, cut over the
   source, empty source, solve + gen drivers) plus authz small-org
   parity and full-org oracle cross-validation vs the baseline rules.
5. `bench/authz/bench-authz-fs.js` — same org, queries, variant names;
   recorded `-i 500` and paired against a fresh same-HEAD
   `bench-authz.js` baseline via `nano-bench-compare`.

**Decision gates:**

- checkMix **≥ 1.5× faster** → adopt: promote `factSource` to the
  documented stdlib enumeration idiom (supersedes the cons-list cursor
  pattern noted in `native.js`), rewrite the authz natives, file the
  engine-tweak option below as a follow-up.
- **1.15–1.5×** → adopt for enumeration-heavy natives, keep the
  cons-list idiom documented for simple cases.
- **< 1.15×** → file the negative result; the ceremony must be
  attacked below the protocol (regime C).

**Promotion-time engine option** (not in the POC): let `ruleList`
entries be terms arrays directly (`Array.isArray(rule)` branch in the
drivers) — kills the thunk call per candidate. One line per driver;
only worth it with a measured win to protect.

### POC results (measured 2026-07-14) — **≥ 1.5× gate met, adopt**

Zero engine changes were needed; the driver cross-tests caught one
protocol subtlety on day 1 (the `return null` spurious-yield trap,
folded into the mechanism notes above). Files:
`src/rules/fact-source.js` (+ `.d.ts`), `bench/authz/{model-fs,rules-fs,bench-authz-fs}.js`,
`tests/test-fact-source.js` (synthetic sources + authz small-org +
full-org oracle, all four assertions families green; 796 total).
Saved runs: `bench/authz/results/2026-07-14-{postlp-baseline,fact-source}.json`
(`-i 500`, same-HEAD pair; Mann–Whitney significant, Cliff's δ ≥ 0.90
everywhere except checkDirect).

| Variant (medians) | baseline | fact-source | speedup   |
| ----------------- | -------- | ----------- | --------- |
| checkDirect       | 7 µs     | 7 µs        | n.s.      |
| checkGroup        | 156 µs   | 72 µs       | **2.15×** |
| checkImplied      | 298 µs   | 138 µs      | **2.17×** |
| checkInherited    | 154 µs   | 112 µs      | 1.37×     |
| checkDenial       | 708 µs   | 373 µs      | **1.90×** |
| checkMix          | 385 µs   | 200 µs      | **1.92×** |

Reading: the scan-heavy buckets land at ~2×, matching the
back-of-envelope's low edge (the ~84%-of-activations walker cost
collapsed to one thunk + one unify per candidate; the remaining time
is the genuine proof search). Direct grants never touched the scan
path — the n.s. result doubles as a no-regression check on the ground
fast path. Cumulative same-day trajectory on checkMix: 471 µs
(pre-LP-unifier) → 385 µs (LP promoted) → 200 µs (fact source) —
**2.35× total**, all protocol-level, no runtime redesign.

Per the gates: adopt. Promotion (documenting `factSource` as the
stdlib enumeration idiom, retiring the cons-list cursor pattern in
`native.js`'s notes, the `Array.isArray(rule)` driver tweak) is a
separate deliberate pass — user decides when, per
implementation-discipline.md.

## Workstream 2 — the JS bridge (efficient compute-and-bind)

The bridge today: goal-position `${fn}` → `Js(fn)` factory
(`interp.js` rejects functions in arg position; `is/2` has a closed op
table). Every value computation crosses it. Tiers, cheapest first:

1. **Single-probe deref.** Standardize `deref(term, env)` (authz
   `model.js` already hand-rolls it) in the stdlib; sweep natives to
   replace `isBound`+`get` double probes. Candidate for deep6 later.
2. **Static-native shape.** Opt-in second js-goal form — a marked
   static function receiving `(env, vars, sys)` positionally — no
   per-activation factory closure, no vars record. Lowering detects
   the marker; the factory form stays the DX default.
3. **`computes` combinator.** `computes((x, y) => x + y)` wraps a pure
   JS function: derefs in-args (fail if unbound, `is/2`'s established
   contract), computes, unifies the out-arg. One optimized
   implementation; hand-written `isBound`/`get`/`bindVal` boilerplate
   disappears; `reversibleTernary` is the prior art for the shape.
4. **Fused compilation (endgame).** `computes(fn)` is analyzable:
   `lower-jsrc` can emit the fused form inline —
   `u(vOut, C0(d(v0, env), d(v1, env)), env)` — zero closures, zero
   records, monomorphic call on the user fn. From there,
   expression-position sugar (`Z = ${fn}(X, Y)` desugaring to a
   `computes` goal) and `is/2` static-tree compilation (emit `y*2+1`
   instead of `evalExpr` dict dispatch) are small steps.

Instrument: `bench-inline-goals.js` (+ its jsrc sibling). The jsrc
+14% captured only the walk share; the closure mint, record, and
double probes are the unmeasured remainder.

### Tier 1 + 3 results (measured 2026-07-14) — perf-neutral; keep as DX, redirect perf to tiers 2/4

POC files: `src/rules/bridge.js` (+ `.d.ts`) — `deref`, `computes` /
`verifies` (MISS sentinel), `reversible3` — `tests/test-bridge.js`,
`bench/bench-inline-goals-bridge.js` (same add\* variant names +
an in-file `sumList50_math` / `sumList50_bridge` depth pair). Saved
run: `bench/results/2026-07-14-inline-goals-bridge.json`.

Two findings, one trap and one refutation:

- **The get-first deref trick pessimizes at depth.** A native's out-arg
  is unbound on every call and misses every frame, so `get` +
  confirming `isBound` is two full O(depth) walks vs the idiom's one —
  measured **−6%** on `sumList50` (add at recursion depth ~50). Fixed
  with a true single-walk lookup (`has` per frame, `get` on the hit
  frame, sentinel on miss) against EnvMap's plain-field internals with
  a public-API fallback; that restores **parity** at depth — not a
  win, because the unbound miss costs one full walk under any idiom.
  The reach-in belongs in deep6 as `env.lookup(name, miss)` — worth
  landing for decoupling, not for speed.
- **Probe-halving doesn't pay.** Freshly-minted clause variables bind
  in top frames, so bound-input reads hit shallow either way;
  `reversible3` measured **3–6% slower** than `reversibleTernary` on
  the shallow add workloads (small effect sizes — the deref/instanceof
  indirection costs about what the saved probes were worth). Meanwhile
  the jsrc recording stays **18–21% ahead of both**: on the js-goal
  path the IR walk and the per-activation ceremony dominate; env
  probes don't.

Verdict: keep `deref` / `computes` / `verifies` as the bridge's DX
layer (one audited implementation, MISS-sentinel domain failures,
fewer hand-rolled isBound/get towers) — do **not** promote
`reversible3` as a perf replacement. The bridge's real perf levers are
tier 2 (static-native shape — kill the factory closure + vars record;
needs the driver-twin experiment) and tier 4 (fused jsrc emission).

**Note:** binding goals keep `env.push()` — backtracking must undo
bindings; that's correctness. Only declared-pure tests may skip it
(rider 2 below).

## Riders (small, fold into whichever POC lands first)

1. **Integer variable names.** Solver-minted Variable names need only
   avoid colliding with user string names — numbers qualify;
   `Symbol(counter++)` pays a number→string coercion + Symbol alloc
   per variable per activation. Mind deep6's `variable(name)` falsy
   trap: `name || Symbol()` — start the counter at 1.
2. **Pure-test goal flag.** A js goal marked non-binding
   (`fn.test = true`-style) skips `env.push` and the success frame
   ceremony: `if (!goal(env)) → fail` inline. Type tests, comparisons,
   `tupleGround`/`tupleCheck` all qualify.
3. **Static cut/call markers.** `runtimeCut(sys)` mints a closure per
   cut-bearing activation; a sentinel object the drivers handle
   directly kills it. Pairs with goal-shape monomorphism (string |
   `{name, args}` | function today) — normalize when a driver-touching
   pass happens anyway.

## Relationship to regime C

If Workstream 1 lands its estimate, the authz-style verdict pressure
on regime C drops sharply, and regime C's honest phase 1 becomes
**compiled head-matchers**: per-clause `match(args, env)` emitted by a
jsrc-style pass (WAM get-instructions in JS clothing), fusing head
construction + unification — the two slices that together dominate
classic workloads. That is a rule-entry protocol change (`{match,
goals}`), not a proof-loop rewrite; the mode-analysis wildcard lever
(10–23% on member, per the regime-B results) dissolves into it. The
full design-dimensions table stays in
[`js-source-backend.md`](js-source-backend.md) § Regime C.

## See also

- [`js-source-backend.md`](js-source-backend.md) — regime B results
  that motivated the protocol focus.
- [`authz-bench.md`](authz-bench.md) — the judge workload + attribution
  data.
- [`native-objects.md`](native-objects.md) — the current native
  predicate roadmap; the cons-list cursor idiom Workstream 1 replaces.
- [`implementation-discipline.md`](implementation-discipline.md) — POC
  file rules.
