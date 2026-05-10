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

// Re-exports — deep6 unification primitives that compose with `Lit` for
// fine-grained per-value match control. Imported from one place so users
// don't need to track deep6 sub-paths. See dev-docs/compiler-ir.md
// § Practical patterns.
export {open, soft} from 'deep6/unify.js';
export {_, _ as any} from 'deep6/env.js';

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

// Closed set of IR kind discriminators. Used by the Lit-walker (lower.js
// + collectVars below) to decide whether a nested `kind`-bearing object
// is an IR node to substitute, or domain data that happens to have a
// `kind` field. Keeping the set closed avoids namespace collision with
// user data.
export const IR_KINDS = new Set(['var', 'wildcard', 'literal', 'cons', 'compound']);

// `Var()` without an argument mints a fresh anonymous Variable name as
// a Symbol — useful for IR fragments built in JS that you want to splice
// into clauses without inventing a non-colliding string name. Mirrors
// deep6's `variable()` (`name || Symbol()`).
export const Var = name => ({kind: 'var', name: name || Symbol()});
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
// Metadata symbols

// Registry-scoped key under which strict-Prolog `prolog\`...\`` returns
// (when lowering is enabled) attach the parsed IR Rules dict alongside
// the lowered runtime functions. Cross-realm safe; consumers can grab
// it via `Symbol.for('yopl.ir')` without importing the symbol export.
export const IR = Symbol.for('yopl.ir');

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
  const visited = new WeakSet(); // cycle protection inside Lit values

  const walkLitValue = v => {
    if (v === null || typeof v !== 'object') return;
    if (visited.has(v)) return;
    visited.add(v);
    if (typeof v.kind === 'string' && IR_KINDS.has(v.kind)) {
      walkTerm(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const e of v) walkLitValue(e);
      return;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto === Object.prototype || proto === null) {
      for (const k of Object.keys(v)) walkLitValue(v[k]);
    }
    // Other objects (Map, Set, Date, Wrap, class instances) — leave alone.
  };

  const walkTerm = t => {
    switch (t.kind) {
      case 'var':
        if (!seen.has(t.name)) {
          seen.add(t.name);
          order.push(t.name);
        }
        return;
      case 'literal':
        walkLitValue(t.value);
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
