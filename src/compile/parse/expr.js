// Pratt-shaped operator-precedence parser over the term grammar.
// Consumes tokens via the cursor convention; produces Term IR.
//
// Algorithm follows ISO Prolog's priority/associativity model:
//
//   xfx — non-associative infix; both children strictly < op priority
//   xfy — right-associative infix; right child <= priority, left strict
//   yfx — left-associative infix; left child <= priority, right strict
//   fx  — non-associative prefix; child strictly < op priority
//   fy  — right-stackable prefix; child <= op priority
//
// Operator-vs-functor disambiguation: a sym/ident token immediately
// followed by `(` is parsed as a functor call, not an operator
// application. This matches Prolog's `'=>'(A, B)` canonical form.
// Convention also means `\+ foo(X)` (prefix) and `\+(foo, bar)`
// (functor) both parse correctly to the same `Compound('\\+', [...])`
// shape when arity matches; arity-1 prefix and arity-1 functor produce
// identical IR.
//
// Operator-vs-atom: a sym followed by a token that cannot start a
// primary (`,`, `)`, `]`, `|`, `.`, `;`, `:-`, eof) is treated as a
// bare string atom (`Lit(name)`) rather than a prefix operator —
// otherwise `op(700, fy, -)` would try to treat `-` as unary minus
// applied to the closing paren. Users who want a prefix op application
// to a sym-named operand can either parenthesize the operand or use
// the canonical functor form.
//
// `op/4` aliasing: when an operator entry has a `target` field, the
// emitted compound uses `target` as the functor name instead of the
// source-level op name. So `:- op(700, xfx, =>, eq).` followed by
// `X => Y` in arg position emits `Compound('eq', [X, Y])` directly.
//
// List elements and compound args are parsed at maxPrio = 999 so the
// `,` token always behaves as a structural separator inside `[...]`
// and `(...)`, never as a comma-conjunction operator (priority 1000
// in the body table when it eventually exists).
//
// Bare lowercase identifiers in primary position parse as `Lit(name)`
// (a string-atom literal) — matches yopl's runtime convention where
// atoms are JS strings (see src/rules/system.js call-handler, which
// treats `typeof term == 'string'` as the atom branch). A 0-arity
// `Compound(name, [])` would lower to a runtime `{name, args: []}`
// object that wouldn't unify with the corresponding string atom.
// Differs from iter-1's clause front-end which rejects bare atoms.

import {Var, Wild, Lit, Compound, List} from '../ir.js';
import {wrapTermInterp} from './interp.js';
import {isVarStart} from './util.js';

const ARG_PRIO = 999;
const TOP_PRIO = 1200;

const NON_PRIMARY_KINDS = new Set(['comma', 'rparen', 'rbracket', 'pipe', 'period', 'semicolon', 'colondash', 'eof']);

const opNameOf = tok => {
  if (tok.kind === 'sym' || tok.kind === 'ident') return tok.value;
  if (tok.kind === 'comma') return ',';
  if (tok.kind === 'semicolon') return ';';
  return null;
};

export const parseExpr = (cursor, opTable, maxPrio = TOP_PRIO, parsePrim = parsePrimary) => {
  let lhs;
  let lhsPrio;

  const t = cursor.peek();
  const next = cursor.peekAt(1);
  const lookaheadIsLparen = next?.kind === 'lparen';
  const nextCanStartPrimary = next && !NON_PRIMARY_KINDS.has(next.kind);

  if (t.kind === 'sym' && !lookaheadIsLparen && nextCanStartPrimary) {
    const op = opTable.prefix.get(t.value);
    if (op && op.priority <= maxPrio) {
      cursor.advance();
      const childMax = op.type === 'fy' ? op.priority : op.priority - 1;
      const operand = parseExpr(cursor, opTable, childMax, parsePrim);
      lhs = Compound(op.target ?? op.name, [operand]);
      lhsPrio = op.priority;
    } else {
      lhs = parsePrim(cursor, opTable);
      lhsPrio = 0;
    }
  } else {
    lhs = parsePrim(cursor, opTable);
    lhsPrio = 0;
  }

  while (true) {
    const tok = cursor.peek();
    const name = opNameOf(tok);
    if (name === null) break;
    const op = opTable.infix.get(name);
    if (!op || op.priority > maxPrio) break;
    const leftMax = op.type === 'yfx' ? op.priority : op.priority - 1;
    if (lhsPrio > leftMax) break;
    const rightMax = op.type === 'xfy' ? op.priority : op.priority - 1;
    cursor.advance();
    const rhs = parseExpr(cursor, opTable, rightMax, parsePrim);
    lhs = Compound(op.target ?? op.name, [lhs, rhs]);
    lhsPrio = op.priority;
  }

  return lhs;
};

export const parsePrimary = (cursor, opTable, parsePrim = parsePrimary) => {
  const t = cursor.peek();
  if (t.kind === 'interp') {
    cursor.advance();
    return wrapTermInterp(cursor.values[t.index]);
  }
  if (t.kind === 'number') {
    cursor.advance();
    return Lit(t.value);
  }
  if (t.kind === 'string') {
    cursor.advance();
    return Lit(t.value);
  }
  if (t.kind === 'lbracket') return parseListExpr(cursor, opTable);
  if (t.kind === 'lparen') {
    cursor.advance();
    const inner = parseExpr(cursor, opTable, TOP_PRIO, parsePrim);
    cursor.eat('rparen');
    return inner;
  }
  if (t.kind === 'ident') {
    const name = t.value;
    cursor.advance();
    if (cursor.accept('lparen')) {
      const args = parseArgsExpr(cursor, opTable);
      cursor.eat('rparen');
      return Compound(isVarStart(name) ? Var(name) : name, args);
    }
    if (name === '_') return Wild();
    if (name === 'null') return Lit(null);
    if (name === 'true') return Lit(true);
    if (name === 'false') return Lit(false);
    if (isVarStart(name)) return Var(name);
    return Lit(name);
  }
  if (t.kind === 'sym') {
    const name = t.value;
    cursor.advance();
    if (cursor.accept('lparen')) {
      const args = parseArgsExpr(cursor, opTable);
      cursor.eat('rparen');
      return Compound(name, args);
    }
    return Lit(name);
  }
  throw new Error(`unexpected token ${t.kind} in expression`);
};

const parseListExpr = (cursor, opTable) => {
  cursor.eat('lbracket');
  if (cursor.accept('rbracket')) return Lit(null);
  const items = [parseExpr(cursor, opTable, ARG_PRIO)];
  while (cursor.accept('comma')) items.push(parseExpr(cursor, opTable, ARG_PRIO));
  let tail;
  if (cursor.accept('pipe')) tail = parseExpr(cursor, opTable, ARG_PRIO);
  cursor.eat('rbracket');
  return List(items, tail);
};

const parseArgsExpr = (cursor, opTable) => {
  if (cursor.peek().kind === 'rparen') return [];
  const args = [parseExpr(cursor, opTable, ARG_PRIO)];
  while (cursor.accept('comma')) args.push(parseExpr(cursor, opTable, ARG_PRIO));
  return args;
};
