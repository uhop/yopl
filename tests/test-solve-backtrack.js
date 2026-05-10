// Regression: solve.js's prove loop must restore the outer goals.index
// when backtracking to retry alternative rules in a predicate-call frame.
//
// Bug: `goals.index` is mutated as we walk the body forward. When a
// predicate-call frame backtracks (its first match's downstream goals
// fail), retrying the next rule must reset the outer index so that on
// re-success we walk up to the correct next body goal — not skip past
// it because downstream processing already advanced the index.
//
// Reproducer: two `member` calls on a 2-cell list of fresh vars. There
// are exactly two solutions: [a, b] and [b, a]. The pre-fix solver
// returned [a, b] but then `[unbound, a]` for the second — the second
// `member('b', L)` got skipped on the backtracking path.

import solve from '../src/solve.js';
import solveGen from '../src/solvers/gen.js';
import solveAsync from '../src/solvers/async.js';
import solveAsyncGen from '../src/solvers/asyncGen.js';
import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import {rules as systemRules} from '../src/rules/system.js';
import {submit, TEST} from './harness.js';

const cons = (head, tail) => ({value: head, next: tail});

const rules = {
  ...systemRules,
  member: [(X, T) => [{args: [X, cons(X, T)]}], (X, H, T) => [{args: [X, cons(H, T)]}, {name: 'member', args: [X, T]}]],
  twoMembers: [
    (L, X1, X2) => [{args: [L]}, {name: 'eq', args: [L, cons(X1, cons(X2, null))]}, {name: 'member', args: ['a', L]}, {name: 'member', args: ['b', L]}]
  ]
};

const collect = env => {
  // Caller sets `currentL` before each solve call.
  const lst = assemble(currentL, env);
  const arr = [];
  let cur = lst;
  while (cur && cur.value !== undefined) {
    arr.push(cur.value);
    cur = cur.next;
  }
  return arr;
};

let currentL;

const checkAllSolutionsBound = sols => {
  if (sols.length !== 2) return false;
  return sols.every(s => s.length === 2 && typeof s[0] === 'string' && typeof s[1] === 'string');
};

export default [
  function test_sync_solve_backtrack_restores_index() {
    currentL = v('L');
    const sols = [];
    solve(rules, 'twoMembers', [currentL], env => sols.push(collect(env)));
    eval(TEST('sols.length === 2'));
    const allBound = checkAllSolutionsBound(sols);
    eval(TEST('allBound === true'));
  },
  function test_gen_solve_backtrack_restores_index() {
    currentL = v('L');
    const sols = [];
    for (const env of solveGen(rules, 'twoMembers', [currentL])) {
      sols.push(collect(env));
    }
    eval(TEST('sols.length === 2'));
    const allBound = checkAllSolutionsBound(sols);
    eval(TEST('allBound === true'));
  },
  async function test_async_solve_backtrack_restores_index() {
    currentL = v('L');
    const sols = [];
    await solveAsync(rules, 'twoMembers', [currentL], env => sols.push(collect(env)));
    eval(TEST('sols.length === 2'));
    const allBound = checkAllSolutionsBound(sols);
    eval(TEST('allBound === true'));
  },
  async function test_asyncGen_solve_backtrack_restores_index() {
    currentL = v('L');
    const sols = [];
    for await (const env of solveAsyncGen(rules, 'twoMembers', [currentL])) {
      sols.push(collect(env));
    }
    eval(TEST('sols.length === 2'));
    const allBound = checkAllSolutionsBound(sols);
    eval(TEST('allBound === true'));
  }
];
