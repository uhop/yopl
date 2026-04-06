// Type definitions for yopl — asynchronous callback-based solver.

import type {Env} from 'deep6/env.js';
import type {Rules} from '../solve.js';

/** Async callback invoked once per solution. */
export type AsyncSolveCallback = (env: Env) => void | Promise<void>;

/**
 * Async callback-style solver. Identical in shape to the synchronous
 * `solve`, except the per-solution callback may return a promise that
 * the solver awaits before backtracking.
 *
 * @param rules    Rule database.
 * @param name     Initial goal name.
 * @param args     Argument vector for the initial goal.
 * @param callback Async callback invoked for every solution.
 */
declare function solve(rules: Rules, name: string, args: ReadonlyArray<unknown>, callback: AsyncSolveCallback): Promise<void>;

export default solve;
