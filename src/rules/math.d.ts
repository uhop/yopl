// Type definitions for yopl — arithmetic rules.

import type {Rules} from '../solve.js';

/**
 * Arithmetic rule library: `add`, `sub`, `mul`, `div`, `neg`.
 *
 * Each rule defines a relation X⊕Y=Z and is reversible: any two of
 * the three arguments may be bound, and the rule will solve for the
 * third.
 */
export declare const rules: Rules;
