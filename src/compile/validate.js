// @ts-self-types="./validate.d.ts"
//
// IR-level validation. Catches the static bug class the compiler
// exists to prevent — arity drift, call-arity drift on recursive
// references, typo'd rule names, undeclared variables.
//
// validate() collects issues and returns them; the caller decides
// what to do. validateOrThrow() raises on the first non-empty result
// — useful for dogfood / test setups that want a hard gate.
//
// See dev-docs/compiler-ir.md § validation for the rationale.

import {IR_KINDS} from './ir.js';

const issue = (kind, message, where) => ({kind, message, ...where});

const referencedVars = clause => {
  const refs = new Set();
  const visited = new WeakSet();
  const walkLitValue = v => {
    if (v === null || typeof v !== 'object') return;
    if (visited.has(v)) return;
    visited.add(v);
    if (typeof v.kind === 'string' && IR_KINDS.has(v.kind)) {
      walkTerm(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const e of v) walkLitValue(e);
      return;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto === Object.prototype || proto === null) {
      for (const k of Object.keys(v)) walkLitValue(v[k]);
    }
  };
  const walkTerm = t => {
    switch (t.kind) {
      case 'var':
        refs.add(t.name);
        return;
      case 'literal':
        walkLitValue(t.value);
        return;
      case 'cons':
        walkTerm(t.head);
        walkTerm(t.tail);
        return;
      case 'compound':
        if (typeof t.name !== 'string') walkTerm(t.name);
        for (const a of t.args) walkTerm(a);
        return;
    }
  };
  const walkGoal = g => {
    if (g.kind === 'call') {
      if (typeof g.name !== 'string') walkTerm(g.name);
      for (const a of g.args) walkTerm(a);
    }
  };
  for (const t of clause.head) walkTerm(t);
  for (const g of clause.body) walkGoal(g);
  return refs;
};

export const validate = (rules, options = {}) => {
  const issues = [];
  const knownExternals = new Set(options.knownExternals || []);
  const localByName = new Map();

  const seen = new Set();
  for (const rule of rules) {
    if (seen.has(rule.name)) {
      issues.push(issue('duplicate-rule', `rule '${rule.name}' declared more than once`, {rule: rule.name}));
    }
    seen.add(rule.name);
    localByName.set(rule.name, rule);
  }

  for (const rule of rules) {
    rule.clauses.forEach((clause, idx) => {
      if (clause.head.length !== rule.arity) {
        issues.push(
          issue('arity-mismatch', `rule '${rule.name}' has arity ${rule.arity} but clause ${idx} head has ${clause.head.length} args`, {
            rule: rule.name,
            clause: idx
          })
        );
      }

      if (clause.vars !== undefined) {
        const refs = referencedVars(clause);
        const declared = new Set(clause.vars);
        for (const name of refs) {
          if (!declared.has(name)) {
            issues.push(
              issue('undeclared-var', `rule '${rule.name}' clause ${idx} references undeclared var '${name}'`, {rule: rule.name, clause: idx, var: name})
            );
          }
        }
      }

      for (const goal of clause.body) {
        if (goal.kind !== 'call' || typeof goal.name !== 'string') continue;
        const target = localByName.get(goal.name);
        if (target) {
          if (target.arity !== goal.args.length) {
            issues.push(
              issue(
                'call-arity-mismatch',
                `rule '${rule.name}' clause ${idx} calls '${goal.name}' with ${goal.args.length} args but '${goal.name}' has arity ${target.arity}`,
                {rule: rule.name, clause: idx, target: goal.name}
              )
            );
          }
        } else if (options.checkRuleReferences && !knownExternals.has(goal.name)) {
          issues.push(
            issue('unresolved-rule', `rule '${rule.name}' clause ${idx} calls unknown rule '${goal.name}'`, {rule: rule.name, clause: idx, target: goal.name})
          );
        }
      }
    });
  }

  return issues;
};

export const validateOrThrow = (rules, options) => {
  const issues = validate(rules, options);
  if (issues.length) {
    const lines = issues.map(i => `  [${i.kind}] ${i.message}`).join('\n');
    throw new Error(`${issues.length} validation issue(s):\n${lines}`);
  }
};
