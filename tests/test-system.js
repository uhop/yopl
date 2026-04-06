import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import gen from '../src/solvers/gen.js';
import {head, term, list, listHead, rest, call, cut, fail, halt, isBound, rules as systemRules} from '../src/rules/system.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

export default [
  function test_helpers_head_term() {
    eval(TEST('unify(head(1, 2, 3), {args: [1, 2, 3]})'));
    eval(TEST('unify(term("foo", 1, 2), {name: "foo", args: [1, 2]})'));
  },
  function test_helpers_list_empty() {
    eval(TEST('list() === null'));
  },
  function test_helpers_list_basic() {
    eval(TEST('unify(list(1, 2, 3), makeList([1, 2, 3]))'));
  },
  function test_helpers_list_with_rest() {
    // list(a, b, rest(tail)) builds a partial list whose tail is `tail`.
    const tail = {value: 99, next: null};
    eval(TEST('unify(list(1, 2, rest(tail)), {value: 1, next: {value: 2, next: tail}})'));
  },
  function test_helpers_list_rest_in_middle_throws() {
    let caught = false;
    try {
      list(1, rest({}), 2);
    } catch (_e) {
      caught = true;
    }
    eval(TEST('caught'));
  },
  function test_helpers_listHead_throws_on_short_input() {
    let caught = false;
    try {
      listHead(1);
    } catch (_e) {
      caught = true;
    }
    eval(TEST('caught'));
  },
  function test_helpers_listHead_basic() {
    // listHead(1, 2, X) → cons(1, cons(2, X))
    const tail = {marker: true};
    eval(TEST('unify(listHead(1, 2, tail), {value: 1, next: {value: 2, next: tail}})'));
  },
  function test_rule_true() {
    const result = [];
    solve(systemRules, 'true', [], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_rule_eq_succeeds() {
    const X = v('X'),
      result = [];
    solve(systemRules, 'eq', [X, 42], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [42])'));
  },
  function test_rule_eq_fails() {
    const result = [];
    solve(systemRules, 'eq', [1, 2], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_rule_unify_alias() {
    // `unify` is an alias for `eq`.
    const X = v('X'),
      result = [];
    solve(systemRules, 'unify', [X, 7], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [7])'));
  },
  function test_rule_notEq_succeeds() {
    const result = [];
    solve(systemRules, 'notEq', [1, 2], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_rule_notEq_fails() {
    const result = [];
    solve(systemRules, 'notEq', [1, 1], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_rule_isVar_isNonVar() {
    const X = v('X'),
      result = [];
    solve(systemRules, 'isVar', [X], () => result.push('var'));
    solve(systemRules, 'isNonVar', [42], () => result.push('nonvar'));
    eval(TEST('unify(result, ["var", "nonvar"])'));
  },
  function test_rule_isNumber_isString() {
    const result = [];
    solve(systemRules, 'isNumber', [42], () => result.push('n'));
    solve(systemRules, 'isString', ['hi'], () => result.push('s'));
    solve(systemRules, 'isNumber', ['hi'], () => result.push('bad'));
    eval(TEST('unify(result, ["n", "s"])'));
  },
  function test_rule_isNull_isUndefined_isArray() {
    const result = [];
    solve(systemRules, 'isNull', [null], () => result.push('null'));
    solve(systemRules, 'isUndefined', [undefined], () => result.push('undef'));
    solve(systemRules, 'isArray', [[1, 2]], () => result.push('arr'));
    eval(TEST('unify(result, ["null", "undef", "arr"])'));
  },
  function test_rule_call_with_term() {
    // call(term('eq', X, 7)) should bind X to 7.
    const X = v('X'),
      rules = {
        ...systemRules,
        run: () => [head(), call(term('eq', X, 7))]
      },
      result = [];
    solve(rules, 'run', [], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [7])'));
  },
  function test_rule_not_negation_as_failure() {
    const rules = {...systemRules},
      result = [];
    // not(eq(1, 2)) succeeds because eq(1, 2) fails
    solve(rules, 'not', [term('eq', 1, 2)], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    // not(eq(1, 1)) fails
    const result2 = [];
    solve(rules, 'not', [term('eq', 1, 1)], () => result2.push(true));
    eval(TEST('unify(result2, [])'));
  },
  function test_rule_true_alone() {
    // The 'true' rule succeeds with no args.
    const result = [];
    solve(systemRules, 'true', [], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_rule_member_with_cut() {
    // Demonstrate cut: stop after first match for a duplicate-containing list.
    const rules = {
        ...systemRules,
        member: [(V, X, ...sys) => [head(list(V, rest(X)), V), cut(sys)], (V, X) => [head({next: X}, V), term('member', X, V)]]
      },
      result = [];
    solve(rules, 'member', [list(1, 2, 2, 3), 2], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_rule_fail() {
    const result = [];
    // A rule whose body has `fail` produces no solutions.
    const rules = {
      always: () => [head(), fail]
    };
    solve(rules, 'always', [], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_rule_halt_aborts_search() {
    // `halt` is an exception-style abort: when reached, the entire proof
    // search ends and no further (or current) solutions are reported.
    const rules = {
        ab: [() => [head(1)], () => [head(2)]],
        // Place halt before the user-visible work.
        run: X => [head(X), halt, term('ab', X)]
      },
      X = v('X'),
      result = [];
    solve(rules, 'run', [X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [])'));
  },
  function test_rule_isBound() {
    const X = v('X'),
      Y = v('Y'),
      rules = {
        ...systemRules,
        bothBound: (A, B) => [head(A, B), isBound(A, B)]
      };
    let result = [];
    solve(rules, 'bothBound', [1, 2], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(rules, 'bothBound', [X, 2], () => result.push(true));
    eval(TEST('unify(result, [])'));
  }
];
