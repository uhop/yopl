// Type definitions for yopl — term-position parsing primitives.

import type {Cursor} from './cursor.js';
import type {Term} from '../ir.js';

/** Parse exactly one term at the cursor, producing Term IR. */
export declare const parseTerm: (cursor: Cursor) => Term;

/**
 * Parse a `[...]` list (with optional `| Tail`), producing a cons chain
 * (`Lit(null)` for the empty list).
 */
export declare const parseList: (cursor: Cursor) => Term;

/** Parse a comma-separated arg list up to (not consuming) `)`. */
export declare const parseArgs: (cursor: Cursor) => Term[];
