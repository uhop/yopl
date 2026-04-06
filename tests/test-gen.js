import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import gen from '../src/solvers/gen.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

export default [
  function test_gen_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    for (const env of gen(rules, 'one/1', [X])) {
      result.push(assemble(X, env));
    }
    eval(TEST('unify(result, [1])'));
  },
  function test_gen_member() {
    const rules = {
        'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member/2', args: [X, V]}]]
      },
      X = v('X');
    let result = [];
    for (const _env of gen(rules, 'member/2', [makeList([1, 2, 3]), 1])) {
      result.push(true);
    }
    eval(TEST('unify(result, [true])'));
    result = [];
    for (const _env of gen(rules, 'member/2', [makeList([1, 2, 3]), 2])) {
      result.push(true);
    }
    eval(TEST('unify(result, [true])'));
    result = [];
    for (const _env of gen(rules, 'member/2', [makeList([1, 2, 3]), 3])) {
      result.push(true);
    }
    eval(TEST('unify(result, [true])'));
    result = [];
    for (const _env of gen(rules, 'member/2', [makeList([1, 2, 3]), 4])) {
      result.push(true);
    }
    eval(TEST('unify(result, [])'));
    result = [];
    for (const env of gen(rules, 'member/2', [makeList([1, X, 3]), 5])) {
      result.push(assemble(X, env));
    }
    eval(TEST('unify(result, [5])'));
    result = [];
    for (const env of gen(rules, 'member/2', [makeList([1, 2, 3]), X])) {
      result.push(assemble(X, env));
    }
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  function test_gen_append() {
    const rules = {
        'append/3': [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append/3', args: [X, Y, Z]}]]
      },
      X = v('X'),
      Y = v('Y');
    const result = [];
    for (const env of gen(rules, 'append/3', [X, Y, makeList([1, 2, 3])])) {
      result.push(assemble(X, env));
      result.push(assemble(Y, env));
    }
    const expected = [null, makeList([1, 2, 3]), makeList([1]), makeList([2, 3]), makeList([1, 2]), makeList([3]), makeList([1, 2, 3]), null];
    eval(TEST('unify(result, expected)'));
  },
  function test_gen_lazy() {
    // The generator should support pulling a single solution and abandoning the rest.
    const rules = {
        'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member/2', args: [X, V]}]]
      },
      X = v('X');
    const it = gen(rules, 'member/2', [makeList([1, 2, 3]), X]);
    const first = it.next();
    eval(TEST('!first.done'));
    eval(TEST('assemble(X, first.value) === 1'));
  }
];
