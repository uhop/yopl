// Source-map coverage: lexer position tracking, Clause.source threading
// through both front-ends (opt-in via `sourceMap: true` on prolog;
// always-on for the per-clause front-end), file-name propagation,
// lowered-fn .source attachment, and validator source-decoration on
// per-clause issues.

import {tokenize, tokenizeChunk} from '../src/compile/parse/lexer.js';
import {prolog, prologClause} from 'yopl/compile/prolog';
import {prologFile, prologFileAsync} from 'yopl/compile/prolog/file';
import {rule, clause} from 'yopl/compile/clause';
import {Var, Wild, Lit, Clause, Rule, validate} from 'yopl/compile';
import {submit, TEST} from './harness.js';

const FIXTURE = new URL('./fixtures/family.pl', import.meta.url);

// `sourceMap: true` is the opt-in flag; combine with other configurator
// options as needed in each test.
const SM = {sourceMap: true};
const SM_IR = {sourceMap: true, lower: false};

export default [
  // ---------------------------------------------------------------------
  // Lexer position tracking — always on (transient memory, GC'd after parse)
  function test_lexer_records_line_col_per_token() {
    const tokens = tokenize(['foo']);
    eval(TEST('tokens[0].kind === "ident" && tokens[0].line === 1 && tokens[0].col === 1'));
    eval(TEST('tokens[1].kind === "eof" && tokens[1].line === 1 && tokens[1].col === 4'));
  },

  function test_lexer_advances_col_within_line() {
    const tokens = tokenize(['foo bar baz']);
    eval(TEST('tokens[0].col === 1'));
    eval(TEST('tokens[1].col === 5'));
    eval(TEST('tokens[2].col === 9'));
  },

  function test_lexer_advances_line_on_newline() {
    const tokens = tokenize(['foo\nbar\n  baz']);
    eval(TEST('tokens[0].line === 1 && tokens[0].col === 1'));
    eval(TEST('tokens[1].line === 2 && tokens[1].col === 1'));
    eval(TEST('tokens[2].line === 3 && tokens[2].col === 3'));
  },

  function test_lexer_skips_line_comments_but_advances_position() {
    const tokens = tokenize(['% comment line\nfoo']);
    eval(TEST('tokens[0].line === 2 && tokens[0].col === 1'));
  },

  function test_lexer_skips_block_comments_advancing_lines() {
    const tokens = tokenize(['/* one\ntwo\nthree */ foo']);
    eval(TEST('tokens[0].line === 3 && tokens[0].col === 10'));
  },

  function test_lexer_threads_position_across_template_chunks() {
    const tokens = tokenize(['foo\nbar ', ' baz']);
    eval(TEST('tokens[0].line === 1 && tokens[0].col === 1'));
    eval(TEST('tokens[1].line === 2 && tokens[1].col === 1'));
    eval(TEST('tokens[2].kind === "interp" && tokens[2].line === 2 && tokens[2].col === 5'));
    eval(TEST('tokens[3].line === 2 && tokens[3].col === 6'));
  },

  function test_lexer_chunk_returns_end_position() {
    const tokens = [];
    const [endLine, endCol] = tokenizeChunk('a\nbb', tokens);
    eval(TEST('endLine === 2 && endCol === 3'));
  },

  // ---------------------------------------------------------------------
  // Default (opt-out): no Clause.source attached
  function test_prolog_default_no_source_on_clauses() {
    const ir = prolog.with({lower: false})`
      foo(X).
      bar(Y).
    `;
    eval(TEST('ir.foo.clauses[0].source === undefined'));
    eval(TEST('ir.bar.clauses[0].source === undefined'));
  },

  function test_prolog_file_option_silently_ignored_without_sourceMap() {
    // `file` only takes effect when sourceMap is on; otherwise it's
    // dropped silently rather than erroring.
    const ir = prolog.with({lower: false, file: 'unused.pl'})`foo(X).`;
    eval(TEST('ir.foo.clauses[0].source === undefined'));
  },

  function test_prologClause_default_no_source() {
    const c = prologClause`foo(X).`;
    eval(TEST('c.source === undefined'));
  },

  // ---------------------------------------------------------------------
  // sourceMap: true → prolog\`...\` populates Clause.source per clause
  function test_prolog_clauses_carry_source_position() {
    const ir = prolog.with(SM_IR)`
      foo(X).
      bar(Y).
    `;
    eval(TEST('ir.foo.clauses[0].source.line === 2 && ir.foo.clauses[0].source.col === 7'));
    eval(TEST('ir.bar.clauses[0].source.line === 3 && ir.bar.clauses[0].source.col === 7'));
  },

  function test_prolog_multi_clause_rule_carries_per_clause_source() {
    const ir = prolog.with(SM_IR)`member(X, [X | _]).
member(X, [_ | T]) :- member(X, T).`;
    eval(TEST('ir.member.clauses.length === 2'));
    eval(TEST('ir.member.clauses[0].source.line === 1 && ir.member.clauses[0].source.col === 1'));
    eval(TEST('ir.member.clauses[1].source.line === 2 && ir.member.clauses[1].source.col === 1'));
  },

  function test_prolog_file_option_populates_source_file() {
    const ir = prolog.with({...SM_IR, file: 'rules.pl'})`foo(X).`;
    eval(TEST('ir.foo.clauses[0].source.file === "rules.pl"'));
    eval(TEST('ir.foo.clauses[0].source.line === 1'));
  },

  function test_prolog_function_form_with_file_option() {
    const ir = prolog('green.\nred.', {...SM_IR, file: 'colors.pl'});
    eval(TEST('ir.green.clauses[0].source.file === "colors.pl"'));
    eval(TEST('ir.red.clauses[0].source.line === 2'));
  },

  // ---------------------------------------------------------------------
  // sourceMap: true → prologClause\`...\` carries source
  function test_prolog_clause_tag_carries_source() {
    const c = prologClause.with(SM)`foo(X).`;
    eval(TEST('c.source && c.source.line === 1 && c.source.col === 1'));
  },

  function test_prolog_clause_with_file_option() {
    const c = prologClause.with({sourceMap: true, file: 'one.pl'})`foo(X).`;
    eval(TEST('c.source && c.source.file === "one.pl"'));
  },

  // ---------------------------------------------------------------------
  // Per-clause `clause\`...\`` front-end always carries source — no
  // configurator needed (each tag is one clause; cost is negligible).
  function test_clause_front_end_always_carries_source() {
    const r = rule('foo', 1)(clause`(X) :- bar(X)`);
    eval(TEST('r.clauses[0].source && r.clauses[0].source.line === 1 && r.clauses[0].source.col === 1'));
  },

  // ---------------------------------------------------------------------
  // prologFile / prologFileAsync — sourceMap is opt-in here too
  function test_prolog_file_default_no_source() {
    const ir = prologFile(FIXTURE, {lower: false});
    eval(TEST('ir.parent.clauses[0].source === undefined'));
  },

  function test_prolog_file_with_sourceMap_threads_url_as_source_file() {
    const ir = prologFile(FIXTURE, SM_IR);
    eval(TEST('ir.parent.clauses[0].source.file === FIXTURE.href'));
    // family.pl: parent/2 facts start on line 5.
    eval(TEST('ir.parent.clauses[0].source.line === 5'));
  },

  async function test_prolog_file_async_with_sourceMap() {
    const ir = await prologFileAsync(FIXTURE, SM_IR);
    eval(TEST('ir.parent.clauses[0].source.file === FIXTURE.href'));
  },

  function test_prolog_file_explicit_file_option_overrides_url() {
    const ir = prologFile(FIXTURE, {...SM_IR, file: 'override.pl'});
    eval(TEST('ir.parent.clauses[0].source.file === "override.pl"'));
  },

  // ---------------------------------------------------------------------
  // Lowered fn .source — attached only when Clause.source is present
  function test_lowered_fn_default_no_source() {
    const rules = prolog`foo(X).`;
    eval(TEST('rules.foo[0].source === undefined'));
  },

  function test_lowered_fn_carries_source_when_sourceMap_on() {
    const rules = prolog.with(SM)`foo(X).`;
    eval(TEST('typeof rules.foo === "object" && rules.foo[0].source'));
    eval(TEST('rules.foo[0].source.line === 1 && rules.foo[0].source.col === 1'));
  },

  function test_lowered_fn_source_is_non_enumerable() {
    const rules = prolog.with(SM)`foo(X).`;
    const fn = rules.foo[0];
    eval(TEST('Object.keys(fn).indexOf("source") === -1'));
    eval(TEST('!!Object.getOwnPropertyDescriptor(fn, "source")'));
  },

  function test_lowered_fn_no_source_when_clause_has_none() {
    const r = Rule('foo', 1, [Clause([Var('X')], [])]);
    const ir = prolog.with(SM_IR)`bar(Y).`;
    eval(TEST('r.clauses[0].source === undefined'));
    eval(TEST('ir.bar.clauses[0].source !== undefined'));
  },

  // ---------------------------------------------------------------------
  // Validate surfaces source on per-clause issues — only when present
  function test_validate_arity_mismatch_includes_source() {
    const ir = prolog.with({...SM_IR, file: 'foo.pl'})`
      foo(X, Y).
    `;
    const rules = [{...ir.foo, arity: 1}];
    const issues = validate(rules);
    const arity = issues.find(i => i.kind === 'arity-mismatch');
    eval(TEST('arity && arity.source && arity.source.file === "foo.pl"'));
    eval(TEST('arity.source.line === 2 && arity.source.col === 7'));
    eval(TEST('arity.message.indexOf("[foo.pl:2:7]") !== -1'));
  },

  function test_validate_undeclared_var_includes_source() {
    const c = Clause([Var('X'), Var('Y')], [], ['X'], {file: 'q.pl', line: 7, col: 3});
    const r = Rule('q', 2, [c]);
    const issues = validate([r]);
    const undeclared = issues.find(i => i.kind === 'undeclared-var');
    eval(TEST('undeclared && undeclared.source && undeclared.source.file === "q.pl"'));
    eval(TEST('undeclared.message.indexOf("[q.pl:7:3]") !== -1'));
  },

  function test_validate_call_arity_mismatch_includes_source() {
    const ir = prolog.with({...SM_IR, file: 'p.pl'})`
      a(X) :- b(X, Y).
      b(Z).
    `;
    const issues = validate(Object.values(ir));
    const callArity = issues.find(i => i.kind === 'call-arity-mismatch');
    eval(TEST('callArity && callArity.source && callArity.source.file === "p.pl"'));
    eval(TEST('callArity.source.line === 2'));
  },

  function test_validate_no_source_when_programmatic() {
    const r = Rule('foo', 2, [Clause([Var('X')], [])]);
    const issues = validate([r]);
    const arity = issues.find(i => i.kind === 'arity-mismatch');
    eval(TEST('arity && arity.source === undefined'));
    eval(TEST('/\\[\\d+:\\d+\\]$/.test(arity.message) === false'));
  },

  function test_validate_no_source_when_sourceMap_off() {
    // Real Prolog source but sourceMap off → issues have no source field
    // and the message gets no [line:col] tag.
    const ir = prolog.with({lower: false})`
      foo(X, Y).
    `;
    const rules = [{...ir.foo, arity: 1}];
    const issues = validate(rules);
    const arity = issues.find(i => i.kind === 'arity-mismatch');
    eval(TEST('arity && arity.source === undefined'));
  }
];
