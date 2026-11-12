/* Web worker that runs Python's re module (Pyodide) off the page's thread, so a runaway pattern
 * (catastrophic backtracking) can be stopped by terminating the worker. Talks to assets/regexpy.js.
 * Messages in: {id, fn, args}. Out: {ready: true} once, then {id, result} or {id, error}. */
'use strict';
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
importScripts(PYODIDE + 'pyodide.js');

const ready = (async () => {
  const py = await loadPyodide({ indexURL: PYODIDE });
  py.runPython(await (await fetch(new URL('regexrun.py', self.location.href))).text());
  return py;
})();
ready.then(() => postMessage({ ready: true }), e => postMessage({ fatal: String(e) }));

onmessage = async ({ data: { id, fn, args } }) => {
  try {
    const py = await ready;
    postMessage({ id, result: py.globals.get(fn)(...args) });
  } catch (e) {
    postMessage({ id, error: String(e) });
  }
};
