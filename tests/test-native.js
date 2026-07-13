import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {rules as nativeRules} from '../src/rules/native.js';
import {Var, Lit} from '../src/compile/ir.js';
import {lowerRules} from '../src/compile/lower.js';
import {rule, clause} from '../src/compile/clause.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

export default [
  // ---------------------------------------------------------------------------
  // Type tests
  function test_isArray() {
    let r = [];
    solve(nativeRules, 'isArray', [[1, 2]], () => r.push('arr'));
    solve(nativeRules, 'isArray', ['hello'], () => r.push('str'));
    solve(nativeRules, 'isArray', [{a: 1}], () => r.push('obj'));
    eval(TEST('unify(r, ["arr"])'));
  },
  function test_isMap() {
    let r = [];
    solve(nativeRules, 'isMap', [new Map()], () => r.push('map'));
    solve(nativeRules, 'isMap', [{}], () => r.push('plain'));
    solve(nativeRules, 'isMap', [new Set()], () => r.push('set'));
    eval(TEST('unify(r, ["map"])'));
  },
  function test_isSet() {
    let r = [];
    solve(nativeRules, 'isSet', [new Set()], () => r.push('set'));
    solve(nativeRules, 'isSet', [[]], () => r.push('arr'));
    eval(TEST('unify(r, ["set"])'));
  },
  function test_isDate() {
    let r = [];
    solve(nativeRules, 'isDate', [new Date()], () => r.push('date'));
    solve(nativeRules, 'isDate', [Date.now()], () => r.push('num'));
    eval(TEST('unify(r, ["date"])'));
  },
  function test_isType_unbound_fails() {
    const X = v('X'),
      r = [];
    solve(nativeRules, 'isArray', [X], () => r.push(true));
    solve(nativeRules, 'isMap', [X], () => r.push(true));
    solve(nativeRules, 'isSet', [X], () => r.push(true));
    solve(nativeRules, 'isDate', [X], () => r.push(true));
    eval(TEST('unify(r, [])'));
  },
  // ---------------------------------------------------------------------------
  // Array
  function test_arrayList_array_to_list() {
    const L = v('L'),
      result = [];
    solve(nativeRules, 'arrayList', [[1, 2, 3], L], env => result.push(assemble(L, env)));
    eval(TEST('unify(result, [makeList([1, 2, 3])])'));
  },
  function test_arrayList_list_to_array() {
    const A = v('A'),
      result = [];
    solve(nativeRules, 'arrayList', [A, makeList([10, 20, 30])], env => result.push(assemble(A, env)));
    eval(TEST('unify(result, [[10, 20, 30]])'));
  },
  function test_arrayList_empty() {
    const L = v('L');
    let result = [];
    solve(nativeRules, 'arrayList', [[], L], env => result.push(assemble(L, env)));
    eval(TEST('unify(result, [null])'));
    const A = v('A');
    result = [];
    solve(nativeRules, 'arrayList', [A, null], env => result.push(assemble(A, env)));
    eval(TEST('unify(result, [[]])'));
  },
  function test_arrayList_both_bound_match() {
    const result = [];
    solve(nativeRules, 'arrayList', [[1, 2], makeList([1, 2])], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_arrayList_both_bound_mismatch() {
    const result = [];
    solve(nativeRules, 'arrayList', [[1, 2], makeList([1, 3])], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arrayList_both_unbound_fails() {
    const A = v('A'),
      L = v('L'),
      result = [];
    solve(nativeRules, 'arrayList', [A, L], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arrayList_improper_list_fails() {
    const A = v('A'),
      result = [];
    solve(nativeRules, 'arrayList', [A, {value: 1, next: 'oops'}], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arrayList_open_tail_fails() {
    const A = v('A'),
      T = v('T'),
      result = [];
    solve(nativeRules, 'arrayList', [A, {value: 1, next: T}], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arrayGet_in_bounds() {
    const X = v('X'),
      result = [];
    solve(nativeRules, 'arrayGet', [[10, 20, 30], 1, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [20])'));
  },
  function test_arrayGet_predicate_mode() {
    let result = [];
    solve(nativeRules, 'arrayGet', [[10, 20, 30], 0, 10], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(nativeRules, 'arrayGet', [[10, 20, 30], 0, 99], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arrayGet_out_of_bounds_fails() {
    const X = v('X');
    let result = [];
    solve(nativeRules, 'arrayGet', [[10, 20], 5, X], () => result.push(true));
    eval(TEST('unify(result, [])'));
    result = [];
    solve(nativeRules, 'arrayGet', [[10, 20], -1, X], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arrayGet_unbound_index_fails() {
    const I = v('I'),
      X = v('X'),
      result = [];
    solve(nativeRules, 'arrayGet', [[10, 20], I, X], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arraySet_replace() {
    const Out = v('Out'),
      result = [];
    solve(nativeRules, 'arraySet', [[10, 20, 30], 1, 99, Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [[10, 99, 30]])'));
  },
  function test_arraySet_append_at_end() {
    const Out = v('Out'),
      result = [];
    solve(nativeRules, 'arraySet', [[10, 20], 2, 30, Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [[10, 20, 30]])'));
  },
  function test_arraySet_past_end_fails() {
    const Out = v('Out'),
      result = [];
    solve(nativeRules, 'arraySet', [[10, 20], 5, 99, Out], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arraySet_negative_index_fails() {
    const Out = v('Out'),
      result = [];
    solve(nativeRules, 'arraySet', [[10, 20], -1, 99, Out], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_arraySet_does_not_mutate_input() {
    const orig = [10, 20, 30],
      Out = v('Out');
    solve(nativeRules, 'arraySet', [orig, 1, 99, Out], () => undefined);
    eval(TEST('unify(orig, [10, 20, 30])'));
  },
  function test_arrayLength() {
    const N = v('N'),
      result = [];
    solve(nativeRules, 'arrayLength', [[10, 20, 30], N], env => result.push(assemble(N, env)));
    eval(TEST('unify(result, [3])'));
  },
  function test_arrayLength_empty() {
    const N = v('N'),
      result = [];
    solve(nativeRules, 'arrayLength', [[], N], env => result.push(assemble(N, env)));
    eval(TEST('unify(result, [0])'));
  },
  function test_arrayLength_unbound_fails() {
    const A = v('A'),
      N = v('N'),
      result = [];
    solve(nativeRules, 'arrayLength', [A, N], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  // ---------------------------------------------------------------------------
  // Map
  function test_mapEntries_map_to_list() {
    const Es = v('Es'),
      m = new Map([
        ['a', 1],
        ['b', 2]
      ]),
      result = [];
    solve(nativeRules, 'mapEntries', [m, Es], env => result.push(assemble(Es, env)));
    eval(TEST(`unify(result, [makeList([['a', 1], ['b', 2]])])`));
  },
  function test_mapEntries_list_to_map() {
    const M = v('M'),
      result = [];
    solve(
      nativeRules,
      'mapEntries',
      [
        M,
        makeList([
          ['x', 10],
          ['y', 20]
        ])
      ],
      env => result.push(assemble(M, env))
    );
    eval(TEST(`result.length === 1 && result[0] instanceof Map && result[0].get('x') === 10 && result[0].get('y') === 20`));
  },
  function test_mapEntries_both_bound_order_independent() {
    const m = new Map([
        ['a', 1],
        ['b', 2]
      ]),
      result = [];
    solve(
      nativeRules,
      'mapEntries',
      [
        m,
        makeList([
          ['b', 2],
          ['a', 1]
        ])
      ],
      () => result.push(true)
    );
    eval(TEST('unify(result, [true])'));
  },
  function test_mapEntries_both_unbound_fails() {
    const M = v('M'),
      Es = v('Es'),
      result = [];
    solve(nativeRules, 'mapEntries', [M, Es], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_mapGet_present() {
    const V = v('V'),
      m = new Map([['k', 42]]),
      result = [];
    solve(nativeRules, 'mapGet', [m, 'k', V], env => result.push(assemble(V, env)));
    eval(TEST('unify(result, [42])'));
  },
  function test_mapGet_missing_fails() {
    const V = v('V'),
      m = new Map([['k', 42]]),
      result = [];
    solve(nativeRules, 'mapGet', [m, 'missing', V], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_mapHas() {
    const m = new Map([['k', 1]]);
    let result = [];
    solve(nativeRules, 'mapHas', [m, 'k'], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(nativeRules, 'mapHas', [m, 'nope'], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  // ---------------------------------------------------------------------------
  // Set
  function test_setItems_set_to_list() {
    const Items = v('Items'),
      s = new Set([1, 2, 3]),
      result = [];
    solve(nativeRules, 'setItems', [s, Items], env => result.push(assemble(Items, env)));
    eval(TEST('unify(result, [makeList([1, 2, 3])])'));
  },
  function test_setItems_list_to_set() {
    const S = v('S'),
      result = [];
    solve(nativeRules, 'setItems', [S, makeList([10, 20, 30])], env => result.push(assemble(S, env)));
    eval(TEST(`result.length === 1 && result[0] instanceof Set && result[0].has(10) && result[0].has(20) && result[0].has(30)`));
  },
  function test_setItems_both_unbound_fails() {
    const S = v('S'),
      Items = v('Items'),
      result = [];
    solve(nativeRules, 'setItems', [S, Items], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  function test_setHas() {
    const s = new Set(['a', 'b']);
    let result = [];
    solve(nativeRules, 'setHas', [s, 'a'], () => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(nativeRules, 'setHas', [s, 'c'], () => result.push(true));
    eval(TEST('unify(result, [])'));
  },
  // ---------------------------------------------------------------------------
  // Date
  function test_dateTimestamp_date_to_ms() {
    const Ms = v('Ms'),
      d = new Date(Date.UTC(2026, 4, 9, 12, 0, 0, 0)),
      result = [];
    solve(nativeRules, 'dateTimestamp', [d, Ms], env => result.push(assemble(Ms, env)));
    eval(TEST('unify(result, [d.getTime()])'));
  },
  function test_dateTimestamp_ms_to_date() {
    const D = v('D'),
      ms = Date.UTC(2026, 4, 9, 0, 0, 0, 0),
      result = [];
    solve(nativeRules, 'dateTimestamp', [D, ms], env => result.push(assemble(D, env)));
    eval(TEST('result.length === 1 && result[0] instanceof Date && result[0].getTime() === ms'));
  },
  function test_dateComponents_extract_local() {
    const Y = v('Y'),
      M = v('M'),
      result = [];
    const d = new Date(2026, 4, 9, 14, 30, 0, 0);
    solve(nativeRules, 'dateComponents', [d, {year: Y, month: M}], env => result.push([assemble(Y, env), assemble(M, env)]));
    eval(TEST('unify(result, [[2026, 4]])'));
  },
  function test_dateComponents_construct_local() {
    const D = v('D'),
      result = [];
    solve(nativeRules, 'dateComponents', [D, {year: 2026, month: 4, day: 9}], env => result.push(assemble(D, env)));
    eval(
      TEST('result.length === 1 && result[0] instanceof Date && result[0].getFullYear() === 2026 && result[0].getMonth() === 4 && result[0].getDate() === 9')
    );
  },
  function test_dateComponentsUTC_extract() {
    const Y = v('Y'),
      M = v('M'),
      D = v('D'),
      result = [];
    const d = new Date(Date.UTC(2026, 4, 9, 0, 0, 0, 0));
    solve(nativeRules, 'dateComponentsUTC', [d, {year: Y, month: M, day: D}], env => result.push([assemble(Y, env), assemble(M, env), assemble(D, env)]));
    eval(TEST('unify(result, [[2026, 4, 9]])'));
  },
  function test_dateComponentsUTC_construct() {
    const D = v('D'),
      result = [];
    solve(nativeRules, 'dateComponentsUTC', [D, {year: 2026, month: 4, day: 9}], env => result.push(assemble(D, env)));
    eval(
      TEST(
        'result.length === 1 && result[0] instanceof Date && result[0].getUTCFullYear() === 2026 && result[0].getUTCMonth() === 4 && result[0].getUTCDate() === 9'
      )
    );
  },
  function test_dateComponents_with_lit_walker() {
    // The Lit-walker substitutes Var IR inside the component bag — this
    // is the use case the walker was built for.
    const rules = lowerRules([rule('extractYear', 2)(clause`(D, Y) :- dateComponentsUTC(D, ${Lit({year: Var('Y')})})`)]);
    const Y = v('Y'),
      result = [];
    const d = new Date(Date.UTC(2026, 4, 9));
    solve({...nativeRules, ...rules}, 'extractYear', [d, Y], env => result.push(assemble(Y, env)));
    eval(TEST('unify(result, [2026])'));
  }
];
