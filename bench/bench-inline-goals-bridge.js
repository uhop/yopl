// `bench-inline-goals.js` workloads with the `add` native rebuilt on the
// bridge helpers (`reversible3` — one deref walk per variable read instead
// of the isBound + get double scan; dev-docs/runtime-protocols.md
// § Workstream 2). Same three variant names — record with `--json` and pair
// against a saved `bench-inline-goals.js` run via `nano-bench-compare`.
//
// EnvMap reads walk the frame stack (O(depth)), so probe savings grow with
// proof depth; the add* queries are shallow. The `sumList50_*` pair stresses
// depth inside one file: a recursive list sum calls `add` ~50 frames deep —
// `_math` uses the baseline math.js native, `_bridge` the reversible3 one.

import {variable as v} from 'deep6/env.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {reversible3} from '../src/rules/bridge.js';
import {rules as mathRules} from '../src/rules/math.js';

const bridgeRules = prolog`
  add(X, Y, Z) :- ${reversible3(
    (x, y, z) => x + y === z,
    (x, y) => x + y,
    (x, z) => z - x,
    (y, z) => z - y
  )}.
  add(0, Y, Y).
  add(X, 0, X).

  sum(null, 0).
  sum([X | T], S) :- sum(T, S1), add(X, S1, S).
`;

const mathSumRules = {
  ...mathRules,
  ...prolog`
    sum(null, 0).
    sum([X | T], S) :- sum(T, S1), add(X, S1, S).
  `
};

const makeList = n => {
  let l = null;
  for (let i = n; i > 0; --i) l = {value: i, next: l};
  return l;
};

const list50 = makeList(50);

const addForward = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(bridgeRules, 'add', [i, i + 1, v('Z')], () => ++count);
  }
  return count;
};

const addReverse = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(bridgeRules, 'add', [i, v('Y'), i * 2 + 1], () => ++count);
  }
  return count;
};

const addVerify = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(bridgeRules, 'add', [i, i + 1, i + i + 1], () => ++count);
  }
  return count;
};

const sumList50 = rules => n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'sum', [list50, v('S')], () => ++count);
  }
  return count;
};

export default {
  addForward,
  addReverse,
  addVerify,
  sumList50_math: sumList50(mathSumRules),
  sumList50_bridge: sumList50(bridgeRules)
};
