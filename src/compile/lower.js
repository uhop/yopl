// @ts-self-types="./lower.d.ts"
//
// IR → runtime rule functions. The only file in the compiler that
// knows the runtime rule shape; front-ends and the IR stay insulated.
//
// Lowering is pure: it does not allocate logic Variables (the proof
// loop owns Variable allocation) and it does not mutate the IR. Every
// activation of a lowered clause walks the IR to construct fresh
// runtime values around the activation's freshly-allocated Variables.
//
// See dev-docs/compiler-ir.md for the IR design and the per-activation
// walk rationale.

import {_} from 'deep6/env.js';
import {call as runtimeCall, cut as runtimeCut, fail as runtimeFail} from '../rules/system.js';
import {collectVars, IR_KINDS} from './ir.js';

// Walk a `Lit` value per activation, substituting any nested IR node
// with its lowered runtime equivalent. Plain objects and arrays are
// recursively rebuilt with substitutions applied; everything else
// (Maps, Sets, Dates, class instances, Wrap-wrapped values from
// open/soft, primitives) is returned as-is. IR detection is gated on
// the closed set of IR_KINDS so user objects with a `kind` field
// don't collide.
const lowerLitValue = (val, vars, seen) => {
  if (val === null || typeof val !== 'object') return val;
  if (seen.has(val)) return seen.get(val);
  if (typeof val.kind === 'string' && IR_KINDS.has(val.kind)) return lowerTerm(val, vars);
  if (Array.isArray(val)) {
    const out = [];
    seen.set(val, out);
    for (const e of val) out.push(lowerLitValue(e, vars, seen));
    return out;
  }
  const proto = Object.getPrototypeOf(val);
  if (proto === Object.prototype || proto === null) {
    const out = {};
    seen.set(val, out);
    for (const k of Object.keys(val)) out[k] = lowerLitValue(val[k], vars, seen);
    return out;
  }
  return val;
};

const lowerTerm = (term, vars) => {
  switch (term.kind) {
    case 'var':
      return vars[term.name];
    case 'wildcard':
      return _;
    case 'literal':
      return lowerLitValue(term.value, vars, new Map());
    case 'cons':
      return {value: lowerTerm(term.head, vars), next: lowerTerm(term.tail, vars)};
    case 'compound': {
      const name = typeof term.name === 'string' ? term.name : lowerTerm(term.name, vars);
      const args = term.args.map(a => lowerTerm(a, vars));
      return {name, args};
    }
  }
  throw new Error(`unknown term kind: ${term.kind}`);
};

const lowerGoal = (goal, vars, sys) => {
  switch (goal.kind) {
    case 'call': {
      const args = goal.args.map(a => lowerTerm(a, vars));
      if (typeof goal.name === 'string') {
        return args.length ? {name: goal.name, args} : goal.name;
      }
      const nameVal = lowerTerm(goal.name, vars);
      const target = args.length ? {name: nameVal, args} : nameVal;
      return runtimeCall(target);
    }
    case 'cut':
      return runtimeCut(sys);
    case 'fail':
      return runtimeFail;
    case 'js':
      return goal.factory(vars, sys);
  }
  throw new Error(`unknown goal kind: ${goal.kind}`);
};

const lowerClause = clause => {
  const varNames = clause.vars ?? collectVars(clause);
  const fn = (...allVars) => {
    const vars = {};
    for (let i = 0; i < varNames.length; ++i) vars[varNames[i]] = allVars[i];
    const sys = allVars.slice(varNames.length);
    const headArgs = clause.head.map(t => lowerTerm(t, vars));
    const body = clause.body.map(g => lowerGoal(g, vars, sys));
    return [{args: headArgs}, ...body];
  };
  Object.defineProperty(fn, 'length', {value: varNames.length});
  return fn;
};

export const lowerRule = rule => rule.clauses.map(lowerClause);

export const lowerRules = rules => {
  const out = {};
  for (const rule of rules) out[rule.name] = lowerRule(rule);
  return out;
};
