// Type definitions for yopl — the operator table consumed by the Pratt
// expression parser.

/** Infix associativity types (ISO Prolog). */
export type InfixOpType = 'xfx' | 'xfy' | 'yfx';

/** Prefix associativity types (ISO Prolog). Postfix is not supported. */
export type PrefixOpType = 'fx' | 'fy';

export type OpType = InfixOpType | PrefixOpType;

/**
 * One operator entry. The optional `target` is `op/4` aliasing — body
 * context lowers `A op B` to `Call(target, [A, B])`; term context
 * ignores it and always emits `Compound`.
 */
export interface OpEntry {
  name: string;
  priority: number;
  type: OpType;
  target?: string;
}

/** Two maps keyed by operator name; a name can appear in both. */
export interface OpTable {
  infix: Map<string, OpEntry>;
  prefix: Map<string, OpEntry>;
}

/** Build an empty operator table. */
export declare const makeOpTable: () => OpTable;

/** Add an entry (routed by `type`); throws on an unknown type. Returns `table`. */
export declare const addOp: (table: OpTable, entry: OpEntry) => OpTable;

/** Shallow-clone a table (fresh `Map`s, shared entries). */
export declare const cloneOpTable: (src: OpTable) => OpTable;

/** Term-context defaults: comparison / arithmetic operators only. */
export declare const defaultTermOpTable: () => OpTable;

/** Term defaults plus body operators (`,`, `;`, `->`, `\+`). */
export declare const defaultBodyOpTable: () => OpTable;
