/* ===========================================================================
 * The real man pages, fetched in the background.
 *
 * data/itn170-man.json holds the genuine RHEL 9 text for every command the
 * shell implements -- 150 pages, about 670KB gzipped. That is far too much to
 * put in front of a page load for documentation most visitors never open, so
 * it arrives afterwards, out of the way.
 *
 * Nobody waits for it. Until it lands, `man` answers from the hand-written
 * table in assets/shsys.js, which covers the commands the course leans on
 * hardest. When it lands, `man` starts serving the real thing instead. A
 * failed fetch is not an error worth reporting -- the fallback is already
 * there and the learner sees a usable page either way.
 * =========================================================================== */
(function (global) {
  'use strict';

  const DEFAULT = 'data/itn170-man.json';
  let started = false;

  /**
   * Start the fetch. Safe to call from several pages; only the first does
   * anything. Returns a promise for tests -- callers can ignore it.
   */
  /*
   * `HarborShell` is reached by bare name, never as `global.HarborShell`.
   * assets/shell.js declares it with `const` at the top level of a classic
   * script, which makes it a lexical global -- visible to every other script
   * on the page, but *not* a property of `window`. Going through `global.`
   * finds undefined, while `typeof HarborShell` says it is right there.
   */
  function shell() {
    return typeof HarborShell !== 'undefined' ? HarborShell : null;
  }

  function preload(url) {
    if (started) {
      const s = shell();
      return Promise.resolve((s && s.manPages) || null);
    }
    started = true;

    return fetch(url || DEFAULT)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        return res.json();
      })
      .then(function (pages) {
        const s = shell();
        if (s) s.manPages = pages;
        return pages;
      })
      .catch(function () {
        // Deliberately quiet. `man` still works from the built-in table, and a
        // console error here would be the only sign of a problem the learner
        // has no way to act on.
        return null;
      });
  }

  const HarborMan = { preload: preload, DEFAULT: DEFAULT };

  if (typeof module !== 'undefined' && module.exports) module.exports = HarborMan;
  else global.HarborMan = HarborMan;
})(typeof window !== 'undefined' ? window : globalThis);
