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
// Interpolation values:
//
//   In arg position (head args, list elements, compound args):
//     - primitives + null + undefined → wrapped as `Lit(value)`
//     - object with string `.kind`    → used as-is (Term IR)
//     - anything else                 → throws (must wrap explicitly)
//
//   In goal position (body):
//     - function                      → wrapped as `Js(fn)` — factory shape
//     - object with string `.kind`    → used as-is (Goal IR)
//     - anything else                 → throws

import {Var, Wild, Lit, Compound, List, Call, Cut, Fail, Js, Clause as IRClause, Rule as IRRule} from '../ir.js';

const isIRNode = v => v !== null && typeof v === 'object' && typeof v.kind === 'string';

const wrapTermInterp = v => {
  if (isIRNode(v)) return v;
  const t = typeof v;
  if (v === null || t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint' || t === 'undefined' || t === 'symbol') return Lit(v);
  throw new Error(`interpolation in arg position must be a Term IR or primitive, got ${t === 'object' ? 'object without .kind' : t}`);
};

const wrapGoalInterp = v => {
  if (typeof v === 'function') return Js(v);
  if (isIRNode(v)) return v;
  throw new Error(`interpolation in goal position must be a Goal IR or function, got ${v === null ? 'null' : typeof v}`);
};

// ---------------------------------------------------------------------------
// Lexer
//
// One sticky-regex alternation per token: the regex engine (V8 Irregexp,
// JIT-compiled) eats whole lexemes in native code; the JS side only
// dispatches on the first character of an already-extracted match.
// Same shape as `stream-json`'s parser, collapsed to one state because
// the clause grammar is context-free at the lexer level.

const TOKEN_RE = /[ \t\n\r]+|:-|[()[\],|!]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|[A-Za-z_]\w*/y;

const tokenizeChunk = (text, tokens) => {
  let i = 0;
  const l = text.length;
  while (i < l) {
    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(text);
    if (!m) throw new Error(`unexpected character '${text[i]}' at offset ${i}`);
    const lex = m[0];
    const c = lex.charCodeAt(0);
    i = TOKEN_RE.lastIndex;
    if (c < 33) continue; // whitespace
    if (c === 58) {
      tokens.push({kind: 'colondash'});
      continue;
    } // :
    if (c === 40) {
      tokens.push({kind: 'lparen'});
      continue;
    } // (
    if (c === 41) {
      tokens.push({kind: 'rparen'});
      continue;
    } // )
    if (c === 91) {
      tokens.push({kind: 'lbracket'});
      continue;
    } // [
    if (c === 93) {
      tokens.push({kind: 'rbracket'});
      continue;
    } // ]
    if (c === 44) {
      tokens.push({kind: 'comma'});
      continue;
    } // ,
    if (c === 124) {
      tokens.push({kind: 'pipe'});
      continue;
    } // |
    if (c === 33) {
      tokens.push({kind: 'bang'});
      continue;
    } // !
    if (c === 34 || c === 39) {
      tokens.push({kind: 'string', value: lex.slice(1, -1).replace(/\\(.)/g, '$1')});
      continue;
    } // " or '
    if (c === 45 || (c >= 48 && c <= 57)) {
      tokens.push({kind: 'number', value: Number(lex)});
      continue;
    } // - or 0-9
    tokens.push({kind: 'ident', value: lex}); // identifier
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
      return wrapTermInterp(values[t.index]);
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
        return Compound(isVarStart(name) ? Var(name) : name, args);
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
      return wrapGoalInterp(values[t.index]);
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
