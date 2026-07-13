// @ts-self-types="./lexer.d.ts"
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
//
// Every emitted token carries `{line, col}` (1-based) recording its
// starting position in the source. For tagged templates, position
// state threads across string chunks via `tokenizeChunk`'s return
// value so the line/col continuum spans the whole template (interp
// slots inherit the position right after the prior chunk's last
// character; their textual width is unknown to the lexer).

const TOKEN_RE = /[ \t\n\r]+|:-|[()[\],|!.;]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+(?:\.\d+)?|[A-Za-z_]\w*|[+\-*/\\^<>=~:?@#$&]+/y;

// Advance (line, col) by walking `text[from..to)` and counting newlines.
const advancePos = (text, from, to, line, col) => {
  for (let j = from; j < to; ++j) {
    if (text.charCodeAt(j) === 10) {
      ++line;
      col = 1;
    } else {
      ++col;
    }
  }
  return [line, col];
};

export const tokenizeChunk = (text, tokens, startLine = 1, startCol = 1) => {
  let i = 0;
  let line = startLine;
  let col = startCol;
  const l = text.length;
  while (i < l) {
    const ch = text.charCodeAt(i);
    if (ch === 37) {
      // % line comment — runs to end of line (or end of chunk).
      const lineStart = i;
      while (i < l && text.charCodeAt(i) !== 10) ++i;
      [line, col] = advancePos(text, lineStart, i, line, col);
      continue;
    }
    if (ch === 47 && text.charCodeAt(i + 1) === 42) {
      // /* block comment */
      const start = i;
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`unterminated block comment at offset ${i}`);
      i = end + 2;
      [line, col] = advancePos(text, start, i, line, col);
      continue;
    }
    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(text);
    if (!m) throw new Error(`unexpected character '${text[i]}' at offset ${i}`);
    const lex = m[0];
    const c = lex.charCodeAt(0);
    const tokenStart = i;
    const tokenLine = line;
    const tokenCol = col;
    i = TOKEN_RE.lastIndex;
    [line, col] = advancePos(text, tokenStart, i, line, col);
    if (c < 33) continue; // whitespace (already advanced)
    const t = {line: tokenLine, col: tokenCol};
    if (c === 40) {
      t.kind = 'lparen';
      tokens.push(t);
      continue;
    } // (
    if (c === 41) {
      t.kind = 'rparen';
      tokens.push(t);
      continue;
    } // )
    if (c === 91) {
      t.kind = 'lbracket';
      tokens.push(t);
      continue;
    } // [
    if (c === 93) {
      t.kind = 'rbracket';
      tokens.push(t);
      continue;
    } // ]
    if (c === 44) {
      t.kind = 'comma';
      tokens.push(t);
      continue;
    } // ,
    if (c === 124) {
      t.kind = 'pipe';
      tokens.push(t);
      continue;
    } // |
    if (c === 33) {
      t.kind = 'bang';
      tokens.push(t);
      continue;
    } // !
    if (c === 46) {
      t.kind = 'period';
      tokens.push(t);
      continue;
    } // .
    if (c === 59) {
      t.kind = 'semicolon';
      tokens.push(t);
      continue;
    } // ;
    if (lex === ':-') {
      t.kind = 'colondash';
      tokens.push(t);
      continue;
    }
    if (c === 34 || c === 39) {
      t.kind = 'string';
      t.value = lex.slice(1, -1).replace(/\\(.)/g, '$1');
      tokens.push(t);
      continue;
    } // " or '
    if (c >= 48 && c <= 57) {
      t.kind = 'number';
      t.value = Number(lex);
      tokens.push(t);
      continue;
    } // 0-9
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95) {
      t.kind = 'ident';
      t.value = lex;
      tokens.push(t);
      continue;
    } // identifier
    t.kind = 'sym';
    t.value = lex;
    tokens.push(t); // symbolic operator atom
  }
  return [line, col];
};

export const tokenize = (strings, startLine = 1, startCol = 1) => {
  const tokens = [];
  let line = startLine;
  let col = startCol;
  for (let i = 0; i < strings.length; ++i) {
    [line, col] = tokenizeChunk(strings[i], tokens, line, col);
    if (i + 1 < strings.length) tokens.push({kind: 'interp', index: i, line, col});
  }
  tokens.push({kind: 'eof', line, col});
  return tokens;
};
