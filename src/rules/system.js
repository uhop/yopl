// @ts-self-types="./system.d.ts"
import {_, isVariable} from 'deep6/env.js';
import {unify} from 'deep6/unify.js';
import {lowerRules} from '../compile/lower.js';
import {rule, clause} from '../compile/clause/index.js';

// utilities

export const fail = () => false;
export const halt = (env, goals, stack) => (stack.splice(0), false);
export const cut = sys => (env, goals, stack) => {
  const lastFrame = sys[0].get(env);
  for (let i = stack.length - 1; i >= 0; --i) {
    const frame = stack[i];
    if (frame.command === 2) {
      frame.index = Infinity;
    }
    if (frame === lastFrame) break;
  }
  return true;
};
export const call = X => (env, goals) => {
  let term = X,
    name,
    args;
  // TODO: add processing of arrays of goals
  if (isVariable(X)) {
    if (!X.isBound(env)) return false;
    term = X.get(env);
  }
  if (typeof term == 'string') {
    name = term;
  } else {
    if (!term || typeof term != 'object') return false;
    name = term.name;
    args = term.args;
    if (isVariable(name)) {
      name = name.get(env);
    }
    if (typeof name != 'string') return false;
    if (isVariable(args)) {
      args = args.get(env);
    }
    if (args && !Array.isArray(args)) return false;
  }
  return {terms: [{name, args}], index: 0, next: goals};
};

export const isBound =
  (...args) =>
  env =>
    args.every(V => isVariable(V) && V.isBound(env));

export const head = (...args) => ({args});
export const term = (name, ...args) => ({name, args});

export class Tail {
  constructor(value) {
    this.value = value;
  }
}

export const rest = list => new Tail(list);
export const list = (...args) => {
  if (!args.length) return null;
  let list = null,
    startFrom = args.length - 1;
  const last = args[startFrom];
  if (last instanceof Tail) {
    --startFrom;
    list = last.value;
  }
  for (let i = startFrom; i >= 0; --i) {
    const value = args[i];
    if (value instanceof Tail) throw new Error('list cannot contain a tail argument in the middle');
    list = {value, next: list};
  }
  return list;
};
export const listHead = (...args) => {
  if (args.length < 2) throw new Error('list constructor cannot have less then 2 elements');
  let startFrom = args.length - 1,
    list = args[startFrom];
  for (let i = startFrom - 1; i >= 0; --i) {
    list = {value: args[i], next: list};
  }
  return list;
};

// rules — built via the compiler. The lowered functions reference the
// runtime helpers above (call, cut, fail) via lower.js's imports; the
// circular import resolves cleanly because those helpers are accessed
// only at proof time, by which point all bindings are populated.

const compiled = lowerRules([
  // types
  rule('isVar',       1)(clause`(X) :- ${({X}) => env => !X.isBound(env)}`),
  rule('isNonVar',    1)(clause`(X) :- ${({X}) => env =>  X.isBound(env)}`),
  rule('isNumber',    1)(clause`(X) :- ${({X}) => env =>  X.isBound(env) && typeof X.get(env) == 'number'}`),
  rule('isString',    1)(clause`(X) :- ${({X}) => env =>  X.isBound(env) && typeof X.get(env) == 'string'}`),
  rule('isNull',      1)(clause`(X) :- ${({X}) => env =>  X.isBound(env) && X.get(env) === null}`),
  rule('isUndefined', 1)(clause`(X) :- ${({X}) => env =>  X.isBound(env) && X.get(env) === undefined}`),
  rule('isArray',     1)(clause`(X) :- ${({X}) => env =>  X.isBound(env) && Array.isArray(X.get(env))}`),

  // equality
  rule('eq',    2)(clause`(X, X)`),
  rule('notEq', 2)(clause`(X, X) :- !, fail`, clause`(_, _)`),

  // unification with options — Opts must be bound to a deep6 options bag
  // (e.g. {openArrays: true, openObjects: false}). Scope is one call;
  // env.options is restored before the goal returns.
  rule('unifyOpts', 3)(clause`(X, Y, Opts) :- ${({X, Y, Opts}) => env => {
    if (!Opts.isBound(env)) return false;
    const opts = Opts.get(env);
    if (!opts || typeof opts !== 'object') return false;
    const savedOpts = env.options;
    const result = unify(X, Y, env, opts);
    env.options = savedOpts;
    return !!result;
  }}`),

  // control predicates
  rule('call',        1)(clause`(X) :- X`),
  rule('not',         1)(clause`(X) :- X, !, fail`,        clause`(_)`),
  rule('isUnifiable', 2)(clause`(X, Y) :- not(not(eq(X, Y)))`),
  rule('conjunction', 1)(clause`(null)`,                   clause`([X | Xt]) :- X, conjunction(Xt)`),
  rule('disjunction', 1)(clause`([X | _]) :- X`,           clause`([_ | Xt]) :- disjunction(Xt)`),
  rule('true',        0)(clause`()`),
  rule('once',        1)(clause`(X) :- X, !`),

  // extended logic
  rule('counterExample', 2)(clause`(A, B) :- A, not(B)`),
  rule('implies',        2)(clause`(A, B) :- not(counterExample(A, B))`),

  // second-order logic
  rule('map',    3)(clause`(_, null, null)`,    clause`(F, [X | Xt], [Y | Yt]) :- F(X, Y), map(F, Xt, Yt)`),
  rule('filter', 3)(
    clause`(_, null, null)`,
    clause`(P, [X | Xt], [X | Yt]) :- P(X),      filter(P, Xt, Yt)`,
    clause`(P, [X | Xt],     Yt)   :- not(P(X)), filter(P, Xt, Yt)`
  ),
  rule('foldl', 4)(clause`(_, A, null, A)`, clause`(F, A, [X | Xt], O) :- F(A, X, B),       foldl(F, B, Xt, O)`),
  rule('foldr', 4)(clause`(_, A, null, A)`, clause`(F, A, [X | Xt], O) :- foldr(F, A, Xt, T), F(X, T, O)`),
  rule('compose',  4)(clause`(F, G, X, O) :- G(X, T), F(T, O)`),
  rule('converse', 4)(clause`(F, X, Y, O) :- F(Y, X, O)`)
]);
compiled.unify = compiled.eq;
compiled.notUnifiable = compiled.notEq;
export const rules = compiled;
