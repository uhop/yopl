// The JS bridge helpers (dev-docs/runtime-protocols.md § Workstream 2):
// deref unit semantics (unbound, alias chain, bound-to-undefined), the
// computes / verifies combinators (forward bind, bound-out verify, unbound
// input, MISS sentinel, structural results), and reversible3 behavioral
// parity with math.js's reversibleTernary-built `add` across all modes.

import {variable as v} from 'deep6/unify.js';
import {EnvMap} from 'deep6/env-map.js';
import assemble from 'deep6/traverse/assemble.js';
import {prolog} from '../src/compile/prolog/index.js';
import {deref, computes, verifies, reversible3, MISS} from '../src/rules/bridge.js';
import {rules as mathRules} from '../src/rules/math.js';
import solve from '../src/solve.js';
import {submit, TEST} from './harness.js';

const solverEnv = () => {
  const env = new EnvMap();
  env.options.openObjects = true;
  return env;
};

const bridgeRules = prolog`
  add(X, Y, Z) :- ${reversible3(
    (x, y, z) => x + y === z,
    (x, y) => x + y,
    (x, z) => z - x,
    (y, z) => z - y
  )}.
  add(0, Y, Y).
  add(X, 0, X).

  atIndex(A, I, X) :- ${computes((a, i) => (Number.isInteger(i) && i >= 0 && i < a.length ? a[i] : MISS))}.
  lessThan(X, Y) :- ${verifies((x, y) => x < y)}.
  pairOf(X, P) :- ${computes(x => ({left: x, right: x}))}.
`;

const collect = (rules, name, args, wanted) => {
  const result = [];
  solve(rules, name, args, env => result.push(wanted.map(w => assemble(w, env)).join(',')));
  return result.sort().join(';');
};

const count = (rules, name, args) => {
  let n = 0;
  solve(rules, name, args, () => ++n);
  return n;
};

export default [
  function test_bridge_deref() {
    const env = solverEnv();
    const X = v('X'),
      Y = v('Y'),
      Z = v('Z');
    eval(TEST('deref(X, env) === X'));
    eval(TEST('deref(42, env) === 42'));
    env.bindVal(X.name, 5);
    eval(TEST('deref(X, env) === 5'));
    env.bindVar(Y.name, Z.name);
    env.bindVal(Z.name, 7);
    eval(TEST('deref(Y, env) === 7'));
    const U = v('U');
    env.bindVal(U.name, undefined);
    eval(TEST('deref(U, env) === undefined'));
  },
  function test_bridge_reversible3_parity_with_math() {
    const Z = v('Z');
    eval(TEST("collect(bridgeRules, 'add', [2, 3, Z], [Z]) === collect(mathRules, 'add', [2, 3, Z], [Z])"));
    const Y = v('Y');
    eval(TEST("collect(bridgeRules, 'add', [2, Y, 5], [Y]) === collect(mathRules, 'add', [2, Y, 5], [Y])"));
    const X = v('X');
    eval(TEST("collect(bridgeRules, 'add', [X, 3, 5], [X]) === collect(mathRules, 'add', [X, 3, 5], [X])"));
    eval(TEST("count(bridgeRules, 'add', [2, 3, 5]) === count(mathRules, 'add', [2, 3, 5])"));
    eval(TEST("count(bridgeRules, 'add', [2, 3, 6]) === count(mathRules, 'add', [2, 3, 6])"));
    eval(TEST("count(bridgeRules, 'add', [X, Y, 5]) === count(mathRules, 'add', [X, Y, 5])"));
    eval(TEST("count(bridgeRules, 'add', [0, Y, Z]) === count(mathRules, 'add', [0, Y, Z])"));
  },
  function test_bridge_computes() {
    const X = v('X');
    eval(TEST("collect(bridgeRules, 'atIndex', [['a', 'b', 'c'], 1, X], [X]) === 'b'"));
    eval(TEST("count(bridgeRules, 'atIndex', [['a', 'b', 'c'], 1, 'b']) === 1"));
    eval(TEST("count(bridgeRules, 'atIndex', [['a', 'b', 'c'], 1, 'z']) === 0"));
    eval(TEST("count(bridgeRules, 'atIndex', [['a', 'b', 'c'], 9, X]) === 0"));
    eval(TEST("count(bridgeRules, 'atIndex', [['a'], v('I'), X]) === 0"));
  },
  function test_bridge_computes_structural_out() {
    const P = v('P');
    eval(TEST("collect(bridgeRules, 'pairOf', [3, P], [P]) === '[object Object]'"));
    let out;
    solve(bridgeRules, 'pairOf', [3, P], env => (out = assemble(P, env)));
    eval(TEST('out.left === 3 && out.right === 3'));
    eval(TEST("count(bridgeRules, 'pairOf', [3, {left: 3, right: 3}]) === 1"));
    eval(TEST("count(bridgeRules, 'pairOf', [3, {left: 4, right: 3}]) === 0"));
  },
  function test_bridge_verifies() {
    eval(TEST("count(bridgeRules, 'lessThan', [1, 2]) === 1"));
    eval(TEST("count(bridgeRules, 'lessThan', [2, 1]) === 0"));
    eval(TEST("count(bridgeRules, 'lessThan', [v('X'), 2]) === 0"));
  }
];
