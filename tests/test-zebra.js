// Zebra puzzle — strict-Prolog front-end dogfood.
//
// Puzzle origin: Life International, 1962 (public domain). The encoding
// below is original and follows the standard 5-houses formulation:
//
//   1.  Five houses in a row.
//   2.  The Englishman lives in the red house.
//   3.  The Spaniard owns the dog.
//   4.  Coffee is drunk in the green house.
//   5.  The Ukrainian drinks tea.
//   6.  The green house is immediately to the right of the ivory house.
//   7.  The Old Gold smoker owns snails.
//   8.  Kools are smoked in the yellow house.
//   9.  Milk is drunk in the middle house.
//   10. The Norwegian lives in the first house.
//   11. Chesterfields are smoked next to the fox.
//   12. Kools are smoked next to the horse.
//   13. The Lucky Strike smoker drinks orange juice.
//   14. The Japanese smokes Parliaments.
//   15. The Norwegian lives next to the blue house.
//
// Question: who owns the zebra and who drinks water?
// Unique solution: Japanese owns the zebra, Norwegian drinks water.
//
// Distinctness note: pure-Prolog member-style constraints don't enforce
// that each attribute value is unique across houses. Without distinct/1
// the search produces many configurations that satisfy every individual
// member but assign the same color (etc.) to two houses. The trailing
// distinct(...) calls prune to one answer.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {submit, TEST} from './harness.js';

const puzzle = prolog`
  zebra(Houses, ZebraOwner, WaterDrinker) :-
    Houses = [
      house(norwegian, C1, P1, D1, S1),
      house(N2, C2, P2, D2, S2),
      house(N3, C3, P3, milk, S3),
      house(N4, C4, P4, D4, S4),
      house(N5, C5, P5, D5, S5)
    ],
    member(house(englishman, red, _, _, _), Houses),
    member(house(spaniard, _, dog, _, _), Houses),
    member(house(_, green, _, coffee, _), Houses),
    member(house(ukrainian, _, _, tea, _), Houses),
    rightOf(
      house(_, green, _, _, _),
      house(_, ivory, _, _, _),
      Houses
    ),
    member(house(_, _, snails, _, oldGold), Houses),
    member(house(_, yellow, _, _, kools), Houses),
    nextTo(
      house(_, _, _, _, chesterfields),
      house(_, _, fox, _, _),
      Houses
    ),
    nextTo(
      house(_, _, _, _, kools),
      house(_, _, horse, _, _),
      Houses
    ),
    member(house(_, _, _, orangeJuice, luckyStrike), Houses),
    member(house(japanese, _, _, _, parliaments), Houses),
    nextTo(
      house(norwegian, _, _, _, _),
      house(_, blue, _, _, _),
      Houses
    ),
    member(house(ZebraOwner, _, zebra, _, _), Houses),
    member(house(WaterDrinker, _, _, water, _), Houses),
    distinct([norwegian, N2, N3, N4, N5]),
    distinct([C1, C2, C3, C4, C5]),
    distinct([P1, P2, P3, P4, P5]),
    distinct([D1, D2, milk, D4, D5]),
    distinct([S1, S2, S3, S4, S5]).

  member(X, [X | _]).
  member(X, [_ | T]) :- member(X, T).

  rightOf(R, L, [L, R | _]).
  rightOf(R, L, [_ | T]) :- rightOf(R, L, T).

  nextTo(A, B, L) :- rightOf(A, B, L).
  nextTo(A, B, L) :- rightOf(B, A, L).

  distinct([]).
  distinct([X | T]) :- \\+ member(X, T), distinct(T).
`;

const zebraRules = {...systemRules, ...puzzle};

export default [
  function test_zebra_unique_solution() {
    const Houses = v('Houses');
    const Zebra = v('Zebra');
    const Water = v('Water');
    let solutionCount = 0;
    let zebraOwner = null;
    let waterDrinker = null;
    solve(zebraRules, 'zebra', [Houses, Zebra, Water], env => {
      ++solutionCount;
      zebraOwner = assemble(Zebra, env);
      waterDrinker = assemble(Water, env);
    });
    eval(TEST('solutionCount === 1'));
    eval(TEST('zebraOwner === "japanese"'));
    eval(TEST('waterDrinker === "norwegian"'));
  }
];
