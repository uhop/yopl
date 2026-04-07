---
name: debug-solve
description: Debug solver failures or unexpected results in yopl. Use when `solve` produces no solutions, the wrong solutions, or unexpected variable bindings.
---

# Debug yopl Solver Failures

Debug why a yopl query failed, produced no answers, or yielded unexpected bindings.

## Steps

1. **Identify the failing query**
   - Read the test or code that calls `solve(rules, name, args, callback)` (or the gen / async / asyncGen variant).
   - Note the rule name/arity, the arguments, and the rule definitions in scope.

2. **Understand the prove/backtrack flow**
   - Read `src/solve.js` — `prove` function. Key stages per frame:
     1. `POP` command → `env.pop()` (undo bindings on backtrack)
     2. Iterate `frame.ruleList` rules for the current goal
     3. `env.push()`, generate fresh variables, call the rule body
     4. `unify(terms[0].args, frame.args, env)` — head unification
     5. On success, push remaining goals (terms[1..]) onto the stack
     6. On failure, `env.pop()` and try the next rule
   - Solver drivers in `src/solvers/` reuse the same core, just changing how solutions are delivered.

3. **Check the rule shape**
   - Each clause is a function (or one entry in an array of functions) returning `[{args: [...]}, ...subgoals]`.
   - Subgoals are either `{name: 'foo/1', args: [...]}` (call another rule) or a function `env => boolean` (inline guard).
   - A rule is keyed `'name/arity'` — arity must match the call site length.

4. **Add debug logging temporarily**
   - In `src/solve.js`, log at decision points: which rule is being tried, the head unification result, the next subgoal pushed.
   - Example: `console.log('try', frame.name, 'rule', frame.index, 'args', frame.args);`
   - For variable inspection, use `assemble(v, env)` from `deep6/traverse/assemble.js`.

5. **Common failure modes**
   - **Wrong arity**: rule keyed `foo/2` but called with one arg — silently no match.
   - **Unbound variable in guard**: a guard function reads `X.get(env)` before `X` is bound. Gate guards with `X.isBound(env) && ...`.
   - **Missing base case**: recursive rule with no terminating clause → infinite backtracking or stack growth.
   - **Shared variables across clauses**: each clause body must use freshly captured params; don't close over outer-scope variables that should be unified independently.
   - **Forgotten `env.pop()` paths**: if you patched the solver, every push must have a matching pop on every backtrack path.
   - **Async drivers**: forgetting to `await` the solver or to consume the async iterator.

6. **Reproduce in isolation**
   - Add a minimal failing test in the appropriate `tests/test-*.js` file.
   - Strip the rule set down to the smallest set that still reproduces the issue.

7. **Fix and verify**
   - Apply the fix.
   - Run `npm test`.
   - Remove debug logging.

## Tools

- `npm test` — run the full suite.
- `npm run debug` — run under the Node inspector for breakpoint debugging.
- `assemble(v, env)` — materialise a variable's bound value (deep) for inspection.
- `env.getAllValues()` — inspect the full binding map.
