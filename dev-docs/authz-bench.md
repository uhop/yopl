# Authorization-check bench app (Zanzibar-style)

Status: **implemented 2026-07-14; baseline measured, experiment variants
pending.** The **judge workload** for the optimization experiments
(specialized LP-unifier, constant-output classifier) and the first realistic
showcase app. Companion:
[js-source-backend.md](js-source-backend.md) (the regime map),
[implementation-discipline.md](implementation-discipline.md) (POC file rules).

## Why this app

The existing corpus (classic puzzles, proof-loop microbenches) is
unrepresentative for judging the experiments: real LP embeds don't carry fact
tables as clauses. Ruling 2026-07-13: _all facts are in a database; an FFI
predicate reads/writes/verifies facts._ The judge workload therefore needs an
op mix where facts live behind native predicates and the rule base carries
only derivation logic.

Authorization checks are that shape, and industry-sized: the model below is
Google Zanzibar's relation-tuple + userset-rewrite scheme. The plain-JS
equivalent is a policy-AST graph-walking interpreter — an engine you must
write either way; in yopl the policy **is** the clauses (~a dozen lines,
declarative, reviewable). That's the showcase half. The bench half is that a
realistic check mix produces a hot proof loop dominated by exactly the costs
the experiments target.

## Model

Relation tuples `(Object, Relation, Subject)` where `Subject` is a user or a
group reference `group(G)`. Tuples are **not clauses** — they live in indexed
JS Maps (`Map<obj, Map<rel, Set<subj>>>` plus a reverse index), exposed
through native predicates in the `native.js` style:

- `tuple(Obj, Rel, Subj)` — verifies when ground; **enumerates** on unbound
  args (generative modes are required for "list all docs U can view" — same
  cursor patterns as `arrayList` / `mapEntries`).
- `parent(Obj, Parent)` — folder-tree lookup, native for the same reason.

Derivation rules as strict-Prolog clauses (dogfoods `yopl/compile/prolog`):

```prolog
% direct grant
check(U, R, O) :- tuple(O, R, U).

% group expansion (nested groups recurse)
check(U, R, O) :- tuple(O, R, group(G)), memberOf(U, G).
memberOf(U, G) :- tuple(G, "member", U).
memberOf(U, G) :- tuple(G, "member", group(H)), memberOf(U, H).

% computed userset: owner ⊃ editor ⊃ viewer
implies("owner", "editor").
implies("editor", "viewer").
check(U, R, O) :- implies(S, R), check(U, S, O).

% tuple-to-userset: inherit viewer from the parent folder
check(U, "viewer", O) :- parent(O, P), check(U, "viewer", P).
```

(The `implies` table is the one deliberate clause-borne fact set — two ground
facts; everything bulky is behind natives.)

First-grant-wins: callers use `gen(...).next()` — authorization needs one
proof, not the full tree. The "list all" queries use the generator lazily.

## Workload generator

Deterministic, seeded. Parameters: users `U`, groups `G` with nesting depth,
folder trees with depth `F`, docs `D`, tuple count `T`, zipf skew for hot
objects. Query mix: grants split across the four derivation paths (direct /
group / implied / inherited) **plus a substantial denial share** — denials
are the worst case (exhaustive backtracking across every path) and the bench
flatters without them. Default scale: ~1e5 `check()` calls per run, enough to
dominate nano-bench noise.

## Measurements

`nano-bench` only (house rule — no ad-hoc timing).

1. **Baseline** — current runtime, deep6 unify.
2. **+LP-unifier** — the proof loop's inner unify swapped for the ~100-line
   IR-shapes-only unifier (new solver-entry files; baseline untouched).
3. **+B′** — constant-output lowering. Measure the constant-output clause
   fraction first; prediction (2026-07-13): near zero here, since facts live
   behind natives — if so, B′ retires at the cost of its ~30-line classifier.
4. **Attribution variants** — a no-op native predicate build (isolates
   native-dispatch cost) and, if needed, a precomputed-terms build (splits
   goal-construction from unify time).

### Baseline (measured 2026-07-14, default org: 300 users / 40 groups / 1500 docs / 4000 tuples)

| Variant        | Median  |
| -------------- | ------- |
| checkDirect    | 5.51 μs |
| checkGroup     | 189 μs  |
| checkInherited | 188 μs  |
| checkImplied   | 353 μs  |
| checkDenial    | 735 μs  |
| checkMix       | 455 μs  |

The predicted shape holds: the ground-verify fast path makes direct grants
~130× cheaper than denials, and the mix is dominated by denial backtracking —
exactly the hot proof loop the experiments target.

The run is saved (raw samples + environment) at
`bench/authz/results/2026-07-14-baseline.json`; judge the experiment variants
against it with `nano-bench-compare` (see `bench/README.md` § Saving and
comparing runs) instead of re-measuring the baseline.

**Finding — no list-all bench variant.** "List all docs U can view"
(unbound-O enumeration) is super-quadratic in org size: without tabling, the
inheritance clause re-proves each parent edge independently while per-object
tuple density grows alongside edge count (measured 90 ms → 3.4 s over an 8×
org scale-up; the default org extrapolates to a minute-plus per drain). This
is inherent to naive backward-chaining enumeration — Zanzibar itself uses
reverse expansion for this query. Generative modes stay covered functionally
by `tests/test-authz.js` on a small fixed org.

## What it decides

- LP-unifier go / no-go: the queue's 2–3× estimate against a measured number
  on a realistic mix.
- B′ retire-or-keep, via the measured constant-output fraction.
- Regime B/C input: which half of per-activation cost dominates when facts
  are FFI-backed — construction, unify, or native dispatch.

## Placement & discipline

`bench/authz/{model.js, gen.js, rules.js, bench-authz.js}` — stores + native
predicates, org generator, prolog source, nano-bench driver. A small fixed
org with known grants/denials lands as `tests/test-authz.js` to keep the
model honest. Per [implementation-discipline.md](implementation-discipline.md):
no edits to `lower.js`, the solvers, or the deep6 path — every experiment
variant is new files beside the baseline.

## Phase 2 (optional, showcase)

A hand-rolled plain-JS checker for the same model: code-size and readability
comparison (the DX argument made concrete), plus a perf sanity point.

## Non-goals

Zanzibar's consistency machinery (zookies), caching tiers, persistence,
changelog watch — this is a workload model for judging solver work, not an
authorization product.
