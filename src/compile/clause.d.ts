// Type definitions for yopl — per-clause front-end.

import type {Clause, Rule} from './ir.js';

/**
 * Parse a tagged-template clause source into a `Clause` IR node.
 *
 * Interpolation slots are auto-wrapped per their position:
 *
 * - **Arg position** (head args, list elements, compound args):
 *   primitives + `null` + `undefined` wrap as `Lit(value)`; objects
 *   carrying a string `kind` (i.e. IR nodes) pass through; functions,
 *   plain objects without `kind`, and arrays throw — wrap explicitly.
 * - **Goal position** (clause body): functions wrap as `Js(fn)` (factory
 *   shape, called per activation with `(vars, sys)`); IR nodes pass
 *   through; primitives and plain objects throw.
 *
 * Note that strings can't span interpolation slots — `clause\`(X, 'a${i}')\``
 * fails because the string lexeme isn't closed in either chunk. Build
 * the dynamic string outside: `clause\`(X, ${'a' + i})\``.
 */
export declare const clause: (strings: TemplateStringsArray, ...values: unknown[]) => Clause;

/**
 * Curry a `Rule` constructor: `rule(name, arity)(c1, c2, ...)` returns
 * a `Rule` IR node. Each clause's `head.length` must match `arity`;
 * mismatches surface as `arity-mismatch` issues from the `validate` pass.
 */
export declare const rule: (name: string, arity: number) => (...clauses: Clause[]) => Rule;
