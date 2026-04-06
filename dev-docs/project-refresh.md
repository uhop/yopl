# Project refresh

A logic solver similar to Prolog, written in JS.

See `README.md` and `wiki/` for background. Both are minimal and will be improved later.

## Step 1: copy settings

Copy and adapt settings and AI-related files from the `../deep6/` project, which this project
depends on. Include all hidden files and directories (those starting with `.`), and adapt
relevant files under `.github/`.

Copy TS-related settings — TS typings come later. Copy relevant scripts from `package.json`.

Copy test-related docs and settings; tests are the next step.

## Step 2: remove CJS

Instead of generating CJS files from ESM sources, import ESM from CommonJS modules using
Node's built-in interop.

Remove all Babel-related settings, scripts, and dependencies.

Update `exports` in `package.json`: drop CJS exports and per-file entries, and export the
`src/` folder instead.

## Step 3: tests

Adapt the test setup from `../deep6/tests/` and restructure tests the same way. Review
existing tests for coverage and add what's missing.

Add a manual `.cjs` test demonstrating how to use this project from CommonJS modules.

## Step 4: TS typings

Create TS typings for every `.js` file in `src/`. Write JSDoc comments for IDE use, aiming
for factuality, brevity, and clarity. Document all parameters and return types of every
function and method. Parameter names in `.d.ts` files must match those in the original
`.js` files.

Add a `.ts` test file under `tests/` that exercises typings only. All functional tests
remain in `.js`. This file is used by `npm run ts-check` and can be run manually.

## Step 5: documentation

Document every module in `wiki/` using the relevant global skill. Write proper content for
`wiki/Home.md`. Update `README.md` and the relevant AI-related docs.

## Step 6: optimization

Review the solvers (`src/solve.js`, `src/solvers/`) for potential bugs and improvements,
then look for performance gains.
