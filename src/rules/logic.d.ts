// Type definitions for yopl — boolean logic rules.

import type {Rules} from '../solve.js';

/**
 * Boolean logic rule library: `logicalAnd`, `logicalOr`, `logicalXor`,
 * `logicalNot`. Each defines a relation among its boolean arguments
 * that may be solved in any direction with sufficient bindings.
 */
export declare const rules: Rules;
