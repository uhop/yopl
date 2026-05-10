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

runAllTests([...solveTests, ...genTests, ...asyncTests, ...asyncGenTests, ...systemTests, ...nativeTests, ...rulesTests, ...compileTests, ...compileExprTests]);
