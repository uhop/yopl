import {runAllTests} from './harness.js';

import solveTests from './test-solve.js';
import genTests from './test-gen.js';
import asyncTests from './test-async.js';
import asyncGenTests from './test-asyncGen.js';
import systemTests from './test-system.js';
import nativeTests from './test-native.js';
import rulesTests from './test-rules.js';
import compileTests from './test-compile.js';
import compileExprTests from './test-compile-expr.js';
import compilePrologTests from './test-compile-prolog.js';
import solveBacktrackTests from './test-solve-backtrack.js';
import zebraTests from './test-zebra.js';
import hanoiTests from './test-hanoi.js';
import wgcTests from './test-wgc.js';
import qsortTests from './test-qsort.js';
import isTests from './test-is.js';
import knightTests from './test-knight.js';
import queensTests from './test-queens.js';
import sudokuTests from './test-sudoku.js';

runAllTests([
  ...solveTests,
  ...genTests,
  ...asyncTests,
  ...asyncGenTests,
  ...systemTests,
  ...nativeTests,
  ...rulesTests,
  ...compileTests,
  ...compileExprTests,
  ...compilePrologTests,
  ...solveBacktrackTests,
  ...zebraTests,
  ...hanoiTests,
  ...wgcTests,
  ...qsortTests,
  ...isTests,
  ...knightTests,
  ...queensTests,
  ...sudokuTests
]);
