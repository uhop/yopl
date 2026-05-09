// Compare the four solver drivers on identical workloads. Surfaces
// the cost of `function*` / `async` / `async function*` over a plain
// callback. Run with `npm run bench -- bench/bench-drivers.js`.

import {variable as v} from 'deep6/env.js';
import solveCb from '../src/solve.js';
import solveGen from '../src/solvers/gen.js';
import solveAsync from '../src/solvers/async.js';
import solveAsyncGen from '../src/solvers/asyncGen.js';

const makeList = n => {
  let l = null;
  for (let i = n; i > 0; --i) l = {value: i, next: l};
  return l;
};

const rules = {
  member: [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]]
};

const list50 = makeList(50);

const callbackTake1 = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    solveCb(rules, 'member', [list50, v('X')], () => {
      ++count;
      return false;
    });
  }
  return count;
};

const genTake1 = n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    const it = solveGen(rules, 'member', [list50, v('X')]);
    if (!it.next().done) ++count;
  }
  return count;
};

const asyncTake1 = async n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    await solveAsync(rules, 'member', [list50, v('X')], () => {
      ++count;
      return false;
    });
  }
  return count;
};

const asyncGenTake1 = async n => {
  let count = 0;
  for (let i = 0; i < n; ++i) {
    const it = solveAsyncGen(rules, 'member', [list50, v('X')]);
    if (!(await it.next()).done) ++count;
  }
  return count;
};

export default {
  callbackTake1,
  genTake1,
  asyncTake1,
  asyncGenTake1
};
