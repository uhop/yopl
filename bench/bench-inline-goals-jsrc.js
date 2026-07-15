// `bench-inline-goals.js` workloads with the math rules re-lowered from
// their attached IR through the regime-B JS-source lowering — stresses the
// `js`-goal factory path specifically (dev-docs/js-source-backend.md
// § Where the savings live, item 3). Same variant names — record with
// `--json` and pair against a saved `bench-inline-goals.js` run via
// `nano-bench-compare`.

import {variable as v} from 'deep6/env.js';
import solve from '../src/solve.js';
import {rules as mathRules} from '../src/rules/math.js';
import {IR} from '../src/compile/ir.js';
import {lowerRules} from '../src/compile/lower-jsrc.js';

const rules = lowerRules(Object.values(mathRules[IR]));

const addForward = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'add', [i, i + 1, v('Z')], () => ++count);
  }
  return count;
};

const addReverse = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'add', [i, v('Y'), i * 2 + 1], () => ++count);
  }
  return count;
};

const addVerify = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(rules, 'add', [i, i + 1, i + i + 1], () => ++count);
  }
  return count;
};

export default {
  addForward,
  addReverse,
  addVerify
};
