// @ts-self-types="./unify-lp.d.ts"
//
// LP-specialized unifier — the "cheapest experiment" in the regime-C space
// (dev-docs/js-source-backend.md); judged on dev-docs/authz-bench.md.
// Fast-paths only the shapes lowered rules produce — Variables, primitives,
// cons cells, compounds, arrays, plain objects under openObjects semantics.
// Everything else (wrapped/custom Unifiers, non-plain prototypes, exotic env
// options, registered filters) delegates to deep6's general unify. Bindings
// go through the same Env API, so envs stay interchangeable with the
// baseline solvers.

import unify from 'deep6/unify.js';
import {Variable, Unifier, _} from 'deep6/env.js';

const hasOwn = Object.prototype.hasOwnProperty;

// the exact option set the yopl solver drivers run under
const lpOptions = o =>
  o.openObjects === true && !o.openArrays && !o.openMaps && !o.openSets && !o.circular && !o.loose && !o.signedZero && !o.symbols && !o.ignoreFunctions;

// Recursive, not worklist-based: pattern sides are clause heads with bounded
// depth, and data-vs-data descent stops at the first Variable.
const u = (l, r, env) => {
  if (l === r || l === _ || r === _) return true;
  if (l instanceof Variable) {
    if (env.isBound(l.name)) return u(env.get(l.name), r, env);
    if (r instanceof Variable) {
      if (env.isBound(r.name)) {
        env.bindVal(l.name, env.get(r.name));
        return true;
      }
      env.bindVar(l.name, r.name);
      return true;
    }
    env.bindVal(l.name, r);
    return true;
  }
  if (r instanceof Variable) {
    if (env.isBound(r.name)) return u(l, env.get(r.name), env);
    env.bindVal(r.name, l);
    return true;
  }
  if (typeof l != typeof r) return false;
  if (typeof l == 'number') return isNaN(l) && isNaN(r);
  if (typeof l != 'object' || !l || !r) return false;
  if (l instanceof Unifier || r instanceof Unifier) return unify(l, r, env) !== null;
  const lProto = Object.getPrototypeOf(l),
    rProto = Object.getPrototypeOf(r);
  if (
    (lProto !== Object.prototype && lProto !== null && lProto !== Array.prototype) ||
    (rProto !== Object.prototype && rProto !== null && rProto !== Array.prototype)
  )
    return unify(l, r, env) !== null;
  // reverse iteration mirrors deep6's LIFO worklist order: clause heads
  // conventionally put discriminating args last, so reverse order fails fast
  // on the same paths — measured decisively faster than forward for-in on
  // the member workloads (2026-07-14)
  const isArr = Array.isArray(l);
  if (isArr !== Array.isArray(r)) return false;
  if (isArr) {
    // dense-array semantics: holes read as undefined
    if (l.length !== r.length) return false;
    for (let i = l.length - 1; i >= 0; --i) {
      if (!u(l[i], r[i], env)) return false;
    }
    return true;
  }
  // openObjects intersection semantics: unify values of common keys only
  const keys = Object.keys(r);
  for (let i = keys.length - 1; i >= 0; --i) {
    const key = keys[i];
    if (hasOwn.call(l, key) && !u(l[key], r[key], env)) return false;
  }
  return true;
};

// per-env verdict cache: drivers reuse one env for a whole proof
let lastEnv = null,
  lastLP = false;

const unifyLP = (l, r, env) => {
  if (env !== lastEnv) {
    lastEnv = env;
    lastLP = lpOptions(env.options);
  }
  if (!lastLP || unify.filters.length) return unify(l, r, env) !== null;
  return u(l, r, env);
};

export default unifyLP;
export {unifyLP};
