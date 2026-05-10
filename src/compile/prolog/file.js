// @ts-self-types="./file.d.ts"
//
// Filesystem-backed convenience: load a `.pl` file (or any text source)
// through `prolog()`. Synchronous and async forms — pick by what your
// caller already is. The async form is the right default when loading
// many files in parallel (`Promise.all([prologFileAsync(a), …])`).
//
// Lifted out of the main `prolog/index.js` entry so browser bundles
// without filesystem access don't get an unsatisfiable `node:fs`
// import. The `node:fs` API surface is supplied by Node, Bun, and
// Deno (Deno via its Node-compat layer); the same module loads
// unmodified in all three.
//
//   import {prologFile, prologFileAsync} from 'yopl/compile/prolog/file';
//   const rules = prologFile(new URL('./family.pl', import.meta.url));
//   const [a, b] = await Promise.all([
//     prologFileAsync(urlA),
//     prologFileAsync(urlB)
//   ]);

import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {prolog} from './index.js';

// Default `options.file` to the URL/path so clause source positions
// carry it through to validation issues and runtime error messages.
// Caller can still override by setting `options.file` explicitly.
const withFileDefault = (url, options) => {
  if (options && options.file !== undefined) return options;
  const file = url instanceof URL ? url.href : String(url);
  return options ? {...options, file} : {file};
};

export const prologFile = (url, options) => prolog(readFileSync(url, 'utf8'), withFileDefault(url, options));
export const prologFileAsync = async (url, options) => prolog(await readFile(url, 'utf8'), withFileDefault(url, options));
