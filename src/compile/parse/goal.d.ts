// Type definitions for yopl — goal-position parsing primitives.

import type {Cursor} from './cursor.js';
import type {Goal} from '../ir.js';

/**
 * Parse exactly one goal at the cursor: `!` → `Cut()`, bare `fail` →
 * `Fail()`, interpolation slots via the goal auto-wrap policy, idents
 * as `Call` (uppercase idents become dynamic-dispatch `Call(Var, ...)`).
 */
export declare const parseGoal: (cursor: Cursor) => Goal;

/** Parse a comma-separated goal sequence. */
export declare const parseBody: (cursor: Cursor) => Goal[];
