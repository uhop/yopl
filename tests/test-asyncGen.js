import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import asyncGen from '../src/solvers/asyncGen.js';
import {submit, TEST} from './harness.js';
import {makeList, timeout} from './helpers.js';

export default [
  async function test_asyncGen_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    for await (const env of asyncGen(rules, 'one/1', [X])) {
      result.push(assemble(X, env));
      await timeout(5);
    }
    eval(TEST('unify(result, [1])'));
  },
  async function test_asyncGen_member() {
    const rules = {
        'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member/2', args: [X, V]}]]
      },
      X = v('X'),
      result = [];
    for await (const env of asyncGen(rules, 'member/2', [makeList([1, 2, 3]), X])) {
      result.push(assemble(X, env));
      await timeout(1);
    }
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  async function test_asyncGen_recursive_last() {
    const rules = {
      last: [L => [{args: [{value: L, next: null}, L]}], (X, L) => [{args: [{next: X}, L]}, {name: 'last', args: [X, L]}]]
    };
    const X = v('X'),
      result = [];
    for await (const env of asyncGen(rules, 'last', [makeList([1, 2, 3]), X])) {
      result.push(assemble(X, env));
      await timeout(1);
    }
    eval(TEST('unify(result, [3])'));
  },
  async function test_asyncGen_unknown_rule_throws() {
    let caught = false;
    try {
      for await (const _env of asyncGen({}, 'noSuchRule', [])) {
        // never reached
      }
    } catch (_e) {
      caught = true;
    }
    eval(TEST('caught'));
  },
  async function test_asyncGen_awaits_async_predicate() {
    // Same async-predicate shape as `test_asyncSolve_awaits_async_predicate`,
    // through the generator driver.
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
    for await (const _env of asyncGen(rules, 'asyncCheck', [42])) result.push(true);
    eval(TEST('unify(result, [true])'));
    result = [];
    for await (const _env of asyncGen(rules, 'asyncCheck', [-1])) result.push(true);
    eval(TEST('unify(result, [])'));
  }
];
