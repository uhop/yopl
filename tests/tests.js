import unify from '../main.js';
import preprocess from '../utils/preprocess.js';
import matchString from '../unifiers/matchString.js';
import matchTypeOf from '../unifiers/matchTypeOf.js';
import matchInstanceOf from '../unifiers/matchInstanceOf.js';
import match from '../unifiers/match.js';
import ref from '../unifiers/ref.js';
import walk from '../utils/walk.js';
import clone from '../utils/clone.js';
import assemble from '../utils/assemble.js';
import deref from '../utils/deref.js';
import replace from '../utils/replace.js';

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

const _ = unify._,
  v = unify.variable,
  open = unify.open,
  soft = unify.soft,
  isOpen = unify.isOpen,
  isSoft = unify.isSoft;

// tests

const tests = [
  function test_constants() {
    eval(TEST('unify(1, 1)'));
    eval(TEST('unify(0, 0)'));
    eval(TEST('unify(null, null)'));
    eval(TEST('unify(undefined, undefined)'));
    eval(TEST('unify(true, true)'));
    eval(TEST('unify(false, false)'));
    eval(TEST("unify('', '')"));
    eval(TEST("unify('1', '1')"));
    eval(TEST('unify(Infinity, Infinity)'));
    eval(TEST('unify(-Infinity, -Infinity)'));
    eval(TEST('unify(NaN, NaN)'));
    eval(TEST('!unify(1, 2)'));
    eval(TEST('!unify(1, true)'));
    eval(TEST("!unify(1, '1')"));
    eval(TEST('!unify(1, [])'));
    eval(TEST('!unify(1, {})'));
  },
  function test_anyvar() {
    eval(TEST('unify(_, 1)'));
    eval(TEST('unify(_, 2)'));
    eval(TEST('unify(_, true)'));
    eval(TEST("unify(_, '1')"));
    eval(TEST('unify(_, [])'));
    eval(TEST('unify(_, {})'));
    eval(TEST('unify(1, _)'));
    eval(TEST('unify(2, _)'));
    eval(TEST('unify(true, _)'));
    eval(TEST("unify('1', _)"));
    eval(TEST('unify([], _)'));
    eval(TEST('unify({}, _)'));
  },
  function test_exact_arrays() {
    eval(TEST('unify([], [])'));
    eval(TEST('unify([1], [1])'));
    eval(TEST('unify([1,2], [1,2])'));
    eval(TEST('!unify([], [1])'));
    eval(TEST('!unify([1], [2])'));
    eval(TEST('!unify([2,1], [1,2])'));
    eval(TEST('unify([1,_,3], [_,2,_])'));
    eval(TEST('unify([_,_,3], [1,_,_])'));
    eval(TEST('unify([[]], [[]])'));
    eval(TEST('unify([[], []], [[], []])'));
  },
  function test_exact_objects() {
    eval(TEST('unify({}, {})'));
    eval(TEST('unify({a: 1}, {a: 1})'));
    eval(TEST('unify({a: 1, b: 2}, {b: 2, a: 1})'));
    eval(TEST('!unify({}, {a: 1})'));
    eval(TEST('!unify({a: 1}, {a: 2})'));
    eval(TEST('!unify({a: 1}, {b: 1})'));
    eval(TEST('unify({a: _, b: 2}, {a: 1, b: _})'));
    eval(TEST('unify({a: {a: 1}, b: 2}, {a: {a: 1}, b: 2})'));
    eval(TEST('!unify({a: {a: 1}, b: 2}, {a: {a: 3}, b: 2})'));
    eval(TEST('!unify({a: {a: 1}, b: 2}, {a: {a: 1}, b: 3})'));
  },
  function test_variables() {
    let result = unify(1, 1);
    eval(TEST('result && unify(result.values, {})'));
    result = unify(1, _);
    eval(TEST('result && unify(result.values, {})'));
    result = unify(1, v('x'));
    eval(TEST('result'));
    eval(TEST('unify(result.values, {x: 1})'));
    eval(TEST("v('x').bound(result)"));
    eval(TEST("v('x').get(result) === 1"));
    result = unify(v('y'), v('x'));
    eval(TEST('result'));
    eval(TEST('unify(result.values, {})'));
    eval(TEST('unify(result.variables, {x: {x: 1, y: 1}, y: {x: 1, y: 1}})'));
    eval(TEST("!v('x').bound(result)"));
    eval(TEST("!v('y').bound(result)"));
    eval(TEST("v('x').alias('y', result)"));
    eval(TEST("v('y').alias('x', result)"));
    eval(TEST("!v('x').alias('z', result)"));
    eval(TEST("!v('y').alias('z', result)"));
    result = unify(v('y'), _);
    eval(TEST('result && unify(result.values, {})'));
    result = unify([1, v('x')], [v('y'), 2]);
    eval(TEST('result'));
    eval(TEST('unify(result.values, {x: 2, y: 1})'));
    eval(TEST("v('x').bound(result)"));
    eval(TEST("v('x').get(result) === 2"));
    eval(TEST("v('y').bound(result)"));
    eval(TEST("v('y').get(result) === 1"));
    result = unify({a: 1, b: v('x')}, {a: v('y'), b: 2});
    eval(TEST('result'));
    eval(TEST('unify(result.values, {x: 2, y: 1})'));
    eval(TEST("v('x').bound(result)"));
    eval(TEST("v('x').get(result) === 2"));
    eval(TEST("v('y').bound(result)"));
    eval(TEST("v('y').get(result) === 1"));
    result = unify({a: 1, b: v('x')}, {a: v('y'), c: 2});
    eval(TEST('!result'));
    result = unify({c: 1, b: v('x')}, {a: v('y'), b: 2});
    eval(TEST('!result'));
  },
  function test_regexes() {
    eval(TEST('unify(/\\b\\w+\\b/, /\\b\\w+\\b/)'));
    eval(TEST('!unify(/\\b\\w+\\b/m, /\\b\\w+\\b/)'));
    eval(TEST('!unify(/\\b\\w+\\b/m, /\\b\\w+\\b/g)'));
    eval(TEST('!unify(/\\b\\w+\\b/, /\\b\\w+\\b/i)'));
    eval(TEST('!unify(/\\b\\w+\\b/, 1)'));
    eval(TEST("unify(/\\b\\w+\\b/, new RegExp('\\\\b\\\\w+\\\\b'))"));
  },
  function test_dates() {
    eval(TEST('unify(new Date(2013, 6, 4), new Date(2013, 6, 4))'));
    eval(TEST('!unify(new Date(2013, 6, 4), new Date(2012, 6, 4))'));
    eval(TEST('!unify(new Date(2013, 6, 4), new Date(2013, 6, 4, 6))'));
    eval(TEST('unify(new Date(2013, 6, 4, 6), new Date(2013, 6, 4, 6))'));
  },
  function test_typed_arrays() {
    if (typeof ArrayBuffer != 'function' || typeof DataView != 'function') return;
    const buffer = new ArrayBuffer(256),
      view = new DataView(buffer);

    const pattern = [1, -1, 42, 1, -1];
    const testTypedArray = (Type, name, conversion = Number) => {
      for (let i = 0; i < pattern.length; ++i) {
        view['set' + name](i * Type.BYTES_PER_ELEMENT, conversion(pattern[i]));
      }
      eval(TEST(`unify(new ${Type.name}(buffer, ${0 * Type.BYTES_PER_ELEMENT}, 2), open(new ${Type.name}(buffer, ${3 * Type.BYTES_PER_ELEMENT}, 2)))`));
      eval(TEST(`!unify(new ${Type.name}(buffer, ${0 * Type.BYTES_PER_ELEMENT}, 2), open(new ${Type.name}(buffer, ${2 * Type.BYTES_PER_ELEMENT}, 2)))`));
    };

    typeof Int8Array == 'function' && testTypedArray(Int8Array, 'Int8');
    typeof Uint8Array == 'function' && testTypedArray(Uint8Array, 'Uint8');
    typeof Uint8ClampedArray == 'function' && testTypedArray(Uint8ClampedArray, 'Uint8');
    typeof Int16Array == 'function' && testTypedArray(Int16Array, 'Int16');
    typeof Uint16Array == 'function' && testTypedArray(Uint16Array, 'Uint16');
    typeof Int32Array == 'function' && testTypedArray(Int32Array, 'Int32');
    typeof Uint32Array == 'function' && testTypedArray(Uint32Array, 'Uint32');
    typeof Float32Array == 'function' && testTypedArray(Float32Array, 'Float32');
    typeof Float64Array == 'function' && testTypedArray(Float64Array, 'Float64');
    typeof BigInt == 'function' && typeof BigInt64Array == 'function' && testTypedArray(BigInt64Array, 'BigInt64', BigInt);
    typeof BigInt == 'function' && typeof BigUint64Array == 'function' && testTypedArray(BigUint64Array, 'BigUint64', BigInt);

    const view2 = new DataView(buffer);
    eval(TEST(`unify(view, view)`));
    eval(TEST(`unify(view, view2)`));

    const buffer2 = buffer.slice(0);
    eval(TEST(`unify(buffer, buffer)`));
    eval(TEST(`unify(buffer, buffer2)`));
  },
  function test_open_structures() {
    eval(TEST('unify({a: 1, b: 2, c: 3}, open({a: 1}))'));
    eval(TEST('unify(open({a: 1}), {a: 1, b: 2, c: 3})'));
    eval(TEST('unify([1, 2, 3], open([1,2]))'));
    eval(TEST('unify(open([1, 2]), [1, 2, 3])'));
    eval(TEST('unify(open({a: 1}), open({b: 2}))'));
    eval(TEST('unify(open([1]), open([1, 2]))'));
  },
  function test_sets() {
    if (typeof Set != 'function') return;
    const set1 = new Set(),
      set2 = new Set();

    eval(TEST('unify(set1, set1)'));
    eval(TEST('unify(set2, set2)'));

    eval(TEST('unify(set1, set2)'));

    set1.add(1).add(2).add(3);
    set2.add(1).add(2);

    eval(TEST('!unify(set1, set2)'));

    set2.add(3);

    eval(TEST('unify(set1, set2)'));
  },
  function test_maps() {
    if (typeof Map != 'function') return;
    const map1 = new Map(),
      map2 = new Map();

    eval(TEST('unify(map1, map1)'));
    eval(TEST('unify(map2, map2)'));

    eval(TEST('unify(map1, map2)'));

    map1.set(1, {value: 42}).set(2, [42]).set(3, null);
    map2.set(1, {value: 42}).set(2, [42]);

    eval(TEST('!unify(map1, map2)'));

    map2.set(3, null);

    eval(TEST('unify(map1, map2)'));
  },
  function test_loose() {
    eval(TEST('!unify([42], ["42"])'));
    eval(TEST('unify([42], ["42"], null, {loose: true})'));
  },
  function test_soft_structures() {
    const x = v('x');
    let result = unify([soft({a: 1}), soft({b: 2})], soft([x, x]));
    eval(TEST('result'));
    eval(TEST('isSoft(x.get(result))'));
    eval(TEST("x.get(result).type === 'soft'"));
    eval(TEST('unify(x.get(result).object, {a: 1, b: 2})'));
    result = unify([soft({a: 1}), x], soft([x, soft({b: 2})]));
    eval(TEST('result'));
    eval(TEST('isSoft(x.get(result))'));
    eval(TEST("x.get(result).type === 'soft'"));
    eval(TEST('unify(x.get(result).object, {a: 1, b: 2})'));
  },
  function test_soft_presets() {
    const x = v('x'),
      env = unify(x, soft({}));
    let result = unify([1], [x], env);
    eval(TEST('!result'));
    result = unify([open({a: 1}), open({b: 2})], [x, x], env);
    eval(TEST('result'));
    eval(TEST('isSoft(x.get(result))'));
    eval(TEST("x.get(result).type === 'soft'"));
    eval(TEST('unify(x.get(env).object, {a: 1, b: 2})'));
  },
  function test_complex_structures() {
    const x = v('x'),
      y = v('y');
    const tree = {
      value: 0,
      left: {
        value: 1,
        left: {
          value: 3
        },
        right: {
          value: 4
        }
      },
      right: {
        value: 2,
        left: null,
        right: {
          value: 3
        }
      }
    };
    const result = unify(tree, {
      value: x,
      left: open({left: y}),
      right: open({right: y})
    });
    eval(TEST('result'));
    eval(TEST('x.get(result) === 0'));
    eval(TEST('unify(y.get(result), {value: 3})'));
  },
  function test_preprocess() {
    const l = {
        x: 5,
        y: {
          a: 42,
          b: {},
          c: [1, 2, 3]
        },
        z: 'ah!'
      },
      r = {
        y: {
          b: {}
        },
        z: 'ah!'
      };
    let result = unify(l, r);
    eval(TEST('!result'));
    result = unify(l, preprocess(r));
    eval(TEST('!result'));
    result = unify(l, preprocess(r, {openObjects: true}));
    eval(TEST('result'));
    result = unify(l.y, {c: [1, 2]});
    eval(TEST('!result'));
    result = unify(l.y, preprocess({c: [1, 2]}));
    eval(TEST('!result'));
    result = unify(l.y, preprocess({c: [1, 2]}, {openArrays: true}));
    eval(TEST('!result'));
    result = unify(l.y, preprocess({c: [1, 2]}, {openObjects: true, openArrays: true}));
    eval(TEST('result'));
  },
  function test_matchString() {
    let result = unify('12345', matchString(/1(2)3/));
    eval(TEST('result'));
    result = unify('12345', matchString(/1(2)3/, null, {input: '12345', index: 0}));
    eval(TEST('result'));
    result = unify('12345', matchString(/1(2)3/, ['123', '2']));
    eval(TEST('result'));
    //
    const x = v('x'),
      y = v('y');
    result = unify('12345', matchString(/1(2)3/, x, y));
    eval(TEST('result'));
    eval(TEST("unify(x.get(result), ['123', '2'])"));
    eval(TEST("unify(y.get(result), {index: 0, input: '12345'})"));
    eval(TEST('unify(y.get(result), open({index: 0}))'));
    //
    result = unify('12345', matchString(/1(2)3/, [_, x], open({index: y})));
    eval(TEST('result'));
    eval(TEST("x.get(result) === '2'"));
    eval(TEST('y.get(result) === 0'));
  },
  function test_matchTypeOf() {
    let result = unify(1, matchTypeOf('number'));
    eval(TEST('result'));
    result = unify('a', matchTypeOf('string'));
    eval(TEST('result'));
    result = unify(true, matchTypeOf('boolean'));
    eval(TEST('result'));
    result = unify(undefined, matchTypeOf('undefined'));
    eval(TEST('result'));
    result = unify(null, matchTypeOf('object'));
    eval(TEST('result'));
    result = unify([], matchTypeOf('object'));
    eval(TEST('result'));
    result = unify({}, matchTypeOf('object'));
    eval(TEST('result'));
    result = unify(function () {}, matchTypeOf('function'));
    eval(TEST('result'));
    result = unify('a', matchTypeOf(['number', 'string', 'boolean']));
    eval(TEST('result'));
    result = unify(null, matchTypeOf(['function', 'object']));
    eval(TEST('result'));
    result = unify(unify, matchTypeOf(['function', 'object']));
    eval(TEST('result'));

    result = unify([], matchTypeOf(['number', 'string', 'boolean']));
    eval(TEST('!result'));
    result = unify(1, matchTypeOf(['function', 'object']));
    eval(TEST('!result'));
  },
  function test_matchInstanceOf() {
    class A {}
    class B extends A {}
    class C extends B {}
    class D {}
    class E extends D {}

    let result = unify(new A(), matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify(new A(), matchInstanceOf(A));
    eval(TEST('result'));
    result = unify(new A(), matchInstanceOf(B));
    eval(TEST('!result'));
    result = unify(new A(), matchInstanceOf(C));
    eval(TEST('!result'));
    result = unify(new A(), matchInstanceOf(D));
    eval(TEST('!result'));
    result = unify(new A(), matchInstanceOf(E));
    eval(TEST('!result'));

    result = unify(new B(), matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify(new B(), matchInstanceOf(A));
    eval(TEST('result'));
    result = unify(new B(), matchInstanceOf(B));
    eval(TEST('result'));
    result = unify(new B(), matchInstanceOf(C));
    eval(TEST('!result'));
    result = unify(new B(), matchInstanceOf(D));
    eval(TEST('!result'));
    result = unify(new B(), matchInstanceOf(E));
    eval(TEST('!result'));

    result = unify(new C(), matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify(new C(), matchInstanceOf(A));
    eval(TEST('result'));
    result = unify(new C(), matchInstanceOf(B));
    eval(TEST('result'));
    result = unify(new C(), matchInstanceOf(C));
    eval(TEST('result'));
    result = unify(new C(), matchInstanceOf(D));
    eval(TEST('!result'));
    result = unify(new C(), matchInstanceOf(E));
    eval(TEST('!result'));

    result = unify(new D(), matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify(new D(), matchInstanceOf(A));
    eval(TEST('!result'));
    result = unify(new D(), matchInstanceOf(B));
    eval(TEST('!result'));
    result = unify(new D(), matchInstanceOf(C));
    eval(TEST('!result'));
    result = unify(new D(), matchInstanceOf(D));
    eval(TEST('result'));
    result = unify(new D(), matchInstanceOf(E));
    eval(TEST('!result'));

    result = unify(new E(), matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify(new E(), matchInstanceOf(A));
    eval(TEST('!result'));
    result = unify(new E(), matchInstanceOf(B));
    eval(TEST('!result'));
    result = unify(new E(), matchInstanceOf(C));
    eval(TEST('!result'));
    result = unify(new E(), matchInstanceOf(D));
    eval(TEST('result'));
    result = unify(new E(), matchInstanceOf(E));
    eval(TEST('result'));

    result = unify(new Date(), matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify(new Date(), matchInstanceOf(Date));
    eval(TEST('result'));
    result = unify(new Date(), matchInstanceOf(Array));
    eval(TEST('!result'));

    result = unify([], matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify([], matchInstanceOf(Date));
    eval(TEST('!result'));
    result = unify([], matchInstanceOf(Array));
    eval(TEST('result'));

    result = unify({}, matchInstanceOf(Object));
    eval(TEST('result'));
    result = unify({}, matchInstanceOf(Date));
    eval(TEST('!result'));
    result = unify({}, matchInstanceOf(Array));
    eval(TEST('!result'));
  },
  function test_match() {
    const smallNumber = match(function (val) {
      return typeof val == 'number' && 0 < val && val < 10;
    });

    let result = unify(5, smallNumber);
    eval(TEST('result'));
    result = unify(10, smallNumber);
    eval(TEST('!result'));
    result = unify(0, smallNumber);
    eval(TEST('!result'));
    result = unify('5', smallNumber);
    eval(TEST('!result'));
  },
  function test_walk() {
    const result = {};
    walk(
      {
        a: [1, true, [0, NaN, Infinity, Math.sin]],
        b: ['hello!', new Date(), /\d+/, {g: undefined}],
        c: null,
        d: {
          e: [],
          f: {}
        }
      },
      {
        processOther: function (s) {
          const t = typeof s;
          if (typeof result[t] != 'number') {
            result[t] = 0;
          }
          ++result[t];
        }
      }
    );
    const expected = {
      boolean: 1,
      number: 4,
      string: 1,
      function: 1,
      object: 1,
      undefined: 1
    };
    eval(TEST('unify(result, expected)'));
  },
  function test_clone() {
    const source = {
      a: [1, true, [0, NaN, Infinity, Math.sin]],
      b: ['hello!', new Date(), /\d+/, {g: undefined}],
      c: null,
      d: {
        e: [],
        f: {}
      }
    };
    let result = clone(source);
    eval(TEST('result !== source'));
    eval(TEST('unify(result, source)'));
    const left = v('left'),
      right = v('right');
    const env = unify(
      {left: left, right: right},
      {
        left: {left: 1, right: 2},
        right: {left: 8, right: 9}
      }
    );
    result = clone(
      {
        left: {
          left: left,
          right: {left: 3, right: 4}
        },
        right: {
          left: {left: 6, right: 7},
          right: right
        }
      },
      env
    );
    const expected = {
      left: {
        left: {left: 1, right: 2},
        right: {left: 3, right: 4}
      },
      right: {
        left: {left: 6, right: 7},
        right: {left: 8, right: 9}
      }
    };
    eval(TEST('unify(result, expected)'));
  },
  function test_assemble() {
    let source = {
      a: [1, , null],
      b: {c: 'hey'}
    };
    let result = assemble(source);
    eval(TEST('result === source'));
    eval(TEST('unify(result, source)'));
    source = {x: [{y: false}]};
    const env = unify(v('x'), source);
    eval(TEST("v('x').bound(env)"));
    eval(TEST("v('x').get(env) === source"));
    eval(TEST("unify(v('x').get(env), source)"));
    source = {z: v('x')};
    result = assemble(source, env);
    eval(TEST('result !== source'));
    eval(TEST('unify(result, source, env)'));
    eval(TEST('unify(result, {z: {x: [{y: false}]}})'));
  },
  function test_deref() {
    let source = {
      a: [1, , null],
      b: {c: 'hey'}
    };
    let result = deref(source);
    eval(TEST('result === source'));
    eval(TEST('unify(result, source)'));
    source = {x: [{y: false}]};
    const env = unify(v('x'), source);
    eval(TEST("v('x').bound(env)"));
    eval(TEST("v('x').get(env) === source"));
    eval(TEST("unify(v('x').get(env), source)"));
    source = {z: v('x')};
    result = deref(source, env);
    eval(TEST('result === source'));
    eval(TEST('unify(result, source, env)'));
    eval(TEST('unify(result, {z: {x: [{y: false}]}})'));
  },
  function test_ref() {
    const source = {
        left: {left: 1, right: 2},
        right: {left: 3, right: 4}
      },
      pattern = {
        left: ref(v('lnode'), {left: 1, right: v('right')}),
        right: ref('rnode', {left: v('left'), right: 4})
      };
    const env = unify(pattern, source);
    eval(TEST('env'));
    eval(TEST("v('left').bound(env)"));
    eval(TEST("v('left').get(env) === 3"));
    eval(TEST("v('right').bound(env)"));
    eval(TEST("v('right').get(env) === 2"));
    eval(TEST("v('lnode').bound(env)"));
    eval(TEST("unify(v('lnode'), {left: 1, right: 2}, env)"));
    eval(TEST("v('rnode').bound(env)"));
    eval(TEST("unify(v('rnode'), {left: 3, right: 4}, env)"));
  },
  function test_filters() {
    let counter = 0;
    function Foo(name) {
      this.counter = ++counter;
      this.name = name;
      this.flag = true;
    }
    const l = {x: new Foo('Sam'), y: new Foo('Mary')},
      r = {x: new Foo('Sam'), y: new Foo('Mary')};
    eval(TEST('counter === 4'));
    // delayed filter
    unify.filters.push(
      function test(l, r) {
        return l.flag || r.flag;
      },
      function unify(l, r, ls, rs, env) {
        if (!l.flag || !r.flag) {
          return false;
        }
        ls.push(l.name);
        rs.push(r.name);
        return true;
      }
    );
    eval(TEST('unify(l, r)'));
    unify.filters.pop();
    unify.filters.pop();
    // immediate filter
    unify.filters.push(
      function test(l, r) {
        return l.flag || r.flag;
      },
      function unify(l, r, ls, rs, env) {
        if (!l.flag || !r.flag) {
          return false;
        }
        return l.name === r.name;
      }
    );
    eval(TEST('unify(l, r)'));
    unify.filters.pop();
    unify.filters.pop();
    // no custom filters
    eval(TEST('!unify(l, r)'));
    // instanceof-based custom unifier
    unify.registry.Foo = function unify(l, r, ls, rs, env) {
      if (typeof r == 'string') {
        ls.push(l.name);
        rs.push(r);
        return true;
      }
      if (!r.flag) {
        return false;
      }
      ls.push(l.name);
      rs.push(r.name);
      return true;
    };
    eval(TEST('unify(l, r)'));
    delete unify.registry.Foo;
  },
  function test_replace() {
    const x = v('x'),
      y = v('y'),
      val = v('val'),
      env = unify(
        {
          val: 3,
          pos: [1, 2]
        },
        {
          val: val,
          pos: [x, y]
        }
      );
    eval(TEST('env'));
    eval(TEST('x.bound(env)'));
    eval(TEST('unify(x, 1, env)'));
    eval(TEST('y.bound(env)'));
    eval(TEST('unify(y, 2, env)'));
    eval(TEST('val.bound(env)'));
    eval(TEST('unify(val, 3, env)'));
    eval(TEST("replace('${x} + ${y} = ${val}', env) === '1 + 2 = 3'"));
  },
  function test_nullProto() {
    const x = Object.create(null),
      y = Object.create(null),
      z = Object.create(null);
    (x.a = 1), (x.b = []), (x.c = null);
    (y.a = 1), (y.b = []), (y.c = null);
    (z.a = 2), (z.b = []), (z.c = null);

    let env = unify(x, y);
    eval(TEST('env'));
    env = unify(x, {c: null, b: [], a: 1});
    eval(TEST('env'));
    env = unify(y, {c: null, b: [], a: 1});
    eval(TEST('env'));
    env = unify(x, z);
    eval(TEST('!env'));
    env = unify(x, {c: null, b: [], a: 2});
    eval(TEST('!env'));
  }
];

const runTests = () => {
  _total = _errors = 0;
  let exceptionFlag = false;
  out('Starting tests...');
  for (let i = 0, l = tests.length; i < l; ++i) {
    _current = tests[i].name;
    _local = 0;
    try {
      tests[i]();
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
