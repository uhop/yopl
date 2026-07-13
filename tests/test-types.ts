// TypeScript typing test for yopl. This file is checked by `npm run ts-check`
// (`tsc --noEmit`). It exercises the public types only — there are no
// runtime assertions; the goal is to make sure the .d.ts files compile and
// that imports resolve.

import {variable, type Variable, type Env} from 'deep6/env.js';
import assemble from 'deep6/traverse/assemble.js';

import solve, {type Rules, type Rule, type RuleBody, type Goal, type GoalFn, type GoalFrame, type SolveCallback, type TermObject} from '../src/solve.js';
import gen from '../src/solvers/gen.js';
import asyncSolve, {type AsyncSolveCallback} from '../src/solvers/async.js';
import asyncGen from '../src/solvers/asyncGen.js';

import {fail, halt, cut, call, isBound, head, term, list, listHead, rest, Tail, rules as systemRules} from '../src/rules/system.js';
import {rules as compRules} from '../src/rules/comp.js';
import {rules as mathRules} from '../src/rules/math.js';
import {rules as bitsRules} from '../src/rules/bits.js';
import {rules as logicRules} from '../src/rules/logic.js';

// ----- helper-builder return shapes -----
const h: TermObject = head(1, 2, 3);
const t: TermObject = term('foo', 1, 2);
const r: Tail = rest({});
const l: unknown = list(1, 2, 3, rest({}));
const l2: unknown = listHead(1, 2, {marker: true});

// ----- rule database literal -----
const rules: Rules = {
  ...systemRules,
  ...compRules,
  ...mathRules,
  ...bitsRules,
  ...logicRules,
  one: () => [head(1)],
  member: [
    (V: Variable, X: Variable) => [{args: [{value: V, next: X}, V]}],
    (V: Variable, X: Variable) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]
  ] as ReadonlyArray<RuleBody>
};

// ----- callback solver -----
const X: Variable = variable('X');
const cb: SolveCallback = (env: Env) => {
  const x = assemble(X, env);
  void x;
};
solve(rules, 'one', [], cb);
solve(rules, 'member', [{value: 1, next: null}, X], cb);

// ----- generator solver -----
for (const env of gen(rules, 'one', [])) {
  void env;
}

// ----- async callback solver -----
const acb: AsyncSolveCallback = async (env: Env) => {
  void env;
};
void asyncSolve(rules, 'one', [], acb);

// ----- async generator solver -----
async function consume() {
  for await (const env of asyncGen(rules, 'one', [])) {
    void env;
  }
}
void consume();

// ----- system helpers as goals -----
const _f: GoalFn = fail;
const _h: GoalFn = halt;
const _c: GoalFn = cut([] as ReadonlyArray<Variable>);
const _ca: GoalFn = call('one');
const _cb2: GoalFn = call({name: 'one'});
const _ib: GoalFn = isBound(X);

// ensure inferred Goal/Rule shapes accept these
const ruleBody: RuleBody = (V: Variable) => [head(V), _f];
const _rule: Rule = ruleBody;
const _disj: Rule = [ruleBody, ruleBody];
void _rule;
void _disj;

// ensure GoalFrame is exported
const _frame: GoalFrame | null = null;
void _frame;

// also ensure Goal type is usable
const _g: Goal = 'one';
const _g2: Goal = {name: 'one', args: [1]};
void _g;
void _g2;

// ----- yopl/compile (public barrel) -----
//
// Note: `Rule` and `Clause` from `yopl/compile` are the IR-level types;
// they collide by name with `Rule` from `yopl` (the runtime form
// `RuleBody | ReadonlyArray<RuleBody>`). Aliased to `IRRule` / `IRClause`
// to make the distinction explicit at the test site. (End-user code can
// likewise alias on import.)
import {
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
  Clause as IRClause,
  Rule as IRRule,
  IR,
  IR_KINDS,
  collectVars,
  lowerRule,
  lowerRules,
  validate,
  validateOrThrow,
  open,
  soft,
  _ as wildSentinel,
  any as anySentinel,
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
  type Goal as IRGoal,
  type JsVars,
  type JsFactory,
  type ClauseSource,
  type Clause as IRClauseType,
  type Rule as IRRuleType
} from 'yopl/compile';
import {type Issue, type IssueKind, type ValidateOptions} from 'yopl/compile';

const _vt: VarTerm = Var('X');
const _wt: WildTerm = Wild();
const _lt: LitTerm = Lit(42);
const _ct: ConsTerm = Cons(Var('H'), Var('T'));
const _comp: CompoundTerm = Compound('foo', [Var('X')]);
const _listterm: Term = List([Var('A'), Var('B')]);
const _callg: CallGoal = Call('member', [Var('X')]);
const _cutg: CutGoal = Cut();
const _failg: FailGoal = Fail();
const _jsg: JsGoal = Js((_vars: JsVars, _sys) => () => true);
const _jsf: JsFactory = (vars, _sys) => env => vars['X'].isBound(env);
const _csrc: ClauseSource = {file: 'a.pl', line: 1, col: 1};
const _cir: IRClauseType = IRClause([_vt], [_callg], ['X'], _csrc);
const _rir: IRRuleType = IRRule('member', 1, [_cir]);
const _irsym: typeof IR = IR;
const _kinds: typeof IR_KINDS = IR_KINDS;
const _varsList: string[] = collectVars(_cir);
const _lr: RuleBody[] = lowerRule(_rir);
const _lrs: Rules = lowerRules([_rir]);
const _issues: Issue[] = validate([_rir]);
const _ikind: IssueKind = 'arity-mismatch';
const _vopt: ValidateOptions = {checkRuleReferences: true};
validateOrThrow([_rir], _vopt);
const _gv: IRGoal = _callg;
void [
  _vt,
  _wt,
  _lt,
  _ct,
  _comp,
  _listterm,
  _callg,
  _cutg,
  _failg,
  _jsg,
  _jsf,
  _cir,
  _rir,
  _irsym,
  _kinds,
  _varsList,
  _lr,
  _lrs,
  _issues,
  _ikind,
  _gv,
  open,
  soft,
  wildSentinel,
  anySentinel
];

// ----- yopl/compile/clause.js -----
import {rule, clause} from 'yopl/compile/clause.js';
const _cl: IRClauseType = clause`(X, [X | _])`;
const _cr: IRRuleType = rule('member', 2)(clause`(X, [X | _])`, clause`(X, [_ | T]) :- member(X, T)`);
void [_cl, _cr];

// ----- yopl/compile/prolog -----
import {
  prolog,
  prologClause,
  type PrologTag,
  type PrologClauseTag,
  type PrologOptions,
  type PrologOpDecl,
  type PrologLoweredResult,
  type PrologIRResult,
  type PrologClauseResult
} from 'yopl/compile/prolog';

const _pt: PrologTag = prolog;
const _pct: PrologClauseTag = prologClause;
const _popts: PrologOptions = {sourceMap: true, file: 'rules.pl', lower: false};
const _popd: PrologOpDecl = {priority: 700, type: 'xfx', name: '=>'};
const _pl: PrologLoweredResult | PrologIRResult = prolog`foo(X).`;
const _pir: PrologIRResult = prolog.with({lower: false})`foo(X).` as PrologIRResult;
const _pcr: PrologClauseResult = prologClause`foo(X)`;
void [_pt, _pct, _popts, _popd, _pl, _pir, _pcr];

// ----- yopl/compile/prolog/file.js -----
import {prologFile, prologFileAsync} from 'yopl/compile/prolog/file.js';

const _pfile: PrologLoweredResult | PrologIRResult = prologFile('rules.pl');
const _pfileu = prologFile(new URL('file:///tmp/rules.pl'), {sourceMap: true});
async function _loadFile() {
  const r = await prologFileAsync('rules.pl');
  void r;
}
void [_pfile, _pfileu, _loadFile];
