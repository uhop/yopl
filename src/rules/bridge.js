// @ts-self-types="./bridge.d.ts"
//
// The JS bridge — helpers for natives that compute values from bound logic
// variables (dev-docs/runtime-protocols.md § Workstream 2).
//
// `deref` is the single-walk variable read: EnvMap's `isBound` and `get`
// each scan the frame stack top-down (O(depth)), so the idiomatic
// isBound-then-get pair costs two scans per read — and a get-first trick
// is no better where it matters most: an unbound name misses every frame,
// so get + confirming isBound is two FULL walks, and natives' out-args are
// unbound on every call (measured: sumList50 6% slower at depth ~50).
// The real fix is one walk with a found-flag: `has` per frame, `get` only
// on the hit frame, sentinel on miss — done against EnvMap's plain-field
// internals (valuesStack/depth, mirroring EnvMap.get's own loop), with a
// public-API fallback for duck-typed envs. The proper home is a deep6
// `env.lookup(name, missSentinel)` — promotion note in
// runtime-protocols.md § Workstream 2.
//
// `computes` / `verifies` operate on the clause's variables in declaration
// order (`Object.values` of the vars record) — use them in a dedicated
// clause whose only variables are the head args, the same convention
// math.js's reversibleTernary already relies on. Symbol-named vars are not
// supported (front-end names are strings).

import {Variable, _} from 'deep6/env.js';
import {unifyLP} from '../unify-lp.js';
import {cut} from './system-runtime.js';

const NOTFOUND = Symbol('yopl.bridge.notfound');

const lookup = (env, name) => {
  const stack = env.valuesStack;
  if (stack) {
    for (let i = env.depth; i >= 0; --i) {
      const m = stack[i];
      if (m && m.has(name)) return m.get(name);
    }
    return NOTFOUND;
  }
  return env.isBound(name) ? env.get(name) : NOTFOUND;
};

export const deref = (value, env) => {
  while (value instanceof Variable) {
    const v = lookup(env, value.name);
    if (v === NOTFOUND) return value;
    value = v;
  }
  return value;
};

// Sentinel a `computes` function returns to fail the goal (out-of-domain
// inputs: out-of-bounds index, missing key, ...).
export const MISS = Symbol('yopl.bridge.miss');

// computes(fn) — last head arg is the out term, the rest are inputs. Fails
// when any input is unbound or fn returns MISS; binds an unbound out
// directly, unifies a bound one.
export const computes = fn => vars => {
  const vs = Object.values(vars);
  return env => {
    const n = vs.length - 1;
    const args = new Array(n);
    for (let i = 0; i < n; ++i) {
      const val = deref(vs[i], env);
      if (val instanceof Variable) return false;
      args[i] = val;
    }
    const result = fn.apply(null, args);
    if (result === MISS) return false;
    const out = deref(vs[n], env);
    if (out instanceof Variable) {
      env.bindVal(out.name, result);
      return true;
    }
    return unifyLP(out, result, env);
  };
};

// verifies(fn) — pure boolean test over all head args; fails when any is
// unbound.
export const verifies = fn => vars => {
  const vs = Object.values(vars);
  return env => {
    const args = new Array(vs.length);
    for (let i = 0; i < vs.length; ++i) {
      const val = deref(vs[i], env);
      if (val instanceof Variable) return false;
      args[i] = val;
    }
    return !!fn.apply(null, args);
  };
};

// reversible3 — bridge-built equivalent of math.js's reversibleTernary
// (same contract: verify / fromXY / fromXZ / fromYZ over conventional
// {X, Y, Z} names, cut on resolved modes), with each variable read as one
// deref walk instead of an isBound scan plus a get scan.
export const reversible3 =
  (verify, fromXY, fromXZ, fromYZ) =>
  ({X, Y, Z}, sys) =>
  (env, goals, stack) => {
    const x = deref(X, env),
      y = deref(Y, env),
      z = deref(Z, env);
    const isX = !(x instanceof Variable),
      isY = !(y instanceof Variable),
      isZ = !(z instanceof Variable),
      count = (isX ? 1 : 0) + (isY ? 1 : 0) + (isZ ? 1 : 0);
    if (count < 2) return false;
    cut(sys)(env, goals, stack);
    if (count == 3) {
      if (x !== _ && typeof x != 'number') return false;
      if (y !== _ && typeof y != 'number') return false;
      if (z !== _ && typeof z != 'number') return false;
      if (x === _ || y === _ || z === _) return true;
      return verify(x, y, z);
    }
    if (isX) {
      if (typeof x != 'number') return false;
      if (isY) {
        if (typeof y != 'number') return false;
        env.bindVal(Z.name, fromXY(x, y));
        return true;
      }
      if (typeof z != 'number') return false;
      env.bindVal(Y.name, fromXZ(x, z));
      return true;
    }
    if (typeof y != 'number') return false;
    if (typeof z != 'number') return false;
    env.bindVal(X.name, fromYZ(y, z));
    return true;
  };
