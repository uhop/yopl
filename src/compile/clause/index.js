// @ts-self-types="./index.d.ts"
//
// Per-clause front-end: tagged-template syntax for yopl rules.
//
//   import {rule, clause} from 'yopl/compile/clause/index.js';
//
//   const member = rule('member', 2)(
//     clause`(X, [X | _])`,
//     clause`(X, [_ | T]) :- member(X, T)`
//   );
//
// Grammar (MVP):
//
//   clause     := head [ ':-' body ]
//   head       := '(' [ term ( ',' term )* ] ')'
//   body       := goal ( ',' goal )*
//   goal       := '!' | 'fail' | call | interpolation
//   call       := identifier [ '(' [ term ( ',' term )* ] ')' ]
//   term       := var | wildcard | literal | list | compound | interpolation
//   var        := identifier (uppercase- or '_'-prefixed)
//   wildcard   := '_'
//   literal    := number | string | 'null' | 'true' | 'false'
//   list       := '[' [ term ( ',' term )* [ '|' term ] ] ']'
//   compound   := identifier '(' [ term ( ',' term )* ] ')'
//
// Bare lowercase identifiers without parens are an error in MVP — quote
// them as strings (`"foo"`) for atoms. Disjunction (`;`) is not
// supported; split into multiple clauses instead. Negation `\+ G`
// desugar is deferred — write `not(G)` against the system.js `not`
// rule (or your own).
//
// Lexer + parse primitives live in src/compile/parse/. iter-2's
// strict-Prolog front-end will share the lexer, cursor, term/goal
// parsers, and interp-wrap policy via the same imports.

import {Clause as IRClause, Rule as IRRule} from '../ir.js';
import {tokenize} from '../parse/lexer.js';
import {makeCursor} from '../parse/cursor.js';
import {parseArgs} from '../parse/term.js';
import {parseBody} from '../parse/goal.js';

const parseClauseTokens = (tokens, values) => {
  const cursor = makeCursor(tokens, values);
  const headStart = cursor.peek();
  cursor.eat('lparen');
  const head = parseArgs(cursor);
  cursor.eat('rparen');
  let body = [];
  if (cursor.accept('colondash')) body = parseBody(cursor);
  cursor.eat('eof');
  const source = {line: headStart.line, col: headStart.col};
  return IRClause(head, body, undefined, source);
};

export const clause = (strings, ...values) => parseClauseTokens(tokenize(strings), values);

export const rule =
  (name, arity) =>
  (...clauses) =>
    IRRule(name, arity, clauses);
