/* Page-side client for assets/regexworker.js. RegexPy.run(...) and RegexPy.check(...) return parsed JSON from
 * assets/regexrun.py. A call that takes longer than TIMEOUT ms kills the worker and rejects with {timeout: true}
 * (the next call starts a fresh worker). RegexPy.onStatus(fn) reports loading progress. */
const RegexPy = (() => {
  const TIMEOUT = 3000;
  let worker, ready, seq = 0, status = () => {};
  const pending = new Map();

  function start() {
    status('Loading Python (about 10 MB the first time, then cached)...');
    worker = new Worker('assets/regexworker.js');
    ready = new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.ready) { status(''); resolve(); }
        else if (data.fatal) { status('Could not load Python: ' + data.fatal); reject(new Error(data.fatal)); }
        else if (pending.has(data.id)) {
          const { res, rej, timer } = pending.get(data.id);
          clearTimeout(timer); pending.delete(data.id);
          data.error ? rej(new Error(data.error)) : res(JSON.parse(data.result));
        }
      };
      worker.onerror = e => { status('Could not load Python.'); reject(new Error(e.message)); };
    });
    ready.catch(() => {});
  }

  async function call(fn, args) {
    if (!worker) start();
    await ready;
    return new Promise((res, rej) => {
      const id = ++seq, w = worker;
      const timer = setTimeout(() => {
        pending.delete(id); w.terminate(); worker = null;
        rej({ timeout: true });
      }, TIMEOUT);
      pending.set(id, { res, rej, timer });
      w.postMessage({ id, fn, args });
    });
  }

  return {
    onStatus(fn) { status = fn; },
    warm() { if (!worker) start(); },
    run: (pattern, flags, text, mode, repl) => call('run', [pattern, flags, text, mode, repl === '' || repl == null ? null : repl]),
    check: (pattern, flags, spec) => call('check_json', [pattern, flags, JSON.stringify(spec)]),
  };
})();
