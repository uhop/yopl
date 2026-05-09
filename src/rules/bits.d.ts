// Type definitions for yopl — bitwise rules.

import type {Rules} from '../solve.js';

/**
 * Bitwise rule library: `bitAnd`, `bitOr`, `bitXor`, `bitNot`.
 *
 * `bitXor` and `bitNot` are fully reversible — any one missing operand
 * can be solved for, and identity-fact clauses cover under-specified
 * queries (`X ^ 0 = X`, `0 ^ Y = Y`, `X ^ X = 0`).
 *
 * `bitOr` is forward (X+Y → Z) plus zero-identity reverse: queries
 * with X (or Y) bound to `0` resolve via `(0, Y, Y)` / `(X, 0, X)`
 * fact clauses, e.g. `bitOr(0, Y, 5)` answers `Y = 5`. Other reverse
 * modes return no solutions (multiple X satisfy `X | Y = Z`; the rule
 * does not enumerate).
 *
 * `bitAnd` is forward-only — the AND identities don't usefully
 * constrain a missing operand.
 */
export declare const rules: Rules;
