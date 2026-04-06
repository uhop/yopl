// Shared helpers for yopl tests.

export const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

// Build a yopl-style cons list from a JS array. Optional `rest` becomes the
// tail of the last cell instead of `null`, which is useful for partial lists.
export const makeList = (array, rest = null) => {
  if (!array.length) return rest;
  const items = array.map(value => ({value}));
  items.forEach((item, index) => (item.next = index + 1 < items.length ? items[index + 1] : rest));
  return items[0];
};
