// Type definitions for yopl — LP-specialized unifier.

import type {Env} from 'deep6/env.js';

/**
 * Unify two values against `env`, fast-pathing the shapes lowered rules
 * produce and delegating everything else to deep6's general `unify`.
 * Returns success as a boolean; bindings land in `env`.
 *
 * @param l   Left value (typically a clause head's argument vector).
 * @param r   Right value (typically a goal's argument vector).
 * @param env Environment receiving the bindings.
 */
declare function unifyLP(l: unknown, r: unknown, env: Env): boolean;

export default unifyLP;
export {unifyLP};
