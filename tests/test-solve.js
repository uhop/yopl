import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

export default [
  function test_solve_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    solve(rules, 'one/1', [X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1])'));
  },
  function test_solve_last() {
    const rules = {
        'notNull/1': X => [{args: [X]}, env => X.isBound(env) && X.get(env) !== null],
        'last/2': [
          () => [{args: [null, undefined]}],
          X => [{args: [{value: X, next: null}, X]}],
          (X, Y) => [{args: [{next: X}, Y]}, {name: 'notNull/1', args: [X]}, {name: 'last/2', args: [X, Y]}]
        ]
      },
      X = v('X');
    let result = [];
    solve(rules, 'last/2', [null, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [undefined])'));
    result = [];
    solve(rules, 'last/2', [makeList([1]), X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1])'));
    result = [];
    solve(rules, 'last/2', [makeList([1, 2]), X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [2])'));
  },
  function test_solve_member() {
    const rules = {
        'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member/2', args: [X, V]}]]
      },
      X = v('X');
    let result = [];
    solve(rules, 'member/2', [makeList([1, 2, 3]), 1], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(rules, 'member/2', [makeList([1, 2, 3]), 2], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(rules, 'member/2', [makeList([1, 2, 3]), 3], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(rules, 'member/2', [makeList([1, 2, 3]), 5], () => result.push(true));
    eval(TEST('unify(result, [])'));
    result = [];
    solve(rules, 'member/2', [makeList([1, X, 3]), 2], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [2])'));
    result = [];
    solve(rules, 'member/2', [makeList([1, 2, 3]), X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  function test_solve_append() {
    const rules = {
        'append/3': [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append/3', args: [X, Y, Z]}]]
      },
      X = v('X'),
      Y = v('Y');
    let result = [];
    solve(rules, 'append/3', [null, null, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [null])'));
    result = [];
    solve(rules, 'append/3', [null, makeList([1]), X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [makeList([1])])'));
    result = [];
    solve(rules, 'append/3', [makeList([1]), null, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [makeList([1])])'));

    result = [];
    solve(rules, 'append/3', [makeList([1, 2]), makeList([3, 4]), X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [makeList([1, 2, 3, 4])])'));
    result = [];
    solve(rules, 'append/3', [makeList([1, 2]), makeList([3, 4]), makeList([1, 2, 3], X)], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [makeList([4])])'));

    result = [];
    solve(rules, 'append/3', [X, Y, makeList([1, 2, 3])], env => {
      result.push(assemble(X, env));
      result.push(assemble(Y, env));
    });
    const expected = [null, makeList([1, 2, 3]), makeList([1]), makeList([2, 3]), makeList([1, 2]), makeList([3]), makeList([1, 2, 3]), null];
    eval(TEST('unify(result, expected)'));
  },
  function test_solve_no_match() {
    // Goal name that has no matching rule should produce no callback invocations.
    const rules = {'one/1': () => [{args: [1]}]},
      X = v('X'),
      result = [];
    solve(rules, 'unknown/1', [X], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_solve_unknown_subgoal() {
    // A rule body that calls an unknown predicate fails the surrounding goal
    // chain (rather than crashing).
    const rules = {
        outer: X => [{args: [X]}, {name: 'unknown', args: [X]}]
      },
      X = v('X'),
      result = [];
    solve(rules, 'outer', [X], () => result.push(true));
    eval(TEST('unify(result, [])'));
  }
];
