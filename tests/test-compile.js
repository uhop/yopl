import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {Rule, Clause, Var, Wild, Lit, Cons, Compound, Call, Cut, Fail, Js} from '../src/compile/ir.js';
import {lowerRules} from '../src/compile/lower.js';
import {validate, validateOrThrow} from '../src/compile/validate.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

export default [
  function test_compile_member() {
    // member(List, Element) — yopl convention (list first; cf. tests/test-solve.js).
    const rules = lowerRules([
      Rule('member', 2, [Clause([Cons(Var('X'), Wild()), Var('X')]), Clause([Cons(Wild(), Var('T')), Var('X')], [Call('member', [Var('T'), Var('X')])])])
    ]);
    const list = makeList([1, 2, 3]),
      X = v('X');
    let result = [];
    solve(rules, 'member', [list, 2], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'member', [list, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  function test_compile_notEq_cut_fail() {
    const rules = lowerRules([Rule('notEq', 2, [Clause([Var('X'), Var('X')], [Cut(), Fail()]), Clause([Wild(), Wild()])])]);
    let result = [];
    solve(rules, 'notEq', [1, 1], () => result.push(true));
    eval(TEST('result.length === 0'));
    result = [];
    solve(rules, 'notEq', [1, 2], () => result.push(true));
    eval(TEST('result.length === 1'));
  },
  function test_compile_dynamic_dispatch() {
    const rules = lowerRules([
      Rule('pos', 1, [
        Clause(
          [Var('X')],
          [
            Js(
              ({X}) =>
                env =>
                  X.isBound(env) && X.get(env) > 0
            )
          ]
        )
      ]),
      Rule('callPred', 2, [Clause([Var('P'), Var('X')], [Call(Var('P'), [Var('X')])])])
    ]);
    let result = [];
    solve(rules, 'callPred', ['pos', 5], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'callPred', ['pos', -1], () => result.push(true));
    eval(TEST('result.length === 0'));
  },
  function test_compile_compound_as_data() {
    const rules = lowerRules([
      Rule('eq', 2, [Clause([Var('X'), Var('X')])]),
      Rule('not', 1, [Clause([Var('X')], [Call(Var('X'), []), Cut(), Fail()]), Clause([Wild()])]),
      Rule('isUnifiable', 2, [Clause([Var('X'), Var('Y')], [Call('not', [Compound('not', [Compound('eq', [Var('X'), Var('Y')])])])])])
    ]);
    let result = [];
    solve(rules, 'isUnifiable', [1, 1], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'isUnifiable', [1, 2], () => result.push(true));
    eval(TEST('result.length === 0'));
    // Double-negation succeeds without preserving the binding — same
    // semantics as system.js's isUnifiable.
    result = [];
    const X = v('X');
    solve(rules, 'isUnifiable', [X, 5], env => result.push(env));
    eval(TEST('result.length === 1'));
  },
  function test_compile_literal_head() {
    const rules = lowerRules([Rule('isZero', 1, [Clause([Lit(0)]), Clause([Wild()], [Fail()])])]);
    let result = [];
    solve(rules, 'isZero', [0], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'isZero', [1], () => result.push(true));
    eval(TEST('result.length === 0'));
  },
  function test_validate_clean_passes() {
    const rules = [
      Rule('member', 2, [Clause([Cons(Var('X'), Wild()), Var('X')]), Clause([Cons(Wild(), Var('T')), Var('X')], [Call('member', [Var('T'), Var('X')])])])
    ];
    const issues = validate(rules);
    eval(TEST('issues.length === 0'));
  },
  function test_validate_arity_mismatch() {
    // Rule arity is 2 but clause head has 3 args. The 2026-05-08 bug-cluster's
    // most direct shape — caught statically here.
    const rules = [Rule('foo', 2, [Clause([Var('X'), Var('Y'), Var('Z')])])];
    const issues = validate(rules);
    eval(TEST("issues.length === 1 && issues[0].kind === 'arity-mismatch'"));
  },
  function test_validate_call_arity_mismatch() {
    // Recursive call missing a predicate arg — same shape as the original
    // filter / map bugs (#2 and #4 from the cluster).
    const rules = [
      Rule('filter', 3, [
        Clause([Wild(), Lit(null), Lit(null)]),
        Clause(
          [Var('P'), Cons(Var('X'), Var('Xt')), Cons(Var('X'), Var('Yt'))],
          [Call('filter', [Var('Xt'), Var('Yt')])] // missing P
        )
      ])
    ];
    const issues = validate(rules);
    eval(TEST("issues.length === 1 && issues[0].kind === 'call-arity-mismatch' && issues[0].target === 'filter'"));
  },
  function test_validate_undeclared_var() {
    // Explicit vars list omits a referenced var. foldl bug B4 in shape.
    const rules = [
      Rule('foldl', 4, [
        Clause(
          [Var('F'), Var('A'), Cons(Var('X'), Var('Xt')), Var('Yt')], // Yt typo (should be O)
          [],
          ['F', 'A', 'X', 'Xt', 'O'] // declared without Yt
        )
      ])
    ];
    const issues = validate(rules);
    eval(TEST("issues.length === 1 && issues[0].kind === 'undeclared-var' && issues[0].var === 'Yt'"));
  },
  function test_validate_duplicate_rule() {
    const rules = [Rule('eq', 2, [Clause([Var('X'), Var('X')])]), Rule('eq', 2, [Clause([Wild(), Wild()])])];
    const issues = validate(rules);
    eval(TEST("issues.length === 1 && issues[0].kind === 'duplicate-rule'"));
  },
  function test_validate_unresolved_rule_optin() {
    const rules = [Rule('foo', 1, [Clause([Var('X')], [Call('bar', [Var('X')])])])];
    // Off by default — passes silently.
    eval(TEST('validate(rules).length === 0'));
    // On with externals declared — passes.
    eval(TEST("validate(rules, {checkRuleReferences: true, knownExternals: ['bar']}).length === 0"));
    // On without externals — flags.
    const issues = validate(rules, {checkRuleReferences: true});
    eval(TEST("issues.length === 1 && issues[0].kind === 'unresolved-rule' && issues[0].target === 'bar'"));
  },
  function test_validate_or_throw() {
    const bad = [Rule('foo', 2, [Clause([Var('X')])])];
    let threw = false;
    try {
      validateOrThrow(bad);
    } catch (e) {
      threw = e.message.includes('arity-mismatch');
    }
    eval(TEST('threw'));
    // Clean rules don't throw.
    const good = [Rule('foo', 1, [Clause([Var('X')])])];
    let cleanThrew = false;
    try {
      validateOrThrow(good);
    } catch {
      cleanThrew = true;
    }
    eval(TEST('!cleanThrew'));
  }
];
