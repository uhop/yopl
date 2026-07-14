// Fixed small org with hand-known grants/denials keeps the authz bench model
// honest (dev-docs/authz-bench.md § Placement & discipline), plus an
// engine-vs-oracle cross-validation over a generated org.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import gen from '../src/solvers/gen.js';
import {TupleStore, groupKey} from '../bench/authz/model.js';
import {makeRules} from '../bench/authz/rules.js';
import {generateOrg} from '../bench/authz/gen.js';
import {submit, TEST} from './harness.js';

const store = new TupleStore();
store.addTuple('eng', 'member', 'alice');
store.addTuple('eng', 'member', 'bob');
store.addTuple('staff', 'member', 'carol');
store.addTuple('staff', 'member', groupKey('eng'));
store.addParent('sub', 'root');
store.addParent('doc1', 'sub');
store.addParent('doc2', 'root');
store.addTuple('doc1', 'owner', 'alice');
store.addTuple('doc2', 'viewer', groupKey('staff'));
store.addTuple('root', 'viewer', 'dave');
store.addTuple('doc2', 'editor', 'eve');

const rules = makeRules(store);

const can = (user, rel, obj) => !gen(rules, 'check', [user, rel, obj]).next().done;

const listObjects = (user, rel) => {
  const O = v('O');
  const seen = new Set();
  for (const env of gen(rules, 'check', [user, rel, O])) seen.add(assemble(O, env));
  return [...seen].sort().join(',');
};

export default [
  function test_authz_direct() {
    eval(TEST("can('alice', 'owner', 'doc1')"));
    eval(TEST("!can('bob', 'owner', 'doc1')"));
    eval(TEST("!can('alice', 'owner', 'doc2')"));
  },
  function test_authz_implied() {
    eval(TEST("can('alice', 'editor', 'doc1')"));
    eval(TEST("can('alice', 'viewer', 'doc1')"));
    eval(TEST("can('eve', 'viewer', 'doc2')"));
    eval(TEST("!can('eve', 'owner', 'doc2')"));
  },
  function test_authz_group() {
    eval(TEST("can('carol', 'viewer', 'doc2')"));
    eval(TEST("can('alice', 'viewer', 'doc2')"));
    eval(TEST("can('bob', 'viewer', 'doc2')"));
    eval(TEST("!can('dave', 'editor', 'doc2')"));
  },
  function test_authz_inherited() {
    eval(TEST("can('dave', 'viewer', 'doc1')"));
    eval(TEST("can('dave', 'viewer', 'doc2')"));
    eval(TEST("can('dave', 'viewer', 'sub')"));
    eval(TEST("!can('dave', 'editor', 'doc1')"));
    eval(TEST("!can('carol', 'viewer', 'doc1')"));
  },
  function test_authz_list_all() {
    eval(TEST("listObjects('dave', 'viewer') === 'doc1,doc2,root,sub'"));
    eval(TEST("listObjects('alice', 'viewer') === 'doc1,doc2'"));
  },
  function test_authz_cross_validation() {
    const org = generateOrg({
      users: 60,
      groups: 10,
      docs: 200,
      tuples: 500,
      folderRoots: 3,
      queryCounts: {direct: 60, group: 60, implied: 60, inherited: 60, denial: 120}
    });
    const orgRules = makeRules(org.store);
    let mismatches = 0;
    for (const query of org.mixed) {
      const result = !gen(orgRules, 'check', [query.u, query.r, query.o]).next().done;
      if (result !== query.expect) ++mismatches;
    }
    eval(TEST('org.mixed.length === 360'));
    eval(TEST('mismatches === 0'));
  }
];
