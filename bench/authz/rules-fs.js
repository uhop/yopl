// Fact-source variant of the authz policy (dev-docs/runtime-protocols.md
// § Workstream 1): identical clauses to rules.js except the FFI enumeration —
// the cons-list scan + tupleIn/parentIn walker clauses are replaced by
// fact-source choice points. Ground verify fast paths unchanged.

import {prolog} from '../../src/compile/prolog/index.js';
import {makeNativesFS} from './model-fs.js';

export const makeRules = store => {
  const n = makeNativesFS(store);
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

    % FFI: ground verify fast path, fact-source choice point otherwise
    tuple(O, R, S) :- ${n.tupleGround}, !, ${n.tupleCheck}.
    tuple(O, R, S) :- ${n.tupleFacts}.

    parent(O, P) :- ${n.parentBound}, !, ${n.parentLookup}.
    parent(O, P) :- ${n.parentFacts}.
  `;
};
