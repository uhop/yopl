// Inline-goal-heavy workload: math.add forward / reverse / verify modes.
// Stresses the reversible-operator pattern with cut + bindVal across all
// three goal branches. Run with `npm run bench -- bench/bench-inline-goals.js`.

import {variable as v} from 'deep6/env.js';
import solve from '../src/solve.js';
import {rules as mathRules} from '../src/rules/math.js';

const addForward = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(mathRules, 'add', [i, i + 1, v('Z')], () => ++count);
  }
  return count;
};

const addReverse = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(mathRules, 'add', [i, v('Y'), i * 2 + 1], () => ++count);
  }
  return count;
};

const addVerify = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solve(mathRules, 'add', [i, i + 1, i + i + 1], () => ++count);
  }
  return count;
};

export default {
  addForward,
  addReverse,
  addVerify
};
