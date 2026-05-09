// @ts-self-types="./comp.d.ts"
import {_} from 'deep6/env.js';
import {lowerRules} from '../compile/lower.js';
import {rule, clause} from '../compile/clause/index.js';

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

export const rules = lowerRules([
  rule('lt', 2)(clause`(X, Y) :- ${compareFactory((a, b) => a <  b)}`),
  rule('le', 2)(clause`(X, Y) :- ${compareFactory((a, b) => a <= b)}`),
  rule('gt', 2)(clause`(X, Y) :- ${compareFactory((a, b) => a >  b)}`),
  rule('ge', 2)(clause`(X, Y) :- ${compareFactory((a, b) => a >= b)}`),

  rule('nz', 1)(clause`(0) :- !, fail`, clause`(_) :- !`)
]);
