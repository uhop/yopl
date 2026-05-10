// Body-context Pratt parser. Parses a clause body as an operator
// expression using the same Pratt machinery as `parseExpr`, but with
// a body-aware primary parser that recognizes:
//
//   `!` (bang token)         → `Cut()` Goal IR sentinel
//   bare `fail` (no parens)  → `Fail()` Goal IR sentinel
//   `${jsFunction}` slot     → `Js(fn)` Goal IR (via wrapGoalInterp)
//
// All other primaries delegate to `parsePrimary` (term-context). Args
// of compound calls and list elements stay term-context regardless of
// outer mode — `parseArgsExpr` and `parseListExpr` don't forward
// `parsePrim`. Paren'd subexpressions DO forward, so `(foo, bar)` in
// body position parses as a body-context group.
//
// The Pratt produces a Term IR tree (with embedded Cut/Fail/Js
// sentinels). `goalize` then walks the tree producing the final
// `Goal[]` for the clause body:
//
//   `Compound(',', [A, B])`  → flatten args (recursively)
//   `Compound(';', [A, B])`  → throw (disjunction not yet supported)
//   `Compound('->', [A, B])` → throw (if-then not yet supported)
//   `Compound(name, args)`   → `Call(name, args)`
//   `Lit(string)`            → `Call(string, [])` (atom-as-goal)
//   `Var(name)`              → `Call(Var(name), [])` (dynamic dispatch)
//   `Cut`/`Fail`/`Js` IR     → kept as-is (already Goal IR)
//
// Maxprio for body parsing is 1200 — covers all body operators in
// the default body op table.

import {Call, Cut, Fail} from '../ir.js';
import {wrapGoalInterp} from './interp.js';
import {parseExpr, parsePrimary} from './expr.js';

const BODY_PRIO = 1200;

export const parseBodyPrimary = (cursor, opTable) => {
  const t = cursor.peek();
  if (t.kind === 'bang') {
    cursor.advance();
    return Cut();
  }
  if (t.kind === 'interp') {
    cursor.advance();
    return wrapGoalInterp(cursor.values[t.index]);
  }
  if (t.kind === 'ident' && t.value === 'fail' && cursor.peekAt(1)?.kind !== 'lparen') {
    cursor.advance();
    return Fail();
  }
  return parsePrimary(cursor, opTable, parseBodyPrimary);
};

export const parseBodyExpr = (cursor, opTable, maxPrio = BODY_PRIO) => parseExpr(cursor, opTable, maxPrio, parseBodyPrimary);

export const goalize = t => {
  if (t === null || typeof t !== 'object') {
    throw new Error(`cannot use ${typeof t} as goal`);
  }
  if (t.kind === 'compound') {
    if (t.name === ',' && t.args.length === 2) {
      return [...goalize(t.args[0]), ...goalize(t.args[1])];
    }
    if (t.name === ';' && t.args.length === 2) {
      throw new Error(`disjunction (;) not yet supported`);
    }
    if (t.name === '->' && t.args.length === 2) {
      throw new Error(`if-then (->) not yet supported`);
    }
    return [Call(t.name, t.args)];
  }
  if (t.kind === 'literal' && typeof t.value === 'string') {
    return [Call(t.value, [])];
  }
  if (t.kind === 'var') {
    return [Call(t, [])];
  }
  if (t.kind === 'cut' || t.kind === 'fail' || t.kind === 'js') {
    return [t];
  }
  throw new Error(`cannot use ${t.kind} as goal`);
};
