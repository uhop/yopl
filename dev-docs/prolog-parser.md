# Strict-Prolog parser internals

User-facing reference for `prolog\`...\``and`prologClause\`...\`` is at
[`wiki/compile-prolog.md`](../wiki/compile-prolog.md). This doc covers
the internals — what's in `src/compile/parse/`and`src/compile/prolog/`,
and why each piece is shaped the way it is.

## File layout

```
src/compile/parse/        ── shared with clause/ — lexer, cursor, Pratt
├── lexer.js              ── sticky-regex tokenizer, position tracking
├── cursor.js             ── token stream with peek / peekAt / accept / eat
├── op-table.js           ── default term + body op tables, addOp, cloneOpTable
├── expr.js               ── Pratt parseExpr + parsePrimary (term context)
├── body-expr.js          ── parseBodyExpr + transformBody + goalize + helpers
├── term.js               ── older parseTerm / parseArgs (clause front-end only)
├── goal.js               ── older parseGoal / parseBody (clause front-end only)
├── interp.js             ── wrapTermInterp / wrapGoalInterp auto-wrap fence
└── util.js               ── isVarStart helper
src/compile/prolog/
├── index.js              ── prolog / prologClause polymorphic-tag entry points
├── clause.js             ── parseHead, parseClause, parseGoal, parseGoals
├── program.js            ── parseProgram + op/3, op/4 directives
└── file.js               ── prologFile / prologFileAsync (Node fs wrapper)
```

The `parse/` directory is shared by both front-ends (`compile/clause/`
uses `term.js` + `goal.js`, `compile/prolog/` uses `expr.js` +
`body-expr.js`) so the lexer, cursor, and op-table are the contract
that lets the two front-ends emit identical IR for the shared subset.

## Pipeline

```
source string(s)
  → tokenize          (lexer.js: sticky-regex + position tracking)
  → makeCursor        (cursor.js)
  → parseProgram      (program.js: clause-or-directive loop)
    │
    ├── parseDirective   (recognizes :- op(...).)
    │     └── applyOp     (mutates a *cloned* op table — per-invocation scope)
    │
    └── parseClause   (clause.js)
          ├── parseHead       (atom + optional arg list)
          ├── parseBodyExpr   (body-expr.js: Pratt at body-context maxPrio)
          └── transformBody   (body-expr.js: walk Term tree → Goal[] + helpers)
              ├── goalize         (Compound → Call, atom → Call, var → dynamic Call)
              ├── transformDisjunction  (mints $or_<N> helper rules with capture)
              └── transformIfThen[Else] (mints $ite_<N> helper rules)
  → groups by name+arity, attaches helpers
  → IR Rules dict
```

`compileProgramInternal` in `prolog/index.js` wraps this pipeline and,
when `lower: true` (default), feeds the IR through `lowerRules` to
produce the runtime `Rules` dict. The IR is also attached to the
result under `Symbol.for('yopl.ir')` for cross-validation / codegen
inspection.

## Lexer (`parse/lexer.js`)

Single sticky regex (`/y` flag) with one alternation per token kind —
the V8 RegExp engine eats whole lexemes in native code; the JS side
only dispatches on the first character of the matched lexeme. Same
shape as `stream-json`'s parser, collapsed to one state because the
grammar is context-free at the lexer level.

Recognized lexemes:

| Lexeme                                       | Token kind                       |
| -------------------------------------------- | -------------------------------- |
| `[ \t\n\r]+`                                 | (skipped — whitespace)           |
| `:-`                                         | `colondash`                      |
| `(`, `)`, `[`, `]`, `,`, `\|`, `!`, `.`, `;` | `lparen`/`rparen`/`lbracket`/…   |
| `"..."`, `'...'`                             | `string` (with backslash escape) |
| `\d+(?:\.\d+)?`                              | `number` (non-negative)          |
| `[A-Za-z_]\w*`                               | `ident`                          |
| `[+\-*/\\^<>=~:?@#$&]+`                      | `sym` (symbolic operator atom)   |
| `% line`                                     | (skipped — line comment)         |
| `/* block */`                                | (skipped — block comment)        |

Unary minus is the parser's concern — the lexer always emits
`[sym('-'), number(N)]` for source `-N`, never a single `number(-N)`.
This keeps the lexer state-free and lets the Pratt parser apply the
prefix-`-` rule from the op table.

### Position tracking

Every emitted token carries `{line, col}` (1-based, counted from the
start of the source). `tokenizeChunk` accepts `(text, tokens, startLine,
startCol)` and returns `[endLine, endCol]` so multi-chunk tagged
templates thread position state across chunks. Interp slot tokens
(`{kind: 'interp', index}`) inherit the position right after the prior
chunk's last character — the lexer doesn't know how wide the
interpolated value is when rendered.

Position tracking is always on; gating it would complicate the API
for marginal saving (transient memory, GC'd after parse). The
**downstream** source-map machinery (`Clause.source` attachment) is
opt-in via `sourceMap: true` on the `prolog` configurator — see
[compile-prolog § Source maps](../wiki/compile-prolog.md#source-maps).

## Pratt expression parser (`parse/expr.js`)

Standard operator-precedence parser following ISO Prolog's
priority/associativity rules:

| Type | Behavior                                       |
| ---- | ---------------------------------------------- |
| xfx  | Non-associative infix; both children strict.   |
| xfy  | Right-associative infix; right ≤, left strict. |
| yfx  | Left-associative infix; left ≤, right strict.  |
| fx   | Non-associative prefix; child strict.          |
| fy   | Right-stackable prefix; child ≤ priority.      |

Postfix (`xf`, `yf`) is not implemented — ISO Prolog has very few
uses, yopl has none. Add when a real need arises.

Two important disambiguation rules:

1. **Op-vs-functor.** A `sym` or `ident` immediately followed by `(`
   is parsed as a functor call, not an operator application. So
   `'=>'(A, B)` and `\+(foo, bar)` parse as compounds with the
   operator name as the functor.

2. **Op-vs-atom.** A `sym` followed by a token that cannot start a
   primary (`,`, `)`, `]`, `|`, `.`, `;`, `:-`, `eof`) is treated as
   a bare atom (`Lit(name)`) rather than a prefix operator. Prevents
   `op(700, fy, -)` from trying to apply unary `-` to the closing
   paren when the operand is missing.

`op/4` aliasing: when an op-table entry has a `target` field, the
emitted compound uses `target` as the functor name instead of the
source-level op name. So `:- op(700, xfx, =>, eq).` followed by
`X => Y` in arg position emits `Compound('eq', [X, Y])` directly.

### Bare lowercase atoms

Bare lowercase identifiers in primary position parse as `Lit(name)`
(string-atom literals) — matches yopl's runtime convention where atoms
are JS strings (`src/rules/system.js`'s call-handler treats
`typeof term == 'string'` as the atom branch). A 0-arity
`Compound(name, [])` would lower to a runtime `{name, args: []}`
object that wouldn't unify with the corresponding string atom.

This differs from the per-clause `clause\`...\`` front-end, which
rejects bare atoms — that front-end was MVP-shaped before this decision
landed and the Pratt parser took over.

## Body-context Pratt (`parse/body-expr.js`)

`parseBodyExpr` shares the Pratt machinery with `parseExpr` via a
`parsePrim` parameter. The body-aware primary parser (`parseBodyPrimary`)
recognizes:

- `!` (bang token) → `Cut()` Goal IR
- bare `fail` (no parens) → `Fail()` Goal IR
- `${jsFunction}` slot → `Js(fn)` Goal IR (via `wrapGoalInterp`)
- everything else delegates to `parsePrimary` (term-context)

Args of compound calls and list elements stay term-context regardless
of outer mode — `parseArgsExpr` and `parseListExpr` don't forward
`parsePrim`. Paren'd subexpressions DO forward, so `(foo, bar)` in
body position parses as a body-context group (vs. `bar(foo, bar)` whose
inner `foo, bar` is a comma-separated arg list).

Body op table adds (on top of the term defaults):

| Op   | Priority | Type | Target alias              |
| ---- | -------- | ---- | ------------------------- |
| `,`  | 1000     | xfy  | (structural — flattened)  |
| `;`  | 1100     | xfy  | (mints `$or_<N>` helper)  |
| `->` | 1050     | xfy  | (mints `$ite_<N>` helper) |
| `\+` | 900      | fy   | `not`                     |

`,` at 1000 stays above the args parser's `maxPrio = 999`, so it
remains a structural separator inside `[...]` and `(...)` while
becoming a true conjunction operator at body's `maxPrio = 1200`.

## `transformBody` and `goalize`

The Pratt produces a Term IR tree (with embedded Cut/Fail/Js
sentinels). `transformBody` walks this tree producing the final
`Goal[]` for the clause body, plus any helper rules generated for
disjunction / if-then-else branches.

The walk is in `goalizeWithCtx`:

| Tree node                | Goal output                                |
| ------------------------ | ------------------------------------------ |
| `Compound(',', [A, B])`  | `[...goalize(A), ...goalize(B)]` (flatten) |
| `Compound(';', [A, B])`  | `[transformDisjunction(...)]`              |
| `Compound('->', [A, B])` | `[transformIfThen(A, B, ctx)]`             |
| `Compound(name, args)`   | `[Call(GOAL_ALIASES[name] ?? name, args)]` |
| `Lit(string)`            | `[Call(string, [])]` (atom-as-goal)        |
| `Var(name)`              | `[Call(Var(name), [])]` (dynamic dispatch) |
| `Cut` / `Fail` / `Js` IR | `[t]` (already Goal IR)                    |

`GOAL_ALIASES` is the body-context name remapping (`=`→`eq`, `\=`→`notEq`,
`<`→`lt`, etc.). It runs at goalize time, not in the op table — so
`foo(X = Y)` in arg position emits `Compound('=', [X, Y])` (term as
data, unaliased) while top-level `X = Y` in body emits
`Call('eq', [X, Y])`.

## Helper rules

### Disjunction `(A ; B)` → `$or_<N>`

`transformDisjunction` computes the captured-var set (vars used inside
the disjunction that are also in the clause-scope set), mints a fresh
helper rule named `$or_<N>` with one clause per branch, and replaces
the disjunction site with `Call('$or_<N>', captured-vars)`.

`collectDisjBranches` walks the right-recursive `;` chain so
`a ; b ; c` flattens to one helper with three clauses (rather than two
nested helpers).

Module-level monotonic counter (`helperCounter`) ensures global
uniqueness across `prolog\`...\``calls — different program tags
won't collide on`$or_1`.

### If-then `Cond -> Then` → `$ite_<N>`

`transformIfThen` mints a single-clause helper:

```
$ite_<N>(captured...) :- Cond, !, Then.
```

The cut commits to the `Then` branch on `Cond` success. With no else
arm, the helper fails when `Cond` fails (no fall-through).

### If-then-else `Cond -> Then ; Else` → `$ite_<N>`

ISO precedence parses `Cond -> Then ; Else` as `;(->(Cond, Then), Else)`.
`collectDisjBranches` detects the if-then-else (its left arg is a
`->` compound) and `transformIfThenElse` mints a two-clause helper:

```
$ite_<N>(captured...) :- Cond, !, Then.
$ite_<N>(captured...) :- Else.
```

The cut in the first clause commits to `Then` on `Cond` success,
preventing the second clause from being tried.

### Prior branches with if-then-else

`A ; B ; (C -> T ; E)` mints **two** helpers — an inner `$ite_<N>` for
the if-then-else, and an outer `$or_<M>` whose last clause calls the
inner `$ite_<N>`. `collectDisjBranches` returns both the prior
branches and the if-then-else trio; `transformDisjunction` routes
both through `mintDisjunctionHelper`.

### Cut inside `;` / `->` branches scopes opaquely

Cut inside a disjunction or if-then-else branch only cuts the helper
rule — it doesn't propagate to the parent clause. Transparent cut
(Prolog's `;` semantics where a cut inside a branch cuts the
enclosing predicate) requires a dedicated `Disjunction` IR kind and
custom lowering. Deferred until a real use case appears.

## Polymorphic tags (`prolog/index.js`)

The `prolog` and `prologClause` identifiers are not plain functions —
they're polymorphic tag closures lifted from
[`dollar-shell`](https://www.npmjs.com/package/dollar-shell)'s
`bqSpawn`. The same identifier handles three call shapes:

```js
prolog`source`; // tag form — TemplateStringsArray
prolog(string); // function form — string source
prolog(string, options); // function form with options
prolog(options); // configurator — returns a fresh tag
prolog.with(options); // alias for the configurator
```

Implementation in `makePolyTag`:

```js
const tag = (strings, ...values) => {
  if (verifyStrings(strings)) return compile(strings, values, options); // tag form
  if (typeof strings === 'string') {
    // function form
    const merged = values[0] ? {...options, ...values[0]} : options;
    return compile([strings], [], merged);
  }
  if (strings && typeof strings === 'object') {
    // configurator
    return makePolyTag(compile, {...options, ...strings});
  }
  throw new Error('...');
};
tag.with = opts => makePolyTag(compile, {...options, ...opts});
```

`verifyStrings` is the discriminator — it checks for the
`Array.isArray(strings) && Array.isArray(strings.raw)` shape that JS
guarantees for tagged-template invocations. (Plain `Array` arguments
that happen to look similar would fail the `.raw` check.)

Configurator recursion: each configurator call returns a _new_ tag
closing over merged options, so chains like
`prolog.with({lower: false}).with({operators: [...]})` accumulate.
Per-invocation operator scope is preserved by `parseProgram` cloning
the input op table on entry — directives declared inside `prolog\`...\``
never leak to the next call.

## File loaders (`prolog/file.js`)

Two-line wrappers around `node:fs`:

```js
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {prolog} from './index.js';

export const prologFile = (url, options) => prolog(readFileSync(url, 'utf8'), withFileDefault(url, options));
export const prologFileAsync = async (url, options) => prolog(await readFile(url, 'utf8'), withFileDefault(url, options));
```

`withFileDefault` populates `options.file = url.href` (or the string
form) so source positions carry the URL through to validator issues
and runtime error reports — caller can override by setting
`options.file` explicitly.

Lives in its own subpath (`yopl/compile/prolog/file`) so browser
bundles without filesystem access don't pull in `node:fs`. Works in
Node, Bun, and Deno (Deno via its Node-compat layer).

## See also

- [`wiki/compile-prolog.md`](../wiki/compile-prolog.md) — user-facing
  reference (tags, options, body operators, op directives, source maps).
- [`dev-docs/compiler-ir.md`](./compiler-ir.md) — IR design (5 Term
  kinds + 4 Goal kinds + Clause + Rule, plus the `Lit`-walker).
- `tests/test-compile-prolog.js` — parser test suite (192+ tests
  covering parse primitives, Pratt, parseClause, parseProgram,
  polymorphic-tag, body operators, disjunction, if-then-else).
- `tests/test-prolog-dogfood.js` — IR-equivalence dogfood comparing
  `clause\`...\``and`prolog\`...\`` outputs for representative
  patterns.
