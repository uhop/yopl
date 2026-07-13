// Type definitions for yopl — asynchronous generator-based solver.

import type {Env} from 'deep6/env.js';
import type {Rules} from '../solve.js';

export type {AsyncGoalFn} from '../solve.js';

/**
 * Async generator solver. Yields the live `Env` for each solution.
 * Useful when goals contain `await`-bearing inline functions.
 *
 * @param rules Rule database.
 * @param name  Initial goal name.
 * @param args  Argument vector for the initial goal.
 */
declare function generate(rules: Rules, name: string, args: ReadonlyArray<unknown>): AsyncGenerator<Env, void, void>;

export default generate;
export {generate};
