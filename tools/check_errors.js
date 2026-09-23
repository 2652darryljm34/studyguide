#!/usr/bin/env node
/* ===========================================================================
 * Diff the emulator's error messages against a real RHEL 9 machine's.
 *
 *     node tools/check_errors.js            # summary
 *     node tools/check_errors.js --all      # every difference, not just 40
 *     node tools/check_errors.js --cmd ls   # one command, in full
 *
 * tools/harvest/out/errors.json records what a real machine says when a
 * command is given a bad option, a missing file, or no arguments at all --
 * the exact stderr and the exact exit code. This runs the same three probes
 * here and shows where we disagree.
 *
 * Exit codes are the part nobody remembers: `ls` exits 2 on a bad option
 * while `chmod`, `rm` and `cat` exit 1, `dnf` exits 1, `systemctl` exits 1,
 * and a few reach for 64 or 125. A learner who writes a script around
 * `if [ $? -eq 1 ]` is relying on us being right about this.
 *
 * This is a report, not a test -- it never fails a build. The assertions that
 * must hold live in tools/test_shell.js.
 * =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROBES = path.join(ROOT, 'tools', 'harvest', 'out', 'errors.json');

const HarborBox = require(path.join(ROOT, 'assets', 'box.js'));
const HarborShell = require(path.join(ROOT, 'assets', 'shell.js'));
global.HarborShell = HarborShell;
['shtext', 'shadmin', 'shpkg', 'shsys'].forEach(function (f) {
  require(path.join(ROOT, 'assets', f + '.js'));
});
// The harvested usage table -- real exit codes for a bad option.
HarborShell.usage = require(path.join(ROOT, 'assets', 'shusage.js'));

const argv = process.argv.slice(2);
const SHOW_ALL = argv.indexOf('--all') !== -1;
const ONLY = (function () {
  const i = argv.indexOf('--cmd');
  return i === -1 ? null : argv[i + 1];
})();

if (!fs.existsSync(PROBES)) {
  console.log('No harvested probes. Run: python3 tools/harvest.py');
  process.exit(0);
}

const probes = JSON.parse(fs.readFileSync(PROBES, 'utf8'));
const IMAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'itn170-box.json'), 'utf8'));
const box = HarborBox.fromImage(IMAGE);

/* The same three invocations collect.sh used. */
const PROBE_ARGS = {
  'bad-option': '--zzz-not-an-option',
  'missing-file': '/nonexistent/zzz-no-such-path',
  'no-args': ''
};

/** Trailing whitespace and the trailing newline are not the interesting part. */
function norm(s) {
  return String(s || '').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
}

/*
 * As root, because collect.sh ran as root inside the container -- that is
 * simply who you are in a container. Probing as `student` here compared a
 * permission error against an option error: `useradd --zzz` answered 1 for
 * "Permission denied" while the real machine answered 2 for the bad option,
 * and the emulator looked wrong when it was already right.
 */
function run(cmd, args) {
  const sh = HarborShell.create(box.fork(), { interactive: false, user: 'root' });
  const res = sh.run(args ? cmd + ' ' + args : cmd);
  return { stderr: norm(res.stderr), status: res.status };
}

const implemented = HarborShell.commands;
const rows = [];
let checked = 0, agree = 0, statusOnly = 0, textOnly = 0, both = 0, skipped = 0;

Object.keys(probes).sort().forEach(function (cmd) {
  if (ONLY && cmd !== ONLY) return;
  if (!implemented[cmd]) { skipped++; return; }

  Object.keys(probes[cmd]).forEach(function (label) {
    const want = probes[cmd][label];
    const got = run(cmd, PROBE_ARGS[label]);
    const wantErr = norm(want.stderr);

    checked++;
    const sameStatus = got.status === want.status;
    const sameText = got.stderr === wantErr;
    if (sameStatus && sameText) { agree++; return; }
    if (sameStatus) textOnly++;
    else if (sameText) statusOnly++;
    else both++;

    rows.push({ cmd: cmd, label: label, want: want, wantErr: wantErr, got: got,
                sameStatus: sameStatus, sameText: sameText });
  });
});

/* ---------- report ---------- */

// Machine-readable, for slicing the differences without scraping the text.
if (argv.indexOf('--json') !== -1) {
  console.log(JSON.stringify({
    checked: checked, agree: agree, statusOnly: statusOnly,
    textOnly: textOnly, both: both, skipped: skipped,
    rows: rows.map(function (r) {
      return { cmd: r.cmd, probe: r.label, realStatus: r.want.status,
               ourStatus: r.got.status, realErr: r.wantErr, ourErr: r.got.stderr };
    })
  }, null, 1));
  process.exit(0);
}

if (ONLY) {
  rows.forEach(function (r) {
    console.log('\n%s  [%s]', r.cmd, r.label);
    console.log('  real   exit %d  %j', r.want.status, r.wantErr);
    console.log('  ours   exit %d  %j', r.got.status, r.got.stderr);
  });
  if (!rows.length) console.log('%s: every probe matches.', ONLY);
  process.exit(0);
}

/* Node's console.log has no printf width specifiers -- %-14s prints
 * literally. Pad by hand. */
function pad(s, n) { return String(s).padEnd(n); }
function num(n, w) { return String(n).padStart(w); }

const cmdCount = Object.keys(probes).filter(function (c) { return implemented[c]; }).length;
console.log('Error messages, against a real RHEL 9 machine');
console.log('-'.repeat(64));
console.log('  probes checked            ' + num(checked, 5) +
            '  across ' + cmdCount + ' implemented commands');
console.log('  exact match               ' + num(agree, 5) + '   ' +
            Math.round((agree / checked) * 100) + '%');
console.log('  wrong exit code only      ' + num(statusOnly, 5));
console.log('  wrong message only        ' + num(textOnly, 5));
console.log('  both wrong                ' + num(both, 5));
console.log('  not implemented (skipped) ' + num(skipped, 5) + '  commands');
console.log('-'.repeat(64));

const worst = rows.filter(function (r) { return !r.sameStatus; });
if (worst.length) {
  console.log('\nWrong exit code -- these break `if [ $? -eq N ]` in a script:\n');
  console.log('  ' + pad('command', 16) + pad('probe', 14) +
              num('real', 6) + num('ours', 7));
  worst.slice(0, SHOW_ALL ? worst.length : 25).forEach(function (r) {
    console.log('  ' + pad(r.cmd, 16) + pad(r.label, 14) +
                num(r.want.status, 6) + num(r.got.status, 7));
  });
  if (!SHOW_ALL && worst.length > 25) console.log('  ... and %d more', worst.length - 25);
}

const wording = rows.filter(function (r) { return r.sameStatus && !r.sameText; });
if (wording.length) {
  console.log('\nWrong wording:\n');
  wording.slice(0, SHOW_ALL ? wording.length : 15).forEach(function (r) {
    console.log('  %s [%s]', r.cmd, r.label);
    console.log('    real  %j', r.wantErr.split('\n')[0]);
    console.log('    ours  %j', r.got.stderr.split('\n')[0] || '(nothing)');
  });
  if (!SHOW_ALL && wording.length > 15) {
    console.log('  ... and %d more (--all to see them)', wording.length - 15);
  }
}

console.log('\n%d of %d probes match exactly.', agree, checked);
