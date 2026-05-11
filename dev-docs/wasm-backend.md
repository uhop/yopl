# WASM backend — research notes + POC plan

Research summary and proof-of-concept plan for an IR → WASM compilation
backend. Filed as research, not committed work. Companion to
[`compiler-ir.md`](compiler-ir.md) (the IR this backend would consume)
and [`solver-perf.md`](solver-perf.md) (the perf baseline a WASM backend
would have to beat).

The user-facing motivation is in `wiki/Search-feasibility.md` § "Mitigation
2 — yopl-side": yopl's per-call cost (proof-loop frame allocation +
env push/pop + deep6 unify) makes O(N!) workloads infeasible above
modest N; a WAM-style WASM backend is one of the speculative levers
that might lower the per-call cost.

## Constraint: yopl unifies deep6 JS objects, not bare Prolog terms

A classical WAM-in-WASM Prolog assumes its terms live in WASM linear
memory — tagged cells (REF/STR/CON/LIS/INT) addressed by `i32`
offsets. Allocation is `i32` increment on a heap pointer; unification
walks the in-memory representation; backtracking unwinds via a trail.
Everything stays inside the WASM module; the JS↔WASM boundary is hit
only at query entry and at solution-extraction time.

yopl is not that shape. yopl's terms are **deep6 JS objects**: plain
objects (matched open or closed per `env.options`), arrays, Maps,
Sets, Dates, cons cells (`{value, next}`), wrapped sentinels
(`open(...)`, `soft(...)`), and `deep6` `Variable` instances. The
unifier is `deep6.unify`, which lives JS-side and has no WASM
analogue.

Three regimes follow:

1. **Ground-Prolog workload** — integers, atoms, lists of integers,
   structured terms with no JS-object leaves. The classic-puzzle
   suite (Knight's Tour, N-Queens, Sudoku, Hanoi, WGC, qsort,
   zebra-without-named-vars) lives here. A WAM-in-WASM can translate
   input terms to linear-memory cells at query entry, run the proof
   loop entirely in WASM, materialize the answer back at extraction.
   This is the regime where WAM-in-WASM is expected to win.
2. **Mixed workload** — some JS-object terms, some ground. The WAM
   would hold non-ground terms as `externref` handles to JS objects
   and call back into a JS-side `deep6.unify` import when those
   handles need to descend. Per-import call cost is tens of ns;
   wins shrink with the externref ratio.
3. **JS-object-heavy** — open-objects, `${jsFunction}` inline goals,
   `unifyOpts`, `arrayList`/`mapEntries`/etc. native bridges. The
   boundary dominates. WAM-in-WASM is likely a loss against the
   current closure-factory shape.

yopl's representative dogfood mix straddles regimes 2 and 3 with
puzzles in regime 1. The POC's job is to put a real number on
**how much regime 1 a backend has to be exposed to before the
boundary cost amortizes**.

## JS↔WASM boundary — costs and shared-memory primitives

**Primitives** (`i32`, `i64`, `f32`, `f64`) cross the boundary with
zero serialization — straight onto the WASM stack. Sub-microsecond
per call.

**Anything else** marshals through linear memory: encode on the JS
side, copy in, decode on the WASM side; reverse on return. 2025
microbenchmarks put the break-even around ~10 ms of WASM-side work
per call; under that, pure JS is faster because the boundary
dominates.

For yopl this is the load-bearing number. The proof loop is
millions of small operations; the boundary tax has to amortize over
the *query*, not the *call*. That means: one big copy-in at query
entry, one big copy-out at extraction, everything else stays inside
the module.

**`SharedArrayBuffer`** is *not* the right primitive for "pass JS
objects into WASM cheaply." SAB is about sharing memory between
*agents* (Workers, multi-threaded WASM); it doesn't make a JS object
addressable from WASM. Status as of 2026: Node.js works freely;
browsers need `Cross-Origin-Embedder-Policy: require-corp` +
`Cross-Origin-Opener-Policy: same-origin` headers; standardized.
Not in yopl's POC path.

**WasmGC `externref`** is the right primitive for the mixed regime.
Phase 5 (standardized), shipping in V8 (Chrome/Node), SpiderMonkey
(Firefox), JSC (Safari/Bun), Deno. An `externref` is an opaque
handle to a host (JS) object — WASM can pass it around, store it
in tables, return it; it cannot deref or introspect. The WAM holds
an `externref` in any tagged-cell slot that would otherwise point
to a JS-object term; when the unifier hits one, it calls back to a
JS-side `deep6.unify` import. Per-import-call cost lands the WAM in
regime 2 above.

## WAM in WASM — opcode coverage

WAM operations and their WASM mappings:

| WAM operation | WASM mechanism | WASM availability |
| --- | --- | --- |
| Tagged cell (REF/STR/CON/LIS/INT) | Tag in low 2-3 bits of `i32`; `i32.and` + shift to deref | MVP |
| Heap (H register), trail, PDL, E/B stacks | Linear-memory regions; pointer = `i32` offset | MVP |
| Predicate dispatch | `call_indirect` via function table | MVP |
| First-argument indexing (`switch_on_term`) | `br_table` on the principal-functor tag | MVP |
| try/retry/trust (alternative-clause chain) | Stored B (choice-point); on backtrack `return_call_indirect` to next clause | **tail-call proposal** |
| Cut | Store B at clause entry; restore via `i32.store` | MVP |
| **Last-call optimization (`execute`)** | **`return_call_indirect`** | **tail-call proposal** |
| Unification work loop | `loop` + `br_if` over a PDL on linear memory | MVP |
| Heap reclamation | Reset H/TR to a saved value on backtrack | MVP — no GC needed |

Every WAM operation maps to a current WASM opcode. The only
post-MVP feature on the critical path is **tail calls**
(`return_call`, `return_call_indirect`) — required for both
last-call optimization and for backtrack dispatch to alternative
clauses. Without tail calls, deep Prolog recursion overflows the
WASM call stack; with them, `execute` is a literal
`return_call_indirect`.

Tail-call runtime support (early 2026):

| Runtime | Engine | Status |
| --- | --- | --- |
| Node.js | V8 | Shipped (V8 v11.2, 2023) |
| Deno | V8 | Shipped (inherits V8) |
| Bun | JavaScriptCore | Shipped (JSC added it for Safari 2024) |
| Chrome / Edge | V8 | Shipped |
| Safari | JSC | Shipped (2024) |
| Firefox | SpiderMonkey | Tracked, not yet shipped |

Node + Deno + Bun all clear; Safari/Chrome/Edge clear. Firefox is the
lone laggard. Not a blocker for yopl's POC — the canonical platform
is Node, and the other two ESM runtimes the test suite covers are
Bun and Deno.

WAM heap doesn't need WasmGC. Prolog memory management is
**stack-based with backtrack-undo**, not GC-based: reset H to a
saved value on backtrack; the trail untrails bindings; entire query
reclaims by resetting H to the original base when the WASM-side
solve returns. WasmGC's relevance is **only at the boundary** for
externref handles to JS-side objects (regime 2 above) — and even
there, externref is part of the GC proposal but doesn't require the
managed-heap (`struct`/`array`) features.

## Code generation — four paths

| Path | Dependency | Trade-off |
| --- | --- | --- |
| **A. Hand-roll WASM binary** | None (`new WebAssembly.Module(uint8array)`) | Smallest dep footprint; ~500-1000 lines of straightforward byte emission; matches yopl's "single runtime dep" identity |
| **B. WAT (text) + wabt-js** | `wabt` (~1.5 MB) | Easier to debug (text format is human-readable); useful during development; not what ships |
| **C. binaryen.js** | `binaryen` (~3 MB) | Higher-level builder API + optimizer (`-O3` competitive with hand-tuned); useful if optimizer wins back its weight |
| **D. AssemblyScript / Rust** | Toolchain | Wrong shape — we have an IR, we want IR → WASM, not IR → high-level-language → WASM |

Plan: **B during development**, **A at ship**. Path B gets the
semantics correct faster (read the WAT with eyes, validate via
`wat2wasm`); once stable, replace the WAT emitter with a binary
emitter and drop wabt-js. The IR-to-WAT and IR-to-binary pieces
share all the interesting logic (clause lowering, register
allocation, dispatch tables); only the bottom byte-emitter differs.

C is worth a one-off comparison after the POC: emit the same module
through binaryen.js with `-O3` and measure. If the optimizer
delivers a measurable win, the dep weight may be acceptable for
production.

## Module composition

Three granularities considered:

1. **One module per rule** — per-rule hot reload, but every
   cross-rule call is a `call_indirect` through an import table;
   instantiation has fixed overhead (~ms-scale on V8 for tiny
   modules). For yopl's ~50 rules, instantiating each separately
   at solve-time would dominate the cost. Niche.
2. **One module per program** — whole rules dict → one WASM
   module, instantiated once. Cross-rule calls compile to fast
   internal-table `call_indirect`; optimizer sees the whole call
   graph; one instantiation per `solve()` (or amortized across many
   if cached). **Default.**
3. **One module per program, cached on the rules dict** — wrap (2)
   with a `WeakMap<RulesDict, WebAssemblyInstance>`. First call to
   `solve(rules, ...)` triggers codegen + instantiation; subsequent
   calls reuse. Cache key is rules-dict identity. **Shipping shape.**

Plus a **runtime shared module** — the WAM machine itself: heap
allocator, trail, PDL, unify, dispatch primitives. Compile once at
yopl load time; every program-module instance imports it. ~5-10 KB
of WASM, instantiated as a singleton.

The dynamic-linking / `dylink.0` story (Emscripten-flavored,
position-independent code, special custom section) is heavyweight
and not the right tool here. Plain WASM imports handle the same
case — no need for `dylink.0`.

## Module layout

```
yopl/
├── wasm/
│   ├── runtime.wat            ─ heap + trail + PDL + unify + dispatch
│   ├── runtime.wasm           ─ compiled at build time; ~5-10 KB
│   └── emit.js                ─ IR → WASM binary (path A) or WAT (path B)
├── src/
│   └── solvers/
│       └── wasm.js            ─ alternative driver; instance cache + boundary
```

`solvers/wasm.js` matches the existing four-solver shape — same
`(rules, name, args, callback)` signature as `solve.js`. Detects at
entry whether WASM is available + tail-calls supported; on absence,
falls back to one of the existing JS drivers. Same IR, two
backends, one feature-detection dispatch.

**Synchronous semantics**: `new WebAssembly.Module(bytes)` and
`new WebAssembly.Instance(module, imports)` are both sync APIs;
calls into `instance.exports.solve(...)` are sync. The async
variants (`WebAssembly.compile`, `instantiateStreaming`) exist but
aren't required for a per-query-compiled module — sync construction
is fine on the main thread. `solversWasm` therefore mirrors
`solve()` (push-callback, blocking) and `solversGen` (pull-generator,
blocking) — no `await` introduced. The existing async drivers
(`solversAsync`, `solversAsyncGen`) stay JS-side; a WASM async
variant could exist but adds no value over the sync one for the
proof-loop case.

## POC — minimum experiment that answers the question

Don't build the full thing. Build the minimum that puts a number on
"can the boundary cost be amortized for yopl's actually-Prolog
workloads."

1. **Pick the simplest WAM-able workload yopl has**: Knight's Tour
   with Warnsdorff (`tests/test-knight.js::tour_w/3`) or one of the
   classic-puzzle integer-only encodings. All operands are integers
   and cons cells of integers; no externref needed.
2. **Hand-write a WAM-style WASM module for just that rule set** —
   skip the codegen entirely. Write the WAT by hand: heap + trail +
   PDL + unify + the rule's clauses. Avoid `externref`. Lower
   manually from the existing IR. Goal is correctness, then perf.
3. **Microbench against the existing parity-bench scaffold** — file
   as `bench/bench-wam-prototype.js`. Compare:
   - Current JS path (closure-factory lower).
   - Hand-written WASM module via path B (wabt-js compile of the
     hand-written WAT).
   - Per-operation breakdown: WASM-side proof loop, JS↔WASM boundary,
     WAM-native unify vs (in a separate variant) externref-callback
     unify against an artificial JS-object leaf.
4. **Decision gates**:
   - If WASM is **≥ 3× faster** on the WAM-native portion AND the
     boundary cost is **bounded** (a few hundred µs per query,
     constant in query size) → proceed to codegen. Build path B
     (IR → WAT) for all rules. Re-bench against the full classic-
     puzzle suite. If still wins, build path A and ship.
   - If the boundary cost **dominates even for integer-only puzzles**
     → stop. WAM-in-WASM isn't the right lever for yopl's workload
     mix. Reroute to IR → JS source codegen (the cheaper sibling
     research item).
   - If WASM is **< 2× faster** on WAM-native → marginal. Decide
     case-by-case based on the boundary numbers.

Estimated POC effort: 2-3 days. Skips codegen, uses the existing
parity-bench scaffold, uses an existing workload from the test
suite.

## Open questions for the POC to answer

- Boundary cost per query (constant) and per terminal solution
  (proportional to bound-variable depth). Need both numbers.
- Does V8's `return_call_indirect` actually optimize to a jump, or
  does it fall back to a real call in practice? (V8 docs say it
  does; needs empirical confirmation under yopl's call shape.)
- Can the WAM heap be sized at instantiation and grow on demand
  (`memory.grow`), or does growth cause unacceptable per-grow stalls?
- How does deep6's circular-reference handling translate to WAM
  cells? (Probably: a separate visited-set table on the WASM side
  for the circular mode; default mode skips it.)

## Out of scope for this POC

- Externref + JS-callback `deep6.unify` integration. Regime-2/3
  workloads will need this; regime-1 POC proves the floor first.
- `WeakMap` instance cache. Bench against fresh instantiation per
  query; the cache is a separate (small) optimization layer.
- binaryen.js optimizer comparison. After POC succeeds.
- Source maps from WASM back to yopl IR / Prolog source. Tractable
  via the same `source: {file?, line, col}` field on Clause IR that
  `compile/prolog/` already threads — emit a WASM source-map blob
  alongside the binary. Defer until the codegen ships.
- Async / streaming WASM compilation. Sync construction is fine for
  per-query modules; revisit only if module sizes grow past ~100 KB.

## See also

- [`compiler-ir.md`](compiler-ir.md) — the IR the WASM backend
  consumes.
- [`solver-perf.md`](solver-perf.md) — the perf baseline the WASM
  backend has to beat.
- [`../wiki/Search-feasibility.md`](../wiki/Search-feasibility.md)
  — user-facing motivation (Mitigation 2, yopl-side).
- [`../wiki/Using-deep6.md`](../wiki/Using-deep6.md) — the deep6
  surface yopl exercises (informs the regime-1/2/3 split).
- The two sibling IR-backend research items (IR → JS source codegen,
  IR → leaner-JS-runtime) — see `projects/yopl/queue` in the vault.
  Start IR → JS source codegen first if this POC stops at the
  decision gate.

## Research sources

Background reading consulted while drafting this note. Captured for
auditability; not load-bearing on the design.

### WebAssembly proposals and platform status

- [WebAssembly tail calls — V8 blog](https://v8.dev/blog/wasm-tail-call)
  — shipping details, performance characteristics, the `return_call`
  / `return_call_indirect` semantics this design relies on.
- [Tail-call proposal — Overview.md](https://github.com/WebAssembly/tail-call/blob/main/proposals/tail-call/Overview.md)
  — the proposal's spec text and rationale.
- [WasmGC and Wasm tail-call optimizations are now Baseline (web.dev)](https://web.dev/blog/wasmgc-wasm-tail-call-optimizations-baseline)
  — confirmation of cross-browser Baseline status in 2024.
- [WebAssembly Feature Status](https://webassembly.org/features/) —
  authoritative current-status table for all proposals.
- [Firefox tail-call tracking bug (1571996)](https://bugzilla.mozilla.org/show_bug.cgi?id=1571996)
  — the Firefox laggard situation.
- [WasmGC proposal — Overview.md](https://github.com/WebAssembly/gc/blob/main/proposals/gc/Overview.md)
  — struct/array/ref types; the spec text for `externref` semantics.
- [WasmGC enabled by default in Chrome](https://developer.chrome.com/blog/wasmgc)
  — runtime availability and the V8 implementation notes.
- [A new way to bring GC'd languages to WebAssembly (V8)](https://v8.dev/blog/wasm-gc-porting)
  — porting-cost story; relevant to the externref-vs-translate
  decision in regime 2.
- [SharedArrayBuffer (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
  — the SAB primitive, COOP/COEP requirements, and why it's the
  wrong tool for the JS-object boundary.
- [Node worker_threads with shared array buffers + Rust WASM (LogRocket)](https://blog.logrocket.com/node-worker-threads-shared-array-buffers-rust-webassembly/)
  — Node-specific SAB pragmatics.

### Boundary cost benchmarks

- [16 Patterns for Crossing the WebAssembly Boundary (dev.to)](https://dev.to/rafacalderon/16-patterns-for-crossing-the-webassembly-boundary-and-the-one-that-wants-to-kill-them-all-5kb)
  — taxonomy of marshalling patterns and their costs.
- [Rust WebAssembly Performance: 8-10× Faster — 2025 benchmarks](https://byteiota.com/rust-webassembly-performance-8-10x-faster-2025-benchmarks/)
  — recent numbers on raw exports vs `wasm-bindgen` overhead;
  source of the "WASM wins above ~10 ms of work" rule of thumb.
- [The State of WebAssembly — 2024 and 2025 (platform.uno)](https://platform.uno/blog/state-of-webassembly-2024-2025/)
  — broader ecosystem snapshot.

### Tooling — code generation paths

- [WABT — WebAssembly Binary Toolkit](https://github.com/WebAssembly/wabt)
  — `wat2wasm` / `wasm2wat`; the development-time text path.
- [wabt npm package](https://www.npmjs.com/package/wabt) — wabt-js
  (Emscripten-compiled), the JS-runnable form used during POC.
- [Binaryen](https://github.com/WebAssembly/binaryen) — the
  alternative builder/optimizer; candidate for the post-POC
  `-O3` comparison.
- [Compiling to and optimizing Wasm with Binaryen (web.dev)](https://web.dev/articles/binaryen)
  — the optimizer's pass list and what each one buys.

### Prior art — Prolog in WASM

- [Trealla Prolog for the web (guregu/trealla-js)](https://github.com/guregu/trealla-js)
  — the closest existing WAM-in-WASM Prolog; useful as a reference
  for "what a serious implementation looks like" and a perf upper
  bound for the ground-Prolog regime.
- [SWI-Prolog WebAssembly build](https://www.swi-prolog.org/build/WebAssembly.html)
  — Emscripten-compiled SWI; demonstrates the full-Prolog-engine
  shape, but the wrong architecture for yopl (whole runtime in WASM
  vs yopl's per-rule WASM with shared runtime).

### Dynamic linking — surveyed but not adopted

- [WebAssembly DynamicLinking design doc](https://github.com/WebAssembly/design/blob/main/DynamicLinking.md)
- [tool-conventions DynamicLinking.md](https://github.com/WebAssembly/tool-conventions/blob/main/DynamicLinking.md)
  — the `dylink.0` custom-section convention. Read; deemed
  Emscripten-flavored and heavyweight for yopl's case. Plain WASM
  imports cover the same need.
