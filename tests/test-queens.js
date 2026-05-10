// N-queens — strict-Prolog front-end dogfood.
//
// Problem origin: Max Bezzel, 1848 (public domain). Place N queens on
// an N×N board so no two attack each other. Solution is a list whose
// i-th element is the row of the queen in column i — implicitly
// enforcing column distinctness; rows are kept distinct by drawing
// from a permutation of 1..N; diagonals are checked explicitly.
//
// Encoding uses column-by-column placement with incremental
// safety-against-already-placed checks, so failures prune early
// (much faster than generate-permutation-then-test). Encoding original.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {rules as compRules} from '../src/rules/comp.js';
import {rules as mathRules} from '../src/rules/math.js';
import {submit, TEST} from './harness.js';

const puzzle = prolog`
  queens(N, Solution) :-
    range(1, N, Cols),
    place(Cols, [], Solution).

  range(L, H, [L | T]) :- L =< H, L1 is L + 1, range(L1, H, T).
  range(L, H, []) :- L > H.

  place([], Sol, Sol).
  place(Avail, Placed, Solution) :-
    select(Q, Avail, Rest),
    safe_against(Q, Placed, 1),
    place(Rest, [Q | Placed], Solution).

  select(X, [X | T], T).
  select(X, [H | T], [H | R]) :- select(X, T, R).

  safe_against(_, [], _).
  safe_against(Q, [Q1 | Qs], D) :-
    Diff is Q - Q1,
    Diff \\= D,
    NegD is -D,
    Diff \\= NegD,
    D1 is D + 1,
    safe_against(Q, Qs, D1).
`;

const queensRules = {...systemRules, ...compRules, ...mathRules, ...puzzle};

const consToArray = cons => {
  const out = [];
  for (let c = cons; c; c = c.next) out.push(c.value);
  return out;
};

const validQueens = solution => {
  for (let i = 0; i < solution.length; ++i) {
    for (let j = i + 1; j < solution.length; ++j) {
      if (solution[i] === solution[j]) return false;
      if (Math.abs(solution[i] - solution[j]) === j - i) return false;
    }
  }
  return true;
};

export default [
  function test_queens_4_count_solutions() {
    const Sol = v('Sol');
    const solutions = [];
    solve(queensRules, 'queens', [4, Sol], env => {
      solutions.push(consToArray(assemble(Sol, env)));
    });
    eval(TEST('solutions.length === 2'));
    eval(TEST('solutions.every(validQueens)'));
  },
  function test_queens_6_count_solutions() {
    const Sol = v('Sol');
    const solutions = [];
    solve(queensRules, 'queens', [6, Sol], env => {
      solutions.push(consToArray(assemble(Sol, env)));
    });
    eval(TEST('solutions.length === 4'));
    eval(TEST('solutions.every(validQueens)'));
  },
  function test_queens_8_count_solutions() {
    const Sol = v('Sol');
    const solutions = [];
    solve(queensRules, 'queens', [8, Sol], env => {
      solutions.push(consToArray(assemble(Sol, env)));
    });
    eval(TEST('solutions.length === 92'));
    eval(TEST('solutions.every(validQueens)'));
  }
];
