// Constant-output classifier + B′ lowering: classification unit tests, the
// shared-terms identity property, and behavioral parity of a B′-lowered
// rules dict against the baseline lowering (incl. backtracking over shared
// ground facts and cut in a mixed rule).

import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import {prolog} from '../src/compile/prolog/index.js';
import {IR} from '../src/compile/ir.js';
import {isConstantOutput} from '../src/compile/analysis/constant-output.js';
import {lowerRules as lowerConstRules} from '../src/compile/lower-const.js';
import solve from '../src/solve.js';
import {submit, TEST} from './harness.js';

const PROGRAM = `
  implies("owner", "editor").
  implies("editor", "viewer").
  edge(a, b).
  edge(b, c).
  path(X, Y) :- edge(X, Y).
  path(X, Y) :- edge(X, Z), path(Z, Y).
  firstImplied(S, R) :- implies(S, R), !.
  never :- fail.
`;

const irDict = prolog.with({lower: false})(PROGRAM);
const constRules = lowerConstRules(Object.values(irDict));
const baseRules = prolog(PROGRAM);

const collect = (rules, name, args, wanted) => {
  const result = [];
  solve(rules, name, args, env => result.push(wanted.map(w => assemble(w, env)).join(',')));
  return result.sort().join(';');
};

export default [
  function test_const_classifier() {
    eval(TEST('isConstantOutput(irDict.implies.clauses[0])'));
    eval(TEST('isConstantOutput(irDict.edge.clauses[0])'));
    eval(TEST('isConstantOutput(irDict.never.clauses[0])'));
    eval(TEST('!isConstantOutput(irDict.path.clauses[0])'));
    eval(TEST('!isConstantOutput(irDict.path.clauses[1])'));
    eval(TEST('!isConstantOutput(irDict.firstImplied.clauses[0])'));
  },
  function test_const_classifier_wildcard_and_lit_ir() {
    const dict = prolog.with({lower: false})`
      wild(_, 1).
      litIR([X | _]).
      ground([1, 2, 3]).
    `;
    eval(TEST('!isConstantOutput(dict.wild.clauses[0])'));
    eval(TEST('!isConstantOutput(dict.litIR.clauses[0])'));
    eval(TEST('isConstantOutput(dict.ground.clauses[0])'));
  },
  function test_const_lowering_shares_terms() {
    const fn = constRules.implies[0];
    eval(TEST('fn() === fn()'));
    eval(TEST('fn.length === 0'));
    const pathFn = constRules.path[0];
    eval(TEST('pathFn() !== pathFn()'));
  },
  function test_const_lowering_behavior_parity() {
    const S = v('S'),
      R = v('R');
    eval(TEST("collect(constRules, 'implies', [S, R], [S, R]) === collect(baseRules, 'implies', [S, R], [S, R])"));
    const X = v('X');
    eval(TEST("collect(constRules, 'path', ['a', X], [X]) === collect(baseRules, 'path', ['a', X], [X])"));
    eval(TEST("collect(constRules, 'path', ['a', X], [X]) === 'b;c'"));
  },
  function test_const_lowering_repeated_activations_stay_independent() {
    // the same shared fact is activated on both sides of a conjunction —
    // bindings must not leak between activations of the shared terms
    const dict = prolog.with({lower: false})`
      pair(X, Y) :- implies(X, T), implies(T, Y).
      implies("owner", "editor").
      implies("editor", "viewer").
    `;
    const rules = lowerConstRules(Object.values(dict));
    const X = v('X'),
      Y = v('Y');
    eval(TEST("collect(rules, 'pair', [X, Y], [X, Y]) === 'owner,viewer'"));
  },
  function test_const_lowering_cut_in_mixed_rule() {
    const S = v('S');
    eval(TEST("collect(constRules, 'firstImplied', [S, 'editor'], [S]) === collect(baseRules, 'firstImplied', [S, 'editor'], [S])"));
    let count = 0;
    solve(constRules, 'never', [], () => ++count);
    eval(TEST('count === 0'));
  }
];
