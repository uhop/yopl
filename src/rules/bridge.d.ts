// Type definitions for yopl — the JS bridge helpers.

import type {Env, Variable} from 'deep6/env.js';

/**
 * Resolve a possibly-Variable value against `env` in one frame-stack
 * walk per hop (instead of the idiomatic isBound-then-get pair, which
 * scans twice). Returns the bound value, or the unbound `Variable`
 * itself — test with `instanceof Variable`.
 */
export declare const deref: (value: unknown, env: Env) => unknown;

/**
 * Sentinel a `computes` function returns to fail the goal (out-of-domain
 * inputs: out-of-bounds index, missing key, ...).
 */
export declare const MISS: unique symbol;

/**
 * Wrap a pure JS function into a compute-and-bind native: the clause's
 * last variable is the out term, the rest are inputs (declaration
 * order). Fails when any input is unbound or `fn` returns `MISS`;
 * binds an unbound out directly, unifies a bound one. Use in a
 * dedicated clause whose only variables are the head args.
 */
export declare const computes: (fn: (...args: unknown[]) => unknown) => (vars: Record<string, Variable>) => (env: Env) => boolean;

/**
 * Wrap a pure JS predicate into a test native over all head args;
 * fails when any is unbound.
 */
export declare const verifies: (fn: (...args: unknown[]) => unknown) => (vars: Record<string, Variable>) => (env: Env) => boolean;

/**
 * Bridge-built equivalent of math.js's `reversibleTernary` — same
 * contract (verify / fromXY / fromXZ / fromYZ over conventional
 * `{X, Y, Z}` names, cut on resolved modes), one deref walk per
 * variable read.
 */
export declare const reversible3: (
  verify: (x: number, y: number, z: number) => boolean,
  fromXY: (x: number, y: number) => number,
  fromXZ: (x: number, z: number) => number,
  fromYZ: (y: number, z: number) => number
) => (vars: {X: Variable; Y: Variable; Z: Variable}, sys: unknown[]) => (env: Env, goals: unknown, stack: unknown[]) => boolean;
