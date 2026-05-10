// Type definitions for yopl — public barrel for the rule compiler.

export {
  IR_KINDS,
  Var,
  Wild,
  Lit,
  Cons,
  Compound,
  List,
  Call,
  Cut,
  Fail,
  Js,
  Clause,
  Rule,
  IR,
  collectVars,
  open,
  soft,
  _,
  any,
  // Term + Goal kind interfaces and the umbrella unions, surfaced so
  // consumers can write typed walkers without per-sub-file imports.
  type VarTerm,
  type WildTerm,
  type LitTerm,
  type ConsTerm,
  type CompoundTerm,
  type Term,
  type CallGoal,
  type CutGoal,
  type FailGoal,
  type JsGoal,
  type Goal,
  type JsVars,
  type JsFactory
} from './ir.js';

export {lowerRule, lowerRules} from './lower.js';

export {validate, validateOrThrow, type Issue, type IssueKind, type ValidateOptions} from './validate.js';
