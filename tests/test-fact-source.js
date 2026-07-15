// Fact-source choice-point protocol (dev-docs/runtime-protocols.md
// § Workstream 1): synthetic-source behavior — enumeration order and count,
// backtracking re-entry across two stacked sources, cut over a source, empty
// source, ground-argument filtering, solve + gen drivers — plus authz parity:
// small-org checks and the full-org oracle cross-validated against the
// baseline cons-list-scan rules.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import {rule, clause} from '../src/compile/clause.js';
import {prolog} from '../src/compile/prolog/index.js';
import {lowerRules} from '../src/compile/lower.js';
import {factSource, factThunk} from '../src/rules/fact-source.js';
import {makeNativesFS} from '../bench/authz/model-fs.js';
import solve from '../src/solve.js';
import gen from '../src/solvers/gen.js';
import {TupleStore, groupKey} from '../bench/authz/model.js';
import {makeRules} from '../bench/authz/rules.js';
import {makeRules as makeRulesFS} from '../bench/authz/rules-fs.js';
import {generateOrg} from '../bench/authz/gen.js';
import {submit, TEST} from './harness.js';

const nums = [1, 2, 3].map(n => factThunk([n]));
const numSource = factSource((env, {X}) => ({args: [X], list: nums}));
const emptySource = factSource(() => null);

const synth = lowerRules([
  rule('num', 1)(clause`(X) :- ${numSource}`),
  rule(
    'bigNum',
    1
  )(
    clause`(X) :- num(X), ${({X}) =>
      env =>
        X.get(env) > 1}`
  ),
  rule('firstNum', 1)(clause`(X) :- num(X), !`),
  rule('noNum', 1)(clause`(X) :- ${emptySource}`),
  rule(
    'pairSum5',
    2
  )(
    clause`(X, Y) :- num(X), num(Y), ${({X, Y}) =>
      env =>
        X.get(env) + Y.get(env) === 5}`
  )
]);

const collect = (rules, name, args, wanted) => {
  const result = [];
  solve(rules, name, args, env => result.push(wanted.map(w => assemble(w, env)).join(',')));
  return result.sort().join(';');
};

const count = (rules, name, args) => {
  let n = 0;
  solve(rules, name, args, () => ++n);
  return n;
};

const smallOrg = () => {
  const store = new TupleStore();
  store.addTuple('eng', 'member', 'alice');
  store.addTuple('staff', 'member', groupKey('eng'));
  store.addParent('doc1', 'root');
  store.addTuple('doc1', 'owner', 'alice');
  store.addTuple('root', 'viewer', groupKey('staff'));
  return store;
};

export default [
  function test_fact_source_enumeration() {
    const X = v('X');
    eval(TEST("collect(synth, 'num', [X], [X]) === '1;2;3'"));
    eval(TEST("count(synth, 'num', [2]) === 1"));
    eval(TEST("count(synth, 'num', [5]) === 0"));
    let first;
    solve(synth, 'firstNum', [X], env => first ?? (first = assemble(X, env)));
    eval(TEST('first === 1'));
    eval(TEST("count(synth, 'firstNum', [X]) === 1"));
    eval(TEST("count(synth, 'noNum', [X]) === 0"));
  },
  function test_fact_source_backtracking_reentry() {
    const X = v('X');
    eval(TEST("collect(synth, 'bigNum', [X], [X]) === '2;3'"));
    const Y = v('Y');
    eval(TEST("collect(synth, 'pairSum5', [X, Y], [X, Y]) === '2,3;3,2'"));
  },
  function test_fact_source_gen_driver() {
    const X = v('X');
    const seen = [];
    for (const env of gen(synth, 'num', [X])) seen.push(assemble(X, env));
    eval(TEST("seen.join(',') === '1,2,3'"));
    eval(TEST("gen(synth, 'noNum', [X]).next().done"));
  },
  function test_fact_source_authz_small_org() {
    const store = smallOrg();
    const rules = makeRulesFS(store);
    const can = (user, rel, obj) => !gen(rules, 'check', [user, rel, obj]).next().done;
    eval(TEST("can('alice', 'owner', 'doc1')"));
    eval(TEST("can('alice', 'viewer', 'doc1')"));
    eval(TEST("can('alice', 'viewer', 'root')"));
    eval(TEST("!can('alice', 'editor', 'root')"));
    eval(TEST("!can('bob', 'viewer', 'doc1')"));
  },
  function test_fact_source_reverse_index_enumeration() {
    const store = smallOrg();
    const fs = makeRulesFS(store);
    const base = makeRules(store);
    const G = v('G');
    eval(TEST("collect(fs, 'memberOf', ['alice', G], [G]) === collect(base, 'memberOf', ['alice', G], [G])"));
    eval(TEST("collect(fs, 'memberOf', ['alice', G], [G]) === 'eng;staff'"));
  },
  function test_fact_source_authz_oracle() {
    const org = generateOrg({
      users: 60,
      groups: 10,
      docs: 200,
      tuples: 500,
      folderRoots: 3,
      queryCounts: {direct: 50, group: 50, implied: 50, inherited: 50, denial: 100}
    });
    const fs = makeRulesFS(org.store);
    const base = makeRules(org.store);
    let mismatches = 0;
    for (const query of org.mixed) {
      const fsVerdict = !gen(fs, 'check', [query.u, query.r, query.o]).next().done;
      const baseVerdict = !gen(base, 'check', [query.u, query.r, query.o]).next().done;
      if (fsVerdict !== query.expect || baseVerdict !== fsVerdict) ++mismatches;
    }
    eval(TEST('mismatches === 0'));
  },
  function test_fact_source_cut_commits_store_order() {
    // cut selects WHICH fact wins by enumeration order — over a store-backed
    // source it must commit to the first-added fact, matching the same facts
    // declared as clauses (the legacy cons-list scan would commit to the
    // last-added: it prepends while scanning)
    const store = new TupleStore();
    store.addTuple('doc', 'viewer', 'alice');
    store.addTuple('doc', 'viewer', 'bob');
    store.addTuple('doc', 'editor', 'carol');
    const n = makeNativesFS(store);
    const rules = prolog`
      firstViewer(O, S) :- tuple(O, "viewer", S), !.
      tuple(O, R, S) :- ${n.tupleGround}, !, ${n.tupleCheck}.
      tuple(O, R, S) :- ${n.tupleFacts}.
    `;
    const S = v('S');
    eval(TEST("collect(rules, 'firstViewer', ['doc', S], [S]) === 'alice'"));
    eval(TEST("count(rules, 'firstViewer', ['doc', S]) === 1"));
  }
];
