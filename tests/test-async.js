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
  }
];
