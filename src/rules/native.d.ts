// Type definitions for yopl — predicates that bridge unification to
// JS-native built-in types (Array, Map, Set, Date). Kept separate from
// `system.js`, which holds generic logic-programming predicates.

import type {Rules} from '../solve.js';

/**
 * Predicates over JS-native built-in types. Spread alongside
 * `systemRules` (and other domain rule modules) to compose:
 *
 * ```js
 * import {rules as systemRules} from 'yopl/rules/system.js';
 * import {rules as nativeRules} from 'yopl/rules/native.js';
 * const rules = {...systemRules, ...nativeRules};
 * ```
 *
 * Well-known keys:
 *
 * - **Array** — `arrayList` (bidirectional Array ↔ cons list),
 *   `arrayGet` (forward indexed lookup),
 *   `arraySet` (immutable single-index override),
 *   `arrayLength` (forward length).
 * - **Map** — `mapEntries` (bidirectional M ↔ list of `[K, V]` pairs),
 *   `mapGet` (forward lookup), `mapHas` (membership).
 * - **Set** — `setItems` (bidirectional S ↔ list), `setHas` (membership).
 * - **Date** — `dateTimestamp` (bidirectional D ↔ epoch ms),
 *   `dateComponents` / `dateComponentsUTC` (bidirectional D ↔ component
 *   bag; local + UTC variants matching JS `getFullYear` / `getUTCFullYear`).
 *
 * Component bag for Date predicates is a JS object with optional fields:
 * `{year, month, day, hour, minute, second, ms}`. Month is 0-based.
 * Pairs cleanly with the Lit-walker (see `dev-docs/compiler-ir.md`
 * § Practical patterns) for partial-bag pattern matching.
 *
 * See `dev-docs/native-objects.md` for the full design and roadmap.
 */
export declare const rules: Rules;
