// @ts-self-types="./lower-const.d.ts"
//
// B′ lowering entrypoint — same surface as lower.js, but constant-output
// clauses (see analysis/constant-output.js) return one shared terms tree
// built at lowering time instead of rebuilding it per activation. Sharing is
// safe: unification mutates only the env, and the proof loop's mutable
// cursor (goals.index) lives on the per-activation frame, not on terms.
// Baseline lower.js stays untouched (dev-docs/implementation-discipline.md).

import {lowerRule as lowerRuleClosures} from './lower.js';
import {isConstantOutput} from './analysis/constant-output.js';

export const lowerRule = rule => {
  const fns = lowerRuleClosures(rule);
  return rule.clauses.map((clause, i) => {
    if (!isConstantOutput(clause)) return fns[i];
    const terms = fns[i]();
    const fn = () => terms;
    if (fns[i].source !== undefined) {
      Object.defineProperty(fn, 'source', {value: fns[i].source});
    }
    return fn;
  });
};

export const lowerRules = rules => {
  const out = {};
  for (const rule of rules) out[rule.name] = lowerRule(rule);
  return out;
};
