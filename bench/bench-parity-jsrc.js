// `bench-parity.js` extended with the regime-B JS-source lowering as a
// fifth encoding (dev-docs/js-source-backend.md § POC step 4). Same
// `member/2` + `append/3` logic, same workloads, same `_hand` / `_codegen` /
// `_clause` / `_prolog` variants as the sibling — plus `_jsrc`: the IR
// compiled through src/compile/lower-jsrc.js. The decisive comparisons:
//
// - `_jsrc` vs `_clause` / `_prolog` — the win codegen buys over the
//   tree-walking interpreter for the same IR.
// - `_jsrc` vs `_codegen` — emitted code vs the hand-written prediction of
//   what codegen would emit; a gap means the emitter's output diverges from
//   the predicted shape (wrapper closure, consts table, etc.).
// - `_jsrc` vs `_hand` — distance to the wildcard-cheat floor.
//
// Run: `npm run bench -- bench/bench-parity-jsrc.js`.

import {variable, variable as v} from 'deep6/env.js';
import solve from '../src/solve.js';
import {rule, clause} from '../src/compile/clause.js';
import {lowerRules} from '../src/compile/lower.js';
import {lowerRules as lowerJsrcRules} from '../src/compile/lower-jsrc.js';
import {prolog} from '../src/compile/prolog/index.js';

const makeList = n => {
  let l = null;
  for (let i = n; i > 0; --i) l = {value: i, next: l};
  return l;
};

// member/2 — five encodings; standard Prolog arg order member(VALUE, LIST).

const memberHand = {
  member: [(V, X) => [{args: [V, {value: V, next: X}]}], (V, X) => [{args: [V, {next: X}]}, {name: 'member', args: [V, X]}]]
};

const memberCodegen = {
  member: [V => [{args: [V, {value: V, next: variable()}]}], (V, X) => [{args: [V, {value: variable(), next: X}]}, {name: 'member', args: [V, X]}]]
};

const memberIR = () => [rule('member', 2)(clause`(V, [V | _])`, clause`(V, [_ | X]) :- member(V, X)`)];
const memberClause = lowerRules(memberIR());
const memberJsrc = lowerJsrcRules(memberIR());

const memberProlog = prolog`
  member(V, [V | _]).
  member(V, [_ | X]) :- member(V, X).
`;

// append/3 — five encodings.

const appendHand = {
  append: [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append', args: [X, Y, Z]}]]
};

const appendCodegen = {
  append: [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append', args: [X, Y, Z]}]]
};

const appendIR = () => [rule('append', 3)(clause`(null, Y, Y)`, clause`([V | X], Y, [V | Z]) :- append(X, Y, Z)`)];
const appendClause = lowerRules(appendIR());
const appendJsrc = lowerJsrcRules(appendIR());

const appendProlog = prolog`
  append(null, Y, Y).
  append([V | X], Y, [V | Z]) :- append(X, Y, Z).
`;

// Workload generators — `rules` is the only varied dimension.

const list50 = makeList(50);
const list200 = makeList(200);
const list10 = makeList(10);

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
  member50_jsrc: containsLast50(memberJsrc),

  member50enum_hand: enumerateAll50(memberHand),
  member50enum_codegen: enumerateAll50(memberCodegen),
  member50enum_clause: enumerateAll50(memberClause),
  member50enum_prolog: enumerateAll50(memberProlog),
  member50enum_jsrc: enumerateAll50(memberJsrc),

  member200_hand: containsLast200(memberHand),
  member200_codegen: containsLast200(memberCodegen),
  member200_clause: containsLast200(memberClause),
  member200_prolog: containsLast200(memberProlog),
  member200_jsrc: containsLast200(memberJsrc),

  append10_hand: appendSplit10(appendHand),
  append10_codegen: appendSplit10(appendCodegen),
  append10_clause: appendSplit10(appendClause),
  append10_prolog: appendSplit10(appendProlog),
  append10_jsrc: appendSplit10(appendJsrc)
};
