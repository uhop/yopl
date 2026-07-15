// Regime-B JS-source lowering: behavioral parity of a jsrc-lowered rules
// dict against the baseline closure lowering — facts, recursion, cut, fail,
// zero-arg (string) goals, wildcard freshness, ground and IR-bearing
// literals, dynamic call, js inline goals (math rules re-lowered from their
// attached IR) — plus the aliasing bail: a plain object repeated inside one
// Lit value falls back to the baseline walk, preserving output aliasing.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import {prolog} from '../src/compile/prolog/index.js';
import {IR, Rule, Clause, Lit, Var, Call} from '../src/compile/ir.js';
import {lowerRules as lowerJsrcRules} from '../src/compile/lower-jsrc.js';
import {lowerRules} from '../src/compile/lower.js';
import {rules as mathRules} from '../src/rules/math.js';
import solve from '../src/solve.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

const PROGRAM = `
  implies("owner", "editor").
  implies("editor", "viewer").
  edge(a, b).
  edge(b, c).
  path(X, Y) :- edge(X, Y).
  path(X, Y) :- edge(X, Z), path(Z, Y).
  firstImplied(S, R) :- implies(S, R), !.
  never :- fail.
  callsNever :- never.
  member(V, [V | _]).
  member(V, [_ | X]) :- member(V, X).
  ground([1, 2, 3]).
`;

const irDict = prolog.with({lower: false})(PROGRAM);
const jsrcRules = lowerJsrcRules(Object.values(irDict));
const baseRules = prolog(PROGRAM);

const mathJsrcRules = lowerJsrcRules(Object.values(mathRules[IR]));

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

export default [
  function test_jsrc_fact_and_recursion_parity() {
    const S = v('S'),
      R = v('R');
    eval(TEST("collect(jsrcRules, 'implies', [S, R], [S, R]) === collect(baseRules, 'implies', [S, R], [S, R])"));
    const X = v('X');
    eval(TEST("collect(jsrcRules, 'path', ['a', X], [X]) === collect(baseRules, 'path', ['a', X], [X])"));
    eval(TEST("collect(jsrcRules, 'path', ['a', X], [X]) === 'b;c'"));
  },
  function test_jsrc_member_wildcard_freshness() {
    const X = v('X');
    const list = makeList([1, 2, 3]);
    eval(TEST("count(jsrcRules, 'member', [X, list]) === 3"));
    eval(TEST("count(jsrcRules, 'member', [3, list]) === count(baseRules, 'member', [3, list])"));
  },
  function test_jsrc_cut_fail_and_string_goals() {
    const S = v('S');
    eval(TEST("collect(jsrcRules, 'firstImplied', [S, 'editor'], [S]) === collect(baseRules, 'firstImplied', [S, 'editor'], [S])"));
    eval(TEST("count(jsrcRules, 'never', []) === 0"));
    eval(TEST("count(jsrcRules, 'callsNever', []) === 0"));
  },
  function test_jsrc_ground_literal_fresh_per_activation() {
    const X = v('X');
    eval(TEST("collect(jsrcRules, 'ground', [X], [X]) === collect(baseRules, 'ground', [X], [X])"));
    const fn = jsrcRules.ground[0];
    eval(TEST('fn.length === 0'));
    eval(TEST('fn()[0].args[0] !== fn()[0].args[0]'));
  },
  function test_jsrc_fn_length_parity() {
    eval(TEST('jsrcRules.path[1].length === baseRules.path[1].length'));
    eval(TEST('jsrcRules.member[1].length === baseRules.member[1].length'));
    eval(TEST('jsrcRules.never[0].length === baseRules.never[0].length'));
  },
  function test_jsrc_dynamic_call() {
    const ir = [Rule('anyGoal', 1, [Clause([Var('G')], [Call(Var('G'), [])])])];
    const jsrc = lowerJsrcRules(ir.concat(Object.values(irDict)));
    const base = lowerRules(ir.concat(Object.values(irDict)));
    const R = v('R');
    eval(
      TEST("collect(jsrc, 'anyGoal', [{name: 'implies', args: ['owner', R]}], [R]) === collect(base, 'anyGoal', [{name: 'implies', args: ['owner', R]}], [R])")
    );
    eval(TEST("collect(jsrc, 'anyGoal', [{name: 'implies', args: ['owner', R]}], [R]) === 'editor'"));
  },
  function test_jsrc_js_goals_math_parity() {
    const Z = v('Z');
    eval(TEST("collect(mathJsrcRules, 'add', [2, 3, Z], [Z]) === collect(mathRules, 'add', [2, 3, Z], [Z])"));
    eval(TEST("collect(mathJsrcRules, 'add', [2, 3, Z], [Z]) === '5'"));
    const Y = v('Y');
    eval(TEST("collect(mathJsrcRules, 'add', [2, Y, 5], [Y]) === '3'"));
    eval(TEST("count(mathJsrcRules, 'add', [2, 3, 5]) === count(mathRules, 'add', [2, 3, 5])"));
    eval(TEST("count(mathJsrcRules, 'add', [2, 3, 6]) === 0"));
  },
  function test_jsrc_aliasing_bails_to_closure() {
    const shared = {n: 1};
    const ir = [Rule('dag', 1, [Clause([Lit({x: shared, y: shared})], [])])];
    const jsrc = lowerJsrcRules(ir);
    const base = lowerRules(ir);
    const X = v('X');
    let jsrcOut, baseOut;
    solve(jsrc, 'dag', [X], env => (jsrcOut = assemble(X, env)));
    solve(base, 'dag', [X], env => (baseOut = assemble(X, env)));
    eval(TEST('jsrcOut.x === jsrcOut.y'));
    eval(TEST('baseOut.x === baseOut.y'));
    eval(TEST('jsrcOut.x !== shared'));
  }
];
