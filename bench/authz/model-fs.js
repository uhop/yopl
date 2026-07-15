// Fact-source natives for the TupleStore — the Workstream-1 POC variant
// (dev-docs/runtime-protocols.md). Candidates are prebuilt shared thunks in
// per-index arrays; the `factSource` goal hands the matching array to the
// proof loop's own choice-point machinery. Indexes are a perf filter only —
// over-approximate candidate sets are correct, head unification rejects
// non-matches. Build after the store is fully populated: unlike the live
// `tupleScan`, the thunk index is a snapshot.
//
// Ground fast-path natives are reused from model.js's `makeNatives`; the
// small subject-term helpers are duplicated here (POC sibling — model.js
// stays untouched per implementation-discipline.md).

import {isVariable} from 'deep6/env.js';
import {factSource, factThunk} from '../../src/rules/fact-source.js';
import {makeNatives, isGroupKey, groupId, groupKey} from './model.js';

const deref = (value, env) => {
  while (isVariable(value)) {
    if (!value.isBound(env)) return value;
    value = value.get(env);
  }
  return value;
};

const isGroupPattern = subj => subj !== null && typeof subj == 'object' && subj.name === 'group' && Array.isArray(subj.args) && subj.args.length === 1;

const subjToTerm = key => (isGroupKey(key) ? {name: 'group', args: [groupId(key)]} : key);

const subjToKey = (subj, env) => {
  if (typeof subj == 'string') return subj;
  if (isGroupPattern(subj)) {
    const id = deref(subj.args[0], env);
    if (typeof id == 'string') return groupKey(id);
  }
  return null;
};

const push2 = (map, a, b, th) => {
  let inner = map.get(a);
  if (!inner) map.set(a, (inner = new Map()));
  let arr = inner.get(b);
  if (!arr) inner.set(b, (arr = []));
  arr.push(th);
};

const push1 = (map, a, th) => {
  let arr = map.get(a);
  if (!arr) map.set(a, (arr = []));
  arr.push(th);
};

const buildIndex = store => {
  const idx = {
    fwd: new Map(), // obj → rel → thunk[]
    fwdG: new Map(), // obj → rel → thunk[], group subjects only
    fwdAll: new Map(), // obj → thunk[]
    fwdGAll: new Map(), // obj → thunk[], group subjects only
    rev: new Map(), // subjKey → rel → thunk[]
    revAll: new Map(), // subjKey → thunk[]
    all: [],
    allG: [],
    parentsAll: [],
    parentByObj: new Map()
  };
  for (const [obj, rels] of store.forward) {
    for (const [rel, subjects] of rels) {
      for (const key of subjects) {
        const th = factThunk([obj, rel, subjToTerm(key)]);
        push2(idx.fwd, obj, rel, th);
        push1(idx.fwdAll, obj, th);
        push2(idx.rev, key, rel, th);
        push1(idx.revAll, key, th);
        idx.all.push(th);
        if (isGroupKey(key)) {
          push2(idx.fwdG, obj, rel, th);
          push1(idx.fwdGAll, obj, th);
          idx.allG.push(th);
        }
      }
    }
  }
  for (const [obj, parent] of store.parents) {
    const th = factThunk([obj, parent]);
    idx.parentsAll.push(th);
    push1(idx.parentByObj, obj, th);
  }
  return idx;
};

export const makeNativesFS = store => {
  const n = makeNatives(store);
  const idx = buildIndex(store);
  return {
    tupleGround: n.tupleGround,
    tupleCheck: n.tupleCheck,
    parentBound: n.parentBound,
    parentLookup: n.parentLookup,
    tupleFacts: factSource((env, {O, R, S}) => {
      const o = deref(O, env),
        r = deref(R, env),
        s = deref(S, env);
      const rB = !isVariable(r);
      const groupsOnly = isGroupPattern(s);
      const sKey = subjToKey(s, env);
      let list;
      if (!isVariable(o)) {
        list = rB ? (groupsOnly ? idx.fwdG : idx.fwd).get(o)?.get(r) : (groupsOnly ? idx.fwdGAll : idx.fwdAll).get(o);
      } else if (sKey !== null) {
        list = rB ? idx.rev.get(sKey)?.get(r) : idx.revAll.get(sKey);
      } else {
        list = groupsOnly ? idx.allG : idx.all;
      }
      return list && list.length ? {args: [o, r, s], list} : null;
    }),
    parentFacts: factSource((env, {O, P}) => {
      const o = deref(O, env);
      const list = isVariable(o) ? idx.parentsAll : idx.parentByObj.get(o);
      return list && list.length ? {args: [o, deref(P, env)], list} : null;
    })
  };
};
