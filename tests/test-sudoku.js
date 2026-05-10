// Sudoku — strict-Prolog front-end dogfood.
//
// 4×4 mini-Sudoku with 2×2 boxes. Each row, column, and box must be a
// permutation of {1, 2, 3, 4}. Encoding fills each row from the
// {1,2,3,4} domain, checks row distinctness immediately (so failures
// prune before all 16 cells are bound), then checks column and box
// distinctness on the assembled grid. Encoding original.
//
// Sudoku in any size has been a public-domain combinatorial problem
// since at least Howard Garns's 1979 "Number Place" puzzle in Dell
// Magazines; smaller variants long predate it. Algorithms aren't
// copyrightable; the encoding here is yopl-original.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {submit, TEST} from './harness.js';
import {makeList} from './helpers.js';

const puzzle = prolog`
  sudoku([R1, R2, R3, R4]) :-
    R1 = [_, _, _, _], fill_row(R1), distinct(R1),
    R2 = [_, _, _, _], fill_row(R2), distinct(R2),
    R3 = [_, _, _, _], fill_row(R3), distinct(R3),
    R4 = [_, _, _, _], fill_row(R4), distinct(R4),
    R1 = [A1, A2, A3, A4],
    R2 = [B1, B2, B3, B4],
    R3 = [C1, C2, C3, C4],
    R4 = [D1, D2, D3, D4],
    distinct([A1, B1, C1, D1]),
    distinct([A2, B2, C2, D2]),
    distinct([A3, B3, C3, D3]),
    distinct([A4, B4, C4, D4]),
    distinct([A1, A2, B1, B2]),
    distinct([A3, A4, B3, B4]),
    distinct([C1, C2, D1, D2]),
    distinct([C3, C4, D3, D4]).

  fill_row([]).
  fill_row([X | T]) :- member(X, [1, 2, 3, 4]), fill_row(T).

  distinct([]).
  distinct([X | T]) :- \\+ member(X, T), distinct(T).

  member(X, [X | _]).
  member(X, [_ | T]) :- member(X, T).
`;

const sudokuRules = {...systemRules, ...puzzle};

const consToArray = cons => {
  const out = [];
  for (let c = cons; c; c = c.next) out.push(c.value);
  return out;
};

const gridToArrays = grid => consToArray(grid).map(consToArray);

const flat = grid => grid.reduce((acc, row) => acc.concat(row), []);

const solvePuzzle = clues => {
  const cells = clues.map((row, r) => row.map((cell, c) => cell !== null ? cell : v(`r${r}c${c}`)));
  const grid = makeList(cells.map(row => makeList(row)));
  const solutions = [];
  solve(sudokuRules, 'sudoku', [grid], env => {
    solutions.push(gridToArrays(assemble(grid, env)));
  });
  return solutions;
};

export default [
  function test_sudoku_unique_solution() {
    // 9 clues, leaves 7 unknowns. Unique solution.
    const solutions = solvePuzzle([
      [1,    2,    null, 4   ],
      [null, 4,    1,    null],
      [null, 1,    4,    null],
      [4,    null, null, 1   ]
    ]);
    eval(TEST('solutions.length === 1'));
    const expected = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1]
    ];
    eval(TEST('JSON.stringify(solutions[0]) === JSON.stringify(expected)'));
  },
  function test_sudoku_two_solutions() {
    // 8 clues — drop (1,2)=2 from the unique puzzle. Gives 2 solutions.
    const solutions = solvePuzzle([
      [1,    null, null, 4   ],
      [null, 4,    1,    null],
      [null, 1,    4,    null],
      [4,    null, null, 1   ]
    ]);
    eval(TEST('solutions.length === 2'));
    const allFlat = solutions.map(s => flat(s).join(','));
    eval(TEST('allFlat.includes("1,2,3,4,3,4,1,2,2,1,4,3,4,3,2,1")'));
    eval(TEST('allFlat.includes("1,3,2,4,2,4,1,3,3,1,4,2,4,2,3,1")'));
  }
];
