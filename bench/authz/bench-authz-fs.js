// `bench-authz.js` op mix with the fact-source rules (rules-fs.js) — the
// Workstream-1 POC judge run (dev-docs/runtime-protocols.md). Same org
// (seeded), same query sets, same variant names — record with `-i 500 --json`
// and pair against a same-HEAD `bench-authz.js` baseline via
// `nano-bench-compare`.

import gen from '../../src/solvers/gen.js';
import {generateOrg} from './gen.js';
import {makeRules} from './rules-fs.js';

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
