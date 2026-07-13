// Type definitions for yopl — the token cursor shared by parser
// primitives.

import type {Token} from './lexer.js';

/**
 * Position state + advance helpers over a token array. `values` carries
 * the tagged-template interpolation slot values consulted when an
 * `interp` token is consumed.
 */
export interface Cursor {
  values: ReadonlyArray<unknown>;
  /** Current token without consuming it. */
  peek: () => Token;
  /** Lookahead relative to the current position (`peekAt(1)` is next). */
  peekAt: (offset: number) => Token | undefined;
  /** Consume and return the current token. */
  advance: () => Token;
  /** Consume a token of the given kind or throw. */
  eat: (kind: Token['kind']) => Token;
  /** Consume a token of the given kind or return `null` (no advance). */
  accept: (kind: Token['kind']) => Token | null;
}

/** Build a cursor over `tokens` with interpolation `values`. */
export declare const makeCursor: (tokens: Token[], values: ReadonlyArray<unknown>) => Cursor;
