// @ts-self-types="./math.d.ts"
import {_} from 'deep6/env.js';
import {prolog} from '../compile/prolog/index.js';
import {cut} from './system.js';

// `is/2` arithmetic-expression evaluator. Walks the RHS term tree,
// dereferencing Variable instances and dispatching compound nodes to
// numeric ops. Mirrors ISO Prolog's evaluation rules for the operators
// yopl exposes in the term op table (`+`, `-`, `*`, `/`, `//`, `mod`,
// unary `+`/`-`); plus a few common numeric functions usable in
// canonical-functor form (e.g. `X is abs(Y)`).
const ARITH_BINARY = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '//': (a, b) => Math.trunc(a / b),
  mod: (a, b) => ((a % b) + b) % b,
  min: Math.min,
  max: Math.max
};

const ARITH_UNARY = {
  '+': a => +a,
  '-': a => -a,
  abs: Math.abs,
  sqrt: Math.sqrt,
  floor: Math.floor,
  ceiling: Math.ceil,
  round: Math.round,
  sign: Math.sign
};

const evalExpr = (term, env) => {
  if (term && typeof term.isBound === 'function') {
    if (!term.isBound(env)) throw new Error('is/2: argument not sufficiently instantiated');
    return evalExpr(term.get(env), env);
  }
  if (typeof term === 'number') return term;
  if (term && typeof term.name === 'string' && Array.isArray(term.args)) {
    if (term.args.length === 2) {
      const fn = ARITH_BINARY[term.name];
      if (fn) return fn(evalExpr(term.args[0], env), evalExpr(term.args[1], env));
    } else if (term.args.length === 1) {
      const fn = ARITH_UNARY[term.name];
      if (fn) return fn(evalExpr(term.args[0], env));
    }
    throw new Error(`is/2: unknown arithmetic ${term.name}/${term.args.length}`);
  }
  throw new Error('is/2: cannot evaluate non-arithmetic term');
};

// Shared factory for fully-reversible binary arithmetic predicates
// (add, sub, mul, div). Caller supplies four numeric ops:
//   verify(x, y, z)  → boolean (all-bound consistency check)
//   fromXY(x, y)     → z         (forward bind)
//   fromXZ(x, z)     → y         (reverse bind through X)
//   fromYZ(y, z)     → x         (reverse bind through Y)
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

const negReversible =
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
      return x === -y;
    }
    if (isX) {
      const x = X.get(env);
      if (typeof x != 'number') return false;
      env.bindVal(Y.name, -x);
      return true;
    }
    const y = Y.get(env);
    if (typeof y != 'number') return false;
    env.bindVal(X.name, -y);
    return true;
  };

export const rules = prolog`
  add(X, Y, Z) :- ${reversibleTernary((x, y, z) => x + y === z, (x, y) => x + y, (x, z) => z - x, (y, z) => z - y)}.
  add(0, Y, Y).
  add(X, 0, X).

  sub(X, Y, Z) :- ${reversibleTernary((x, y, z) => x - y === z, (x, y) => x - y, (x, z) => x - z, (y, z) => y + z)}.
  sub(X, 0, X).
  sub(X, X, 0).

  mul(X, Y, Z) :- ${reversibleTernary((x, y, z) => x * y === z, (x, y) => x * y, (x, z) => z / x, (y, z) => z / y)}.
  mul(0, _, 0).
  mul(_, 0, 0).
  mul(1, X, X).
  mul(X, 1, X).

  div(X, Y, Z) :- ${reversibleTernary((x, y, z) => x / y === z, (x, y) => x / y, (x, z) => x / z, (y, z) => y * z)}.
  div(0, _, 0).
  div(X, X, 1).
  div(X, 1, X).

  neg(X, Y) :- ${negReversible}.
  neg(0, 0).

  is(X, E) :- ${({X, E}) => env => {
    const value = evalExpr(E, env);
    if (typeof value !== 'number') return false;
    if (X.isBound(env)) return X.get(env) === value;
    env.bindVal(X.name, value);
    return true;
  }}.

  =:=(X, Y) :- ${({X, Y}) => env => evalExpr(X, env) === evalExpr(Y, env)}.
  =\\=(X, Y) :- ${({X, Y}) => env => evalExpr(X, env) !== evalExpr(Y, env)}.
`;
