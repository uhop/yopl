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

## Conventions

- File name: `bench-<topic>.js`.
- ESM, `export default { variantA: n => {...}, variantB: n => {...} }`.
- Each variant runs `for (let i = 0; i < n; ++i) { ... }`.
- Setup outside the loop. Prevent dead-code elimination by returning the sink.
- Match yopl prettier style (single quotes, no bracket spacing, no trailing
  commas, arrow parens avoided).
- `.claude/skills/{write-bench,write-watch}` are symlinks into
  `node_modules/nano-benchmark/skills/` — invoke via Skill when authoring or
  watching benches.

## Current targets

| File                    | Compares                                              | Notes                                                                                                 |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `bench-proof-loop.js`   | member contains-last / enumerate-all / append-split   | Core solver workload — head unification, choice-point allocation, recursive descent.                  |
| `bench-drivers.js`      | sync callback / sync gen / async callback / async gen | Take-1 over `member` — surfaces driver overhead vs the proof loop.                                    |
| `bench-inline-goals.js` | math.add forward / reverse / verify                   | Reversible-operator path — `isBound` probe + `bindVal` + `cut(sys)` across all three argument shapes. |

## Pending

- **Higher-order rules** — `map` / `filter` / `compose` exercising the dynamic
  `call(...)` runtime helper. Pending after the rule-compiler MVP lands so the
  catalog can dogfood compiled rules vs hand-written ones.
- **Compiled-vs-handwritten parity** — once `src/rules/{system,comp,math,bits,logic}.js`
  are dogfood-rewritten via `src/compile/`, add a parity bench that runs the
  same workload through both encodings and asserts no regression.
- **Cut + halt** — `notEq` / `once` patterns and `halt`-aborted searches; covered
  partially by `bench-proof-loop.js`'s `appendSplit10` (cut-free) but missing a
  cut-heavy workload.
