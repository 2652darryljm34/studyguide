#!/usr/bin/env node
/* Tests the pure helpers of the regex playground (assets/regex.js): node tools/test_regex.js */
'use strict';
const path = require('path');
const { pyCode, highlight } = require(path.join(__dirname, '..', 'assets', 'regex.js'));
let failures = 0;
const ok = (label, cond) => { if (!cond) { failures++; console.log('  FAIL', label); } };
const bs = String.fromCharCode(92);
ok('findall call', pyCode(bs + 'd+', 'im', 'all', true).split('\n').length === 3 && pyCode(bs + 'd+', 'im', 'all', false).includes('re.IGNORECASE | re.MULTILINE'));
ok('quote choice', pyCode("it's", '', 'search', false).includes('r"it\'s"'));
ok('highlight escapes', highlight('a<b', [{ start: 1, end: 2 }]) === 'a<mark class="rx-m0">&lt;</mark>b');
ok('empty match marker', highlight('ab', [{ start: 1, end: 1 }]).includes('rx-empty'));
console.log(failures ? failures + ' failure(s)' : 'regex page helpers: all checks passed');
process.exit(failures ? 1 : 0);
