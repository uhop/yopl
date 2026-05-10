// @ts-self-types="./system-runtime.d.ts"
import {isVariable} from 'deep6/env.js';

export const fail = () => false;
export const halt = (env, goals, stack) => (stack.splice(0), false);
export const cut = sys => (env, goals, stack) => {
  const lastFrame = sys[0].get(env);
  for (let i = stack.length - 1; i >= 0; --i) {
    const frame = stack[i];
    if (frame.command === 2) {
      frame.index = Infinity;
    }
    if (frame === lastFrame) break;
  }
  return true;
};
export const call = X => (env, goals) => {
  let term = X,
    name,
    args;
  // TODO: add processing of arrays of goals
  if (isVariable(X)) {
    if (!X.isBound(env)) return false;
    term = X.get(env);
  }
  if (typeof term == 'string') {
    name = term;
  } else {
    if (!term || typeof term != 'object') return false;
    name = term.name;
    args = term.args;
    if (isVariable(name)) {
      name = name.get(env);
    }
    if (typeof name != 'string') return false;
    if (isVariable(args)) {
      args = args.get(env);
    }
    if (args && !Array.isArray(args)) return false;
  }
  return {terms: [{name, args}], index: 0, next: goals};
};
