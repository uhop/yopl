# Native JS object support

yopl's tight integration with JavaScript means logic programs should
work naturally with the JS-builtin container types: plain objects,
arrays, `Map`, `Set`, and `Date`. This doc captures the design for
each, what's shipped, and what's postponed.

`deep6` already handles unification of these types (with options like
`openObjects`, `openMaps`, etc., reachable via `unifyOpts/3` —
see `dev-docs/compiler-ir.md` § Practical patterns). This doc covers
the **predicates** yopl ships for construction, deconstruction, and
inspection — the operations you can write in a clause body or query.

## Design pillars

- **Bidirectional whenever natural.** A predicate like
  `arrayList(A, L)` should bind whichever side is unbound from the
  other. Construction and deconstruction live in one rule.
- **Object/array literals as patterns.** Through the `Lit`-walker,
  a `Lit({field: Var('X')})` substitutes the activation's fresh
  Variable for `X`, so an object literal doubles as a pattern matcher
  and a constructor.
- **JS-aligned naming.** Local-time predicates use bare names
  (`dateComponents`); UTC variants use a `UTC` suffix
  (`dateComponentsUTC`), matching JS Date method conventions.
- **Immutable updates.** `mapSet(M, K, V, M')` produces a new Map;
  no in-place mutation that backtracking would have to undo.

## `Lit`-walker (foundation)

`Lit(value)` lowers per activation: any IR node nested inside the
value (`Var`, `Wild`, `Cons`, `Compound`, `Lit`) is recursively lowered
and substituted; plain objects and arrays are walked into; everything
else (Maps, Sets, Dates, class instances, `Wrap` instances from
`open`/`soft`) returns as-is.

Status: ✅ shipped 2026-05-09.

Detection of IR nodes is gated on the closed set of known `kind`
strings (`'var' | 'wildcard' | 'literal' | 'cons' | 'compound'`),
so a JS object that happens to have a `kind` field (e.g., domain data
with a `kind: 'event'` discriminator) won't be misread as IR.

Limitation: Maps and Sets are not walked. Logic Variables nested
inside a Map's values or a Set's items aren't substituted per
activation. For those cases, build the container inside a `Js`
body goal where you have direct access to activation Variables.

## Plain objects and arrays

| Predicate                                                   | Behavior                                                                                                                                                                                                                                                                                                                                              | Status                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `arrayList(A, L)`                                           | bidir; JS array ↔ yopl cons list                                                                                                                                                                                                                                                                                                                      | ✅ shipped 2026-05-09 |
| `arrayGet(A, I, X)`                                         | forward indexed lookup; A + I bound → X binds; out-of-bounds fails                                                                                                                                                                                                                                                                                    | ✅ shipped 2026-05-09 |
| `arraySet(A, I, X, A2)`                                     | immutable single-index override; in-bounds replace or append-at-end                                                                                                                                                                                                                                                                                   | ✅ shipped 2026-05-09 |
| `arrayLength(A, N)`                                         | A bound → N binds; reverse mode (build A from N) intentionally not supported                                                                                                                                                                                                                                                                          | ✅ shipped 2026-05-09 |
| object pattern via `Lit({…})`                               | match shape, bind named slots, construct from bound slots                                                                                                                                                                                                                                                                                             | ✅ shipped 2026-05-09 |
| `arrayWith(A, Overrides, A2)`                               | bulk-override variant; defer until single-index `arraySet` proves verbose                                                                                                                                                                                                                                                                             | postponed             |
| `arrayHas(A, X)`                                            | composable as `arrayList(A, L), member(L, X)` once `member` ships                                                                                                                                                                                                                                                                                     | postponed             |
| `arrayPush` / `arrayUnshift` / `arraySlice` / `arrayConcat` | one-line `Js` goals; ship on demand                                                                                                                                                                                                                                                                                                                   | postponed             |
| object rest-pattern (e.g. `restPattern({a: A}, Rest)`)      | bind `Rest` to keys NOT named in the pattern; analog of JS `{a, ...rest}`. Neither yopl nor deep6 supports this today; needs a custom `Unifier` subclass (composes with `Lit`-walker like `open`/`soft` do). Decomposition-only is the natural first cut; bidirectional composition (`{a: A, ...Rest}` from bound parts) doable but adds a code path. | postponed             |

## Map

| Predicate             | Behavior                                | Status                |
| --------------------- | --------------------------------------- | --------------------- |
| `mapEntries(M, Es)`   | bidir; M ↔ list of `[K, V]` pairs       | ✅ shipped 2026-05-09 |
| `mapGet(M, K, V)`     | forward lookup; M-and-K bound → V binds | ✅ shipped 2026-05-09 |
| `mapHas(M, K)`        | membership predicate                    | ✅ shipped 2026-05-09 |
| `mapSize(M, N)`       | size as a number                        | postponed             |
| `mapSet(M, K, V, M')` | immutable insert (new Map)              | postponed             |
| `mapDelete(M, K, M')` | immutable delete                        | postponed             |
| `mapKeys(M, Ks)`      | bidir; M ↔ list of keys (values open)   | postponed             |
| `mapValues(M, Vs)`    | bidir; M ↔ list of values (keys open)   | postponed             |

## Set

| Predicate              | Behavior                   | Status                |
| ---------------------- | -------------------------- | --------------------- |
| `setItems(S, Items)`   | bidir; S ↔ list of items   | ✅ shipped 2026-05-09 |
| `setHas(S, X)`         | membership predicate       | ✅ shipped 2026-05-09 |
| `setSize(S, N)`        | size as a number           | postponed             |
| `setAdd(S, X, S')`     | immutable insert (new Set) | postponed             |
| `setRemove(S, X, S')`  | immutable remove           | postponed             |
| `setUnion(A, B, C)`    | C = A ∪ B                  | postponed             |
| `setIntersection(...)` | …                          | postponed             |
| `setDifference(...)`   | …                          | postponed             |

## Date

Local-time predicates use bare names; UTC variants append `UTC` to
the bare name, matching JS's `getFullYear` / `getUTCFullYear`
convention.

Component bag `C` is a JS object with optional fields:
`{year, month, day, hour, minute, second, ms}`. Month is 0-based
(matching JS's `Date.prototype.getMonth`). Missing fields default to
the conventional zero (year/month/day default to 1970/0/1; everything
else to 0) when constructing.

| Predicate                       | Behavior                                            | Status                |
| ------------------------------- | --------------------------------------------------- | --------------------- |
| `dateTimestamp(D, Ms)`          | bidir; D ↔ epoch ms (TZ-agnostic)                   | ✅ shipped 2026-05-09 |
| `dateComponents(D, C)`          | bidir; D ↔ component bag (local)                    | ✅ shipped 2026-05-09 |
| `dateComponentsUTC(D, C)`       | bidir; D ↔ component bag (UTC)                      | ✅ shipped 2026-05-09 |
| `dateWith(D, Overrides, D2)`    | apply overrides; produce new Date (local)           | postponed             |
| `dateWithUTC(D, Overrides, D2)` | apply overrides; produce new Date (UTC)             | postponed             |
| `dateAdd(D, Duration, D')`      | calendar arithmetic (Duration shape unresolved)     | postponed             |
| `dateDiff(D1, D2, Duration)`    | calendar subtraction (same)                         | postponed             |
| parse / format                  | wrap on demand via `Js` goals; not built in for now | postponed             |

`dateComponents` pairs especially well with the `Lit`-walker:

```js
const Y = Var(),
  M = Var();
solve(rules, 'dateComponents', [d, Lit({year: Y, month: M})], env => {
  console.log(Y.get(env), M.get(env));
});
```

The component bag is partial — only the fields you care about. The
walker substitutes Y/M to fresh activation Variables; the rule reads
the requested fields off `d` and unifies them in.

For construction, supply the bag with bound values:

```js
const D = Var();
solve(rules, 'dateComponents', [D, Lit({year: 2026, month: 4, day: 15})], env => {
  console.log(D.get(env)); // Date for May 15, 2026 (local)
});
```

## Module layout

These predicates live in `src/rules/native.js`, separate from
`src/rules/system.js` (which holds generic logic-programming
predicates — `eq`, `notEq`, `unifyOpts`, `not`, `map`, `filter`,
control-flow, type tests, etc.). Compose by spreading both:

```js
import {rules as systemRules} from 'yopl/rules/system.js';
import {rules as nativeRules} from 'yopl/rules/native.js';

const rules = {...systemRules, ...nativeRules};
```

## See also

- `src/rules/native.js` — implementation
- `src/rules/system.js` — generic logic-programming predicates (where these used to live before the 2026-05-09 split)
- `dev-docs/compiler-ir.md` § Practical patterns — `Lit`-walker overview, `unifyOpts/3`, `open`/`soft` wrappers
- `projects/yopl/queue.md` — outstanding work
