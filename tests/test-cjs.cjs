// Manual CommonJS interop smoke test.
//
// Run with: node tests/test-cjs.cjs
//
// Demonstrates that yopl's pure-ESM source can be consumed from a
// CommonJS module via the built-in dynamic `import()` interop.

'use strict';

const path = require('path');
const url = require('url');

const toEsm = relPath => url.pathToFileURL(path.join(__dirname, '..', 'src', relPath)).href;

(async () => {
  const {default: solve} = await import(toEsm('solve.js'));
  const {default: gen} = await import(toEsm('solvers/gen.js'));
  const {variable} = await import('deep6/unify.js');
  const {default: assemble} = await import('deep6/traverse/assemble.js');

  const rules = {
    member: [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]]
  };

  const list = {value: 1, next: {value: 2, next: {value: 3, next: null}}};

  // 1. Callback-style solver.
  console.log('-- callback-style solver --');
  const X = variable('X');
  solve(rules, 'member', [list, X], env => {
    console.log('  X =', assemble(X, env));
  });

  // 2. Generator-style solver.
  console.log('-- generator-style solver --');
  const Y = variable('Y');
  for (const env of gen(rules, 'member', [list, Y])) {
    console.log('  Y =', assemble(Y, env));
  }

  console.log('Done.');
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
