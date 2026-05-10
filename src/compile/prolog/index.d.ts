// Type definitions for yopl — strict-Prolog tagged-template front-end.

import type {Rule, Term, Goal} from '../ir.js';
import {IR} from '../ir.js';
import type {Rules} from '../../solve.js';

/**
 * Operator declaration accepted by the configurator. Mirrors what the
 * `:- op(P, T, N).` directive installs into the per-invocation parser
 * table. `target` is yopl's `op/4` aliasing — body-context lowering
 * rewrites `A op B` to `Call(target, [A, B])` instead of
 * `Compound(op, [A, B])`. Term-context parsing ignores `target`.
 */
export interface PrologOpDecl {
  name: string;
  priority: number;
  type: 'xfx' | 'xfy' | 'yfx' | 'fx' | 'fy';
  target?: string;
}

/** Configurator options accepted by `prolog(opts)` and `prolog.with(opts)`. */
export interface PrologOptions {
  /** Extra operators added on top of the default body op table. */
  operators?: PrologOpDecl[];
  /**
   * When `false`, the tag returns the parsed IR `Rules` dict instead
   * of the lowered runtime functions. Defaults to `true`.
   */
  lower?: boolean;
}

/**
 * Result of `prolog\`...\`` (default `lower: true`): the runtime
 * `Rules` dict the proof loop accepts, with the parsed IR attached
 * under `Symbol.for('yopl.ir')` for cross-validation, codegen, or
 * inspection.
 */
export type PrologLoweredResult = Rules & {[IR]?: Record<string, Rule>};

/**
 * Result of `prolog.with({lower: false})\`...\``: the IR `Rules` dict
 * keyed by rule name. Useful when consuming the IR directly (custom
 * lowering, structural diffs, codegen experiments).
 */
export type PrologIRResult = Record<string, Rule>;

/**
 * Polymorphic-tag callable for `prolog`. Three call shapes:
 *
 * - **Tag form** — `prolog\`...source...\``: parses the template
 *   literal, returns lowered `Rules` (or IR per `lower: false`).
 * - **Function form** — `prolog(source[, options])`: parses a string
 *   (e.g. file content); options merge with the tag's options.
 * - **Configurator form** — `prolog(options)`: returns a fresh tag
 *   closing over the merged options. Equivalent to `prolog.with(opts)`.
 */
export interface PrologTag {
  (strings: TemplateStringsArray, ...values: unknown[]): PrologLoweredResult | PrologIRResult;
  (source: string, options?: PrologOptions): PrologLoweredResult | PrologIRResult;
  (options: PrologOptions): PrologTag;
  /** Configurator alias — returns a fresh tag with merged options. */
  with(options: PrologOptions): PrologTag;
}

/**
 * Parsed-clause result from `prologClause\`...\``. Carries the head
 * functor `name` alongside the standard `Clause` IR fields, since the
 * source includes the head functor whereas the iter-1 `clause\`...\``
 * front-end is anonymous (the rule name is supplied separately to
 * `rule(name, arity)`).
 */
export interface PrologClauseResult {
  name: string;
  head: Term[];
  body: Goal[];
  /** Helper rules (`$or_<N>`, `$ite_<N>`) minted during body transform. */
  helpers?: Rule[];
}

/** Polymorphic-tag callable for `prologClause`. */
export interface PrologClauseTag {
  (strings: TemplateStringsArray, ...values: unknown[]): PrologClauseResult;
  (source: string, options?: PrologOptions): PrologClauseResult;
  (options: PrologOptions): PrologClauseTag;
  /** Configurator alias — returns a fresh tag with merged options. */
  with(options: PrologOptions): PrologClauseTag;
}

/**
 * Parse a strict-Prolog program. Default tag form lowers to a runtime
 * `Rules` dict; pass `{lower: false}` via the configurator or the
 * function form to get the IR dict instead. Operators declared inside
 * the template via `:- op(...).` directives never leak to the next
 * call — the parser clones the op table per invocation.
 */
export declare const prolog: PrologTag;

/**
 * Parse a single strict-Prolog clause. The trailing `.` is auto-appended
 * if absent, so both `prologClause\`green\`` and `prologClause\`green.\``
 * work. Useful for incrementally building rule libraries that need a
 * fresh head functor name per clause.
 */
export declare const prologClause: PrologClauseTag;
