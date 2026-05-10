// Type definitions for yopl — runtime primitives shared between
// rules/system.js and the compiler's lower.js. Lives in its own module
// to keep it a leaf in the import graph: lower.js depends on these,
// and system.js's lowered rules depend on lower.js.

import type {Variable} from 'deep6/env.js';
import type {GoalFn, TermObject} from '../solve.js';

/** Goal that always fails (used to force backtracking). */
export declare const fail: GoalFn;

/** Goal that aborts the entire proof search. */
export declare const halt: GoalFn;

/**
 * Build a Prolog-style cut. Pass the rest of the rule's variables
 * (`...sys`) so cut can locate the choice point to commit to.
 *
 * @param sys The trailing rest-args bound by the rule definition.
 */
export declare const cut: (sys: ReadonlyArray<Variable>) => GoalFn;

/**
 * Meta-call: evaluate `X` as a goal at proof time.
 *
 * @param X A goal name (string), a structured term, or a variable
 *          bound to either of the above.
 */
export declare const call: (X: string | TermObject | Variable) => GoalFn;
