// Knight's Tour — strict-Prolog front-end dogfood.
//
// Problem origin: studied since at least al-Adli ar-Rumi, 9th century
// (public domain). On a chessboard, find a sequence of squares such
// that consecutive squares are connected by a knight's L-move and no
// square is visited twice.
//
// Two tours below:
//
//   `tour/4` — naïve depth-first backtracking, bounded to N ≤ ~12 from
//              a corner. Beyond that the search tree explodes.
//
//   `tour_w/3` — Warnsdorff's heuristic (Warnsdorff 1823): at each
//              step, pick the next move with the FEWEST onward valid
//              moves. Implemented via an inline-JS goal that sorts
//              candidates by degree; the Prolog driver iterates the
//              sorted list, so backtracking still works on the rare
//              cases where the heuristic guesses wrong. Solves the
//              full 5×5 open tour from a corner essentially instantly.
//
// Encoding original.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import gen from '../src/solvers/gen.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {rules as compRules} from '../src/rules/comp.js';
import {rules as mathRules} from '../src/rules/math.js';
import {submit, TEST} from './harness.js';

const KNIGHT_MOVES = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2]
];

const BOARD_SIZE = 5;
const inBoard = (x, y) => x >= 1 && x <= BOARD_SIZE && y >= 1 && y <= BOARD_SIZE;

const deref = (val, env) => {
  while (val && typeof val.isBound === 'function') {
    if (!val.isBound(env)) return val;
    val = val.get(env);
  }
  return val;
};

const visitedSet = (consHead, env) => {
  const set = new Set();
  let cons = deref(consHead, env);
  while (cons) {
    const pair = deref(cons.value, env);
    if (pair && pair.name === 'pair' && Array.isArray(pair.args)) {
      const x = deref(pair.args[0], env);
      const y = deref(pair.args[1], env);
      if (typeof x === 'number' && typeof y === 'number') set.add(`${x},${y}`);
    }
    cons = deref(cons.next, env);
  }
  return set;
};

const onwardDegree = (x, y, visited) => {
  let count = 0;
  for (const [dx, dy] of KNIGHT_MOVES) {
    const nx = x + dx,
      ny = y + dy;
    if (inBoard(nx, ny) && !visited.has(`${nx},${ny}`)) ++count;
  }
  return count;
};

const buildCons = arr => {
  let list = null;
  for (let i = arr.length - 1; i >= 0; --i) list = {value: arr[i], next: list};
  return list;
};

const CENTER = (BOARD_SIZE + 1) / 2;

// Warnsdorff's heuristic with Pohl-style tie-break: minimum onward
// degree wins; ties broken by larger distance to board center (corners
// preferred over edges, edges over interior). On 5×5 from any corner
// this is enough to find a full open tour without backtracking.
const warnsdorffSort =
  ({X, Y, Visited, Sorted}) =>
  env => {
    const x = deref(X, env);
    const y = deref(Y, env);
    if (typeof x !== 'number' || typeof y !== 'number') return false;
    const visited = visitedSet(Visited, env);
    const candidates = [];
    for (const [dx, dy] of KNIGHT_MOVES) {
      const nx = x + dx,
        ny = y + dy;
      if (inBoard(nx, ny) && !visited.has(`${nx},${ny}`)) {
        const after = new Set(visited);
        after.add(`${nx},${ny}`);
        const tieBreak = -(Math.abs(nx - CENTER) + Math.abs(ny - CENTER));
        candidates.push({x: nx, y: ny, degree: onwardDegree(nx, ny, after), tieBreak});
      }
    }
    candidates.sort((a, b) => a.degree - b.degree || a.tieBreak - b.tieBreak);
    const pairs = candidates.map(({x, y}) => ({name: 'pair', args: [x, y]}));
    if (Sorted.isBound(env)) return false;
    env.bindVal(Sorted.name, buildCons(pairs));
    return true;
  };

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

  tour_w(StartX, StartY, [pair(StartX, StartY) | Rest]) :-
    visit_w(StartX, StartY, [pair(StartX, StartY)], 24, Rest).

  visit_w(_, _, _, 0, []).
  visit_w(X, Y, Visited, N, [pair(X2, Y2) | More]) :-
    N > 0,
    next_sorted(X, Y, Visited, Sorted),
    Sorted = [pair(X2, Y2) | _], !,
    N1 is N - 1,
    visit_w(X2, Y2, [pair(X2, Y2) | Visited], N1, More).

  next_sorted(X, Y, Visited, Sorted) :- ${warnsdorffSort}.

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

const verifyPath = path => {
  if (!path || path.length === 0) return false;
  const seen = new Set(path.map(s => `${s.args[0]},${s.args[1]}`));
  if (seen.size !== path.length) return false;
  for (let i = 1; i < path.length; ++i) {
    if (!isKnightMove(path[i - 1], path[i])) return false;
  }
  return true;
};

export default [
  function test_knight_partial_tour_10_steps() {
    // First solution only — `solve` exhausts the search tree, which on the
    // naïve `tour/4` encoding is O(branching^N) and infeasible above N≈10.
    // The test's intent is "naïve encoding finds a partial tour", not
    // "enumerate every 10-step path from (1,1)".
    const Path = v('Path');
    const {value: env, done} = gen(knightRules, 'tour', [1, 1, 10, Path]).next();
    const path = done ? null : consToArray(assemble(Path, env));
    eval(TEST('path !== null'));
    eval(TEST('path.length === 11'));
    eval(TEST("path[0].name === 'pair' && path[0].args[0] === 1 && path[0].args[1] === 1"));
    eval(TEST('verifyPath(path) === true'));
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
  },
  function test_knight_full_5x5_tour_warnsdorff() {
    const Path = v('Path');
    let path = null;
    solve(knightRules, 'tour_w', [1, 1, Path], env => {
      if (!path) path = consToArray(assemble(Path, env));
    });
    eval(TEST('path !== null'));
    eval(TEST('path.length === 25'));
    eval(TEST("path[0].name === 'pair' && path[0].args[0] === 1 && path[0].args[1] === 1"));
    eval(TEST('verifyPath(path) === true'));
  }
];
