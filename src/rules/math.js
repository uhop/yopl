import {_} from 'deep6/env';
import {head, cut} from './system.js';

export const rules = {
  // arithmetics
  add: [
    (X, Y, Z, ...sys) => [
      head(X, Y, Z),
      (env, stack) => {
        const isX = X.isBound(env),
          isY = Y.isBound(env),
          isZ = Z.isBound(env),
          count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
        if (count < 2) return false;
        cut(sys)(env, stack);
        if (count == 3) {
          const x = X.get(env);
          if (x !== _ && typeof x != 'number') return false;
          const y = Y.get(env);
          if (y !== _ && typeof y != 'number') return false;
          const z = X.get(env);
          if (z !== _ && typeof z != 'number') return false;
          if (x === _ || y === _ || z === _) return true;
          return x + y === z;
        }
        if (isX) {
          const x = X.get(env);
          if (typeof x != 'number') return false;
          if (isY) {
            const y = Y.get(env);
            if (typeof y != 'number') return false;
            env.bindVal(Z.name, x + y);
            return true;
          }
          const z = Z.get(env);
          if (typeof z != 'number') return false;
          env.bindVal(Y.name, z - x);
          return true;
        }
        const y = Y.get(env);
        if (typeof y != 'number') return false;
        const z = Z.get(env);
        if (typeof z != 'number') return false;
        env.bindVal(X.name, z - y);
        return true;
      }
    ],
    Y => [head(0, Y, Y)],
    X => [head(X, 0, X)]
  ],
  sub: [
    (X, Y, Z, ...sys) => [
      head(X, Y, Z),
      (env, stack) => {
        const isX = X.isBound(env),
          isY = Y.isBound(env),
          isZ = Z.isBound(env),
          count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
        if (count < 2) return false;
        cut(sys)(env, stack);
        if (count == 3) {
          const x = X.get(env);
          if (x !== _ && typeof x != 'number') return false;
          const y = Y.get(env);
          if (y !== _ && typeof y != 'number') return false;
          const z = X.get(env);
          if (z !== _ && typeof z != 'number') return false;
          if (x === _ || y === _ || z === _) return true;
          return x - y === z;
        }
        if (isX) {
          const x = X.get(env);
          if (typeof x != 'number') return false;
          if (isY) {
            const y = Y.get(env);
            if (typeof y != 'number') return false;
            env.bindVal(Z.name, x - y);
            return true;
          }
          const z = Z.get(env);
          if (typeof z != 'number') return false;
          env.bindVal(Y.name, x - z);
          return true;
        }
        const y = Y.get(env);
        if (typeof y != 'number') return false;
        const z = Z.get(env);
        if (typeof z != 'number') return false;
        env.bindVal(X.name, y + z);
        return true;
      }
    ],
    X => [head(X, 0, X)],
    X => [head(X, X, 0)]
  ],
  mul: [
    (X, Y, Z, ...sys) => [
      head(X, Y, Z),
      (env, stack) => {
        const isX = X.isBound(env),
          isY = Y.isBound(env),
          isZ = Z.isBound(env),
          count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
        if (count < 2) return false;
        cut(sys)(env, stack);
        if (count == 3) {
          const x = X.get(env);
          if (x !== _ && typeof x != 'number') return false;
          const y = Y.get(env);
          if (y !== _ && typeof y != 'number') return false;
          const z = X.get(env);
          if (z !== _ && typeof z != 'number') return false;
          if (x === _ || y === _ || z === _) return true;
          return x * y === z;
        }
        if (isX) {
          const x = X.get(env);
          if (typeof x != 'number') return false;
          if (isY) {
            const y = Y.get(env);
            if (typeof y != 'number') return false;
            env.bindVal(Z.name, x * y);
            return true;
          }
          const z = Z.get(env);
          if (typeof z != 'number') return false;
          env.bindVal(Y.name, z / x);
          return true;
        }
        const y = Y.get(env);
        if (typeof y != 'number') return false;
        const z = Z.get(env);
        if (typeof z != 'number') return false;
        env.bindVal(X.name, z / y);
        return true;
      }
    ],
    () => [head(0, _, 0)],
    () => [head(_, 0, 0)],
    X => [head(1, X, X)],
    X => [head(X, 1, X)]
  ],
  div: [
    (X, Y, Z, ...sys) => [
      head(X, Y, Z),
      (env, stack) => {
        const isX = X.isBound(env),
          isY = Y.isBound(env),
          isZ = Z.isBound(env),
          count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
        if (count < 2) return false;
        cut(sys)(env, stack);
        if (count == 3) {
          const x = X.get(env);
          if (x !== _ && typeof x != 'number') return false;
          const y = Y.get(env);
          if (y !== _ && typeof y != 'number') return false;
          const z = X.get(env);
          if (z !== _ && typeof z != 'number') return false;
          if (x === _ || y === _ || z === _) return true;
          return x / y === z;
        }
        if (isX) {
          const x = X.get(env);
          if (typeof x != 'number') return false;
          if (isY) {
            const y = Y.get(env);
            if (typeof y != 'number') return false;
            env.bindVal(Z.name, x / y);
            return true;
          }
          const z = Z.get(env);
          if (typeof z != 'number') return false;
          env.bindVal(Y.name, x / z);
          return true;
        }
        const y = Y.get(env);
        if (typeof y != 'number') return false;
        const z = Z.get(env);
        if (typeof z != 'number') return false;
        env.bindVal(X.name, y * z);
        return true;
      }
    ],
    () => [head(0, _, 0)],
    X => [head(X, X, 1)],
    X => [head(X, 1, X)]
  ],
  neg: [
    (X, Y, ...sys) => [
      head(X, Y),
      (env, stack) => {
        const isX = X.isBound(env),
          isY = Y.isBound(env);
        count = (isX ? 1 : 0) + (isY ? 1 : 0);
        if (count < 1) return false;
        cut(sys)(env, stack);
        if (count == 2) {
          const x = X.get(env);
          if (x !== _ && typeof x != 'number') return false;
          const y = Y.get(env);
          if (y !== _ && typeof y != 'number') return false;
          const z = X.get(env);
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
      }
    ],
    () => [head(0, 0)]
  ]
};
