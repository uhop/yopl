// Knight's Tour — strict-Prolog front-end dogfood.
//
// Problem origin: studied since at least al-Adli ar-Rumi, 9th century
// (public domain). On a chessboard, find a sequence of squares such
// that consecutive squares are connected by a knight's L-move and no
// square is visited twice.
//
// Naïve depth-first backtracking on the full 5×5 open tour (25 cells)
// would explore millions of dead-end paths before finding a solution
// — Warnsdorff's heuristic or constraint propagation is the textbook
// fix. Without that, we test the same machinery (arithmetic move
// generation + visited-set pruning + recursive descent) on a bounded
// partial tour, which finishes deterministically. Encoding original.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {rules as compRules} from '../src/rules/comp.js';
import {rules as mathRules} from '../src/rules/math.js';
import {submit, TEST} from './harness.js';

const puzzle = prolog`
  tour(StartX, StartY, N, [pair(StartX, StartY) | Rest]) :-
    visit(StartX, StartY, [pair(StartX, StartY)], N, Rest).

  visit(_, _, _, 0, []).
  visit(X, Y, Visited, N, [pair(X2, Y2) | More]) :-
    N > 0,
    move(X, Y, X2, Y2),
    in_board(X2, Y2),
    \\+ member(pair(X2, Y2), Visited),
    N1 is N - 1,
    visit(X2, Y2, [pair(X2, Y2) | Visited], N1, More).

  move(X, Y, X2, Y2) :- X2 is X + 1, Y2 is Y + 2.
  move(X, Y, X2, Y2) :- X2 is X + 2, Y2 is Y + 1.
  move(X, Y, X2, Y2) :- X2 is X + 2, Y2 is Y - 1.
  move(X, Y, X2, Y2) :- X2 is X + 1, Y2 is Y - 2.
  move(X, Y, X2, Y2) :- X2 is X - 1, Y2 is Y - 2.
  move(X, Y, X2, Y2) :- X2 is X - 2, Y2 is Y - 1.
  move(X, Y, X2, Y2) :- X2 is X - 2, Y2 is Y + 1.
  move(X, Y, X2, Y2) :- X2 is X - 1, Y2 is Y + 2.

  in_board(X, Y) :- X >= 1, X =< 5, Y >= 1, Y =< 5.

  member(X, [X | _]).
  member(X, [_ | T]) :- member(X, T).

  reachable(X, Y, X2, Y2) :- move(X, Y, X2, Y2), in_board(X2, Y2).
`;

const knightRules = {...systemRules, ...compRules, ...mathRules, ...puzzle};

const consToArray = cons => {
  const out = [];
  for (let c = cons; c; c = c.next) out.push(c.value);
  return out;
};

const isKnightMove = (a, b) => {
  const dx = Math.abs(a.args[0] - b.args[0]);
  const dy = Math.abs(a.args[1] - b.args[1]);
  return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
};

export default [
  function test_knight_partial_tour_10_steps() {
    const Path = v('Path');
    let path = null;
    solve(knightRules, 'tour', [1, 1, 10, Path], env => {
      if (!path) path = consToArray(assemble(Path, env));
    });
    eval(TEST('path !== null'));
    eval(TEST('path.length === 11'));
    eval(TEST("path[0].name === 'pair' && path[0].args[0] === 1 && path[0].args[1] === 1"));
    const seen = new Set(path.map(s => `${s.args[0]},${s.args[1]}`));
    eval(TEST('seen.size === 11'));
    let allValid = true;
    for (let i = 1; i < path.length; ++i) {
      if (!isKnightMove(path[i - 1], path[i])) allValid = false;
    }
    eval(TEST('allValid === true'));
  },
  function test_knight_moves_from_center() {
    const X2 = v('X2');
    const Y2 = v('Y2');
    const moves = [];
    solve(knightRules, 'reachable', [3, 3, X2, Y2], env => {
      moves.push([assemble(X2, env), assemble(Y2, env)]);
    });
    eval(TEST('moves.length === 8'));
  },
  function test_knight_moves_from_corner() {
    const X2 = v('X2');
    const Y2 = v('Y2');
    const moves = [];
    solve(knightRules, 'reachable', [1, 1, X2, Y2], env => {
      moves.push([assemble(X2, env), assemble(Y2, env)]);
    });
    eval(TEST('moves.length === 2'));
    const sorted = moves.map(m => m.join(',')).sort();
    eval(TEST("JSON.stringify(sorted) === JSON.stringify(['2,3', '3,2'])"));
  }
];
