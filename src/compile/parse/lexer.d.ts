// Type definitions for yopl — the sticky-regex tokenizer shared by all
// front-ends.

/**
 * One lexed token. `value` is present on `string` / `number` / `ident` /
 * `sym` tokens; `index` is present on `interp` tokens and names the
 * tagged-template interpolation slot. `line` / `col` are 1-based and
 * point at the token's first character.
 */
export interface Token {
  kind:
    | 'lparen'
    | 'rparen'
    | 'lbracket'
    | 'rbracket'
    | 'comma'
    | 'pipe'
    | 'bang'
    | 'period'
    | 'semicolon'
    | 'colondash'
    | 'string'
    | 'number'
    | 'ident'
    | 'sym'
    | 'interp'
    | 'eof';
  line: number;
  col: number;
  value?: string | number;
  index?: number;
}

/**
 * Tokenize one string chunk, appending tokens to `tokens` (mutated).
 * Returns the `[line, col]` position after the chunk so tagged-template
 * front-ends can thread positions across chunks.
 */
export declare const tokenizeChunk: (text: string, tokens: Token[], startLine?: number, startCol?: number) => [number, number];

/**
 * Tokenize the string chunks of a tagged template. Emits an `interp`
 * token between adjacent chunks and a final `eof` token.
 */
export declare const tokenize: (strings: ReadonlyArray<string>, startLine?: number, startCol?: number) => Token[];
