import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import asyncSolve from '../src/solvers/async.js';
import {submit, TEST} from './harness.js';
import {timeout} from './helpers.js';

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
  }
  // TODO(step 6): test_asyncSolve_member — solvers/async.js calls
  // `prove(...)` without `await`, so multi-solution cases lose results
  // when the per-callback `await` suspends after the first push.
];
