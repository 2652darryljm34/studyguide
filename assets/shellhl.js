/* ===========================================================================
 * ShellHL -- shell syntax highlighting, the counterpart to SqlHL.
 *
 *   highlight(line)   -> HTML for a read-only block (model answers, the guide)
 *   attach(textarea)  -> live highlighting as you type, via an overlay
 *   prompt(text)      -> a transcript prompt line
 *
 * Hand-rolled and offline, like the SQL one. Everything emitted goes through
 * esc() first: the editor overlay renders text the learner typed straight into
 * innerHTML, so nothing may reach it unescaped.
 * =========================================================================== */
const ShellHL = (function () {
  'use strict';

  // Words that change the shape of a line rather than naming a program.
  const KEYWORDS = new Set(('if then else elif fi for while until do done case esac ' +
    'function in select time coproc return break continue'
  ).split(' '));

  // The builtins worth colouring apart from external commands.
  const BUILTINS = new Set(('cd pwd echo printf export unset alias unalias source ' +
    'history exit logout umask jobs fg bg set test type help read eval exec trap ' +
    'shift local declare readonly wait true false'
  ).split(' '));

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function span(cls, text) {
    return '<span class="tok-' + cls + '">' + esc(text) + '</span>';
  }

  /**
   * Tokenize one command line into highlighted HTML.
   *
   * "Command position" is tracked so that the first word of a line -- and the
   * first after a pipe, a semicolon or an && -- is coloured as the command and
   * everything after it as arguments, the way a reader scans a line.
   */
  function highlight(text) {
    const src = String(text == null ? '' : text);
    let out = '';
    let i = 0;
    let atCommand = true;

    while (i < src.length) {
      const rest = src.slice(i);
      let m;

      // Comment -- only when it starts a word
      if (src[i] === '#' && (i === 0 || /[\s;|&]/.test(src[i - 1]))) {
        m = /^#[^\n]*/.exec(rest);
        out += span('comment', m[0]);
        i += m[0].length;
        continue;
      }

      // Newline resets to command position
      if (src[i] === '\n') { out += '\n'; i++; atCommand = true; continue; }

      if ((m = /^[ \t]+/.exec(rest))) { out += m[0]; i += m[0].length; continue; }

      // Single-quoted string: no expansion happens inside one
      if (src[i] === "'") {
        m = /^'[^']*'?/.exec(rest);
        out += span('string', m[0]);
        i += m[0].length;
        atCommand = false;
        continue;
      }

      // Double-quoted string: variables inside it still expand, so mark them
      if (src[i] === '"') {
        m = /^"(?:\\.|[^"\\])*"?/.exec(rest);
        const body = m[0];
        let inner = '';
        let k = 0;
        while (k < body.length) {
          const varMatch = /^\$(?:\{[^}]*\}?|[A-Za-z_][A-Za-z0-9_]*|[?$#@*0-9])/
            .exec(body.slice(k));
          if (varMatch) {
            inner += span('var', varMatch[0]);
            k += varMatch[0].length;
            continue;
          }
          const chunk = /^(?:\\.|[^$\\])+/.exec(body.slice(k));
          if (chunk) { inner += esc(chunk[0]); k += chunk[0].length; continue; }
          inner += esc(body[k]);
          k++;
        }
        out += '<span class="tok-string">' + inner + '</span>';
        i += body.length;
        atCommand = false;
        continue;
      }

      // Variables and command substitution
      if ((m = /^\$\((?:[^()]|\([^()]*\))*\)?/.exec(rest)) ||
          (m = /^`[^`]*`?/.exec(rest))) {
        out += span('subst', m[0]);
        i += m[0].length;
        atCommand = false;
        continue;
      }
      if ((m = /^\$(?:\{[^}]*\}?|[A-Za-z_][A-Za-z0-9_]*|[?$#@*0-9])/.exec(rest))) {
        out += span('var', m[0]);
        i += m[0].length;
        atCommand = false;
        continue;
      }

      // Pipes, lists and redirections -- after one of these a command starts again
      if ((m = /^(?:\|\||&&|;;|\||;|&(?!>))/.exec(rest))) {
        out += span('pipe', m[0]);
        i += m[0].length;
        atCommand = true;
        continue;
      }
      if ((m = /^(?:\d*>>|&>>|&>|\d*>&\d|\d*>|<<-?|<)/.exec(rest))) {
        out += span('redir', m[0]);
        i += m[0].length;
        atCommand = false;
        continue;
      }

      // An option: -l, --recursive, -name
      if ((m = /^-{1,2}[A-Za-z0-9][A-Za-z0-9_-]*(?==|\b)/.exec(rest)) && !atCommand) {
        out += span('option', m[0]);
        i += m[0].length;
        continue;
      }

      // Glob characters read as operators, not as part of a name
      if ((m = /^[*?]/.exec(rest))) {
        out += span('glob', m[0]);
        i += m[0].length;
        continue;
      }
      if ((m = /^\[[^\]]*\]/.exec(rest)) && !atCommand) {
        out += span('glob', m[0]);
        i += m[0].length;
        continue;
      }
      if ((m = /^\{[^{}]*\}/.exec(rest)) && /[,.]/.test(m[0])) {
        out += span('glob', m[0]);
        i += m[0].length;
        continue;
      }

      // A bare word
      if ((m = /^[^\s'"$|&;<>*?{}()`]+/.exec(rest))) {
        const word = m[0];
        if (KEYWORDS.has(word)) out += span('keyword', word);
        else if (atCommand) {
          out += span(BUILTINS.has(word) ? 'builtin' : 'command', word);
          atCommand = false;
        } else if (/^\//.test(word) || /^~/.test(word) || /^\.\.?\//.test(word)) {
          out += span('path', word);
        } else if (/^\d+$/.test(word)) {
          out += span('number', word);
        } else {
          out += esc(word);
        }
        i += word.length;
        continue;
      }

      out += esc(src[i]);
      i++;
    }

    return out;
  }

  /** Wrap a command line in a highlighted <pre>, for read-only display. */
  function block(text, extraClass) {
    return '<pre class="model-answer shell-hl' + (extraClass ? ' ' + extraClass : '') +
      '"><code>' + highlight(text) + '</code></pre>';
  }

  /* ---------- live editor ----------
   * The same overlay technique SqlHL uses: a <pre> behind the textarea holding
   * the highlighted copy, the textarea's own text transparent so only its caret
   * and selection show. Both carry identical metrics in CSS or the characters
   * drift apart.                                                              */

  function paint(ta) {
    const pre = ta._shellhl;
    if (!pre) return;
    pre.innerHTML = highlight(ta.value) + '\n';
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  }

  function attach(ta) {
    if (!ta || ta._shellhl) return ta;

    const wrap = document.createElement('div');
    wrap.className = 'sql-editor';
    ta.parentNode.insertBefore(wrap, ta);

    const pre = document.createElement('pre');
    pre.className = 'sql-editor-hl';
    pre.setAttribute('aria-hidden', 'true');

    wrap.appendChild(pre);
    wrap.appendChild(ta);
    ta.classList.add('sql-input-live');
    ta._shellhl = pre;

    ta.addEventListener('input', function () { paint(ta); });
    ta.addEventListener('scroll', function () {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    });

    paint(ta);
    return ta;
  }

  function refresh(ta) { paint(ta); }

  return {
    highlight: highlight, block: block, attach: attach, refresh: refresh, esc: esc
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ShellHL;
