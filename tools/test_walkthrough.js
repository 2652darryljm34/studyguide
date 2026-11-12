#!/usr/bin/env node
/* Tests the walkthrough renderer (assets/walkthrough.js): node tools/test_walkthrough.js
 * Every step of every data/*-walkthroughs.json renders, HTML in text is escaped, and the number of highlighted
 * cells matches the data. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { visualHtml } = require(path.join(root, 'assets', 'walkthrough.js'));
let failures = 0, steps = 0;
const ok = (label, cond) => { if (!cond) { failures++; console.log('  FAIL', label); } };

ok('escapes', !visualHtml({ type: 'table', headers: ['<b>'], rows: [['<i>']], hl: [] }).includes('<b>'));
for (const f of fs.readdirSync(path.join(root, 'data')).filter(f => f.endsWith('-walkthroughs.json'))) {
  const doc = JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));
  ok(f + ' has walkthroughs', doc.walkthroughs.length > 0);
  for (const w of doc.walkthroughs) w.steps.forEach((s, i) => {
    steps++;
    const html = visualHtml(s.visual), where = `${f} ${w.id} step ${i + 1}`;
    ok(where + ' has text', s.title && s.text);
    const want = s.visual.type === 'table' ? s.visual.hl.length : 1;
    const got = (html.match(/class="wt-hl"|class="wt-now"/g) || []).length;
    ok(`${where} highlights ${want}, got ${got}`, got === want);
  });
}
console.log(failures ? failures + ' failure(s)' : steps + ' steps: all checks passed');
process.exit(failures ? 1 : 0);
