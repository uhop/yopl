// Cross-validation for the LP-specialized unifier: unit-level parity with
// deep6 unify under solver options (incl. the openObjects intersection
// semantics and delegation cases), plus solver-level checks — classic
// fixtures and the authz oracle through the unifyLP-backed solvers.

import unify, {variable as v, open} from 'deep6/unify.js';
import {EnvMap} from 'deep6/env-map.js';
import assemble from 'deep6/traverse/assemble.js';
import {unifyLP} from '../src/unify-lp.js';
import solve from '../src/solve.js';
import gen from '../src/solvers/gen.js';
import {TupleStore, groupKey} from '../bench/authz/model.js';
import {makeRules} from '../bench/authz/rules.js';
import {generateOrg} from '../bench/authz/gen.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

const solverEnv = () => {
  const env = new EnvMap();
  env.options.openObjects = true;
  return env;
};

// both unifiers must agree on the outcome for the same inputs
const parity = (l, r) => !!unify(l, r, solverEnv()) === unifyLP(l, r, solverEnv());

const memberRules = {
  member: [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]]
};
const appendRules = {
  append: [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append', args: [X, Y, Z]}]]
};

export default [
  function test_unify_lp_primitives_parity() {
    eval(TEST("parity('a', 'a')"));
    eval(TEST("parity('a', 'b')"));
    eval(TEST('parity(1, 1)'));
    eval(TEST('parity(1, 2)'));
    eval(TEST('parity(NaN, NaN)'));
    eval(TEST('parity(0, -0)'));
    eval(TEST('parity(null, null)'));
    eval(TEST("parity(null, 'a')"));
    eval(TEST('parity(true, true)'));
    eval(TEST("parity(1, '1')"));
    eval(TEST('parity(undefined, undefined)'));
    eval(TEST('parity(undefined, null)'));
  },
  function test_unify_lp_structures_parity() {
    eval(TEST('parity({value: 1, next: null}, {value: 1, next: null})'));
    eval(TEST('parity({value: 1, next: null}, {value: 2, next: null})'));
    eval(TEST("parity({name: 'group', args: ['g1']}, {name: 'group', args: ['g1']})"));
    eval(TEST("parity({name: 'group', args: ['g1']}, {name: 'group', args: ['g2']})"));
    eval(TEST("parity({name: 'group', args: ['g1']}, {name: 'other', args: ['g1']})"));
    eval(TEST('parity([1, 2, 3], [1, 2, 3])'));
    eval(TEST('parity([1, 2, 3], [1, 2])'));
    eval(TEST('parity([1, 2, 3], {0: 1, 1: 2, 2: 3})'));
  },
  function test_unify_lp_open_object_semantics_parity() {
    // openObjects unifies on common keys only — both unifiers must agree,
    // including the vacuous cons-vs-compound case (no common keys)
    eval(TEST('parity({a: 1}, {a: 1, b: 2})'));
    eval(TEST('parity({a: 1, b: 2}, {a: 1})'));
    eval(TEST('parity({a: 1}, {a: 2, b: 2})'));
    eval(TEST("parity({value: 1, next: null}, {name: 'group', args: ['g1']})"));
    eval(TEST('parity({}, {a: 1})'));
  },
  function test_unify_lp_delegation_parity() {
    eval(TEST('parity(new Map([[1, 2]]), new Map([[1, 2]]))'));
    eval(TEST('parity(new Map([[1, 2]]), new Map([[1, 3]]))'));
    eval(TEST('parity(new Set([1, 2]), new Set([1, 2]))'));
    eval(TEST('parity(new Date(0), new Date(0))'));
    eval(TEST('parity(new Date(0), new Date(1))'));
    eval(TEST('parity(open({a: 1}), {a: 1, b: 2})'));
    eval(TEST('parity(open({a: 1, b: 2}), {a: 1})'));
  },
  function test_unify_lp_variable_binding() {
    const env = solverEnv();
    const X = v('X'),
      Y = v('Y');
    eval(TEST('unifyLP(X, 5, env)'));
    eval(TEST('X.get(env) === 5'));
    eval(TEST('unifyLP(Y, X, env)'));
    eval(TEST('Y.get(env) === 5'));
    eval(TEST('!unifyLP(Y, 6, env)'));
  },
  function test_unify_lp_variable_aliasing() {
    const env = solverEnv();
    const X = v('X'),
      Y = v('Y');
    eval(TEST('unifyLP(X, Y, env)'));
    eval(TEST('unifyLP(Y, 42, env)'));
    eval(TEST('X.get(env) === 42'));
  },
  function test_unify_lp_pattern_extraction() {
    const env = solverEnv();
    const X = v('X');
    eval(TEST("unifyLP({name: 'group', args: [X]}, {name: 'group', args: ['g7']}, env)"));
    eval(TEST("X.get(env) === 'g7'"));
  },
  function test_solve_lp_member_append() {
    const wanted = v('X');
    const result = [];
    solve(memberRules, 'member', [makeList([1, 2, 3]), wanted], env => result.push(assemble(wanted, env)));
    eval(TEST('unify(result, [1, 2, 3])'));
    let count = 0;
    solve(appendRules, 'append', [v('A'), v('B'), makeList([1, 2, 3, 4])], () => ++count);
    eval(TEST('count === 5'));
  },
  function test_gen_lp_authz_small_org() {
    const store = new TupleStore();
    store.addTuple('eng', 'member', 'alice');
    store.addTuple('staff', 'member', groupKey('eng'));
    store.addParent('doc1', 'root');
    store.addTuple('doc1', 'owner', 'alice');
    store.addTuple('root', 'viewer', groupKey('staff'));
    const rules = makeRules(store);
    const can = (user, rel, obj) => !gen(rules, 'check', [user, rel, obj]).next().done;
    eval(TEST("can('alice', 'owner', 'doc1')"));
    eval(TEST("can('alice', 'viewer', 'doc1')"));
    eval(TEST("can('alice', 'viewer', 'root')"));
    eval(TEST("!can('alice', 'editor', 'root')"));
    eval(TEST("!can('bob', 'viewer', 'doc1')"));
  },
  function test_gen_lp_authz_oracle() {
    const org = generateOrg({
      users: 60,
      groups: 10,
      docs: 200,
      tuples: 500,
      folderRoots: 3,
      queryCounts: {direct: 50, group: 50, implied: 50, inherited: 50, denial: 100}
    });
    const rules = makeRules(org.store);
    let mismatches = 0;
    for (const query of org.mixed) {
      const verdict = !gen(rules, 'check', [query.u, query.r, query.o]).next().done;
      if (verdict !== query.expect) ++mismatches;
    }
    eval(TEST('mismatches === 0'));
  }
];
