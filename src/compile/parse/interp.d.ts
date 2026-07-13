// Type definitions for yopl — the auto-wrap policy for tagged-template
// interpolation slots.

import type {Term, Goal} from '../ir.js';

/** True when `v` is an IR node (object with a string `.kind`). */
export declare const isIRNode: (v: unknown) => v is {kind: string};

/**
 * Arg-position wrap: primitives (plus `null` / `undefined`) become
 * `Lit(value)`, IR nodes pass through, anything else throws.
 */
export declare const wrapTermInterp: (v: unknown) => Term;

/**
 * Goal-position wrap: functions become `Js(fn)` (factory shape), IR
 * nodes pass through, anything else throws.
 */
export declare const wrapGoalInterp: (v: unknown) => Goal;
