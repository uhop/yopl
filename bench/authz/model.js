// Zanzibar-style relation-tuple store behind native predicates — facts are
// never clauses. See dev-docs/authz-bench.md.

import {isVariable} from 'deep6/env.js';
import {unify} from 'deep6/unify.js';

const GROUP_PREFIX = 'group:';

export const groupKey = id => GROUP_PREFIX + id;
export const isGroupKey = key => key.startsWith(GROUP_PREFIX);
export const groupId = key => key.slice(GROUP_PREFIX.length);

const deref = (value, env) => {
  while (isVariable(value)) {
    if (!value.isBound(env)) return value;
    value = value.get(env);
  }
  return value;
};

const isGroupPattern = subj => subj !== null && typeof subj == 'object' && subj.name === 'group' && Array.isArray(subj.args) && subj.args.length === 1;

// term-level subjects: user = plain id string, group ref = group(Id) compound
const subjToTerm = key => (isGroupKey(key) ? {name: 'group', args: [groupId(key)]} : key);

// store key for a fully ground subject term; null for patterns and junk
const subjToKey = (subj, env) => {
  if (typeof subj == 'string') return subj;
  if (isGroupPattern(subj)) {
    const id = deref(subj.args[0], env);
    if (typeof id == 'string') return groupKey(id);
  }
  return null;
};

const addTo = (index, a, b, c) => {
  let inner = index.get(a);
  if (!inner) index.set(a, (inner = new Map()));
  let set = inner.get(b);
  if (!set) inner.set(b, (set = new Set()));
  set.add(c);
};

export class TupleStore {
  constructor() {
    this.forward = new Map(); // obj → rel → Set(subjKey)
    this.reverse = new Map(); // subjKey → rel → Set(obj)
    this.parents = new Map(); // obj → parent
  }
  addTuple(obj, rel, subj) {
    addTo(this.forward, obj, rel, subj);
    addTo(this.reverse, subj, rel, obj);
  }
  hasTuple(obj, rel, subj) {
    const set = this.forward.get(obj)?.get(rel);
    return !!set && set.has(subj);
  }
  addParent(obj, parent) {
    this.parents.set(obj, parent);
  }
}

const cellT = (obj, rel, subjKey, next) => ({value: {name: 't', args: [obj, rel, subjToTerm(subjKey)]}, next});

export const makeNatives = store => ({
  tupleGround:
    ({O, R, S}) =>
    env =>
      !isVariable(deref(O, env)) && !isVariable(deref(R, env)) && subjToKey(deref(S, env), env) !== null,
  tupleCheck:
    ({O, R, S}) =>
    env =>
      store.hasTuple(deref(O, env), deref(R, env), subjToKey(deref(S, env), env)),
  // reify candidates for the bound args as a cons list; the tupleIn walk
  // enumerates — cursor pattern per arrayList / mapEntries
  tupleScan:
    ({O, R, S, L}) =>
    env => {
      const o = deref(O, env),
        r = deref(R, env),
        s = deref(S, env);
      const rBound = !isVariable(r);
      const groupsOnly = isGroupPattern(s);
      const sKey = subjToKey(s, env);
      let cell = null;
      const takeSubjects = (obj, rel, subjects) => {
        for (const key of subjects) {
          if (groupsOnly && !isGroupKey(key)) continue;
          cell = cellT(obj, rel, key, cell);
        }
      };
      const takeRels = (obj, rels) => {
        if (rBound) {
          const subjects = rels.get(r);
          subjects && takeSubjects(obj, r, subjects);
        } else {
          for (const [rel, subjects] of rels) takeSubjects(obj, rel, subjects);
        }
      };
      if (!isVariable(o)) {
        const rels = store.forward.get(o);
        rels && takeRels(o, rels);
      } else if (sKey !== null) {
        const rels = store.reverse.get(sKey);
        if (rels) {
          if (rBound) {
            const objs = rels.get(r);
            if (objs) for (const obj of objs) cell = cellT(obj, r, sKey, cell);
          } else {
            for (const [rel, objs] of rels) for (const obj of objs) cell = cellT(obj, rel, sKey, cell);
          }
        }
      } else {
        for (const [obj, rels] of store.forward) takeRels(obj, rels);
      }
      return !!cell && !!unify(L, cell, env);
    },
  parentBound:
    ({O}) =>
    env =>
      !isVariable(deref(O, env)),
  parentLookup:
    ({O, P}) =>
    env => {
      const parent = store.parents.get(deref(O, env));
      return parent !== undefined && !!unify(P, parent, env);
    },
  parentScan:
    ({L}) =>
    env => {
      let cell = null;
      for (const [obj, parent] of store.parents) cell = {value: {name: 'p', args: [obj, parent]}, next: cell};
      return !!cell && !!unify(L, cell, env);
    }
});
