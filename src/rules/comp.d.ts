// Type definitions for yopl — comparison rules.

import type {Rules} from '../solve.js';

/**
 * Comparison rule library: `lt`, `le`, `gt`, `ge`, and `nz`.
 *
 * Each comparison succeeds when both operands are bound, of the same
 * comparable type (number or string), and stand in the requested
 * relation. `nz` succeeds for any non-zero value.
 */
export declare const rules: Rules;
