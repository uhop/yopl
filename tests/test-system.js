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
  },
  function test_null_rule_silently_fails() {
    // An explicit `null` rule entry means "no clauses" and silently fails
    // (zero solutions, no throw). Same behaviour as `undefined` per the
    // existing `test_solve_no_match` / `test_solve_unknown_subgoal` spec —
    // recorded here to pin the explicit-null sentinel form.
    const result = [];
    solve({silenced: null}, 'silenced', [], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_higher_order_map_applies_predicate() {
    // map(inc, [1, 2, 3], Out) → Out = [2, 3, 4].
    const rules = {
      ...systemRules,
      inc: (X, Y) => [
        head(X, Y),
        env => {
          env.bindVal(Y.name, X.get(env) + 1);
          return true;
        }
      ]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'map', ['inc', list(1, 2, 3), Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [makeList([2, 3, 4])])'));
  },
  function test_higher_order_filter_drops_failing() {
    // filter(isEven, [1, 2, 3, 4], Out) → Out = [2, 4].
    // Repro: before the system.js:127 fix, the reject clause kept the
    // failing element instead of dropping it, so Out came back as [1,2,3,4].
    const rules = {
      ...systemRules,
      isEven: X => [head(X), env => X.isBound(env) && X.get(env) % 2 === 0]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'filter', ['isEven', list(1, 2, 3, 4), Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [makeList([2, 4])])'));
  },
  function test_higher_order_filter_empty() {
    // filter on an empty list returns the empty list.
    const rules = {
      ...systemRules,
      isEven: X => [head(X), env => X.isBound(env) && X.get(env) % 2 === 0]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'filter', ['isEven', null, Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [null])'));
  },
  function test_higher_order_filter_all_drop() {
    // filter where the predicate rejects every element returns the empty list.
    const rules = {
      ...systemRules,
      isEven: X => [head(X), env => X.isBound(env) && X.get(env) % 2 === 0]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'filter', ['isEven', list(1, 3, 5), Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [null])'));
  },
  function test_higher_order_foldl_sum() {
    // foldl(add, 0, [1, 2, 3], Out) → Out = ((0+1)+2)+3 = 6.
    const rules = {
      ...systemRules,
      add: (A, X, B) => [
        head(A, X, B),
        env => {
          env.bindVal(B.name, A.get(env) + X.get(env));
          return true;
        }
      ]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'foldl', ['add', 0, list(1, 2, 3), Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [6])'));
  },
  function test_higher_order_foldr_sum() {
    // foldr(add, 0, [1, 2, 3], Out) — note arg order: foldr passes (X, A, B).
    const rules = {
      ...systemRules,
      add: (X, A, B) => [
        head(X, A, B),
        env => {
          env.bindVal(B.name, X.get(env) + A.get(env));
          return true;
        }
      ]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'foldr', ['add', 0, list(1, 2, 3), Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [6])'));
  },
  function test_higher_order_compose() {
    // compose(inc, double, 5, Out) → inc(double(5)) = inc(10) = 11.
    const rules = {
      ...systemRules,
      inc: (X, Y) => [
        head(X, Y),
        env => {
          env.bindVal(Y.name, X.get(env) + 1);
          return true;
        }
      ],
      double: (X, Y) => [
        head(X, Y),
        env => {
          env.bindVal(Y.name, X.get(env) * 2);
          return true;
        }
      ]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'compose', ['inc', 'double', 5, Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [11])'));
  },
  function test_higher_order_converse() {
    // converse(F)(X, Y, O) = F(Y, X, O); converse(sub, 3, 10, R) = sub(10, 3, R) = 7.
    const rules = {
      ...systemRules,
      sub: (A, B, R) => [
        head(A, B, R),
        env => {
          env.bindVal(R.name, A.get(env) - B.get(env));
          return true;
        }
      ]
    };
    const Out = v('Out'),
      result = [];
    solve(rules, 'converse', ['sub', 3, 10, Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [7])'));
  },
  function test_higher_order_conjunction() {
    // conjunction([eq(1,1), eq(2,2)]) succeeds; one failure aborts.
    let result = [];
    solve(systemRules, 'conjunction', [list(term('eq', 1, 1), term('eq', 2, 2))], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(systemRules, 'conjunction', [list(term('eq', 1, 1), term('eq', 1, 2))], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_higher_order_disjunction() {
    // disjunction succeeds if any element succeeds; fails if all fail.
    let result = [];
    solve(systemRules, 'disjunction', [list(term('eq', 1, 2), term('eq', 1, 1))], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(systemRules, 'disjunction', [list(term('eq', 1, 2), term('eq', 3, 4))], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_higher_order_once() {
    // once wraps call+cut: yields the first solution only, suppressing
    // backtracking through alternatives.
    const rules = {
      ...systemRules,
      pick: [() => [head(10)], () => [head(20)], () => [head(30)]]
    };
    const X = v('X'),
      result = [];
    solve(rules, 'once', [term('pick', X)], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [10])'));
  },
  function test_higher_order_counterExample() {
    // counterExample(A, B) holds when A succeeds and B fails — A is a
    // witness for which B is false.
    let result = [];
    solve(systemRules, 'counterExample', [term('eq', 1, 1), term('eq', 1, 2)], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(systemRules, 'counterExample', [term('eq', 1, 1), term('eq', 1, 1)], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_higher_order_implies() {
    // implies(A, B) holds when there is no counterexample to "A → B".
    let result = [];
    solve(systemRules, 'implies', [term('eq', 1, 1), term('eq', 1, 1)], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(systemRules, 'implies', [term('eq', 1, 1), term('eq', 1, 2)], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_higher_order_isUnifiable() {
    // isUnifiable(X, Y) succeeds iff X and Y are unifiable, but leaves them
    // unbound. Compare with eq, which would commit the binding.
    const X = v('X');
    let result = [];
    solve(systemRules, 'isUnifiable', [X, 7], env => result.push(X.isBound(env) ? 'bound' : 'unbound'));
    eval(TEST('unify(result, ["unbound"])'));
    result = [];
    solve(systemRules, 'isUnifiable', [1, 2], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_unifyOpts_openArrays_subset() {
    // With openArrays: true, [1, 2] unifies with [1, 2, 3] (subset).
    let result = [];
    solve(systemRules, 'unifyOpts', [[1, 2], [1, 2, 3], {openArrays: true}], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    // Without the option, the same query fails (array length mismatch).
    result = [];
    solve(systemRules, 'unifyOpts', [[1, 2], [1, 2, 3], {}], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_unifyOpts_unbound_options_fails() {
    const Opts = v('Opts'),
      result = [];
    solve(systemRules, 'unifyOpts', [1, 1, Opts], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_unifyOpts_non_object_options_fails() {
    const result = [];
    solve(systemRules, 'unifyOpts', [1, 1, 42], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_unifyOpts_restores_env_options() {
    // After a successful unifyOpts call, the env's baseline options must
    // be unchanged — `openArrays` remains the solve()-default (false).
    let captured = null;
    solve(systemRules, 'unifyOpts', [[1, 2], [1, 2, 3], {openArrays: true}], env => (captured = env.options.openArrays));
    eval(TEST('captured === undefined || captured === false'));
  }
];
// JS-bridge tests (Array / Map / Set / Date) live in `tests/test-native.js`.
