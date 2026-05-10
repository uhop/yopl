// Wolf, Goat, and Cabbage — strict-Prolog front-end dogfood.
//
// Puzzle origin: Alcuin of York, *Propositiones ad Acuendos Juvenes*,
// circa 800 AD (public domain). State-space search with a "safe"
// invariant.
//
// A farmer must transport a wolf, a goat, and a cabbage across a
// river. The boat carries only the farmer plus one item. Left
// unattended, the wolf eats the goat and the goat eats the cabbage.
// Find a sequence of crossings.
//
// State: state(Farmer, Wolf, Goat, Cabbage), each a side (left/right).
// Initial: all left. Goal: all right.
//
// Optimal solutions have 7 moves (8 states). There are exactly two
// such solutions (mirror images: take wolf vs. cabbage on the third
// move). The first move must be "farmer + goat", since any other
// first move leaves either wolf+goat or goat+cabbage unattended.

import {variable as v} from 'deep6/unify.js';
import assemble from 'deep6/traverse/assemble.js';
import solve from '../src/solve.js';
import {prolog} from '../src/compile/prolog/index.js';
import {rules as systemRules} from '../src/rules/system.js';
import {submit, TEST} from './harness.js';

const puzzle = prolog`
  wgc(Path) :-
    search(state(left, left, left, left), [state(left, left, left, left)], RPath),
    reverse(RPath, Path).

  search(state(right, right, right, right), Visited, Visited).
  search(State, Visited, Path) :-
    move(State, Next),
    safe(Next),
    \\+ member(Next, Visited),
    search(Next, [Next | Visited], Path).

  move(state(F, W, G, C), state(F2, W,  G,  C))  :- opposite(F, F2).
  move(state(F, F, G, C), state(F2, F2, G,  C))  :- opposite(F, F2).
  move(state(F, W, F, C), state(F2, W,  F2, C))  :- opposite(F, F2).
  move(state(F, W, G, F), state(F2, W,  G,  F2)) :- opposite(F, F2).

  opposite(left, right).
  opposite(right, left).

  safe(state(F, W, G, C)) :- not_alone(F, W, G), not_alone(F, G, C).
  not_alone(F, X, Y) :- X = Y, !, F = X.
  not_alone(_, _, _).

  member(X, [X | _]).
  member(X, [_ | T]) :- member(X, T).

  append([], L, L).
  append([X | T], L, [X | R]) :- append(T, L, R).

  reverse([], []).
  reverse([X | T], R) :- reverse(T, RT), append(RT, [X], R).
`;

const wgcRules = {...systemRules, ...puzzle};

const consToArray = cons => {
  const out = [];
  for (let c = cons; c; c = c.next) out.push(c.value);
  return out;
};

export default [
  function test_wgc_first_solution() {
    const Path = v('Path');
    let path = null;
    solve(wgcRules, 'wgc', [Path], env => {
      if (!path) path = consToArray(assemble(Path, env)).map(s => ({name: s.name, args: s.args}));
    });
    eval(TEST('path !== null'));
    eval(TEST('path.length === 8'));
    const first = path[0];
    eval(TEST("first.args.every(s => s === 'left')"));
    const last = path[7];
    eval(TEST("last.args.every(s => s === 'right')"));
    const second = path[1];
    eval(TEST("second.args[0] === 'right' && second.args[2] === 'right'"));
    eval(TEST("second.args[1] === 'left' && second.args[3] === 'left'"));
  },
  function test_wgc_all_solutions_are_optimal() {
    const Path = v('Path');
    const lengths = [];
    solve(wgcRules, 'wgc', [Path], env => {
      lengths.push(consToArray(assemble(Path, env)).length);
    });
    eval(TEST('lengths.length === 2'));
    eval(TEST('lengths.every(n => n === 8)'));
  }
];
