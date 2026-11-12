/* Regex challenges: write a pattern, and Python's re (via assets/regexpy.js) grades it against the tests.
 * Data: data/regex-challenges.json, built and verified by tools/build_regex_challenges.py. */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const code = s => `<code class="rx-code">${esc(s)}</code>`;
const appEl = document.getElementById('app');
const KEY = 'quizhub-regex-solved';
let doc, solved = {};
try { solved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { solved = {}; }
const markSolved = id => { solved[id] = 1; try { localStorage.setItem(KEY, JSON.stringify(solved)); } catch (e) { /* private mode */ } };

function menu() {
  const done = doc.challenges.filter(c => solved[c.id]).length;
  appEl.innerHTML = `
    <div class="page-head"><h1>${esc(doc.title)}</h1></div>
    <p class="rx-lead">Write a pattern that passes every test. It is graded by Python's real <code>re</code> module. Solved: <strong>${done} of ${doc.challenges.length}</strong>. Stuck? Try the <a href="regex.html">playground</a> or the <a href="review.html?file=data%2Fregex-guide.json">guide</a>.</p>
    ${doc.levels.map((name, lv) => `<h2 class="rx-level">Level ${lv + 1}: ${esc(name)}</h2><div class="dr-grid">${
      doc.challenges.filter(c => c.level === lv).map(c => `<button class="dr-tile" data-id="${c.id}"><span class="dr-title">${esc(c.title)}</span>
        <span class="dr-status ${solved[c.id] ? 'dr-done' : ''}">${solved[c.id] ? 'Solved ✓' : 'Not solved yet'}</span></button>`).join('')}</div>`).join('')}`;
  appEl.querySelectorAll('.dr-tile').forEach(b => b.addEventListener('click', () => open(b.dataset.id)));
}

function open(id) {
  const c = doc.challenges.find(x => x.id === id), spec = c.spec;
  const idx = doc.challenges.indexOf(c), next = doc.challenges[idx + 1];
  const tests = spec.kind === 'validate'
    ? `<div class="rx-tests" id="rx-tests"></div>`
    : `<h3 class="rx-h">Text</h3><pre class="rx-hl">${esc(spec.text)}</pre>${spec.kind === 'sub' ? `<p>Replacement: ${code(spec.repl)}</p>` : ''}
       <p>Expected ${spec.kind === 'sub' ? 'result' : 'findall result'}:</p><pre class="rx-hl">${esc(typeof spec.expected === 'string' ? spec.expected : JSON.stringify(spec.expected))}</pre>
       <div id="rx-tests"></div>`;
  appEl.innerHTML = `
    <div class="page-head"><h1>${esc(c.title)}</h1><button class="btn ghost" id="rx-back">All challenges</button></div>
    <div class="q-card">
      <p class="q-prompt">${esc(c.task)}</p>
      ${c.flags ? `<p class="rx-tip">Flags already set: ${[...c.flags].map(f => 're.' + { m: 'MULTILINE', i: 'IGNORECASE', s: 'DOTALL' }[f]).join(', ')}</p>` : ''}
      ${tests}
      <label for="rx-pat" class="rx-label">Your pattern <small>(as inside r"...")</small></label>
      <input id="rx-pat" class="fb-input rx-mono" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div id="rx-result" class="rx-result" role="status"></div>
      <div class="dr-actions">
        <button class="btn ghost" id="rx-hint">Hint</button>
        <button class="btn ghost" id="rx-sol">Show a solution</button>
        ${next ? `<button class="btn primary" id="rx-next" hidden>Next challenge &rarr;</button>` : ''}
      </div>
      <div id="rx-reveal"></div>
    </div>`;
  document.getElementById('rx-back').addEventListener('click', menu);
  document.getElementById('rx-hint').addEventListener('click', () => { document.getElementById('rx-reveal').innerHTML = `<p class="rx-tip"><strong>Hint:</strong> ${esc(c.hint)}</p>`; });
  document.getElementById('rx-sol').addEventListener('click', () => {
    document.getElementById('rx-reveal').innerHTML = `<p class="rx-tip">One solution (yours may differ and still pass):</p><pre class="model-answer guide-code">${esc(c.solution)}</pre>`;
  });
  if (next) document.getElementById('rx-next').addEventListener('click', () => open(next.id));

  const input = document.getElementById('rx-pat');
  let seq = 0, timer;
  const run = async () => {
    const mine = ++seq, pattern = input.value;
    if (!pattern) { render(c, null); return; }
    let r;
    try { r = await RegexPy.check(pattern, c.flags, spec); }
    catch (e) { if (mine === seq) document.getElementById('rx-result').innerHTML = `<span class="rx-bad">${e.timeout ? 'Stopped after 3 seconds: this pattern backtracks catastrophically.' : esc(e.message)}</span>`; return; }
    if (mine !== seq) return;
    render(c, r);
    if (r.ok) { markSolved(c.id); if (next) document.getElementById('rx-next').hidden = false; }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
  render(c, null);
  input.focus();
}

// Draw the tests, with a pass or fail mark on each once the pattern has been graded (r !== null).
function render(c, r) {
  const spec = c.spec, box = document.getElementById('rx-tests'), res = document.getElementById('rx-result');
  const mark = ok => ok === undefined ? '<span class="rx-mark">&bull;</span>' : ok ? '<span class="rx-mark rx-pass">✓</span>' : '<span class="rx-mark rx-fail">✗</span>';
  if (r && r.error) { res.innerHTML = `<span class="rx-bad">Invalid pattern: ${esc(r.error.msg)}${r.error.pos != null ? ' at position ' + r.error.pos : ''}</span>`; return; }
  if (spec.kind === 'validate') {
    const by = new Map((r ? r.results : []).map(x => [x.text, x]));
    const row = (t, want, hidden) => {
      const x = by.get(t);
      return `<li>${mark(x && x.ok)} ${hidden ? '<em>hidden test</em>' : code(t)}${hidden && x && !x.ok ? ' ' + code(t) : ''}</li>`;
    };
    const list = (title, want) => {
      const vis = spec[want ? 'good' : 'bad'], hid = spec[want ? 'hidden_good' : 'hidden_bad'];
      return `<div><h3 class="rx-h">${title}</h3><ul class="rx-list">${vis.map(t => row(t, want, false)).join('')}${hid.map(t => row(t, want, true)).join('')}</ul></div>`;
    };
    box.innerHTML = `<div class="rx-cols">${list('Should match the whole string', true)}${list('Should NOT match', false)}</div>`;
  } else if (r) {
    const x = r.results[0];
    box.innerHTML = `<p>${mark(x.ok)} Your pattern gives:</p><pre class="rx-hl">${esc(typeof x.got === 'string' ? x.got : JSON.stringify(x.got))}</pre>`;
  } else box.innerHTML = '';
  if (!r) { res.textContent = ''; return; }
  const fails = r.results.filter(x => !x.ok).length;
  res.innerHTML = r.ok ? '<span class="rx-good">All tests pass. Nicely done.</span>' : `<span class="rx-bad">${fails} test${fails === 1 ? '' : 's'} failing.</span>`;
}

(async () => {
  const loading = document.getElementById('loading');
  try {
    const res = await fetch('data/regex-challenges.json');
    if (!res.ok) throw new Error('data/regex-challenges.json not found');
    doc = await res.json();
    loading.hidden = true;
    RegexPy.onStatus(t => { document.getElementById('rx-status').textContent = t; });
    RegexPy.warm();
    menu();
  } catch (err) { loading.textContent = "Couldn't load the challenges. " + err.message; loading.classList.add('load-error'); }
})();
