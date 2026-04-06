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
