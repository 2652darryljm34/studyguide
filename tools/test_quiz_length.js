#!/usr/bin/env node
/* ===========================================================================
 * Tests the "how many questions?" picker for quizzes that set "shortCount".
 *
 *     node tools/test_quiz_length.js
 *
 *   1. The sampler (pickEvenly in assets/quiz.js), on the real final-exam quizzes at many
 *      sizes: exactly N questions, no duplicates, each from its own topic, every topic
 *      represented, and no two topics differing by more than one.
 *   2. The chooser flow through a stubbed page: slider, typing, quick-pick buttons, the
 *      remembered choice, ?n= / ?mode= shortcuts, a retake, and a quiz without shortCount.
 *
 * Run it after touching the quiz page or any quiz that sets shortCount.
 * =========================================================================== */
const fs = require('fs');
const ROOT = process.argv[2] || require('path').join(__dirname, '..');
const QUIZZES = ['itn170-final-exam', 'itd256-final-exam', 'itd145-final-exam'];
let failures = 0;
const ok = (label, cond, extra) => { if (!cond) { failures++; console.log('  FAIL', label, extra === undefined ? '' : extra); } };

// ---------- 1. the sampler, on the real quizzes, at many sizes ----------
const src0 = fs.readFileSync(ROOT + '/assets/quiz.js', 'utf8');
const grab = name => {
  const i = src0.indexOf('function ' + name);
  let depth = 0;
  for (let k = src0.indexOf('{', i); k < src0.length; k++) {
    if (src0[k] === '{') depth++;
    if (src0[k] === '}') { depth--; if (depth === 0) return src0.slice(i, k + 1); }
  }
};
eval(grab('shuffle') + ';' + grab('pickEvenly') + ';globalThis.pickEvenly = pickEvenly;');

QUIZZES.forEach(name => {
  const q = JSON.parse(fs.readFileSync(`${ROOT}/data/${name}.json`, 'utf8'));
  const secs = q.sections, S = secs.length;
  const total = secs.reduce((a, s) => a + s.questions.length, 0);
  const smallest = Math.min(...secs.map(s => s.questions.length));
  const sizes = [S, S + 1, 2 * S, 20, 40, 57, 100, total - 1, total];
  let draws = 0;
  sizes.forEach(n => {
    for (let r = 0; r < 300; r++) {
      draws++;
      const picked = pickEvenly(secs, n);
      const flat = picked.flat();
      ok(`${name} n=${n} size`, flat.length === Math.min(n, total), flat.length);
      ok(`${name} n=${n} duplicates`, new Set(flat).size === flat.length);
      picked.forEach((p, i) => p.forEach(x => ok(`${name} n=${n} stays in its section`, secs[i].questions.indexOf(x) >= 0)));
      const counts = picked.map(p => p.length);
      if (n >= S && n <= smallest * S) {
        ok(`${name} n=${n} even spread (counts ${Math.min(...counts)}-${Math.max(...counts)})`, Math.max(...counts) - Math.min(...counts) <= 1);
      }
      if (n >= S) ok(`${name} n=${n} every topic represented`, counts.every(c => c >= 1));
    }
  });
  console.log(`${name}: ${S} topics, ${total} questions, ${draws} sampled draws checked`);
});

// ---------- 2. the chooser flow, driven through a stubbed page ----------
function load(file, search, store) {
  const els = {};
  const el = id => (els[id] = els[id] || { innerHTML: '', value: '', textContent: '', hidden: false, classList: { add() {} }, handlers: {}, addEventListener(t, f) { this.handlers[t] = f; } });
  global.document = { getElementById: el, title: '' };
  global.window = { location: { search } };
  global.URLSearchParams = URLSearchParams;
  global.localStorage = store ? { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } } : undefined;
  global.fetch = async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(`${ROOT}/data/${file}.json`, 'utf8')) });
  let src = src0.replace('function render(){', 'function render_orig(){').replace(/\ninit\(\);?\s*$/, '\n')
    .replace('if(needsDb) ensureDb();', '').replace('if(needsBox) ensureBox();', '');
  src += '\nfunction render(){}\nglobalThis.api = { init, get flat(){ return flat; }, get count(){ return quizCount; }, el: (id) => document.getElementById(id), startQuiz, renderLengthChoice, isSampled };';
  new Function('require', src)(require);
}
const press = (id, n) => api.el('len-presets').handlers.click({ target: { closest: () => ({ dataset: { n: String(n) } }) } });

(async () => {
  const store = {};
  load('itd256-final-exam', '?file=x', store);
  await api.init();
  const app = api.el('app').innerHTML;
  ok('chooser shown', /How many questions/.test(app) && /id="len-range"/.test(app));
  ok('no quiz started yet', api.flat.length === 0);
  ok('slider range is 8..150', /min="8" max="150"/.test(app), app.match(/id="len-range"[^>]*/)[0]);
  ok('starts at the suggested 40', api.el('len-num').value === 40 && /Start quiz \(40 questions\)/.test(api.el('len-go').textContent), api.el('len-num').value);
  ok('note says 5 from each of 8 topics', /Exactly 5 from each of the 8 topics/.test(api.el('len-note').textContent), api.el('len-note').textContent);

  api.el('len-range').value = 27; api.el('len-range').handlers.input();
  ok('slider updates the number box', api.el('len-num').value === 27);
  ok('note mentions 3 or 4 per topic', /3 or 4 from each of the 8 topics/.test(api.el('len-note').textContent), api.el('len-note').textContent);
  ok('button label updates', /Start quiz \(27 questions\)/.test(api.el('len-go').textContent));

  api.el('len-num').value = '3'; api.el('len-num').handlers.change();
  ok('typing below the minimum is raised to 8', api.el('len-num').value === 8, api.el('len-num').value);
  api.el('len-num').value = '9999'; api.el('len-num').handlers.change();
  ok('typing above the total is lowered to 150', api.el('len-num').value === 150, api.el('len-num').value);
  ok('all selected -> full-review wording', /Start full review \(150 questions\)/.test(api.el('len-go').textContent) && /Every question/.test(api.el('len-note').textContent));
  api.el('len-num').value = '12'; api.el('len-num').handlers.input();
  ok('typing a valid number follows along', api.el('len-range').value === 12);

  press('len-presets', 60);
  ok('preset 60 sets everything', api.el('len-num').value === 60 && api.el('len-range').value === 60);
  ok('preset shown as pressed', /len-preset on" data-n="60"/.test(api.el('len-presets').innerHTML));
  ok('presets include All 150', /All 150/.test(api.el('len-presets').innerHTML));

  api.el('len-num').value = 25; api.el('len-num').handlers.change();
  api.el('len-go').handlers.click();
  ok('Start gives exactly 25 questions', api.flat.length === 25 && api.count === 25, api.flat.length);
  ok('every topic appears', new Set(api.flat.map(q => q.sectionName)).size === 8);
  ok('flagged as a sample', api.isSampled());
  ok('choice remembered', store['quizCount:undefined'] === '25' || Object.values(store).includes('25'), JSON.stringify(store));
  const first = api.flat.map(q => q.question).join('|');
  api.startQuiz();
  ok('retake keeps 25 questions', api.flat.length === 25);
  ok('retake draws a fresh random set', api.flat.map(q => q.question).join('|') !== first);

  api.renderLengthChoice();
  ok('reopening the chooser remembers 25', api.el('len-num').value === 25, api.el('len-num').value);
  press('len-presets', 150);
  api.el('len-go').handlers.click();
  ok('choosing All runs the full quiz', api.flat.length === 150 && api.count === null && !api.isSampled());

  // URL shortcuts
  load('itd145-final-exam', '?file=x&n=30', {}); await api.init();
  ok('?n=30 skips the chooser', api.flat.length === 30 && !/How many questions/.test(api.el('app').innerHTML));
  load('itd145-final-exam', '?file=x&n=99999', {}); await api.init();
  ok('?n=99999 means everything', api.flat.length === 215 && !api.isSampled(), api.flat.length);
  load('itd145-final-exam', '?file=x&mode=short', {}); await api.init();
  ok('?mode=short = suggested 40', api.flat.length === 40);
  load('itd145-final-exam', '?file=x&mode=full', {}); await api.init();
  ok('?mode=full = all 215', api.flat.length === 215);

  // small and large topic counts
  load('itn170-final-exam', '?file=x', {}); await api.init();
  ok('ITN 170 minimum is 13 (one per topic)', /min="13" max="133"/.test(api.el('app').innerHTML));
  api.el('len-go').handlers.click();
  ok('ITN 170 default gives 40, 13 topics', api.flat.length === 40 && new Set(api.flat.map(q => q.sectionName)).size === 13);

  // localStorage unavailable (private mode) must not break anything
  load('itd145-final-exam', '?file=x', undefined); await api.init();
  api.el('len-go').handlers.click();
  ok('works with no localStorage', api.flat.length === 40);

  // a quiz without shortCount is untouched
  load('itd145-exam2-review', '?file=x', {}); await api.init();
  ok('quiz without shortCount: no chooser, all questions', api.flat.length === 92 && !/How many questions/.test(api.el('app').innerHTML), api.flat.length);

  console.log(failures ? `\n${failures} FAILED` : '\nall length-picker checks passed');
  process.exit(failures ? 1 : 0);
})();
