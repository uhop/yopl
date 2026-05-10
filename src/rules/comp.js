// @ts-self-types="./comp.d.ts"
import {_} from 'deep6/env.js';
import {prolog} from '../compile/prolog/index.js';

const comparable = {string: 1, number: 1};

const compareFactory =
  op =>
  ({X, Y}) =>
  env => {
    if (!X.isBound(env) || !Y.isBound(env)) return false;
    const x = X.get(env),
      y = Y.get(env);
    if (x === _) return y === _ || comparable[typeof y] === 1;
    if (y === _) return comparable[typeof x] === 1;
    return typeof x == typeof y && comparable[typeof x] === 1 && op(x, y);
  };

export const rules = prolog`
  lt(X, Y) :- ${compareFactory((a, b) => a <  b)}.
  le(X, Y) :- ${compareFactory((a, b) => a <= b)}.
  gt(X, Y) :- ${compareFactory((a, b) => a >  b)}.
  ge(X, Y) :- ${compareFactory((a, b) => a >= b)}.

  nz(0) :- !, fail.
  nz(_) :- !.
`;
