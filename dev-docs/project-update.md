# Project update

This is a logic solver similar to Prolog, but written in JS.

Read `README.md` and files in `wiki/` for more info. These files are minimal and should be improved
later, but they provide some initial information.

## Step 1: copy settings

Copy and adapt settings and AI-related filess from `../deep6/` project, which this project
depends on. Don't forget to copy all hidden files and directories (starting with `.`).
Adapt relevant files from `.github/`.

Copy TS-related settings &mdash; we'll be doing TS typings later. Copy relevant scripts
from `package.json`.

Copy test-related documents and settings because next we will work on tests.

## Step 2: tests

Adapt the test setup from `../deep6/tests/` and restructure tests similarly. Analyze excisting
tests for coverage and add missing tests.

## Step 3: TS typings

Create TS typings for all `.js` files in `src/`. Create JSDoc descriptions for IDE use
aiming for factuality, brevity and clarity. Document all parameters and return types of
all functions and methods. Parameter names in `.d.ts` files should correspond directly
to such names in the original `.js` files.

Create a test file (`.ts`) in `tests/` to test TS typings only. All functional tests should be
in `.js` files only. This file will be used for `npm run ts-check` and to run manually.

## Step 4: documentation

Document every module in `wiki/` using the relevant global skill. Create a proper
content for `wiki/Home.md`. Update `README.md` and relevant AI-related docs.

## Step 5: optimization

Analyze solvers (`src/solve.js`, `src/solvers/`) looking for potential bugs and
improvement opportunities. Then analyze them if their performance can be improved.
