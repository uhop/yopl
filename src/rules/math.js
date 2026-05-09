// @ts-self-types="./math.d.ts"
import {_} from 'deep6/env.js';
import {lowerRules} from '../compile/lower.js';
import {rule, clause} from '../compile/clause/index.js';
import {cut} from './system.js';

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

export const rules = lowerRules([
  rule('add', 3)(
    clause`(X, Y, Z) :- ${reversibleTernary((x, y, z) => x + y === z, (x, y) => x + y, (x, z) => z - x, (y, z) => z - y)}`,
    clause`(0, Y, Y)`,
    clause`(X, 0, X)`
  ),
  rule('sub', 3)(
    clause`(X, Y, Z) :- ${reversibleTernary((x, y, z) => x - y === z, (x, y) => x - y, (x, z) => x - z, (y, z) => y + z)}`,
    clause`(X, 0, X)`,
    clause`(X, X, 0)`
  ),
  rule('mul', 3)(
    clause`(X, Y, Z) :- ${reversibleTernary((x, y, z) => x * y === z, (x, y) => x * y, (x, z) => z / x, (y, z) => z / y)}`,
    clause`(0, _, 0)`,
    clause`(_, 0, 0)`,
    clause`(1, X, X)`,
    clause`(X, 1, X)`
  ),
  rule('div', 3)(
    clause`(X, Y, Z) :- ${reversibleTernary((x, y, z) => x / y === z, (x, y) => x / y, (x, z) => x / z, (y, z) => y * z)}`,
    clause`(0, _, 0)`,
    clause`(X, X, 1)`,
    clause`(X, 1, X)`
  ),
  rule('neg', 2)(clause`(X, Y) :- ${negReversible}`, clause`(0, 0)`)
]);
