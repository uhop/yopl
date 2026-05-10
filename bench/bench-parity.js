// Compiled-vs-handwritten parity bench.
//
// Encodes the same `member/2` and `append/3` rules in four ways and
// runs the same proof workloads through each via the same `solve`
// driver. Variants in a nano-bench file are ranked against each other
// in one table; group rows by suffix to spot per-encoding deltas.
//
//   _hand     — pre-compiler raw `(...vars) => [...]` style.
//               Cheats on wildcards by omitting the `value` property
//               entirely, leveraging deep6's open-object semantics
//               ("missing property = any"). One fewer Variable
//               allocation per activation than the codegen / compiled
//               forms.
//   _codegen  — what an IR→JS codegen pass would emit for the IR
//               that the compiler currently INTERPRETS per activation.
//               Wildcards become fresh Variables (matching `lower.js`
//               semantics). Bridges the parity bench to the "IR → JS
//               source code" research item.
//   _clause   — iter-1 `clause\`...\`` per-clause DSL.
//   _prolog   — iter-2 `prolog\`...\`` strict-Prolog parser.
//
// Both `_clause` and `_prolog` go through `lower.js`'s tree-walking
// interpreter — IR is walked, `kind` is dispatched, and `vars[name]`
// is looked up per activation.
//
// Expected shape of the output (baseline as of iter-2 ship):
//
// - **clause ≈ prolog** within bench noise for every workload. Both
//   front-ends emit identical IR for the shared subset and lower
//   through the same `lower.js`. A significant gap is a front-end
//   shape divergence — investigate.
//
// - **hand ~13–28% faster than _clause / _prolog** across the member
//   workloads, ~12% faster on append. This is the compiler-overhead
//   floor — per-activation IR walk + dict lookup + wildcard Variable
//   allocation, vs. inlined literals in the hand-written form.
//
// - **codegen sits between hand and clause/prolog**, closing ~50–80%
//   of the gap on member workloads. On `append10` (no wildcards),
//   `_codegen` ≈ `_hand` within bench noise — direct evidence that
//   for wildcard-free rules, codegen-based lowering would land at
//   the hand-written floor. The residual ~5–9% on member is the
//   wildcard-allocation difference (`{next: X}` vs.
//   `{value: variable(), next: X}`), recoverable via a "smart
//   codegen" that detects value-position wildcards.
//
// Run: `npm run bench -- bench/bench-parity.js`.

import {variable, variable as v} from 'deep6/env.js';
import solve from '../src/solve.js';
import {rule, clause} from '../src/compile/clause/index.js';
import {lowerRules} from '../src/compile/lower.js';
import {prolog} from '../src/compile/prolog/index.js';

const makeList = n => {
  let l = null;
  for (let i = n; i > 0; --i) l = {value: i, next: l};
  return l;
};

// ---------------------------------------------------------------------
// member/2 — four encodings of the same logic.
//
// Standard Prolog arg order: member(VALUE, LIST). All four encodings
// (and the workload calls below) follow that convention.

// 1. _hand — pre-compiler raw style. Cheats on wildcards by omitting
//    the `value` property entirely, leveraging deep6's open-object
//    semantics ("missing property = any"). One fewer Variable
//    allocation per activation than the codegen / compiled forms.
const memberHand = {
  member: [(V, X) => [{args: [V, {value: V, next: X}]}], (V, X) => [{args: [V, {next: X}]}, {name: 'member', args: [V, X]}]]
};

// 2. _codegen — what an IR→JS codegen pass would emit for the IR
//    `member(V, [V | _]). member(V, [_ | X]) :- member(V, X).`. Same
//    activation contract as `lower.js` (wildcards become fresh
//    Variables). Bridges the parity bench to the IR→JS research item:
//    if `_codegen` ≈ `_hand`, the compiler-overhead floor is mostly
//    the IR walk + `vars[name]` lookup, recoverable via codegen.
const memberCodegen = {
  member: [V => [{args: [V, {value: V, next: variable()}]}], (V, X) => [{args: [V, {value: variable(), next: X}]}, {name: 'member', args: [V, X]}]]
};

// 3. _clause — iter-1 per-clause DSL. Lowers through lower.js.
const memberClause = lowerRules([rule('member', 2)(clause`(V, [V | _])`, clause`(V, [_ | X]) :- member(V, X)`)]);

// 4. _prolog — iter-2 strict-Prolog parser. Same lowering path; the
//    front-end emits identical IR to _clause for this rule.
const memberProlog = prolog`
  member(V, [V | _]).
  member(V, [_ | X]) :- member(V, X).
`;

// ---------------------------------------------------------------------
// append/3 — four encodings of the same logic.

const appendHand = {
  append: [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append', args: [X, Y, Z]}]]
};

// No wildcards in either clause — codegen output is byte-identical to
// the hand-written form here (modulo declaration style). Kept in for
// the parity-bench shape, expected to land on top of _hand.
const appendCodegen = {
  append: [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append', args: [X, Y, Z]}]]
};

const appendClause = lowerRules([rule('append', 3)(clause`(null, Y, Y)`, clause`([V | X], Y, [V | Z]) :- append(X, Y, Z)`)]);

const appendProlog = prolog`
  append(null, Y, Y).
  append([V | X], Y, [V | Z]) :- append(X, Y, Z).
`;

// ---------------------------------------------------------------------
// Workload generators — `rules` is the only varied dimension.

const list50 = makeList(50);
const list200 = makeList(200);
const list10 = makeList(10);

// member workloads: arg order is (VALUE, LIST) — standard Prolog.
const containsLast50 = rules => n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'member', [50, list50], () => ++count);
  }
  return count;
};

const enumerateAll50 = rules => n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'member', [v('X'), list50], () => ++count);
  }
  return count;
};

const containsLast200 = rules => n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'member', [200, list200], () => ++count);
  }
  return count;
};

const appendSplit10 = rules => n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'append', [v('X'), v('Y'), list10], () => ++count);
  }
  return count;
};

export default {
  member50_hand: containsLast50(memberHand),
  member50_codegen: containsLast50(memberCodegen),
  member50_clause: containsLast50(memberClause),
  member50_prolog: containsLast50(memberProlog),

  member50enum_hand: enumerateAll50(memberHand),
  member50enum_codegen: enumerateAll50(memberCodegen),
  member50enum_clause: enumerateAll50(memberClause),
  member50enum_prolog: enumerateAll50(memberProlog),

  member200_hand: containsLast200(memberHand),
  member200_codegen: containsLast200(memberCodegen),
  member200_clause: containsLast200(memberClause),
  member200_prolog: containsLast200(memberProlog),

  append10_hand: appendSplit10(appendHand),
  append10_codegen: appendSplit10(appendCodegen),
  append10_clause: appendSplit10(appendClause),
  append10_prolog: appendSplit10(appendProlog)
};
