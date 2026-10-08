#!/usr/bin/env node
/* ===========================================================================
 * Tests that multiple-choice options are shuffled on every attempt.
 *
 *     node tools/test_option_shuffle.js
 *
 *   1. shuffleOptions() on every multiple-choice question in every quiz: the same options come
 *      back, the right answer is still the right answer, every question really changes order
 *      (numbers included), "None / All / Both of the above" stay last, keepOrder is honoured, and
 *      across the whole library the right answer lands evenly on A, B, C and D.
 *   2. The real question renderer through a stubbed page: clicking the displayed right answer is
 *      graded correct, clicking a wrong one is graded incorrect, the letters run A, B, C... in the
 *      order shown, true/false is untouched, and a second attempt shows a different order.
 *
 * Run it after changing the quiz page or the option rules.
 * =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2] || path.join(__dirname, '..');
let failures = 0, checks = 0;
const ok = (label, cond, extra) => { checks++; if (!cond) { failures++; console.log('  FAIL', label, extra === undefined ? '' : extra); } };

const src0 = fs.readFileSync(path.join(ROOT, 'assets', 'quiz.js'), 'utf8');
const grab = name => {
  const i = src0.indexOf('function ' + name);
  let depth = 0;
  for (let k = src0.indexOf('{', i); k < src0.length; k++) {
    if (src0[k] === '{') depth++;
    if (src0[k] === '}') { depth--; if (depth === 0) return src0.slice(i, k + 1); }
  }
};
eval(['shuffle', 'shuffleOptions'].map(grab).join(';') + ';globalThis.shuffleOptions = shuffleOptions;');

// ---------------------------------------------------------------- 1. the shuffle itself
const files = fs.readdirSync(path.join(ROOT, 'data'))
  .filter(f => /\.json$/.test(f) && !/(guide|flashcards|box|labs|man|commands)/.test(f)).sort();
const questions = [];
files.forEach(f => {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')); } catch (e) { return; }
  const secs = d.sections || (d.questions ? [{ questions: d.questions }] : []);
  secs.forEach(s => (s.questions || []).forEach(q => { if (q.type === 'mc') questions.push({ f, q }); }));
});

const landed = [0, 0, 0, 0]; let varied = 0, variable = 0, numericQs = 0, fourWay = 0;
questions.forEach(({ f, q }) => {
  const text = q.options[q.correct];
  if (q.options.every(o => /^[-+]?\d[\d,]*(\.\d+)?%?$/.test(String(o).trim()))) numericQs++;
  const orders = new Set();
  for (let r = 0; r < 120; r++) {
    const s = shuffleOptions(q);
    ok(f + ' keeps the same options', [...s.options].sort().join('\u0000') === [...q.options].sort().join('\u0000'), q.question.slice(0, 50));
    ok(f + ' right answer still right', s.options[s.correct] === text, q.question.slice(0, 50));
    orders.add(s.options.join('\u0000'));
    if (q.options.length === 4 && r < 40) landed[s.correct]++;
  }
  if (q.options.length >= 3) { variable++; if (orders.size > 1) varied++; }
  if (q.options.length === 4) fourWay++;
});
ok('every question really changes order, numeric ones included', varied === variable, `${varied} of ${variable}`);
const sum = landed.reduce((a, b) => a + b, 0);
const share = landed.map(n => n / sum);
ok('the right answer lands evenly on A-D across the library (' + share.map(x => (100 * x).toFixed(1) + '%').join(' / ') + ')',
   share.every(x => Math.abs(x - 0.25) < 0.02), share.join(','));
console.log(`${questions.length} multiple-choice questions in ${files.length} quiz files (${numericQs} with all-numeric options, shuffled too); ` +
            `right answer on A/B/C/D after shuffling: ${share.map(x => (100 * x).toFixed(0) + '%').join(' / ')}`);

// special cases
const pin = { options: ['None of the above', 'alpha', 'bravo', 'charlie', 'All of the above'], correct: 2 };
for (let r = 0; r < 200; r++) {
  const s = shuffleOptions(pin);
  ok('"None/All of the above" stay last', s.options.slice(-2).join('|') === 'None of the above|All of the above', s.options.join('|'));
  ok('pinned case keeps the right answer', s.options[s.correct] === 'bravo');
}
const keep = { options: ['one', 'two', 'three', 'four'], correct: 2, keepOrder: true };
ok('keepOrder leaves the order alone', shuffleOptions(keep).options.join() === 'one,two,three,four' && shuffleOptions(keep).correct === 2);
const nums = { options: ['20', '3', '12', '7'], correct: 1 };
const numOrders = new Set(); for (let r = 0; r < 200; r++) numOrders.add(shuffleOptions(nums).options.join());
ok('numeric options are shuffled, not sorted', numOrders.size > 6, numOrders.size);

// ---------------------------------------------------------------- 2. through the real renderer
function el() {
  return { className: '', innerHTML: '', textContent: '', disabled: false, hidden: false, children: [], handlers: {}, list: [],
    classList: { add() {}, remove() {} }, addEventListener(t, f) { this.handlers[t] = f; }, appendChild(c) { this.children.push(c); return c; } };
}
function load(file, search) {
  const els = {};
  const get = id => (els[id] = els[id] || el());
  global.document = {
    getElementById: get, title: '', createElement: () => el(),
    querySelectorAll: sel => (sel === '#options .option' ? get('options').children : []),
  };
  global.window = { location: { search } };
  global.URLSearchParams = URLSearchParams;
  global.localStorage = undefined;
  global.fetch = async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', file + '.json'), 'utf8')) });
  let src = src0.replace(/\ninit\(\);?\s*$/, '\n').replace('if(needsDb) ensureDb();', '').replace('if(needsBox) ensureBox();', '');
  src += '\nglobalThis.api = { init, get flat(){ return flat; }, get answers(){ return answers; }, setCurrent(n){ current = n; }, render, startQuiz, get els(){ return els; } };';
  new Function('require', src)(require);
  return els;
}
const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const displayed = els => els.options.children.map(b => {
  const m = b.innerHTML.match(/<span class="option-letter">([^<]*)<\/span><span>([\s\S]*)<\/span>$/);
  return { letter: m[1], text: unescape(m[2]), click: b.handlers.click };
});

(async () => {
  const QUIZ = 'itd145-final-exam';
  const els = load(QUIZ, '?file=x&mode=full');
  await api.init();
  const first = api.flat.map(i => (i._shown ? i._shown.options.join('\u0000') : null));
  let mcSeen = 0, tfSeen = 0;
  for (let k = 0; k < api.flat.length; k++) {
    const item = api.flat[k];
    if (item.type !== 'mc' && item.type !== 'tf') continue;
    for (const pick of ['right', 'wrong']) {
      els.options.children = [];
      api.setCurrent(k);
      api.render();
      const shown = displayed(els);
      if (item.type === 'tf') {
        if (pick === 'right') { tfSeen++; ok('true/false order untouched', shown.map(s => s.text).join() === 'True,False'); }
      } else if (pick === 'right') {
        mcSeen++;
        ok('letters run A, B, C... in the order shown', shown.map(s => s.letter).join('') === 'ABCDEF'.slice(0, shown.length), shown.map(s => s.letter).join(''));
        ok('the stored options and the shown options are the same set', [...shown.map(s => s.text)].sort().join('\u0000') === [...item.options].sort().join('\u0000'));
      }
      const stored = item.type === 'tf' ? (item.correct ? 'True' : 'False') : item.options[item.correct];
      const target = pick === 'right' ? shown.find(s => s.text === stored) : shown.find(s => s.text !== stored);
      const before = api.answers.length;
      target.click();
      const last = api.answers[api.answers.length - 1];
      ok(`clicking the ${pick} shown answer is graded ${pick === 'right' ? 'correct' : 'incorrect'} (${QUIZ} #${k})`,
         api.answers.length === before + 1 && last.score === (pick === 'right' ? 1 : 0), JSON.stringify({ stored, clicked: target.text, score: last && last.score }));
      ok('the review text names the right answer', last.detail.correctAnswer === stored, last.detail.correctAnswer);
    }
  }
  console.log(`rendered and clicked ${mcSeen} multiple-choice and ${tfSeen} true/false questions through the real renderer`);

  // a second attempt shows a different order
  api.startQuiz();
  const second = api.flat.map(i => (i._shown ? i._shown.options.join('\u0000') : null));
  const byQ = {}; first.forEach((o, i) => { byQ[i] = o; });
  // flat is re-shuffled too, so compare by question text
  const firstByText = {}; load(QUIZ, '?file=x&mode=full'); await api.init();
  api.flat.forEach(i => { if (i._shown) firstByText[i.question] = i._shown.options.join('\u0000'); });
  api.startQuiz();
  let changed = 0, total = 0;
  api.flat.forEach(i => { if (i._shown && i.options.length >= 4) { total++; if (firstByText[i.question] !== i._shown.options.join('\u0000')) changed++; } });
  ok(`a retake shows a different order for almost every question (${changed} of ${total})`, changed / total > 0.9, `${changed}/${total}`);

  console.log(failures ? `\n${failures} of ${checks} checks FAILED` : `\nall ${checks} option-shuffle checks passed`);
  process.exit(failures ? 1 : 0);
})();
