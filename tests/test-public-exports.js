// Verify the public subpath exports resolve and surface the expected
// API. Imports use the package name (`yopl/...`) — Node's
// own-package resolution routes them through `package.json#exports`,
// matching what an external consumer would see.
//
// Each new entry added to `exports` should get a smoke test here:
// confirms the subpath resolves AND the named bindings are present.

import {
  Var,
  Wild,
  Lit,
  Cons,
  Compound,
  List,
  Call,
  Cut,
  Fail,
  Js,
  Clause,
  Rule,
  IR,
  IR_KINDS,
  collectVars,
  lowerRule,
  lowerRules,
  validate,
  validateOrThrow,
  open,
  soft,
  _,
  any
} from 'yopl/compile';
import {rule, clause} from 'yopl/compile/clause.js';
import {prolog, prologClause} from 'yopl/compile/prolog';

import solve from 'yopl';
import {rules as systemRules} from 'yopl/rules/system.js';

import {submit, TEST} from './harness.js';

export default [
  function test_public_compile_barrel_ir_constructors() {
    // Spot-check each public IR constructor produces the documented shape.
    eval(TEST("Var('X').kind === 'var' && Var('X').name === 'X'"));
    eval(TEST("Wild().kind === 'wildcard'"));
    eval(TEST("Lit(42).kind === 'literal' && Lit(42).value === 42"));
    eval(TEST("Cons(Lit(1), Lit(null)).kind === 'cons'"));
    eval(TEST("Compound('foo', [Var('X')]).kind === 'compound'"));
    eval(TEST("Call('member', [Var('X')]).kind === 'call'"));
    eval(TEST("Cut().kind === 'cut'"));
    eval(TEST("Fail().kind === 'fail'"));
    eval(TEST("Js(() => () => true).kind === 'js'"));
    eval(TEST("Clause([Var('X')]).head.length === 1"));
    eval(TEST("Rule('foo', 1, []).name === 'foo'"));
    eval(TEST('typeof IR === "symbol" && IR === Symbol.for("yopl.ir")'));
    eval(TEST('IR_KINDS.has("var") && IR_KINDS.has("compound")'));
  },

  function test_public_compile_barrel_helpers() {
    const c = Clause([Var('X'), Var('Y')], [Call('eq', [Var('X'), Var('Y')])]);
    const vars = collectVars(c);
    eval(TEST('Array.isArray(vars) && vars.includes("X") && vars.includes("Y")'));
  },

  function test_public_compile_barrel_lowering_round_trip() {
    const r = Rule('eq', 2, [Clause([Var('X'), Var('X')], [])]);
    const lowered = lowerRule(r);
    eval(TEST('Array.isArray(lowered) && typeof lowered[0] === "function"'));
    const dict = lowerRules([r]);
    eval(TEST('typeof dict.eq !== "undefined"'));
  },

  function test_public_compile_barrel_validate() {
    const r = Rule('foo', 2, [Clause([Var('X')], [])]); // arity mismatch
    const issues = validate([r]);
    eval(TEST('Array.isArray(issues) && issues.length > 0'));
    eval(TEST('issues.some(i => i.kind === "arity-mismatch")'));
    let threw = false;
    try {
      validateOrThrow([r]);
    } catch {
      threw = true;
    }
    eval(TEST('threw'));
  },

  function test_public_compile_barrel_deep6_re_exports() {
    // open / soft / _ / any are passed through from deep6 — confirm
    // they're functions / sentinels, not undefined.
    eval(TEST('typeof open === "function"'));
    eval(TEST('typeof soft === "function"'));
    eval(TEST('typeof _ !== "undefined"'));
    eval(TEST('any === _'));
  },

  function test_public_compile_clause_subpath() {
    const c = clause`(X, [X | _])`;
    eval(TEST('c.head.length === 2'));
    const r = rule('member', 2)(c);
    eval(TEST('r.name === "member" && r.arity === 2'));
  },

  function test_public_compile_prolog_tag_form() {
    const dict = prolog`green. red.`;
    eval(TEST('typeof dict.green !== "undefined" && typeof dict.red !== "undefined"'));
    eval(TEST('dict[IR] && dict[IR].green && dict[IR].green.name === "green"'));
  },

  function test_public_compile_prolog_lower_false() {
    const ir = prolog.with({lower: false})`eq(X, X).`;
    eval(TEST('ir.eq && ir.eq.name === "eq" && ir.eq.arity === 2'));
    eval(TEST('Array.isArray(ir.eq.clauses) && ir.eq.clauses.length === 1'));
  },

  function test_public_compile_prolog_function_form() {
    const dict = prolog('green. red.');
    eval(TEST('typeof dict.green !== "undefined" && typeof dict.red !== "undefined"'));
    const ir = prolog('eq(X, X).', {lower: false});
    eval(TEST('ir.eq && ir.eq.arity === 2'));
  },

  function test_public_compile_prolog_configurator_form() {
    const customTag = prolog.with({lower: false});
    const ir = customTag`foo(X) :- bar(X).`;
    eval(TEST('ir.foo && ir.foo.name === "foo"'));
  },

  function test_public_compile_prologClause_single_clause() {
    const c = prologClause`member(X, [X | _])`;
    eval(TEST('c.name === "member" && c.head.length === 2'));
  },

  function test_public_main_entry_solves() {
    // The default `yopl` import resolves to the sync solver. Use
    // alongside the published rule library to confirm the whole
    // chain — package main, rules, compile barrel — works through
    // the public paths.
    const result = [];
    solve(systemRules, 'true', [], () => result.push(true));
    eval(TEST('result.length === 1'));
  }
];
