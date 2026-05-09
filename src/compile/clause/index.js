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

import {Var, Wild, Lit, Compound, List, Call, Cut, Fail, Clause as IRClause, Rule as IRRule} from '../ir.js';

// ---------------------------------------------------------------------------
// Lexer

const isAlpha = c => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_';
const isAlnum = c => isAlpha(c) || (c >= '0' && c <= '9');
const isDigit = c => c >= '0' && c <= '9';

const tokenizeChunk = (text, tokens) => {
  let i = 0;
  const l = text.length;
  while (i < l) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      ++i;
      continue;
    }
    if (c === ':' && text[i + 1] === '-') {
      tokens.push({kind: 'colondash'});
      i += 2;
      continue;
    }
    if (c === '(') {
      tokens.push({kind: 'lparen'});
      ++i;
      continue;
    }
    if (c === ')') {
      tokens.push({kind: 'rparen'});
      ++i;
      continue;
    }
    if (c === '[') {
      tokens.push({kind: 'lbracket'});
      ++i;
      continue;
    }
    if (c === ']') {
      tokens.push({kind: 'rbracket'});
      ++i;
      continue;
    }
    if (c === ',') {
      tokens.push({kind: 'comma'});
      ++i;
      continue;
    }
    if (c === '|') {
      tokens.push({kind: 'pipe'});
      ++i;
      continue;
    }
    if (c === '!') {
      tokens.push({kind: 'bang'});
      ++i;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      while (j < l && text[j] !== quote) {
        if (text[j] === '\\') ++j;
        ++j;
      }
      if (j >= l) throw new Error(`unterminated string at offset ${i}`);
      const raw = text.slice(i + 1, j).replace(/\\(.)/g, '$1');
      tokens.push({kind: 'string', value: raw});
      i = j + 1;
      continue;
    }
    if (isDigit(c) || (c === '-' && isDigit(text[i + 1]))) {
      let j = i + (c === '-' ? 1 : 0);
      while (j < l && isDigit(text[j])) ++j;
      if (text[j] === '.') {
        ++j;
        while (j < l && isDigit(text[j])) ++j;
      }
      tokens.push({kind: 'number', value: Number(text.slice(i, j))});
      i = j;
      continue;
    }
    if (isAlpha(c)) {
      let j = i + 1;
      while (j < l && isAlnum(text[j])) ++j;
      tokens.push({kind: 'ident', value: text.slice(i, j)});
      i = j;
      continue;
    }
    throw new Error(`unexpected character '${c}' at offset ${i}`);
  }
};

const tokenize = strings => {
  const tokens = [];
  for (let i = 0; i < strings.length; ++i) {
    tokenizeChunk(strings[i], tokens);
    if (i + 1 < strings.length) tokens.push({kind: 'interp', index: i});
  }
  tokens.push({kind: 'eof'});
  return tokens;
};

// ---------------------------------------------------------------------------
// Parser

const isVarStart = name => /^[A-Z_]/.test(name);

const parseClauseTokens = (tokens, values) => {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = kind => {
    if (peek().kind !== kind) throw new Error(`expected ${kind}, got ${peek().kind}`);
    return tokens[pos++];
  };
  const accept = kind => (peek().kind === kind ? tokens[pos++] : null);

  const parseTerm = () => {
    const t = peek();
    if (t.kind === 'interp') {
      ++pos;
      return values[t.index];
    }
    if (t.kind === 'number') {
      ++pos;
      return Lit(t.value);
    }
    if (t.kind === 'string') {
      ++pos;
      return Lit(t.value);
    }
    if (t.kind === 'lbracket') return parseList();
    if (t.kind === 'ident') {
      const name = t.value;
      ++pos;
      if (accept('lparen')) {
        const args = parseArgs();
        eat('rparen');
        return Compound(name, args);
      }
      if (name === '_') return Wild();
      if (name === 'null') return Lit(null);
      if (name === 'true') return Lit(true);
      if (name === 'false') return Lit(false);
      if (isVarStart(name)) return Var(name);
      throw new Error(`bare lowercase atom '${name}' in arg position — quote as a string`);
    }
    throw new Error(`unexpected token ${t.kind} in term`);
  };

  const parseList = () => {
    eat('lbracket');
    if (accept('rbracket')) return Lit(null);
    const items = [parseTerm()];
    while (accept('comma')) items.push(parseTerm());
    let tail;
    if (accept('pipe')) tail = parseTerm();
    eat('rbracket');
    return List(items, tail);
  };

  const parseArgs = () => {
    if (peek().kind === 'rparen') return [];
    const args = [parseTerm()];
    while (accept('comma')) args.push(parseTerm());
    return args;
  };

  const parseHead = () => {
    eat('lparen');
    const args = parseArgs();
    eat('rparen');
    return args;
  };

  const parseGoal = () => {
    const t = peek();
    if (t.kind === 'interp') {
      ++pos;
      return values[t.index];
    }
    if (t.kind === 'bang') {
      ++pos;
      return Cut();
    }
    if (t.kind === 'ident') {
      const name = t.value;
      ++pos;
      let args = [];
      if (accept('lparen')) {
        args = parseArgs();
        eat('rparen');
      }
      if (name === 'fail' && args.length === 0) return Fail();
      if (isVarStart(name)) return Call(Var(name), args);
      return Call(name, args);
    }
    throw new Error(`unexpected token ${t.kind} in goal`);
  };

  const parseBody = () => {
    const goals = [parseGoal()];
    while (accept('comma')) goals.push(parseGoal());
    return goals;
  };

  const head = parseHead();
  let body = [];
  if (accept('colondash')) body = parseBody();
  eat('eof');
  return IRClause(head, body);
};

// ---------------------------------------------------------------------------
// Public API

export const clause = (strings, ...values) => parseClauseTokens(tokenize(strings), values);

export const rule =
  (name, arity) =>
  (...clauses) =>
    IRRule(name, arity, clauses);
