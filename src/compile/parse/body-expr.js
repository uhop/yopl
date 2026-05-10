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
// sentinels). `transformBody` then walks the tree producing the final
// `Goal[]` for the clause body, plus any `$or_<N>` helper rules
// generated for disjunction branches:
//
//   `Compound(',', [A, B])`   → flatten args (recursively)
//   `Compound(';', [A, B])`   → mint fresh `$or_<N>` helper rule;
//                               replace with `Call('$or_<N>', captured)`
//   `Compound('->', [A, B])`  → throw (if-then not yet supported)
//   `Compound(name, args)`    → `Call(name, args)`
//   `Lit(string)`             → `Call(string, [])` (atom-as-goal)
//   `Var(name)`               → `Call(Var(name), [])` (dynamic dispatch)
//   `Cut`/`Fail`/`Js` IR      → kept as-is (already Goal IR)
//
// Disjunction transformation: for `(A ; B)`, capture the set of var
// names that appear in BOTH the disjunction AND the enclosing clause
// scope. Mint a fresh helper name (`$or_<N>` with a module-level
// monotonic counter for global uniqueness across `prolog\`...\`` calls).
// Generate one helper clause per branch with `Var(name)` head args
// for each captured name. Replace the disjunction with a call to the
// helper passing the captured vars. Vars appearing only inside the
// disjunction stay branch-local; vars appearing only outside aren't
// captured. Cut inside `;`-branches scopes opaquely to the helper
// (transparent cut would need an IR `Disjunction` kind, deferred).
//
// Maxprio for body parsing is 1200 — covers all body operators in
// the default body op table.

import {Var, Call, Cut, Fail, Clause, Rule} from '../ir.js';
import {wrapGoalInterp} from './interp.js';
import {parseExpr, parsePrimary} from './expr.js';

const BODY_PRIO = 1200;

// Goal-context aliases for symbolic operators that map to yopl's
// runtime predicate names. Applied by `goalize` when converting a
// `Compound(name, args)` to `Call(...)` at body level — so `X = Y`
// in body emits `Call('eq', [X, Y])` while the same source in arg
// position emits `Compound('=', [X, Y])` (term as data, unaliased).
// User-defined op/4 entries use `target` for parse-time aliasing
// independently; goalize falls back to the source name when no
// built-in alias matches.
const GOAL_ALIASES = {
  '=': 'eq',
  '\\=': 'notEq',
  '==': 'eq',
  '\\==': 'notEq',
  '=:=': 'eq',
  '=\\=': 'notEq',
  '<': 'lt',
  '>': 'gt',
  '=<': 'le',
  '>=': 'ge'
};

let helperCounter = 0;
const nextHelperName = () => `$or_${++helperCounter}`;

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

const collectVarsInTerm = (t, names = new Set()) => {
  if (!t || typeof t !== 'object') return names;
  switch (t.kind) {
    case 'var':
      if (typeof t.name === 'string') names.add(t.name);
      break;
    case 'compound':
      if (typeof t.name !== 'string') collectVarsInTerm(t.name, names);
      for (const a of t.args) collectVarsInTerm(a, names);
      break;
    case 'cons':
      collectVarsInTerm(t.head, names);
      collectVarsInTerm(t.tail, names);
      break;
    case 'call':
      if (typeof t.name !== 'string') collectVarsInTerm(t.name, names);
      for (const a of t.args) collectVarsInTerm(a, names);
      break;
  }
  return names;
};

const flattenSemicolon = t => {
  if (t.kind === 'compound' && t.name === ';' && t.args.length === 2) {
    return [...flattenSemicolon(t.args[0]), ...flattenSemicolon(t.args[1])];
  }
  return [t];
};

const goalizeWithCtx = (t, ctx) => {
  if (t === null || typeof t !== 'object') {
    throw new Error(`cannot use ${typeof t} as goal`);
  }
  if (t.kind === 'compound') {
    if (t.name === ',' && t.args.length === 2) {
      return [...goalizeWithCtx(t.args[0], ctx), ...goalizeWithCtx(t.args[1], ctx)];
    }
    if (t.name === ';' && t.args.length === 2) {
      return [transformDisjunction(t, ctx)];
    }
    if (t.name === '->' && t.args.length === 2) {
      throw new Error(`if-then (->) not yet supported`);
    }
    const goalName = typeof t.name === 'string' ? (GOAL_ALIASES[t.name] ?? t.name) : t.name;
    return [Call(goalName, t.args)];
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

const transformDisjunction = (t, ctx) => {
  const disjunctionVars = collectVarsInTerm(t);
  const captured = [...disjunctionVars].filter(name => ctx.clauseVars.has(name));
  const helperName = nextHelperName();
  const branches = flattenSemicolon(t);
  const helperClauses = branches.map(branch => {
    const branchBody = goalizeWithCtx(branch, ctx);
    const headArgs = captured.map(name => Var(name));
    return Clause(headArgs, branchBody);
  });
  ctx.helpers.push(Rule(helperName, captured.length, helperClauses));
  return Call(
    helperName,
    captured.map(name => Var(name))
  );
};

// Transform a parsed body Term into goals + helper rules. Uses head
// terms to seed the clause-scope var set so disjunctions correctly
// capture vars shared between head and body.
export const transformBody = (headTerms, bodyTerm) => {
  const clauseVars = new Set();
  for (const h of headTerms) collectVarsInTerm(h, clauseVars);
  collectVarsInTerm(bodyTerm, clauseVars);
  const ctx = {clauseVars, helpers: []};
  const body = goalizeWithCtx(bodyTerm, ctx);
  return {body, helpers: ctx.helpers};
};

// Standalone goalize entry — builds a fresh ctx using only the body's
// own vars (no head context). Throws on disjunction encountered without
// transformBody (since helpers wouldn't be reachable).
export const goalize = t => {
  const ctx = {clauseVars: collectVarsInTerm(t), helpers: []};
  return goalizeWithCtx(t, ctx);
};
