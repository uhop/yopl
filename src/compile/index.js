// @ts-self-types="./index.d.ts"
//
// Public barrel for the rule compiler. Re-exports the IR constructors
// + types, the lowering pass, and the validation pass so consumers can
// `import {Var, Wild, Lit, Cons, Compound, List, Call, Cut, Fail, Js,
// Clause, Rule, lowerRules, validate, ...} from 'yopl/compile';`
// without reaching into individual sub-files.
//
// Front-ends (clause, prolog) are NOT re-exported from here — they
// each live at their own subpath (`yopl/compile/clause`,
// `yopl/compile/prolog`) so consumers only pay the parser cost they
// actually use. The IR is the contract front-ends and lowering share;
// importing it from one place keeps that contract obvious.

export {IR_KINDS, Var, Wild, Lit, Cons, Compound, List, Call, Cut, Fail, Js, Clause, Rule, IR, collectVars, open, soft, _, any} from './ir.js';

export {lowerRule, lowerRules} from './lower.js';

export {validate, validateOrThrow} from './validate.js';
