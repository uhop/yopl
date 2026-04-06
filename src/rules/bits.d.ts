// Type definitions for yopl — bitwise rules.

import type {Rules} from '../solve.js';

/**
 * Bitwise rule library: `bitAnd`, `bitOr`, `bitXor`, `bitNot`.
 *
 * `bitXor` and `bitNot` are reversible (any one missing operand can be
 * solved for). `bitAnd` and `bitOr` are forward-only.
 */
export declare const rules: Rules;
