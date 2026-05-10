// Term-position parsing primitives — Term IR producers consumed by
// front-end clause / program drivers. Each takes a cursor (see
// ./cursor.js) and advances it by exactly one term, list, or arg list.

import {Var, Wild, Lit, Compound, List} from '../ir.js';
import {wrapTermInterp} from './interp.js';
import {isVarStart} from './util.js';

export const parseTerm = cursor => {
  const t = cursor.peek();
  if (t.kind === 'interp') {
    cursor.advance();
    return wrapTermInterp(cursor.values[t.index]);
  }
  if (t.kind === 'number') {
    cursor.advance();
    return Lit(t.value);
  }
  if (t.kind === 'string') {
    cursor.advance();
    return Lit(t.value);
  }
  if (t.kind === 'lbracket') return parseList(cursor);
  if (t.kind === 'ident') {
    const name = t.value;
    cursor.advance();
    if (cursor.accept('lparen')) {
      const args = parseArgs(cursor);
      cursor.eat('rparen');
      return Compound(isVarStart(name) ? Var(name) : name, args);
    }
    if (name === '_') return Wild();
    if (name === 'null') return Lit(null);
    if (name === 'true') return Lit(true);
    if (name === 'false') return Lit(false);
    if (isVarStart(name)) return Var(name);
    throw new Error(`bare lowercase atom '${name}' in arg position — quote as a string`);
  }
  throw new Error(`unexpected token ${t.kind} in term`);
};

export const parseList = cursor => {
  cursor.eat('lbracket');
  if (cursor.accept('rbracket')) return Lit(null);
  const items = [parseTerm(cursor)];
  while (cursor.accept('comma')) items.push(parseTerm(cursor));
  let tail;
  if (cursor.accept('pipe')) tail = parseTerm(cursor);
  cursor.eat('rbracket');
  return List(items, tail);
};

export const parseArgs = cursor => {
  if (cursor.peek().kind === 'rparen') return [];
  const args = [parseTerm(cursor)];
  while (cursor.accept('comma')) args.push(parseTerm(cursor));
  return args;
};
