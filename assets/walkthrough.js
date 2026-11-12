/* Step-through walkthroughs: a list of walkthroughs, then one step at a time with Back / Next
 * (arrow keys work too). Data: data/*-walkthroughs.json, built by tools/build_*_walkthroughs.py.
 * The visual renderers are pure strings so Node can test them (tools/test_walkthrough.js). */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function visualHtml(v) {
  if (v.type === 'flow') {
    return `<ol class="wt-flow">${v.nodes.map((n, i) =>
      `<li class="${i === v.active ? 'wt-now' : i < v.active ? 'wt-past' : ''}"><span>${i + 1}</span>${esc(n)}</li>`).join('')}</ol>`;
  }
  if (v.type === 'match') {
    // Each line is text with spans [start, end, group]; where spans overlap the highest group number wins.
    const line = l => {
      const g = new Array(l.text.length).fill(-1);
      l.spans.forEach(([s, e, n = 0]) => { for (let i = s; i < e; i++) g[i] = Math.max(g[i], n); });
      let out = '', i = 0;
      while (i < g.length) {
        let j = i; while (j < g.length && g[j] === g[i]) j++;
        const part = esc(l.text.slice(i, j));
        out += g[i] < 0 ? part : `<mark class="wt-g${g[i] % 4}">${part}</mark>`;
        i = j;
      }
      return `<div class="wt-line"><span class="wt-text-line">${out}</span>${l.note ? `<span class="wt-note">${esc(l.note)}</span>` : ''}</div>`;
    };
    return `<div class="wt-pat">pattern <code>${esc(v.pattern)}</code>${v.flags ? ` <small>flags: ${esc(v.flags)}</small>` : ''}</div>${v.lines.map(line).join('')}`;
  }
  const hl = new Set(v.hl.map(([r, c]) => r + ',' + c));
  return `<div class="wt-scroll"><table class="wt-table"><thead><tr>${v.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    v.rows.map((row, r) => `<tr>${row.map((c, i) => `<td class="${hl.has(r + ',' + i) ? 'wt-hl' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

if (typeof document !== 'undefined') {
  const appEl = document.getElementById('app');
  const file = new URLSearchParams(location.search).get('file');
  let doc, key;

  const fail = msg => { const l = document.getElementById('loading'); l.textContent = msg; l.classList.add('load-error'); };

  const seen = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } };
  const markSeen = id => { try { const s = seen(); s[id] = 1; localStorage.setItem(key, JSON.stringify(s)); } catch (e) { /* private mode */ } };

  function menu() {
    document.removeEventListener('keydown', onKey);
    const s = seen();
    appEl.innerHTML = `
      <div class="page-head"><h1>${esc(doc.title)}</h1></div>
      <p class="dr-lead">Click through a process one step at a time and watch the numbers change. Each one matches a section of the study guide.</p>
      <div class="dr-grid">${doc.walkthroughs.map((w, i) => `<button class="dr-tile" data-i="${i}">
        <span class="dr-title">${esc(w.title)}</span><span class="dr-blurb">${esc(w.blurb)}</span>
        <span class="dr-status ${s[w.id] ? 'dr-done' : ''}">${s[w.id] ? 'Finished ✓' : esc(w.topic)} &middot; ${w.steps.length} steps</span></button>`).join('')}</div>
      <p class="wt-links">${(doc.links || []).map(l => `<a href="${esc(l.href)}">${esc(l.text)}</a>`).join(' &middot; ')}${doc.links && (doc.guideFile || doc.quizFile) ? ' &middot; ' : ''}${doc.guideFile ? `<a href="review.html?file=${encodeURIComponent(doc.guideFile)}">Study guide</a>` : ''}${doc.quizFile ? ` &middot; <a href="quiz.html?file=${encodeURIComponent(doc.quizFile)}">Quiz</a>` : ''}</p>`;
    appEl.querySelectorAll('.dr-tile').forEach(b => b.addEventListener('click', () => open(+b.dataset.i)));
  }

  let w, n;
  const onKey = e => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
  function open(i) { w = doc.walkthroughs[i]; n = 0; document.addEventListener('keydown', onKey); show(); }
  function go(d) { const m = n + d; if (m >= 0 && m < w.steps.length) { n = m; show(); } }

  function show() {
    const st = w.steps[n], last = n === w.steps.length - 1;
    if (last) markSeen(w.id);
    appEl.innerHTML = `
      <div class="page-head"><h1>${esc(w.title)}</h1><button class="btn ghost" id="wt-all">All walkthroughs</button></div>
      <div class="wt-count">Step ${n + 1} of ${w.steps.length}</div>
      <div class="wt-bar"><i style="width:${(n + 1) / w.steps.length * 100}%"></i></div>
      <div class="q-card">
        <h2 class="wt-title">${esc(st.title)}</h2>
        ${visualHtml(st.visual)}
        <p class="wt-text">${esc(st.text)}</p>
      </div>
      <div class="dr-actions">
        <button class="btn ghost" id="wt-back" ${n === 0 ? 'disabled' : ''}>&larr; Back</button>
        ${last ? '<button class="btn primary" id="wt-done">Finish</button>' : '<button class="btn primary" id="wt-next">Next &rarr;</button>'}
      </div>`;
    document.getElementById('wt-all').addEventListener('click', menu);
    document.getElementById('wt-back').addEventListener('click', () => go(-1));
    (document.getElementById('wt-next') || document.getElementById('wt-done')).addEventListener('click', last ? menu : () => go(1));
  }

  (async () => {
    if (!file) return fail('No walkthrough file specified.');
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error('File not found: ' + file);
      doc = await res.json();
      key = 'quizhub-walkthrough-' + file;
      document.title = doc.title;
      document.getElementById('loading').hidden = true;
      menu();
    } catch (err) { fail("Couldn't load the walkthroughs. " + err.message); }
  })();
} else {
  module.exports = { visualHtml };
}
