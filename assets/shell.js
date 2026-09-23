/* ===========================================================================
 * HarborShell -- the Bash layer over HarborBox.
 *
 * Parses and runs a command line the way the course teaches it: quoting,
 * brace/tilde/variable/command expansion, globbing, redirection, pipelines,
 * ;/&&/||, heredocs, background jobs, and sudo/su. Commands register into one
 * table; the file/navigation set lives here, text processing in shtext.js and
 * administration in shadmin.js.
 *
 * It also grades. A learner's command line and the reference command line each
 * run on their own machine, and either the two *outputs* are compared, or --
 * when the question changes the system rather than printing something -- a
 * `verify` command reads both machines back and those readings are compared.
 * So `chmod 640` and `chmod u=rw,g=r,o=` both score, and a wrong answer is told
 * how it differs rather than simply marked wrong.
 * =========================================================================== */
const HarborShell = (function () {
  'use strict';

  const MAX_LOOP = 40;

  /* =========================================================================
   * The command table
   * ======================================================================= */

  const COMMANDS = Object.create(null);
  const BUILTINS = Object.create(null);

  /** Register a command implementation: fn(ctx) returns an exit status. */
  function register(names, fn, opts) {
    String(names).split(' ').forEach(function (n) {
      COMMANDS[n] = { run: fn, opts: opts || {} };
    });
  }

  function registerBuiltin(names, fn) {
    String(names).split(' ').forEach(function (n) {
      BUILTINS[n] = { run: fn, opts: { builtin: true } };
    });
  }

  /* =========================================================================
   * Tokenizing
   *
   * A word is kept as a list of {s, q} pieces so that later stages can tell
   * quoted text from bare text -- `ls "*.txt"` must not glob, and
   * `echo "$HOME"` must not word-split.
   * ======================================================================= */

  function ShellSyntaxError(message) {
    this.message = message;
    this.isSyntax = true;
  }

  const REDIR_RE = /^(?:(\d*)>>|(\d*)>&(\d+|-)|(\d*)>\|?|(\d*)<<-?|(\d*)<&(\d+|-)|(\d*)<|&>>|&>)/;

  /**
   * Split a line into tokens. Returns a list of
   *   {type:'word', parts:[{s,q}], raw}
   *   {type:'op',   value:'|' '||' '&&' ';' '&' '(' ')'}
   *   {type:'redir', fd, op, target:word, hereEnd, hereStrip}
   * Throws ShellSyntaxError on an unterminated quote, which the terminal turns
   * into a continuation prompt rather than an error.
   */
  function tokenize(line) {
    const tokens = [];
    let i = 0;
    const n = line.length;

    while (i < n) {
      const c = line[i];

      if (c === ' ' || c === '\t') { i++; continue; }

      if (c === '\n') { tokens.push({ type: 'op', value: ';' }); i++; continue; }

      if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) break;   // comment to end of line

      // Operators
      if (c === '|' || c === '&' || c === ';') {
        const two = line.substr(i, 2);
        if (two === '||' || two === '&&' || two === ';;') {
          tokens.push({ type: 'op', value: two }); i += 2; continue;
        }
        if (two === '|&') { tokens.push({ type: 'op', value: '|&' }); i += 2; continue; }
        if (c === '&' && line[i + 1] === '>') {
          // &> and &>> are redirections, handled below.
        } else {
          tokens.push({ type: 'op', value: c }); i++; continue;
        }
      }

      // Redirections -- including a leading file descriptor number
      const ahead = line.slice(i);
      const rm = REDIR_RE.exec(ahead);
      if (rm && (c === '>' || c === '<' || c === '&' || /^\d+[<>]/.test(ahead))) {
        const op = rm[0];
        i += op.length;
        const redir = { type: 'redir', op: op };
        tokens.push(redir);
        continue;
      }

      // A word
      const parts = [];
      let raw = '';
      let cur = '';
      let curQ = 'none';

      function flush() {
        if (cur !== '') { parts.push({ s: cur, q: curQ }); cur = ''; }
      }

      while (i < n) {
        const ch = line[i];
        if (ch === ' ' || ch === '\t' || ch === '\n') break;
        if (curQ === 'none' && '|&;<>'.indexOf(ch) !== -1) break;

        if (ch === '\\') {
          if (i + 1 >= n) throw new ShellSyntaxError('backslash');
          flush();
          parts.push({ s: line[i + 1], q: 'single' });
          raw += ch + line[i + 1];
          i += 2;
          continue;
        }

        if (ch === "'") {
          const end = line.indexOf("'", i + 1);
          if (end === -1) throw new ShellSyntaxError("'");
          flush();
          parts.push({ s: line.slice(i + 1, end), q: 'single' });
          raw += line.slice(i, end + 1);
          i = end + 1;
          continue;
        }

        if (ch === '"') {
          // Inside double quotes, \$ \` \" and \\ lose their special meaning.
          // An escaped character has to be kept apart from the rest, or the
          // expansion stage would treat "\$NF" as the variable NF.
          let j = i + 1;
          let body = '';
          let closed = false;
          const pieces = [];
          while (j < n) {
            if (line[j] === '\\' && j + 1 < n && '"\\$`'.indexOf(line[j + 1]) !== -1) {
              if (body !== '') { pieces.push({ s: body, q: 'double' }); body = ''; }
              pieces.push({ s: line[j + 1], q: 'single' });
              j += 2;
              continue;
            }
            if (line[j] === '"') { closed = true; break; }
            body += line[j]; j++;
          }
          if (!closed) throw new ShellSyntaxError('"');
          if (body !== '' || !pieces.length) pieces.push({ s: body, q: 'double' });
          flush();
          pieces.forEach(function (piece) { parts.push(piece); });
          raw += line.slice(i, j + 1);
          i = j + 1;
          continue;
        }

        // $(...) keeps its own nesting; the expansion stage runs it.
        if (ch === '$' && line[i + 1] === '(') {
          let depth = 1, j = i + 2;
          while (j < n && depth > 0) {
            if (line[j] === '(') depth++;
            else if (line[j] === ')') depth--;
            if (depth > 0) j++;
          }
          if (depth > 0) throw new ShellSyntaxError('$(');
          flush();
          parts.push({ s: line.slice(i, j + 1), q: 'none' });
          raw += line.slice(i, j + 1);
          i = j + 1;
          continue;
        }

        if (ch === '`') {
          const end = line.indexOf('`', i + 1);
          if (end === -1) throw new ShellSyntaxError('`');
          flush();
          parts.push({ s: '$(' + line.slice(i + 1, end) + ')', q: 'none' });
          raw += line.slice(i, end + 1);
          i = end + 1;
          continue;
        }

        if (curQ !== 'none') { flush(); curQ = 'none'; }
        cur += ch;
        raw += ch;
        i++;
      }

      flush();
      if (parts.length === 0) parts.push({ s: '', q: 'double' });
      tokens.push({ type: 'word', parts: parts, raw: raw });
    }

    return tokens;
  }

  /* =========================================================================
   * Parsing into commands
   * ======================================================================= */

  function parse(tokens) {
    const lists = [];            // [{ pipeline, joiner, background }]
    let pipeline = [];
    let cmd = null;
    let joiner = ';';

    function endCmd() {
      if (cmd && (cmd.words.length || cmd.redirs.length)) pipeline.push(cmd);
      cmd = null;
    }
    function endPipeline(next, background) {
      endCmd();
      if (pipeline.length) {
        lists.push({ pipeline: pipeline, joiner: joiner, background: !!background });
      }
      pipeline = [];
      joiner = next || ';';
    }

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'op') {
        if (t.value === '|' || t.value === '|&') {
          endCmd();
          if (t.value === '|&' && pipeline.length) pipeline[pipeline.length - 1].mergeErr = true;
          continue;
        }
        if (t.value === '&&' || t.value === '||') { endPipeline(t.value); continue; }
        if (t.value === ';') { endPipeline(';'); continue; }
        if (t.value === '&') { endPipeline(';', true); continue; }
        continue;
      }
      if (!cmd) cmd = { words: [], redirs: [], assignments: [] };
      if (t.type === 'redir') {
        const target = tokens[i + 1];
        if (/&(\d+|-)$/.test(t.op)) {
          cmd.redirs.push({ op: t.op, dup: true });
          continue;
        }
        if (!target || target.type !== 'word') throw new ShellSyntaxError('newline');
        i++;
        cmd.redirs.push({ op: t.op, word: target });
        continue;
      }
      cmd.words.push(t);
    }
    endPipeline(';');
    return lists;
  }

  /* =========================================================================
   * Expansion
   * ======================================================================= */

  /** Brace expansion runs on the raw token text, skipping quoted spans. */
  function braceExpand(word) {
    const raw = word.parts.map(function (p) {
      if (p.q === 'none') return p.s;
      return p.s.replace(/[{},]/g, function (c) { return '\u0000' + c; });   // shield quoted braces
    }).join('');

    const results = expandBracesText(raw);
    if (results.length === 1 && results[0] === raw) return [word];

    return results.map(function (text) {
      return { type: 'word', parts: rebuildParts(word, text), raw: text };
    });
  }

  /**
   * Rebuild {s,q} pieces for a brace-expanded string. Quoting information for
   * the expanded product is approximated by the original word's first piece,
   * which is what matters in practice: `touch file{1,2}.txt` is unquoted
   * throughout, and a quoted brace was shielded above.
   */
  function rebuildParts(word, text) {
    const allQuoted = word.parts.every(function (p) { return p.q !== 'none'; });
    return [{ s: text.replace(/\u0000/g, ''), q: allQuoted ? 'single' : 'none' }];
  }

  function expandBracesText(str) {
    const open = findBrace(str);
    if (!open) return [str];

    const pre = str.slice(0, open.start);
    const post = str.slice(open.end + 1);
    const body = str.slice(open.start + 1, open.end);

    let items;
    const range = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(body);
    const alpha = /^([A-Za-z])\.\.([A-Za-z])$/.exec(body);
    if (range) {
      const from = +range[1], to = +range[2];
      const step = Math.abs(+(range[3] || 1)) || 1;
      // {01..12} keeps its zero padding, to the width of the wider endpoint.
      const padded = /^-?0\d/.test(range[1]) || /^-?0\d/.test(range[2]);
      const width = Math.max(range[1].length, range[2].length);
      const fmt = function (v) {
        const s = String(Math.abs(v));
        const sign = v < 0 ? '-' : '';
        if (!padded) return sign + s;
        return sign + ('0'.repeat(Math.max(0, width - sign.length - s.length)) + s);
      };
      items = [];
      if (from <= to) for (let v = from; v <= to; v += step) items.push(fmt(v));
      else for (let v = from; v >= to; v -= step) items.push(fmt(v));
    } else if (alpha) {
      const a = alpha[1].charCodeAt(0), b = alpha[2].charCodeAt(0);
      items = [];
      if (a <= b) for (let v = a; v <= b; v++) items.push(String.fromCharCode(v));
      else for (let v = a; v >= b; v--) items.push(String.fromCharCode(v));
    } else {
      items = splitTopLevel(body);
      if (items.length < 2) return [str.slice(0, open.start) + '{' + body + '}' + post];
    }

    const out = [];
    items.forEach(function (item) {
      expandBracesText(pre + item + post).forEach(function (s) { out.push(s); });
    });
    return out;
  }

  function findBrace(str) {
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '\u0000') { i++; continue; }
      if (str[i] === '{') {
        let depth = 1;
        for (let j = i + 1; j < str.length; j++) {
          if (str[j] === '\u0000') { j++; continue; }
          if (str[j] === '{') depth++;
          else if (str[j] === '}') {
            depth--;
            if (depth === 0) return { start: i, end: j };
          }
        }
        return null;
      }
    }
    return null;
  }

  function splitTopLevel(body) {
    const out = [];
    let depth = 0, cur = '';
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === '\u0000') { cur += body[i + 1]; i++; continue; }
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }

  /* =========================================================================
   * The Shell
   * ======================================================================= */

  function Shell(box, opts) {
    opts = opts || {};
    this.box = box;
    this.m = box.machine;
    this.interactive = opts.interactive !== false;
    // A full-screen editor needs a page that can draw one. Off by default, so
    // a grading run or a question's terminal still gets nano's honest refusal
    // rather than a state nothing on the page knows how to render.
    this.editorEnabled = !!opts.editor;
    this.userStack = [];
    this.user = this.m.userByName(opts.user || 'student') || this.m.userByName('root');
    this.cwd = this.user.home;
    this.umask = parseInt(this.m.image.umask || '0022', 8);
    this.status = 0;
    this.history = [];
    this.aliases = { ll: 'ls -l', la: 'ls -A', 'l.': 'ls -d .*' };
    this.sudoAuthed = false;
    this.depth = 0;
    this.pending = null;          // an interactive prompt the terminal must satisfy
    this.env = {
      HOME: this.user.home,
      USER: this.user.name,
      LOGNAME: this.user.name,
      SHELL: this.user.shell,
      PATH: '/home/' + this.user.name + '/.local/bin:/home/' + this.user.name +
            '/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin',
      PWD: this.cwd,
      OLDPWD: '',
      HOSTNAME: this.m.hostname,
      LANG: 'en_US.UTF-8',
      PS1: '[\\u@\\h \\W]\\$ ',
      HISTSIZE: '1000',
      TERM: 'xterm-256color'
    };
  }

  /* ---------- prompt ---------- */

  Shell.prototype.shortCwd = function () {
    if (this.cwd === this.user.home) return '~';
    if (this.cwd.indexOf(this.user.home + '/') === 0) {
      return '~' + this.cwd.slice(this.user.home.length);
    }
    if (this.cwd === '/') return '/';
    return this.cwd.replace(/^.*\//, '') || '/';
  };

  Shell.prototype.prompt = function () {
    return '[' + this.user.name + '@' + this.m.shortHostname + ' ' + this.shortCwd() + ']' +
      (this.user.uid === 0 ? '#' : '$') + ' ';
  };

  /* ---------- path helpers ---------- */

  Shell.prototype.abs = function (p) { return this.m.absolute(p, this.cwd); };

  /**
   * Put the shell in directory `p` without running `cd` -- how a question with
   * a fixed starting directory begins. The tilde has to be expanded here: the
   * shell normally does that during expansion, which never runs for a path
   * that arrives from a question file rather than from a typed line.
   */
  Shell.prototype.setCwd = function (p) {
    let s = String(p);
    if (s.charAt(0) === '~') s = this.expandTilde(s);
    this.cwd = this.m.absolute(s, this.user.home);
    this.env.PWD = this.cwd;
    return this.cwd;
  };

  Shell.prototype.resolve = function (p, opts) {
    return this.m.resolve(p, Object.assign({ cwd: this.cwd, user: this.user }, opts || {}));
  };

  /* =========================================================================
   * Expansion, continued -- these need the shell's variables and cwd
   * ======================================================================= */

  /** $VAR, ${VAR}, $?, $$, $0, and $(command). */
  Shell.prototype.expandDollars = function (text, quoted) {
    const self = this;
    let out = '';
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (c !== '$') { out += c; i++; continue; }

      if (text[i + 1] === '(') {
        let depth = 1, j = i + 2;
        while (j < text.length && depth > 0) {
          if (text[j] === '(') depth++;
          else if (text[j] === ')') depth--;
          if (depth > 0) j++;
        }
        const inner = text.slice(i + 2, j);
        const sub = self.runNested(inner);
        out += sub.replace(/\n+$/, '');
        i = j + 1;
        continue;
      }

      if (text[i + 1] === '{') {
        const end = text.indexOf('}', i + 2);
        if (end === -1) { out += c; i++; continue; }
        out += this.lookupVar(text.slice(i + 2, end));
        i = end + 1;
        continue;
      }

      const m = /^\$([A-Za-z_][A-Za-z0-9_]*|\?|\$|#|0)/.exec(text.slice(i));
      if (m) { out += this.lookupVar(m[1]); i += m[0].length; continue; }

      out += c; i++;
    }
    return out;
  };

  Shell.prototype.lookupVar = function (name) {
    if (name === '?') return String(this.status);
    if (name === '$') return '2423';
    if (name === '0') return 'bash';
    if (name === '#') return '0';
    if (name === 'UID') return String(this.user.uid);
    if (name === 'PWD') return this.cwd;
    if (name === 'RANDOM') return '17';
    const v = this.env[name];
    return v === undefined ? '' : v;
  };

  /**
   * Expand one word all the way to a list of arguments.
   * Order follows bash: brace, tilde, parameter/command, split, glob, unquote.
   */
  Shell.prototype.expandWord = function (word, opts) {
    const self = this;
    opts = opts || {};
    const out = [];

    braceExpand(word).forEach(function (w) {
      // Build the expanded text plus a mask marking which characters were
      // quoted, so globbing only sees the bare ones.
      let text = '';
      let mask = [];
      let fieldSplit = [];

      w.parts.forEach(function (part, idx) {
        if (part.q === 'single') {
          text += part.s;
          for (let k = 0; k < part.s.length; k++) mask.push(true);
          return;
        }
        let s = part.s;
        if (part.q === 'none' && idx === 0 && s.charAt(0) === '~') {
          s = self.expandTilde(s);
        }
        const expanded = self.expandDollars(s, part.q === 'double');
        if (part.q === 'double') {
          text += expanded;
          for (let k = 0; k < expanded.length; k++) mask.push(true);
        } else {
          // An unquoted expansion result is subject to word splitting; mark
          // the characters that came from the original text as unsplittable.
          const before = text.length;
          text += expanded;
          for (let k = 0; k < expanded.length; k++) mask.push(false);
          if (expanded !== s) fieldSplit.push([before, text.length]);
        }
      });

      const fields = self.splitFields(text, mask, fieldSplit);
      fields.forEach(function (field) {
        if (opts.noGlob) { out.push(field.text); return; }
        const globbed = self.glob(field.text, field.mask);
        globbed.forEach(function (g) { out.push(g); });
      });
    });

    return out;
  };

  Shell.prototype.expandTilde = function (s) {
    if (s === '~' || s.charAt(1) === '/') return this.user.home + s.slice(1);
    if (s.charAt(1) === '+') return this.cwd + s.slice(2);
    if (s.charAt(1) === '-') return (this.env.OLDPWD || this.cwd) + s.slice(2);
    const m = /^~([A-Za-z0-9_.-]+)(.*)$/.exec(s);
    if (m) {
      const u = this.m.userByName(m[1]);
      if (u) return u.home + m[2];
    }
    return s;
  };

  /** Word splitting: only inside the spans that came from an expansion. */
  Shell.prototype.splitFields = function (text, mask, spans) {
    if (!spans.length) return [{ text: text, mask: mask }];
    const fields = [];
    let curText = '', curMask = [];
    const inSpan = function (i) {
      return spans.some(function (s) { return i >= s[0] && i < s[1]; });
    };
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i]) && inSpan(i) && !mask[i]) {
        if (curText !== '') { fields.push({ text: curText, mask: curMask }); }
        curText = ''; curMask = [];
        continue;
      }
      curText += text[i];
      curMask.push(mask[i]);
    }
    if (curText !== '' || fields.length === 0) fields.push({ text: curText, mask: curMask });
    return fields;
  };

  /* ---------- globbing ---------- */

  function hasGlobChars(text, mask) {
    for (let i = 0; i < text.length; i++) {
      if (!mask[i] && '*?['.indexOf(text[i]) !== -1) return true;
    }
    return false;
  }

  /** Turn one path component into a regex, honouring which chars were quoted. */
  function globRegex(component, mask, offset) {
    let re = '^';
    for (let i = 0; i < component.length; i++) {
      const c = component[i];
      const quoted = mask[offset + i];
      if (!quoted && c === '*') { re += '[^/]*'; continue; }
      if (!quoted && c === '?') { re += '[^/]'; continue; }
      if (!quoted && c === '[') {
        let j = i + 1;
        let neg = false;
        if (component[j] === '!' || component[j] === '^') { neg = true; j++; }
        let body = '';
        if (component[j] === ']') { body += '\\]'; j++; }
        while (j < component.length && component[j] !== ']') {
          const ch = component[j];
          body += (ch === '\\' ? '\\\\' : ch);
          j++;
        }
        if (j < component.length) {
          re += '[' + (neg ? '^' : '') + body + ']';
          i = j;
          continue;
        }
      }
      re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(re + '$');
  }

  Shell.prototype.glob = function (text, mask) {
    const self = this;
    if (!hasGlobChars(text, mask)) return [text];

    const absolute = text.charAt(0) === '/';
    const components = text.split('/');
    // Track where each component starts, so the mask lines up.
    const offsets = [];
    let pos = 0;
    components.forEach(function (c) { offsets.push(pos); pos += c.length + 1; });

    let bases = [{ path: absolute ? '/' : '', node: null }];
    if (absolute) {
      bases = [{ path: '', node: this.m.root }];
    } else {
      let node;
      try { node = this.resolve('.').node; } catch (e) { return [text]; }
      bases = [{ path: '', node: node }];
    }

    let results = bases;
    for (let ci = absolute ? 1 : 0; ci < components.length; ci++) {
      const comp = components[ci];
      const off = offsets[ci];
      const isLast = ci === components.length - 1;
      const next = [];

      if (comp === '') continue;

      const literal = !hasGlobChars(comp, mask.slice(off, off + comp.length));
      results.forEach(function (base) {
        if (!base.node || base.node.type !== 'dir') return;
        if (literal) {
          const child = base.node.entries.get(comp);
          if (child) next.push({ path: base.path + '/' + comp, node: child });
          return;
        }
        if (!self.m.canRead(base.node, self.user)) return;
        const re = globRegex(comp, mask, off);
        const names = Array.from(base.node.entries.keys()).sort();
        names.forEach(function (name) {
          // A leading dot has to be matched explicitly, as in a real shell.
          if (name.charAt(0) === '.' && comp.charAt(0) !== '.') return;
          if (!re.test(name)) return;
          const child = base.node.entries.get(name);
          if (!isLast && child.type !== 'dir' && child.type !== 'symlink') return;
          next.push({ path: base.path + '/' + name, node: child });
        });
      });
      results = next;
      if (!results.length) break;
    }

    if (!results.length) return [text];          // no match: bash passes it through
    return results.map(function (r) {
      const p = r.path.replace(/^\//, '');
      return absolute ? '/' + p : p;
    }).sort();
  };

  /* =========================================================================
   * Running
   * ======================================================================= */

  function Ctx(sh, argv, stdin) {
    this.sh = sh;
    this.m = sh.m;
    this.argv = argv;
    this.name = argv[0];
    this.args = argv.slice(1);
    this.stdin = stdin === undefined ? '' : stdin;
    this.stdout = '';
    this.stderr = '';
    this.status = 0;
    this.user = sh.user;
  }

  Ctx.prototype.out = function (s) { this.stdout += s; };
  Ctx.prototype.outln = function (s) { this.stdout += (s === undefined ? '' : s) + '\n'; };
  Ctx.prototype.errln = function (s) { this.stderr += s + '\n'; };
  Ctx.prototype.fail = function (msg, status) {
    this.errln(this.name + ': ' + msg);
    this.status = status === undefined ? 1 : status;
    return this.status;
  };
  /**
   * "cmd: missing operand" plus the Try line -- the shape every coreutils
   * command uses when you give it nothing to work on.
   *
   * The wording was already right; the exit code was not. This used to answer
   * 2 for everything, where `cp`, `chmod`, `mkdir`, `rm` and `tr` all exit 1.
   * assets/shusage.js carries what each command really does, taken from a
   * no-arguments probe on a real machine.
   */
  Ctx.prototype.usage = function (msg) {
    this.errln(this.name + ': ' + msg);
    this.errln("Try '" + this.name + " --help' for more information.");
    const real = HarborShell.usage && HarborShell.usage[this.name];
    this.status = (real && (real.usageStatus || real.status)) || 1;
    return this.status;
  };

  /** Report an FsError the way GNU tools do: "ls: cannot access 'x': ...". */
  Ctx.prototype.fsError = function (verb, path, err) {
    const msg = err && err.isFsError ? err.message : String(err && err.message || err);
    this.errln(this.name + ': ' + verb + " '" + path + "': " + msg);
    this.status = 1;
    return 1;
  };

  /** Lines of input: from the named files, or from stdin when there are none. */
  Ctx.prototype.inputLines = function (paths, opts) {
    const self = this;
    opts = opts || {};
    const chunks = [];
    if (!paths || !paths.length) {
      chunks.push({ name: '-', text: this.stdin });
    } else {
      paths.forEach(function (p) {
        if (p === '-') { chunks.push({ name: '-', text: self.stdin }); return; }
        try {
          const found = self.sh.resolve(p);
          if (found.node.type === 'dir') {
            self.errln(self.name + ': ' + p + ': Is a directory');
            self.status = opts.dirStatus === undefined ? 1 : opts.dirStatus;
            return;
          }
          if (!self.m.canRead(found.node, self.user)) {
            self.errln(self.name + ': ' + p + ': Permission denied');
            self.status = 1;
            return;
          }
          chunks.push({ name: p, text: self.m.read(found.node) });
        } catch (err) {
          self.errln(self.name + ': ' + p + ': ' +
            (err.isFsError ? err.message : String(err.message || err)));
          self.status = 1;
        }
      });
    }
    return chunks;
  };

  function splitLines(text) {
    if (text === '') return [];
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  /* ---------- option parsing shared by the commands ---------- */

  /**
   * Split argv into flags and operands.
   *   spec.bool     -- "l a h R" single letters that take no value
   *   spec.value    -- "n d f" letters that take a value (attached or next)
   *   spec.long     -- { "--all": "a", "--number=": "n" }
   * Bundled short flags (-la) are split, as GNU does.
   */
  /**
   * A usage error, the way the real command reports one.
   *
   * The exit code is not guessable: 76 commands exit 1, 16 exit 2 (ls, grep,
   * sort, useradd ...), and a handful use 64, 125, 253 or 255. Most add a
   * `Try 'cmd --help'` line, some print a whole usage block, some print
   * nothing more. assets/shusage.js carries the real answers, harvested from
   * a RHEL 9 machine; 1 is the fallback because it is much the commonest.
   */
  function usageError(ctx, message) {
    ctx.errln(message);
    const real = HarborShell.usage && HarborShell.usage[ctx.name];
    if (real && real.tail) real.tail.forEach(function (l) { ctx.errln(l); });
    ctx.status = real ? real.status : 1;
    return null;
  }

  function parseArgs(ctx, spec) {
    const bools = new Set((spec.bool || '').split(' ').filter(Boolean));
    const values = new Set((spec.value || '').split(' ').filter(Boolean));
    const longs = spec.long || {};
    const flags = Object.create(null);
    const operands = [];
    const args = ctx.args;
    let noMore = false;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (noMore || a === '-' || a.charAt(0) !== '-' || a === '') { operands.push(a); continue; }
      if (a === '--') { noMore = true; continue; }

      if (a.slice(0, 2) === '--') {
        const eq = a.indexOf('=');
        const name = eq === -1 ? a : a.slice(0, eq);
        const mapped = longs[name] !== undefined ? longs[name] : longs[name + '='];
        if (mapped === undefined) {
          return usageError(ctx, ctx.name + ": unrecognized option '" + a + "'");
        }
        if (values.has(mapped)) {
          flags[mapped] = eq === -1 ? args[++i] : a.slice(eq + 1);
        } else {
          flags[mapped] = true;
        }
        continue;
      }

      for (let k = 1; k < a.length; k++) {
        const letter = a[k];
        if (values.has(letter)) {
          const rest = a.slice(k + 1);
          flags[letter] = rest !== '' ? rest : args[++i];
          if (flags[letter] === undefined) {
            return usageError(ctx,
              ctx.name + ": option requires an argument -- '" + letter + "'");
          }
          break;
        }
        if (bools.has(letter)) { flags[letter] = true; continue; }
        if (spec.digits && /\d/.test(letter)) {
          flags.number = (flags.number || '') + letter;
          continue;
        }
        return usageError(ctx, ctx.name + ": invalid option -- '" + letter + "'");
      }
    }

    return { flags: flags, operands: operands };
  }

  /* ---------- the executor ---------- */

  /**
   * Run a whole command line. Returns
   *   { stdout, stderr, status, display, awaiting }
   * `display` is what the terminal shows (stdout and stderr in order), and
   * `awaiting` is set when a command needs a password typed in.
   */
  /*
   * `for NAME in WORDS; do BODY; done`
   *
   * Loops are handled ahead of the tokenizer rather than inside parse(), which
   * builds flat pipeline lists and has nowhere to hang a body. The list is
   * expanded with the ordinary machinery, so globs, braces and $(...) all
   * behave -- and a name with a space in it stays one item, which is the whole
   * point of the `for f in *.txt` exercise.
   */
  const FOR_LOOP = /^\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([\s\S]+?)\s*;?\s*\bdo\b\s*([\s\S]*?)\s*;?\s*\bdone\b\s*;?\s*$/;
  const MAX_ITER = 500;                    // a runaway loop should stop, not hang

  /**
   * Split a line at the `;`, `&&` and `||` that sit outside quotes, keeping
   * each `for ... done` together as one unit. Returns null when there is no
   * loop in the line, so the ordinary parser handles everything else.
   */
  function splitLoops(line) {
    const parts = [];
    let buf = '';
    let joiner = ';';
    let quote = null;

    for (let i = 0; i < line.length; i++) {
      const c = line.charAt(i);
      if (quote) {
        buf += c;
        if (c === quote) quote = null;
        else if (c === '\\' && quote === '"') { buf += line.charAt(++i) || ''; }
        continue;
      }
      if (c === '"' || c === "'") { quote = c; buf += c; continue; }
      if (c === '\\') { buf += c + (line.charAt(++i) || ''); continue; }
      if (c === ';' || (c === '&' && line.charAt(i + 1) === '&') ||
          (c === '|' && line.charAt(i + 1) === '|')) {
        parts.push({ text: buf, joiner: joiner });
        joiner = c === ';' ? ';' : c + c;
        if (c !== ';') i++;
        buf = '';
        continue;
      }
      buf += c;
    }
    parts.push({ text: buf, joiner: joiner });

    if (!parts.some(function (p) { return /^\s*for\s+[A-Za-z_]/.test(p.text); })) return null;

    // Glue each loop's body back together: it was split at its own separators.
    const units = [];
    for (let i = 0; i < parts.length; i++) {
      const start = parts[i];
      if (!/^\s*for\s+[A-Za-z_]/.test(start.text)) { units.push(start); continue; }
      let text = start.text;
      while (!/\bdone\b\s*;?\s*$/.test(text) && i + 1 < parts.length) {
        i++;
        text += (parts[i].joiner === ';' ? '; ' : ' ' + parts[i].joiner + ' ') + parts[i].text;
      }
      units.push({ text: text, joiner: start.joiner, loop: true });
    }
    return units;
  }

  /** Run the units splitLoops() produced, honouring ;, && and ||. */
  Shell.prototype.runUnits = function (units) {
    const result = { stdout: '', stderr: '', status: this.status, display: '' };
    let previousOk = true;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (unit.joiner === '&&' && !previousOk) continue;
      if (unit.joiner === '||' && previousOk) continue;
      if (!String(unit.text).trim()) continue;

      const m = unit.loop ? FOR_LOOP.exec(unit.text) : null;
      let r;
      if (unit.loop && !m) {
        // `for` opened but never shaped into a loop -- bash says the same.
        const msg = "bash: syntax error near unexpected token `done'\n";
        r = { stdout: '', stderr: msg, status: 2, display: msg };
      } else {
        r = m ? this.runForLoop(m) : this.run(unit.text);
      }

      result.stdout += r.stdout;
      result.stderr += r.stderr;
      result.display += r.display;
      result.status = r.status;
      this.status = r.status;
      previousOk = r.status === 0;
      if (r.exited) { result.exited = true; break; }
    }
    return result;
  };

  Shell.prototype.runForLoop = function (m) {
    const name = m[1];
    const body = m[3];
    const items = [];
    const self = this;

    try {
      tokenize(m[2]).forEach(function (t) {
        if (t.type !== 'word') return;
        self.expandWord(t).forEach(function (v) { items.push(v); });
      });
    } catch (err) {
      if (!err.isSyntax) throw err;
      const msg = 'bash: syntax error near unexpected token `' + err.message + "'\n";
      return { stdout: '', stderr: msg, status: 2, display: msg };
    }

    const result = { stdout: '', stderr: '', status: 0, display: '' };
    const had = Object.prototype.hasOwnProperty.call(this.env, name);
    const saved = this.env[name];
    const wasInteractive = this.interactive;
    this.interactive = false;               // the whole loop is one history entry

    try {
      for (let i = 0; i < items.length && i < MAX_ITER; i++) {
        this.env[name] = items[i];
        const r = this.run(body);
        result.stdout += r.stdout;
        result.stderr += r.stderr;
        result.display += r.display;
        result.status = r.status;
        if (r.exited) { result.exited = true; break; }
      }
    } finally {
      this.interactive = wasInteractive;
      if (had) this.env[name] = saved; else delete this.env[name];
    }

    this.status = result.status;
    return result;
  };

  Shell.prototype.run = function (line) {
    const self = this;
    this.lastLine = line;
    if (this.interactive && String(line).trim() !== '') this.history.push(String(line));

    // A loop that has not been closed yet: keep reading, the way bash does.
    if (/(^|[;&|]\s*)for\s+[A-Za-z_][A-Za-z0-9_]*\b/.test(String(line)) &&
        !/\bdone\b/.test(String(line))) {
      return { stdout: '', stderr: '', status: 0, display: '', continuation: 'for' };
    }
    const units = splitLoops(String(line));
    if (units) return this.runUnits(units);
    // A loop that has not been closed yet: keep reading, the way bash does.
    if (/^\s*for\s+[A-Za-z_][A-Za-z0-9_]*\b/.test(String(line)) && !/\bdone\b/.test(String(line))) {
      return { stdout: '', stderr: '', status: 0, display: '', continuation: 'for' };
    }

    let tokens;
    try {
      tokens = tokenize(String(line));
    } catch (err) {
      if (err.isSyntax) {
        return { stdout: '', stderr: '', status: 0, display: '', continuation: err.message };
      }
      throw err;
    }

    let lists;
    try {
      lists = parse(tokens);
    } catch (err) {
      if (err.isSyntax) {
        return {
          stdout: '', stderr: 'bash: syntax error near unexpected token `' + err.message + "'\n",
          status: 2, display: 'bash: syntax error near unexpected token `' + err.message + "'\n"
        };
      }
      throw err;
    }

    const result = { stdout: '', stderr: '', status: this.status, display: '' };
    let previousOk = true;

    for (let i = 0; i < lists.length; i++) {
      const item = lists[i];
      if (item.joiner === '&&' && !previousOk) continue;
      if (item.joiner === '||' && previousOk) continue;

      const piped = this.runPipeline(item.pipeline, item.background);
      result.stdout += piped.stdout;
      result.stderr += piped.stderr;
      result.display += piped.display;
      result.status = piped.status;
      this.status = piped.status;
      previousOk = piped.status === 0;

      if (piped.awaiting) {
        result.awaiting = piped.awaiting;
        break;
      }
      if (piped.editor) {
        result.editor = piped.editor;
        break;
      }
      if (piped.exited) { result.exited = true; break; }
    }

    this.m.tick(1);
    this.env.PWD = this.cwd;
    return result;
  };

  /** Run a command line for $(...) -- output captured, nothing displayed. */
  Shell.prototype.runNested = function (line) {
    if (this.depth > MAX_LOOP) return '';
    this.depth++;
    const saved = this.interactive;
    this.interactive = false;
    let out = '';
    try {
      out = this.run(line).stdout;
    } finally {
      this.interactive = saved;
      this.depth--;
    }
    return out;
  };

  Shell.prototype.runPipeline = function (pipeline, background) {
    const self = this;
    let stdin = '';
    let display = '';
    let stderrAll = '';
    let status = 0;
    let awaiting = null;
    let editor = null;
    let exited = false;

    for (let i = 0; i < pipeline.length; i++) {
      const cmd = pipeline[i];
      const isLast = i === pipeline.length - 1;

      const res = this.runSimple(cmd, stdin, background && isLast);
      if (res.awaiting) { awaiting = res.awaiting; }
      if (res.editor) { editor = res.editor; }
      if (res.exited) exited = true;

      stderrAll += res.stderr;
      // stderr is not piped onward unless |& was used.
      display += res.stderr;
      if (res.notice) display += res.notice;
      if (cmd.mergeErr) stdin = res.stdout + res.stderr;
      else stdin = res.stdout;

      status = res.status;
      if (isLast) display += res.stdout;
      if (res.halt) break;
    }

    return {
      stdout: pipeline.length ? stdin : '',
      stderr: stderrAll,
      display: display,
      status: status,
      awaiting: awaiting,
      editor: editor,
      exited: exited
    };
  };

  /** Expand one simple command and run it, applying its redirections. */
  Shell.prototype.runSimple = function (cmd, stdin, background) {
    const self = this;
    let argv = [];

    // Leading NAME=value pairs are assignments, not arguments.
    let wi = 0;
    const assignments = [];
    while (wi < cmd.words.length) {
      const w = cmd.words[wi];
      const flat = w.parts.map(function (p) { return p.s; }).join('');
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(flat);
      if (m && w.parts[0].q === 'none') {
        assignments.push([m[1], this.expandWord({ type: 'word', parts: [{ s: m[2], q: 'double' }] },
                                                { noGlob: true })[0] || '']);
        wi++;
        continue;
      }
      break;
    }

    for (let i = wi; i < cmd.words.length; i++) {
      const expanded = this.expandWord(cmd.words[i]);
      expanded.forEach(function (a) { argv.push(a); });
    }

    if (!argv.length) {
      assignments.forEach(function (a) { self.env[a[0]] = a[1]; });
      return { stdout: '', stderr: '', status: 0 };
    }

    // Alias substitution, once, on the command word only.
    if (this.aliases[argv[0]] !== undefined && !cmd._aliasDone) {
      const replaced = this.aliases[argv[0]] + ' ' +
        argv.slice(1).map(quoteArg).join(' ');
      const sub = this.runNestedFull(replaced, stdin);
      return sub;
    }

    // Redirections
    let inputOverride = null;
    let outFile = null, outAppend = false;
    let errFile = null, errAppend = false, errToOut = false, outToErr = false;

    for (let i = 0; i < cmd.redirs.length; i++) {
      const r = cmd.redirs[i];
      const op = r.op;
      if (r.dup) {
        if (/^2>&1$/.test(op) || /^2>&1/.test(op)) errToOut = true;
        else if (/^1?>&2/.test(op)) outToErr = true;
        continue;
      }
      const targetList = this.expandWord(r.word);
      const target = targetList[0];
      if (/^<<-?$/.test(op)) { inputOverride = r.hereText === undefined ? '' : r.hereText; continue; }
      if (/^\d*<$/.test(op)) {
        try {
          const found = this.resolve(target);
          if (found.node.type === 'dir') {
            return { stdout: '', stderr: 'bash: ' + target + ': Is a directory\n', status: 1 };
          }
          if (!this.m.canRead(found.node, this.user)) {
            return { stdout: '', stderr: 'bash: ' + target + ': Permission denied\n', status: 1 };
          }
          inputOverride = this.m.read(found.node);
        } catch (err) {
          return { stdout: '', stderr: 'bash: ' + target + ': No such file or directory\n', status: 1 };
        }
        continue;
      }
      if (op === '&>' || op === '&>>') {
        outFile = target; errFile = target;
        outAppend = errAppend = op === '&>>';
        continue;
      }
      const fdMatch = /^(\d*)>(>?)/.exec(op);
      if (fdMatch) {
        const fd = fdMatch[1] === '' ? 1 : +fdMatch[1];
        if (fd === 2) { errFile = target; errAppend = fdMatch[2] === '>'; }
        else { outFile = target; outAppend = fdMatch[2] === '>'; }
      }
    }

    const ctx = new Ctx(this, argv, inputOverride === null ? stdin : inputOverride);
    assignments.forEach(function (a) { ctx.assigned = true; self.env[a[0]] = a[1]; });

    // `--help` before anything parses it. The study guide calls this the first
    // thing to try, and until now `ls --help` answered "unrecognized option
    // '--help'" -- while the error printed directly above it advised "Try 'ls
    // --help' for more information". A circular dead end at the exact point a
    // stuck learner reaches for help.
    //
    // Answered here rather than per command because every command would
    // otherwise have to remember to check, and the text is the real one from
    // assets/shusage.js either way.
    if (argv.length > 1 && argv.indexOf('--help') !== -1 &&
        argv[0].indexOf('/') === -1) {
      const doc = HarborShell.usage && HarborShell.usage[argv[0]];
      if (doc && doc.help && (COMMANDS[argv[0]] || BUILTINS[argv[0]])) {
        return {
          stdout: doc.help + '\n', stderr: '',
          status: doc.helpStatus === undefined ? 0 : doc.helpStatus
        };
      }
    }

    const impl = this.lookup(argv[0]);
    if (!impl) {
      // The image carries every binary a real RHEL 9 machine has on its PATH,
      // roughly 1,100 of them, so `which`, `ls /usr/bin` and `rpm -qf` agree
      // with a real system. Only the commands the course covers are actually
      // implemented. Saying "command not found" about a file the learner can
      // see with `ls` would be the one outright lie in the machine, so the two
      // cases get two different answers.
      const where = argv[0].indexOf('/') === -1 ? this.onPath(argv[0]) : null;
      if (where) {
        return {
          stdout: '',
          stderr: argv[0] + ': not implemented in this practice machine.\n' +
                  where + ' exists here so `which`, `ls` and `rpm -qf` match a ' +
                  'real RHEL 9 system,\nbut only the commands the course covers ' +
                  'actually run.\n',
          status: 127
        };
      }
      return {
        stdout: '', stderr: 'bash: ' + argv[0] + ': command not found\n', status: 127
      };
    }

    if (background) {
      const proc = this.m.spawn(this.user, argv.join(' '));
      const job = { id: this.m.jobs.length + 1, pid: proc.pid, cmd: argv.join(' '), state: 'Running' };
      this.m.jobs.push(job);
      return {
        stdout: '', stderr: '', status: 0,
        notice: '[' + job.id + '] ' + job.pid + '\n'
      };
    }

    try {
      const rc = impl.run(ctx);
      ctx.status = rc === undefined ? ctx.status : rc;
    } catch (err) {
      if (err && err.isExit) {
        ctx.status = err.status;
        ctx.exited = true;
      } else if (err && err.isFsError) {
        ctx.errln(argv[0] + ': ' + err.message);
        ctx.status = 1;
      } else {
        ctx.errln(argv[0] + ': ' + (err && err.message ? err.message : String(err)));
        ctx.status = 1;
      }
    }

    let stdout = ctx.stdout;
    let stderr = ctx.stderr;
    if (errToOut) { stdout += stderr; stderr = ''; }
    if (outToErr) { stderr += stdout; stdout = ''; }

    if (outFile !== null) {
      const wrote = this.writeTo(outFile, stdout, outAppend);
      if (wrote) stderr += wrote;
      stdout = '';
    }
    if (errFile !== null) {
      const wrote = this.writeTo(errFile, stderr, errAppend);
      stderr = wrote || '';
    }

    return {
      stdout: stdout, stderr: stderr, status: ctx.status,
      awaiting: ctx.awaiting, editor: ctx.editor, exited: ctx.exited
    };
  };

  /** Run a line built by alias expansion, keeping the caller's stdin. */
  Shell.prototype.runNestedFull = function (line, stdin) {
    const tokens = tokenize(line);
    const lists = parse(tokens);
    if (!lists.length) return { stdout: '', stderr: '', status: 0 };
    const cmd = lists[0].pipeline[0];
    cmd._aliasDone = true;
    return this.runSimple(cmd, stdin, false);
  };

  function quoteArg(a) {
    return /[\s'"$*?[\]|&;<>()]/.test(a) ? "'" + a.replace(/'/g, "'\\''") + "'" : a;
  }

  /**
   * Find a command: shell builtins first, then the PATH. A command whose file
   * was removed by `dnf remove` stops working, the way it really would.
   */
  Shell.prototype.lookup = function (name) {
    if (BUILTINS[name]) return BUILTINS[name];
    if (name.indexOf('/') !== -1) {
      try {
        const found = this.resolve(name);
        if (found.node.type === 'dir') return null;
        if (!this.m.canExec(found.node, this.user)) {
          return { run: function (ctx) { return ctx.fail('Permission denied', 126); } };
        }
        const base = name.replace(/^.*\//, '');
        if (COMMANDS[base]) return COMMANDS[base];
        return { run: runScript(found.node) };
      } catch (e) {
        return null;
      }
    }
    if (!this.onPath(name)) return null;
    return COMMANDS[name] || null;
  };

  Shell.prototype.onPath = function (name) {
    const dirs = String(this.env.PATH || '').split(':');
    for (let i = 0; i < dirs.length; i++) {
      if (!dirs[i]) continue;
      try {
        const found = this.resolve(dirs[i] + '/' + name, { user: null });
        if (found.node.type !== 'dir') return dirs[i] + '/' + name;
      } catch (e) { /* keep looking */ }
    }
    return null;
  };

  function runScript(node) {
    return function (ctx) {
      const text = ctx.m.read(node);
      const sh = ctx.sh;
      if (sh.depth > MAX_LOOP) return ctx.fail('too many levels of recursion');
      sh.depth++;
      const wasInteractive = sh.interactive;
      sh.interactive = false;
      try {
        text.split('\n').forEach(function (l) {
          if (!l.trim() || l.trim().charAt(0) === '#') return;
          const r = sh.run(l);
          ctx.out(r.stdout);
          if (r.stderr) ctx.errln(r.stderr.replace(/\n$/, ''));
          ctx.status = r.status;
        });
      } finally {
        sh.interactive = wasInteractive;
        sh.depth--;
      }
      return ctx.status;
    };
  }

  /** Write redirected output to a file, creating it under the current umask. */
  Shell.prototype.writeTo = function (path, text, append) {
    try {
      const parent = this.m.resolveParent(path, { cwd: this.cwd, user: this.user });
      const existing = parent.dir.entries.get(parent.name);
      if (existing) {
        if (existing.type === 'dir') return 'bash: ' + path + ': Is a directory\n';
        if (!this.m.canWrite(existing, this.user)) return 'bash: ' + path + ': Permission denied\n';
        existing.content = append ? this.m.read(existing) + text : text;
        if (existing.synth) existing.synth = null;
        existing.mtime = this.m.now;
        return null;
      }
      if (!this.m.canWrite(parent.dir, this.user)) return 'bash: ' + path + ': Permission denied\n';
      this.m.createFile(parent.dir, parent.name, this.user, 0o666 & ~this.umask, text);
      return null;
    } catch (err) {
      return 'bash: ' + path + ': ' + (err.isFsError ? err.message : String(err.message)) + '\n';
    }
  };

  /**
   * Save an editor buffer back to the machine, as the current user.
   *
   * Returns `{ ok: true, lines }` or `{ ok: false, error }` with the message
   * nano itself would show on its status line -- a read-only file and a
   * directory you cannot write to both have to fail here, or the editor would
   * quietly beat the permissions the lab is teaching.
   */
  Shell.prototype.saveBuffer = function (path, text) {
    const body = text.length && text.charAt(text.length - 1) !== '\n' ? text + '\n' : text;
    const problem = this.writeTo(path, body, false);
    if (problem) {
      return { ok: false, error: problem.replace(/^bash: /, '').replace(/\n$/, '') };
    }
    return { ok: true, lines: body === '' ? 0 : body.replace(/\n$/, '').split('\n').length };
  };

  /* ---------- heredocs ---------- */

  /**
   * A heredoc spans several lines, so the terminal feeds them in with a
   * continuation prompt. Detect an unsatisfied `<< WORD` in a line.
   */
  function pendingHeredoc(line) {
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1(?![^\n]*\n)/.exec(String(line));
    return m ? m[2] : null;
  }

  /** Substitute collected heredoc text back into the line before running it. */
  function attachHeredoc(line, body) {
    return String(line).replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/, function () {
      return '<<\u0001HEREDOC\u0001';
    }) + '\u0002' + body;
  }

  /* =========================================================================
   * Interactive prompts (su, passwd)
   * ======================================================================= */

  Shell.prototype.ask = function (ctx, prompt, hidden, handler) {
    ctx.awaiting = { prompt: prompt, hidden: !!hidden };
    this.pending = { handler: handler, ctx: ctx };
    return 0;
  };

  /** The terminal calls this with what the learner typed at a prompt. */
  Shell.prototype.provide = function (text) {
    if (!this.pending) return { stdout: '', stderr: '', status: 0, display: '' };
    const pending = this.pending;
    this.pending = null;
    const ctx = pending.ctx;
    ctx.stdout = '';
    ctx.stderr = '';
    ctx.awaiting = null;
    const rc = pending.handler(ctx, text);
    ctx.status = rc === undefined ? ctx.status : rc;
    this.status = ctx.status;
    return {
      stdout: ctx.stdout, stderr: ctx.stderr, status: ctx.status,
      display: ctx.stderr + ctx.stdout, awaiting: ctx.awaiting
    };
  };

  /* =========================================================================
   * Grading
   * ======================================================================= */

  function normalizeOutput(text, opts) {
    opts = opts || {};
    let lines = String(text).split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    lines = lines.map(function (l) {
      let s = l.replace(/\s+$/, '');
      if (opts.collapseSpace !== false) s = s.replace(/[ \t]+/g, ' ').trim();
      return s;
    });
    if (opts.dropBlank !== false) lines = lines.filter(function (l) { return l !== ''; });
    if (!opts.orderMatters) lines = lines.slice().sort();
    return lines;
  }

  function sameList(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /**
   * Compare a learner's output with the reference output.
   *
   * opts.orderMatters -- the prompt asked for a sort, so line order counts
   * opts.mustContain  -- substrings the output has to include
   * opts.exact        -- compare byte for byte, spacing included
   */
  function compareOutput(actual, expected, opts) {
    opts = opts || {};

    if (opts.exact) {
      if (String(actual) === String(expected)) return { ok: true, message: 'Correct.' };
      return {
        ok: false,
        message: 'The output does not match exactly. Check spacing and capitalization.'
      };
    }

    const a = normalizeOutput(actual, opts);
    const b = normalizeOutput(expected, opts);

    if (opts.mustContain) {
      const missing = opts.mustContain.filter(function (s) {
        return String(actual).indexOf(s) === -1;
      });
      if (missing.length) {
        return {
          ok: false,
          message: 'The output is missing ' + missing.map(function (s) {
            return '"' + s + '"';
          }).join(', ') + '.'
        };
      }
    }

    if (a.length === 0 && b.length > 0) {
      return {
        ok: false,
        message: 'Your command printed nothing, but the answer produces ' +
          plural(b.length, 'line') + '. Check the path and the options.'
      };
    }
    if (b.length === 0 && a.length > 0) {
      return { ok: false, message: 'The answer produces no output, but yours printed ' +
        plural(a.length, 'line') + '.' };
    }

    if (a.length !== b.length) {
      const setA = Array.from(new Set(a)).sort();
      const setB = Array.from(new Set(b)).sort();
      let hint = '';
      if (sameList(setA, setB)) hint = ' The right lines are there, but repeated.';
      else if (a.length > b.length) hint = ' Yours is showing more than the question asked for.';
      else hint = ' Yours is missing some of it.';
      return {
        ok: false,
        message: 'Wrong number of lines: the answer prints ' + plural(b.length, 'line') +
          ', yours printed ' + plural(a.length, 'line') + '.' + hint
      };
    }

    if (!sameList(a.slice().sort(), b.slice().sort())) {
      return {
        ok: false,
        message: 'Right number of lines, but the content differs. Compare your output ' +
          'with the expected output below.'
      };
    }

    if (opts.orderMatters && !sameList(a, b)) {
      return { ok: false, message: 'Every line is correct, but they come out in the wrong order.' };
    }

    return { ok: true, message: 'Correct.' };
  }

  /**
   * Grade a command that prints something: run it, run the reference, compare.
   */
  function check(box, userLine, referenceLine, opts) {
    opts = opts || {};
    const mine = shellFor(box.fork(), opts);
    const theirs = shellFor(box.fork(), opts);

    const a = mine.run(userLine);
    const b = theirs.run(referenceLine);

    if (a.status === 127) {
      return {
        ok: false, error: true, actual: a.display, expected: b.display,
        message: a.stderr.trim() || 'That command was not found.'
      };
    }

    const verdict = compareOutput(a.stdout || a.display, b.stdout || b.display, opts);
    verdict.actual = a.display;
    verdict.expected = b.display;
    verdict.status = a.status;
    if (!verdict.ok && a.stderr) {
      verdict.message = a.stderr.trim().split('\n')[0] + ' — ' + verdict.message;
    }
    return verdict;
  }

  /**
   * Grade a command that changes the machine rather than printing.
   *
   * The learner's command and the reference each run on their own copy of the
   * image; a `verify` command then reads both copies and the two readings are
   * compared. The answer is graded on the effect it had, so any correct way of
   * getting there scores -- and neither copy touches the playground's machine.
   */
  function checkEffect(box, userLine, referenceLine, verifyLine, opts) {
    opts = opts || {};
    const mine = shellFor(box.fork(), opts);
    const theirs = shellFor(box.fork(), opts);

    const ran = mine.run(userLine);
    theirs.run(referenceLine);

    const a = mine.run(verifyLine);
    const b = theirs.run(verifyLine);

    const verdict = compareOutput(a.stdout || a.display, b.stdout || b.display, opts);
    verdict.actual = a.display;
    verdict.expected = b.display;
    verdict.commandOutput = ran.display;
    verdict.status = ran.status;

    if (!verdict.ok) {
      if (ran.status === 127) {
        verdict.message = ran.stderr.trim() || 'That command was not found.';
        verdict.error = true;
      } else if (ran.stderr) {
        verdict.message = ran.stderr.trim().split('\n')[0] + ' — the system was not changed ' +
          'the way the question asked.';
      } else {
        verdict.message = 'The command ran, but the system does not look right afterwards. ' +
          verdict.message;
      }
    }
    return verdict;
  }

  function shellFor(box, opts) {
    const sh = new Shell(box, { interactive: false, user: (opts && opts.user) || 'student' });
    if (opts && opts.cwd) sh.setCwd(opts.cwd);
    if (opts && opts.setup) {
      [].concat(opts.setup).forEach(function (l) { sh.run(l); });
    }
    return sh;
  }

  /* =========================================================================
   * Builtins
   * ======================================================================= */

  registerBuiltin('cd', function (ctx) {
    const sh = ctx.sh;
    let target = ctx.args[0];
    if (!target || target === '~') target = sh.user.home;
    else if (target === '-') {
      target = sh.env.OLDPWD || sh.cwd;
      ctx.outln(target);
    }
    try {
      const found = sh.resolve(target);
      if (found.node.type !== 'dir') return ctx.fail(target + ': Not a directory');
      if (!ctx.m.canExec(found.node, sh.user)) return ctx.fail(target + ': Permission denied');
      sh.env.OLDPWD = sh.cwd;
      sh.cwd = ctx.m.pathOf(found.node) || found.path;
      sh.env.PWD = sh.cwd;
      return 0;
    } catch (err) {
      return ctx.fail(target + ': ' + (err.isFsError ? err.message : err.message));
    }
  });

  registerBuiltin('pwd', function (ctx) {
    ctx.outln(ctx.sh.cwd);
    return 0;
  });

  registerBuiltin('echo', function (ctx) {
    let args = ctx.args.slice();
    let noNewline = false, interpret = false;
    while (args.length && /^-[neE]+$/.test(args[0])) {
      if (args[0].indexOf('n') !== -1) noNewline = true;
      if (args[0].indexOf('e') !== -1) interpret = true;
      if (args[0].indexOf('E') !== -1) interpret = false;
      args.shift();
    }
    let text = args.join(' ');
    if (interpret) {
      text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
                 .replace(/\\r/g, '\r').replace(/\\a/g, '').replace(/\\0/g, '\0');
    }
    ctx.out(text + (noNewline ? '' : '\n'));
    return 0;
  });

  registerBuiltin('printf', function (ctx) {
    if (!ctx.args.length) return ctx.usage('usage: printf format [arguments]');
    const fmt = ctx.args[0];
    const rest = ctx.args.slice(1);
    let ri = 0;
    const text = fmt
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
      .replace(/%(-?\d*)(?:\.(\d+))?([sdif%])/g, function (all, width, prec, kind) {
        if (kind === '%') return '%';
        let v = rest[ri++];
        if (v === undefined) v = kind === 's' ? '' : '0';
        if (kind === 'd' || kind === 'i') v = String(parseInt(v, 10) || 0);
        else if (kind === 'f') v = (parseFloat(v) || 0).toFixed(prec === undefined ? 6 : +prec);
        else if (prec !== undefined) v = String(v).slice(0, +prec);
        const w = parseInt(width, 10);
        if (!w) return String(v);
        const s = String(v);
        return w < 0 ? s + ' '.repeat(Math.max(0, -w - s.length))
                     : ' '.repeat(Math.max(0, w - s.length)) + s;
      });
    ctx.out(text);
    return 0;
  });

  registerBuiltin('export', function (ctx) {
    const sh = ctx.sh;
    if (!ctx.args.length) {
      Object.keys(sh.env).sort().forEach(function (k) {
        ctx.outln('declare -x ' + k + '="' + sh.env[k] + '"');
      });
      return 0;
    }
    ctx.args.forEach(function (a) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(a);
      if (m) sh.env[m[1]] = m[2];
    });
    return 0;
  });

  registerBuiltin('unset', function (ctx) {
    ctx.args.forEach(function (a) { delete ctx.sh.env[a]; });
    return 0;
  });

  registerBuiltin('set', function (ctx) {
    if (!ctx.args.length) {
      Object.keys(ctx.sh.env).sort().forEach(function (k) {
        ctx.outln(k + '=' + ctx.sh.env[k]);
      });
    }
    return 0;
  });

  registerBuiltin('env', function (ctx) {
    Object.keys(ctx.sh.env).sort().forEach(function (k) {
      ctx.outln(k + '=' + ctx.sh.env[k]);
    });
    return 0;
  });

  registerBuiltin('alias', function (ctx) {
    const sh = ctx.sh;
    if (!ctx.args.length) {
      Object.keys(sh.aliases).sort().forEach(function (k) {
        ctx.outln("alias " + k + "='" + sh.aliases[k] + "'");
      });
      return 0;
    }
    ctx.args.forEach(function (a) {
      const m = /^([^=]+)=(.*)$/.exec(a);
      if (m) sh.aliases[m[1]] = m[2];
      else if (sh.aliases[a] !== undefined) ctx.outln("alias " + a + "='" + sh.aliases[a] + "'");
      else ctx.errln('alias: ' + a + ': not found');
    });
    return 0;
  });

  registerBuiltin('unalias', function (ctx) {
    ctx.args.forEach(function (a) { delete ctx.sh.aliases[a]; });
    return 0;
  });

  registerBuiltin('history', function (ctx) {
    const h = ctx.sh.history;
    const limit = ctx.args[0] ? parseInt(ctx.args[0], 10) : h.length;
    const from = Math.max(0, h.length - limit);
    for (let i = from; i < h.length; i++) {
      ctx.outln(String(i + 1).padStart(5) + '  ' + h[i]);
    }
    return 0;
  });

  registerBuiltin('exit logout', function (ctx) {
    const sh = ctx.sh;
    const code = ctx.args[0] ? parseInt(ctx.args[0], 10) : sh.status;
    if (sh.userStack.length) {
      const prev = sh.userStack.pop();
      sh.user = prev.user;
      sh.cwd = prev.cwd;
      sh.env = prev.env;
      ctx.user = sh.user;
      if (ctx.name === 'logout' || ctx.name === 'exit') ctx.outln('logout');
      return 0;
    }
    const err = new Error('exit');
    err.isExit = true;
    err.status = code;
    throw err;
  });

  registerBuiltin('umask', function (ctx) {
    const sh = ctx.sh;
    if (!ctx.args.length) {
      ctx.outln('0' + sh.umask.toString(8).padStart(3, '0'));
      return 0;
    }
    if (ctx.args[0] === '-S') {
      const perm = 0o777 & ~sh.umask;
      ctx.outln('u=' + rwxLetters((perm >> 6) & 7) + ',g=' + rwxLetters((perm >> 3) & 7) +
        ',o=' + rwxLetters(perm & 7));
      return 0;
    }
    if (!/^[0-7]{1,4}$/.test(ctx.args[0])) return ctx.fail(ctx.args[0] + ': invalid symbolic mode');
    sh.umask = parseInt(ctx.args[0], 8);
    return 0;
  });

  function rwxLetters(bits) {
    return (bits & 4 ? 'r' : '') + (bits & 2 ? 'w' : '') + (bits & 1 ? 'x' : '');
  }

  registerBuiltin('type', function (ctx) {
    ctx.args.forEach(function (a) {
      if (ctx.sh.aliases[a] !== undefined) {
        ctx.outln(a + " is aliased to `" + ctx.sh.aliases[a] + "'");
      } else if (BUILTINS[a]) {
        ctx.outln(a + ' is a shell builtin');
      } else {
        const p = ctx.sh.onPath(a);
        if (p) ctx.outln(a + ' is ' + p);
        else { ctx.errln('bash: type: ' + a + ': not found'); ctx.status = 1; }
      }
    });
    return ctx.status;
  });

  registerBuiltin('source .', function (ctx) {
    if (!ctx.args.length) return ctx.fail('filename argument required');
    const impl = ctx.sh.lookup(ctx.args[0].indexOf('/') === -1 ? './' + ctx.args[0] : ctx.args[0]);
    if (!impl) return ctx.fail(ctx.args[0] + ': No such file or directory');
    return impl.run(ctx);
  });

  registerBuiltin('true', function () { return 0; });
  registerBuiltin('false', function () { return 1; });

  registerBuiltin('test [', function (ctx) {
    let a = ctx.args.slice();
    if (ctx.name === '[') {
      if (a[a.length - 1] !== ']') return ctx.fail('missing `]\'', 2);
      a.pop();
    }
    return evalTest(ctx, a) ? 0 : 1;
  });

  function evalTest(ctx, a) {
    const sh = ctx.sh;
    const stat = function (p, follow) {
      try { return sh.resolve(p, { follow: follow !== false }).node; } catch (e) { return null; }
    };
    if (a.length === 0) return false;
    if (a.length === 1) return a[0] !== '';
    if (a.length === 2) {
      const flag = a[0], p = a[1];
      const node = stat(p, flag !== '-L' && flag !== '-h');
      switch (flag) {
        case '-e': return !!node;
        case '-f': return !!node && node.type === 'file';
        case '-d': return !!node && node.type === 'dir';
        case '-L': case '-h': return !!node && node.type === 'symlink';
        case '-s': return !!node && ctx.m.sizeOf(node) > 0;
        case '-r': return !!node && ctx.m.canRead(node, sh.user);
        case '-w': return !!node && ctx.m.canWrite(node, sh.user);
        case '-x': return !!node && ctx.m.canExec(node, sh.user);
        case '-z': return p === '';
        case '-n': return p !== '';
        case '!': return !evalTest(ctx, a.slice(1));
        default: return false;
      }
    }
    if (a.length === 3) {
      const [x, op, y] = a;
      switch (op) {
        case '=': case '==': return x === y;
        case '!=': return x !== y;
        case '-eq': return +x === +y;
        case '-ne': return +x !== +y;
        case '-lt': return +x < +y;
        case '-le': return +x <= +y;
        case '-gt': return +x > +y;
        case '-ge': return +x >= +y;
        default: return false;
      }
    }
    if (a[0] === '!') return !evalTest(ctx, a.slice(1));
    return false;
  }

  registerBuiltin('jobs', function (ctx) {
    ctx.m.jobs.forEach(function (j, i) {
      const mark = i === ctx.m.jobs.length - 1 ? '+' : (i === ctx.m.jobs.length - 2 ? '-' : ' ');
      ctx.outln('[' + j.id + ']' + mark + '  ' + j.state.padEnd(22) + j.cmd + ' &');
    });
    return 0;
  });

  registerBuiltin('fg', function (ctx) {
    const jobs = ctx.m.jobs;
    if (!jobs.length) return ctx.fail('current: no such job');
    const job = pickJob(ctx, jobs);
    if (!job) return ctx.fail(ctx.args[0] + ': no such job');
    ctx.outln(job.cmd);
    job.state = 'Running';
    // A foreground job in this terminal runs to completion immediately.
    ctx.m.killPid(job.pid);
    return 0;
  });

  registerBuiltin('bg', function (ctx) {
    const jobs = ctx.m.jobs;
    const job = pickJob(ctx, jobs);
    if (!job) return ctx.fail((ctx.args[0] || 'current') + ': no such job');
    job.state = 'Running';
    ctx.outln('[' + job.id + ']+ ' + job.cmd + ' &');
    return 0;
  });

  function pickJob(ctx, jobs) {
    if (!jobs.length) return null;
    const spec = ctx.args[0];
    if (!spec || spec === '%%' || spec === '%+') return jobs[jobs.length - 1];
    const n = parseInt(String(spec).replace('%', ''), 10);
    return jobs.find(function (j) { return j.id === n; }) || null;
  }

  registerBuiltin('help', function (ctx) {
    ctx.outln('GNU bash, version 5.1.8(1)-release (x86_64-redhat-linux-gnu)');
    ctx.outln('These shell commands are defined internally:');
    ctx.outln('  ' + Object.keys(BUILTINS).sort().join(', '));
    return 0;
  });

  /* =========================================================================
   * Navigation and file management (chapters 6 and 7)
   * ======================================================================= */

  function modeString(m, node) {
    const type = node.type === 'dir' ? 'd' : node.type === 'symlink' ? 'l' : '-';
    const mode = node.mode;
    let s = '';
    for (let shift = 6; shift >= 0; shift -= 3) {
      const bits = (mode >> shift) & 7;
      s += (bits & 4) ? 'r' : '-';
      s += (bits & 2) ? 'w' : '-';
      const x = (bits & 1) !== 0;
      if (shift === 6 && (mode & 0o4000)) s += x ? 's' : 'S';
      else if (shift === 3 && (mode & 0o2000)) s += x ? 's' : 'S';
      else if (shift === 0 && (mode & 0o1000)) s += x ? 't' : 'T';
      else s += x ? 'x' : '-';
    }
    return type + s;
  }

  function humanSize(bytes) {
    if (bytes < 1024) return String(bytes);
    const units = ['K', 'M', 'G', 'T'];
    let v = bytes / 1024, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return (v < 10 ? v.toFixed(1) : String(Math.round(v))) + units[i];
  }

  register('ls', function (ctx) {
    const parsed = parseArgs(ctx, {
      bool: 'l a A h R d r t S i F n 1 u c p',
      long: { '--all': 'a', '--almost-all': 'A', '--human-readable': 'h',
              '--recursive': 'R', '--reverse': 'r', '--inode': 'i',
              '--directory': 'd', '--numeric-uid-gid': 'n', '--classify': 'F' }
    });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const sh = ctx.sh;
    const m = ctx.m;
    const targets = parsed.operands.length ? parsed.operands : ['.'];

    const dirs = [];
    const loose = [];

    targets.forEach(function (t) {
      try {
        const found = sh.resolve(t, { follow: !fl.d });
        if (found.node.type === 'dir' && !fl.d) dirs.push({ label: t, node: found.node });
        else loose.push({ label: t, node: found.node, name: t });
      } catch (err) {
        ctx.errln("ls: cannot access '" + t + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 2;
      }
    });

    function entryList(dirNode) {
      const names = Array.from(dirNode.entries.keys());
      let list = names.filter(function (n) {
        return fl.a || fl.A || n.charAt(0) !== '.';
      }).map(function (n) {
        return { name: n, node: dirNode.entries.get(n) };
      });
      if (fl.a) {
        list = [{ name: '.', node: dirNode }, { name: '..', node: dirNode }].concat(list);
      }
      return sortEntries(list);
    }

    function sortEntries(list) {
      list.sort(function (x, y) {
        if (fl.t) return y.node.mtime - x.node.mtime || x.name.localeCompare(y.name);
        if (fl.S) return m.sizeOf(y.node) - m.sizeOf(x.node) || x.name.localeCompare(y.name);
        return x.name.localeCompare(y.name, 'en');
      });
      if (fl.r) list.reverse();
      return list;
    }

    function classify(node) {
      if (!fl.F && !fl.p) return '';
      if (node.type === 'dir') return '/';
      if (!fl.F) return '';
      if (node.type === 'symlink') return '@';
      if (node.mode & 0o111) return '*';
      return '';
    }

    function renderLong(list, dirNode) {
      const rows = list.map(function (e) {
        const node = e.node;
        const owner = fl.n ? String(node.uid) : m.userName(node.uid);
        const group = fl.n ? String(node.gid) : m.groupName(node.gid);
        const size = fl.h ? humanSize(m.sizeOf(node)) : String(m.sizeOf(node));
        let name = e.name + classify(node);
        if (node.type === 'symlink') name += ' -> ' + node.target;
        return [
          (fl.i ? String(node.ino) + ' ' : '') + modeString(m, node),
          String(node.nlink), owner, group, size, m.formatLsTime(node.mtime), name
        ];
      });
      const widths = [0, 0, 0, 0, 0];
      rows.forEach(function (r) {
        for (let i = 0; i < 5; i++) widths[i] = Math.max(widths[i], r[i].length);
      });
      if (dirNode) {
        const blocks = list.reduce(function (sum, e) {
          return sum + Math.ceil(m.sizeOf(e.node) / 1024) * 4;
        }, 0);
        ctx.outln('total ' + blocks);
      }
      rows.forEach(function (r) {
        ctx.outln(r[0].padEnd(widths[0]) + ' ' + r[1].padStart(widths[1]) + ' ' +
          r[2].padEnd(widths[2]) + ' ' + r[3].padEnd(widths[3]) + ' ' +
          r[4].padStart(widths[4]) + ' ' + r[5] + ' ' + r[6]);
      });
    }

    function renderShort(list) {
      list.forEach(function (e) {
        ctx.outln((fl.i ? String(e.node.ino) + ' ' : '') + e.name + classify(e.node));
      });
    }

    if (loose.length) {
      const list = sortEntries(loose.map(function (l) { return { name: l.name, node: l.node }; }));
      if (fl.l) renderLong(list, null); else renderShort(list);
      if (dirs.length) ctx.out('\n');
    }

    const showHeaders = dirs.length + loose.length > 1 || fl.R;

    function listDir(label, node, first) {
      if (!m.canRead(node, sh.user)) {
        ctx.errln("ls: cannot open directory '" + label + "': Permission denied");
        ctx.status = 2;
        return;
      }
      if (showHeaders) {
        if (!first) ctx.out('\n');
        ctx.outln(label + ':');
      }
      const list = entryList(node);
      if (fl.l) renderLong(list, node); else renderShort(list);
      if (fl.R) {
        list.forEach(function (e) {
          if (e.name === '.' || e.name === '..') return;
          if (e.node.type === 'dir') {
            listDir(label === '/' ? '/' + e.name : label + '/' + e.name, e.node, false);
          }
        });
      }
    }

    dirs.forEach(function (dir, i) { listDir(dir.label, dir.node, i === 0 && !loose.length); });
    return ctx.status;
  });

  register('mkdir', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'p v', value: 'm',
                                    long: { '--parents': 'p', '--mode': 'm', '--verbose': 'v' } });
    if (!parsed) return ctx.status;
    if (!parsed.operands.length) return ctx.usage('missing operand');
    const sh = ctx.sh, m = ctx.m;
    const mode = parsed.flags.m ? parseSymbolicMode(parsed.flags.m, 0o777, true)
                                : (0o777 & ~sh.umask);

    parsed.operands.forEach(function (target) {
      if (parsed.flags.p) {
        const abs = sh.abs(target);
        const parts = abs.slice(1).split('/');
        let dir = m.root;
        let sofar = '';
        for (let i = 0; i < parts.length; i++) {
          sofar += '/' + parts[i];
          const existing = dir.entries.get(parts[i]);
          if (existing) {
            if (existing.type !== 'dir') {
              ctx.errln("mkdir: cannot create directory '" + target + "': Not a directory");
              ctx.status = 1;
              return;
            }
            dir = existing;
            continue;
          }
          if (!m.canWrite(dir, sh.user)) {
            ctx.errln("mkdir: cannot create directory '" + sofar + "': Permission denied");
            ctx.status = 1;
            return;
          }
          dir = m.createDir(dir, parts[i], sh.user, mode);
          if (parsed.flags.v) ctx.outln("mkdir: created directory '" + sofar + "'");
        }
        return;
      }
      try {
        const parent = m.resolveParent(target, { cwd: sh.cwd, user: sh.user });
        if (parent.dir.entries.has(parent.name)) {
          ctx.errln("mkdir: cannot create directory '" + target + "': File exists");
          ctx.status = 1;
          return;
        }
        if (!m.canWrite(parent.dir, sh.user)) {
          ctx.errln("mkdir: cannot create directory '" + target + "': Permission denied");
          ctx.status = 1;
          return;
        }
        m.createDir(parent.dir, parent.name, sh.user, mode);
        if (parsed.flags.v) ctx.outln("mkdir: created directory '" + target + "'");
      } catch (err) {
        ctx.errln("mkdir: cannot create directory '" + target + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('rmdir', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'p v', long: { '--parents': 'p' } });
    if (!parsed) return ctx.status;
    if (!parsed.operands.length) return ctx.usage('missing operand');
    const sh = ctx.sh, m = ctx.m;
    parsed.operands.forEach(function (target) {
      try {
        const found = sh.resolve(target, { follow: false });
        if (found.node.type !== 'dir') {
          ctx.errln("rmdir: failed to remove '" + target + "': Not a directory");
          ctx.status = 1; return;
        }
        if (found.node.entries.size) {
          ctx.errln("rmdir: failed to remove '" + target + "': Directory not empty");
          ctx.status = 1; return;
        }
        if (!m.canWrite(found.parent, sh.user)) {
          ctx.errln("rmdir: failed to remove '" + target + "': Permission denied");
          ctx.status = 1; return;
        }
        m.unlink(found.parent, found.name);
      } catch (err) {
        ctx.errln("rmdir: failed to remove '" + target + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('touch', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'a c m', value: 'd t r',
                                    long: { '--date': 'd', '--no-create': 'c', '--reference': 'r' } });
    if (!parsed) return ctx.status;
    if (!parsed.operands.length) return ctx.usage('missing file operand');
    const sh = ctx.sh, m = ctx.m;

    let when = m.now;
    if (parsed.flags.r) {
      try { when = sh.resolve(parsed.flags.r).node.mtime; } catch (e) { /* keep now */ }
    } else if (parsed.flags.d) {
      const parsedDate = Date.parse(parsed.flags.d + 'Z');
      if (!isNaN(parsedDate)) when = parsedDate;
    }

    parsed.operands.forEach(function (target) {
      try {
        const found = sh.resolve(target);
        found.node.mtime = when;
        found.node.atime = when;
      } catch (err) {
        if (!err.isFsError || err.code !== 'ENOENT') {
          ctx.errln("touch: cannot touch '" + target + "': " + err.message);
          ctx.status = 1; return;
        }
        if (parsed.flags.c) return;
        try {
          const parent = m.resolveParent(target, { cwd: sh.cwd, user: sh.user });
          if (!m.canWrite(parent.dir, sh.user)) {
            ctx.errln("touch: cannot touch '" + target + "': Permission denied");
            ctx.status = 1; return;
          }
          const node = m.createFile(parent.dir, parent.name, sh.user, 0o666 & ~sh.umask, '');
          node.mtime = when;
        } catch (e2) {
          ctx.errln("touch: cannot touch '" + target + "': " +
            (e2.isFsError ? e2.message : e2.message));
          ctx.status = 1;
        }
      }
    });
    return ctx.status;
  });

  /** Shared by cp and mv: work out the destination directory and name. */
  function destinationFor(ctx, target, sourceName) {
    const sh = ctx.sh, m = ctx.m;
    try {
      const found = sh.resolve(target);
      if (found.node.type === 'dir') {
        return { dir: found.node, name: sourceName, intoDir: true };
      }
      return { dir: found.parent, name: found.name, existing: found.node };
    } catch (err) {
      if (err.isFsError && err.code === 'ENOENT' && err.parent) {
        return { dir: err.parent, name: err.name };
      }
      throw err;
    }
  }

  register('cp', function (ctx) {
    const parsed = parseArgs(ctx, {
      bool: 'r R a i f v p n u',
      long: { '--recursive': 'r', '--archive': 'a', '--force': 'f', '--verbose': 'v',
              '--preserve': 'p', '--interactive': 'i', '--no-clobber': 'n' }
    });
    if (!parsed) return ctx.status;
    const ops = parsed.operands;
    if (ops.length < 2) return ctx.usage('missing destination file operand');
    const fl = parsed.flags;
    const recursive = fl.r || fl.R || fl.a;
    const sh = ctx.sh, m = ctx.m;
    const sources = ops.slice(0, -1);
    const target = ops[ops.length - 1];

    let targetIsDir = false;
    try { targetIsDir = sh.resolve(target).node.type === 'dir'; } catch (e) { /* new name */ }
    if (sources.length > 1 && !targetIsDir) {
      return ctx.fail("target '" + target + "' is not a directory");
    }

    sources.forEach(function (src) {
      try {
        const from = sh.resolve(src, { follow: !fl.a });
        if (from.node.type === 'dir' && !recursive) {
          ctx.errln("cp: -r not specified; omitting directory '" + src + "'");
          ctx.status = 1; return;
        }
        if (!m.canRead(from.node, sh.user)) {
          ctx.errln("cp: cannot open '" + src + "' for reading: Permission denied");
          ctx.status = 1; return;
        }
        const dest = destinationFor(ctx, target, from.name);
        if (dest.existing && fl.n) return;
        if (!m.canWrite(dest.dir, sh.user) && !dest.existing) {
          ctx.errln("cp: cannot create regular file '" + target + "': Permission denied");
          ctx.status = 1; return;
        }
        const copy = m.copyNode(from.node, sh.user, !!(fl.p || fl.a));
        if (dest.existing && dest.existing.type === 'dir' && copy.type !== 'dir') {
          ctx.errln("cp: cannot overwrite directory '" + target + "' with non-directory");
          ctx.status = 1; return;
        }
        if (dest.dir.entries.has(dest.name) && dest.dir.entries.get(dest.name).type === 'dir') {
          dest.dir.entries.delete(dest.name);
          dest.dir.nlink -= 1;
        }
        dest.dir.entries.set(dest.name, copy);
        if (copy.type === 'dir') dest.dir.nlink += 1;
        m.touchDir(dest.dir);
        if (fl.v) ctx.outln("'" + src + "' -> '" + target + "'");
      } catch (err) {
        ctx.errln("cp: cannot stat '" + src + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('mv', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'i f v n',
                                    long: { '--force': 'f', '--verbose': 'v', '--no-clobber': 'n' } });
    if (!parsed) return ctx.status;
    const ops = parsed.operands;
    if (ops.length < 2) return ctx.usage('missing destination file operand');
    const sh = ctx.sh, m = ctx.m;
    const sources = ops.slice(0, -1);
    const target = ops[ops.length - 1];

    sources.forEach(function (src) {
      try {
        const from = sh.resolve(src, { follow: false });
        if (!m.canWrite(from.parent, sh.user)) {
          ctx.errln("mv: cannot move '" + src + "': Permission denied");
          ctx.status = 1; return;
        }
        const dest = destinationFor(ctx, target, from.name);
        if (dest.existing && parsed.flags.n) return;
        if (!m.canWrite(dest.dir, sh.user)) {
          ctx.errln("mv: cannot move '" + src + "' to '" + target + "': Permission denied");
          ctx.status = 1; return;
        }
        m.unlink(from.parent, from.name);
        if (dest.dir.entries.has(dest.name)) {
          const old = dest.dir.entries.get(dest.name);
          dest.dir.entries.delete(dest.name);
          if (old.type === 'dir') dest.dir.nlink -= 1;
        }
        dest.dir.entries.set(dest.name, from.node);
        if (from.node.type === 'dir') dest.dir.nlink += 1;
        m.touchDir(dest.dir);
        if (parsed.flags.v) ctx.outln("renamed '" + src + "' -> '" + target + "'");
      } catch (err) {
        ctx.errln("mv: cannot stat '" + src + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('rm', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'r R f i v d',
                                    long: { '--recursive': 'r', '--force': 'f',
                                            '--verbose': 'v', '--dir': 'd' } });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    if (!parsed.operands.length) {
      if (fl.f) return 0;
      return ctx.usage('missing operand');
    }
    const sh = ctx.sh, m = ctx.m;

    parsed.operands.forEach(function (target) {
      // The one guard rail: this is a practice box, but wiping the whole tree
      // turns every later question into a dead end, and Reset is the lesson.
      const abs = sh.abs(target);
      if (abs === '/' ) {
        ctx.errln("rm: it is dangerous to operate recursively on '/'");
        ctx.errln('rm: use --no-preserve-root to override this failsafe');
        ctx.status = 1; return;
      }
      try {
        const found = sh.resolve(target, { follow: false });
        if (found.node.type === 'dir' && !(fl.r || fl.R)) {
          ctx.errln("rm: cannot remove '" + target + "': Is a directory");
          ctx.status = 1; return;
        }
        if (!m.canRemoveFrom(found.parent, found.node, sh.user)) {
          ctx.errln("rm: cannot remove '" + target + "': Permission denied");
          ctx.status = 1; return;
        }
        m.unlink(found.parent, found.name);
        if (fl.v) ctx.outln("removed '" + target + "'");
      } catch (err) {
        if (fl.f) return;
        ctx.errln("rm: cannot remove '" + target + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('ln', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 's f v n',
                                    long: { '--symbolic': 's', '--force': 'f', '--verbose': 'v' } });
    if (!parsed) return ctx.status;
    const ops = parsed.operands;
    if (!ops.length) return ctx.usage('missing file operand');
    const sh = ctx.sh, m = ctx.m;
    const symbolic = !!parsed.flags.s;
    const sources = ops.length > 1 ? ops.slice(0, -1) : ops;
    const target = ops.length > 1 ? ops[ops.length - 1] : '.';

    sources.forEach(function (src) {
      const base = src.replace(/\/$/, '').replace(/^.*\//, '');
      let dest;
      try {
        dest = destinationFor(ctx, target, base);
      } catch (err) {
        ctx.errln("ln: failed to access '" + target + "': " + err.message);
        ctx.status = 1; return;
      }
      if (dest.dir.entries.has(dest.name)) {
        if (!parsed.flags.f) {
          ctx.errln("ln: failed to create " + (symbolic ? 'symbolic ' : 'hard ') +
            "link '" + dest.name + "': File exists");
          ctx.status = 1; return;
        }
        m.unlink(dest.dir, dest.name);
      }
      if (!m.canWrite(dest.dir, sh.user)) {
        ctx.errln("ln: failed to create link '" + dest.name + "': Permission denied");
        ctx.status = 1; return;
      }
      if (symbolic) {
        m.createSymlink(dest.dir, dest.name, sh.user, src);
        if (parsed.flags.v) ctx.outln("'" + dest.name + "' -> '" + src + "'");
        return;
      }
      let from;
      try {
        from = sh.resolve(src, { follow: true });
      } catch (err) {
        ctx.errln("ln: failed to access '" + src + "': No such file or directory");
        ctx.status = 1; return;
      }
      if (from.node.type === 'dir') {
        ctx.errln("ln: " + src + ": hard link not allowed for directory");
        ctx.status = 1; return;
      }
      dest.dir.entries.set(dest.name, from.node);
      from.node.nlink += 1;
      m.touchDir(dest.dir);
      if (parsed.flags.v) ctx.outln("'" + dest.name + "' => '" + src + "'");
    });
    return ctx.status;
  });

  register('cat', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'n b A E T s v',
                                    long: { '--number': 'n', '--show-ends': 'E',
                                            '--number-nonblank': 'b', '--squeeze-blank': 's' } });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const chunks = ctx.inputLines(parsed.operands);
    let counter = 0;
    let lastBlank = false;

    chunks.forEach(function (chunk) {
      const lines = splitLines(chunk.text);
      lines.forEach(function (line) {
        if (fl.s && line === '' && lastBlank) return;
        lastBlank = line === '';
        let out = line;
        if (fl.E) out += '$';
        if (fl.T) out = out.replace(/\t/g, '^I');
        if (fl.b) {
          out = line === '' ? out : String(++counter).padStart(6) + '\t' + out;
        } else if (fl.n) {
          out = String(++counter).padStart(6) + '\t' + out;
        }
        ctx.outln(out);
      });
    });
    return ctx.status;
  });

  register('stat', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'L', value: 'c',
                                    long: { '--format': 'c', '--dereference': 'L' } });
    if (!parsed) return ctx.status;
    if (!parsed.operands.length) return ctx.usage('missing operand');
    const sh = ctx.sh, m = ctx.m;

    parsed.operands.forEach(function (target) {
      let found;
      try {
        found = sh.resolve(target, { follow: !!parsed.flags.L });
      } catch (err) {
        ctx.errln("stat: cannot statx '" + target + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 1; return;
      }
      const node = found.node;
      const octal = (node.mode & 0o7777).toString(8).padStart(4, '0');
      if (parsed.flags.c) {
        ctx.outln(parsed.flags.c
          .replace(/%n/g, target)
          .replace(/%a/g, (node.mode & 0o7777).toString(8))
          .replace(/%A/g, modeString(m, node))
          .replace(/%U/g, m.userName(node.uid))
          .replace(/%G/g, m.groupName(node.gid))
          .replace(/%u/g, String(node.uid))
          .replace(/%g/g, String(node.gid))
          .replace(/%s/g, String(m.sizeOf(node)))
          .replace(/%h/g, String(node.nlink))
          .replace(/%i/g, String(node.ino))
          .replace(/%F/g, node.type === 'dir' ? 'directory'
            : node.type === 'symlink' ? 'symbolic link' : 'regular file'));
        return;
      }
      ctx.outln('  File: ' + target +
        (node.type === 'symlink' ? ' -> ' + node.target : ''));
      ctx.outln('  Size: ' + String(m.sizeOf(node)).padEnd(10) +
        '\tBlocks: ' + Math.ceil(m.sizeOf(node) / 512) + '          IO Block: 4096   ' +
        (node.type === 'dir' ? 'directory'
          : node.type === 'symlink' ? 'symbolic link' : 'regular file'));
      ctx.outln('Device: fd00h/64768d\tInode: ' + node.ino + '     Links: ' + node.nlink);
      ctx.outln('Access: (' + octal + '/' + modeString(m, node) + ')  Uid: (' +
        String(node.uid).padStart(5) + '/' + String(m.userName(node.uid)).padStart(8) +
        ')   Gid: (' + String(node.gid).padStart(5) + '/' +
        String(m.groupName(node.gid)).padStart(8) + ')');
      ctx.outln('Access: ' + m.formatFullStamp(node.atime));
      ctx.outln('Modify: ' + m.formatFullStamp(node.mtime));
      ctx.outln('Change: ' + m.formatFullStamp(node.ctime));
      ctx.outln(' Birth: -');
    });
    return ctx.status;
  });

  register('file', function (ctx) {
    const sh = ctx.sh, m = ctx.m;
    if (!ctx.args.length) return ctx.usage('missing operand');
    ctx.args.forEach(function (target) {
      try {
        const found = sh.resolve(target, { follow: false });
        const node = found.node;
        let desc;
        if (node.type === 'dir') desc = 'directory';
        else if (node.type === 'symlink') desc = "symbolic link to " + node.target;
        else {
          const text = m.read(node);
          if (text === '') desc = 'empty';
          else if (/^#!/.test(text)) desc = 'a ' + /^#!\s*(\S+)/.exec(text)[1] + ' script, ASCII text executable';
          else if (/\(ELF/.test(text)) desc = 'ELF 64-bit LSB executable, x86-64, dynamically linked';
          else if (/\(binary|\(tar|\(kernel|\(rpm|\(gpg|\(initramfs|\(locate/.test(text)) desc = 'data';
          else desc = 'ASCII text';
        }
        ctx.outln(target + ': ' + desc);
      } catch (err) {
        ctx.outln(target + ': cannot open (No such file or directory)');
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('basename', function (ctx) {
    if (!ctx.args.length) return ctx.usage('missing operand');
    let name = ctx.args[0].replace(/\/+$/, '').replace(/^.*\//, '');
    if (ctx.args[1] && name.slice(-ctx.args[1].length) === ctx.args[1] && name !== ctx.args[1]) {
      name = name.slice(0, -ctx.args[1].length);
    }
    ctx.outln(name || '/');
    return 0;
  });

  register('dirname', function (ctx) {
    if (!ctx.args.length) return ctx.usage('missing operand');
    ctx.args.forEach(function (a) {
      const trimmed = a.replace(/\/+$/, '');
      const idx = trimmed.lastIndexOf('/');
      ctx.outln(idx === -1 ? '.' : (idx === 0 ? '/' : trimmed.slice(0, idx)));
    });
    return 0;
  });

  register('readlink', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'f e m', long: { '--canonicalize': 'f' } });
    if (!parsed) return ctx.status;
    if (!parsed.operands.length) return ctx.usage('missing operand');
    const sh = ctx.sh;
    parsed.operands.forEach(function (target) {
      try {
        if (parsed.flags.f) {
          const found = sh.resolve(target);
          ctx.outln(ctx.m.pathOf(found.node) || sh.abs(target));
          return;
        }
        const found = sh.resolve(target, { follow: false });
        if (found.node.type !== 'symlink') { ctx.status = 1; return; }
        ctx.outln(found.node.target);
      } catch (err) { ctx.status = 1; }
    });
    return ctx.status;
  });

  register('realpath', function (ctx) {
    const sh = ctx.sh;
    (ctx.args.length ? ctx.args : ['.']).forEach(function (target) {
      try {
        const found = sh.resolve(target);
        ctx.outln(ctx.m.pathOf(found.node) || sh.abs(target));
      } catch (err) {
        ctx.errln("realpath: " + target + ": No such file or directory");
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('tree', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'a d f', value: 'L' });
    if (!parsed) return ctx.status;
    const sh = ctx.sh, m = ctx.m;
    const root = parsed.operands[0] || '.';
    const maxDepth = parsed.flags.L ? parseInt(parsed.flags.L, 10) : Infinity;
    let dirs = 0, files = 0;

    let start;
    try { start = sh.resolve(root); } catch (err) {
      ctx.errln(root + ' [error opening dir]');
      ctx.outln('');
      ctx.outln('0 directories, 0 files');
      return 1;
    }
    ctx.outln(root);

    function walk(node, prefix, depth) {
      if (depth > maxDepth) return;
      if (!m.canRead(node, sh.user)) return;
      const names = Array.from(node.entries.keys())
        .filter(function (n) { return parsed.flags.a || n.charAt(0) !== '.'; })
        .filter(function (n) { return !parsed.flags.d || node.entries.get(n).type === 'dir'; })
        .sort();
      names.forEach(function (name, i) {
        const child = node.entries.get(name);
        const last = i === names.length - 1;
        ctx.outln(prefix + (last ? '└── ' : '├── ') + name +
          (child.type === 'symlink' ? ' -> ' + child.target : ''));
        if (child.type === 'dir') {
          dirs++;
          walk(child, prefix + (last ? '    ' : '│   '), depth + 1);
        } else files++;
      });
    }

    if (start.node.type === 'dir') walk(start.node, '', 1);
    ctx.outln('');
    ctx.outln(dirs + (dirs === 1 ? ' directory, ' : ' directories, ') +
      files + (files === 1 ? ' file' : ' files'));
    return 0;
  });

  /* Mode parsing is shared by chmod, mkdir -m and install. */

  /**
   * Parse either 0755 or u+rwx,go-w against a starting mode.
   * `isDir` decides what a bare `+X` means.
   */
  function parseSymbolicMode(spec, current, isDir) {
    if (/^[0-7]{1,4}$/.test(spec)) return parseInt(spec, 8);
    let mode = current;
    const clauses = String(spec).split(',');
    for (let i = 0; i < clauses.length; i++) {
      const m = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(clauses[i]);
      if (!m) return null;
      let who = m[1] || 'a';
      const op = m[2];
      const what = m[3];

      let bits = 0;
      if (what.indexOf('r') !== -1) bits |= 4;
      if (what.indexOf('w') !== -1) bits |= 2;
      if (what.indexOf('x') !== -1) bits |= 1;
      if (what.indexOf('X') !== -1 && (isDir || (current & 0o111))) bits |= 1;

      const targets = [];
      if (who.indexOf('a') !== -1) targets.push(6, 3, 0);
      else {
        if (who.indexOf('u') !== -1) targets.push(6);
        if (who.indexOf('g') !== -1) targets.push(3);
        if (who.indexOf('o') !== -1) targets.push(0);
      }

      targets.forEach(function (shift) {
        if (op === '+') mode |= bits << shift;
        else if (op === '-') mode &= ~(bits << shift);
        else {
          mode &= ~(7 << shift);
          mode |= bits << shift;
        }
      });

      if (what.indexOf('s') !== -1) {
        const setBits = (who.indexOf('u') !== -1 || who === 'a' ? 0o4000 : 0) |
                        (who.indexOf('g') !== -1 || who === 'a' ? 0o2000 : 0);
        if (op === '-') mode &= ~setBits; else mode |= setBits;
      }
      if (what.indexOf('t') !== -1) {
        if (op === '-') mode &= ~0o1000; else mode |= 0o1000;
      }
    }
    return mode;
  }

  /* =========================================================================
   * Public surface
   * ======================================================================= */

  function create(box, opts) { return new Shell(box, opts); }

  return {
    create: create,
    Shell: Shell,
    register: register,
    registerBuiltin: registerBuiltin,
    commands: COMMANDS,
    builtins: BUILTINS,
    parseArgs: parseArgs,
    splitLines: splitLines,
    modeString: modeString,
    humanSize: humanSize,
    parseSymbolicMode: parseSymbolicMode,
    rwxLetters: rwxLetters,
    check: check,
    checkEffect: checkEffect,
    compareOutput: compareOutput,
    tokenize: tokenize,
    pendingHeredoc: pendingHeredoc
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HarborShell;
