// Goal-position parsing primitives — Goal IR producers for clause
// bodies. Shares the cursor convention of ./term.js.

import {Var, Call, Cut, Fail} from '../ir.js';
import {wrapGoalInterp} from './interp.js';
import {parseArgs} from './term.js';
import {isVarStart} from './util.js';

export const parseGoal = cursor => {
  const t = cursor.peek();
  if (t.kind === 'interp') {
    cursor.advance();
    return wrapGoalInterp(cursor.values[t.index]);
  }
  if (t.kind === 'bang') {
    cursor.advance();
    return Cut();
  }
  if (t.kind === 'ident') {
    const name = t.value;
    cursor.advance();
    let args = [];
    if (cursor.accept('lparen')) {
      args = parseArgs(cursor);
      cursor.eat('rparen');
    }
    if (name === 'fail' && args.length === 0) return Fail();
    if (isVarStart(name)) return Call(Var(name), args);
    return Call(name, args);
  }
  throw new Error(`unexpected token ${t.kind} in goal`);
};

export const parseBody = cursor => {
  const goals = [parseGoal(cursor)];
  while (cursor.accept('comma')) goals.push(parseGoal(cursor));
  return goals;
};
