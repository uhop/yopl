// Type definitions for yopl — solver core with the LP-specialized unifier.

import type {Rules, SolveCallback} from './solve.js';

/**
 * Callback-style solver identical to `solve.js`, with the proof loop's
 * inner unify swapped for the LP-specialized unifier (`unify-lp.js`).
 *
 * @param rules    Rule database.
 * @param name     Initial goal name.
 * @param args     Argument vector for the initial goal.
 * @param callback Invoked for every solution.
 */
declare function solve(rules: Rules, name: string, args: ReadonlyArray<unknown>, callback: SolveCallback): void;

export default solve;
export {solve};
