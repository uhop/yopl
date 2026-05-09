// Type definitions for yopl — per-clause front-end.

import type {Clause, Rule} from '../ir.js';

/**
 * Parse a tagged-template clause source into a `Clause` IR node.
 *
 * Interpolation slots may carry pre-built IR (any `Term` in
 * argument position, any `Goal` in body position) and are spliced
 * into the resulting clause unchanged.
 */
export declare const clause: (strings: TemplateStringsArray, ...values: unknown[]) => Clause;

/**
 * Curry a `Rule` constructor: `rule(name, arity)(c1, c2, ...)` returns
 * a `Rule` IR node. Each clause's `head.length` must match `arity` —
 * caught later by the `validate` pass.
 */
export declare const rule: (name: string, arity: number) => (...clauses: Clause[]) => Rule;
