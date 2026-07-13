// Type definitions for yopl — the strict-Prolog program parser.

import type {Cursor} from '../parse/cursor.js';
import type {OpTable} from '../parse/op-table.js';
import type {Rule} from '../ir.js';

/**
 * Drain the cursor in a clause-or-directive loop and group clauses by
 * name into IR Rules (helper rules appended). `op/3` and `op/4`
 * directives extend a local clone of `opTable` — the input table is
 * never mutated. Arity mismatch within one program throws. `file`
 * annotates clause source positions when `sourceMap` is on.
 */
export declare const parseProgram: (cursor: Cursor, opTable: OpTable, file?: string, sourceMap?: boolean) => Record<string, Rule>;
