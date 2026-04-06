# yopl — Codebase Quick Reference

## One-Liner

ES6 mini-library implementing a Prolog-style logic solver, with unification powered by `deep6`.

## Entry Points

| Module                    | Purpose                              |
| ------------------------- | ------------------------------------ |
| `src/solve.js`            | Solver core / main public entry      |
| `src/solvers/gen.js`      | Synchronous generator-based driver   |
| `src/solvers/async.js`    | Async callback-based driver          |
| `src/solvers/asyncGen.js` | Async generator driver               |

## Key Algorithms

<!-- TODO(step 5): document the solver loop, choice points, backtracking, and rule resolution. -->

### Solver loop (`src/solve.js`)

Goal evaluation against a rule database, with unification delegated to `deep6` and backtracking
managed by the driver in use.

## Module Dependencies

```
solve.js  → deep6
solvers/* → solve.js
rules/*   → solve.js (and possibly deep6)
```

## File Structure

```
src/
├── solve.js
├── solvers/
│   ├── gen.js
│   ├── async.js
│   └── asyncGen.js
└── rules/
    ├── logic.js
    ├── comp.js
    ├── math.js
    ├── bits.js
    └── system.js
```

## Testing

- **Files:** `tests/test-*.js`, dispatched by `tests/tests.js`
- **Run:** `npm test`
- **Debug:** `npm run debug` (Node inspector)

## Commands

| Command         | Description               |
| --------------- | ------------------------- |
| `npm test`      | Run test suite            |
| `npm run debug` | Debug with Node inspector |

## AI Documentation Files

| File                              | Purpose                           |
| --------------------------------- | --------------------------------- |
| `AGENTS.md`                       | Canonical rules for all AI agents |
| `CLAUDE.md`                       | Claude Code project guide         |
| `ARCHITECTURE.md`                 | Module map and dependency graph   |
| `llms.txt`                        | Quick API reference               |
| `llms-full.txt`                   | Complete API reference            |
| `README.md`                       | Usage examples                    |
| `.github/COPILOT-INSTRUCTIONS.md` | GitHub Copilot context            |

## Dependencies

- **Runtime:** [`deep6`](https://www.npmjs.com/package/deep6) — only runtime dep, itself zero-dep.
- **Dev:** Prettier, TypeScript (added in Step 1; Babel removed in Step 2).
