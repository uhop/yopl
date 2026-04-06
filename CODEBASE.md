# yopl — Codebase Quick Reference

## One-Liner

ES6 mini-library implementing a Prolog-style logic solver, with unification powered by `deep6`.

## Entry Points

| Module                    | Purpose                            |
| ------------------------- | ---------------------------------- |
| `src/solve.js`            | Solver core / main public entry    |
| `src/solvers/gen.js`      | Synchronous generator-based driver |
| `src/solvers/async.js`    | Async callback-based driver        |
| `src/solvers/asyncGen.js` | Async generator driver             |

## Key Algorithms

### Solver loop (`src/solve.js`)

Non-recursive proof search over a rule database. The loop maintains an explicit stack of
frames; each iteration pops a frame and dispatches on its kind:

1. **Pop frame** (`command === 1`) — revert the environment one level (used to undo a rule's
   speculative bindings on backtracking).
2. **Choice-point frame** (`command === 2`) — try the next clause of a rule. If unification of
   its head against the current arguments succeeds, push a new goal frame for the body and bind
   a sentinel variable to the choice-point so that `cut` can locate it later.
3. **Goal frame** — pull the next goal out of the linked list of goal terms. Inline JS goal
   functions are called directly with `(env, goals, stack)`; structured terms become a new
   choice-point frame for the named rule.

Unification is delegated to `deep6/unify.js`. Backtracking is implicit in the stack pop —
discarded frames simply unwind their `env.push()` levels via the pop-frame command.

### Driver variants (`src/solvers/`)

Each variant wraps the same proof loop:

- `gen.js` — replaces the user callback with a `yield env;` site, exposing a synchronous
  generator.
- `async.js` — `await`s any async inline goal functions; the solver itself is `async`.
- `asyncGen.js` — combines both: `await`-aware loop with `yield env;`.

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
