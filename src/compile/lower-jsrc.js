// @ts-self-types="./lower-jsrc.d.ts"
//
// Regime-B lowering entrypoint — same surface as lower.js, but each clause
// compiles to a `new Function`-emitted JS function whose body constructs the
// head args and goal sequence as literal expressions: no per-activation IR
// walk, no kind dispatch, no vars dict, no intermediate `.map` arrays
// (dev-docs/js-source-backend.md § Codegen variants, variant V2). Baseline
// lower.js stays untouched (dev-docs/implementation-discipline.md).
//
// Helpers and non-serializable values reach the emitted code through the
// `new Function('H', 'C', src)(HELPERS, consts)` wrapper — the returned
// arrow closes over them at compile time; `new Function` itself cannot
// close over locals (see topics/new-function-vs-eval-for-codegen).
//
// Per-clause bail to the baseline closure lowering: a plain object/array
// appearing twice inside one Lit value (the baseline's per-Lit seen map
// aliases those in its output; a literal expression cannot), or any shape
// the emitter doesn't recognize.

import {variable} from 'deep6/env.js';
import {call as runtimeCall, cut as runtimeCut, fail as runtimeFail} from '../rules/system-runtime.js';
import {collectVars, IR_KINDS} from './ir.js';
import {lowerRule as lowerRuleClosures} from './lower.js';

const BAIL = new Error('jsrc: bail to closure lowering');

const mkVars = (names, vals) => {
  const o = {};
  for (let i = 0; i < names.length; ++i) o[names[i]] = vals[i];
  return o;
};

const HELPERS = {variable, call: runtimeCall, cut: runtimeCut, fail: runtimeFail, mkVars};

const emitNumber = n => {
  if (Number.isNaN(n)) return 'NaN';
  if (n === Infinity) return 'Infinity';
  if (n === -Infinity) return '-Infinity';
  if (Object.is(n, -0)) return '-0';
  return String(n);
};

// Mirrors lower.js's lowerLitValue: plain objects/arrays become fresh-per-
// activation literal expressions, nested IR nodes become term expressions,
// everything else (Map, Set, Date, Wrap, class instances, symbols,
// functions) is shared by reference via the consts table — the baseline's
// as-is path.
const emitLitValue = (val, seen, ctx) => {
  if (val === null) return 'null';
  switch (typeof val) {
    case 'number':
      return emitNumber(val);
    case 'string':
      return JSON.stringify(val);
    case 'boolean':
      return String(val);
    case 'undefined':
      return 'undefined';
    case 'bigint':
      return `${val}n`;
    case 'symbol':
    case 'function':
      return ctx.cref(val);
  }
  if (typeof val.kind === 'string' && IR_KINDS.has(val.kind)) return emitTerm(val, ctx);
  if (Array.isArray(val)) {
    if (seen.has(val)) throw BAIL;
    seen.add(val);
    const parts = [];
    for (const e of val) parts.push(emitLitValue(e, seen, ctx));
    return `[${parts.join(', ')}]`;
  }
  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null) return ctx.cref(val);
  if (seen.has(val)) throw BAIL;
  seen.add(val);
  const parts = Object.keys(val).map(k => `${JSON.stringify(k)}: ${emitLitValue(val[k], seen, ctx)}`);
  return `{${parts.join(', ')}}`;
};

const emitTerm = (term, ctx) => {
  switch (term.kind) {
    case 'var':
      // unknown name → baseline's `vars[name]` is undefined; keep parity
      return ctx.params.get(term.name) ?? 'undefined';
    case 'wildcard':
      return '$v()';
    case 'literal':
      return emitLitValue(term.value, new Set(), ctx);
    case 'cons':
      return `{value: ${emitTerm(term.head, ctx)}, next: ${emitTerm(term.tail, ctx)}}`;
    case 'compound': {
      const name = typeof term.name === 'string' ? JSON.stringify(term.name) : emitTerm(term.name, ctx);
      return `{name: ${name}, args: [${term.args.map(a => emitTerm(a, ctx)).join(', ')}]}`;
    }
  }
  throw BAIL;
};

const emitGoal = (goal, ctx) => {
  switch (goal.kind) {
    case 'call': {
      const args = goal.args.map(a => emitTerm(a, ctx));
      if (typeof goal.name === 'string') {
        return args.length ? `{name: ${JSON.stringify(goal.name)}, args: [${args.join(', ')}]}` : JSON.stringify(goal.name);
      }
      const name = emitTerm(goal.name, ctx);
      return `$call(${args.length ? `{name: ${name}, args: [${args.join(', ')}]}` : name})`;
    }
    case 'cut':
      return '$cut(sys)';
    case 'fail':
      return '$fail';
    case 'js':
      ctx.usesVars = true;
      return `${ctx.cref(goal.factory)}(vr, sys)`;
  }
  throw BAIL;
};

const compileClause = (clause, ruleName, index) => {
  const varNames = clause.vars ?? collectVars(clause);
  const params = new Map(varNames.map((n, i) => [n, `v${i}`]));
  const consts = [];
  const ctx = {
    params,
    usesVars: false,
    cref: v => `C[${consts.includes(v) ? consts.indexOf(v) : consts.push(v) - 1}]`
  };
  const elements = [`{args: [${clause.head.map(t => emitTerm(t, ctx)).join(', ')}]}`, ...clause.body.map(g => emitGoal(g, ctx))];
  const paramList = [...varNames.map((n, i) => `v${i}`), '...sys'].join(', ');
  const list = `[${elements.join(', ')}]`;
  let arrow;
  if (ctx.usesVars) {
    // js factories receive the baseline's vars record — one shared object
    // per activation, keyed by the user-var names
    const vr = varNames.every(n => typeof n === 'string')
      ? `{${varNames.map((n, i) => `${JSON.stringify(n)}: v${i}`).join(', ')}}`
      : `$mkVars(${ctx.cref(varNames)}, [${varNames.map((n, i) => `v${i}`).join(', ')}])`;
    arrow = `(${paramList}) => {\n  const vr = ${vr};\n  return ${list};\n}`;
  } else {
    arrow = `(${paramList}) => ${list}`;
  }
  const src = `const $v = H.variable, $call = H.call, $cut = H.cut, $fail = H.fail, $mkVars = H.mkVars;\nreturn ${arrow};\n//# sourceURL=yopl-jsrc/${ruleName}.${index}`;
  const fn = new Function('H', 'C', src)(HELPERS, consts);
  if (clause.source !== undefined) {
    Object.defineProperty(fn, 'source', {value: clause.source});
  }
  return fn;
};

export const lowerRule = rule =>
  rule.clauses.map((clause, i) => {
    try {
      return compileClause(clause, rule.name, i);
    } catch {
      return lowerRuleClosures({clauses: [clause]})[0];
    }
  });

export const lowerRules = rules => {
  const out = {};
  for (const rule of rules) out[rule.name] = lowerRule(rule);
  return out;
};
