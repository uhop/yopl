import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import asyncGen from '../src/solvers/asyncGen.js';
import {submit, TEST} from './harness.js';
import {timeout} from './helpers.js';

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
    for await (const env of asyncGen(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, X])) {
      result.push(assemble(X, env));
      await timeout(1);
    }
    eval(TEST('unify(result, [1, 2, 3])'));
  }
];
