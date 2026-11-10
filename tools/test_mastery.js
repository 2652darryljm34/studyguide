#!/usr/bin/env node
/* Tests the mastery loop (?mode=mastery) in assets/quiz.js through a stubbed page.
 *
 *     node tools/test_mastery.js
 *
 * Policy under test: every question must be answered correctly twice in a row. A tiny fixture quiz is
 * answered "wrong first, then right" for every question, so each one should take exactly three
 * attempts, the loop must end by itself, and the progress counters must reach the total.
 * Also checks that only auto-graded types are kept, and that without ?mode=mastery nothing changes.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2] || path.join(__dirname, '..');
let failures = 0;
const ok = (label, cond, extra) => { if (!cond) { failures++; console.log('  FAIL', label, extra === undefined ? '' : extra); } };

const src0 = fs.readFileSync(path.join(ROOT, 'assets', 'quiz.js'), 'utf8');
const FIXTURE = { title: 'Fixture', sections: [
  { name: 'A', questions: [1, 2, 3, 4].map(i => ({ type: 'mc', question: 'mc ' + i, options: ['a', 'b', 'c', 'd'], correct: i % 4, explanation: 'x' })) },
  { name: 'B', questions: [
    { type: 'tf', question: 'tf 1', correct: true },
    { type: 'tf', question: 'tf 2', correct: false },
    { type: 'short_answer', question: 'sa', modelAnswer: 'm', rubric: ['r'] } ] },
] };

function el() {
  return { className: '', innerHTML: '', textContent: '', disabled: false, hidden: false, children: [], handlers: {}, list: [],
    classList: { add() {}, remove() {} }, addEventListener(t, f) { this.handlers[t] = f; }, appendChild(c) { this.children.push(c); return c; } };
}
function load(search) {
  const els = {};
  const get = id => (els[id] = els[id] || el());
  global.document = { getElementById: get, title: '', createElement: () => el(), querySelectorAll: sel => (sel === '#options .option' ? get('options').children : []) };
  global.window = { location: { search } };
  global.URLSearchParams = URLSearchParams;
  global.localStorage = undefined;
  global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(FIXTURE)) });
  let src = src0.replace(/\ninit\(\);?\s*$/, '\n').replace('if(needsDb) ensureDb();', '').replace('if(needsBox) ensureBox();', '');
  src += '\nglobalThis.api = { init, get flat(){ return flat; }, get answers(){ return answers; }, get current(){ return current; }, get mDone(){ return mDone; }, render, startQuiz };';
  new Function('require', src)(require);
  return els;
}
const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const shownOptions = els => els.options.children.map(b => {
  const m = b.innerHTML.match(/<span class="option-letter">([^<]*)<\/span><span>([\s\S]*)<\/span>$/);
  return { text: unescape(m[2]), click: b.handlers.click };
});

(async () => {
  // ---- mastery on
  const els = load('?file=x&mode=mastery');
  await api.init();
  api.startQuiz();
  const N = api.flat.length;
  ok('short answer questions are left out of the loop', N === 6, N);

  const attempts = {}; const wrongDone = new Set(); let guard = 0;
  while (api.current < api.flat.length && guard++ < 200) {
    const item = api.flat[api.current];
    els.options.children = [];
    api.render();
    const stored = item.type === 'tf' ? (item.correct ? 'True' : 'False') : item.options[item.correct];
    const shown = shownOptions(els);
    const first = !wrongDone.has(item._mid);
    wrongDone.add(item._mid);
    (first ? shown.find(o => o.text !== stored) : shown.find(o => o.text === stored)).click();
    attempts[item._mid] = (attempts[item._mid] || 0) + 1;
    els['next-btn'].handlers.click();
  }
  ok('the loop ends by itself', guard < 200, guard);
  ok('every question took wrong + right + right = 3 attempts', Object.values(attempts).every(n => n === 3) && Object.keys(attempts).length === N, JSON.stringify(attempts));
  ok('all questions are mastered at the end', api.mDone.size === N, api.mDone.size);
  ok('results page shows the mastery summary', /mastery loop complete/.test(els.app.innerHTML), els.app.innerHTML.slice(0, 80));

  // ---- a question answered right twice in a row leaves after exactly 2 attempts
  const els3 = load('?file=x&mode=mastery'); await api.init(); api.startQuiz();
  let n = 0; guard = 0;
  while (api.current < api.flat.length && guard++ < 200) {
    const item = api.flat[api.current];
    els3.options.children = []; api.render();
    const stored = item.type === 'tf' ? (item.correct ? 'True' : 'False') : item.options[item.correct];
    shownOptions(els3).find(o => o.text === stored).click(); n++;
    els3['next-btn'].handlers.click();
  }
  ok('all-correct run takes 2 attempts per question', n === 2 * N, n);

  // ---- mastery off: nothing changes
  const els4 = load('?file=x&mode=full'); await api.init();
  ok('normal mode keeps short answer questions', api.flat.length === 7, api.flat.length);
  ok('normal mode shows no mastery text', !/Mastered/.test(els4.app.innerHTML));

  console.log(failures ? failures + ' failure(s)' : 'mastery loop checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
