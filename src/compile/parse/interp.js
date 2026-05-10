// Auto-wrap policy for tagged-template interpolation slots.
//
// In arg position (head args, list elements, compound args):
//   - primitives + null + undefined → `Lit(value)`
//   - object with string `.kind`    → used as-is (Term IR)
//   - anything else                 → throws (must wrap explicitly)
//
// In goal position (clause body):
//   - function                      → `Js(fn)` — factory shape
//   - object with string `.kind`    → used as-is (Goal IR)
//   - anything else                 → throws

import {Lit, Js} from '../ir.js';

export const isIRNode = v => v !== null && typeof v === 'object' && typeof v.kind === 'string';

export const wrapTermInterp = v => {
  if (isIRNode(v)) return v;
  const t = typeof v;
  if (v === null || t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint' || t === 'undefined' || t === 'symbol') return Lit(v);
  throw new Error(`interpolation in arg position must be a Term IR or primitive, got ${t === 'object' ? 'object without .kind' : t}`);
};

export const wrapGoalInterp = v => {
  if (typeof v === 'function') return Js(v);
  if (isIRNode(v)) return v;
  throw new Error(`interpolation in goal position must be a Goal IR or function, got ${v === null ? 'null' : typeof v}`);
};
