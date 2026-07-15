// Type definitions for yopl — regime-B JS-source lowering pass.

import type {RuleBody, Rules} from '../solve.js';
import type {Rule} from './ir.js';

/**
 * Lower one IR `Rule` to an array of runtime clause functions
 * (`RuleBody[]`), each compiled via `new Function` so activations
 * construct head args and goals as literal expressions with no IR walk.
 * Clauses the emitter cannot express as source fall back to the
 * baseline closure lowering; behavior is identical either way. Each
 * function carries `length` equal to the clause's declared user-var
 * count; the proof loop allocates `length + 1` fresh logical Variables
 * per activation.
 */
export declare const lowerRule: (rule: Rule) => RuleBody[];

/**
 * Lower an array of IR `Rule`s to a runtime `Rules` dictionary keyed
 * by rule name. Drop-in interchangeable with `lower.js`'s
 * `lowerRules`; suitable for direct use with `solve` and the
 * generator-style drivers.
 */
export declare const lowerRules: (rules: Rule[]) => Rules;
