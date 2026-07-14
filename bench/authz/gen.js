// Deterministic seeded org + query-mix generator. A plain-JS oracle labels
// queries (denials are verified negatives) and cross-validates the engine.
// See dev-docs/authz-bench.md § Workload generator.

import {TupleStore, groupKey, isGroupKey, groupId} from './model.js';

// mulberry32
export const makeRng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = (rng, list) => list[(rng() * list.length) | 0];

const pickWeighted = (rng, pairs) => {
  let total = 0;
  for (const pair of pairs) total += pair[1];
  let roll = rng() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return pairs[pairs.length - 1][0];
};

// zipf over ranks 0..n-1: weight 1/(rank+1)^skew, sampled by binary search
const makeZipf = (rng, n, skew) => {
  const cumulative = new Array(n);
  let total = 0;
  for (let i = 0; i < n; ++i) cumulative[i] = total += 1 / (i + 1) ** skew;
  return () => {
    const roll = rng() * total;
    let lo = 0,
      hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < roll) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
};

const shuffle = (rng, list) => {
  for (let i = list.length - 1; i > 0; --i) {
    const j = (rng() * (i + 1)) | 0;
    const t = list[i];
    list[i] = list[j];
    list[j] = t;
  }
  return list;
};

const RELS = [
  ['viewer', 5],
  ['editor', 3],
  ['owner', 2]
];
const IMPLIED_BY = {owner: ['owner'], editor: ['editor', 'owner'], viewer: ['viewer', 'editor', 'owner']};

export const defaults = {
  seed: 20260714,
  users: 300,
  groups: 40,
  groupDepth: 3,
  usersPerGroup: 6,
  folderRoots: 6,
  folderFanout: 3,
  folderDepth: 3,
  docs: 1500,
  tuples: 4000,
  zipfSkew: 1,
  queryCounts: {direct: 500, group: 500, implied: 500, inherited: 500, denial: 1200}
};

export const generateOrg = (options = {}) => {
  const params = {...defaults, ...options, queryCounts: {...defaults.queryCounts, ...options.queryCounts}};
  const rng = makeRng(params.seed);
  const store = new TupleStore();

  const users = Array.from({length: params.users}, (_, i) => 'u' + i);

  // groups nest in chains of groupDepth; closures feed the oracle + sampling
  const groups = Array.from({length: params.groups}, (_, i) => 'g' + i);
  const groupUsers = new Map();
  for (let i = 0; i < params.groups; ++i) {
    const closure = new Set();
    for (let j = 0; j < params.usersPerGroup; ++j) {
      const user = pick(rng, users);
      store.addTuple(groups[i], 'member', user);
      closure.add(user);
    }
    if (i % params.groupDepth) {
      store.addTuple(groups[i], 'member', groupKey(groups[i - 1]));
      for (const user of groupUsers.get(groups[i - 1])) closure.add(user);
    }
    groupUsers.set(groups[i], closure);
  }

  const folders = [];
  let frontier = [];
  for (let i = 0; i < params.folderRoots; ++i) {
    const folder = 'f' + folders.length;
    folders.push(folder);
    frontier.push(folder);
  }
  for (let depth = 1; depth < params.folderDepth; ++depth) {
    const next = [];
    for (const parent of frontier) {
      for (let k = 0; k < params.folderFanout; ++k) {
        const folder = 'f' + folders.length;
        folders.push(folder);
        store.addParent(folder, parent);
        next.push(folder);
      }
    }
    frontier = next;
  }

  const docs = Array.from({length: params.docs}, (_, i) => 'd' + i);
  for (const doc of docs) store.addParent(doc, pick(rng, folders));

  const docsUnder = new Map();
  for (const doc of docs) {
    for (let folder = store.parents.get(doc); folder !== undefined; folder = store.parents.get(folder)) {
      let list = docsUnder.get(folder);
      if (!list) docsUnder.set(folder, (list = []));
      list.push(doc);
    }
  }

  const docZipf = makeZipf(rng, params.docs, params.zipfSkew);
  const grants = [];
  for (let i = 0; i < params.tuples; ++i) {
    const obj = rng() < 0.8 ? docs[docZipf()] : pick(rng, folders);
    const rel = pickWeighted(rng, RELS);
    const subj = rng() < 0.7 ? pick(rng, users) : groupKey(pick(rng, groups));
    store.addTuple(obj, rel, subj);
    grants.push({obj, rel, subj});
  }

  const ancestors = obj => {
    const list = [];
    for (let folder = store.parents.get(obj); folder !== undefined; folder = store.parents.get(folder)) list.push(folder);
    return list;
  };

  // plain-JS reference semantics of the clause base in rules.js
  const oracle = (user, rel, obj) => {
    const objs = rel === 'viewer' ? [obj, ...ancestors(obj)] : [obj];
    const rels = IMPLIED_BY[rel] ?? [rel];
    for (const o of objs) {
      const relMap = store.forward.get(o);
      if (!relMap) continue;
      for (const r of rels) {
        const subjects = relMap.get(r);
        if (!subjects) continue;
        if (subjects.has(user)) return true;
        for (const s of subjects) if (isGroupKey(s) && groupUsers.get(groupId(s)).has(user)) return true;
      }
    }
    return false;
  };

  const oops = kind => {
    throw new Error(`authz gen: no source grants for '${kind}' queries — increase tuples or adjust params`);
  };

  const userGrants = grants.filter(g => !isGroupKey(g.subj));
  const groupGrants = grants.filter(g => isGroupKey(g.subj) && groupUsers.get(groupId(g.subj)).size);
  const impliedSrc = userGrants.filter(g => g.rel !== 'viewer');
  const inheritedSrc = userGrants.filter(g => g.rel === 'viewer' && docsUnder.has(g.obj));
  const groupUserLists = new Map();
  for (const [id, closure] of groupUsers) groupUserLists.set(id, [...closure]);

  const makeQuery = (user, rel, obj, path) => ({u: user, r: rel, o: obj, expect: path !== 'denial', path});

  const counts = params.queryCounts;
  const queries = {direct: [], group: [], implied: [], inherited: [], denial: []};

  if (counts.direct) {
    userGrants.length || oops('direct');
    for (let i = 0; i < counts.direct; ++i) {
      const g = pick(rng, userGrants);
      queries.direct.push(makeQuery(g.subj, g.rel, g.obj, 'direct'));
    }
  }
  if (counts.group) {
    groupGrants.length || oops('group');
    for (let i = 0; i < counts.group; ++i) {
      const g = pick(rng, groupGrants);
      queries.group.push(makeQuery(pick(rng, groupUserLists.get(groupId(g.subj))), g.rel, g.obj, 'group'));
    }
  }
  if (counts.implied) {
    impliedSrc.length || oops('implied');
    for (let i = 0; i < counts.implied; ++i) {
      const g = pick(rng, impliedSrc);
      const rel = g.rel === 'owner' && rng() < 0.5 ? 'editor' : 'viewer';
      queries.implied.push(makeQuery(g.subj, rel, g.obj, 'implied'));
    }
  }
  if (counts.inherited) {
    inheritedSrc.length || oops('inherited');
    for (let i = 0; i < counts.inherited; ++i) {
      const g = pick(rng, inheritedSrc);
      queries.inherited.push(makeQuery(g.subj, 'viewer', pick(rng, docsUnder.get(g.obj)), 'inherited'));
    }
  }
  for (let i = 0; i < counts.denial; ++i) {
    let user, rel, obj;
    let tries = 0;
    do {
      if (++tries > 1000) throw new Error('authz gen: could not sample a denial — grants too dense');
      user = pick(rng, users);
      rel = pickWeighted(rng, RELS);
      obj = docs[docZipf()];
    } while (oracle(user, rel, obj));
    queries.denial.push(makeQuery(user, rel, obj, 'denial'));
  }

  // a constructed positive failing the oracle is a generator bug
  for (const kind of ['direct', 'group', 'implied', 'inherited'])
    for (const query of queries[kind]) {
      if (!oracle(query.u, query.r, query.o)) throw new Error(`authz gen: '${kind}' query is not a grant: ${JSON.stringify(query)}`);
    }

  const mixed = shuffle(rng, [...queries.direct, ...queries.group, ...queries.implied, ...queries.inherited, ...queries.denial]);

  return {params, store, users, groups, folders, docs, grants, queries, mixed, oracle};
};
