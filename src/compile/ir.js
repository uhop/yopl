// @ts-self-types="./ir.d.ts"
// Internal representation for compiled yopl rules.
//
// Front-ends (clause/, prolog/, programmatic) produce IR nodes.
// src/compile/lower.js consumes the IR and emits runtime rule
// functions in the shape src/solve.js expects.
//
// IR nodes are plain objects with a `kind` discriminator. No classes,
// no methods — the IR is trivially comparable, printable, JSON-able,
// and inspectable in tests. See dev-docs/compiler-ir.md for the full
// design rationale.

// ---------------------------------------------------------------------------
// Terms
//
// A Term denotes unification data — what appears in clause heads and
// inside the argument lists of compound terms and goals. There are five
// kinds:
//
//   var       — a user-named logic variable        { kind: 'var',      name }
//   wildcard  — anonymous "match-anything" slot    { kind: 'wildcard' }
//   literal   — a JS value (number, string, ...)   { kind: 'literal',  value }
//   cons      — a {value, next} cell (list link)   { kind: 'cons',     head, tail }
//   compound  — a {name, args} structure           { kind: 'compound', name, args }
//
// `compound.name` may be a string (static) or a Term IR (dynamic — see
// the "dynamic name" notes in the design doc); `compound.args` is a Term[].

export const Var = name => ({kind: 'var', name});
export const Wild = () => ({kind: 'wildcard'});
export const Lit = value => ({kind: 'literal', value});
export const Cons = (head, tail) => ({kind: 'cons', head, tail});
export const Compound = (name, args = []) => ({kind: 'compound', name, args});

// Build a list term from items + optional tail. Empty list = Lit(null),
// matching yopl's runtime convention. List([X, Y], T) → Cons(X, Cons(Y, T)).
export const List = (items, tail) => {
  let result = tail || Lit(null);
  for (let i = items.length - 1; i >= 0; --i) result = Cons(items[i], result);
  return result;
};

// ---------------------------------------------------------------------------
// Goals
//
// A Goal is one step in a clause body. There are four kinds:
//
//   call  — invoke a named (or dynamic) rule    { kind: 'call', name, args }
//   cut   — Prolog `!` (commit to clause)       { kind: 'cut' }
//   fail  — explicit failure                    { kind: 'fail' }
//   js    — inline JavaScript escape hatch      { kind: 'js',   factory }
//
// `call.name` may be a string or a Term IR (Var or Compound) for dynamic
// dispatch. Lowering wraps dynamic-name calls in the runtime `call(...)`
// helper.
//
// `js.factory` is invoked once per clause activation with two args:
// a `vars` record `{X: Variable, Y: Variable, ...}` keyed by user-var
// name, and a `sys` array `[frame]` for cut wiring. It must return a
// runtime goal function `(env, goals, stack) => bool | null | frame`.
// The `js` marker exists so a parser can disambiguate "this slot is an
// inline goal" from "this slot is a goal name."

export const Call = (name, args = []) => ({kind: 'call', name, args});
export const Cut = () => ({kind: 'cut'});
export const Fail = () => ({kind: 'fail'});
export const Js = factory => ({kind: 'js', factory});

// ---------------------------------------------------------------------------
// Clause and Rule
//
// Clause:
//   head: Term[]           — head args; head.length must equal Rule.arity
//   body: Goal[]           — body goals; may be empty
//   vars: string[]?        — declared user-var names in declaration order;
//                            optional, computed from head + body if absent.
//                            Front-ends pass `vars` explicitly when they
//                            see vars the IR walker can't (e.g. inside a
//                            `js` factory's destructure pattern).
//
// Rule:
//   name: string
//   arity: number
//   clauses: Clause[]

export const Clause = (head, body = [], vars) => {
  const c = {head, body};
  if (vars !== undefined) c.vars = vars;
  return c;
};

export const Rule = (name, arity, clauses) => ({name, arity, clauses});

// ---------------------------------------------------------------------------
// Helpers

// Walk a clause's head and body collecting user-var names in declaration
// order. Used by lowering when Clause.vars is not supplied. Does not
// descend into `js` goal factories — front-ends with vars only-used
// inside JS must declare them via the explicit `vars` argument to
// `Clause`.
export const collectVars = clause => {
  const seen = new Set();
  const order = [];

  const walkTerm = t => {
    switch (t.kind) {
      case 'var':
        if (!seen.has(t.name)) {
          seen.add(t.name);
          order.push(t.name);
        }
        return;
      case 'cons':
        walkTerm(t.head);
        walkTerm(t.tail);
        return;
      case 'compound':
        if (typeof t.name !== 'string') walkTerm(t.name);
        for (const a of t.args) walkTerm(a);
        return;
    }
  };

  const walkGoal = g => {
    if (g.kind === 'call') {
      if (typeof g.name !== 'string') walkTerm(g.name);
      for (const a of g.args) walkTerm(a);
    }
  };

  for (const t of clause.head) walkTerm(t);
  for (const g of clause.body) walkGoal(g);
  return order;
};
