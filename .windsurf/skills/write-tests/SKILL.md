---
name: write-tests
description: Write or update tests for a module or feature in yopl. Use when asked to write tests, add coverage, or verify functionality.
---

# Write Tests for yopl

Write or update tests for the yopl library.

## Steps

1. Identify the module or feature to test. Read its source under `src/` to understand the public API.
2. Choose the appropriate test file:
   - `tests/test-solve.js` — default sync solver (`src/solve.js`)
   - `tests/test-gen.js` — generator solver (`src/solvers/gen.js`)
   - `tests/test-async.js` — async callback solver (`src/solvers/async.js`)
   - `tests/test-asyncGen.js` — async generator solver (`src/solvers/asyncGen.js`)
   - `tests/test-rules.js` — built-in rule libraries (logic, comp, math, bits)
   - `tests/test-system.js` — system rules
   - For an entirely new area, create `tests/test-foo.js` and wire it into `tests/tests.js`.
3. Add test functions to the exported array in the chosen file.
4. Run the suite: `npm test`.
5. Report results and any failures.

## Test harness

Tests use a custom harness in `tests/harness.js`. Each test file imports `submit` and `TEST`, exports a default array of test functions:

```js
import unify, {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {submit, TEST} from './harness.js';

export default [
  function test_my_feature() {
    const rules = {
      'one/1': () => [{args: [1]}]
    };
    const X = v('X');
    const result = [];
    solve(rules, 'one/1', [X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1])'));
  }
];
```

## Conventions

- Import source modules with relative paths: `import solve from '../src/solve.js';`.
- Import `{submit, TEST}` from `./harness.js`.
- Use `eval(TEST('expression'))` for assertions — the expression is both the test and the message.
- Name test functions `test_descriptive_name`.
- Test both success and failure cases (rules that succeed, rules that fail to unify, multi-solution backtracking).
- Use `assemble(var, env)` from `deep6/traverse/assemble.js` to extract bound values.
- For list-shaped data, use the `makeList` helper from `tests/helpers.js`.
- For async solvers, return a promise from the test or use the harness's async support.
