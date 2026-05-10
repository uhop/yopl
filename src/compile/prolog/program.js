// Strict-Prolog program parser. Drains the cursor in a clause-or-directive
// loop, mutates a local clone of the input operator table on `:- op(...)`
// directives, and groups clauses by name+arity into IR Rules.
//
// The local table is per-`parseProgram` invocation; the caller's input
// table is never mutated, so each `prolog\`...\`` evaluation gets a
// fresh operator scope. Arity mismatch within one program (`foo/2` and
// `foo/3` both appearing) is a parse error, since the program parser
// can decide locally; cross-program arity drift is the validator's
// concern at compose time.
//
// Recognized directives (step-6 scope):
//
//   `:- op(Priority, Type, Name).`           (3-arg, ISO form)
//   `:- op(Priority, Type, Name, Pred).`     (4-arg, yopl-canonical)
//
// Anything else parsed at directive position errors with
// "unsupported directive". Multi-goal directives (`:- foo, bar.`) are
// not supported; users should write multiple `:-` directives.

import {Clause as IRClause, Rule as IRRule} from '../ir.js';
import {cloneOpTable, addOp} from '../parse/op-table.js';
import {parseClause, parseGoal} from './clause.js';

const withFile = (source, file) => {
  if (source === undefined) return undefined;
  return file === undefined ? source : {...source, file};
};

const litString = (term, what) => {
  if (term.kind !== 'literal' || typeof term.value !== 'string') {
    throw new Error(`${what} must be a string atom`);
  }
  return term.value;
};

const litNumber = (term, what) => {
  if (term.kind !== 'literal' || typeof term.value !== 'number') {
    throw new Error(`${what} must be a number`);
  }
  return term.value;
};

const applyOp = (args, opTable) => {
  if (args.length === 3) {
    addOp(opTable, {
      priority: litNumber(args[0], 'op priority'),
      type: litString(args[1], 'op type'),
      name: litString(args[2], 'op name')
    });
    return;
  }
  if (args.length === 4) {
    addOp(opTable, {
      priority: litNumber(args[0], 'op priority'),
      type: litString(args[1], 'op type'),
      name: litString(args[2], 'op name'),
      target: litString(args[3], 'op target predicate')
    });
    return;
  }
  throw new Error(`op/${args.length} not supported (use op/3 or op/4)`);
};

const applyDirective = (goal, opTable) => {
  if (goal.kind !== 'call' || typeof goal.name !== 'string') {
    throw new Error(`unsupported directive: only op/3 and op/4 are recognized`);
  }
  if (goal.name === 'op') {
    applyOp(goal.args, opTable);
    return;
  }
  throw new Error(`unsupported directive: ${goal.name}/${goal.args.length}`);
};

const parseDirective = (cursor, opTable) => {
  const goal = parseGoal(cursor, opTable);
  cursor.eat('period');
  applyDirective(goal, opTable);
};

export const parseProgram = (cursor, opTable, file, sourceMap = false) => {
  const localTable = cloneOpTable(opTable);
  const groups = new Map();
  const helperRules = [];

  while (cursor.peek().kind !== 'eof') {
    if (cursor.accept('colondash')) {
      parseDirective(cursor, localTable);
      continue;
    }
    const parsed = parseClause(cursor, localTable, sourceMap);
    const {name, head, body, source} = parsed;
    const arity = head.length;
    let group = groups.get(name);
    if (group === undefined) {
      group = {arity, clauses: []};
      groups.set(name, group);
    } else if (group.arity !== arity) {
      throw new Error(`arity mismatch for '${name}': previously ${group.arity}, now ${arity}`);
    }
    group.clauses.push(IRClause(head, body, undefined, withFile(source, file)));
    if (parsed.helpers) helperRules.push(...parsed.helpers);
  }

  const rules = {};
  for (const [name, {arity, clauses}] of groups) {
    rules[name] = IRRule(name, arity, clauses);
  }
  for (const helper of helperRules) {
    rules[helper.name] = helper;
  }
  return rules;
};
