// Proof-loop micro-benchmarks: deterministic search (`member contains last`),
// solution enumeration, and partial-list generation via `append`. Run with
// `npm run bench -- bench/bench-proof-loop.js`.

import {variable as v} from 'deep6/env.js';
import solve from '../src/solve.js';

const makeList = n => {
  let l = null;
  for (let i = n; i > 0; --i) l = {value: i, next: l};
  return l;
};

const memberRules = {
  member: [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]]
};

const appendRules = {
  append: [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append', args: [X, Y, Z]}]]
};

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
