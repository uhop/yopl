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
// Disjunction transformation: for `(A ; B)`, mint a fresh helper rule
// `$or_<N>` with one clause per branch and replace the disjunction
// site with `Call('$or_<N>', captured-vars)`. Captured = vars used
// across the disjunction intersected with the clause-scope set.
//
// If-then-else: `(Cond -> Then ; Else)` parses as
// `;(->(Cond, Then), Else)` — a disjunction whose first branch is
// `->`. Detected at the disjunction-collection step; minted as a
// fresh `$ite_<N>` with two clauses: `:- Cond, !, Then.` and
// `:- Else.`. The cut commits to the Then branch on Cond success,
// preventing Else from being tried (standard Prolog semantics).
//
// Standalone `Cond -> Then` (no `;`) mints `$ite_<N>` with a single
// `:- Cond, !, Then.` clause; the helper fails if Cond fails (no
// fall-through, since there's no else).
//
// Disjunction with prior branches AND an if-then-else
// (`A ; B ; (C -> T ; E)`) mints both an inner if-then-else helper
// and an outer disjunction helper whose last clause calls the inner.
// Cut inside `;`/`->` branches scopes opaquely to the helper
// (transparent cut would need a dedicated `Disjunction` IR kind,
// deferred).
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
const nextOrName = () => `$or_${++helperCounter}`;
const nextIteName = () => `$ite_${++helperCounter}`;

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

// Walk a right-recursive `;` chain collecting top-level branches.
// If a `;`'s left arg is `->`, return early signaling an if-then-else
// at that point — the caller routes accordingly.
const collectDisjBranches = t => {
  const branches = [];
  let current = t;
  while (current?.kind === 'compound' && current.name === ';' && current.args.length === 2) {
    const left = current.args[0];
    if (left?.kind === 'compound' && left.name === '->' && left.args.length === 2) {
      return {branches, ifThen: {cond: left.args[0], then: left.args[1], elseTerm: current.args[1]}};
    }
    branches.push(left);
    current = current.args[1];
  }
  branches.push(current);
  return {branches, ifThen: null};
};

const computeCaptured = (terms, ctx) => {
  const seen = new Set();
  for (const t of terms) collectVarsInTerm(t, seen);
  return [...seen].filter(name => ctx.clauseVars.has(name));
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
      return [transformIfThen(t.args[0], t.args[1], ctx)];
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

const transformIfThen = (condTerm, thenTerm, ctx) => {
  const captured = computeCaptured([condTerm, thenTerm], ctx);
  const helperName = nextIteName();
  const condGoals = goalizeWithCtx(condTerm, ctx);
  const thenGoals = goalizeWithCtx(thenTerm, ctx);
  const headArgs = captured.map(name => Var(name));
  const body = [...condGoals, Cut(), ...thenGoals];
  ctx.helpers.push(
    Rule(helperName, captured.length, [
      Clause(
        captured.map(name => Var(name)),
        body
      )
    ])
  );
  return Call(helperName, headArgs);
};

const transformIfThenElse = (condTerm, thenTerm, elseTerm, ctx) => {
  const captured = computeCaptured([condTerm, thenTerm, elseTerm], ctx);
  const helperName = nextIteName();
  const condGoals = goalizeWithCtx(condTerm, ctx);
  const thenGoals = goalizeWithCtx(thenTerm, ctx);
  const elseGoals = goalizeWithCtx(elseTerm, ctx);
  const clauses = [
    Clause(
      captured.map(name => Var(name)),
      [...condGoals, Cut(), ...thenGoals]
    ),
    Clause(
      captured.map(name => Var(name)),
      elseGoals
    )
  ];
  ctx.helpers.push(Rule(helperName, captured.length, clauses));
  return Call(
    helperName,
    captured.map(name => Var(name))
  );
};

const transformDisjunction = (t, ctx) => {
  const {branches, ifThen} = collectDisjBranches(t);
  if (ifThen) {
    const iteCall = transformIfThenElse(ifThen.cond, ifThen.then, ifThen.elseTerm, ctx);
    if (branches.length === 0) return iteCall;
    return mintDisjunctionHelper(t, branches, [iteCall], ctx);
  }
  return mintDisjunctionHelper(t, branches, [], ctx);
};

const mintDisjunctionHelper = (originalTerm, branchTerms, extraGoalBranches, ctx) => {
  const captured = computeCaptured([originalTerm], ctx);
  const helperName = nextOrName();
  const clauses = [];
  for (const branch of branchTerms) {
    const body = goalizeWithCtx(branch, ctx);
    clauses.push(
      Clause(
        captured.map(name => Var(name)),
        body
      )
    );
  }
  for (const goal of extraGoalBranches) {
    clauses.push(
      Clause(
        captured.map(name => Var(name)),
        [goal]
      )
    );
  }
  ctx.helpers.push(Rule(helperName, captured.length, clauses));
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
