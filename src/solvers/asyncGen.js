// @ts-self-types="./asyncGen.d.ts"
import unify, {variable} from 'deep6/unify.js';
import {EnvMap} from 'deep6/env-map.js';

let counter = 0;
const generateVariables = count => {
  const vars = new Array(count);
  for (let i = 0; i < count; ++i) vars[i] = variable(Symbol(counter++));
  return vars;
};

const POP = {command: 1};
const NO_ARGS = Object.freeze([]);

async function* prove(rules, goals, env) {
  const stack = [{goals}];
  main: while (stack.length) {
    const frame = stack.pop();
    if (frame.command) {
      if (frame.command === 1) {
        env.pop();
        continue main;
      }
      while (frame.index < frame.ruleList.length) {
        const rule = frame.ruleList[frame.index++],
          vars = generateVariables(rule.length + 1),
          terms = (typeof rule == 'function' ? rule : rule.goals)(...vars);
        env.push();
        if (unify(terms[0].args || NO_ARGS, frame.args, env)) {
          // restoreParent stamps the post-call position of the outer
          // goals onto the new sub-goals. When the proof later walks
          // up via .next, the outer's index is reset to this value —
          // undoing any forward mutation made by downstream search,
          // so subsequent body goals don't get silently skipped on
          // backtracking-then-rematch paths.
          const newGoals = {terms, index: 1, next: frame.goals, restoreParent: frame.restoreIndex};
          stack.push(frame, POP, {goals: newGoals});
          env.bindVal(vars[vars.length - 1].name, frame);
          continue main;
        }
        env.pop();
      }
      continue main;
    }
    let goals = frame.goals;
    while (goals && goals.index >= goals.terms.length) {
      const parent = goals.next;
      if (parent && goals.restoreParent !== undefined) parent.index = goals.restoreParent;
      goals = parent;
    }
    if (!goals) {
      yield env;
      continue main;
    }
    let goal = goals.terms[goals.index++];
    if (typeof goal == 'function') {
      env.push();
      let newGoals = await goal(env, goals, stack);
      if (newGoals || newGoals === null) {
        newGoals && !newGoals.terms && (newGoals = goals);
        stack.push(POP, {goals: newGoals});
        continue main;
      }
      --goals.index;
      env.pop();
      continue main;
    }
    if (typeof goal == 'string') {
      goal = {name: goal};
    }
    let ruleList = rules[goal.name];
    if (ruleList === null) continue main;
    if (!Array.isArray(ruleList)) ruleList = [ruleList];
    stack.push({command: 2, ruleList, index: 0, goals, args: goal.args || NO_ARGS, restoreIndex: goals.index});
  }
}

async function* generate(rules, name, args) {
  const env = new EnvMap();
  env.options.openObjects = true;
  const goals = {terms: [{name, args}], index: 0, next: null};
  yield* prove(rules, goals, env);
}

export default generate;
export {generate};
