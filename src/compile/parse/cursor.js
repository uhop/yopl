// Token cursor — encapsulates position state and advance helpers
// shared by parser primitives. `values` carries the tagged-template
// interpolation slot values for use when an `interp` token is consumed.
//
// `peekAt(offset)` is for one-token lookahead used by the Pratt
// expression parser to disambiguate sym-as-operator from sym-as-functor
// (`\+ foo` vs `\+(foo, bar)`).

export const makeCursor = (tokens, values) => {
  let pos = 0;
  return {
    values,
    peek: () => tokens[pos],
    peekAt: offset => tokens[pos + offset],
    advance: () => tokens[pos++],
    eat: kind => {
      const t = tokens[pos];
      if (t.kind !== kind) throw new Error(`expected ${kind}, got ${t.kind}`);
      ++pos;
      return t;
    },
    accept: kind => (tokens[pos].kind === kind ? tokens[pos++] : null)
  };
};
