// Micro-benchmark for the yopl solver. Run with `node dev-docs/bench.js`.
//
// The numbers below are useful for *relative* comparison only — they depend
// heavily on JIT warm-up, GC pressure, and machine load.

import {variable as v} from 'deep6/env.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import gen from '../src/solvers/gen.js';
import {head, term, list, rest, cut, rules as systemRules} from '../src/rules/system.js';
import {rules as mathRules} from '../src/rules/math.js';

const makeList = n => {
  let l = null;
  for (let i = n; i > 0; --i) l = {value: i, next: l};
  return l;
};

const time = (label, iters, fn) => {
  // warm-up
  for (let i = 0; i < Math.min(50, iters); ++i) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iters; ++i) fn();
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1e6;
  const usPerOp = Number(end - start) / 1000 / iters;
  console.log(`  ${label.padEnd(40)} ${ms.toFixed(2).padStart(8)} ms total  (${usPerOp.toFixed(3)} µs/op, ${iters} iters)`);
};

// ---------- workloads ----------

const memberRules = {
  member: [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member', args: [X, V]}]]
};

const appendRules = {
  append: [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append', args: [X, Y, Z]}]]
};

const list50 = makeList(50);
const list200 = makeList(200);
const list10 = makeList(10);

const benches = {
  'member: contains last (n=50)': () => {
    let n = 0;
    solve(memberRules, 'member', [list50, 50], () => ++n);
    return n;
  },
  'member: enumerate all (n=50)': () => {
    let n = 0;
    solve(memberRules, 'member', [list50, v('X')], () => ++n);
    return n;
  },
  'member: contains last (n=200)': () => {
    let n = 0;
    solve(memberRules, 'member', [list200, 200], () => ++n);
    return n;
  },
  'append: split list (n=10)': () => {
    let n = 0;
    solve(appendRules, 'append', [v('X'), v('Y'), list10], () => ++n);
    return n;
  },
  'gen member (n=50, take 1)': () => {
    const it = gen(memberRules, 'member', [list50, v('X')]);
    const r = it.next();
    return r.done ? 0 : 1;
  },
  'math add forward (1000 calls)': () => {
    for (let i = 0; i < 1000; ++i) {
      solve(mathRules, 'add', [i, i + 1, v('Z')], () => {});
    }
  }
};

console.log('yopl micro-benchmark');
console.log('====================');
for (const [label, fn] of Object.entries(benches)) {
  // calibrate iterations to ~50ms or 5000 max
  let iters = 50;
  let elapsed = 0;
  for (;;) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iters; ++i) fn();
    elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    if (elapsed > 30 || iters >= 5000) break;
    iters *= 2;
  }
  time(label, iters, fn);
}
