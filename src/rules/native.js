// @ts-self-types="./native.d.ts"
//
// Predicates that bridge yopl unification to JS-native built-in types:
// Array (indexed access + cons-list bridge), Map / Set (entries / membership),
// Date (decomposition / construction in local + UTC). Kept distinct from
// `system.js`, which holds generic logic-programming predicates.
//
// See `dev-docs/native-objects.md` for the design and roadmap.

import {isVariable} from 'deep6/env.js';
import {unify} from 'deep6/unify.js';
import {lowerRules} from '../compile/lower.js';
import {rule, clause} from '../compile/clause/index.js';

export const rules = lowerRules([
  // Type tests for JS-native built-in types.
  rule('isArray', 1)(clause`(X) :- ${({X}) => env => X.isBound(env) && Array.isArray(X.get(env))}`),
  rule('isMap',   1)(clause`(X) :- ${({X}) => env => X.isBound(env) && X.get(env) instanceof Map}`),
  rule('isSet',   1)(clause`(X) :- ${({X}) => env => X.isBound(env) && X.get(env) instanceof Set}`),
  rule('isDate',  1)(clause`(X) :- ${({X}) => env => X.isBound(env) && X.get(env) instanceof Date}`),

  // Array ↔ yopl cons list. Bidirectional: bind whichever side is unbound.
  rule('arrayList', 2)(clause`(A, L) :- ${({A, L}) => env => {
    const aBound = A.isBound(env), lBound = L.isBound(env);
    if (!aBound && !lBound) return false;
    if (aBound) {
      const arr = A.get(env);
      if (!Array.isArray(arr)) return false;
      let cell = null;
      for (let i = arr.length - 1; i >= 0; --i) cell = {value: arr[i], next: cell};
      return !!unify(L, cell, env);
    }
    let cur = L.get(env);
    const arr = [];
    while (cur !== null && cur !== undefined) {
      if (isVariable(cur)) {
        if (!cur.isBound(env)) return false; // open tail
        cur = cur.get(env);
        continue;
      }
      if (typeof cur !== 'object' || !('value' in cur)) return false;
      arr.push(cur.value);
      cur = cur.next;
    }
    return !!unify(A, arr, env);
  }}`),

  // Forward indexed lookup: A and I must be bound; out-of-bounds fails.
  rule('arrayGet', 3)(clause`(A, I, X) :- ${({A, I, X}) => env => {
    if (!A.isBound(env) || !I.isBound(env)) return false;
    const arr = A.get(env);
    if (!Array.isArray(arr)) return false;
    const i = I.get(env);
    if (!Number.isInteger(i) || i < 0 || i >= arr.length) return false;
    return !!unify(X, arr[i], env);
  }}`),

  // Immutable single-index override: A2 = [...A] with A2[I] = X. A, I, X
  // must be bound; I must be in-bounds or exactly A.length (append-at-end).
  // Out-of-bounds with hole creation is rejected.
  rule('arraySet', 4)(clause`(A, I, X, A2) :- ${({A, I, X, A2}) => env => {
    if (!A.isBound(env) || !I.isBound(env) || !X.isBound(env)) return false;
    const arr = A.get(env);
    if (!Array.isArray(arr)) return false;
    const i = I.get(env);
    if (!Number.isInteger(i) || i < 0 || i > arr.length) return false;
    const out = arr.slice();
    out[i] = X.get(env);
    return !!unify(A2, out, env);
  }}`),

  // Forward array length. A must be bound; reverse mode (build A of N
  // holes) is intentionally unsupported — would create sparse arrays
  // with semantics most callers don't want.
  rule('arrayLength', 2)(clause`(A, N) :- ${({A, N}) => env => {
    if (!A.isBound(env)) return false;
    const arr = A.get(env);
    if (!Array.isArray(arr)) return false;
    return !!unify(N, arr.length, env);
  }}`),

  // Map ↔ list of [K, V] pairs. Bidirectional. When Es is bound, the
  // entries are materialized into a Map and unified against M as Maps
  // (order-independent via deep6's unifyMap). When only M is bound,
  // entries are emitted in M's insertion order.
  rule('mapEntries', 2)(clause`(M, Es) :- ${({M, Es}) => env => {
    const mBound = M.isBound(env), esBound = Es.isBound(env);
    if (!mBound && !esBound) return false;
    if (esBound) {
      let cur = Es.get(env);
      const map = new Map();
      while (cur !== null && cur !== undefined) {
        if (isVariable(cur)) {
          if (!cur.isBound(env)) return false;
          cur = cur.get(env);
          continue;
        }
        if (typeof cur !== 'object' || !('value' in cur)) return false;
        const pair = cur.value;
        if (!Array.isArray(pair) || pair.length !== 2) return false;
        map.set(pair[0], pair[1]);
        cur = cur.next;
      }
      return !!unify(M, map, env);
    }
    const m = M.get(env);
    if (!(m instanceof Map)) return false;
    let cell = null;
    const entries = [...m];
    for (let i = entries.length - 1; i >= 0; --i) cell = {value: entries[i], next: cell};
    return !!unify(Es, cell, env);
  }}`),

  // Forward Map lookup: M and K must be bound; V binds to M.get(K).
  rule('mapGet', 3)(clause`(M, K, V) :- ${({M, K, V}) => env => {
    if (!M.isBound(env) || !K.isBound(env)) return false;
    const m = M.get(env);
    if (!(m instanceof Map)) return false;
    const k = K.get(env);
    if (!m.has(k)) return false;
    return !!unify(V, m.get(k), env);
  }}`),

  // Map membership: both M and K must be bound.
  rule('mapHas', 2)(clause`(M, K) :- ${({M, K}) => env => {
    if (!M.isBound(env) || !K.isBound(env)) return false;
    const m = M.get(env);
    return m instanceof Map && m.has(K.get(env));
  }}`),

  // Set ↔ list of items. Bidirectional. Both-bound case unifies Set-to-Set.
  rule('setItems', 2)(clause`(S, Items) :- ${({S, Items}) => env => {
    const sBound = S.isBound(env), itBound = Items.isBound(env);
    if (!sBound && !itBound) return false;
    if (itBound) {
      let cur = Items.get(env);
      const set = new Set();
      while (cur !== null && cur !== undefined) {
        if (isVariable(cur)) {
          if (!cur.isBound(env)) return false;
          cur = cur.get(env);
          continue;
        }
        if (typeof cur !== 'object' || !('value' in cur)) return false;
        set.add(cur.value);
        cur = cur.next;
      }
      return !!unify(S, set, env);
    }
    const s = S.get(env);
    if (!(s instanceof Set)) return false;
    let cell = null;
    const items = [...s];
    for (let i = items.length - 1; i >= 0; --i) cell = {value: items[i], next: cell};
    return !!unify(Items, cell, env);
  }}`),

  // Set membership: both S and X must be bound.
  rule('setHas', 2)(clause`(S, X) :- ${({S, X}) => env => {
    if (!S.isBound(env) || !X.isBound(env)) return false;
    const s = S.get(env);
    return s instanceof Set && s.has(X.get(env));
  }}`),

  // Date ↔ epoch milliseconds. Bidirectional. TZ-agnostic.
  rule('dateTimestamp', 2)(clause`(D, Ms) :- ${({D, Ms}) => env => {
    const dBound = D.isBound(env), msBound = Ms.isBound(env);
    if (!dBound && !msBound) return false;
    if (dBound) {
      const d = D.get(env);
      if (!(d instanceof Date)) return false;
      return !!unify(Ms, d.getTime(), env);
    }
    const ms = Ms.get(env);
    if (typeof ms !== 'number') return false;
    return !!unify(D, new Date(ms), env);
  }}`),

  // Date ↔ component bag (local time). Component bag is a JS object
  // with optional fields {year, month, day, hour, minute, second, ms}.
  // Month is 0-based (matching JS Date.prototype.getMonth). When D is
  // bound, only the fields named in C are filled in. When C is bound,
  // missing fields default to 1970/0/1/0/0/0/0.
  rule('dateComponents', 2)(clause`(D, C) :- ${({D, C}) => env => {
    const dBound = D.isBound(env), cBound = C.isBound(env);
    if (!dBound && !cBound) return false;
    if (dBound) {
      const d = D.get(env);
      if (!(d instanceof Date)) return false;
      // Build a component bag containing every field; deep6's openObjects
      // (true under solve) will reduce to whichever subset C names.
      const out = {
        year: d.getFullYear(), month: d.getMonth(), day: d.getDate(),
        hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(), ms: d.getMilliseconds()
      };
      return !!unify(C, out, env);
    }
    const c = C.get(env);
    if (!c || typeof c !== 'object') return false;
    const d = new Date(
      c.year ?? 1970, c.month ?? 0, c.day ?? 1,
      c.hour ?? 0, c.minute ?? 0, c.second ?? 0, c.ms ?? 0
    );
    return !!unify(D, d, env);
  }}`),

  // Date ↔ component bag (UTC). Same shape as dateComponents.
  rule('dateComponentsUTC', 2)(clause`(D, C) :- ${({D, C}) => env => {
    const dBound = D.isBound(env), cBound = C.isBound(env);
    if (!dBound && !cBound) return false;
    if (dBound) {
      const d = D.get(env);
      if (!(d instanceof Date)) return false;
      const out = {
        year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(),
        hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), ms: d.getUTCMilliseconds()
      };
      return !!unify(C, out, env);
    }
    const c = C.get(env);
    if (!c || typeof c !== 'object') return false;
    const d = new Date(Date.UTC(
      c.year ?? 1970, c.month ?? 0, c.day ?? 1,
      c.hour ?? 0, c.minute ?? 0, c.second ?? 0, c.ms ?? 0
    ));
    return !!unify(D, d, env);
  }}`)
]);
