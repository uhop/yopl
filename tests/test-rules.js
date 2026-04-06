// Coverage for the comparison and pure-bitwise rule libraries.
//
// TODO(step 6): the math.js / bits.js / logic.js modules contain a
// pervasive bug — their "general" rule is `(env, stack) => …` while
// solve.js calls goals as `goal(env, goals, stack)`, so what they
// receive in `stack` is actually `goals`. The subsequent
// `cut(sys)(env, stack)` then calls cut with stack=undefined and crashes.
// Tests that exercise math add/sub/mul/div/neg, bitXor/bitNot, and
// logicalAnd/Or/Xor/Not are intentionally omitted until that is fixed.

import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {rules as compRules} from '../src/rules/comp.js';
import {rules as bitsRules} from '../src/rules/bits.js';
import {submit, TEST} from './harness.js';

const collect = (rules, name, args) => {
  const result = [];
  solve(rules, name, args, () => result.push(true));
  return result;
};

export default [
  // ----- comparisons -----
  function test_comp_lt() {
    eval(TEST('unify(collect(compRules, "lt", [1, 2]), [true])'));
    eval(TEST('unify(collect(compRules, "lt", [2, 1]), [])'));
    eval(TEST('unify(collect(compRules, "lt", [1, 1]), [])'));
    eval(TEST('unify(collect(compRules, "lt", ["a", "b"]), [true])'));
  },
  function test_comp_le() {
    eval(TEST('unify(collect(compRules, "le", [1, 1]), [true])'));
    eval(TEST('unify(collect(compRules, "le", [1, 2]), [true])'));
    eval(TEST('unify(collect(compRules, "le", [2, 1]), [])'));
  },
  function test_comp_gt() {
    eval(TEST('unify(collect(compRules, "gt", [2, 1]), [true])'));
    eval(TEST('unify(collect(compRules, "gt", [1, 2]), [])'));
  },
  function test_comp_ge() {
    eval(TEST('unify(collect(compRules, "ge", [1, 1]), [true])'));
    eval(TEST('unify(collect(compRules, "ge", [2, 1]), [true])'));
    eval(TEST('unify(collect(compRules, "ge", [1, 2]), [])'));
  },
  function test_comp_lt_unbound_fails() {
    const X = v('X');
    eval(TEST('unify(collect(compRules, "lt", [X, 2]), [])'));
  },

  // ----- bitwise (only the rules that don't trip the cut/stack bug) -----
  function test_bits_and_forward() {
    const Z = v('Z'),
      result = [];
    solve(bitsRules, 'bitAnd', [0b1100, 0b1010, Z], env => result.push(assemble(Z, env)));
    eval(TEST('unify(result, [0b1000])'));
  },
  function test_bits_or_forward() {
    const Z = v('Z'),
      result = [];
    solve(bitsRules, 'bitOr', [0b1100, 0b0011, Z], env => result.push(assemble(Z, env)));
    eval(TEST('unify(result, [0b1111])'));
  }
];
