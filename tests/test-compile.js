import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {Rule, Clause, Var, Wild, Lit, Cons, Compound, Call, Cut, Fail, Js, open, soft, _ as anyVal} from '../src/compile/ir.js';
import {lowerRules} from '../src/compile/lower.js';
import {validate, validateOrThrow} from '../src/compile/validate.js';
import {rule, clause} from '../src/compile/clause/index.js';
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
  function test_clause_member_via_template() {
    // Same member rule as test_compile_member, written via the template DSL.
    const member = rule('member', 2)(clause`([X | _], X)`, clause`([_ | T], X) :- member(T, X)`);
    const rules = lowerRules([member]);
    const list = makeList([1, 2, 3]),
      X = v('X');
    let result = [];
    solve(rules, 'member', [list, 2], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'member', [list, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  function test_clause_cut_fail_literal() {
    // notEq via template: covers cut + fail + literal-bare keywords.
    const notEq = rule('notEq', 2)(clause`(X, X) :- !, fail`, clause`(_, _)`);
    const rules = lowerRules([notEq]);
    let result = [];
    solve(rules, 'notEq', [1, 1], () => result.push(true));
    eval(TEST('result.length === 0'));
    result = [];
    solve(rules, 'notEq', [1, 2], () => result.push(true));
    eval(TEST('result.length === 1'));
  },
  function test_clause_compound_and_numbers() {
    // isUnifiable via template: covers compound terms as data + interpolation
    // is unnecessary because all atoms (eq, not) are static identifiers.
    const rules = lowerRules([
      rule('eq', 2)(clause`(X, X)`),
      rule('not', 1)(clause`(X) :- X, !, fail`, clause`(_)`),
      rule('isUnifiable', 2)(clause`(X, Y) :- not(not(eq(X, Y)))`)
    ]);
    let result = [];
    solve(rules, 'isUnifiable', [1, 1], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'isUnifiable', [1, 2], () => result.push(true));
    eval(TEST('result.length === 0'));
  },
  function test_clause_literal_keywords_in_head() {
    // null / true / false / numbers as bare literals in head.
    const rules = lowerRules([rule('isZero', 1)(clause`(0)`), rule('isNullArg', 1)(clause`(null)`), rule('isTrueArg', 1)(clause`(true)`)]);
    let result = [];
    solve(rules, 'isZero', [0], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'isZero', [1], () => result.push(true));
    eval(TEST('result.length === 0'));
    result = [];
    solve(rules, 'isNullArg', [null], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'isTrueArg', [true], () => result.push(true));
    eval(TEST('result.length === 1'));
  },
  function test_clause_dynamic_dispatch_via_template() {
    // Uppercase identifier in goal-name position lowers to dynamic call.
    const rules = lowerRules([
      rule(
        'pos',
        1
      )(
        clause`(X) :- ${Js(
          ({X}) =>
            env =>
              X.isBound(env) && X.get(env) > 0
        )}`
      ),
      rule('callPred', 2)(clause`(P, X) :- P(X)`)
    ]);
    let result = [];
    solve(rules, 'callPred', ['pos', 5], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'callPred', ['pos', -1], () => result.push(true));
    eval(TEST('result.length === 0'));
  },
  function test_clause_validate_catches_bug_class() {
    // The compiler catches arity drift in template-authored rules.
    const broken = rule('foo', 2)(clause`(X, Y, Z)`); // arity 2 but head has 3
    const issues = validate([broken]);
    eval(TEST("issues.length === 1 && issues[0].kind === 'arity-mismatch'"));
  },
  function test_clause_interp_primitive_autowrap() {
    // Bare primitives in arg position auto-wrap to Lit().
    const seven = 7;
    const rules = lowerRules([rule('isSeven', 1)(clause`(${seven})`)]);
    let result = [];
    solve(rules, 'isSeven', [7], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'isSeven', [8], () => result.push(true));
    eval(TEST('result.length === 0'));
  },
  function test_clause_interp_function_autowrap_js() {
    // Bare functions in goal position auto-wrap to Js(fn).
    const isPositive =
      ({X}) =>
      env =>
        X.isBound(env) && X.get(env) > 0;
    const rules = lowerRules([rule('pos', 1)(clause`(X) :- ${isPositive}`)]);
    let result = [];
    solve(rules, 'pos', [5], () => result.push(true));
    eval(TEST('result.length === 1'));
    result = [];
    solve(rules, 'pos', [-1], () => result.push(true));
    eval(TEST('result.length === 0'));
  },
  function test_clause_interp_rejects_plain_object_in_arg() {
    let threw = false;
    try {
      clause`(${{name: 'foo', args: []}})`;
    } catch (e) {
      threw = e.message.includes('arg position');
    }
    eval(TEST('threw'));
  },
  function test_clause_interp_rejects_function_in_arg() {
    let threw = false;
    try {
      clause`(${() => 42})`;
    } catch (e) {
      threw = e.message.includes('arg position');
    }
    eval(TEST('threw'));
  },
  function test_clause_interp_rejects_primitive_in_goal() {
    let threw = false;
    try {
      clause`(X) :- ${42}`;
    } catch (e) {
      threw = e.message.includes('goal position');
    }
    eval(TEST('threw'));
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
  },
  function test_ir_reexports_open_lit_subset() {
    // `open()` re-exported from yopl/compile/ir.js wraps a value so it
    // matches subset-style regardless of env.options. Verifies the
    // re-export surface composes with `Lit`.
    const rules = lowerRules([rule('item', 1)(clause`(${Lit(open({tag: 'a'}))})`)]);
    let result = [];
    solve(rules, 'item', [{tag: 'a', extra: 1}], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_ir_reexports_soft_lit_extends() {
    // `soft()` extends both sides with each other's keys after unification.
    // Smoke-test the re-export and that the wrap survives Lit.
    const rules = lowerRules([rule('row', 1)(clause`(${Lit(soft({a: 1}))})`)]);
    const result = [];
    solve(rules, 'row', [{b: 2}], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_ir_reexport_anyVal() {
    // `_` (re-exported as `any` too) is the deep6 match-anything sentinel.
    // Inside a Lit, it should accept any value at that slot.
    const rules = lowerRules([rule('rec', 1)(clause`(${Lit({age: anyVal})})`)]);
    const result = [];
    solve(rules, 'rec', [{age: 99}], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_lit_walker_var_in_object() {
    // Lit-walker substitutes nested Var IR with fresh activation Variables.
    // `Var('A')` inside a Lit-wrapped object binds the `age` field per call.
    const rules = lowerRules([rule('age', 2)(clause`(${Lit({age: Var('A')})}, A)`)]);
    const A = v('A'),
      result = [];
    solve(rules, 'age', [{age: 30}, A], env => result.push(assemble(A, env)));
    eval(TEST('unify(result, [30])'));
  },
  function test_lit_walker_var_in_array() {
    // Walker descends into arrays too — Vars inside array slots substitute.
    const rules = lowerRules([rule('snd', 2)(clause`(${Lit([1, Var('X')])}, X)`)]);
    const X = v('X'),
      result = [];
    solve(rules, 'snd', [[1, 99], X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [99])'));
  },
  function test_lit_walker_nested_structure() {
    // Walker descends through object-inside-array, array-inside-object, etc.
    const rules = lowerRules([rule('deep', 2)(clause`(${Lit({rows: [{n: Var('N')}]})}, N)`)]);
    const N = v('N'),
      result = [];
    solve(rules, 'deep', [{rows: [{n: 7}]}, N], env => result.push(assemble(N, env)));
    eval(TEST('unify(result, [7])'));
  },
  function test_lit_walker_anonymous_var_via_Var_no_arg() {
    // `Var()` mints a Symbol-named anonymous variable; two calls produce
    // distinct vars; the walker substitutes them per activation.
    const X = Var(),
      Y = Var();
    const rules = lowerRules([rule('pair', 2)(clause`(${Lit({a: X, b: Y})}, ${Lit([X, Y])})`)]);
    const Out = v('Out'),
      result = [];
    solve(rules, 'pair', [{a: 1, b: 2}, Out], env => result.push(assemble(Out, env)));
    eval(TEST('unify(result, [[1, 2]])'));
  },
  function test_lit_walker_does_not_misread_user_kind_field() {
    // A user object with a `kind` field that's NOT one of the IR kinds is
    // domain data; the walker leaves it alone.
    const rules = lowerRules([rule('evt', 1)(clause`(${Lit({kind: 'click', x: 10})})`)]);
    const result = [];
    solve(rules, 'evt', [{kind: 'click', x: 10}], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  },
  function test_lit_walker_does_not_walk_class_instances() {
    // Wrap-wrapped values from open()/soft() have a custom prototype;
    // walker leaves them as-is so deep6's per-value match-mode wrappers
    // continue to work end-to-end.
    const rules = lowerRules([rule('o', 1)(clause`(${Lit(open({a: 1}))})`)]);
    const result = [];
    solve(rules, 'o', [{a: 1, b: 2}], () => result.push(true));
    eval(TEST('unify(result, [true])'));
  }
];
