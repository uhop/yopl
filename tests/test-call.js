import {variable} from 'deep6/env.js';
import solve from '../src/solve.js';
import assemble from 'deep6/traverse/assemble.js';
import {rules as systemRules, call, list, rest, head, term} from '../src/rules/system.js';

const rules = {
    ...systemRules,
    member: [(V, X) => [head(list(V, rest(X)), V)], (V, X) => [head({next: X}, V), term('member', X, V)]],
    one: X => [head(X), call(term('member', list(1, 2, 2, 3), X))],
    two: [X => [head(X), term('one', X)], X => [head(X), term('one', X)]]
  },
  X = variable('X');

solve(rules, 'two', [X], env => {
  console.log('X =', assemble(X, env));
});

console.log('Done.');
