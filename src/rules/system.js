// @ts-self-types="./system.d.ts"
import {_, isVariable} from 'deep6/env.js';
import {unify} from 'deep6/unify.js';
import {prolog} from '../compile/prolog/index.js';

export {call, cut, fail, halt} from './system-runtime.js';

// utilities

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

const compiled = prolog`
  % types
  isVar(X)       :- ${({X}) => env => !X.isBound(env)}.
  isNonVar(X)    :- ${({X}) => env =>  X.isBound(env)}.
  isNumber(X)    :- ${({X}) => env =>  X.isBound(env) && typeof X.get(env) == 'number'}.
  isString(X)    :- ${({X}) => env =>  X.isBound(env) && typeof X.get(env) == 'string'}.
  isNull(X)      :- ${({X}) => env =>  X.isBound(env) && X.get(env) === null}.
  isUndefined(X) :- ${({X}) => env =>  X.isBound(env) && X.get(env) === undefined}.

  % equality
  eq(X, X).
  notEq(X, X) :- !, fail.
  notEq(_, _).

  % unification with options — Opts must be bound to a deep6 options bag
  % (e.g. {openArrays: true, openObjects: false}). Scope is one call;
  % env.options is restored before the goal returns.
  unifyOpts(X, Y, Opts) :- ${({X, Y, Opts}) => env => {
    if (!Opts.isBound(env)) return false;
    const opts = Opts.get(env);
    if (!opts || typeof opts !== 'object') return false;
    const savedOpts = env.options;
    const result = unify(X, Y, env, opts);
    env.options = savedOpts;
    return !!result;
  }}.

  % control predicates
  call(X) :- X.
  not(X)  :- X, !, fail.
  not(_).
  isUnifiable(X, Y) :- not(not(eq(X, Y))).
  conjunction(null).
  conjunction([X | Xt]) :- X, conjunction(Xt).
  disjunction([X | _])  :- X.
  disjunction([_ | Xt]) :- disjunction(Xt).
  true.
  once(X) :- X, !.

  % extended logic
  counterExample(A, B) :- A, not(B).
  implies(A, B)        :- not(counterExample(A, B)).

  % second-order logic
  map(_, null, null).
  map(F, [X | Xt], [Y | Yt]) :- F(X, Y), map(F, Xt, Yt).

  filter(_, null, null).
  filter(P, [X | Xt], [X | Yt]) :- P(X),      filter(P, Xt, Yt).
  filter(P, [X | Xt],     Yt)   :- not(P(X)), filter(P, Xt, Yt).

  foldl(_, A, null, A).
  foldl(F, A, [X | Xt], O) :- F(A, X, B),       foldl(F, B, Xt, O).

  foldr(_, A, null, A).
  foldr(F, A, [X | Xt], O) :- foldr(F, A, Xt, T), F(X, T, O).

  compose(F, G, X, O)  :- G(X, T), F(T, O).
  converse(F, X, Y, O) :- F(Y, X, O).
`;
compiled.unify = compiled.eq;
compiled.notUnifiable = compiled.notEq;
export const rules = compiled;
