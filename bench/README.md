# Benchmarks

Micro-benchmarks for yopl, run with [nano-benchmark](https://www.npmjs.com/package/nano-benchmark).

## Running

```bash
npm run bench -- bench/bench-proof-loop.js
npx nano-watch -- bench/bench-proof-loop.js memberContainsLast50
```

`nano-bench` runs all variants in a file and prints a comparison table with
bootstrap confidence intervals. `nano-watch` streams live stats for a single
variant.

Common options: `--ms` (measurement time per variant), `--samples`,
`--bootstrap`, `--alpha`. See `npx nano-bench --help`.

### Saving and comparing runs

Record a run as JSON with `--json` (plus `--label` and `-H` for the host), then
compare runs with `nano-bench-compare` — it pairs same-named variants across
files, recomputes significance from the raw samples, and warns when the runs'
environments differ:

```bash
npm run bench -- bench/authz/bench-authz.js -i 500 --json bench/authz/results/2026-07-14-baseline.json --label baseline -H
npx nano-bench-compare bench/authz/results/2026-07-14-baseline.json bench/authz/results/<experiment>.json
```

Recorded comparison runs must pin iterations (`-i 500` for the authz bench).
Auto-calibration sizes the batch to the build's speed, and variants that cycle
a query list with `i % length` then measure a build-dependent subset — a
faster build would be judged on a different workload. Pinning `-i` fixes the
workload across builds; `-i 500` covers each authz query bucket exactly once.

Two more pairing rules: experiment bench files must export the **same variant
names** as the baseline file (pairing is by name), and saved runs live in
`bench/<topic>/results/<YYYY-MM-DD>-<label>.json` (prettier the file after
writing so `npm run lint` stays green). Baselines are committed so before/after
comparisons don't require re-measuring the "before".

## Conventions

- File name: `bench-<topic>.js`.
- ESM, `export default { variantA: n => {...}, variantB: n => {...} }`.
- Each variant runs `for (let i = 0; i < n; ++i) { ... }`.
- Setup outside the loop. Prevent dead-code elimination by returning the sink.
- Smoke-test a new or changed bench module with `--smoke` (each variant once,
  `n = 1`) before a full collection run.
- Match yopl prettier style (single quotes, no bracket spacing, no trailing
  commas, arrow parens avoided).
- `.claude/skills/{write-bench,write-watch}` are symlinks into
  `node_modules/nano-benchmark/skills/` — invoke via Skill when authoring or
  watching benches.

## Current targets

| File                         | Compares                                                                      | Notes                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bench-proof-loop.js`        | member contains-last / enumerate-all / append-split                           | Core solver workload — head unification, choice-point allocation, recursive descent.                                                                                                                          |
| `bench-drivers.js`           | sync callback / sync gen / async callback / async gen                         | Take-1 over `member` — surfaces driver overhead vs the proof loop.                                                                                                                                            |
| `bench-inline-goals.js`      | math.add forward / reverse / verify                                           | Reversible-operator path — `isBound` probe + `bindVal` + `cut(sys)` across all three argument shapes.                                                                                                         |
| `bench-parity.js`            | hand-written / `clause\`...\``/`prolog\`...\``                                | Same `member`/`append` workload through all three encodings. Detects per-encoding regressions in `lower.js` or front-end IR shape divergence; clause and prolog should sit within bench noise of each other.  |
| `authz/bench-authz.js`       | Zanzibar-style check mix: direct / group / implied / inherited / denial / mix | The judge workload for solver experiments — facts behind native predicates (FFI), policy as clauses; denial backtracking dominates the realistic mix. See `dev-docs/authz-bench.md`.                          |
| `bench-parity-jsrc.js`       | `bench-parity.js` encodings + `_jsrc` (regime-B `lower-jsrc.js`)              | Five-way parity: `_jsrc` vs `_codegen` validates the emitter against the hand-written prediction; `_jsrc` vs `_clause` isolates the codegen win. See `dev-docs/js-source-backend.md` § POC results.           |
| `bench-proof-loop-jsrc.js`   | `bench-proof-loop.js` workloads via `src/compile/lower-jsrc.js`               | Regime-B experiment; same variant names — pair against a saved `bench-proof-loop.js` run. The baseline hand-writes its rules (wildcard cheat), so this pairing measures compiled-vs-hand, not lowering alone. |
| `bench-inline-goals-jsrc.js` | `bench-inline-goals.js` via `lower-jsrc.js`                                   | Regime-B on the `js`-goal factory path; same variant names — pair against a saved `bench-inline-goals.js` run.                                                                                                |

The `-lp` sibling benches were removed 2026-07-14 when the LP-specialized
unifier was promoted to the solvers' default — `bench-proof-loop.js` and
`authz/bench-authz.js` now measure it directly. Saved pre-promotion runs
remain under `results/` for pairing via `nano-bench-compare`.

## Reading `bench-parity.js`

Variants are named `<workload>_<encoding>` so the table groups naturally
when sorted. Four encodings of the same logic per workload:

- `_hand` — pre-compiler raw `(...vars) => [...]` style.
- `_codegen` — what an IR→JS codegen pass _would_ emit (currently
  hand-written to mimic `lower.js` semantics including fresh Variables
  for wildcards).
- `_clause` — iter-1 `clause\`...\`` per-clause DSL.
- `_prolog` — iter-2 `prolog\`...\`` strict-Prolog parser.

Three assertions the bench supports:

1. **`_clause` ≈ `_prolog`** within each workload — same IR, same lowered
   runtime fns, should land within bootstrap CI of each other. A
   significant gap means a front-end shape divergence or a `lower.js`
   change that affects one path more than the other.
2. **`_codegen` ≈ `_hand`** for wildcard-free rules (e.g. `append10`).
   Direct evidence that codegen-based lowering would close the
   compiler-overhead gap. A growing `_codegen` vs `_hand` gap on a
   wildcard-free rule means the codegen baseline drifted — investigate.
3. **`_hand` is the floor for wildcard-bearing rules** because
   hand-written cheats by omitting value-position properties for
   wildcards (deep6 open-object semantics). The current `lower.js`
   doesn't, hence the residual gap between `_codegen` and `_hand` on
   member workloads.

As of iter-2 ship: `_clause` ≈ `_prolog` within ~1–2%; `_codegen`
closes ~50–80% of the compiler-overhead gap on member, ~100% on
append. The bench detects regressions on top of these baselines.

## Pending

- **Higher-order rules** — `map` / `filter` / `compose` exercising the dynamic
  `call(...)` runtime helper. Useful once a real workload pushes on these
  patterns hard enough to motivate a dedicated bench.
- **Cut + halt** — `notEq` / `once` patterns and `halt`-aborted searches; covered
  partially by `bench-proof-loop.js`'s `appendSplit10` (cut-free) but missing a
  cut-heavy workload.
