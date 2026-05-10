// Strict-Prolog tagged-template entry points.
//
// `prolog\`...\`` parses a multi-clause program and returns a rules dict
// ready to spread into the runtime: `{...systemRules, ...prolog\`...\`}`.
// By default, the result is the lowered ruleFn dict with the parsed IR
// attached under `Symbol.for('yopl.ir')` for cross-validation, codegen,
// or inspection. Pass `{lower: false}` to skip lowering and return just
// the IR dict.
//
// `prologClause\`...\`` parses one clause and returns
// `{name, head: Term[], body: Goal[]}` — the trailing `.` is auto-appended
// if absent. Useful for incrementally building rule libraries.
//
// Both entries are polymorphic tags (shape lifted from
// `dollar-shell/src/bq-spawn.js`):
//
//   prolog\`...source...\`                  // tag form
//   prolog(sourceString)                    // function form (file content)
//   prolog(sourceString, optionsOverride)   // function form with overrides
//   prolog({operators: [...]})\`...\`       // configurator form
//   prolog({lower: false})\`...\`           // configurator form
//   prolog.with({operators: [...]})         // alias for configurator
//
// Configurators recurse: each call returns a freshly-configured tag
// closing over merged options. Per-invocation operator scope is
// preserved by `parseProgram` cloning the table on entry, so directives
// declared inside `prolog\`...\`` never leak to the next call.

import {IR} from '../ir.js';
import {tokenize} from '../parse/lexer.js';
import {makeCursor} from '../parse/cursor.js';
import {defaultTermOpTable, addOp} from '../parse/op-table.js';
import {lowerRules} from '../lower.js';
import {parseClause} from './clause.js';
import {parseProgram} from './program.js';

const verifyStrings = strings => Array.isArray(strings) && Array.isArray(strings.raw);

const buildOpTable = options => {
  const table = defaultTermOpTable();
  if (options.operators) {
    for (const op of options.operators) addOp(table, op);
  }
  return table;
};

const ensurePeriod = strings => {
  const last = strings[strings.length - 1];
  if (last.trimEnd().endsWith('.')) return strings;
  const out = [...strings];
  out[out.length - 1] = last + '.';
  return out;
};

const compileClauseInternal = (strings, values, options) => {
  const tokens = tokenize(ensurePeriod(strings));
  const cursor = makeCursor(tokens, values);
  const opTable = buildOpTable(options);
  const result = parseClause(cursor, opTable);
  if (cursor.peek().kind !== 'eof') {
    throw new Error(`trailing tokens after clause: ${cursor.peek().kind}`);
  }
  return result;
};

const compileProgramInternal = (strings, values, options) => {
  const tokens = tokenize(strings);
  const cursor = makeCursor(tokens, values);
  const opTable = buildOpTable(options);
  const ir = parseProgram(cursor, opTable);
  if (options.lower === false) return ir;
  const lowered = lowerRules(Object.values(ir));
  Object.defineProperty(lowered, IR, {value: ir, enumerable: false});
  return lowered;
};

const makePolyTag = (compile, options) => {
  const tag = (strings, ...values) => {
    if (verifyStrings(strings)) {
      return compile(strings, values, options);
    }
    if (typeof strings === 'string') {
      const merged = values[0] ? {...options, ...values[0]} : options;
      return compile([strings], [], merged);
    }
    if (strings && typeof strings === 'object') {
      return makePolyTag(compile, {...options, ...strings});
    }
    throw new Error('prolog tag: expected template literal, string, or options object');
  };
  tag.with = opts => makePolyTag(compile, {...options, ...opts});
  return tag;
};

export const prolog = makePolyTag(compileProgramInternal, {});
export const prologClause = makePolyTag(compileClauseInternal, {});
