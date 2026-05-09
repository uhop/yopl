// Type definitions for yopl — IR lowering pass.

import type {RuleBody, Rules} from '../solve.js';
import type {Rule} from './ir.js';

/**
 * Lower one IR `Rule` to an array of runtime clause functions
 * (`RuleBody[]`). Each function carries `length` equal to the clause's
 * declared user-var count; the proof loop allocates `length + 1`
 * fresh logical Variables per activation.
 */
export declare const lowerRule: (rule: Rule) => RuleBody[];

/**
 * Lower an array of IR `Rule`s to a runtime `Rules` dictionary keyed
 * by rule name. Suitable for direct use with `solve` and the
 * generator-style drivers.
 */
export declare const lowerRules: (rules: Rule[]) => Rules;
