import {Var, Wild, Lit, Compound, List} from '../src/compile/ir.js';
import {tokenize} from '../src/compile/parse/lexer.js';
import {makeCursor} from '../src/compile/parse/cursor.js';
import {makeOpTable, addOp, defaultTermOpTable} from '../src/compile/parse/op-table.js';
import {parseExpr} from '../src/compile/parse/expr.js';
import {submit, TEST} from './harness.js';

const parse = (src, opTable = defaultTermOpTable(), values = []) => {
  const tokens = tokenize([src]);
  const cursor = makeCursor(tokens, values);
  const result = parseExpr(cursor, opTable);
  if (cursor.peek().kind !== 'eof') throw new Error(`trailing tokens after expr: ${cursor.peek().kind}`);
  return result;
};

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default [
  function test_expr_var() {
    const r = parse('X');
    eval(TEST('eq(r, Var("X"))'));
  },
  function test_expr_bare_atom() {
    // Bare lowercase atom → string literal, matching yopl runtime convention.
    const r = parse('foo');
    eval(TEST('eq(r, Lit("foo"))'));
  },
  function test_expr_wildcard() {
    const r = parse('_');
    eval(TEST('eq(r, Wild())'));
  },
  function test_expr_number() {
    const r = parse('42');
    eval(TEST('eq(r, Lit(42))'));
  },
  function test_expr_string() {
    const r = parse('"hello"');
    eval(TEST('eq(r, Lit("hello"))'));
  },
  function test_expr_keyword_literals() {
    eval(TEST('eq(parse("null"), Lit(null))'));
    eval(TEST('eq(parse("true"), Lit(true))'));
    eval(TEST('eq(parse("false"), Lit(false))'));
  },
  function test_expr_list_simple() {
    const r = parse('[1, 2, 3]');
    eval(TEST('eq(r, List([Lit(1), Lit(2), Lit(3)], undefined))'));
  },
  function test_expr_list_empty() {
    const r = parse('[]');
    eval(TEST('eq(r, Lit(null))'));
  },
  function test_expr_list_with_tail() {
    const r = parse('[X | T]');
    eval(TEST('eq(r, List([Var("X")], Var("T")))'));
  },
  function test_expr_compound() {
    const r = parse('foo(X, Y)');
    eval(TEST('eq(r, Compound("foo", [Var("X"), Var("Y")]))'));
  },
  function test_expr_compound_nested() {
    const r = parse('foo(bar(X), Y)');
    eval(TEST('eq(r, Compound("foo", [Compound("bar", [Var("X")]), Var("Y")]))'));
  },
  function test_expr_binary_xfx() {
    const r = parse('X = Y');
    eval(TEST('eq(r, Compound("=", [Var("X"), Var("Y")]))'));
  },
  function test_expr_binary_yfx_left_assoc() {
    const r = parse('X + Y + Z');
    eval(TEST('eq(r, Compound("+", [Compound("+", [Var("X"), Var("Y")]), Var("Z")]))'));
  },
  function test_expr_mixed_precedence_mul_first() {
    const r = parse('X + Y * Z');
    eval(TEST('eq(r, Compound("+", [Var("X"), Compound("*", [Var("Y"), Var("Z")])]))'));
  },
  function test_expr_mixed_precedence_mul_left() {
    const r = parse('X * Y + Z');
    eval(TEST('eq(r, Compound("+", [Compound("*", [Var("X"), Var("Y")]), Var("Z")]))'));
  },
  function test_expr_parenthesized_overrides() {
    const r = parse('(X + Y) * Z');
    eval(TEST('eq(r, Compound("*", [Compound("+", [Var("X"), Var("Y")]), Var("Z")]))'));
  },
  function test_expr_prefix_unary_minus() {
    const r = parse('-X');
    eval(TEST('eq(r, Compound("-", [Var("X")]))'));
  },
  function test_expr_prefix_then_binary() {
    const r = parse('-X + Y');
    eval(TEST('eq(r, Compound("+", [Compound("-", [Var("X")]), Var("Y")]))'));
  },
  function test_expr_xfx_non_associative_rejects_chain() {
    let threw = false;
    try {
      parse('X = Y = Z');
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_expr_compound_arg_uses_operators() {
    const r = parse('foo(X + 1, Y)');
    eval(TEST('eq(r, Compound("foo", [Compound("+", [Var("X"), Lit(1)]), Var("Y")]))'));
  },
  function test_expr_list_element_uses_operators() {
    const r = parse('[X + 1, Y]');
    eval(TEST('eq(r, List([Compound("+", [Var("X"), Lit(1)]), Var("Y")], undefined))'));
  },
  function test_expr_comparison() {
    const r = parse('X < Y');
    eval(TEST('eq(r, Compound("<", [Var("X"), Var("Y")]))'));
  },
  function test_expr_numeric_eq() {
    const r = parse('X =:= Y');
    eval(TEST('eq(r, Compound("=:=", [Var("X"), Var("Y")]))'));
  },
  function test_expr_neq() {
    const r = parse('X \\= Y');
    eval(TEST('eq(r, Compound("\\\\=", [Var("X"), Var("Y")]))'));
  },
  function test_expr_sym_as_functor() {
    // `=>` is not in the default op-table; `=>(A, B)` parses as functor.
    const r = parse('=>(A, B)');
    eval(TEST('eq(r, Compound("=>", [Var("A"), Var("B")]))'));
  },
  function test_expr_op_in_table_as_functor() {
    // `=(A, B)` — `=` IS in the op table but with a following `(` it's a functor.
    const r = parse('=(A, B)');
    eval(TEST('eq(r, Compound("=", [Var("A"), Var("B")]))'));
  },
  function test_expr_xfy_right_associative() {
    // Custom op table: ^ as xfy 200 (ISO Prolog's exponentiation).
    const t = makeOpTable();
    addOp(t, {name: '^', priority: 200, type: 'xfy'});
    const r = parse('X ^ Y ^ Z', t);
    eval(TEST('eq(r, Compound("^", [Var("X"), Compound("^", [Var("Y"), Var("Z")])]))'));
  },
  function test_expr_interp_in_arg_position() {
    const seven = 7;
    const tokens = tokenize(['X + ', '']);
    const cursor = makeCursor(tokens, [seven]);
    const r = parseExpr(cursor, defaultTermOpTable());
    eval(TEST('eq(r, Compound("+", [Var("X"), Lit(7)]))'));
  },
  function test_expr_unrecognized_sym_in_primary_errors() {
    let threw = false;
    try {
      parse('@@@ foo');
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_expr_eof_in_middle_errors() {
    let threw = false;
    try {
      parse('X +');
    } catch (e) {
      threw = true;
    }
    eval(TEST('threw'));
  },
  function test_expr_op_priority_respects_maxPrio() {
    // parseExpr at maxPrio=999 must NOT consume `=` (priority 700)? Wait, 700 < 999, so it CAN.
    // Let's test a case where the op is too high: maxPrio=400 stops `+` (500).
    const tokens = tokenize(['X + Y']);
    const cursor = makeCursor(tokens, []);
    const r = parseExpr(cursor, defaultTermOpTable(), 400);
    // Should parse only `X` and stop at `+`
    eval(TEST('eq(r, Var("X"))'));
    eval(TEST('cursor.peek().kind === "sym"'));
    eval(TEST('cursor.peek().value === "+"'));
  }
];
