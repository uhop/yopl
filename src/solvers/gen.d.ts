// Type definitions for yopl — synchronous generator-based solver.

import type {Env} from 'deep6/env.js';
import type {Rules} from '../solve.js';

/**
 * Synchronous generator solver. Yields the live `Env` for each solution
 * found; consumers typically call `assemble(variable, env)` from deep6
 * to extract bindings before requesting the next solution.
 *
 * @param rules Rule database.
 * @param name  Initial goal name.
 * @param args  Argument vector for the initial goal.
 */
declare function generate(rules: Rules, name: string, args: ReadonlyArray<unknown>): Generator<Env, void, void>;

export default generate;
export {generate};
