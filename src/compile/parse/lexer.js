// Sticky-regex tokenizer shared by all yopl front-ends.
//
// One regex alternation per token: the regex engine (V8 Irregexp,
// JIT-compiled) eats whole lexemes in native code; the JS side only
// dispatches on the first character of an already-extracted match.
// Same shape as `stream-json`'s parser, collapsed to one state because
// the grammar is context-free at the lexer level.
//
// Slot tokens (`{kind: 'interp', index}`) are emitted between adjacent
// string chunks of a tagged template, allowing front-ends to consult
// the corresponding interpolation value at parse time.
//
// Comments (`% line`, `/* block */`) are recognized out-of-band before
// the main regex so unterminated block comments produce a clean error.
// Whitespace, line comments, and block comments emit no tokens.
//
// Number literals are non-negative; unary minus is a parser concern
// (the lexer emits `[sym -, number N]` for source `-N`). Symbolic
// operator atoms (`=`, `\=`, `=:=`, `\+`, etc.) lex as `sym` tokens
// with the operator string in `value`. The privileged `:-` keeps its
// own kind for the head/body separator.

const TOKEN_RE = /[ \t\n\r]+|:-|[()[\],|!.;]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+(?:\.\d+)?|[A-Za-z_]\w*|[+\-*/\\^<>=~:?@#$&]+/y;

export const tokenizeChunk = (text, tokens) => {
  let i = 0;
  const l = text.length;
  while (i < l) {
    const ch = text.charCodeAt(i);
    if (ch === 37) {
      // % line comment
      while (i < l && text.charCodeAt(i) !== 10) ++i;
      continue;
    }
    if (ch === 47 && text.charCodeAt(i + 1) === 42) {
      // /* block comment */
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`unterminated block comment at offset ${i}`);
      i = end + 2;
      continue;
    }
    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(text);
    if (!m) throw new Error(`unexpected character '${text[i]}' at offset ${i}`);
    const lex = m[0];
    const c = lex.charCodeAt(0);
    i = TOKEN_RE.lastIndex;
    if (c < 33) continue; // whitespace
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
    if (c === 46) {
      tokens.push({kind: 'period'});
      continue;
    } // .
    if (c === 59) {
      tokens.push({kind: 'semicolon'});
      continue;
    } // ;
    if (lex === ':-') {
      tokens.push({kind: 'colondash'});
      continue;
    }
    if (c === 34 || c === 39) {
      tokens.push({kind: 'string', value: lex.slice(1, -1).replace(/\\(.)/g, '$1')});
      continue;
    } // " or '
    if (c >= 48 && c <= 57) {
      tokens.push({kind: 'number', value: Number(lex)});
      continue;
    } // 0-9
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95) {
      tokens.push({kind: 'ident', value: lex});
      continue;
    } // identifier
    tokens.push({kind: 'sym', value: lex}); // symbolic operator atom
  }
};

export const tokenize = strings => {
  const tokens = [];
  for (let i = 0; i < strings.length; ++i) {
    tokenizeChunk(strings[i], tokens);
    if (i + 1 < strings.length) tokens.push({kind: 'interp', index: i});
  }
  tokens.push({kind: 'eof'});
  return tokens;
};
