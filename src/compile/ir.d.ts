// Type definitions for yopl — IR for the rule compiler.

import type {Variable} from 'deep6/env.js';
import type {GoalFn} from '../solve.js';

// ---------------------------------------------------------------------------
// Terms

/** A user-named logic variable. */
export interface VarTerm {
  kind: 'var';
  name: string;
}

/** Anonymous "match-anything" slot (Prolog `_`). */
export interface WildTerm {
  kind: 'wildcard';
}

/** Literal JS value (number, string, boolean, `null`, etc.). */
export interface LitTerm {
  kind: 'literal';
  value: unknown;
}

/** A `{value, next}` cons cell — one link of a yopl list. */
export interface ConsTerm {
  kind: 'cons';
  head: Term;
  tail: Term;
}

/**
 * A `{name, args}` compound term. `name` may be a `VarTerm` for the
 * dynamic case (e.g. `term(F, X)` where `F` is a variable).
 */
export interface CompoundTerm {
  kind: 'compound';
  name: string | VarTerm;
  args: Term[];
}

/** Anything that may appear in a clause head or inside an argument list. */
export type Term = VarTerm | WildTerm | LitTerm | ConsTerm | CompoundTerm;

/** Build a user-named logic-variable term. */
export declare const Var: (name: string) => VarTerm;

/** Build an anonymous wildcard term. */
export declare const Wild: () => WildTerm;

/** Wrap a JS value as a literal term. */
export declare const Lit: (value: unknown) => LitTerm;

/** Build a `{value, next}` cons cell. */
export declare const Cons: (head: Term, tail: Term) => ConsTerm;

/**
 * Build a compound term `{name, args}`. `name` may be a `VarTerm` for
 * dynamic dispatch.
 */
export declare const Compound: (name: string | VarTerm, args?: Term[]) => CompoundTerm;

/**
 * Build a list term from `items` plus an optional `tail`. Empty list
 * defaults to `Lit(null)`. `List([X, Y], T)` → `Cons(X, Cons(Y, T))`.
 */
export declare const List: (items: Term[], tail?: Term) => Term;

// ---------------------------------------------------------------------------
// Goals

/**
 * Invoke a (statically- or dynamically-named) rule. `name` may be a
 * `VarTerm` for dynamic dispatch — lowering wraps such calls in the
 * runtime `call(...)` helper.
 */
export interface CallGoal {
  kind: 'call';
  name: string | VarTerm;
  args: Term[];
}

/** Prolog cut (`!`). Lowering wires the choice-point frame in. */
export interface CutGoal {
  kind: 'cut';
}

/** Explicit failure. Lowering emits a reference to runtime `fail`. */
export interface FailGoal {
  kind: 'fail';
}

/** Inline-JS escape hatch. */
export interface JsGoal {
  kind: 'js';
  factory: JsFactory;
}

/** Anything that may appear in a clause body. */
export type Goal = CallGoal | CutGoal | FailGoal | JsGoal;

/**
 * Per-activation bindings passed to a `JsFactory`'s `vars` argument.
 * Keyed by user-var name as declared on the clause.
 */
export type JsVars = Record<string, Variable>;

/**
 * Factory invoked once per clause activation. Receives the
 * activation's user-var bindings and the choice-point frame slot
 * (`sys` — an array form preserved for compatibility with the
 * runtime `cut(sys)` helper). Returns the runtime goal function the
 * proof loop calls with `(env, goals, stack)`.
 */
export type JsFactory = (vars: JsVars, sys: ReadonlyArray<Variable>) => GoalFn;

/** Build a goal that invokes a (static or dynamic) rule. */
export declare const Call: (name: string | VarTerm, args?: Term[]) => CallGoal;

/** Build a Prolog cut goal. */
export declare const Cut: () => CutGoal;

/** Build an explicit-failure goal. */
export declare const Fail: () => FailGoal;

/** Build an inline-JS goal from a per-activation factory. */
export declare const Js: (factory: JsFactory) => JsGoal;

// ---------------------------------------------------------------------------
// Clause and Rule

/**
 * One clause of a rule.
 *
 * - `head`: head args; `head.length` must equal `Rule.arity`.
 * - `body`: body goals; may be empty.
 * - `vars`: optional declared user-var names in declaration order.
 *   Front-ends supply this when vars appear only inside a `JsGoal`'s
 *   factory body (closures the IR walker can't see).
 */
export interface Clause {
  head: Term[];
  body: Goal[];
  vars?: string[];
}

/** A rule: name + arity + one or more clauses. */
export interface Rule {
  name: string;
  arity: number;
  clauses: Clause[];
}

/** Build a clause IR node. */
export declare const Clause: (head: Term[], body?: Goal[], vars?: string[]) => Clause;

/** Build a rule IR node. */
export declare const Rule: (name: string, arity: number, clauses: Clause[]) => Rule;

// ---------------------------------------------------------------------------
// Helpers

/**
 * Walk a clause's head and body, returning user-var names in
 * declaration order. Skips inside `JsGoal.factory` bodies — front-ends
 * with vars used only in inline JS must declare them via the explicit
 * `vars` argument to `Clause`.
 */
export declare const collectVars: (clause: Clause) => string[];
