// Naïve quicksort — strict-Prolog front-end dogfood.
//
// Algorithm: C. A. R. Hoare, 1961. Algorithms aren't copyrightable
// (US 17 USC §102(b)); the Prolog encoding below is original.
//
// Standard "list quicksort" with the head as pivot, partition into
// smaller / larger, recursively sort each, then concatenate. Tests
// recursion + body-context comparison operators (< and >=) and list
// partitioning.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {rules as compRules} from '../src/rules/comp.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

const puzzle = prolog`
  qsort([], []).
  qsort([Pivot | Rest], Sorted) :-
    partition(Pivot, Rest, Smaller, Larger),
    qsort(Smaller, SortedSmaller),
    qsort(Larger, SortedLarger),
    append(SortedSmaller, [Pivot | SortedLarger], Sorted).

  partition(_, [], [], []).
  partition(Pivot, [X | Rest], [X | Smaller], Larger) :-
    X < Pivot,
    partition(Pivot, Rest, Smaller, Larger).
  partition(Pivot, [X | Rest], Smaller, [X | Larger]) :-
    X >= Pivot,
    partition(Pivot, Rest, Smaller, Larger).

  append([], L, L).
  append([X | T], L, [X | R]) :- append(T, L, R).
`;

const qsortRules = {...systemRules, ...compRules, ...puzzle};

const consToArray = cons => {
  const out = [];
  for (let c = cons; c; c = c.next) out.push(c.value);
  return out;
};

const sortViaQsort = input => {
  const Out = v('Out');
  let result = null;
  solve(qsortRules, 'qsort', [makeList(input), Out], env => {
    if (result === null) result = consToArray(assemble(Out, env));
  });
  return result;
};

export default [
  function test_qsort_empty() {
    const sorted = sortViaQsort([]);
    eval(TEST('sorted !== null'));
    eval(TEST('sorted.length === 0'));
  },
  function test_qsort_singleton() {
    const sorted = sortViaQsort([42]);
    eval(TEST('JSON.stringify(sorted) === JSON.stringify([42])'));
  },
  function test_qsort_already_sorted() {
    const sorted = sortViaQsort([1, 2, 3, 4, 5]);
    eval(TEST('JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])'));
  },
  function test_qsort_reverse_sorted() {
    const sorted = sortViaQsort([5, 4, 3, 2, 1]);
    eval(TEST('JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])'));
  },
  function test_qsort_random() {
    const sorted = sortViaQsort([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]);
    eval(TEST('JSON.stringify(sorted) === JSON.stringify([1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9])'));
  },
  function test_qsort_negatives_and_zero() {
    const sorted = sortViaQsort([0, -3, 7, -1, 2, 0, -3]);
    eval(TEST('JSON.stringify(sorted) === JSON.stringify([-3, -3, -1, 0, 0, 2, 7])'));
  }
];
