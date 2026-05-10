// @ts-self-types="./logic.d.ts"
import {_} from 'deep6/env.js';
import {prolog} from '../compile/prolog/index.js';

// Forward-only ternary for logicalAnd / logicalOr — verify when all
// bound, compute Z from X+Y, fail when only Z and one operand bound.
// No cut, no type check; wildcards short-circuit to success.
const logicalForwardTernary =
  op =>
  ({X, Y, Z}) =>
  env => {
    const isX = X.isBound(env),
      isY = Y.isBound(env),
      isZ = Z.isBound(env),
      count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
    if (count < 2) return false;
    if (count == 3) {
      const x = X.get(env),
        y = Y.get(env),
        z = Z.get(env);
      if (x === _ || y === _ || z === _) return true;
      return !op(x, y) === !z;
    }
    if (isX) {
      const x = X.get(env);
      if (isY) {
        const y = Y.get(env);
        if (x === _ || y === _) return true;
        env.bindVal(Z.name, !!op(x, y));
        return true;
      }
      return false;
    }
    return false;
  };

const xorReversible =
  ({X, Y, Z}) =>
  env => {
    const isX = X.isBound(env),
      isY = Y.isBound(env),
      isZ = Z.isBound(env),
      count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
    if (count < 2) return false;
    if (count == 3) {
      const x = X.get(env),
        y = Y.get(env),
        z = Z.get(env);
      if (x === _ || y === _ || z === _) return true;
      return (!!x ^ !!y) === !!z;
    }
    if (isX) {
      const x = X.get(env);
      if (isY) {
        const y = Y.get(env);
        if (x === _ || y === _) return true;
        env.bindVal(Z.name, !!(!!x ^ !!y));
        return true;
      }
      const z = Z.get(env);
      if (x === _ || z === _) return true;
      env.bindVal(Y.name, !!(!!x ^ !!z));
      return true;
    }
    const y = Y.get(env),
      z = Z.get(env);
    if (y === _ || z === _) return true;
    env.bindVal(X.name, !!(!!y ^ !!z));
    return true;
  };

const notReversible =
  ({X, Y}) =>
  env => {
    const isX = X.isBound(env),
      isY = Y.isBound(env),
      count = (isX ? 1 : 0) + (isY ? 1 : 0);
    if (count < 1) return false;
    if (count == 2) {
      const x = X.get(env),
        y = Y.get(env);
      if (x === _ || y === _) return true;
      return !x === !!y;
    }
    if (isX) {
      const x = X.get(env);
      if (x === _) return true;
      env.bindVal(Y.name, !x);
      return true;
    }
    const y = Y.get(env);
    if (y === _) return true;
    env.bindVal(X.name, !y);
    return true;
  };

export const rules = prolog`
  logicalAnd(X, Y, Z) :- ${logicalForwardTernary((x, y) => x && y)}.
  logicalOr(X, Y, Z)  :- ${logicalForwardTernary((x, y) => x || y)}.
  logicalXor(X, Y, Z) :- ${xorReversible}.
  logicalNot(X, Y)    :- ${notReversible}.
`;
