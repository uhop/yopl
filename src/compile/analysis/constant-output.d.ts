// Type definitions for yopl — constant-output clause classifier.

import type {Clause} from '../ir.js';

/**
 * True when every activation of the clause would construct an identical
 * terms tree: no variables or wildcards anywhere (including inside `Lit`
 * values), only static-name calls and `fail` in the body — no `cut`
 * (reads the per-activation sys frame) and no inline `js` goals.
 */
declare function isConstantOutput(clause: Clause): boolean;

export {isConstantOutput};
