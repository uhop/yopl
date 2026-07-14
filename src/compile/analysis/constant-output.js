// @ts-self-types="./constant-output.d.ts"
//
// Constant-output clause classifier — regime B′ (dev-docs/js-source-backend.md
// § Regime B'; judged on dev-docs/authz-bench.md § Measurements). A clause is
// constant-output when every activation would construct the identical terms
// tree, so lowering may return one shared tree instead of rebuilding it.

import {IR_KINDS} from '../ir.js';

const litHasIR = (value, seen) => {
  if (value === null || typeof value != 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (typeof value.kind == 'string' && IR_KINDS.has(value.kind)) return true;
  if (Array.isArray(value)) return value.some(item => litHasIR(item, seen));
  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) {
    return Object.keys(value).some(key => litHasIR(value[key], seen));
  }
  return false;
};

const termIsConstant = term => {
  switch (term.kind) {
    case 'var':
    case 'wildcard':
      // wildcards lower to a fresh Variable per activation — sharing one
      // would leak bindings across sibling activations
      return false;
    case 'literal':
      return !litHasIR(term.value, new Set());
    case 'cons':
      return termIsConstant(term.head) && termIsConstant(term.tail);
    case 'compound':
      return (typeof term.name == 'string' || termIsConstant(term.name)) && term.args.every(termIsConstant);
  }
  return false;
};

const goalIsConstant = goal => {
  switch (goal.kind) {
    case 'call':
      // dynamic-name calls lower to a runtimeCall closure — excluded
      // conservatively rather than reasoning about its sharing safety
      return typeof goal.name == 'string' && goal.args.every(termIsConstant);
    case 'fail':
      return true;
    case 'cut':
    case 'js':
      // cut reads the per-activation sys frame; js factories mint
      // per-activation closures
      return false;
  }
  return false;
};

export const isConstantOutput = clause => clause.head.every(termIsConstant) && clause.body.every(goalIsConstant);
