// Type definitions for yopl — the strict-Prolog clause parser.

import type {Cursor} from '../parse/cursor.js';
import type {OpTable} from '../parse/op-table.js';
import type {Term, Goal, Rule, ClauseSource} from '../ir.js';

/**
 * One parsed clause. `helpers` carries `$or_<N>` / `$ite_<N>` rules
 * minted for disjunctions in the body; `source` is present when
 * `sourceMap` was requested.
 */
export interface ParsedClause {
  name: string;
  head: Term[];
  body: Goal[];
  source?: ClauseSource;
  helpers?: Rule[];
}

/**
 * Parse one simple goal (no body operators) — used directly for
 * directive goals (`:- op(...)`) and low-level testing.
 */
export declare const parseGoal: (cursor: Cursor, opTable: OpTable) => Goal;

/** Parse a comma-separated sequence of simple goals. */
export declare const parseGoals: (cursor: Cursor, opTable: OpTable) => Goal[];

/**
 * Parse `head [ ':-' body ] '.'`. Heads must be atoms (lowercase ident
 * or symbolic atom); bodies go through the body-context Pratt parser
 * and `transformBody`.
 */
export declare const parseClause: (cursor: Cursor, opTable: OpTable, sourceMap?: boolean) => ParsedClause;
