/* ===========================================================================
 * GNU nano, as far as a browser can honestly take it.
 *
 * The shell hands back an `editor` state -- a path and the file's current
 * contents -- and this draws the editor over the terminal pane: title bar,
 * buffer, status line, and the two rows of shortcut hints. Writing out goes
 * back through the shell's saveBuffer(), so the machine's permissions decide
 * whether the save succeeds; the editor never writes behind them.
 *
 * The buffer is a <textarea>. That buys a real caret, selection, wrapping and
 * every arrow and Home/End key for free, which is worth more to a learner than
 * a hand-rolled cursor would be.
 *
 * One honest limitation: Chrome will not let a page intercept Ctrl+W, so the
 * shortcut bar is made of buttons you can click. Everything else is bound to
 * its real keystroke as well.
 * =========================================================================== */
(function (global) {
  'use strict';

  const VERSION = '5.6.1';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* The bar along the bottom. `key` is what nano prints; `combo` is what we
   * can actually listen for, and null where the browser keeps the keystroke. */
  const KEYS = [
    [
      { key: '^G', label: 'Get Help', combo: 'g', action: 'help' },
      { key: '^O', label: 'Write Out', combo: 'o', action: 'writeout' },
      { key: '^W', label: 'Where Is', combo: null, action: 'search' },
      { key: '^K', label: 'Cut', combo: 'k', action: 'cut' }
    ],
    [
      { key: '^X', label: 'Exit', combo: 'x', action: 'exit' },
      { key: '^R', label: 'Read File', combo: 'r', action: 'readfile' },
      { key: '^\\', label: 'Replace', combo: null, action: 'replace' },
      { key: '^U', label: 'Paste', combo: 'u', action: 'paste' }
    ]
  ];

  const HELP = [
    'nano keeps its commands on the two rows at the bottom of the screen. ^ means Ctrl.',
    '',
    '  ^O   Write Out   save the buffer; it asks for the filename, Enter confirms',
    '  ^X   Exit        leave; if the buffer changed it asks whether to save first',
    '  ^K   Cut         cut the current line into the cutbuffer',
    '  ^U   Paste       paste the cutbuffer back in',
    '  ^W   Where Is    search forward for text',
    '  ^\\   Replace     search and replace',
    '  ^R   Read File   insert another file at the cursor',
    '  ^C   Cur Pos     report the line, column and character you are on',
    '  ^A / ^E          jump to the start / end of the line',
    '',
    'Your browser keeps Ctrl+W for itself, so use the ^W button below for Where Is.',
    'Everything else answers to its real keystroke as well as its button.'
  ].join('\n');

  /**
   * Open the editor.
   *
   *   mount   the element to draw into (the terminal pane)
   *   shell   the HarborShell -- saveBuffer() runs as its user
   *   file    the `editor` object the shell returned
   *   onClose called with a one-line summary for the terminal transcript
   */
  function open(opts) {
    const mount = opts.mount;
    const sh = opts.shell;
    const file = opts.file;
    const onClose = opts.onClose || function () {};

    const original = file.content || '';
    let cutBuffer = '';
    let closed = false;

    /* ---------- chrome ---------- */

    const root = document.createElement('div');
    root.className = 'nano';
    root.innerHTML =
      '<div class="nano-title">' +
        '<span class="nano-ver">GNU nano ' + VERSION + '</span>' +
        '<span class="nano-file"></span>' +
        '<span class="nano-mod"></span>' +
      '</div>' +
      '<div class="nano-body">' +
        '<textarea class="nano-text" spellcheck="false" autocapitalize="off" ' +
          'autocomplete="off" autocorrect="off" wrap="off"></textarea>' +
        '<pre class="nano-help" hidden>' + esc(HELP) + '</pre>' +
      '</div>' +
      '<div class="nano-status"></div>' +
      '<form class="nano-ask" hidden>' +
        '<label class="nano-ask-label"></label>' +
        '<input class="nano-ask-input" type="text" spellcheck="false" autocomplete="off">' +
      '</form>' +
      '<div class="nano-keys"></div>';

    const textEl = root.querySelector('.nano-text');
    const helpEl = root.querySelector('.nano-help');
    const fileEl = root.querySelector('.nano-file');
    const modEl = root.querySelector('.nano-mod');
    const statusEl = root.querySelector('.nano-status');
    const askEl = root.querySelector('.nano-ask');
    const askLabel = root.querySelector('.nano-ask-label');
    const askInput = root.querySelector('.nano-ask-input');
    const keysEl = root.querySelector('.nano-keys');

    KEYS.forEach(function (row) {
      const rowEl = document.createElement('div');
      rowEl.className = 'nano-keyrow';
      row.forEach(function (k) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nano-key';
        b.innerHTML = '<span class="nano-key-combo">' + esc(k.key) + '</span> ' + esc(k.label);
        b.title = k.combo ? 'Ctrl+' + k.combo.toUpperCase() : 'Click -- the browser keeps this key';
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () { dispatch(k.action); });
        rowEl.appendChild(b);
      });
      keysEl.appendChild(rowEl);
    });

    textEl.value = original;
    fileEl.textContent = 'File: ' + (file.label || 'New Buffer');
    mount.appendChild(root);

    /* ---------- state ---------- */

    // What "Modified" compares against. Saving moves it, so a buffer written
    // out and then left alone stops calling itself modified.
    let baseline = original;
    function refreshMod() { modEl.textContent = textEl.value !== baseline ? 'Modified' : ''; }
    function savedAs(text) { baseline = text; refreshMod(); }

    function status(msg) {
      statusEl.textContent = msg ? '[ ' + msg + ' ]' : '';
    }

    function focusText() {
      helpEl.hidden = true;
      textEl.focus();
    }

    /** nano's ^C: where the caret is, in lines, columns and characters. */
    function curPos() {
      const text = textEl.value;
      const at = textEl.selectionStart;
      const before = text.slice(0, at);
      const line = before.split('\n').length;
      const lines = text === '' ? 1 : text.split('\n').length;
      const col = at - (before.lastIndexOf('\n') + 1) + 1;
      const pct = function (a, b) { return b ? Math.round((a / b) * 100) : 0; };
      status('line ' + line + '/' + lines + ' (' + pct(line, lines) + '%), ' +
        'col ' + col + ', char ' + at + '/' + text.length + ' (' + pct(at, text.length) + '%)');
    }

    /* ---------- the status-line prompt ---------- */

    let askHandler = null;

    function ask(label, value, handler) {
      askHandler = handler;
      askLabel.textContent = label;
      askInput.value = value || '';
      askEl.hidden = false;
      statusEl.hidden = true;
      askInput.focus();
      askInput.select();
    }

    function closeAsk() {
      askHandler = null;
      askEl.hidden = true;
      statusEl.hidden = false;
      focusText();
    }

    askEl.addEventListener('submit', function (e) {
      e.preventDefault();
      const handler = askHandler;
      const value = askInput.value;
      closeAsk();
      if (handler) handler(value);
    });

    askInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        closeAsk();
        status('Cancelled');
      }
    });

    /* ---------- actions ---------- */

    function writeOut(then) {
      ask('File Name to Write: ', file.path || '', function (name) {
        if (!name.trim()) { status('Cancelled'); return; }
        const res = sh.saveBuffer(name.trim(), textEl.value);
        if (!res.ok) {
          status('Error writing ' + name.trim() + ': ' +
            res.error.replace(/^.*: /, ''));
          return;
        }
        file.path = name.trim();
        file.label = file.path;
        fileEl.textContent = 'File: ' + file.path;
        // Saving makes the buffer the new baseline, so [ Modified ] clears.
        savedAs(textEl.value);
        status('Wrote ' + res.lines + (res.lines === 1 ? ' line' : ' lines'));
        if (then) then();
      });
    }

    function exit() {
      if (textEl.value === baseline) return finish();
      ask('Save modified buffer? (Answering "No" will DISCARD changes)  Y/N ', '',
        function (answer) {
          const a = answer.trim().toLowerCase();
          if (a === 'n' || a === 'no') return finish();
          if (a === 'y' || a === 'yes') return writeOut(finish);
          status('Cancelled');
        });
    }

    function cut() {
      const text = textEl.value;
      const at = textEl.selectionStart;
      const start = text.lastIndexOf('\n', at - 1) + 1;
      let end = text.indexOf('\n', at);
      if (end === -1) end = text.length; else end += 1;
      cutBuffer = text.slice(start, end);
      textEl.value = text.slice(0, start) + text.slice(end);
      textEl.selectionStart = textEl.selectionEnd = start;
      refreshMod();
      status('Cut 1 line');
    }

    function paste() {
      if (!cutBuffer) { status('Cutbuffer is empty'); return; }
      const text = textEl.value;
      const at = textEl.selectionStart;
      const start = text.lastIndexOf('\n', at - 1) + 1;
      textEl.value = text.slice(0, start) + cutBuffer + text.slice(start);
      textEl.selectionStart = textEl.selectionEnd = start + cutBuffer.length;
      refreshMod();
      status('Pasted 1 line');
    }

    let lastSearch = '';
    function search() {
      ask('Search: ', lastSearch, function (needle) {
        if (!needle) { status('Cancelled'); return; }
        lastSearch = needle;
        const text = textEl.value;
        const from = textEl.selectionEnd;
        let at = text.indexOf(needle, from);
        if (at === -1) at = text.indexOf(needle);     // nano wraps round
        if (at === -1) { status('"' + needle + '" not found'); return; }
        textEl.focus();
        textEl.setSelectionRange(at, at + needle.length);
        scrollCaretIntoView();
      });
    }

    function replace() {
      ask('Search (to replace): ', lastSearch, function (needle) {
        if (!needle) { status('Cancelled'); return; }
        lastSearch = needle;
        ask('Replace with: ', '', function (with_) {
          const before = textEl.value;
          let count = 0;
          const after = before.split(needle).join(with_);
          if (before !== after) count = before.split(needle).length - 1;
          if (!count) { status('"' + needle + '" not found'); return; }
          textEl.value = after;
          refreshMod();
          status('Replaced ' + count + (count === 1 ? ' occurrence' : ' occurrences'));
        });
      });
    }

    function readFile() {
      ask('File to insert: ', '', function (name) {
        if (!name.trim()) { status('Cancelled'); return; }
        let found;
        try {
          found = sh.resolve(name.trim());
        } catch (err) {
          status('Error reading ' + name.trim() + ': No such file or directory');
          return;
        }
        if (found.node.type === 'dir') { status(name.trim() + ' is a directory'); return; }
        if (!sh.m.canRead(found.node, sh.user)) {
          status('Error reading ' + name.trim() + ': Permission denied');
          return;
        }
        const body = sh.m.read(found.node);
        const at = textEl.selectionStart;
        textEl.value = textEl.value.slice(0, at) + body + textEl.value.slice(at);
        textEl.selectionStart = textEl.selectionEnd = at + body.length;
        refreshMod();
        const n = body === '' ? 0 : body.replace(/\n$/, '').split('\n').length;
        status('Read ' + n + (n === 1 ? ' line' : ' lines'));
      });
    }

    function toggleHelp() {
      helpEl.hidden = !helpEl.hidden;
      if (helpEl.hidden) textEl.focus();
    }

    function scrollCaretIntoView() {
      // A textarea scrolls its own caret into view on focus changes; nudging
      // it keeps a search hit from landing just off the bottom edge.
      const before = textEl.value.slice(0, textEl.selectionStart).split('\n').length;
      const lineHeight = parseFloat(getComputedStyle(textEl).lineHeight) || 18;
      const target = (before - 3) * lineHeight;
      if (target < textEl.scrollTop || target > textEl.scrollTop + textEl.clientHeight) {
        textEl.scrollTop = Math.max(0, target);
      }
    }

    function dispatch(action) {
      if (closed) return;
      ({
        help: toggleHelp,
        writeout: function () { writeOut(null); },
        search: search,
        replace: replace,
        readfile: readFile,
        cut: cut,
        paste: paste,
        curpos: curPos,
        exit: exit
      }[action] || function () {})();
    }

    function finish() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      root.remove();
      onClose({ path: file.path, saved: baseline !== original });
    }

    /* ---------- keys ---------- */

    const BY_COMBO = {};
    KEYS.forEach(function (row) {
      row.forEach(function (k) { if (k.combo) BY_COMBO[k.combo] = k.action; });
    });

    function onKey(e) {
      if (closed || !root.isConnected) return;
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key.toLowerCase();

      if (key === 'a' || key === 'e') {
        // nano's line-start / line-end, which the textarea maps to Home/End.
        e.preventDefault();
        const text = textEl.value;
        const at = textEl.selectionStart;
        const start = text.lastIndexOf('\n', at - 1) + 1;
        let end = text.indexOf('\n', at);
        if (end === -1) end = text.length;
        const to = key === 'a' ? start : end;
        textEl.setSelectionRange(to, to);
        textEl.focus();
        return;
      }

      if (key === 'c' && textEl.selectionStart === textEl.selectionEnd) {
        e.preventDefault();          // ^C is Cur Pos, unless you are copying
        curPos();
        return;
      }

      if (BY_COMBO[key]) {
        e.preventDefault();
        dispatch(BY_COMBO[key]);
      }
    }

    document.addEventListener('keydown', onKey, true);
    textEl.addEventListener('input', refreshMod);

    /* ---------- open ---------- */

    refreshMod();
    if (!file.exists) status('New File');
    else {
      const n = original === '' ? 0 : original.replace(/\n$/, '').split('\n').length;
      status('Read ' + n + (n === 1 ? ' line' : ' lines') +
        (file.writable === false ? ' -- File is unwritable' : ''));
    }
    textEl.focus();
    textEl.setSelectionRange(0, 0);

    return { close: finish, element: root };
  }

  const HarborNano = { open: open, VERSION: VERSION };

  if (typeof module !== 'undefined' && module.exports) module.exports = HarborNano;
  else global.HarborNano = HarborNano;
})(typeof window !== 'undefined' ? window : globalThis);
