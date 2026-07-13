// Type definitions for yopl — the Pratt operator-precedence parser
// over the term grammar.

import type {Cursor} from './cursor.js';
import type {OpTable} from './op-table.js';
import type {Term} from '../ir.js';

/**
 * Primary-expression parser signature. `parseExpr` threads the active
 * primary parser through recursive calls so a body-context front-end
 * can substitute its own (see `body-expr.js`).
 */
export type PrimaryParser = (cursor: Cursor, opTable: OpTable, parsePrim?: PrimaryParser) => Term;

/**
 * Parse one expression at up to `maxPrio` (default 1200), honoring the
 * ISO priority/associativity model of the entries in `opTable`.
 */
export declare const parseExpr: (cursor: Cursor, opTable: OpTable, maxPrio?: number, parsePrim?: PrimaryParser) => Term;

/**
 * Term-context primary parser: literals, lists, parenthesized
 * subexpressions, functor calls, variables, and bare atoms
 * (`Lit(name)`).
 */
export declare const parsePrimary: PrimaryParser;
