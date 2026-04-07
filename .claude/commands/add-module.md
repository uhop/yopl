---
description: Add a new built-in rule module or solver driver to yopl
---

See `.windsurf/workflows/add-module.md` for the full checklist. Summary:

**Built-in rule module** (`src/rules/foo.js`):

1. Create `src/rules/foo.js` (+ `foo.d.ts`) following `logic.js` / `comp.js` patterns.
2. Add tests in `tests/test-rules.js` (or new file wired into `tests.js`).
3. `npm test`.
4. Wiki page `wiki/rules-foo.md`, link from `wiki/Home.md`.
5. Update `ARCHITECTURE.md`, `llms.txt`, `llms-full.txt`, `AGENTS.md` as needed.
6. `npm test` again.

**Solver driver** (`src/solvers/foo.js`):

1. Create `src/solvers/foo.js` (+ `foo.d.ts`) mirroring `gen.js` / `async.js`.
2. New `tests/test-foo.js` wired into `tests/tests.js`.
3. `npm test`.
4. Wiki page `wiki/solvers-foo.md`, link from `wiki/Home.md`.
5. Update `ARCHITECTURE.md`, `llms.txt`, `llms-full.txt`, `AGENTS.md` import patterns.
6. `npm test` again.
