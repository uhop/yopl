// Strict-Prolog clause parser. Produces `{name, head: Term[], body: Goal[]}`
// per parsed clause; multi-clause program parsing happens in ./program.js,
// and tagged-template entry points in ./index.js.
//
// Grammar:
//
//   clause   := head [ ':-' body ] '.'
//   head     := atom-name | atom-name '(' args ')'
//   body     := body-expr                       (parsed via parseBodyExpr)
//   args     := expr ( ',' expr )*              (expr at maxPrio = 999)
//
// Heads must be atoms (lowercase ident or symbolic atom) — uppercase
// idents in head position are rejected because predicate names are
// atoms in Prolog, and a Var-shaped head would be incoherent.
//
// Body parsing uses the body-context Pratt parser (parseBodyExpr) which
// handles `,` (conjunction) and `\+` (negation) operators along with
// `!` cut, `fail`, and goal-context interpolation slots. The resulting
// term tree is then walked by `goalize` to produce a `Goal[]`.
//
// Argument terms (head args, body-call args) go through the term-context
// operator-precedence parser (`parseExpr`), so `foo(X + 1)` parses
// correctly with arithmetic operators. The `parseGoal`/`parseGoals`
// helpers below remain for direct testing and for parsing simple
// directive goals (`:- op(...)`); they don't see body operators.

import {Var, Call, Cut, Fail} from '../ir.js';
import {wrapGoalInterp} from '../parse/interp.js';
import {isVarStart} from '../parse/util.js';
import {parseExpr} from '../parse/expr.js';
import {parseBodyExpr, transformBody} from '../parse/body-expr.js';

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
  let helpers = [];
  if (cursor.accept('colondash')) {
    const bodyTerm = parseBodyExpr(cursor, opTable);
    ({body, helpers} = transformBody(head, bodyTerm));
  }
  cursor.eat('period');
  const result = {name, head, body};
  if (helpers.length > 0) result.helpers = helpers;
  return result;
};
