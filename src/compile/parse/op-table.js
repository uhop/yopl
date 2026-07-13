// @ts-self-types="./op-table.d.ts"
// Operator table — parse-time data consumed by the Pratt expression
// parser. Plain objects with two `Map`s keyed by operator name; one
// for infix entries, one for prefix entries. A name can have entries
// in both (`-` is binary 500 yfx and unary 200 fy).
//
// Entry shape: `{name, priority, type, target?}` where `type` is one
// of `'xfx' | 'xfy' | 'yfx'` (infix) or `'fx' | 'fy'` (prefix). The
// optional `target` is for `op/4` aliasing — body-context lowering
// rewrites `A op B` to `Call(target, [A, B])` instead of
// `Compound(op, [A, B])`. Term-context parsing ignores `target` and
// always emits `Compound`.
//
// Postfix (`xf`, `yf`) is not yet supported; ISO Prolog has very few
// uses and yopl has none. Add when a real need arises.

const isInfixType = t => t === 'xfx' || t === 'xfy' || t === 'yfx';
const isPrefixType = t => t === 'fx' || t === 'fy';

export const makeOpTable = () => ({
  infix: new Map(),
  prefix: new Map()
});

export const addOp = (table, {name, priority, type, target}) => {
  const entry = {name, priority, type};
  if (target !== undefined) entry.target = target;
  if (isInfixType(type)) {
    table.infix.set(name, entry);
  } else if (isPrefixType(type)) {
    table.prefix.set(name, entry);
  } else {
    throw new Error(`unknown operator type: ${type}`);
  }
  return table;
};

export const cloneOpTable = src => ({
  infix: new Map(src.infix),
  prefix: new Map(src.prefix)
});

// Term-context default operator table. Body-context operators
// (`,`, `;`, `->`, `\+`) are NOT included here — they belong to a
// separate table built by the body parser.
const TERM_DEFAULTS = [
  {name: '=', priority: 700, type: 'xfx'},
  {name: '\\=', priority: 700, type: 'xfx'},
  {name: '==', priority: 700, type: 'xfx'},
  {name: '\\==', priority: 700, type: 'xfx'},
  {name: '<', priority: 700, type: 'xfx'},
  {name: '>', priority: 700, type: 'xfx'},
  {name: '=<', priority: 700, type: 'xfx'},
  {name: '>=', priority: 700, type: 'xfx'},
  {name: '=:=', priority: 700, type: 'xfx'},
  {name: '=\\=', priority: 700, type: 'xfx'},
  {name: 'is', priority: 700, type: 'xfx'},
  {name: '+', priority: 500, type: 'yfx'},
  {name: '-', priority: 500, type: 'yfx'},
  {name: '*', priority: 400, type: 'yfx'},
  {name: '/', priority: 400, type: 'yfx'},
  {name: '//', priority: 400, type: 'yfx'},
  {name: 'mod', priority: 400, type: 'yfx'},
  {name: '-', priority: 200, type: 'fy'},
  {name: '+', priority: 200, type: 'fy'}
];

export const defaultTermOpTable = () => {
  const table = makeOpTable();
  for (const op of TERM_DEFAULTS) addOp(table, op);
  return table;
};

// Body-context operators added on top of the term defaults. Conjunction
// `,` at 1000 stays above the args parser's maxPrio of 999, so it
// remains a structural separator inside `[...]` and `(...)` while
// becoming a true conjunction operator at the body's maxPrio of 1200.
// `\+` carries `target: 'not'` so the prefix-application desugars to
// `Compound('not', [G])` at parse time, which `goalize` then converts
// to `Call('not', [G])`.
const BODY_DEFAULTS = [
  {name: ',', priority: 1000, type: 'xfy'},
  {name: ';', priority: 1100, type: 'xfy'},
  {name: '->', priority: 1050, type: 'xfy'},
  {name: '\\+', priority: 900, type: 'fy', target: 'not'}
];

export const defaultBodyOpTable = () => {
  const table = defaultTermOpTable();
  for (const op of BODY_DEFAULTS) addOp(table, op);
  return table;
};
