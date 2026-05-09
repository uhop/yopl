// Type definitions for yopl — system rules and helpers.

import type {Variable} from 'deep6/env.js';
import type {GoalFn, Rules, TermObject} from '../solve.js';

/** Goal that always fails (used to force backtracking). */
export declare const fail: GoalFn;

/** Goal that aborts the entire proof search. */
export declare const halt: GoalFn;

/**
 * Build a Prolog-style cut. Pass the rest of the rule's variables
 * (`...sys`) so cut can locate the choice point to commit to.
 *
 * @param sys The trailing rest-args bound by the rule definition.
 */
export declare const cut: (sys: ReadonlyArray<Variable>) => GoalFn;

/**
 * Meta-call: evaluate `X` as a goal at proof time.
 *
 * @param X A goal name (string), a structured term, or a variable
 *          bound to either of the above.
 */
export declare const call: (X: string | TermObject | Variable) => GoalFn;

/**
 * Goal that succeeds when every supplied variable is bound in the
 * current environment.
 */
export declare const isBound: (...args: Variable[]) => GoalFn;

/**
 * Build a rule head: `head(a, b, c)` → `{args: [a, b, c]}`.
 */
export declare const head: (...args: unknown[]) => TermObject;

/**
 * Build a structured goal term: `term('foo', 1, 2)` →
 * `{name: 'foo', args: [1, 2]}`.
 */
export declare const term: (name: string, ...args: unknown[]) => TermObject;

/** Tail wrapper used by `list` to mark the rest position. */
export declare class Tail {
  value: unknown;
  constructor(value: unknown);
}

/** Mark `list`'s final argument as the explicit list tail. */
export declare const rest: (list: unknown) => Tail;

/**
 * Build a yopl cons-list from positional arguments. The last argument
 * may be wrapped in `rest()` to supply an explicit tail; otherwise the
 * tail defaults to `null`.
 *
 * @throws Error if `rest()` is used in a non-final position.
 */
export declare const list: (...args: unknown[]) => unknown;

/**
 * Like `list` but the *last* argument is treated as the tail directly
 * (no `rest()` wrapper). Requires at least 2 arguments.
 *
 * @throws Error if called with fewer than 2 arguments.
 */
export declare const listHead: (...args: unknown[]) => unknown;

/**
 * The system rule library. Well-known keys (spread via
 * `{...systemRules, ...}` to compose with project rules):
 *
 * - **Type predicates** — `isVar`, `isNonVar`, `isNumber`, `isString`,
 *   `isNull`, `isUndefined`. (For JS-native type tests like `isArray`,
 *   `isMap`, `isSet`, `isDate` see `src/rules/native.js`.)
 * - **Equality** — `eq`, `notEq`, `unifyOpts`. Aliases: `unify` (≡ `eq`),
 *   `notUnifiable` (≡ `notEq`).
 * - **Control** — `call`, `not`, `isUnifiable`, `conjunction`,
 *   `disjunction`, `true`, `once`.
 * - **Extended logic** — `counterExample`, `implies`.
 * - **Second-order** — `map`, `filter`, `foldl`, `foldr`, `compose`,
 *   `converse`.
 * `unifyOpts(X, Y, Opts)` runs deep6 unification with a per-call
 * options bag (`{openObjects, openArrays, openMaps, openSets,
 * circular, loose, ignoreFunctions, signedZero, symbols}`); the env's
 * baseline `options` is restored before the goal returns.
 *
 * Predicates that bridge to JS-native built-in types (Array, Map,
 * Set, Date) live in `src/rules/native.js` — import separately and
 * compose via `{...systemRules, ...nativeRules}`. See
 * `dev-docs/native-objects.md` for that design.
 */
export declare const rules: Rules;
