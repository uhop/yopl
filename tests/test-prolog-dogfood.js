// Cross-validation dogfood: assert structurally equivalent IR between
// iter-1 (`clause\`...\``) and iter-2 (`prolog\`...\``) front-ends for
// the patterns used by `src/rules/{system,comp,math,bits,logic}.js`.
//
// The 535-test suite already exercises behavioral parity (the
// `src/rules/*.js` modules now build their `rules` dicts via
// `prolog\`...\``; every existing test runs against those). This file
// makes the design promise "iter-2 IR ≡ iter-1 IR" tactile by
// re-encoding representative samples in BOTH forms and deep-equaling
// the resulting Rule IR.
//
// Scope is the **shared subset** — patterns expressible in both
// front-ends. Prolog-only features (body operators `;`/`->`, `\+`,
// goal aliases, head-arg expressions, bare lowercase atoms in arg
// position) are out of scope here; they're covered by
// `test-compile-prolog.js`.

import {rule, clause} from '../src/compile/clause/index.js';
import {prolog} from '../src/compile/prolog/index.js';
import {IR} from '../src/compile/ir.js';
import {submit, TEST} from './harness.js';

// Structural deep-equal that survives JS function references in IR
// (`Js({factory: fn})`). Walks plain objects and arrays element-wise;
// for a `js` IR node, checks that `factory` is the same function
// reference (`===`); other fields recurse normally.
const deepEqualIR = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) if (!deepEqualIR(a[i], b[i])) return false;
    return true;
  }
  if (a.kind === 'js' || b.kind === 'js') {
    return a.kind === 'js' && b.kind === 'js' && a.factory === b.factory;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqualIR(a[k], b[k])) return false;
  }
  return true;
};

// Build a Rule IR via the iter-2 strict-Prolog front-end. Pulls out
// the named rule from the resulting IR dict (with `lower: false` so
// we get IR, not lowered runtime fns).
const prologRule =
  name =>
  (strings, ...values) => {
    const dict = prolog.with({lower: false})(strings, ...values);
    if (!dict[name]) throw new Error(`prologRule: '${name}' not found in parsed program`);
    return dict[name];
  };

// Identity factory shared between the two encodings of a rule. Forces
// `===` parity on the embedded `js` factory IR.
const trueFactory = () => () => true;
const numberFactory = () => () => false;

export default [
  function test_dogfood_eq_simple_fact() {
    const c = rule('eq', 2)(clause`(X, X)`);
    const p = prologRule('eq')`eq(X, X).`;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_notEq_two_clauses_with_cut_fail() {
    const c = rule('notEq', 2)(clause`(X, X) :- !, fail`, clause`(_, _)`);
    const p = prologRule('notEq')`
      notEq(X, X) :- !, fail.
      notEq(_, _).
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_call_dynamic_dispatch() {
    const c = rule('call', 1)(clause`(X) :- X`);
    const p = prologRule('call')`call(X) :- X.`;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_not_var_as_goal() {
    const c = rule('not', 1)(clause`(X) :- X, !, fail`, clause`(_)`);
    const p = prologRule('not')`
      not(X) :- X, !, fail.
      not(_).
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_isUnifiable_nested_compound_data() {
    const c = rule('isUnifiable', 2)(clause`(X, Y) :- not(not(eq(X, Y)))`);
    const p = prologRule('isUnifiable')`isUnifiable(X, Y) :- not(not(eq(X, Y))).`;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_conjunction_list_pattern() {
    const c = rule('conjunction', 1)(clause`(null)`, clause`([X | Xt]) :- X, conjunction(Xt)`);
    const p = prologRule('conjunction')`
      conjunction(null).
      conjunction([X | Xt]) :- X, conjunction(Xt).
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_map_higher_order_with_dynamic_call() {
    const c = rule('map', 3)(clause`(_, null, null)`, clause`(F, [X | Xt], [Y | Yt]) :- F(X, Y), map(F, Xt, Yt)`);
    const p = prologRule('map')`
      map(_, null, null).
      map(F, [X | Xt], [Y | Yt]) :- F(X, Y), map(F, Xt, Yt).
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_filter_three_clauses() {
    const c = rule('filter', 3)(
      clause`(_, null, null)`,
      clause`(P, [X | Xt], [X | Yt]) :- P(X), filter(P, Xt, Yt)`,
      clause`(P, [X | Xt], Yt) :- not(P(X)), filter(P, Xt, Yt)`
    );
    const p = prologRule('filter')`
      filter(_, null, null).
      filter(P, [X | Xt], [X | Yt]) :- P(X), filter(P, Xt, Yt).
      filter(P, [X | Xt], Yt) :- not(P(X)), filter(P, Xt, Yt).
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_compose_dynamic_dispatch() {
    const c = rule('compose', 4)(clause`(F, G, X, O) :- G(X, T), F(T, O)`);
    const p = prologRule('compose')`compose(F, G, X, O) :- G(X, T), F(T, O).`;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_inline_js_factory_shared() {
    // Same factory function reference on both sides — the deepEqualIR
    // js-branch demands `===`, so this proves the parsers wrap the
    // `${fn}` interp slot identically.
    const c = rule('isVar', 1)(clause`(X) :- ${trueFactory}`);
    const p = prologRule('isVar')`isVar(X) :- ${trueFactory}.`;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_comp_nz_zero_literal_and_wildcard() {
    const c = rule('nz', 1)(clause`(0) :- !, fail`, clause`(_) :- !`);
    const p = prologRule('nz')`
      nz(0) :- !, fail.
      nz(_) :- !.
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_math_add_with_identity_facts() {
    const fac = numberFactory();
    const c = rule('add', 3)(clause`(X, Y, Z) :- ${fac}`, clause`(0, Y, Y)`, clause`(X, 0, X)`);
    const p = prologRule('add')`
      add(X, Y, Z) :- ${fac}.
      add(0, Y, Y).
      add(X, 0, X).
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_disjunction_list_var_as_goal() {
    const c = rule('disjunction', 1)(clause`([X | _]) :- X`, clause`([_ | Xt]) :- disjunction(Xt)`);
    const p = prologRule('disjunction')`
      disjunction([X | _]) :- X.
      disjunction([_ | Xt]) :- disjunction(Xt).
    `;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_true_zero_arity() {
    const c = rule('true', 0)(clause`()`);
    const p = prologRule('true')`true.`;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_once_cut_at_end() {
    const c = rule('once', 1)(clause`(X) :- X, !`);
    const p = prologRule('once')`once(X) :- X, !.`;
    eval(TEST('deepEqualIR(c, p)'));
  },

  function test_dogfood_full_system_module_round_trip() {
    // The whole system module ports through prolog and produces a dict
    // keyed by every rule's name. Spot-check that the names + arities
    // match what test-system.js expects (smoke test for the port).
    const dict = prolog.with({lower: false})`
      eq(X, X).
      true.
      not(X) :- X, !, fail.
      not(_).
    `;
    eval(TEST("dict.eq && dict.eq.name === 'eq' && dict.eq.arity === 2"));
    eval(TEST('dict.true && dict.true.arity === 0'));
    eval(TEST('dict.not && dict.not.arity === 1 && dict.not.clauses.length === 2'));
  },

  function test_dogfood_lowered_dict_carries_ir_symbol() {
    // `prolog\`...\`` (default `lower: true`) returns the lowered
    // runtime functions dict with the parsed IR attached under
    // `Symbol.for('yopl.ir')` for cross-validation use cases.
    const lowered = prolog`eq(X, X). true.`;
    eval(TEST('typeof lowered.eq === "function" || Array.isArray(lowered.eq)'));
    eval(TEST('lowered[IR] && typeof lowered[IR] === "object"'));
    eval(TEST('lowered[IR].eq && lowered[IR].eq.name === "eq"'));
  }
];
