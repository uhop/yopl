---
description: Checklist for adding a new built-in rule module or solver driver to yopl
---

# Add a New Module

Follow these steps when adding a new built-in rule module or solver driver.

## Built-in rule module (e.g., `src/rules/foo.js`)

1. Create `src/rules/foo.js` with the implementation.
   - ES6 modules (`import`/`export`).
   - Follow existing patterns in `src/rules/logic.js`, `comp.js`, `math.js`, `bits.js`, `system.js`.
   - Each rule is keyed `'name/arity'` and is a function (or array of functions) returning `[{args: [...]}, ...goals]`.
   - Code style: 2-space indent, single quotes, semicolons required.
2. Add a corresponding `.d.ts` typings file at `src/rules/foo.d.ts`.
3. Add tests in `tests/test-rules.js` (or a new `tests/test-foo.js` wired into `tests/tests.js`).
   // turbo
4. Run tests: `npm test`
5. Create a wiki page `wiki/rules-foo.md` with usage and rule reference.
6. Add a link in `wiki/Home.md` under the Built-in rules section.
7. Update `ARCHITECTURE.md` — add to the project layout tree and dependency graph.
8. Update `llms.txt` and `llms-full.txt` with the new rule module and examples.
9. Update `AGENTS.md` if the architecture quick reference needs updating.
   // turbo
10. Verify: `npm test`

## Solver driver (e.g., `src/solvers/foo.js`)

1. Create `src/solvers/foo.js` mirroring the structure of `src/solvers/gen.js`, `async.js`, `asyncGen.js`.
   - ES6 module exporting a default `solve`-style function.
   - Reuse the prove/backtrack core conventions from `src/solve.js`.
2. Add a corresponding `.d.ts` typings file at `src/solvers/foo.d.ts`.
3. Add tests in a new `tests/test-foo.js`, mirroring `test-gen.js` / `test-async.js`, and wire it into `tests/tests.js`.
   // turbo
4. Run tests: `npm test`
5. Create a wiki page `wiki/solvers-foo.md`.
6. Add a link in `wiki/Home.md` under the Solver drivers section.
7. Update `ARCHITECTURE.md` — project layout, solver list, dependency graph.
8. Update `llms.txt` and `llms-full.txt`.
9. Update `AGENTS.md` if the import patterns table needs the new driver.
   // turbo
10. Verify: `npm test`
