// Type definitions for yopl — B′ (constant-output) lowering pass.

import type {RuleBody, Rules} from '../solve.js';
import type {Rule} from './ir.js';

/**
 * Like `lower.js`'s `lowerRule`, but constant-output clauses return one
 * shared terms tree built at lowering time instead of rebuilding it per
 * activation.
 */
export declare const lowerRule: (rule: Rule) => RuleBody[];

/**
 * Like `lower.js`'s `lowerRules`, with the constant-output specialization
 * of `lowerRule` applied per clause.
 */
export declare const lowerRules: (rules: Rule[]) => Rules;
