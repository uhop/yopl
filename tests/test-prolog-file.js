// Verify the filesystem-backed `prologFile` / `prologFileAsync` loaders:
// round-trip a `.pl` source file through `readFileSync + prolog`, then
// run actual queries against the resulting `Rules` dict to confirm the
// parsed program is usable. Async tests cover parallel loading via
// `Promise.all`.

import {prologFile, prologFileAsync} from 'yopl/compile/prolog/file.js';
import solve from 'yopl';
import {rules as systemRules} from 'yopl/rules/system.js';
import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import {submit, TEST} from './harness.js';

const FIXTURE = new URL('./fixtures/family.pl', import.meta.url);

const collect = (rules, name, args) => {
  const result = [];
  solve(rules, name, args, env => {
    result.push(args.map(a => (a && typeof a.isBound === 'function' ? assemble(a, env) : a)));
  });
  return result;
};

export default [
  function test_prolog_file_loads_and_lowers() {
    const rules = prologFile(FIXTURE);
    eval(TEST('typeof rules === "object" && rules !== null'));
    eval(TEST('typeof rules.parent !== "undefined"'));
    eval(TEST('typeof rules.grandparent !== "undefined"'));
    eval(TEST('typeof rules.ancestor !== "undefined"'));
  },

  function test_prolog_file_lower_false_returns_ir() {
    const ir = prologFile(FIXTURE, {lower: false});
    eval(TEST('ir.parent && ir.parent.name === "parent" && ir.parent.arity === 2'));
    eval(TEST('ir.parent.clauses.length === 5'));
    eval(TEST('ir.grandparent && ir.grandparent.arity === 2'));
    eval(TEST('ir.ancestor && ir.ancestor.clauses.length === 2'));
  },

  function test_prolog_file_query_parents_of_bob() {
    const rules = {...systemRules, ...prologFile(FIXTURE)};
    const Y = v('Y');
    const out = collect(rules, 'parent', ['bob', Y]);
    eval(TEST('out.length === 2'));
    const children = out.map(([_, c]) => c).sort();
    eval(TEST('children[0] === "ann" && children[1] === "pat"'));
  },

  function test_prolog_file_query_grandparent() {
    const rules = {...systemRules, ...prologFile(FIXTURE)};
    const Z = v('Z');
    const out = collect(rules, 'grandparent', ['tom', Z]);
    eval(TEST('out.length === 2'));
    const grands = out.map(([_, g]) => g).sort();
    eval(TEST('grands[0] === "ann" && grands[1] === "pat"'));
  },

  function test_prolog_file_query_ancestor_recursive() {
    const rules = {...systemRules, ...prologFile(FIXTURE)};
    const Y = v('Y');
    const out = collect(rules, 'ancestor', ['tom', Y]);
    eval(TEST('out.length === 5'));
    const descendants = out.map(([_, d]) => d).sort();
    eval(TEST('descendants.join(",") === "ann,bob,jim,liz,pat"'));
  },

  function test_prolog_file_string_path_form() {
    const path = new URL('./fixtures/family.pl', import.meta.url).pathname;
    const rules = prologFile(path);
    eval(TEST('typeof rules.parent !== "undefined"'));
  },

  async function test_prolog_file_async_basic() {
    const rules = await prologFileAsync(FIXTURE);
    eval(TEST('typeof rules.parent !== "undefined"'));
    eval(TEST('typeof rules.ancestor !== "undefined"'));
  },

  async function test_prolog_file_async_lower_false() {
    const ir = await prologFileAsync(FIXTURE, {lower: false});
    eval(TEST('ir.parent && ir.parent.arity === 2'));
    eval(TEST('ir.ancestor && ir.ancestor.clauses.length === 2'));
  },

  async function test_prolog_file_async_query_round_trip() {
    const rules = {...systemRules, ...(await prologFileAsync(FIXTURE))};
    const Y = v('Y');
    const out = collect(rules, 'parent', ['bob', Y]);
    eval(TEST('out.length === 2'));
  },

  async function test_prolog_file_async_parallel_load() {
    // Load the same fixture three times in parallel — the realistic
    // shape when an app pulls a rule library split across many `.pl`
    // files. Same fixture is fine for the structural check.
    const [a, b, c] = await Promise.all([prologFileAsync(FIXTURE), prologFileAsync(FIXTURE), prologFileAsync(FIXTURE)]);
    eval(TEST('typeof a.parent !== "undefined"'));
    eval(TEST('typeof b.grandparent !== "undefined"'));
    eval(TEST('typeof c.ancestor !== "undefined"'));
  }
];
