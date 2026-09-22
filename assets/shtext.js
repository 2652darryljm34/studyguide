/* ===========================================================================
 * The text-processing commands -- chapter 9's pipeline toolkit, plus find.
 *
 *   grep sed awk sort uniq cut tr wc head tail tee nl tac rev
 *   find xargs diff cmp paste seq yes sleep split md5sum less more
 *
 * sed and awk are small interpreters rather than pattern hacks, because the
 * course uses them for real work: sed has addresses and s///g with flags, awk
 * has BEGIN/END, field and record variables, arrays, and the handful of
 * functions that show up in one-liners. Anything outside that subset reports
 * itself plainly instead of quietly returning the wrong answer.
 * =========================================================================== */
(function () {
  'use strict';

  const S = typeof HarborShell !== 'undefined' ? HarborShell : require('./shell.js');
  const register = S.register;
  const parseArgs = S.parseArgs;
  const splitLines = S.splitLines;

  /* =========================================================================
   * Regular expressions
   *
   * POSIX basic expressions (grep, sed) differ from extended ones (grep -E,
   * awk): in a basic expression + ? { } ( ) | are literals until escaped, and
   * escaping flips the meaning. Convert to JavaScript's flavour either way.
   * ======================================================================= */

  function toRegexSource(pattern, extended) {
    let out = '';
    let i = 0;
    const p = String(pattern);

    while (i < p.length) {
      const c = p[i];

      if (c === '\\') {
        const nxt = p[i + 1];
        if (nxt === undefined) { out += '\\\\'; i++; continue; }
        if (!extended && '(){}|+?'.indexOf(nxt) !== -1) { out += nxt; i += 2; continue; }
        if (extended && '(){}|+?'.indexOf(nxt) !== -1) { out += '\\' + nxt; i += 2; continue; }
        if (nxt === '<' || nxt === '>') { out += '\\b'; i += 2; continue; }
        if (nxt === 'b') { out += '\\b'; i += 2; continue; }
        if ('wWsSdDnrt.*[]^$\\/'.indexOf(nxt) !== -1) { out += '\\' + nxt; i += 2; continue; }
        out += '\\' + nxt;
        i += 2;
        continue;
      }

      if (c === '[') {
        // A bracket expression is copied across, translating [:class:] names.
        let j = i + 1;
        let body = '';
        if (p[j] === '^') { body += '^'; j++; }
        if (p[j] === ']') { body += '\\]'; j++; }
        while (j < p.length && p[j] !== ']') {
          if (p.slice(j, j + 2) === '[:') {
            const end = p.indexOf(':]', j);
            if (end !== -1) {
              const cls = p.slice(j + 2, end);
              const map = {
                alpha: 'A-Za-z', digit: '0-9', alnum: 'A-Za-z0-9', upper: 'A-Z',
                lower: 'a-z', space: ' \\t\\n\\r\\f\\v', blank: ' \\t',
                punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', print: ' -~', graph: '!-~'
              };
              body += map[cls] || '';
              j = end + 2;
              continue;
            }
          }
          body += p[j] === '\\' ? '\\\\' : p[j];
          j++;
        }
        out += '[' + body + ']';
        i = j + 1;
        continue;
      }

      if (!extended && '+?{}()|'.indexOf(c) !== -1) { out += '\\' + c; i++; continue; }
      out += c;
      i++;
    }
    return out;
  }

  function makeRegex(pattern, opts) {
    opts = opts || {};
    let src = opts.fixed
      ? String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : toRegexSource(pattern, !!opts.extended);
    if (opts.word) src = '\\b(?:' + src + ')\\b';
    if (opts.line) src = '^(?:' + src + ')$';
    return new RegExp(src, (opts.ignoreCase ? 'i' : '') + (opts.global ? 'g' : ''));
  }

  /* =========================================================================
   * grep
   * ======================================================================= */

  register('grep egrep fgrep', function (ctx) {
    const parsed = parseArgs(ctx, {
      bool: 'i v n c l L w x r R E F o q h s a',
      value: 'e A B C m f',
      long: {
        '--ignore-case': 'i', '--invert-match': 'v', '--line-number': 'n',
        '--count': 'c', '--files-with-matches': 'l', '--files-without-match': 'L',
        '--word-regexp': 'w', '--line-regexp': 'x', '--recursive': 'r',
        '--extended-regexp': 'E', '--fixed-strings': 'F', '--only-matching': 'o',
        '--quiet': 'q', '--no-filename': 'h', '--regexp': 'e',
        '--after-context': 'A', '--before-context': 'B', '--context': 'C',
        '--max-count': 'm', '--color': 'color', '--colour': 'color'
      }
    });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const sh = ctx.sh, m = ctx.m;

    const patterns = [];
    if (fl.e !== undefined) patterns.push(fl.e);
    let operands = parsed.operands.slice();
    if (!patterns.length) {
      if (!operands.length) return ctx.usage('usage: grep [OPTION]... PATTERNS [FILE]...');
      patterns.push(operands.shift());
    }

    const extended = ctx.name === 'egrep' || !!fl.E;
    const fixed = ctx.name === 'fgrep' || !!fl.F;
    const res = [];
    patterns.forEach(function (p) {
      String(p).split('\n').forEach(function (line) {
        res.push(makeRegex(line, {
          extended: extended, fixed: fixed, ignoreCase: !!fl.i,
          word: !!fl.w, line: !!fl.x
        }));
      });
    });

    const after = parseInt(fl.A || fl.C || 0, 10) || 0;
    const before = parseInt(fl.B || fl.C || 0, 10) || 0;
    const maxCount = fl.m ? parseInt(fl.m, 10) : Infinity;

    /* Recursive search walks the tree, skipping what cannot be read. */
    const files = [];
    if (fl.r || fl.R) {
      const roots = operands.length ? operands : ['.'];
      roots.forEach(function (root) {
        try {
          const found = sh.resolve(root);
          collect(found.node, root === '.' ? '.' : root);
        } catch (err) {
          ctx.errln('grep: ' + root + ': No such file or directory');
          ctx.status = 2;
        }
      });
      function collect(node, label) {
        if (node.type === 'dir') {
          if (!m.canRead(node, sh.user)) {
            ctx.errln('grep: ' + label + ': Permission denied');
            ctx.status = 2;
            return;
          }
          Array.from(node.entries.keys()).sort().forEach(function (name) {
            collect(node.entries.get(name), label === '.' ? './' + name : label + '/' + name);
          });
          return;
        }
        if (node.type === 'symlink') return;
        files.push({ name: label, node: node });
      }
    } else if (operands.length) {
      operands.forEach(function (p) {
        try {
          const found = sh.resolve(p);
          if (found.node.type === 'dir') {
            ctx.errln('grep: ' + p + ': Is a directory');
            return;
          }
          files.push({ name: p, node: found.node });
        } catch (err) {
          if (!fl.s) ctx.errln('grep: ' + p + ': No such file or directory');
          ctx.status = 2;
        }
      });
    }

    const showName = !fl.h && (files.length > 1 || fl.r || fl.R);
    let anyMatch = false;

    function searchText(text, label) {
      const lines = splitLines(text);
      const hits = [];
      lines.forEach(function (line, idx) {
        const matched = res.some(function (re) { re.lastIndex = 0; return re.test(line); });
        if (matched !== !!fl.v) hits.push(idx);
      });

      if (hits.length) anyMatch = true;
      if (fl.q) return;
      if (fl.l) { if (hits.length) ctx.outln(label); return; }
      if (fl.L) { if (!hits.length) ctx.outln(label); return; }
      if (fl.c) { ctx.outln((showName ? label + ':' : '') + Math.min(hits.length, maxCount)); return; }

      const prefix = showName ? label + ':' : '';
      let printed = 0;
      const shown = new Set();
      hits.forEach(function (idx) {
        if (printed >= maxCount) return;
        printed++;
        for (let k = Math.max(0, idx - before); k <= Math.min(lines.length - 1, idx + after); k++) {
          if (shown.has(k)) continue;
          shown.add(k);
          const sep = k === idx ? ':' : '-';
          if (fl.o && k === idx && !fl.v) {
            res.forEach(function (re) {
              const g = new RegExp(re.source, re.flags.indexOf('g') === -1 ? re.flags + 'g' : re.flags);
              let mm;
              while ((mm = g.exec(lines[k])) !== null) {
                ctx.outln(prefix + (fl.n ? (k + 1) + sep : '') + mm[0]);
                if (mm.index === g.lastIndex) g.lastIndex++;
              }
            });
            continue;
          }
          ctx.outln(prefix + (fl.n ? (k + 1) + sep : '') + lines[k]);
        }
      });
    }

    if (!files.length) searchText(ctx.stdin, '(standard input)');
    else files.forEach(function (f) {
      if (!m.canRead(f.node, sh.user)) {
        if (!fl.s) ctx.errln('grep: ' + f.name + ': Permission denied');
        ctx.status = 2;
        return;
      }
      searchText(m.read(f.node), f.name);
    });

    if (ctx.status === 2) return 2;
    return anyMatch ? 0 : 1;
  });

  /* =========================================================================
   * sed
   * ======================================================================= */

  /** Split s/a/b/flags on its delimiter, honouring backslash escapes. */
  function splitDelimited(str, start, delim, count) {
    const parts = [];
    let cur = '';
    let i = start;
    while (i < str.length && parts.length < count) {
      const c = str[i];
      if (c === '\\' && i + 1 < str.length) {
        if (str[i + 1] === delim) { cur += delim; i += 2; continue; }
        cur += c + str[i + 1]; i += 2; continue;
      }
      if (c === delim) { parts.push(cur); cur = ''; i++; continue; }
      cur += c; i++;
    }
    return { parts: parts, rest: str.slice(i) };
  }

  function parseSedScript(script, extended) {
    const commands = [];
    String(script).split('\n').forEach(function (raw) {
      let line = raw.trim();
      if (line === '' || line.charAt(0) === '#') return;

      const cmd = { addr1: null, addr2: null, negate: false };

      function takeAddress() {
        let m;
        if ((m = /^\$/.exec(line))) { line = line.slice(1); return { type: 'last' }; }
        if ((m = /^(\d+)/.exec(line))) { line = line.slice(m[0].length); return { type: 'line', n: +m[1] }; }
        if (line.charAt(0) === '/') {
          const split = splitDelimited(line, 1, '/', 1);
          line = split.rest;
          return { type: 'regex', re: makeRegex(split.parts[0], { extended: extended }) };
        }
        return null;
      }

      cmd.addr1 = takeAddress();
      if (cmd.addr1 && line.charAt(0) === ',') {
        line = line.slice(1);
        cmd.addr2 = takeAddress();
      }
      line = line.replace(/^\s+/, '');
      if (line.charAt(0) === '!') { cmd.negate = true; line = line.slice(1).replace(/^\s+/, ''); }

      const verb = line.charAt(0);
      cmd.verb = verb;

      if (verb === 's' || verb === 'y') {
        const delim = line.charAt(1);
        const split = splitDelimited(line, 2, delim, 2);
        cmd.pattern = split.parts[0];
        cmd.replacement = split.parts[1] === undefined ? '' : split.parts[1];
        cmd.flags = split.rest.replace(/[;\s].*$/, '');
        if (verb === 's') {
          cmd.re = makeRegex(cmd.pattern, {
            extended: extended,
            ignoreCase: cmd.flags.indexOf('i') !== -1 || cmd.flags.indexOf('I') !== -1,
            global: cmd.flags.indexOf('g') !== -1
          });
          const nth = /(\d+)/.exec(cmd.flags);
          cmd.nth = nth ? +nth[1] : 0;
          cmd.print = cmd.flags.indexOf('p') !== -1;
        }
      } else if (verb === 'a' || verb === 'i' || verb === 'c') {
        cmd.text = line.slice(1).replace(/^\\?\s*/, '');
      } else if (verb === 'q') {
        cmd.exitCode = parseInt(line.slice(1), 10) || 0;
      }
      commands.push(cmd);
    });
    return commands;
  }

  function sedApplies(cmd, lineNo, line, total, state) {
    let hit;
    if (!cmd.addr1) hit = true;
    else if (!cmd.addr2) hit = matchAddr(cmd.addr1, lineNo, line, total);
    else {
      // A range stays open until its end address matches.
      if (state.inRange) {
        hit = true;
        if (matchAddr(cmd.addr2, lineNo, line, total)) state.inRange = false;
      } else if (matchAddr(cmd.addr1, lineNo, line, total)) {
        hit = true;
        state.inRange = !matchAddr(cmd.addr2, lineNo, line, total) ||
          cmd.addr2.type === 'regex';
      } else hit = false;
    }
    return cmd.negate ? !hit : hit;
  }

  function matchAddr(addr, lineNo, line, total) {
    if (!addr) return false;
    if (addr.type === 'last') return lineNo === total;
    if (addr.type === 'line') return lineNo === addr.n;
    addr.re.lastIndex = 0;
    return addr.re.test(line);
  }

  /** Expand &, \1..\9 and \n in a replacement. */
  function sedReplacement(rep) {
    return String(rep)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\$/g, '$$$$')
      .replace(/(^|[^\\])&/g, '$1$$&')
      .replace(/\\&/g, '&')
      .replace(/\\(\d)/g, '$$$1');
  }

  register('sed', function (ctx) {
    const parsed = parseArgs(ctx, {
      bool: 'n r E s i',
      value: 'e f',
      long: { '--quiet': 'n', '--silent': 'n', '--expression': 'e',
              '--regexp-extended': 'E', '--in-place': 'i', '--separate': 's' }
    });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const sh = ctx.sh, m = ctx.m;
    let operands = parsed.operands.slice();

    // -i takes an optional suffix, so it may have swallowed the script.
    let inPlace = false;
    if (fl.i !== undefined) inPlace = true;

    let script = fl.e;
    if (script === undefined) {
      if (!operands.length) return ctx.usage('no script specified');
      script = operands.shift();
    }

    const commands = parseSedScript(script, !!(fl.r || fl.E));
    const states = commands.map(function () { return { inRange: false }; });

    function runOn(text) {
      const lines = splitLines(text);
      const total = lines.length;
      let out = [];
      let quit = false;

      for (let i = 0; i < lines.length && !quit; i++) {
        let line = lines[i];
        let deleted = false;
        const appends = [];

        for (let c = 0; c < commands.length; c++) {
          const cmd = commands[c];
          if (!sedApplies(cmd, i + 1, line, total, states[c])) continue;

          if (cmd.verb === 's') {
            if (cmd.nth) {
              let seen = 0;
              const g = new RegExp(cmd.re.source, cmd.re.flags.indexOf('g') === -1
                ? cmd.re.flags + 'g' : cmd.re.flags);
              line = line.replace(g, function (match) {
                seen++;
                if (seen < cmd.nth) return match;
                if (seen > cmd.nth && cmd.flags.indexOf('g') === -1) return match;
                return match.replace(cmd.re, sedReplacement(cmd.replacement));
              });
            } else {
              line = line.replace(cmd.re, sedReplacement(cmd.replacement));
            }
            if (cmd.print) out.push(line);
          } else if (cmd.verb === 'y') {
            const from = cmd.pattern, to = cmd.replacement;
            line = line.split('').map(function (ch) {
              const idx = from.indexOf(ch);
              return idx === -1 ? ch : to.charAt(idx);
            }).join('');
          } else if (cmd.verb === 'd') {
            deleted = true;
            break;
          } else if (cmd.verb === 'p') {
            out.push(line);
          } else if (cmd.verb === '=') {
            out.push(String(i + 1));
          } else if (cmd.verb === 'a') {
            appends.push(cmd.text);
          } else if (cmd.verb === 'i') {
            out.push(cmd.text);
          } else if (cmd.verb === 'c') {
            out.push(cmd.text);
            deleted = true;
            break;
          } else if (cmd.verb === 'q') {
            if (!fl.n) out.push(line);
            quit = true;
            break;
          } else {
            ctx.errln("sed: -e expression #1, char 1: unknown command: `" + cmd.verb + "'");
            ctx.status = 1;
            return null;
          }
        }

        if (!deleted && !fl.n && !quit) out.push(line);
        appends.forEach(function (t) { out.push(t); });
      }
      return out.join('\n') + (out.length ? '\n' : '');
    }

    if (inPlace) {
      if (!operands.length) return ctx.fail('no input files');
      operands.forEach(function (p) {
        try {
          const found = sh.resolve(p);
          if (!m.canWrite(found.node, sh.user)) {
            ctx.errln("sed: couldn't open file " + p + ': Permission denied');
            ctx.status = 4;
            return;
          }
          const result = runOn(m.read(found.node));
          if (result === null) return;
          found.node.content = result;
          found.node.synth = null;
          found.node.mtime = m.now;
        } catch (err) {
          ctx.errln("sed: can't read " + p + ': No such file or directory');
          ctx.status = 2;
        }
      });
      return ctx.status;
    }

    const chunks = ctx.inputLines(operands);
    chunks.forEach(function (chunk) {
      const result = runOn(chunk.text);
      if (result !== null) ctx.out(result);
    });
    return ctx.status;
  });

  /* =========================================================================
   * awk
   * ======================================================================= */

  /* --- expression parser: a small recursive-descent over awk's operators --- */

  function AwkParser(src) {
    this.src = src;
    this.pos = 0;
    this.tokens = this.lex(src);
    this.i = 0;
  }

  AwkParser.prototype.lex = function (src) {
    const out = [];
    let i = 0;
    const isIdStart = function (c) { return /[A-Za-z_]/.test(c); };

    while (i < src.length) {
      const c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '\n' || c === ';') { out.push({ t: 'nl' }); i++; continue; }

      if (c === '"') {
        let j = i + 1, s = '';
        while (j < src.length && src[j] !== '"') {
          if (src[j] === '\\') {
            const n = src[j + 1];
            s += n === 'n' ? '\n' : n === 't' ? '\t' : n === '\\' ? '\\' : n;
            j += 2;
            continue;
          }
          s += src[j]; j++;
        }
        out.push({ t: 'str', v: s });
        i = j + 1;
        continue;
      }

      // A slash starts a regex unless the previous token could end an operand.
      if (c === '/') {
        const prev = out[out.length - 1];
        const divisible = prev && (prev.t === 'num' || prev.t === 'str' || prev.t === 'id' ||
          (prev.t === 'op' && (prev.v === ')' || prev.v === ']')));
        if (!divisible) {
          let j = i + 1, s = '';
          while (j < src.length && src[j] !== '/') {
            if (src[j] === '\\') { s += src[j] + src[j + 1]; j += 2; continue; }
            s += src[j]; j++;
          }
          out.push({ t: 'regex', v: s });
          i = j + 1;
          continue;
        }
      }

      if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] || ''))) {
        const m = /^\d*\.?\d+(?:[eE][-+]?\d+)?/.exec(src.slice(i));
        out.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }

      if (isIdStart(c)) {
        const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
        out.push({ t: 'id', v: m[0] });
        i += m[0].length;
        continue;
      }

      const three = src.substr(i, 3);
      const two = src.substr(i, 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '!~']
          .indexOf(two) !== -1) {
        out.push({ t: 'op', v: two }); i += 2; continue;
      }
      out.push({ t: 'op', v: c });
      i++;
    }
    out.push({ t: 'eof' });
    return out;
  };

  AwkParser.prototype.peek = function () { return this.tokens[this.i]; };
  AwkParser.prototype.next = function () { return this.tokens[this.i++]; };
  AwkParser.prototype.isOp = function (v) {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  };
  AwkParser.prototype.eat = function (v) {
    if (this.isOp(v)) { this.i++; return true; }
    return false;
  };
  AwkParser.prototype.expect = function (v) {
    if (!this.eat(v)) throw new Error("awk: syntax error: expected '" + v + "'");
  };

  AwkParser.prototype.parseExpr = function () { return this.parseTernary(); };

  AwkParser.prototype.parseTernary = function () {
    const cond = this.parseOr();
    if (this.eat('?')) {
      const a = this.parseTernary();
      this.expect(':');
      const b = this.parseTernary();
      return { k: 'ternary', cond: cond, a: a, b: b };
    }
    return cond;
  };

  AwkParser.prototype.parseOr = function () {
    let left = this.parseAnd();
    while (this.isOp('||')) { this.next(); left = { k: 'or', l: left, r: this.parseAnd() }; }
    return left;
  };

  AwkParser.prototype.parseAnd = function () {
    let left = this.parseIn();
    while (this.isOp('&&')) { this.next(); left = { k: 'and', l: left, r: this.parseIn() }; }
    return left;
  };

  AwkParser.prototype.parseIn = function () {
    let left = this.parseMatch();
    while (this.peek().t === 'id' && this.peek().v === 'in') {
      this.next();
      const arr = this.next();
      left = { k: 'in', key: left, arr: arr.v };
    }
    return left;
  };

  AwkParser.prototype.parseMatch = function () {
    let left = this.parseCompare();
    while (this.isOp('~') || this.isOp('!~')) {
      const op = this.next().v;
      left = { k: 'match', neg: op === '!~', l: left, r: this.parseCompare() };
    }
    return left;
  };

  AwkParser.prototype.parseCompare = function () {
    let left = this.parseConcat();
    while (this.peek().t === 'op' && ['<', '>', '<=', '>=', '==', '!='].indexOf(this.peek().v) !== -1) {
      const op = this.next().v;
      left = { k: 'cmp', op: op, l: left, r: this.parseConcat() };
    }
    return left;
  };

  /** Juxtaposition is string concatenation in awk: `$1 " " $2`. */
  AwkParser.prototype.parseConcat = function () {
    let left = this.parseAdd();
    while (true) {
      const t = this.peek();
      const starts = (t.t === 'num' || t.t === 'str' || t.t === 'id' || t.t === 'regex' ||
        (t.t === 'op' && (t.v === '$' || t.v === '(' || t.v === '!' || t.v === '-')));
      if (!starts) break;
      if (t.t === 'id' && (t.v === 'in')) break;
      left = { k: 'concat', l: left, r: this.parseAdd() };
    }
    return left;
  };

  AwkParser.prototype.parseAdd = function () {
    let left = this.parseMul();
    while (this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) {
      const op = this.next().v;
      left = { k: 'bin', op: op, l: left, r: this.parseMul() };
    }
    return left;
  };

  AwkParser.prototype.parseMul = function () {
    let left = this.parseUnary();
    while (this.peek().t === 'op' && ['*', '/', '%', '^'].indexOf(this.peek().v) !== -1) {
      const op = this.next().v;
      left = { k: 'bin', op: op, l: left, r: this.parseUnary() };
    }
    return left;
  };

  AwkParser.prototype.parseUnary = function () {
    if (this.isOp('!')) { this.next(); return { k: 'not', e: this.parseUnary() }; }
    if (this.isOp('-')) { this.next(); return { k: 'neg', e: this.parseUnary() }; }
    if (this.isOp('+')) { this.next(); return this.parseUnary(); }
    if (this.isOp('++') || this.isOp('--')) {
      const op = this.next().v;
      const target = this.parseUnary();
      return { k: 'preincr', op: op, target: target };
    }
    return this.parsePostfix();
  };

  AwkParser.prototype.parsePostfix = function () {
    let e = this.parsePrimary();
    while (this.isOp('++') || this.isOp('--')) {
      const op = this.next().v;
      e = { k: 'postincr', op: op, target: e };
    }
    return e;
  };

  AwkParser.prototype.parsePrimary = function () {
    const t = this.next();
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'regex') return { k: 'regex', v: t.v };
    if (t.t === 'op' && t.v === '$') return { k: 'field', e: this.parseUnary() };
    if (t.t === 'op' && t.v === '(') {
      const e = this.parseExpr();
      // A parenthesised list is used by `(a, b) in arr` and print (a, b).
      const list = [e];
      while (this.eat(',')) list.push(this.parseExpr());
      this.expect(')');
      return list.length === 1 ? e : { k: 'list', items: list };
    }
    if (t.t === 'id') {
      if (this.isOp('(')) {
        this.next();
        const args = [];
        if (!this.isOp(')')) {
          args.push(this.parseExpr());
          while (this.eat(',')) args.push(this.parseExpr());
        }
        this.expect(')');
        return { k: 'call', name: t.v, args: args };
      }
      if (this.isOp('[')) {
        this.next();
        const idx = [this.parseExpr()];
        while (this.eat(',')) idx.push(this.parseExpr());
        this.expect(']');
        return { k: 'index', name: t.v, idx: idx };
      }
      return { k: 'var', name: t.v };
    }
    throw new Error('awk: syntax error at or near ' + (t.v === undefined ? 'end of line' : t.v));
  };

  /* --- statements --- */

  AwkParser.prototype.skipTerms = function () {
    while (this.peek().t === 'nl') this.next();
  };

  AwkParser.prototype.parseBlock = function () {
    this.expect('{');
    const stmts = [];
    this.skipTerms();
    while (!this.isOp('}') && this.peek().t !== 'eof') {
      stmts.push(this.parseStatement());
      this.skipTerms();
    }
    this.expect('}');
    return { k: 'block', stmts: stmts };
  };

  AwkParser.prototype.parseStatement = function () {
    const t = this.peek();

    if (t.t === 'op' && t.v === '{') return this.parseBlock();

    if (t.t === 'id' && (t.v === 'print' || t.v === 'printf')) {
      this.next();
      const args = [];
      let redirect = null;
      while (this.peek().t !== 'nl' && this.peek().t !== 'eof' &&
             !this.isOp('}') && !this.isOp('>')) {
        args.push(this.parseExpr());
        if (!this.eat(',')) break;
      }
      if (this.isOp('>')) { this.next(); redirect = this.parseExpr(); }
      return { k: t.v, args: args, redirect: redirect };
    }

    if (t.t === 'id' && t.v === 'if') {
      this.next();
      this.expect('(');
      const cond = this.parseExpr();
      this.expect(')');
      this.skipTerms();
      const then = this.parseStatement();
      this.skipTerms();
      let otherwise = null;
      if (this.peek().t === 'id' && this.peek().v === 'else') {
        this.next();
        this.skipTerms();
        otherwise = this.parseStatement();
      }
      return { k: 'if', cond: cond, then: then, otherwise: otherwise };
    }

    if (t.t === 'id' && t.v === 'while') {
      this.next();
      this.expect('(');
      const cond = this.parseExpr();
      this.expect(')');
      this.skipTerms();
      return { k: 'while', cond: cond, body: this.parseStatement() };
    }

    if (t.t === 'id' && t.v === 'for') {
      this.next();
      this.expect('(');
      // for (k in arr) or the C-style three-part form
      const save = this.i;
      if (this.peek().t === 'id') {
        const name = this.next().v;
        if (this.peek().t === 'id' && this.peek().v === 'in') {
          this.next();
          const arr = this.next().v;
          this.expect(')');
          this.skipTerms();
          return { k: 'forin', name: name, arr: arr, body: this.parseStatement() };
        }
        this.i = save;
      }
      const init = this.isOp(';') ? null : this.parseSimple();
      this.expect(';');
      const cond = this.isOp(';') ? null : this.parseExpr();
      this.expect(';');
      const step = this.isOp(')') ? null : this.parseSimple();
      this.expect(')');
      this.skipTerms();
      return { k: 'for', init: init, cond: cond, step: step, body: this.parseStatement() };
    }

    if (t.t === 'id' && (t.v === 'next' || t.v === 'exit')) {
      this.next();
      const code = (this.peek().t === 'num') ? this.next().v : 0;
      return { k: t.v, code: code };
    }

    if (t.t === 'id' && t.v === 'delete') {
      this.next();
      const target = this.parsePrimary();
      return { k: 'delete', target: target };
    }

    return this.parseSimple();
  };

  AwkParser.prototype.parseSimple = function () {
    const e = this.parseExpr();
    if (this.peek().t === 'op' &&
        ['=', '+=', '-=', '*=', '/=', '%='].indexOf(this.peek().v) !== -1) {
      const op = this.next().v;
      return { k: 'assign', op: op, target: e, value: this.parseExpr() };
    }
    return { k: 'expr', e: e };
  };

  /** A whole program: pattern { action } rules plus BEGIN and END. */
  function parseAwkProgram(src) {
    const p = new AwkParser(src);
    const rules = [];
    p.skipTerms();
    while (p.peek().t !== 'eof') {
      const t = p.peek();
      if (t.t === 'id' && (t.v === 'BEGIN' || t.v === 'END')) {
        p.next();
        rules.push({ when: t.v, action: p.parseBlock() });
      } else if (p.isOp('{')) {
        rules.push({ when: null, action: p.parseBlock() });
      } else {
        const pattern = p.parseExpr();
        let pattern2 = null;
        if (p.eat(',')) pattern2 = p.parseExpr();
        const action = p.isOp('{') ? p.parseBlock() : null;
        rules.push({ when: 'pattern', pattern: pattern, pattern2: pattern2, action: action });
      }
      p.skipTerms();
    }
    return rules;
  }

  /* --- the interpreter --- */

  function AwkRun(ctx, rules, vars) {
    this.ctx = ctx;
    this.rules = rules;
    this.vars = Object.assign({
      FS: ' ', OFS: ' ', ORS: '\n', NR: 0, NF: 0, FNR: 0, RS: '\n',
      FILENAME: '', SUBSEP: '\u001c', CONVFMT: '%.6g', OFMT: '%.6g'
    }, vars || {});
    this.arrays = Object.create(null);
    this.fields = [''];
    this.exited = false;
    this.exitCode = 0;
    this.ranges = rules.map(function () { return false; });
  }

  function numify(v) {
    if (typeof v === 'number') return v;
    if (v === undefined || v === null || v === '') return 0;
    const m = /^[ \t]*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(String(v));
    return m ? parseFloat(m[0]) : 0;
  }

  function stringify(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      return String(parseFloat(v.toPrecision(6)));
    }
    return String(v);
  }

  function truthy(v) {
    if (typeof v === 'number') return v !== 0;
    if (v === undefined || v === null) return false;
    return String(v) !== '' && String(v) !== '0' ? true : (String(v) === '0' ? false : false);
  }

  AwkRun.prototype.setRecord = function (line) {
    this.record = line;
    const fs = String(this.vars.FS);
    let parts;
    if (fs === ' ') parts = line.trim() === '' ? [] : line.trim().split(/[ \t\n]+/);
    else if (fs.length === 1 && fs !== '\t') parts = line.split(fs);
    else if (fs === '\t') parts = line.split('\t');
    else parts = line.split(makeRegex(fs, { extended: true, global: true }));
    this.fields = [line].concat(parts);
    this.vars.NF = parts.length;
  };

  AwkRun.prototype.rebuildRecord = function () {
    this.fields[0] = this.fields.slice(1, this.vars.NF + 1).join(String(this.vars.OFS));
    this.record = this.fields[0];
  };

  AwkRun.prototype.getField = function (n) {
    n = Math.trunc(numify(n));
    if (n === 0) return this.fields[0];
    const v = this.fields[n];
    return v === undefined ? '' : v;
  };

  AwkRun.prototype.setField = function (n, value) {
    n = Math.trunc(numify(n));
    if (n === 0) { this.setRecord(stringify(value)); return; }
    while (this.fields.length <= n) this.fields.push('');
    this.fields[n] = stringify(value);
    if (n > this.vars.NF) this.vars.NF = n;
    this.rebuildRecord();
  };

  AwkRun.prototype.getVar = function (name) {
    if (this.vars[name] !== undefined) return this.vars[name];
    return '';
  };

  AwkRun.prototype.array = function (name) {
    if (!this.arrays[name]) this.arrays[name] = Object.create(null);
    return this.arrays[name];
  };

  AwkRun.prototype.evalNode = function (n) {
    const self = this;
    switch (n.k) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'regex': {
        const re = makeRegex(n.v, { extended: true });
        return re.test(this.fields[0]) ? 1 : 0;
      }
      case 'field': return this.getField(this.evalNode(n.e));
      case 'var': {
        if (n.name === 'NF') return this.vars.NF;
        return this.getVar(n.name);
      }
      case 'index': {
        const key = n.idx.map(function (e) { return stringify(self.evalNode(e)); })
          .join(this.vars.SUBSEP);
        const arr = this.array(n.name);
        return arr[key] === undefined ? '' : arr[key];
      }
      case 'in': {
        const key = stringify(this.evalNode(n.key));
        return this.array(n.arr)[key] !== undefined ? 1 : 0;
      }
      case 'concat':
        return stringify(this.evalNode(n.l)) + stringify(this.evalNode(n.r));
      case 'bin': {
        const a = numify(this.evalNode(n.l)), b = numify(this.evalNode(n.r));
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? 0 : a / b;
          case '%': return b === 0 ? 0 : a % b;
          case '^': return Math.pow(a, b);
        }
        return 0;
      }
      case 'neg': return -numify(this.evalNode(n.e));
      case 'not': return truthy(this.evalNode(n.e)) ? 0 : 1;
      case 'cmp': {
        const l = this.evalNode(n.l), r = this.evalNode(n.r);
        // awk compares numerically when both sides look like numbers.
        const bothNumeric = looksNumeric(l) && looksNumeric(r);
        const a = bothNumeric ? numify(l) : stringify(l);
        const b = bothNumeric ? numify(r) : stringify(r);
        switch (n.op) {
          case '<': return a < b ? 1 : 0;
          case '>': return a > b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0;
          case '>=': return a >= b ? 1 : 0;
          case '==': return a === b ? 1 : 0;
          case '!=': return a !== b ? 1 : 0;
        }
        return 0;
      }
      case 'match': {
        const subject = stringify(this.evalNode(n.l));
        const pattern = n.r.k === 'regex' ? n.r.v : stringify(this.evalNode(n.r));
        const hit = makeRegex(pattern, { extended: true }).test(subject);
        return (n.neg ? !hit : hit) ? 1 : 0;
      }
      case 'and': return truthy(this.evalNode(n.l)) && truthy(this.evalNode(n.r)) ? 1 : 0;
      case 'or': return truthy(this.evalNode(n.l)) || truthy(this.evalNode(n.r)) ? 1 : 0;
      case 'ternary': return truthy(this.evalNode(n.cond)) ? this.evalNode(n.a) : this.evalNode(n.b);
      case 'preincr': {
        const cur = numify(this.readTarget(n.target));
        const val = n.op === '++' ? cur + 1 : cur - 1;
        this.writeTarget(n.target, val);
        return val;
      }
      case 'postincr': {
        const cur = numify(this.readTarget(n.target));
        this.writeTarget(n.target, n.op === '++' ? cur + 1 : cur - 1);
        return cur;
      }
      case 'call': return this.callFunction(n);
      case 'list': return this.evalNode(n.items[0]);
    }
    return '';
  };

  function looksNumeric(v) {
    if (typeof v === 'number') return true;
    return /^[ \t]*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?[ \t]*$/.test(String(v));
  }

  AwkRun.prototype.readTarget = function (t) {
    if (t.k === 'var') return this.getVar(t.name);
    if (t.k === 'field') return this.getField(this.evalNode(t.e));
    if (t.k === 'index') return this.evalNode(t);
    return '';
  };

  AwkRun.prototype.writeTarget = function (t, value) {
    const self = this;
    if (t.k === 'var') {
      if (t.name === 'NF') { this.vars.NF = numify(value); this.rebuildRecord(); return; }
      this.vars[t.name] = value;
      if (t.name === 'FS' || t.name === 'OFS') this.vars[t.name] = stringify(value);
      return;
    }
    if (t.k === 'field') { this.setField(this.evalNode(t.e), value); return; }
    if (t.k === 'index') {
      const key = t.idx.map(function (e) { return stringify(self.evalNode(e)); })
        .join(this.vars.SUBSEP);
      this.array(t.name)[key] = value;
      return;
    }
  };

  AwkRun.prototype.callFunction = function (n) {
    const self = this;
    const a = n.args.map(function (x) { return self.evalNode(x); });
    switch (n.name) {
      case 'length':
        if (!n.args.length) return String(this.fields[0]).length;
        if (n.args[0].k === 'var' && this.arrays[n.args[0].name]) {
          return Object.keys(this.arrays[n.args[0].name]).length;
        }
        return stringify(a[0]).length;
      case 'substr': {
        const s = stringify(a[0]);
        const start = Math.trunc(numify(a[1]));
        const len = a.length > 2 ? Math.trunc(numify(a[2])) : undefined;
        const from = Math.max(0, start - 1);
        return len === undefined ? s.slice(from) : s.substr(from, Math.max(0, len));
      }
      case 'index': return stringify(a[0]).indexOf(stringify(a[1])) + 1;
      case 'toupper': return stringify(a[0]).toUpperCase();
      case 'tolower': return stringify(a[0]).toLowerCase();
      case 'int': return Math.trunc(numify(a[0]));
      case 'sqrt': return Math.sqrt(numify(a[0]));
      case 'exp': return Math.exp(numify(a[0]));
      case 'log': return Math.log(numify(a[0]));
      case 'sin': return Math.sin(numify(a[0]));
      case 'cos': return Math.cos(numify(a[0]));
      case 'atan2': return Math.atan2(numify(a[0]), numify(a[1]));
      case 'rand': return 0.237;
      case 'srand': return 0;
      case 'split': {
        const s = stringify(a[0]);
        const arrName = n.args[1].name;
        const sep = a.length > 2 ? stringify(a[2]) : String(this.vars.FS);
        const arr = Object.create(null);
        let parts;
        if (sep === ' ') parts = s.trim() === '' ? [] : s.trim().split(/[ \t\n]+/);
        else if (sep.length === 1) parts = s.split(sep);
        else parts = s.split(makeRegex(sep, { extended: true }));
        parts.forEach(function (p, i) { arr[String(i + 1)] = p; });
        this.arrays[arrName] = arr;
        return parts.length;
      }
      case 'sub': case 'gsub': {
        const pattern = n.args[0].k === 'regex' ? n.args[0].v : stringify(a[0]);
        const rep = stringify(a[1]);
        const target = n.args[2] || { k: 'field', e: { k: 'num', v: 0 } };
        const before = stringify(this.readTarget(target));
        const re = makeRegex(pattern, { extended: true, global: n.name === 'gsub' });
        let count = 0;
        const after = before.replace(re, function (mm) {
          count++;
          return rep.replace(/&/g, mm);
        });
        this.writeTarget(target, after);
        return count;
      }
      case 'match': {
        const pattern = n.args[1].k === 'regex' ? n.args[1].v : stringify(a[1]);
        const mm = makeRegex(pattern, { extended: true }).exec(stringify(a[0]));
        this.vars.RSTART = mm ? mm.index + 1 : 0;
        this.vars.RLENGTH = mm ? mm[0].length : -1;
        return this.vars.RSTART;
      }
      case 'sprintf': return awkSprintf(a);
      case 'system': return 0;
      default:
        throw new Error('awk: calling undefined function ' + n.name);
    }
  };

  function awkSprintf(args) {
    const fmt = stringify(args[0]);
    let ai = 1;
    return fmt
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t')
      .replace(/%([-0]*)(\d*)(?:\.(\d+))?([sdifeg%])/g, function (all, flags, width, prec, kind) {
        if (kind === '%') return '%';
        const left = flags.indexOf('-') !== -1;
        const zero = flags.indexOf('0') !== -1 && !left && kind !== 's';
        let v = args[ai++];
        let s;
        if (kind === 'd' || kind === 'i') s = String(Math.trunc(numify(v)));
        else if (kind === 'f') s = numify(v).toFixed(prec === undefined ? 6 : +prec);
        else if (kind === 'e') s = numify(v).toExponential(prec === undefined ? 6 : +prec);
        else if (kind === 'g') s = String(parseFloat(numify(v).toPrecision(prec === undefined ? 6 : +prec)));
        else { s = stringify(v); if (prec !== undefined) s = s.slice(0, +prec); }
        const w = parseInt(width, 10) || 0;
        if (s.length >= w) return s;
        if (left) return s + ' '.repeat(w - s.length);
        if (zero) {
          // A zero-padded number keeps its sign in front of the padding.
          const sign = /^[-+]/.test(s) ? s.charAt(0) : '';
          const body = sign ? s.slice(1) : s;
          return sign + '0'.repeat(w - s.length) + body;
        }
        return ' '.repeat(w - s.length) + s;
      });
  }

  const NEXT = { next: true };
  const EXIT = { exit: true };

  AwkRun.prototype.exec = function (stmt) {
    const self = this;
    switch (stmt.k) {
      case 'block':
        for (let i = 0; i < stmt.stmts.length; i++) {
          const r = this.exec(stmt.stmts[i]);
          if (r) return r;
        }
        return null;
      case 'print': {
        let text;
        if (!stmt.args.length) text = this.fields[0];
        else {
          const items = stmt.args.length === 1 && stmt.args[0].k === 'list'
            ? stmt.args[0].items : stmt.args;
          text = items.map(function (e) { return stringify(self.evalNode(e)); })
            .join(String(this.vars.OFS));
        }
        this.ctx.out(text + String(this.vars.ORS));
        return null;
      }
      case 'printf': {
        const items = stmt.args.length === 1 && stmt.args[0].k === 'list'
          ? stmt.args[0].items : stmt.args;
        this.ctx.out(awkSprintf(items.map(function (e) { return self.evalNode(e); })));
        return null;
      }
      case 'assign': {
        let value;
        if (stmt.op === '=') value = this.evalNode(stmt.value);
        else {
          const cur = numify(this.readTarget(stmt.target));
          const rhs = numify(this.evalNode(stmt.value));
          value = stmt.op === '+=' ? cur + rhs : stmt.op === '-=' ? cur - rhs
            : stmt.op === '*=' ? cur * rhs : stmt.op === '/=' ? (rhs ? cur / rhs : 0)
            : cur % rhs;
        }
        this.writeTarget(stmt.target, value);
        return null;
      }
      case 'if':
        if (truthy(this.evalNode(stmt.cond))) return this.exec(stmt.then);
        if (stmt.otherwise) return this.exec(stmt.otherwise);
        return null;
      case 'while': {
        let guard = 0;
        while (truthy(this.evalNode(stmt.cond)) && guard++ < 100000) {
          const r = this.exec(stmt.body);
          if (r) return r;
        }
        return null;
      }
      case 'for': {
        if (stmt.init) this.exec(stmt.init);
        let guard = 0;
        while ((!stmt.cond || truthy(this.evalNode(stmt.cond))) && guard++ < 100000) {
          const r = this.exec(stmt.body);
          if (r) return r;
          if (stmt.step) this.exec(stmt.step);
        }
        return null;
      }
      case 'forin': {
        const arr = this.array(stmt.arr);
        const keys = Object.keys(arr);
        for (let i = 0; i < keys.length; i++) {
          this.vars[stmt.name] = keys[i];
          const r = this.exec(stmt.body);
          if (r) return r;
        }
        return null;
      }
      case 'delete': {
        if (stmt.target.k === 'index') {
          const key = stmt.target.idx.map(function (e) { return stringify(self.evalNode(e)); })
            .join(this.vars.SUBSEP);
          delete this.array(stmt.target.name)[key];
        } else if (stmt.target.k === 'var') {
          this.arrays[stmt.target.name] = Object.create(null);
        }
        return null;
      }
      case 'next': return NEXT;
      case 'exit': this.exitCode = stmt.code || 0; return EXIT;
      case 'expr': this.evalNode(stmt.e); return null;
    }
    return null;
  };

  AwkRun.prototype.runRules = function (when) {
    for (let i = 0; i < this.rules.length; i++) {
      if (this.rules[i].when !== when) continue;
      const r = this.exec(this.rules[i].action);
      if (r === EXIT) { this.exited = true; return; }
    }
  };

  AwkRun.prototype.feed = function (line) {
    this.vars.NR = numify(this.vars.NR) + 1;
    this.vars.FNR = numify(this.vars.FNR) + 1;
    this.setRecord(line);

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      if (rule.when !== 'pattern' && rule.when !== null) continue;

      let matched;
      if (rule.when === null) matched = true;
      else if (rule.pattern2) {
        if (this.ranges[i]) {
          matched = true;
          if (truthy(this.evalNode(rule.pattern2))) this.ranges[i] = false;
        } else if (truthy(this.evalNode(rule.pattern))) {
          matched = true;
          this.ranges[i] = !truthy(this.evalNode(rule.pattern2));
        } else matched = false;
      } else {
        matched = truthy(this.evalNode(rule.pattern));
      }
      if (!matched) continue;

      if (!rule.action) { this.ctx.out(this.fields[0] + String(this.vars.ORS)); continue; }
      const r = this.exec(rule.action);
      if (r === NEXT) return;
      if (r === EXIT) { this.exited = true; return; }
    }
  };

  register('awk gawk', function (ctx) {
    const parsed = parseArgs(ctx, { value: 'F v f', long: { '--field-separator': 'F',
                                                            '--assign': 'v', '--file': 'f' } });
    if (!parsed) return ctx.status;
    let operands = parsed.operands.slice();

    let program = parsed.flags.f !== undefined ? null : operands.shift();
    if (parsed.flags.f !== undefined) {
      try {
        program = ctx.m.read(ctx.sh.resolve(parsed.flags.f).node);
      } catch (err) {
        return ctx.fail("can't open file " + parsed.flags.f, 2);
      }
    }
    if (program === undefined || program === null) {
      return ctx.usage('usage: awk [POSIX or GNU style options] -f progfile [--] file ...');
    }

    const vars = {};
    if (parsed.flags.F !== undefined) {
      let fs = parsed.flags.F;
      if (fs === '\\t' || fs === 't') fs = '\t';
      vars.FS = fs;
    }
    if (parsed.flags.v !== undefined) {
      [].concat(parsed.flags.v).forEach(function (pair) {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(pair);
        if (m) vars[m[1]] = m[2];
      });
    }

    let rules;
    try {
      rules = parseAwkProgram(program);
    } catch (err) {
      ctx.errln(String(err.message));
      return 2;
    }

    const run = new AwkRun(ctx, rules, vars);

    try {
      run.runRules('BEGIN');
      const needsInput = rules.some(function (r) { return r.when !== 'BEGIN'; });
      if (!run.exited && needsInput) {
        const chunks = ctx.inputLines(operands);
        for (let c = 0; c < chunks.length && !run.exited; c++) {
          run.vars.FILENAME = chunks[c].name === '-' ? '' : chunks[c].name;
          run.vars.FNR = 0;
          const lines = splitLines(chunks[c].text);
          for (let i = 0; i < lines.length && !run.exited; i++) run.feed(lines[i]);
        }
      }
      run.exited = false;
      run.runRules('END');
    } catch (err) {
      ctx.errln(String(err.message || err));
      return 2;
    }

    return run.exitCode || ctx.status;
  });

  /* =========================================================================
   * The column and line tools
   * ======================================================================= */

  register('wc', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'l w c m L',
                                    long: { '--lines': 'l', '--words': 'w', '--bytes': 'c',
                                            '--chars': 'm', '--max-line-length': 'L' } });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const any = fl.l || fl.w || fl.c || fl.m || fl.L;
    const chunks = ctx.inputLines(parsed.operands);
    const totals = { l: 0, w: 0, c: 0, L: 0 };

    function countsFor(text) {
      const lines = text === '' ? 0 : (text.match(/\n/g) || []).length +
        (text.slice(-1) === '\n' ? 0 : 1);
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      const chars = text.length;
      const longest = text.split('\n').reduce(function (a, l) { return Math.max(a, l.length); }, 0);
      totals.l += lines; totals.w += words; totals.c += chars;
      totals.L = Math.max(totals.L, longest);

      const cols = [];
      if (!any || fl.l) cols.push(lines);
      if (!any || fl.w) cols.push(words);
      if (!any || fl.c || fl.m) cols.push(chars);
      if (fl.L) cols.push(longest);
      return cols;
    }

    // wc lines its columns up across everything it counted, so one file gets
    // no padding at all and a set of files is aligned to the widest number.
    const rows = [];
    if (!parsed.operands.length) rows.push({ cols: countsFor(ctx.stdin), label: null });
    else {
      chunks.forEach(function (c) { rows.push({ cols: countsFor(c.text), label: c.name }); });
      if (chunks.length > 1) {
        const cols = [];
        if (!any || fl.l) cols.push(totals.l);
        if (!any || fl.w) cols.push(totals.w);
        if (!any || fl.c || fl.m) cols.push(totals.c);
        if (fl.L) cols.push(totals.L);
        rows.push({ cols: cols, label: 'total' });
      }
    }

    let width = 1;
    rows.forEach(function (r) {
      r.cols.forEach(function (v) { width = Math.max(width, String(v).length); });
    });
    rows.forEach(function (r) {
      ctx.outln(r.cols.map(function (v, i) {
        return (i === 0 ? '' : ' ') + String(v).padStart(width);
      }).join('') + (r.label === null ? '' : ' ' + r.label));
    });
    return ctx.status;
  });

  register('head', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'q v', value: 'n c', digits: true,
                                    long: { '--lines': 'n', '--bytes': 'c', '--quiet': 'q' } });
    if (!parsed) return ctx.status;
    const count = parsed.flags.n !== undefined ? parseInt(parsed.flags.n, 10)
      : (parsed.flags.number ? parseInt(parsed.flags.number, 10) : 10);
    const chunks = ctx.inputLines(parsed.operands);
    const many = chunks.length > 1 && !parsed.flags.q;

    chunks.forEach(function (chunk, i) {
      if (many) ctx.outln((i ? '\n' : '') + '==> ' + chunk.name + ' <==');
      if (parsed.flags.c !== undefined) {
        ctx.out(chunk.text.slice(0, parseInt(parsed.flags.c, 10)));
        return;
      }
      const lines = splitLines(chunk.text);
      const take = count < 0 ? lines.slice(0, Math.max(0, lines.length + count))
                             : lines.slice(0, count);
      take.forEach(function (l) { ctx.outln(l); });
    });
    return ctx.status;
  });

  register('tail', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'q v f', value: 'n c', digits: true,
                                    long: { '--lines': 'n', '--bytes': 'c', '--quiet': 'q',
                                            '--follow': 'f' } });
    if (!parsed) return ctx.status;
    let spec = parsed.flags.n !== undefined ? String(parsed.flags.n)
      : (parsed.flags.number ? parsed.flags.number : '10');
    const fromStart = spec.charAt(0) === '+';
    const count = Math.abs(parseInt(spec, 10) || 10);
    const chunks = ctx.inputLines(parsed.operands);
    const many = chunks.length > 1 && !parsed.flags.q;

    chunks.forEach(function (chunk, i) {
      if (many) ctx.outln((i ? '\n' : '') + '==> ' + chunk.name + ' <==');
      if (parsed.flags.c !== undefined) {
        ctx.out(chunk.text.slice(-parseInt(parsed.flags.c, 10)));
        return;
      }
      const lines = splitLines(chunk.text);
      const take = fromStart ? lines.slice(count - 1) : lines.slice(Math.max(0, lines.length - count));
      take.forEach(function (l) { ctx.outln(l); });
    });
    if (parsed.flags.f) ctx.errln('tail: following is not available in this practice terminal');
    return ctx.status;
  });

  register('sort', function (ctx) {
    const parsed = parseArgs(ctx, {
      bool: 'r n u f b h V M R c',
      value: 'k t o',
      long: { '--reverse': 'r', '--numeric-sort': 'n', '--unique': 'u', '--key': 'k',
              '--field-separator': 't', '--human-numeric-sort': 'h',
              '--ignore-case': 'f', '--output': 'o', '--version-sort': 'V' }
    });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const chunks = ctx.inputLines(parsed.operands);
    let lines = [];
    chunks.forEach(function (c) { lines = lines.concat(splitLines(c.text)); });

    const sep = fl.t !== undefined ? (fl.t === '\\t' ? '\t' : fl.t) : null;

    /** -k 3,3n -- the field to sort on, and any per-key flags attached to it. */
    function keyOf(line) {
      if (fl.k === undefined) return { text: line, flags: '' };
      const m = /^(\d+)(?:\.(\d+))?([a-zA-Z]*)(?:,(\d+)(?:\.(\d+))?([a-zA-Z]*))?$/.exec(String(fl.k));
      if (!m) return { text: line, flags: '' };
      const from = parseInt(m[1], 10);
      const to = m[4] ? parseInt(m[4], 10) : null;
      const keyFlags = (m[3] || '') + (m[6] || '');
      const fields = sep === null ? line.trim().split(/\s+/) : line.split(sep);
      const slice = fields.slice(from - 1, to === null ? undefined : to);
      return { text: slice.join(sep === null ? ' ' : sep), flags: keyFlags };
    }

    function humanValue(s) {
      const m = /^\s*([\d.]+)\s*([KMGTP]?)/i.exec(String(s));
      if (!m) return 0;
      const mult = { '': 1, K: 1024, M: 1048576, G: 1073741824, T: 1099511627776,
                     P: 1125899906842624 }[m[2].toUpperCase()] || 1;
      return parseFloat(m[1]) * mult;
    }

    const decorated = lines.map(function (line, idx) {
      const k = keyOf(line);
      return { line: line, key: k.text, kflags: k.flags, idx: idx };
    });

    decorated.sort(function (a, b) {
      const useNumeric = fl.n || a.kflags.indexOf('n') !== -1;
      const useHuman = fl.h || a.kflags.indexOf('h') !== -1;
      let x = a.key, y = b.key;
      let cmp;
      if (useHuman) cmp = humanValue(x) - humanValue(y);
      else if (useNumeric) cmp = (parseFloat(x) || 0) - (parseFloat(y) || 0);
      else {
        if (fl.f || a.kflags.indexOf('f') !== -1) { x = x.toUpperCase(); y = y.toUpperCase(); }
        if (fl.b) { x = x.trim(); y = y.trim(); }
        cmp = x < y ? -1 : x > y ? 1 : 0;
      }
      if (cmp === 0) cmp = a.line < b.line ? -1 : a.line > b.line ? 1 : 0;
      if (cmp === 0) cmp = a.idx - b.idx;
      return (fl.r ? -cmp : cmp);
    });

    let out = decorated.map(function (d) { return d.line; });
    if (fl.u) {
      const seen = new Set();
      out = out.filter(function (l) {
        const k = fl.f ? l.toUpperCase() : l;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    const text = out.map(function (l) { return l + '\n'; }).join('');
    if (fl.o !== undefined) {
      const wrote = ctx.sh.writeTo(fl.o, text, false);
      if (wrote) { ctx.errln(wrote.replace(/\n$/, '')); return 1; }
      return 0;
    }
    ctx.out(text);
    return ctx.status;
  });

  register('uniq', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'c d D u i', value: 'f s w',
                                    long: { '--count': 'c', '--repeated': 'd',
                                            '--unique': 'u', '--ignore-case': 'i',
                                            '--all-repeated': 'D' } });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const chunks = ctx.inputLines(parsed.operands.slice(0, 1));
    const lines = splitLines(chunks.map(function (c) { return c.text; }).join(''));

    const groups = [];
    lines.forEach(function (line) {
      const key = fl.i ? line.toUpperCase() : line;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.count++;
      else groups.push({ key: key, line: line, count: 1 });
    });

    groups.forEach(function (g) {
      if (fl.d && g.count < 2) return;
      if (fl.u && g.count > 1) return;
      if (fl.D) {
        for (let i = 0; i < g.count; i++) ctx.outln(g.line);
        return;
      }
      ctx.outln(fl.c ? String(g.count).padStart(7) + ' ' + g.line : g.line);
    });
    return ctx.status;
  });

  register('cut', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 's', value: 'd f c b',
                                    long: { '--delimiter': 'd', '--fields': 'f',
                                            '--characters': 'c', '--bytes': 'b',
                                            '--only-delimited': 's' } });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    if (fl.f === undefined && fl.c === undefined && fl.b === undefined) {
      return ctx.usage('you must specify a list of bytes, characters, or fields');
    }
    let delim = fl.d === undefined ? '\t' : (fl.d === '\\t' ? '\t' : fl.d);

    /** "1,3-5" and "2-" both name sets of columns. */
    function parseList(spec) {
      const ranges = [];
      String(spec).split(',').forEach(function (part) {
        const m = /^(\d*)(-?)(\d*)$/.exec(part.trim());
        if (!m) return;
        if (m[2] === '') ranges.push([+m[1], +m[1]]);
        else ranges.push([m[1] === '' ? 1 : +m[1], m[3] === '' ? Infinity : +m[3]]);
      });
      return function (i) {
        return ranges.some(function (r) { return i >= r[0] && i <= r[1]; });
      };
    }

    const chunks = ctx.inputLines(parsed.operands);
    chunks.forEach(function (chunk) {
      splitLines(chunk.text).forEach(function (line) {
        if (fl.f !== undefined) {
          const wanted = parseList(fl.f);
          if (line.indexOf(delim) === -1) {
            if (!fl.s) ctx.outln(line);
            return;
          }
          const fields = line.split(delim);
          ctx.outln(fields.filter(function (_, i) { return wanted(i + 1); }).join(delim));
          return;
        }
        const wanted = parseList(fl.c !== undefined ? fl.c : fl.b);
        ctx.outln(line.split('').filter(function (_, i) { return wanted(i + 1); }).join(''));
      });
    });
    return ctx.status;
  });

  register('tr', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'd s c C',
                                    long: { '--delete': 'd', '--squeeze-repeats': 's',
                                            '--complement': 'c' } });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const ops = parsed.operands;
    if (!ops.length) return ctx.usage('missing operand');

    /** a-z, [:digit:] and \n all name sets of characters. */
    function expandSet(spec) {
      let out = '';
      let i = 0;
      const s = String(spec);
      while (i < s.length) {
        if (s.slice(i, i + 2) === '[:') {
          const end = s.indexOf(':]', i);
          const cls = s.slice(i + 2, end);
          const map = {
            alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            lower: 'abcdefghijklmnopqrstuvwxyz',
            upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            digit: '0123456789',
            alnum: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            space: ' \t\n\r\f\v', blank: ' \t',
            punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
          };
          out += map[cls] || '';
          i = end + 2;
          continue;
        }
        if (s[i] === '\\') {
          const n = s[i + 1];
          out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n;
          i += 2;
          continue;
        }
        if (s[i + 1] === '-' && s[i + 2] !== undefined && s[i + 2] !== '-') {
          for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out += String.fromCharCode(c);
          i += 3;
          continue;
        }
        out += s[i];
        i++;
      }
      return out;
    }

    let set1 = expandSet(ops[0]);
    let set2 = ops[1] !== undefined ? expandSet(ops[1]) : '';
    let text = ctx.stdin;

    if (fl.c || fl.C) {
      const keep = new Set(set1.split(''));
      let comp = '';
      for (let c = 0; c < 128; c++) {
        if (!keep.has(String.fromCharCode(c))) comp += String.fromCharCode(c);
      }
      set1 = comp;
    }

    if (fl.d) {
      const drop = new Set(set1.split(''));
      text = text.split('').filter(function (c) { return !drop.has(c); }).join('');
    } else if (set2) {
      while (set2.length < set1.length) set2 += set2.slice(-1);
      const map = Object.create(null);
      for (let i = 0; i < set1.length; i++) map[set1[i]] = set2[i];
      text = text.split('').map(function (c) {
        return map[c] === undefined ? c : map[c];
      }).join('');
    }

    if (fl.s) {
      const squeeze = new Set((fl.d ? set2 : set2 || set1).split(''));
      let out = '';
      let prev = null;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === prev && squeeze.has(text[i])) continue;
        out += text[i];
        prev = text[i];
      }
      text = out;
    }

    ctx.out(text);
    return 0;
  });

  register('tee', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'a i', long: { '--append': 'a' } });
    if (!parsed) return ctx.status;
    parsed.operands.forEach(function (p) {
      const wrote = ctx.sh.writeTo(p, ctx.stdin, !!parsed.flags.a);
      if (wrote) { ctx.errln(wrote.replace(/\n$/, '')); ctx.status = 1; }
    });
    ctx.out(ctx.stdin);
    return ctx.status;
  });

  register('nl', function (ctx) {
    const parsed = parseArgs(ctx, { value: 'b w s' });
    if (!parsed) return ctx.status;
    const style = parsed.flags.b || 't';
    const width = parseInt(parsed.flags.w || 6, 10);
    const sep = parsed.flags.s === undefined ? '\t' : parsed.flags.s;
    let n = 0;
    ctx.inputLines(parsed.operands).forEach(function (chunk) {
      splitLines(chunk.text).forEach(function (line) {
        if (style === 'a' || line !== '') {
          ctx.outln(String(++n).padStart(width) + sep + line);
        } else {
          ctx.outln(' '.repeat(width) + sep.replace(/./g, ' ') + line);
        }
      });
    });
    return ctx.status;
  });

  register('tac', function (ctx) {
    ctx.inputLines(ctx.args).forEach(function (chunk) {
      splitLines(chunk.text).reverse().forEach(function (l) { ctx.outln(l); });
    });
    return ctx.status;
  });

  register('rev', function (ctx) {
    ctx.inputLines(ctx.args).forEach(function (chunk) {
      splitLines(chunk.text).forEach(function (l) {
        ctx.outln(l.split('').reverse().join(''));
      });
    });
    return ctx.status;
  });

  register('paste', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 's', value: 'd' });
    if (!parsed) return ctx.status;
    const delim = parsed.flags.d === undefined ? '\t' : (parsed.flags.d === '\\t' ? '\t' : parsed.flags.d);
    const chunks = ctx.inputLines(parsed.operands);
    if (parsed.flags.s) {
      chunks.forEach(function (c) { ctx.outln(splitLines(c.text).join(delim)); });
      return ctx.status;
    }
    const columns = chunks.map(function (c) { return splitLines(c.text); });
    const rows = columns.reduce(function (a, c) { return Math.max(a, c.length); }, 0);
    for (let r = 0; r < rows; r++) {
      ctx.outln(columns.map(function (col) { return col[r] === undefined ? '' : col[r]; })
        .join(delim));
    }
    return ctx.status;
  });

  register('less more', function (ctx) {
    // No pager in a transcript; showing the file is the honest equivalent.
    const chunks = ctx.inputLines(ctx.args.filter(function (a) { return a.charAt(0) !== '-'; }));
    chunks.forEach(function (c) { ctx.out(c.text); });
    return ctx.status;
  });

  register('seq', function (ctx) {
    const a = ctx.args.map(Number);
    let from = 1, step = 1, to;
    if (a.length === 1) to = a[0];
    else if (a.length === 2) { from = a[0]; to = a[1]; }
    else if (a.length >= 3) { from = a[0]; step = a[1]; to = a[2]; }
    else return ctx.usage('missing operand');
    if (step === 0) return ctx.fail('invalid Zero increment value');
    let guard = 0;
    for (let v = from; step > 0 ? v <= to : v >= to; v += step) {
      ctx.outln(String(Math.round(v * 1e9) / 1e9));
      if (++guard > 100000) break;
    }
    return 0;
  });

  register('yes', function (ctx) {
    const text = ctx.args.length ? ctx.args.join(' ') : 'y';
    for (let i = 0; i < 10; i++) ctx.outln(text);
    ctx.errln('yes: stopped after 10 lines in this practice terminal');
    return 0;
  });

  register('sleep', function (ctx) {
    // Time is virtual here: a sleep advances the clock instead of blocking.
    const secs = parseFloat(ctx.args[0]) || 0;
    ctx.m.tick(secs);
    return 0;
  });

  register('md5sum sha256sum', function (ctx) {
    function digest(s) {
      let h1 = 0x811c9dc5, h2 = 0x01000193;
      for (let i = 0; i < s.length; i++) {
        h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
        h2 = ((h2 + s.charCodeAt(i) * (i + 7)) * 2654435761) >>> 0;
      }
      let out = '';
      const width = ctx.name === 'md5sum' ? 4 : 8;
      for (let k = 0; k < width; k++) {
        h1 = (h1 * 16777619 + 0x9e3779b9) >>> 0;
        h2 = (h2 * 2654435761 + 0x7f4a7c15) >>> 0;
        out += ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
      }
      return out;
    }
    const chunks = ctx.inputLines(ctx.args);
    chunks.forEach(function (c) {
      ctx.outln(digest(c.text) + '  ' + (c.name === '-' ? '-' : c.name));
    });
    return ctx.status;
  });

  register('diff', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'u q i w c y',
                                    long: { '--unified': 'u', '--brief': 'q' } });
    if (!parsed) return ctx.status;
    if (parsed.operands.length < 2) return ctx.usage('missing operand after ' +
      (parsed.operands[0] || ''));
    const chunks = ctx.inputLines(parsed.operands.slice(0, 2));
    if (chunks.length < 2) return 2;
    let a = splitLines(chunks[0].text), b = splitLines(chunks[1].text);
    if (parsed.flags.i) {
      a = a.map(function (l) { return l.toLowerCase(); });
      b = b.map(function (l) { return l.toLowerCase(); });
    }

    // Longest common subsequence, then report the gaps around it.
    const n = a.length, m = b.length;
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push(['=', a[i]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['-', a[i]]); i++; }
      else { ops.push(['+', b[j]]); j++; }
    }
    while (i < n) { ops.push(['-', a[i]]); i++; }
    while (j < m) { ops.push(['+', b[j]]); j++; }

    const differs = ops.some(function (o) { return o[0] !== '='; });
    if (!differs) return 0;

    if (parsed.flags.q) {
      ctx.outln('Files ' + parsed.operands[0] + ' and ' + parsed.operands[1] + ' differ');
      return 1;
    }
    if (parsed.flags.u) {
      ctx.outln('--- ' + parsed.operands[0]);
      ctx.outln('+++ ' + parsed.operands[1]);
      ctx.outln('@@ -1,' + n + ' +1,' + m + ' @@');
      ops.forEach(function (o) {
        ctx.outln((o[0] === '=' ? ' ' : o[0]) + o[1]);
      });
      return 1;
    }
    // The default side-by-side-free format: change hunks with < and >.
    let k = 0;
    while (k < ops.length) {
      if (ops[k][0] === '=') { k++; continue; }
      const dels = [], adds = [];
      const startA = ops.slice(0, k).filter(function (o) { return o[0] !== '+'; }).length;
      const startB = ops.slice(0, k).filter(function (o) { return o[0] !== '-'; }).length;
      while (k < ops.length && ops[k][0] === '-') { dels.push(ops[k][1]); k++; }
      while (k < ops.length && ops[k][0] === '+') { adds.push(ops[k][1]); k++; }
      const range = function (start, count) {
        return count <= 1 ? String(start + 1) : (start + 1) + ',' + (start + count);
      };
      const verb = dels.length && adds.length ? 'c' : dels.length ? 'd' : 'a';
      ctx.outln(range(startA, dels.length || 1) + verb + range(startB, adds.length || 1));
      dels.forEach(function (l) { ctx.outln('< ' + l); });
      if (dels.length && adds.length) ctx.outln('---');
      adds.forEach(function (l) { ctx.outln('> ' + l); });
    }
    return 1;
  });

  register('cmp', function (ctx) {
    const chunks = ctx.inputLines(ctx.args.slice(0, 2));
    if (chunks.length < 2) return 2;
    if (chunks[0].text === chunks[1].text) return 0;
    let at = 0;
    while (at < chunks[0].text.length && chunks[0].text[at] === chunks[1].text[at]) at++;
    const lineNo = chunks[0].text.slice(0, at).split('\n').length;
    ctx.outln(chunks[0].name + ' ' + chunks[1].name + ' differ: byte ' + (at + 1) +
      ', line ' + lineNo);
    return 1;
  });

  register('split', function (ctx) {
    ctx.errln('split: not available in this practice terminal');
    return 1;
  });

  /* =========================================================================
   * find (chapter 14) and xargs
   * ======================================================================= */

  register('find', function (ctx) {
    const sh = ctx.sh, m = ctx.m;
    const args = ctx.args.slice();
    const roots = [];
    let i = 0;
    while (i < args.length && args[i].charAt(0) !== '-' &&
           args[i] !== '(' && args[i] !== '!') {
      roots.push(args[i]);
      i++;
    }
    if (!roots.length) roots.push('.');

    /* --- the expression, as a list of tests and actions --- */
    const tests = [];
    let action = null;
    let maxDepth = Infinity, minDepth = 0;
    let followLinks = false;
    let pendingOr = false;

    while (i < args.length) {
      const a = args[i];
      const val = args[i + 1];
      let negate = false;
      if (a === '!' || a === '-not') { i++; continue; }

      switch (a) {
        case '-maxdepth': maxDepth = parseInt(val, 10); i += 2; break;
        case '-mindepth': minDepth = parseInt(val, 10); i += 2; break;
        case '-L': followLinks = true; i++; break;
        case '-name': case '-iname': {
          const re = globToRegex(val, a === '-iname');
          tests.push(makeTest(function (e) { return re.test(e.name); }, args, i));
          i += 2; break;
        }
        case '-path': case '-ipath': {
          const re = globToRegex(val, a === '-ipath');
          tests.push(makeTest(function (e) { return re.test(e.path); }, args, i));
          i += 2; break;
        }
        case '-regex': {
          const re = new RegExp('^' + val + '$');
          tests.push(makeTest(function (e) { return re.test(e.path); }, args, i));
          i += 2; break;
        }
        case '-type': {
          const want = val;
          tests.push(makeTest(function (e) {
            const t = e.node.type === 'dir' ? 'd' : e.node.type === 'symlink' ? 'l' : 'f';
            return t === want;
          }, args, i));
          i += 2; break;
        }
        case '-user': {
          tests.push(makeTest(function (e) {
            return m.userName(e.node.uid) === val || String(e.node.uid) === val;
          }, args, i));
          i += 2; break;
        }
        case '-group': {
          tests.push(makeTest(function (e) {
            return m.groupName(e.node.gid) === val || String(e.node.gid) === val;
          }, args, i));
          i += 2; break;
        }
        case '-nouser':
          tests.push(makeTest(function (e) { return !m.userByUid(e.node.uid); }, args, i));
          i++; break;
        case '-perm': {
          const spec = String(val);
          tests.push(makeTest(function (e) {
            const mode = e.node.mode & 0o7777;
            if (spec.charAt(0) === '-') {
              const want = parseInt(spec.slice(1), 8);
              return (mode & want) === want;
            }
            if (spec.charAt(0) === '/' || spec.charAt(0) === '+') {
              const want = parseInt(spec.slice(1), 8);
              return (mode & want) !== 0;
            }
            return mode === parseInt(spec, 8);
          }, args, i));
          i += 2; break;
        }
        case '-size': {
          const spec = String(val);
          const sm = /^([-+]?)(\d+)([ckMG]?)$/.exec(spec);
          tests.push(makeTest(function (e) {
            if (!sm) return false;
            const unit = { c: 1, '': 512, k: 1024, M: 1048576, G: 1073741824 }[sm[3]] || 512;
            const want = parseInt(sm[2], 10) * unit;
            const size = m.sizeOf(e.node);
            const blocks = Math.ceil(size / unit) * unit;
            if (sm[1] === '+') return size > want;
            if (sm[1] === '-') return size < want;
            return blocks === want;
          }, args, i));
          i += 2; break;
        }
        case '-empty':
          tests.push(makeTest(function (e) {
            return e.node.type === 'dir' ? e.node.entries.size === 0 : m.sizeOf(e.node) === 0;
          }, args, i));
          i++; break;
        case '-mtime': case '-mmin': case '-atime': {
          const spec = String(val);
          const unit = a === '-mmin' ? 60000 : 86400000;
          const sm = /^([-+]?)(\d+)$/.exec(spec);
          tests.push(makeTest(function (e) {
            if (!sm) return false;
            const age = Math.floor((m.now - e.node.mtime) / unit);
            const want = parseInt(sm[2], 10);
            if (sm[1] === '+') return age > want;
            if (sm[1] === '-') return age < want;
            return age === want;
          }, args, i));
          i += 2; break;
        }
        case '-newer': {
          let ref = 0;
          try { ref = sh.resolve(val).node.mtime; } catch (e) { /* nothing is newer */ }
          tests.push(makeTest(function (e) { return e.node.mtime > ref; }, args, i));
          i += 2; break;
        }
        case '-inum':
          tests.push(makeTest(function (e) { return e.node.ino === parseInt(val, 10); }, args, i));
          i += 2; break;
        case '-links':
          tests.push(makeTest(function (e) { return e.node.nlink === parseInt(val, 10); }, args, i));
          i += 2; break;
        case '-o': case '-or': pendingOr = true; i++; break;
        case '-a': case '-and': i++; break;
        case '(': case ')': i++; break;
        case '-print': action = { kind: 'print' }; i++; break;
        case '-print0': action = { kind: 'print' }; i++; break;
        case '-ls': action = { kind: 'ls' }; i++; break;
        case '-delete': action = { kind: 'delete' }; i++; break;
        case '-exec': case '-execdir': case '-ok': {
          const cmd = [];
          i++;
          while (i < args.length && args[i] !== ';' && args[i] !== '+') { cmd.push(args[i]); i++; }
          const batched = args[i] === '+';
          i++;
          action = { kind: 'exec', cmd: cmd, batched: batched };
          break;
        }
        default:
          ctx.errln("find: unknown predicate `" + a + "'");
          return 1;
      }
    }

    function makeTest(fn, argv, at) {
      const negated = at > 0 && (argv[at - 1] === '!' || argv[at - 1] === '-not');
      const ored = at > 0 && (argv[at - 1] === '-o' || argv[at - 1] === '-or');
      return { fn: fn, negate: negated, or: ored };
    }

    function globToRegex(pattern, ignoreCase) {
      let src = '^';
      for (let k = 0; k < pattern.length; k++) {
        const c = pattern[k];
        if (c === '*') src += '.*';
        else if (c === '?') src += '.';
        else if (c === '[') {
          const end = pattern.indexOf(']', k + 1);
          if (end === -1) src += '\\[';
          else { src += pattern.slice(k, end + 1).replace('[!', '[^'); k = end; }
        } else src += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      return new RegExp(src + '$', ignoreCase ? 'i' : '');
    }

    function passes(entry) {
      if (!tests.length) return true;
      let result = null;
      let orGroup = false;
      for (let t = 0; t < tests.length; t++) {
        const test = tests[t];
        let hit = test.fn(entry);
        if (test.negate) hit = !hit;
        if (test.or) { orGroup = true; result = result || hit; }
        else if (result === null) result = hit;
        else if (orGroup) result = result || hit;
        else result = result && hit;
      }
      return !!result;
    }

    const matches = [];

    function walk(node, label, depth) {
      const entry = { node: node, path: label, name: label.replace(/^.*\//, '') || label, depth: depth };
      if (depth >= minDepth && depth <= maxDepth && passes(entry)) matches.push(entry);
      if (node.type !== 'dir' || depth >= maxDepth) return;
      if (!m.canRead(node, sh.user)) {
        ctx.errln("find: '" + label + "': Permission denied");
        ctx.status = 1;
        return;
      }
      Array.from(node.entries.keys()).sort().forEach(function (name) {
        walk(node.entries.get(name), label === '/' ? '/' + name : label + '/' + name, depth + 1);
      });
    }

    roots.forEach(function (root) {
      let found;
      try {
        found = sh.resolve(root, { follow: followLinks });
      } catch (err) {
        ctx.errln("find: '" + root + "': No such file or directory");
        ctx.status = 1;
        return;
      }
      walk(found.node, root.replace(/\/$/, '') || '/', 0);
    });

    if (!action || action.kind === 'print') {
      matches.forEach(function (e) { ctx.outln(e.path); });
      return ctx.status;
    }
    if (action.kind === 'ls') {
      matches.forEach(function (e) {
        ctx.outln(e.node.ino + ' ' + Math.ceil(m.sizeOf(e.node) / 1024) * 4 + ' ' +
          S.modeString(m, e.node) + ' ' + e.node.nlink + ' ' + m.userName(e.node.uid) + ' ' +
          m.groupName(e.node.gid) + ' ' + m.sizeOf(e.node) + ' ' +
          m.formatLsTime(e.node.mtime) + ' ' + e.path);
      });
      return ctx.status;
    }
    if (action.kind === 'delete') {
      matches.slice().reverse().forEach(function (e) {
        try {
          const found = sh.resolve(e.path, { follow: false });
          if (!found.parent) return;
          if (found.node.type === 'dir' && found.node.entries.size) return;
          if (!m.canRemoveFrom(found.parent, found.node, sh.user)) {
            ctx.errln('find: cannot delete ' + e.path + ': Permission denied');
            ctx.status = 1;
            return;
          }
          m.unlink(found.parent, found.name);
        } catch (err) { /* already gone */ }
      });
      return ctx.status;
    }
    if (action.kind === 'exec') {
      const quote = function (s) { return /[\s'"*?]/.test(s) ? "'" + s + "'" : s; };
      if (action.batched) {
        const line = action.cmd.map(function (part) {
          return part === '{}' ? matches.map(function (e) { return quote(e.path); }).join(' ') : part;
        }).join(' ');
        const r = ctx.sh.run(line);
        ctx.out(r.stdout);
        if (r.stderr) ctx.errln(r.stderr.replace(/\n$/, ''));
        return ctx.status;
      }
      matches.forEach(function (e) {
        const line = action.cmd.map(function (part) {
          return part.indexOf('{}') !== -1 ? part.replace('{}', quote(e.path)) : part;
        }).join(' ');
        const r = ctx.sh.run(line);
        ctx.out(r.stdout);
        if (r.stderr) ctx.errln(r.stderr.replace(/\n$/, ''));
      });
      return ctx.status;
    }
    return ctx.status;
  });

  register('xargs', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'r 0 t', value: 'n I d',
                                    long: { '--no-run-if-empty': 'r', '--null': '0',
                                            '--max-args': 'n', '--replace': 'I' } });
    if (!parsed) return ctx.status;
    const items = String(ctx.stdin).split(parsed.flags['0'] ? '\0' : /\s+/)
      .filter(function (s) { return s !== ''; });
    if (!items.length) return 0;

    const base = parsed.operands.length ? parsed.operands : ['echo'];
    const quote = function (s) { return /[\s'"*?]/.test(s) ? "'" + s + "'" : s; };

    function runLine(line) {
      if (parsed.flags.t) ctx.errln(line);
      const r = ctx.sh.run(line);
      ctx.out(r.stdout);
      if (r.stderr) ctx.errln(r.stderr.replace(/\n$/, ''));
      ctx.status = r.status;
    }

    if (parsed.flags.I !== undefined) {
      const token = parsed.flags.I;
      items.forEach(function (item) {
        runLine(base.map(function (p) { return p.split(token).join(quote(item)); }).join(' '));
      });
      return ctx.status;
    }

    const chunk = parsed.flags.n ? parseInt(parsed.flags.n, 10) : items.length;
    for (let i = 0; i < items.length; i += chunk) {
      runLine(base.join(' ') + ' ' +
        items.slice(i, i + chunk).map(quote).join(' '));
    }
    return ctx.status;
  });

})();
