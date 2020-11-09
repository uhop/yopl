import {variable} from 'deep6/env.js';
import solve from '../src/solve.js';
import {rules as systemRules, cut, list, rest} from '../src/rules/system.js';

const rules = {
    ...systemRules,
    member: [(V, X, ...sys) => [{args: [list(V, rest(X)), V]}, cut(sys)], (V, X) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]]
  },
  X = variable('X');

solve(rules, 'member', [list(1, 2, 2, 3), 2], () => {
  console.log('Got it.');
});

console.log('Done.');
