// @ts-self-types="./fact-source.d.ts"
//
// Fact-source choice point — a native enumeration protocol that replaces the
// cons-list + walker-clauses cursor idiom (dev-docs/runtime-protocols.md
// § Workstream 1). The js goal pushes a `command: 2` frame so the proof
// loop's own clause machinery iterates the candidates: per candidate one
// thunk call + one sys Variable + one head unify, instead of two full
// walker-clause activations.
//
// `select(env, vars)` returns `{args, list}` — `args`: the goal's argument
// values the candidates unify against (deref once in the select); `list`:
// candidate thunks, each returning a shared ground `[{args: [...]}]` terms
// array (share-safe per the B′ finding — bindings land in the env, the
// goals cursor lives on the frame). Return null / empty list to fail.
//
// Returns false, never null: the pull drivers yield a solution on a null
// goals chain (`!goals` IS the proof-complete signal in gen/asyncGen), so
// the `return null` path's dead-end `{goals: null}` frame reads as one
// spurious solution per call. The false path is also cheaper — no extra
// frames; the driver pops the env frame it pushed, and the rewound goals
// cursor is re-stamped past this goal by every candidate's restoreParent
// (rewind-then-re-execute on rematch equals the walker-clause semantics).
// Cut interop is inherited: `cut(sys)` neutralizes command-2 frames above
// the clause frame, fact sources included.

export const factSource = select => vars => (env, goals, stack) => {
  const cp = select(env, vars);
  if (!cp || cp.list.length === 0) return false;
  stack.push({command: 2, ruleList: cp.list, index: 0, goals, args: cp.args, restoreIndex: goals.index});
  return false;
};

// Cache-side helper: build the shared thunk for one ground fact.
export const factThunk = args => {
  const terms = [{args}];
  return () => terms;
};
