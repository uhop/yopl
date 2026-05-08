import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import asyncSolve from '../src/solvers/async.js';
import {submit, TEST} from './harness.js';
import {makeList, timeout} from './helpers.js';

export default [
  async function test_asyncSolve_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    await asyncSolve(rules, 'one/1', [X], async env => {
      result.push(assemble(X, env));
      await timeout(5);
    });
    eval(TEST('unify(result, [1])'));
  },
  async function test_asyncSolve_member() {
    const rules = {
        'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member/2', args: [X, V]}]]
      },
      X = v('X'),
      result = [];
    await asyncSolve(rules, 'member/2', [makeList([1, 2, 3]), X], async env => {
      result.push(assemble(X, env));
      await timeout(1);
    });
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  async function test_asyncSolve_recursive_last() {
    // Recursive multi-clause rule: find the last element of a list. Pulls
    // the async driver through backtracking + body recursion, the same
    // shape `test-solve.js` exercises for the sync solver.
    const rules = {
      last: [L => [{args: [{value: L, next: null}, L]}], (X, L) => [{args: [{next: X}, L]}, {name: 'last', args: [X, L]}]]
    };
    const X = v('X'),
      result = [];
    await asyncSolve(rules, 'last', [makeList([1, 2, 3]), X], async env => {
      result.push(assemble(X, env));
      await timeout(1);
    });
    eval(TEST('unify(result, [3])'));
  },
  async function test_asyncSolve_unknown_rule_throws() {
    // Unknown rule names surface as errors under the async driver too.
    let caught = false;
    try {
      await asyncSolve({}, 'noSuchRule', [], async () => {});
    } catch (_e) {
      caught = true;
    }
    eval(TEST('caught'));
  },
  async function test_asyncSolve_awaits_async_predicate() {
    // The async driver awaits inline goal functions. A predicate that
    // resolves true through a promise should be awaited; one that
    // resolves false should backtrack. Exercises the `await goal(...)`
    // branch that `test-solve.js` cannot reach.
    const rules = {
      asyncCheck: X => [
        {args: [X]},
        async env => {
          await timeout(1);
          return X.isBound(env) && X.get(env) > 0;
        }
      ]
    };
    let result = [];
    await asyncSolve(rules, 'asyncCheck', [42], async () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    await asyncSolve(rules, 'asyncCheck', [-1], async () => result.push(true));
    eval(TEST('unify(result, [])'));
  }
];
