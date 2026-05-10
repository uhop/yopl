// Type definitions for yopl — IR validation pass.

import type {Rule, ClauseSource} from './ir.js';

/** Discriminator for validation issues. */
export type IssueKind = 'duplicate-rule' | 'arity-mismatch' | 'call-arity-mismatch' | 'undeclared-var' | 'unresolved-rule';

/** A single validation issue. Fields beyond `kind` and `message` are kind-specific. */
export interface Issue {
  kind: IssueKind;
  message: string;
  /** Rule name where the issue surfaced. */
  rule?: string;
  /** Index of the offending clause within `rule.clauses`. */
  clause?: number;
  /** For `undeclared-var`: the offending var name. */
  var?: string;
  /** For `call-arity-mismatch` / `unresolved-rule`: the called rule name. */
  target?: string;
  /**
   * Source position of the offending clause, when the front-end
   * threaded one in. Per-clause issues carry this; cross-rule issues
   * (e.g. `duplicate-rule`) don't. The `message` field also gets a
   * `[file:line:col]` suffix for human-readable output.
   */
  source?: ClauseSource;
}

/** Options controlling which checks run. */
export interface ValidateOptions {
  /**
   * Names of rules outside the supplied set that callers should treat
   * as resolved when `checkRuleReferences` is enabled (e.g. system
   * rules, project externals).
   */
  knownExternals?: Iterable<string>;
  /**
   * If true, flag static `Call.name`s that resolve to neither a local
   * rule nor a known external. Off by default — false-positive prone
   * unless externals are fully enumerated.
   */
  checkRuleReferences?: boolean;
}

/**
 * Run IR-level validation against the supplied rule set. Returns the
 * list of issues — empty when the set is clean. Pure function.
 */
export declare const validate: (rules: Rule[], options?: ValidateOptions) => Issue[];

/**
 * Like `validate`, but throws an `Error` listing all issues when the
 * list is non-empty. Useful for dogfood / test gates that want a
 * single hard failure rather than caller-side iteration.
 */
export declare const validateOrThrow: (rules: Rule[], options?: ValidateOptions) => void;
