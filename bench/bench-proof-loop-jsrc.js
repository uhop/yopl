// `bench-proof-loop.js` workloads with the member/append rules compiled
// from IR through the regime-B JS-source lowering (src/compile/lower-jsrc.js).
// Same variant names — record with `--json` and pair against a saved
// `bench-proof-loop.js` run via `nano-bench-compare`. Note the baseline file
// hand-writes its rules (wildcard-cheat encoding); the IR forms here carry
// genuine wildcards, so the pairing measures "jsrc-compiled vs hand-written
// floor", not lowering targets alone — `bench-parity-jsrc.js` isolates that.
// See dev-docs/js-source-backend.md § POC.

import {variable as v} from 'deep6/env.js';
import solve from '../src/solve.js';
import {rule, clause} from '../src/compile/clause.js';
import {lowerRules} from '../src/compile/lower-jsrc.js';

const makeList = n => {
  let l = null;
  for (let i = n; i > 0; --i) l = {value: i, next: l};
  return l;
};

const memberRules = lowerRules([rule('member', 2)(clause`([V | _], V)`, clause`([_ | X], V) :- member(X, V)`)]);

const appendRules = lowerRules([rule('append', 3)(clause`(null, Y, Y)`, clause`([V | X], Y, [V | Z]) :- append(X, Y, Z)`)]);

const list50 = makeList(50);
const list200 = makeList(200);
const list10 = makeList(10);

const memberContainsLast50 = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(memberRules, 'member', [list50, 50], () => ++count);
  }
  return count;
};

const memberEnumerateAll50 = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(memberRules, 'member', [list50, v('X')], () => ++count);
  }
  return count;
};

const memberContainsLast200 = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(memberRules, 'member', [list200, 200], () => ++count);
  }
  return count;
};

const appendSplit10 = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(appendRules, 'append', [v('X'), v('Y'), list10], () => ++count);
  }
  return count;
};

export default {
  memberContainsLast50,
  memberEnumerateAll50,
  memberContainsLast200,
  appendSplit10
};
