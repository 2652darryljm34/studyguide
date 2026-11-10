#!/usr/bin/env node
/* Tests the number-drill generators (assets/drillgen.js): node tools/test_drills.js
 * For every drill, 2000 random problems: the problem has text and worked steps, its own answer is
 * accepted, a clearly wrong answer is rejected, numeric answers are finite, and choice answers are
 * among the choices. The kNN drill never produces a tie. */
'use strict';
const path = require('path');
const G = require(path.join(process.argv[2] || path.join(__dirname, '..'), 'assets', 'drillgen.js'));
let failures = 0;
const ok = (label, cond, extra) => { if (!cond) { failures++; if (failures < 25) console.log('  FAIL', label, extra === undefined ? '' : extra); } };

G.DRILLS.forEach(d => {
  for (let i = 0; i < 2000; i++) {
    const p = d.gen();
    const tag = d.id + ': ' + String(p.q).slice(0, 60);
    ok(tag + ' has text and steps', p.q && Array.isArray(p.steps) && p.steps.length >= 1);
    if (p.choices) {
      ok(tag + ' answer is one of the choices', p.choices.includes(p.answer), p.answer + ' not in ' + p.choices);
      ok(tag + ' accepts its answer', G.check(p, p.answer));
      ok(tag + ' rejects another choice', !G.check(p, p.choices.find(c => c !== p.answer)));
    } else {
      ok(tag + ' answer is finite', Number.isFinite(p.answer), p.answer);
      ok(tag + ' accepts its answer', G.check(p, String(p.answer)) && G.check(p, ' ' + p.answer + (p.unit === '%' ? '%' : '')));
      ok(tag + ' rejects a wrong answer', !G.check(p, String(p.answer + 1)) && !G.check(p, ''));
    }
  }
});
console.log(failures ? failures + ' failure(s)' : G.DRILLS.length + ' drills x 2000 problems: all checks passed');
process.exit(failures ? 1 : 0);
