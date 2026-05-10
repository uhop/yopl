// Strict-Prolog clause parser. Produces `{name, head: Term[], body: Goal[]}`
// per parsed clause; multi-clause program parsing happens in ./program.js
// (later step), and tagged-template entry points in ./index.js.
//
// Grammar (step-4 scope; body operators `;` `->` `\+` deferred):
//
//   clause   := head [ ':-' body ] '.'
//   head     := atom-name | atom-name '(' args ')'
//   body     := goal ( ',' goal )*
//   goal     := '!' | 'fail' | call | sym-call | interpolation
//   call     := ident [ '(' args ')' ]
//   sym-call := sym '(' args ')' | sym
//   args     := expr ( ',' expr )*               (expr at maxPrio = 999)
//
// Heads must be atoms (lowercase ident or symbolic atom) — uppercase
// idents in head position are rejected because predicate names are
// atoms in Prolog, and a Var-shaped head would be incoherent.
//
// In goal position an uppercase ident becomes `Call(Var(name), args)`
// for runtime dynamic dispatch (matches iter-1's `clause` front-end).
//
// Argument terms go through the operator-precedence parser
// (`parseExpr`), so `foo(X + 1)` and `member(Y, [1, 2 | T])` parse
// as expected.

import {Var, Call, Cut, Fail} from '../ir.js';
import {wrapGoalInterp} from '../parse/interp.js';
import {isVarStart} from '../parse/util.js';
import {parseExpr} from '../parse/expr.js';

const ARG_PRIO = 999;

const parseArgList = (cursor, opTable) => {
  if (cursor.peek().kind === 'rparen') return [];
  const args = [parseExpr(cursor, opTable, ARG_PRIO)];
  while (cursor.accept('comma')) args.push(parseExpr(cursor, opTable, ARG_PRIO));
  return args;
};

const parseHead = (cursor, opTable) => {
  const t = cursor.peek();
  if (t.kind === 'ident') {
    const name = t.value;
    if (isVarStart(name)) {
      throw new Error(`uppercase identifier '${name}' cannot be a clause head — heads must be atoms`);
    }
    cursor.advance();
    if (cursor.accept('lparen')) {
      const args = parseArgList(cursor, opTable);
      cursor.eat('rparen');
      return {name, args};
    }
    return {name, args: []};
  }
  if (t.kind === 'sym') {
    const name = t.value;
    cursor.advance();
    if (cursor.accept('lparen')) {
      const args = parseArgList(cursor, opTable);
      cursor.eat('rparen');
      return {name, args};
    }
    return {name, args: []};
  }
  throw new Error(`expected clause head (atom), got ${t.kind}`);
};

export const parseGoal = (cursor, opTable) => {
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
      args = parseArgList(cursor, opTable);
      cursor.eat('rparen');
    }
    if (name === 'fail' && args.length === 0) return Fail();
    if (isVarStart(name)) return Call(Var(name), args);
    return Call(name, args);
  }
  if (t.kind === 'sym') {
    const name = t.value;
    cursor.advance();
    let args = [];
    if (cursor.accept('lparen')) {
      args = parseArgList(cursor, opTable);
      cursor.eat('rparen');
    }
    return Call(name, args);
  }
  throw new Error(`unexpected token ${t.kind} in goal`);
};

export const parseGoals = (cursor, opTable) => {
  const goals = [parseGoal(cursor, opTable)];
  while (cursor.accept('comma')) goals.push(parseGoal(cursor, opTable));
  return goals;
};

export const parseClause = (cursor, opTable) => {
  const {name, args: head} = parseHead(cursor, opTable);
  let body = [];
  if (cursor.accept('colondash')) body = parseGoals(cursor, opTable);
  cursor.eat('period');
  return {name, head, body};
};
