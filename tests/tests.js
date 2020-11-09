import unify, {_, variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import gen from '../src/solvers/gen.js';
import asyncSolve from '../src/solvers/async.js';
import asyncGen from '../src/solvers/asyncGen.js';

// test harness

const out = msg => console.log(msg);

let _total = 0,
  _errors = 0,
  _current = null,
  _local = 0;

const res = (msg, isError) => {
  ++_local;
  ++_total;
  if (isError) {
    ++_errors;
    console.log(msg);
  }
};

const SHOW_FAILED_TEST_CODE = true;

const submit = (msg, success) => {
  if (success) {
    res('Success: ' + msg + ' --- in ' + _current + ', #' + (_local + 1));
  } else {
    res('Failed: ' + msg + ' --- in ' + _current + ', #' + (_local + 1), true);
  }
};

const quoteString = text => text.replace(/['"\\]/g, '\\$&');
const TEST = condition => "submit('" + quoteString(condition) + "', (" + condition + '))';

// setup

const timeout = async ms => new Promise(resolve => setTimeout(resolve, ms));

// tests

const tests = [
  function test_solve_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    solve(rules, 'one/1', [X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1])'));
  },
  function test_solve_last() {
    const rules = {
        'notNull/1': X => [{args: [X]}, env => X.isBound(env) && X.get(env) !== null],
        'last/2': [
          () => [{args: [null, undefined]}],
          X => [{args: [{value: X, next: null}, X]}],
          (X, Y) => [{args: [{next: X}, Y]}, {name: 'notNull/1', args: [X]}, {name: 'last/2', args: [X, Y]}]
        ]
      },
      X = v('X');
    let result = [];
    solve(rules, 'last/2', [null, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [undefined])'));
    result = [];
    solve(rules, 'last/2', [{value: 1, next: null}, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1])'));
    result = [];
    solve(rules, 'last/2', [{value: 1, next: {value: 2, next: null}}, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [2])'));
  },
  function test_solve_member() {
    const rules = {
        'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member/2', args: [X, V]}]]
      },
      X = v('X');
    let result = [];
    solve(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 1], env => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 2], env => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 3], env => result.push(true));
    eval(TEST('unify(result, [true])'));
    result = [];
    solve(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 5], env => result.push(true));
    eval(TEST('unify(result, [])'));
    result = [];
    solve(rules, 'member/2', [{value: 1, next: {value: X, next: {value: 3, next: null}}}, 2], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [2])'));
    result = [];
    solve(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  function test_solve_append() {
    const rules = {
        'append/3': [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append/3', args: [X, Y, Z]}]]
      },
      X = v('X'),
      Y = v('Y');
    let result = [];
    solve(rules, 'append/3', [null, null, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [null])'));
    result = [];
    solve(rules, 'append/3', [null, {value: 1, next: null}, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [{value: 1, next: null}])'));
    result = [];
    solve(rules, 'append/3', [{value: 1, next: null}, null, X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [{value: 1, next: null}])'));

    const makeList = (array, rest = null) => {
      if (!array.length) return null;
      const items = array.map(value => ({value}));
      items.forEach((item, index) => (item.next = index + 1 < items.length ? items[index + 1] : rest));
      return items[0];
    };

    result = [];
    solve(rules, 'append/3', [makeList([1, 2]), makeList([3, 4]), X], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [makeList([1, 2, 3, 4])])'));
    result = [];
    solve(rules, 'append/3', [makeList([1, 2]), makeList([3, 4]), makeList([1, 2, 3], X)], env => result.push(assemble(X, env)));
    eval(TEST('unify(result, [makeList([4])])'));

    result = [];
    solve(rules, 'append/3', [X, Y, makeList([1, 2, 3])], env => {
      result.push(assemble(X, env));
      result.push(assemble(Y, env));
    });
    const expected = [null, makeList([1, 2, 3]), makeList([1]), makeList([2, 3]), makeList([1, 2]), makeList([3]), makeList([1, 2, 3]), null];
    eval(TEST('unify(result, expected)'));
  },
  function test_gen_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    for (const env of gen(rules, 'one/1', [X])) {
      result.push(assemble(X, env));
    }
    eval(TEST('unify(result, [1])'));
  },
  function test_gen_member() {
    const rules = {
        'member/2': [(V, X) => [{args: [{value: V, next: X}, V]}], (V, X) => [{args: [{next: X}, V]}, {name: 'member/2', args: [X, V]}]]
      },
      X = v('X');
    let result = [];
    for (const env of gen(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 1])) {
      result.push(true)
    }
    eval(TEST('unify(result, [true])'));
    result = [];
    for (const env of gen(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 2])) {
      result.push(true)
    }
    eval(TEST('unify(result, [true])'));
    result = [];
    for (const env of gen(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 3])) {
      result.push(true)
    }
    eval(TEST('unify(result, [true])'));
    result = [];
    for (const env of gen(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, 4])) {
      result.push(true)
    }
    eval(TEST('unify(result, [])'));
    result = [];
    for (const env of gen(rules, 'member/2', [{value: 1, next: {value: X, next: {value: 3, next: null}}}, 5])) {
      result.push(assemble(X, env));
    }
    eval(TEST('unify(result, [5])'));
    result = [];
    for (const env of gen(rules, 'member/2', [{value: 1, next: {value: 2, next: {value: 3, next: null}}}, X])) {
      result.push(assemble(X, env));
    }
    eval(TEST('unify(result, [1, 2, 3])'));
  },
  function test_gen_append() {
    const rules = {
        'append/3': [Y => [{args: [null, Y, Y]}], (X, Y, Z, V) => [{args: [{value: V, next: X}, Y, {value: V, next: Z}]}, {name: 'append/3', args: [X, Y, Z]}]]
      },
      X = v('X'),
      Y = v('Y');

    const makeList = (array, rest = null) => {
      if (!array.length) return null;
      const items = array.map(value => ({value}));
      items.forEach((item, index) => (item.next = index + 1 < items.length ? items[index + 1] : rest));
      return items[0];
    };

    const result = [];
    for (const env of gen(rules, 'append/3', [X, Y, makeList([1, 2, 3])])) {
      result.push(assemble(X, env));
      result.push(assemble(Y, env));
    }
    const expected = [null, makeList([1, 2, 3]), makeList([1]), makeList([2, 3]), makeList([1, 2]), makeList([3]), makeList([1, 2, 3]), null];
    eval(TEST('unify(result, expected)'));
  },
  async function test_asyncSolve_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    await asyncSolve(rules, 'one/1', [X], async env => (result.push(assemble(X, env)), await timeout(5)));
    eval(TEST('unify(result, [1])'));
  },
  async function test_asyncGen_one() {
    const rules = {
        'one/1': () => [{args: [1]}]
      },
      X = v('X'),
      result = [];
    for await (const env of asyncGen(rules, 'one/1', [X])) {
      result.push(assemble(X, env));
      await timeout(5);
    }
    eval(TEST('unify(result, [1])'));
  }
];

const runTests = async () => {
  _total = _errors = 0;
  let exceptionFlag = false;
  out('Starting tests...');
  for (let i = 0, l = tests.length; i < l; ++i) {
    _current = tests[i].name;
    _local = 0;
    try {
      await tests[i]();
    } catch (e) {
      exceptionFlag = true;
      console.log('Unhandled exception in test #' + i + ' (' + tests[i].name + '): ' + e.message);
      if (e.stack) {
        console.log('Stack: ', e.stack);
      }
      if (SHOW_FAILED_TEST_CODE) {
        console.log('Code: ', tests[i].toString());
      }
    }
  }
  out(_errors ? 'Failed ' + _errors + ' out of ' + _total + ' tests.' : 'Finished ' + _total + ' tests.');
  if (typeof process != 'undefined') {
    process.exit(_errors || exceptionFlag ? 1 : 0);
  } else if (typeof window != 'undefined' && window) {
    if (typeof window.callPhantom == 'function') {
      window.callPhantom(_errors || exceptionFlag ? 'failure' : 'success');
    }
  }
};

runTests();
