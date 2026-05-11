# Implementation discipline — new files for new work

Convention for in-flight research/POCs (regime B/B' codegen, WASM
backend, regime-C runtime, LP-specialized unifier, anything else
the dev-docs research notes scope out):

> **Don't stomp on existing working files. Opt for new directories
> and new files. Reorganization and renaming happen after the dust
> settles, as a separate pass.**

(User direction 2026-05-10.)

## Why

The existing `src/` tree is the result of the 1.4.0 stabilization
wave. It works, 666 tests pass, the layout is consistent with the
fleet conventions. Each research POC has uncertain odds — some
will ship, some will land negative results, some will reshape mid-
flight. Editing existing files for each experiment means:

- Bench comparisons run "old vs new" against a moving target.
- Reverting a POC that didn't pan out has to undo a tangled diff.
- Two parallel POCs (e.g., constant-output classifier + WASM POC)
  can collide on the same lines.
- Reorganization decisions get made under time pressure during each
  POC rather than batched and considered.

New files keep each POC isolated. The current code stays the
baseline. Renaming, merging, or replacing files is a deliberate
later step, after measurement decides what stays.

## How

- **New file** for each parallel implementation. Examples:
  `src/compile/lower-jsrc.js` (parallel to `lower.js`),
  `src/compile/analysis/constant-output.js` (new analysis pass),
  `src/solvers/wasm.js` (new driver), `src/unify-lp.js`
  (specialized unifier).
- **New subdirectory** when a POC has several files. Examples:
  `src/wasm/` (runtime + emitter for the WASM backend),
  `src/runtime-c/` (regime-C JS runtime).
- **Bench files** as siblings, not replacements. `bench/bench-X.js`
  exists; add `bench/bench-X-jsrc.js`, `bench/bench-X-wasm.js`, etc.
  Both run; the user reads both columns.
- **Test files** likewise. New test file per POC; existing tests
  unchanged. Cross-validation tests compare outputs across
  implementations (regime-A result vs regime-B result vs ...) for
  every fixture.
- **No import-path changes in existing files.** A new lowering
  target is opt-in via a new import path or a new option, not by
  swapping what an existing import resolves to.
- **No deletions of existing exports.** Even after a POC wins, the
  deletion happens in a separate cleanup pass — not mixed in with
  the perf change.

## What "reorganization later" looks like

When a POC ships and the bench supports it, a separate PR does the
cleanup: rename `lower-jsrc.js` → `lower.js` (and the old
`lower.js` to `lower-closure.js` or just delete), update import
paths fleet-wide, refresh wiki + dev-docs + llms-full. That PR is
mechanical; the perf decision was made earlier on isolated diffs.

If a POC lands a negative result, the new files can just stay (as
documented dead ends) or be removed in a cleanup. Either way, the
baseline never wobbled.

## See also

- [`js-source-backend.md`](js-source-backend.md) — POC files are
  `src/compile/lower-jsrc.js`, `src/compile/analysis/constant-output.js`,
  new sibling bench files. `lower.js` stays untouched.
- [`wasm-backend.md`](wasm-backend.md) — POC files live in a new
  `src/wasm/` (or `yopl/wasm/`) tree. The existing four solvers
  stay untouched; a new `src/solvers/wasm.js` joins them.
