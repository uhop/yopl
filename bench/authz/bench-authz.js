// Zanzibar-style authorization-check bench: FFI-backed facts, clause-borne
// policy, realistic op mix with a substantial denial share. Baseline for the
// solver experiments in dev-docs/authz-bench.md § Measurements.
// Run with `npm run bench -- bench/authz/bench-authz.js`.

// No list-all variant: unbound-O enumeration is super-quadratic in org size
// (per-edge independent re-proof without tabling) — covered functionally by
// tests/test-authz.js on a small org instead.

import gen from '../../src/solvers/gen.js';
import {generateOrg} from './gen.js';
import {makeRules} from './rules.js';

const org = generateOrg();
const rules = makeRules(org.store);

const runQueries = queries => n => {
  let granted = 0;
  for (let i = 0; i < n; ++i) {
    const query = queries[i % queries.length];
    if (!gen(rules, 'check', [query.u, query.r, query.o]).next().done) ++granted;
  }
  return granted;
};

export default {
  checkDirect: runQueries(org.queries.direct),
  checkGroup: runQueries(org.queries.group),
  checkImplied: runQueries(org.queries.implied),
  checkInherited: runQueries(org.queries.inherited),
  checkDenial: runQueries(org.queries.denial),
  checkMix: runQueries(org.mixed)
};
