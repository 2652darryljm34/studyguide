/* Regex playground: type a pattern and some text, see Python's re module (real CPython behaviour, via Pyodide)
 * highlight the matches, list the groups and run re.sub. The pure helpers are exported for tools/test_regex.js. */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MODES = {
  all:       { fn: 're.finditer', label: 'Find all (re.finditer / re.findall)' },
  search:    { fn: 're.search',   label: 'First match anywhere (re.search)' },
  match:     { fn: 're.match',    label: 'Match at the start (re.match)' },
  fullmatch: { fn: 're.fullmatch', label: 'Whole string (re.fullmatch)' },
};
const FLAG_NAMES = { i: 'IGNORECASE', m: 'MULTILINE', s: 'DOTALL', x: 'VERBOSE', a: 'ASCII' };

// The Python call a learner would write for these settings.
function pyCode(pattern, flags, mode, hasRepl) {
  const q = !pattern.includes("'") ? "'" : !pattern.includes('"') ? '"' : '"""';
  const f = flags ? ', ' + [...flags].map(c => 're.' + FLAG_NAMES[c]).join(' | ') : '';
  const lines = [`${MODES[mode].fn}(r${q}${pattern}${q}, text${f})`];
  if (mode === 'all') lines.push(`re.findall(r${q}${pattern}${q}, text${f})`);
  if (hasRepl) lines.push(`re.sub(r${q}${pattern}${q}, repl, text${f})`);
  return lines.join('\n');
}

// Text with each match wrapped in <mark>; neighbouring matches alternate colour.
function highlight(text, matches) {
  let out = '', at = 0;
  matches.forEach((m, i) => {
    out += esc(text.slice(at, m.start));
    out += m.end === m.start ? '<span class="rx-empty" title="empty match"></span>'
      : `<mark class="rx-m${i % 2}">${esc(text.slice(m.start, m.end))}</mark>`;
    at = m.end;
  });
  return out + esc(text.slice(at));
}

const show = s => s === null ? '<span class="rx-none">None (group did not take part)</span>' : `<code>${esc(JSON.stringify(s))}</code>`;

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const EXAMPLES = [
    { name: 'Digits in a sentence', pattern: '\\d+', flags: '', mode: 'all', text: 'Order 66 shipped on day 12 with 3 boxes.', repl: '#' },
    { name: 'Dates with groups', pattern: '(\\d{4})-(\\d{2})-(\\d{2})', flags: '', mode: 'all', text: 'Born 1990-04-12, hired 2015-09-01.', repl: '\\3/\\2/\\1' },
    { name: 'Named groups', pattern: '(?P<user>[\\w.]+)@(?P<host>[\\w.]+)', flags: '', mode: 'all', text: 'Write to ann@example.com or bob.lee@mail.org today.', repl: '' },
    { name: 'Greedy versus lazy', pattern: '<.+>', flags: '', mode: 'all', text: '<b>bold</b> and <i>italic</i>', repl: '' },
    { name: 'Validate with fullmatch', pattern: '\\d{3}-\\d{4}', flags: '', mode: 'fullmatch', text: '555-0199', repl: '' },
    { name: 'Whole words, ignoring case', pattern: '\\bcat\\b', flags: 'i', mode: 'all', text: 'Cat, concatenate, CAT and cat.', repl: '' },
    { name: 'Lookahead: price after $', pattern: '(?<=\\$)\\d+(?:\\.\\d+)?', flags: '', mode: 'all', text: 'Pens $4.50, bags $120, 15 percent off.', repl: '' },
    { name: 'Lines with MULTILINE', pattern: '^\\w+', flags: 'm', mode: 'all', text: 'first line\nsecond line\nthird line', repl: '' },
  ];

  const state = () => ({
    pattern: $('rx-pattern').value, mode: $('rx-mode').value, text: $('rx-text').value, repl: $('rx-repl').value,
    flags: [...document.querySelectorAll('.rx-flag')].filter(c => c.checked).map(c => c.value).join(''),
  });

  let seq = 0, timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(go, 200); }

  async function go() {
    const s = state(), mine = ++seq;
    $('rx-code').textContent = pyCode(s.pattern, s.flags, s.mode, s.repl !== '');
    if (!s.pattern) { out({ matches: [], ngroups: 0 }, s, 'Type a pattern above to start.'); return; }
    let r;
    try { r = await RegexPy.run(s.pattern, s.flags, s.text, s.mode, s.repl); }
    catch (e) {
      if (mine !== seq) return;
      $('rx-error').innerHTML = e.timeout
        ? 'That pattern ran for over 3 seconds and was stopped. This is usually <strong>catastrophic backtracking</strong>: nested quantifiers such as <code>(a+)+</code> that can split the same text in exponentially many ways.'
        : 'The Python engine is not available: ' + esc(e.message);
      return;
    }
    if (mine !== seq) return;
    out(r, s);
  }

  function out(r, s, hint) {
    const err = $('rx-error');
    if (r.error) {
      const at = r.error.pos != null ? ` at position ${r.error.pos}` : '';
      err.innerHTML = `<strong>Invalid pattern:</strong> ${esc(r.error.msg)}${at}`;
      $('rx-hl').innerHTML = esc(s.text); $('rx-summary').textContent = ''; $('rx-matches').innerHTML = ''; $('rx-extra').innerHTML = '';
      return;
    }
    err.textContent = hint || '';
    $('rx-hl').innerHTML = highlight(s.text, r.matches);
    const n = r.matches.length;
    $('rx-summary').textContent = s.pattern ? (n === 0 ? 'No match' : `${n} match${n === 1 ? '' : 'es'}${r.truncated ? ' (showing the first ' + n + ')' : ''}`) : '';
    $('rx-matches').innerHTML = n === 0 ? '' : `<div class="wt-scroll"><table class="wt-table"><thead><tr><th>#</th><th>Span</th><th>Match</th>${
      r.ngroups ? '<th>Groups</th>' : ''}</tr></thead><tbody>${r.matches.map((m, i) => `<tr><td>${i + 1}</td><td>${m.start}&ndash;${m.end}</td><td>${show(m.text)}</td>${
      r.ngroups ? `<td>${m.groups.map(g => `<div><b>${g.name ? esc(g.name) : 'group ' + g.n}</b>: ${show(g.text)}</div>`).join('')}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    let extra = '';
    if (r.findall !== undefined) extra += `<h3 class="rx-h">re.findall returns</h3><pre class="model-answer guide-code">${esc(r.findall)}</pre>${
      r.ngroups ? `<p class="rx-tip">With ${r.ngroups === 1 ? 'one group' : 'groups'} in the pattern, findall returns ${r.ngroups === 1 ? 'only what the group captured' : 'a tuple of the groups for each match'}, not the whole match.</p>` : ''}`;
    if (r.sub) extra += `<h3 class="rx-h">re.sub result</h3>` + (r.sub.error
      ? `<p class="rx-bad">${esc(r.sub.error)}</p>`
      : `<pre class="model-answer guide-code">${esc(r.sub.text)}</pre><p class="rx-tip">${r.sub.count} replacement${r.sub.count === 1 ? '' : 's'}</p>`);
    $('rx-extra').innerHTML = extra;
  }

  function load(ex) {
    $('rx-pattern').value = ex.pattern; $('rx-mode').value = ex.mode; $('rx-text').value = ex.text; $('rx-repl').value = ex.repl;
    document.querySelectorAll('.rx-flag').forEach(c => { c.checked = ex.flags.includes(c.value); });
    go();
  }

  $('rx-mode').innerHTML = Object.entries(MODES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  $('rx-examples').innerHTML = '<option value="">Load an example...</option>' + EXAMPLES.map((e, i) => `<option value="${i}">${esc(e.name)}</option>`).join('');
  $('rx-examples').addEventListener('change', e => { if (e.target.value !== '') load(EXAMPLES[+e.target.value]); e.target.value = ''; });
  ['rx-pattern', 'rx-text', 'rx-repl'].forEach(id => $(id).addEventListener('input', schedule));
  $('rx-mode').addEventListener('change', go);
  document.querySelectorAll('.rx-flag').forEach(c => c.addEventListener('change', go));
  RegexPy.onStatus(t => { $('rx-status').textContent = t; });
  RegexPy.warm();
  load(EXAMPLES[0]);
} else {
  module.exports = { pyCode, highlight };
}
