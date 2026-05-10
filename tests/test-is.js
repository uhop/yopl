// Tests for `is/2` arithmetic expression evaluation.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {rules as mathRules} from '../src/rules/math.js';
import {submit, TEST} from './harness.js';

const program = prolog`
  forward(X, Y, Z) :- Z is X + Y.
  diff(X, Y, Z)    :- Z is X - Y.
  prod(X, Y, Z)    :- Z is X * Y.
  quot(X, Y, Z)    :- Z is X / Y.
  intdiv(X, Y, Z)  :- Z is X // Y.
  modulo(X, Y, Z)  :- Z is X mod Y.
  nested(X, Y, Z, R) :- R is (X + Y) * Z.
  precedence(X, Y, Z, R) :- R is X + Y * Z.
  unary(X, R) :- R is -X.
  absVal(X, R) :- R is abs(X).
  sqrtVal(X, R) :- R is sqrt(X).
`;

const allRules = {...systemRules, ...mathRules, ...program};

const callOne = (name, args) => {
  let result = null;
  let count = 0;
  solve(allRules, name, args, env => {
    ++count;
    result = args.map(a => (a && typeof a.isBound === 'function' && a.isBound(env)) ? assemble(a, env) : a);
  });
  return {count, result};
};

export default [
  function test_is_forward_addition() {
    const Z = v('Z');
    const {count, result} = callOne('forward', [3, 4, Z]);
    eval(TEST('count === 1'));
    eval(TEST('result[2] === 7'));
  },
  function test_is_subtract() {
    const Z = v('Z');
    const {count, result} = callOne('diff', [10, 3, Z]);
    eval(TEST('count === 1'));
    eval(TEST('result[2] === 7'));
  },
  function test_is_multiply() {
    const Z = v('Z');
    const {count, result} = callOne('prod', [6, 7, Z]);
    eval(TEST('count === 1'));
    eval(TEST('result[2] === 42'));
  },
  function test_is_float_divide() {
    const Z = v('Z');
    const {count, result} = callOne('quot', [10, 4, Z]);
    eval(TEST('count === 1'));
    eval(TEST('result[2] === 2.5'));
  },
  function test_is_integer_divide() {
    const Z = v('Z');
    const {count, result} = callOne('intdiv', [10, 3, Z]);
    eval(TEST('count === 1'));
    eval(TEST('result[2] === 3'));
  },
  function test_is_modulo_positive() {
    const Z = v('Z');
    const {count, result} = callOne('modulo', [10, 3, Z]);
    eval(TEST('count === 1'));
    eval(TEST('result[2] === 1'));
  },
  function test_is_modulo_negative() {
    const Z = v('Z');
    const {count, result} = callOne('modulo', [-1, 5, Z]);
    eval(TEST('count === 1'));
    eval(TEST('result[2] === 4'));
  },
  function test_is_nested_expr() {
    const R = v('R');
    const {count, result} = callOne('nested', [2, 3, 4, R]);
    eval(TEST('count === 1'));
    eval(TEST('result[3] === 20'));
  },
  function test_is_precedence_mul_before_add() {
    const R = v('R');
    const {count, result} = callOne('precedence', [2, 3, 4, R]);
    eval(TEST('count === 1'));
    eval(TEST('result[3] === 14'));
  },
  function test_is_unary_minus() {
    const R = v('R');
    const {count, result} = callOne('unary', [5, R]);
    eval(TEST('count === 1'));
    eval(TEST('result[1] === -5'));
  },
  function test_is_abs() {
    const R = v('R');
    const {count, result} = callOne('absVal', [-7, R]);
    eval(TEST('count === 1'));
    eval(TEST('result[1] === 7'));
  },
  function test_is_sqrt() {
    const R = v('R');
    const {count, result} = callOne('sqrtVal', [16, R]);
    eval(TEST('count === 1'));
    eval(TEST('result[1] === 4'));
  },
  function test_is_verify_match() {
    const {count} = callOne('forward', [3, 4, 7]);
    eval(TEST('count === 1'));
  },
  function test_is_verify_mismatch_fails() {
    const {count} = callOne('forward', [3, 4, 8]);
    eval(TEST('count === 0'));
  },
  function test_aritheq_match() {
    const r = prolog`q :- 2 + 2 =:= 4.`;
    let count = 0;
    solve({...systemRules, ...mathRules, ...r}, 'q', [], () => ++count);
    eval(TEST('count === 1'));
  },
  function test_aritheq_mismatch() {
    const r = prolog`q :- 2 + 2 =:= 5.`;
    let count = 0;
    solve({...systemRules, ...mathRules, ...r}, 'q', [], () => ++count);
    eval(TEST('count === 0'));
  },
  function test_arithneq_match() {
    const r = prolog`q :- 2 + 2 =\\= 5.`;
    let count = 0;
    solve({...systemRules, ...mathRules, ...r}, 'q', [], () => ++count);
    eval(TEST('count === 1'));
  },
  function test_arithneq_mismatch() {
    const r = prolog`q :- 2 + 2 =\\= 4.`;
    let count = 0;
    solve({...systemRules, ...mathRules, ...r}, 'q', [], () => ++count);
    eval(TEST('count === 0'));
  },
  function test_aritheq_distinguishes_from_unification_eq() {
    // Plain '=' (unification) cannot evaluate; '=:=' must.
    const r = prolog`q :- X = 7, X =:= 3 + 4.`;
    let count = 0;
    solve({...systemRules, ...mathRules, ...r}, 'q', [], () => ++count);
    eval(TEST('count === 1'));
  }
];
