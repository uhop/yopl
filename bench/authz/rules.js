// The policy IS the clauses: Zanzibar userset-rewrite rules over FFI-backed
// relation tuples. See dev-docs/authz-bench.md § Model.

import {prolog} from '../../src/compile/prolog/index.js';
import {makeNatives} from './model.js';

export const makeRules = store => {
  const n = makeNatives(store);
  return prolog`
    % direct grant
    check(U, R, O) :- tuple(O, R, U).

    % group expansion (nested groups recurse)
    check(U, R, O) :- tuple(O, R, group(G)), memberOf(U, G).
    memberOf(U, G) :- tuple(G, "member", U).
    memberOf(U, G) :- tuple(G, "member", group(H)), memberOf(U, H).

    % computed userset: owner > editor > viewer
    implies("owner", "editor").
    implies("editor", "viewer").
    check(U, R, O) :- implies(S, R), check(U, S, O).

    % tuple-to-userset: inherit viewer from the parent folder
    check(U, "viewer", O) :- parent(O, P), check(U, "viewer", P).

    % FFI: ground verify fast path, cursor-list scan for generative modes
    tuple(O, R, S) :- ${n.tupleGround}, !, ${n.tupleCheck}.
    tuple(O, R, S) :- ${n.tupleScan}, tupleIn(L, O, R, S).
    tupleIn([t(O, R, S) | _], O, R, S).
    tupleIn([_ | T], O, R, S) :- tupleIn(T, O, R, S).

    parent(O, P) :- ${n.parentBound}, !, ${n.parentLookup}.
    parent(O, P) :- ${n.parentScan}, parentIn(L, O, P).
    parentIn([p(O, P) | _], O, P).
    parentIn([_ | T], O, P) :- parentIn(T, O, P).
  `;
};
