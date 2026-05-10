// @ts-self-types="./bits.d.ts"
import {_} from 'deep6/env.js';
import {prolog} from '../compile/prolog/index.js';
import {cut} from './system.js';

// Forward-only ternary (bitAnd, bitOr): verify when all bound, compute
// Z from X+Y, fail otherwise. Cuts only on the cases this helper
// actually resolves (verify with all-3-bound, forward with X+Y-bound)
// — for unsupported reverse modes (X+Z or Y+Z bound), it falls through
// without cutting, so identity-fact alternatives at the rule level can
// catch queries the main path can't enumerate (e.g. `0 | Y = Z` ⇒ Y=Z).
const forwardTernary =
  (op, verify) =>
  ({X, Y, Z}, sys) =>
  (env, goals, stack) => {
    const isX = X.isBound(env),
      isY = Y.isBound(env),
      isZ = Z.isBound(env),
      count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
    if (count < 2) return false;
    if (count == 3) {
      cut(sys)(env, goals, stack);
      const x = X.get(env);
      if (x !== _ && typeof x != 'number') return false;
      const y = Y.get(env);
      if (y !== _ && typeof y != 'number') return false;
      const z = Z.get(env);
      if (z !== _ && typeof z != 'number') return false;
      if (x === _ || y === _ || z === _) return true;
      return verify(x, y, z);
    }
    if (isX && isY) {
      cut(sys)(env, goals, stack);
      const x = X.get(env);
      if (typeof x != 'number') return false;
      const y = Y.get(env);
      if (typeof y != 'number') return false;
      env.bindVal(Z.name, op(x, y));
      return true;
    }
    return false; // reverse-mode (isX+isZ or isY+isZ) — let identity facts try
  };

// Reversible ternary (bitXor): verify or compute any one missing operand
// from the other two. Same shape as math.js's reversibleTernary.
const reversibleTernary =
  (verify, fromXY, fromXZ, fromYZ) =>
  ({X, Y, Z}, sys) =>
  (env, goals, stack) => {
    const isX = X.isBound(env),
      isY = Y.isBound(env),
      isZ = Z.isBound(env),
      count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
    if (count < 2) return false;
    cut(sys)(env, goals, stack);
    if (count == 3) {
      const x = X.get(env);
      if (x !== _ && typeof x != 'number') return false;
      const y = Y.get(env);
      if (y !== _ && typeof y != 'number') return false;
      const z = Z.get(env);
      if (z !== _ && typeof z != 'number') return false;
      if (x === _ || y === _ || z === _) return true;
      return verify(x, y, z);
    }
    if (isX) {
      const x = X.get(env);
      if (typeof x != 'number') return false;
      if (isY) {
        const y = Y.get(env);
        if (typeof y != 'number') return false;
        env.bindVal(Z.name, fromXY(x, y));
        return true;
      }
      const z = Z.get(env);
      if (typeof z != 'number') return false;
      env.bindVal(Y.name, fromXZ(x, z));
      return true;
    }
    const y = Y.get(env);
    if (typeof y != 'number') return false;
    const z = Z.get(env);
    if (typeof z != 'number') return false;
    env.bindVal(X.name, fromYZ(y, z));
    return true;
  };

const bitNotReversible =
  ({X, Y}, sys) =>
  (env, goals, stack) => {
    const isX = X.isBound(env),
      isY = Y.isBound(env),
      count = (isX ? 1 : 0) + (isY ? 1 : 0);
    if (count < 1) return false;
    cut(sys)(env, goals, stack);
    if (count == 2) {
      const x = X.get(env);
      if (x !== _ && typeof x != 'number') return false;
      const y = Y.get(env);
      if (y !== _ && typeof y != 'number') return false;
      if (x === _ || y === _) return true;
      return x === ~y;
    }
    if (isX) {
      const x = X.get(env);
      if (typeof x != 'number') return false;
      env.bindVal(Y.name, ~x);
      return true;
    }
    const y = Y.get(env);
    if (typeof y != 'number') return false;
    env.bindVal(X.name, ~y);
    return true;
  };

export const rules = prolog`
  bitAnd(X, Y, Z) :- ${forwardTernary((x, y) => x & y, (x, y, z) => (x & y) === z)}.

  bitOr(X, Y, Z) :- ${forwardTernary((x, y) => x | y, (x, y, z) => (x | y) === z)}.
  bitOr(0, Y, Y).
  bitOr(X, 0, X).

  bitXor(X, Y, Z) :- ${reversibleTernary((x, y, z) => (x ^ y) === z, (x, y) => x ^ y, (x, z) => x ^ z, (y, z) => y ^ z)}.
  bitXor(0, Y, Y).
  bitXor(X, 0, X).
  bitXor(X, X, 0).

  bitNot(X, Y) :- ${bitNotReversible}.
  bitNot(0, 0).
`;
