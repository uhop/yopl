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

const TOKEN_RE = /[ \t\n\r]+|:-|[()[\],|!]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|[A-Za-z_]\w*/y;

export const tokenizeChunk = (text, tokens) => {
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

export const tokenize = strings => {
  const tokens = [];
  for (let i = 0; i < strings.length; ++i) {
    tokenizeChunk(strings[i], tokens);
    if (i + 1 < strings.length) tokens.push({kind: 'interp', index: i});
  }
  tokens.push({kind: 'eof'});
  return tokens;
};
