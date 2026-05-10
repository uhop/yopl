// Tower of Hanoi — strict-Prolog front-end dogfood.
//
// Puzzle origin: Édouard Lucas, 1883 (public domain). The recursive
// solution below is the canonical textbook formulation; algorithms
// aren't copyrightable and the encoding is original.
//
// Three pegs, N disks of decreasing size stacked on the source peg.
// Move all disks to the destination peg, one at a time, never placing
// a larger disk on a smaller one. Optimal solution: 2^N - 1 moves.
//
// Disks are represented as a list (length encodes N) so the encoding
// doesn't need is/2 arithmetic. Each move is `move(From, To)`.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

const puzzle = prolog`
  hanoi([], _, _, _, []).
  hanoi([_ | Disks], From, To, Via, Moves) :-
    hanoi(Disks, From, Via, To, MovesA),
    hanoi(Disks, Via, To, From, MovesB),
    append(MovesA, [move(From, To) | MovesB], Moves).

  append([], L, L).
  append([X | T], L, [X | R]) :- append(T, L, R).
`;

const hanoiRules = {...systemRules, ...puzzle};

const consToArray = cons => {
  const out = [];
  for (let c = cons; c; c = c.next) out.push(c.value);
  return out;
};

export default [
  function test_hanoi_three_disks() {
    const Moves = v('Moves');
    let solutionCount = 0;
    let moves = null;
    solve(hanoiRules, 'hanoi', [makeList(['d1', 'd2', 'd3']), 'left', 'right', 'middle', Moves], env => {
      ++solutionCount;
      moves = consToArray(assemble(Moves, env));
    });
    eval(TEST('solutionCount === 1'));
    eval(TEST('moves.length === 7'));
    const expected = [
      {name: 'move', args: ['left', 'right']},
      {name: 'move', args: ['left', 'middle']},
      {name: 'move', args: ['right', 'middle']},
      {name: 'move', args: ['left', 'right']},
      {name: 'move', args: ['middle', 'left']},
      {name: 'move', args: ['middle', 'right']},
      {name: 'move', args: ['left', 'right']}
    ];
    eval(TEST('JSON.stringify(moves) === JSON.stringify(expected)'));
  },
  function test_hanoi_one_disk() {
    const Moves = v('Moves');
    let moves = null;
    solve(hanoiRules, 'hanoi', [makeList(['d1']), 'a', 'c', 'b', Moves], env => {
      moves = consToArray(assemble(Moves, env));
    });
    eval(TEST('moves.length === 1'));
    eval(TEST("moves[0].name === 'move' && moves[0].args[0] === 'a' && moves[0].args[1] === 'c'"));
  },
  function test_hanoi_zero_disks() {
    const Moves = v('Moves');
    let moves = null;
    solve(hanoiRules, 'hanoi', [null, 'a', 'c', 'b', Moves], env => {
      moves = assemble(Moves, env);
    });
    eval(TEST('moves === null'));
  }
];
