// Strict-Prolog tagged-template entry points.
//
// `prologClause\`...\`` parses one clause and returns
// `{name, head: Term[], body: Goal[]}`. The trailing clause-terminator
// `.` is auto-appended if the source doesn't already end with one,
// since at the single-clause level the period is just ceremony.
//
// Step 7 will replace `prologClause` with a polymorphic-tag wrapper
// (lifted from `dollar-shell/src/bq-spawn.js`) that also accepts a
// configurator call (`prologClause({operators: [...]})\`...\``) and a
// plain-string call (`prologClause(source)`). Until then the public
// surface uses the default term-context operator table only.

import {tokenize} from '../parse/lexer.js';
import {makeCursor} from '../parse/cursor.js';
import {defaultTermOpTable} from '../parse/op-table.js';
import {parseClause} from './clause.js';

const ensurePeriod = strings => {
  const last = strings[strings.length - 1];
  if (last.trimEnd().endsWith('.')) return strings;
  const out = [...strings];
  out[out.length - 1] = last + '.';
  return out;
};

const compileClause = (strings, values, opTable) => {
  const tokens = tokenize(ensurePeriod(strings));
  const cursor = makeCursor(tokens, values);
  const result = parseClause(cursor, opTable);
  if (cursor.peek().kind !== 'eof') {
    throw new Error(`trailing tokens after clause: ${cursor.peek().kind}`);
  }
  return result;
};

export const prologClause = (strings, ...values) => compileClause(strings, values, defaultTermOpTable());
