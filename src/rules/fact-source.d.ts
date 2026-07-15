// Type definitions for yopl — fact-source choice-point protocol.

import type {Env} from 'deep6/env.js';
import type {RuleBody} from '../solve.js';

/**
 * One enumerable candidate set: `args` are the goal's argument values
 * the candidates' head args unify against; `list` holds one thunk per
 * candidate, each returning a shared ground `[{args: [...]}]` terms
 * array (build with `factThunk`, cache on the store).
 */
export interface FactChoice {
  args: unknown[];
  list: RuleBody[];
}

/**
 * Wrap a candidate selector into a `js`-goal factory. The produced
 * goal pushes a `command: 2` choice-point frame so the proof loop
 * enumerates the candidates itself — one thunk call + one head unify
 * per candidate. `select` returning null (or an empty list) fails the
 * goal. Usable in all four drivers.
 */
export declare const factSource: (
  select: (env: Env, vars: Record<string | symbol, unknown>) => FactChoice | null | undefined
) => (vars: Record<string | symbol, unknown>) => (env: Env, goals: unknown, stack: unknown[]) => null | false;

/**
 * Build the shared per-fact thunk: a 0-arg rule function returning one
 * memoized ground terms array. Safe to share across activations and
 * queries — ground terms carry no Variables.
 */
export declare const factThunk: (args: unknown[]) => RuleBody;
