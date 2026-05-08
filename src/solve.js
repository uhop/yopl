// @ts-self-types="./solve.d.ts"
import unify, {Env, variable} from 'deep6/unify.js';

let counter = 0;
const generateVariables = count => {
  const vars = new Array(count);
  for (let i = 0; i < count; ++i) vars[i] = variable(Symbol(counter++));
  return vars;
};

const POP = {command: 1};
const NO_ARGS = Object.freeze([]);

const prove = (rules, goals, env) => {
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
          const newGoals = {terms, index: 1, next: frame.goals};
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
      goals = goals.next;
    }
    if (!goals) continue main;
    let goal = goals.terms[goals.index++];
    if (typeof goal == 'function') {
      env.push();
      let newGoals = goal(env, goals, stack);
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
    if (ruleList == null) continue main;
    if (!Array.isArray(ruleList)) ruleList = [ruleList];
    stack.push({command: 2, ruleList, index: 0, goals, args: goal.args || NO_ARGS});
  }
};

const solve = (rules, name, args, callback) => {
  const env = new Env();
  env.openObjects = true;
  const goals = {terms: [{name, args}, env => (callback(env), false)], index: 0, next: null};
  prove(rules, goals, env);
};

export default solve;
