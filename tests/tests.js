import {runAllTests} from './harness.js';

import solveTests from './test-solve.js';
import genTests from './test-gen.js';
import asyncTests from './test-async.js';
import asyncGenTests from './test-asyncGen.js';
import systemTests from './test-system.js';
import rulesTests from './test-rules.js';
import compileTests from './test-compile.js';

runAllTests([
  ...solveTests,
  ...genTests,
  ...asyncTests,
  ...asyncGenTests,
  ...systemTests,
  ...rulesTests,
  ...compileTests
]);
