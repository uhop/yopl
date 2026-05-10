// Type definitions for yopl — filesystem-backed `prologFile` loaders.

import type {PrologOptions, PrologLoweredResult, PrologIRResult} from './index.js';

/**
 * Synchronous: load a `.pl` file (or any text source) and parse it
 * through `prolog()`. `url` accepts a path string or a `URL` —
 * typically `new URL('./foo.pl', import.meta.url)`. UTF-8 is assumed.
 *
 * `fs.readFileSync` also accepts `Buffer` paths and file descriptors;
 * those work at runtime but aren't in the public type to keep this
 * package free of `@types/node`.
 *
 * Default returns the lowered runtime `Rules` dict (with the parsed IR
 * attached under `Symbol.for('yopl.ir')`); pass `{lower: false}` to get
 * the IR `Rules` dict directly.
 *
 * Works in Node, Bun, and Deno (`node:fs` compat). Don't import from
 * browser bundles unless they shim `node:fs`.
 */
export declare const prologFile: (url: string | URL, options?: PrologOptions) => PrologLoweredResult | PrologIRResult;

/**
 * Async counterpart to `prologFile`. Use when loading multiple files
 * in parallel: `await Promise.all([prologFileAsync(a), prologFileAsync(b)])`.
 * Otherwise behaviorally identical to the sync form (same arguments,
 * same return-shape contract on resolution).
 *
 * Works in Node, Bun, and Deno (`node:fs/promises` compat).
 */
export declare const prologFileAsync: (url: string | URL, options?: PrologOptions) => Promise<PrologLoweredResult | PrologIRResult>;
