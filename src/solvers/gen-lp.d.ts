// Type definitions for yopl — synchronous generator solver with the
// LP-specialized unifier.

import type {Env} from 'deep6/env.js';
import type {Rules} from '../solve.js';

/**
 * Synchronous generator solver identical to `gen.js`, with the proof
 * loop's inner unify swapped for the LP-specialized unifier
 * (`../unify-lp.js`). Yields the live `Env` for each solution found.
 *
 * @param rules Rule database.
 * @param name  Initial goal name.
 * @param args  Argument vector for the initial goal.
 */
declare function generate(rules: Rules, name: string, args: ReadonlyArray<unknown>): Generator<Env, void, void>;

export default generate;
export {generate};
