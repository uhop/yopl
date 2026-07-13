// Type definitions for yopl — the body-context Pratt parser and the
// body-term → goals transformation.

import type {Cursor} from './cursor.js';
import type {OpTable} from './op-table.js';
import type {Term, Goal, Rule} from '../ir.js';

/**
 * A body-parse tree: Term IR with embedded `Cut` / `Fail` / `Js` Goal
 * sentinels at primary positions.
 */
export type BodyTerm = Term | Goal;

/**
 * Body-context primary parser: `!` → `Cut()`, bare `fail` → `Fail()`,
 * interpolated functions → `Js(fn)`; everything else delegates to the
 * term-context `parsePrimary`.
 */
export declare const parseBodyPrimary: (cursor: Cursor, opTable: OpTable) => BodyTerm;

/** Parse a clause body as an operator expression (default maxPrio 1200). */
export declare const parseBodyExpr: (cursor: Cursor, opTable: OpTable, maxPrio?: number) => BodyTerm;

/**
 * Transform a parsed body tree into the clause's `Goal[]`, minting
 * `$or_<N>` / `$ite_<N>` helper rules for disjunctions and
 * if-then-else. `headTerms` seeds the clause-scope var set so helpers
 * capture vars shared between head and body.
 */
export declare const transformBody: (headTerms: Term[], bodyTerm: BodyTerm) => {body: Goal[]; helpers: Rule[]};

/**
 * Standalone goalize entry over the body's own vars. Throws on a
 * disjunction (helpers would be unreachable) — use `transformBody`.
 */
export declare const goalize: (t: BodyTerm) => Goal[];
