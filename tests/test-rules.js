// Coverage for the comparison, arithmetic, bitwise and boolean-logic rule
// libraries. Each reversible rule is exercised in every direction.

import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {rules as compRules} from '../src/rules/comp.js';
import {rules as mathRules} from '../src/rules/math.js';
import {rules as bitsRules} from '../src/rules/bits.js';
import {rules as logicRules} from '../src/rules/logic.js';
import {submit, TEST} from './harness.js';

// Run a goal once and return whatever the inline `each` callback pushes
// into the result array. Defaults to a `true` marker per solution.
const collect = (rules, name, args, each) => {
  const result = [];
  solve(rules, name, args, env => {
    if (each) each(env, result);
    else result.push(true);
  });
  return result;
};

const oneOf = (V, env) => assemble(V, env);

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
  function test_comp_lt_mixed_types_fails() {
    eval(TEST('unify(collect(compRules, "lt", [1, "b"]), [])'));
  },
  function test_comp_nz() {
    eval(TEST('unify(collect(compRules, "nz", [1]), [true])'));
    eval(TEST('unify(collect(compRules, "nz", [42]), [true])'));
    eval(TEST('unify(collect(compRules, "nz", [0]), [])'));
  },

  // ----- arithmetic forward (X,Y → Z) -----
  function test_math_add_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(mathRules, "add", [2, 3, Z], (e, r) => r.push(oneOf(Z, e))), [5])'));
  },
  function test_math_sub_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(mathRules, "sub", [10, 4, Z], (e, r) => r.push(oneOf(Z, e))), [6])'));
  },
  function test_math_mul_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(mathRules, "mul", [3, 4, Z], (e, r) => r.push(oneOf(Z, e))), [12])'));
  },
  function test_math_div_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(mathRules, "div", [20, 4, Z], (e, r) => r.push(oneOf(Z, e))), [5])'));
  },
  function test_math_neg_forward() {
    const Y = v('Y');
    eval(TEST('unify(collect(mathRules, "neg", [3, Y], (e, r) => r.push(oneOf(Y, e))), [-3])'));
  },

  // ----- arithmetic reverse (X,Z → Y) -----
  function test_math_add_reverse_y() {
    const Y = v('Y');
    eval(TEST('unify(collect(mathRules, "add", [2, Y, 5], (e, r) => r.push(oneOf(Y, e))), [3])'));
  },
  function test_math_sub_reverse_y() {
    const Y = v('Y');
    eval(TEST('unify(collect(mathRules, "sub", [10, Y, 6], (e, r) => r.push(oneOf(Y, e))), [4])'));
  },
  function test_math_mul_reverse_y() {
    const Y = v('Y');
    eval(TEST('unify(collect(mathRules, "mul", [3, Y, 12], (e, r) => r.push(oneOf(Y, e))), [4])'));
  },
  function test_math_div_reverse_y() {
    const Y = v('Y');
    eval(TEST('unify(collect(mathRules, "div", [20, Y, 5], (e, r) => r.push(oneOf(Y, e))), [4])'));
  },

  // ----- arithmetic reverse (Y,Z → X) -----
  function test_math_add_reverse_x() {
    const X = v('X');
    eval(TEST('unify(collect(mathRules, "add", [X, 3, 5], (e, r) => r.push(oneOf(X, e))), [2])'));
  },
  function test_math_sub_reverse_x() {
    const X = v('X');
    eval(TEST('unify(collect(mathRules, "sub", [X, 4, 6], (e, r) => r.push(oneOf(X, e))), [10])'));
  },
  function test_math_mul_reverse_x() {
    const X = v('X');
    eval(TEST('unify(collect(mathRules, "mul", [X, 4, 12], (e, r) => r.push(oneOf(X, e))), [3])'));
  },
  function test_math_div_reverse_x() {
    const X = v('X');
    eval(TEST('unify(collect(mathRules, "div", [X, 4, 5], (e, r) => r.push(oneOf(X, e))), [20])'));
  },
  function test_math_neg_reverse() {
    const X = v('X');
    eval(TEST('unify(collect(mathRules, "neg", [X, 3], (e, r) => r.push(oneOf(X, e))), [-3])'));
  },

  // ----- arithmetic check (all 3 bound) -----
  function test_math_add_check_true() {
    eval(TEST('unify(collect(mathRules, "add", [2, 3, 5]), [true])'));
  },
  function test_math_add_check_false() {
    eval(TEST('unify(collect(mathRules, "add", [2, 3, 6]), [])'));
  },
  function test_math_mul_check_true() {
    eval(TEST('unify(collect(mathRules, "mul", [3, 4, 12]), [true])'));
  },

  // ----- arithmetic shortcut clauses -----
  function test_math_add_zero_shortcut() {
    // 0 + Y = Y and X + 0 = X are extra clauses that produce additional solutions.
    const Z = v('Z');
    const result = collect(mathRules, 'add', [0, 7, Z], (e, r) => r.push(oneOf(Z, e)));
    // The general clause produces 7; the (0, Y, Y) clause also produces 7.
    eval(TEST('result.length >= 1 && result[0] === 7'));
  },
  function test_math_neg_zero_shortcut() {
    // The general clause cuts after success, so the (0, 0) shortcut is
    // unreachable; only one solution is observed.
    eval(TEST('unify(collect(mathRules, "neg", [0, 0]), [true])'));
  },

  // ----- bitwise -----
  function test_bits_and_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(bitsRules, "bitAnd", [0b1100, 0b1010, Z], (e, r) => r.push(oneOf(Z, e))), [0b1000])'));
  },
  function test_bits_or_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(bitsRules, "bitOr", [0b1100, 0b0011, Z], (e, r) => r.push(oneOf(Z, e))), [0b1111])'));
  },
  function test_bits_xor_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(bitsRules, "bitXor", [0b1100, 0b1010, Z], (e, r) => r.push(oneOf(Z, e))), [0b0110])'));
  },
  function test_bits_xor_reverse_y() {
    const Y = v('Y');
    eval(TEST('unify(collect(bitsRules, "bitXor", [0b1100, Y, 0b0110], (e, r) => r.push(oneOf(Y, e))), [0b1010])'));
  },
  function test_bits_xor_reverse_x() {
    const X = v('X');
    eval(TEST('unify(collect(bitsRules, "bitXor", [X, 0b1010, 0b0110], (e, r) => r.push(oneOf(X, e))), [0b1100])'));
  },
  function test_bits_xor_check() {
    eval(TEST('unify(collect(bitsRules, "bitXor", [0b1100, 0b1010, 0b0110]), [true])'));
  },
  function test_bits_and_check_true() {
    eval(TEST('unify(collect(bitsRules, "bitAnd", [0b1100, 0b1010, 0b1000]), [true])'));
  },
  function test_bits_and_check_false() {
    eval(TEST('unify(collect(bitsRules, "bitAnd", [0b1100, 0b1010, 0b1111]), [])'));
  },
  function test_bits_and_reverse_unsupported() {
    // bitAnd does not enumerate reverse solutions — multiple X satisfy
    // X & 0b1010 = 0b1000, so the rule deliberately returns no solutions
    // when the input is unbound.
    const X = v('X');
    eval(TEST('unify(collect(bitsRules, "bitAnd", [X, 0b1010, 0b1000]), [])'));
  },
  function test_bits_or_check_true() {
    eval(TEST('unify(collect(bitsRules, "bitOr", [0b1100, 0b0011, 0b1111]), [true])'));
  },
  function test_bits_or_check_false() {
    eval(TEST('unify(collect(bitsRules, "bitOr", [0b1100, 0b0011, 0b1110]), [])'));
  },
  function test_bits_or_reverse_unsupported() {
    // Same convention as bitAnd: reverse mode returns no solutions.
    const X = v('X');
    eval(TEST('unify(collect(bitsRules, "bitOr", [X, 0b0011, 0b1111]), [])'));
  },
  function test_bits_not_forward() {
    const Y = v('Y');
    eval(TEST('unify(collect(bitsRules, "bitNot", [0b1010, Y], (e, r) => r.push(oneOf(Y, e))), [~0b1010])'));
  },
  function test_bits_not_reverse() {
    const X = v('X');
    eval(TEST('unify(collect(bitsRules, "bitNot", [X, 0b1010], (e, r) => r.push(oneOf(X, e))), [~0b1010])'));
  },

  // ----- boolean logic -----
  function test_logic_and_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(logicRules, "logicalAnd", [true, true, Z], (e, r) => r.push(oneOf(Z, e))), [true])'));
    const Z2 = v('Z2');
    eval(TEST('unify(collect(logicRules, "logicalAnd", [true, false, Z2], (e, r) => r.push(oneOf(Z2, e))), [false])'));
  },
  function test_logic_and_check() {
    eval(TEST('unify(collect(logicRules, "logicalAnd", [true, true, true]), [true])'));
    eval(TEST('unify(collect(logicRules, "logicalAnd", [true, true, false]), [])'));
  },
  function test_logic_or_forward() {
    const Z = v('Z');
    eval(TEST('unify(collect(logicRules, "logicalOr", [false, false, Z], (e, r) => r.push(oneOf(Z, e))), [false])'));
    const Z2 = v('Z2');
    eval(TEST('unify(collect(logicRules, "logicalOr", [true, false, Z2], (e, r) => r.push(oneOf(Z2, e))), [true])'));
  },
  function test_logic_xor_all_directions() {
    const Z = v('Z');
    eval(TEST('unify(collect(logicRules, "logicalXor", [true, false, Z], (e, r) => r.push(oneOf(Z, e))), [true])'));
    const Y = v('Y');
    eval(TEST('unify(collect(logicRules, "logicalXor", [true, Y, true], (e, r) => r.push(oneOf(Y, e))), [false])'));
    const X = v('X');
    eval(TEST('unify(collect(logicRules, "logicalXor", [X, false, true], (e, r) => r.push(oneOf(X, e))), [true])'));
  },
  function test_logic_not_both_directions() {
    const Y = v('Y');
    eval(TEST('unify(collect(logicRules, "logicalNot", [true, Y], (e, r) => r.push(oneOf(Y, e))), [false])'));
    const X = v('X');
    eval(TEST('unify(collect(logicRules, "logicalNot", [X, true], (e, r) => r.push(oneOf(X, e))), [false])'));
  },
  function test_logic_not_check() {
    eval(TEST('unify(collect(logicRules, "logicalNot", [true, false]), [true])'));
    eval(TEST('unify(collect(logicRules, "logicalNot", [true, true]), [])'));
  }
];
