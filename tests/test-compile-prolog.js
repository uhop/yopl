import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {Var, Wild, Lit, Compound, List, Call, Cut, Fail, Js, IR} from '../src/compile/ir.js';
import {tokenize} from '../src/compile/parse/lexer.js';
import {makeCursor} from '../src/compile/parse/cursor.js';
import {defaultTermOpTable} from '../src/compile/parse/op-table.js';
import {parseClause, parseGoal, parseGoals} from '../src/compile/prolog/clause.js';
import {parseProgram} from '../src/compile/prolog/program.js';
import {prolog, prologClause} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

const parse = (src, opTable = defaultTermOpTable(), values = []) => {
  const tokens = tokenize([src]);
  const cursor = makeCursor(tokens, values);
  const result = parseClause(cursor, opTable);
  if (cursor.peek().kind !== 'eof') throw new Error(`trailing tokens: ${cursor.peek().kind}`);
  return result;
};

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default [
  function test_clause_fact_with_args() {
    const r = parse('foo(X, Y).');
    eval(TEST('eq(r, {name: "foo", head: [Var("X"), Var("Y")], body: []})'));
  },
  function test_clause_fact_zero_arity() {
    const r = parse('green.');
    eval(TEST('eq(r, {name: "green", head: [], body: []})'));
  },
  function test_clause_rule_member() {
    const r = parse('member(X, [X | _]).');
    eval(TEST('eq(r, {name: "member", head: [Var("X"), List([Var("X")], Wild())], body: []})'));
  },
  function test_clause_rule_with_recursive_body() {
    const r = parse('member(X, [_ | T]) :- member(X, T).');
    eval(TEST('eq(r.name, "member")'));
    eval(TEST('eq(r.head, [Var("X"), List([Wild()], Var("T"))])'));
    eval(TEST('eq(r.body, [Call("member", [Var("X"), Var("T")])])'));
  },
  function test_clause_body_with_cut_and_fail() {
    const r = parse('notEq(X, X) :- !, fail.');
    eval(TEST('eq(r.body, [Cut(), Fail()])'));
  },
  function test_clause_body_with_operator_in_args() {
    const r = parse('inc(X, Y) :- eq(Y, X + 1).');
    eval(TEST('eq(r.body, [Call("eq", [Var("Y"), Compound("+", [Var("X"), Lit(1)])])])'));
  },
  function test_clause_body_with_dynamic_dispatch() {
    const r = parse('apply(P, X) :- P(X).');
    eval(TEST('eq(r.body, [Call(Var("P"), [Var("X")])])'));
  },
  function test_clause_body_with_sym_as_functor() {
    const r = parse('test(X) :- =>(X, 1).');
    eval(TEST('eq(r.body, [Call("=>", [Var("X"), Lit(1)])])'));
  },
  function test_clause_uppercase_head_rejected() {
    let threw = false;
    try {
      parse('Foo(X).');
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_clause_missing_period_rejected() {
    let threw = false;
    try {
      parse('foo(X)');
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_clause_head_args_use_operators() {
    // `head(X + 1)` — args go through parseExpr.
    const r = parse('head(X + 1).');
    eval(TEST('eq(r, {name: "head", head: [Compound("+", [Var("X"), Lit(1)])], body: []})'));
  },
  function test_clause_multiple_body_goals() {
    const r = parse('q(X, Y, Z) :- foo(X), bar(Y), baz(Z).');
    eval(TEST('r.body.length === 3'));
    eval(TEST('eq(r.body[0], Call("foo", [Var("X")]))'));
    eval(TEST('eq(r.body[2], Call("baz", [Var("Z")]))'));
  },
  function test_clause_string_atom_in_head() {
    const r = parse('foo("hello", X).');
    eval(TEST('eq(r.head, [Lit("hello"), Var("X")])'));
  },
  function test_clause_bare_atom_in_arg_position() {
    // Per the bare-atom decision: bare lowercase atom → Lit(name).
    const r = parse('color(red).');
    eval(TEST('eq(r.head, [Lit("red")])'));
  },
  function test_clause_interp_in_goal_position() {
    const fn =
      ({X}) =>
      env =>
        true;
    const tokens = tokenize(['foo(X) :- ', '.']);
    const cursor = makeCursor(tokens, [fn]);
    const r = parseClause(cursor, defaultTermOpTable());
    eval(TEST('eq(r.body[0], Js(fn))'));
  },
  function test_clause_interp_in_arg_position() {
    const seven = 7;
    const tokens = tokenize(['foo(', ').']);
    const cursor = makeCursor(tokens, [seven]);
    const r = parseClause(cursor, defaultTermOpTable());
    eval(TEST('eq(r.head, [Lit(7)])'));
  },
  function test_parse_goal_directly() {
    const tokens = tokenize(['foo(X)']);
    const cursor = makeCursor(tokens, []);
    const g = parseGoal(cursor, defaultTermOpTable());
    eval(TEST('eq(g, Call("foo", [Var("X")]))'));
  },
  function test_parse_goals_directly() {
    const tokens = tokenize(['a, b(X), c']);
    const cursor = makeCursor(tokens, []);
    const gs = parseGoals(cursor, defaultTermOpTable());
    eval(TEST('gs.length === 3'));
    eval(TEST('eq(gs[0], Call("a", []))'));
    eval(TEST('eq(gs[1], Call("b", [Var("X")]))'));
    eval(TEST('eq(gs[2], Call("c", []))'));
  },
  function test_clause_head_can_be_sym_name() {
    // Allow `'='/2` style head — sym name with args.
    const r = parse('=(X, X).');
    eval(TEST('eq(r, {name: "=", head: [Var("X"), Var("X")], body: []})'));
  },

  // -------------------------------------------------------------------------
  // prologClause tagged-template wrapper
  function test_prolog_clause_tag_no_trailing_dot() {
    const r = prologClause`foo(X, Y)`;
    eval(TEST('eq(r, {name: "foo", head: [Var("X"), Var("Y")], body: []})'));
  },
  function test_prolog_clause_tag_with_trailing_dot() {
    const r = prologClause`foo(X, Y).`;
    eval(TEST('eq(r, {name: "foo", head: [Var("X"), Var("Y")], body: []})'));
  },
  function test_prolog_clause_tag_rule() {
    const r = prologClause`member(X, [_ | T]) :- member(X, T)`;
    eval(TEST('r.name === "member"'));
    eval(TEST('eq(r.body, [Call("member", [Var("X"), Var("T")])])'));
  },
  function test_prolog_clause_tag_with_interp_term() {
    const seven = 7;
    const r = prologClause`pos(${seven})`;
    eval(TEST('eq(r, {name: "pos", head: [Lit(7)], body: []})'));
  },
  function test_prolog_clause_tag_with_interp_goal() {
    const guard =
      ({X}) =>
      env =>
        true;
    const r = prologClause`check(X) :- ${guard}`;
    eval(TEST('eq(r.body, [Js(guard)])'));
  },
  function test_prolog_clause_tag_with_operator_in_args() {
    const r = prologClause`q(X, Y) :- eq(Y, X + 1)`;
    eval(TEST('eq(r.body, [Call("eq", [Var("Y"), Compound("+", [Var("X"), Lit(1)])])])'));
  },
  function test_prolog_clause_tag_rejects_two_clauses() {
    let threw = false;
    try {
      prologClause`foo. bar.`;
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_prolog_clause_tag_rejects_uppercase_head() {
    let threw = false;
    try {
      prologClause`Foo(X)`;
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_prolog_clause_tag_with_trailing_whitespace() {
    const r = prologClause`green.   `;
    eval(TEST('eq(r, {name: "green", head: [], body: []})'));
  },

  // -------------------------------------------------------------------------
  // parseProgram — multi-clause + directives + arity grouping
  function test_program_single_fact() {
    const tokens = tokenize(['foo(X).']);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('Object.keys(rules).length === 1'));
    eval(TEST('rules.foo.name === "foo"'));
    eval(TEST('rules.foo.arity === 1'));
    eval(TEST('rules.foo.clauses.length === 1'));
  },
  function test_program_groups_clauses_by_name() {
    const tokens = tokenize(['foo(1). foo(2). foo(3).']);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('Object.keys(rules).length === 1'));
    eval(TEST('rules.foo.clauses.length === 3'));
  },
  function test_program_separates_different_predicates() {
    const tokens = tokenize(['foo(X). bar(Y). foo(Z).']);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('Object.keys(rules).length === 2'));
    eval(TEST('rules.foo.clauses.length === 2'));
    eval(TEST('rules.bar.clauses.length === 1'));
  },
  function test_program_arity_mismatch_throws() {
    let threw = false;
    try {
      const tokens = tokenize(['foo(X). foo(X, Y).']);
      const cursor = makeCursor(tokens, []);
      parseProgram(cursor, defaultTermOpTable());
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_program_member_two_clauses() {
    const src = 'member(X, [X | _]). member(X, [_ | T]) :- member(X, T).';
    const tokens = tokenize([src]);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('rules.member.arity === 2'));
    eval(TEST('rules.member.clauses.length === 2'));
    eval(TEST('eq(rules.member.clauses[0].body, [])'));
    eval(TEST('eq(rules.member.clauses[1].body, [Call("member", [Var("X"), Var("T")])])'));
  },
  function test_program_directive_op4_alias_in_body_arg() {
    // op/4 with target — arg-position usage emits Compound(target, ...).
    const src = ':- op(700, xfx, =>, eq). bar(X, Y) :- foo(X => Y).';
    const tokens = tokenize([src]);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('rules.bar.clauses[0].body[0].name === "foo"'));
    // The `X => Y` is an arg of foo, lowered as Compound('eq', [X, Y]) per op.target.
    eval(TEST('eq(rules.bar.clauses[0].body[0].args[0], Compound("eq", [Var("X"), Var("Y")]))'));
  },
  function test_program_directive_op3_no_target() {
    // op/3 — emits Compound with the source-level op name.
    const src = ':- op(700, xfx, ===). bar(X, Y) :- foo(X === Y).';
    const tokens = tokenize([src]);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('eq(rules.bar.clauses[0].body[0].args[0], Compound("===", [Var("X"), Var("Y")]))'));
  },
  function test_program_directive_does_not_leak() {
    // `===` declared in inner program; outer table unchanged after parse.
    const baseline = defaultTermOpTable();
    const src = ':- op(700, xfx, ===). foo(X, Y) :- bar(X === Y).';
    const tokens = tokenize([src]);
    const cursor = makeCursor(tokens, []);
    parseProgram(cursor, baseline);
    eval(TEST('!baseline.infix.has("===")'));
  },
  function test_program_unsupported_directive_throws() {
    let threw = false;
    try {
      const tokens = tokenize([':- foo.']);
      const cursor = makeCursor(tokens, []);
      parseProgram(cursor, defaultTermOpTable());
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_program_op_wrong_arity_throws() {
    let threw = false;
    try {
      // op/2 — not supported.
      const tokens = tokenize([':- op(700, xfx).']);
      const cursor = makeCursor(tokens, []);
      parseProgram(cursor, defaultTermOpTable());
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_program_op_invalid_priority_throws() {
    let threw = false;
    try {
      // priority must be a number literal; a Var fails.
      const tokens = tokenize([':- op(P, xfx, =>).']);
      const cursor = makeCursor(tokens, []);
      parseProgram(cursor, defaultTermOpTable());
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_program_op_4arg_aliased_in_term_position() {
    // op/4 with target, used in nested term: `head(A => B)` arg.
    const src = ':- op(700, xfx, =>, eq). holds(A => B).';
    const tokens = tokenize([src]);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('rules.holds.arity === 1'));
    eval(TEST('eq(rules.holds.clauses[0].head[0], Compound("eq", [Var("A"), Var("B")]))'));
  },
  function test_program_empty_input_returns_empty_dict() {
    const tokens = tokenize(['']);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('Object.keys(rules).length === 0'));
  },
  function test_program_only_directive_no_clauses() {
    const tokens = tokenize([':- op(700, xfx, =>).']);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    eval(TEST('Object.keys(rules).length === 0'));
  },
  function test_program_uses_default_arithmetic_op_table() {
    // Verify arithmetic ops from defaultTermOpTable already work.
    const src = 'q(X, Y, Z) :- foo(Z, X + Y * 2).';
    const tokens = tokenize([src]);
    const cursor = makeCursor(tokens, []);
    const rules = parseProgram(cursor, defaultTermOpTable());
    const inner = rules.q.clauses[0].body[0].args[1];
    // Expect Compound('+', [Var('X'), Compound('*', [Var('Y'), Lit(2)])])
    eval(TEST('eq(inner, Compound("+", [Var("X"), Compound("*", [Var("Y"), Lit(2)])]))'));
  },

  // -------------------------------------------------------------------------
  // prolog`...` polymorphic-tag — tag form
  function test_prolog_tag_basic_program() {
    const rules = prolog`foo(X). bar(Y).`;
    eval(TEST('typeof rules.foo === "object"'));
    eval(TEST('typeof rules.bar === "object"'));
    // Lowered: each rule is an array of compiled clause functions.
    eval(TEST('Array.isArray(rules.foo)'));
    eval(TEST('rules.foo.length === 1'));
  },
  function test_prolog_tag_attaches_ir_under_symbol() {
    const rules = prolog`foo(X). foo(Y).`;
    const ir = rules[IR];
    eval(TEST('ir !== undefined'));
    eval(TEST('ir.foo.name === "foo"'));
    eval(TEST('ir.foo.arity === 1'));
    eval(TEST('ir.foo.clauses.length === 2'));
  },
  function test_prolog_tag_lowered_runs_member_query() {
    // End-to-end: parse → lower → solve.
    const userRules = prolog`
      member(X, [X | _]).
      member(X, [_ | T]) :- member(X, T).
    `;
    const rules = {...systemRules, ...userRules};
    const list = makeList([1, 2, 3]);
    const X = v('X');
    const out = [];
    solve(rules, 'member', [X, list], env => out.push(assemble(X, env)));
    eval(TEST('unify(out, [1, 2, 3])'));
  },
  function test_prolog_tag_uses_default_arithmetic_op_table() {
    const rules = prolog`q(X, Y, Z) :- foo(Z, X + Y * 2).`;
    const inner = rules[IR].q.clauses[0].body[0].args[1];
    eval(TEST('eq(inner, Compound("+", [Var("X"), Compound("*", [Var("Y"), Lit(2)])]))'));
  },
  function test_prolog_tag_with_interpolation() {
    const seven = 7;
    const rules = prolog`only(${seven}).`;
    eval(TEST('eq(rules[IR].only.clauses[0].head[0], Lit(7))'));
  },

  // prolog as configurator — returns a freshly-configured tag
  function test_prolog_configurator_with_lower_false() {
    const ir = prolog({lower: false})`foo(X). foo(Y).`;
    // No lowering: the result IS the IR dict.
    eval(TEST('ir.foo.name === "foo"'));
    eval(TEST('ir.foo.clauses.length === 2'));
    eval(TEST('ir[IR] === undefined'));
  },
  function test_prolog_configurator_with_operators() {
    const customOps = [{priority: 700, type: 'xfx', name: '===', target: 'eq'}];
    const rules = prolog({operators: customOps})`bar(X, Y) :- foo(X === Y).`;
    // op/4 alias rewrites === → eq at parse time.
    const arg = rules[IR].bar.clauses[0].body[0].args[0];
    eval(TEST('eq(arg, Compound("eq", [Var("X"), Var("Y")]))'));
  },
  function test_prolog_configurator_does_not_mutate_default_table() {
    // Calling the configurator and using the resulting tag shouldn't
    // pollute future bare `prolog\`...\`` invocations. (Body operators
    // not yet wired — exercise via arg position only.)
    const _unused = prolog({operators: [{priority: 700, type: 'xfx', name: '@@'}]})`x(A) :- foo(A @@ A).`;
    // After this call, the bare prolog tag's table should not have @@.
    // Parse a program with @@ in arg position; under the bare table,
    // `A @@ A` would fall back to bare-atom interpretation and the
    // `@@` would lex as a sym → Lit('@@') which then leaves a stray
    // ident `A` after, triggering a parse error.
    let threw = false;
    try {
      prolog`y(A) :- foo(A @@ A).`;
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_prolog_with_method_chains() {
    // tag.with(opts) is a configurator alias.
    const tag = prolog.with({operators: [{priority: 700, type: 'xfx', name: '===', target: 'eq'}]});
    const rules = tag`bar(X, Y) :- foo(X === Y).`;
    const arg = rules[IR].bar.clauses[0].body[0].args[0];
    eval(TEST('eq(arg, Compound("eq", [Var("X"), Var("Y")]))'));
  },

  // prolog as string-form function
  function test_prolog_string_form() {
    const src = 'foo(X, Y). bar(Z).';
    const rules = prolog(src);
    eval(TEST('rules[IR].foo.arity === 2'));
    eval(TEST('rules[IR].bar.arity === 1'));
  },
  function test_prolog_string_form_with_options_override() {
    const src = 'foo(X). foo(Y).';
    const ir = prolog(src, {lower: false});
    eval(TEST('ir.foo.clauses.length === 2'));
    eval(TEST('ir[IR] === undefined'));
  },

  // -------------------------------------------------------------------------
  // prologClause polymorphic forms
  function test_prolog_clause_string_form() {
    const r = prologClause('foo(X, Y)');
    eval(TEST('eq(r, {name: "foo", head: [Var("X"), Var("Y")], body: []})'));
  },
  function test_prolog_clause_configurator_with_operators() {
    const customOps = [{priority: 700, type: 'xfx', name: '===', target: 'eq'}];
    const r = prologClause({operators: customOps})`bar(X, Y) :- foo(X === Y)`;
    const arg = r.body[0].args[0];
    eval(TEST('eq(arg, Compound("eq", [Var("X"), Var("Y")]))'));
  }
];
