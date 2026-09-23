#!/usr/bin/env node
/* ===========================================================================
 * Exercises the practice machine the way the browser does, then checks every
 * shipped `shell` question against it.
 *
 *     node tools/test_shell.js
 *     node tools/test_shell.js --verbose
 *
 * Three jobs:
 *
 *   1. The engine itself -- expansion, redirection, permissions, links, the
 *      account database, packages, services. These are the behaviours a wrong
 *      answer would be graded against, so they have to be right.
 *
 *   2. Consistency between the shell and the image: every command the shell
 *      implements has a file on the PATH, and every one of those files is owned
 *      by an installed package. Otherwise `which`, `ls /usr/bin` and `rpm -qf`
 *      would disagree with what actually runs.
 *
 *   3. Every shipped question: its own solution grades as correct, a wrong
 *      answer is rejected with an explanation, and its `places` exist.
 *
 * Run it after touching anything in assets/sh*.js or any ITN 170 question.
 * =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.indexOf('--verbose') !== -1;

const HarborBox = require(path.join(ROOT, 'assets', 'box.js'));
const HarborShell = require(path.join(ROOT, 'assets', 'shell.js'));
global.HarborShell = HarborShell;
['shtext', 'shadmin', 'shpkg', 'shsys'].forEach(function (f) {
  require(path.join(ROOT, 'assets', f + '.js'));
});
// The harvested usage table -- real exit codes for a bad option.
HarborShell.usage = require(path.join(ROOT, 'assets', 'shusage.js'));
const ShellHL = require(path.join(ROOT, 'assets', 'shellhl.js'));

const IMAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'itn170-box.json'), 'utf8'));

let passed = 0;
const failures = [];

function ok(label, condition, detail) {
  if (condition) {
    passed++;
    if (VERBOSE) console.log('  ok   ' + label);
    return true;
  }
  failures.push({ label: label, detail: detail });
  console.log('  FAIL ' + label);
  if (detail) console.log('       ' + String(detail).replace(/\n/g, '\n       '));
  return false;
}

function section(name) {
  console.log('\n' + name);
}

/** A fresh machine and shell for one group of assertions. */
function shell(opts) {
  const box = HarborBox.fromImage(IMAGE);
  return HarborShell.create(box, Object.assign({ interactive: false }, opts || {}));
}

/** Run a line and return its combined transcript, trimmed. */
function run(sh, line) {
  return sh.run(line).display.replace(/\n$/, '');
}

function outputs(label, line, expected, opts) {
  const sh = (opts && opts.sh) || shell();
  if (opts && opts.setup) [].concat(opts.setup).forEach(function (l) { sh.run(l); });
  const got = run(sh, line);
  ok(label, got === expected, 'ran:      ' + line + '\nexpected: ' +
    JSON.stringify(expected) + '\ngot:      ' + JSON.stringify(got));
  return sh;
}

function contains(label, line, needle, opts) {
  const sh = (opts && opts.sh) || shell();
  if (opts && opts.setup) [].concat(opts.setup).forEach(function (l) { sh.run(l); });
  const got = run(sh, line);
  ok(label, got.indexOf(needle) !== -1,
    'ran:     ' + line + '\nwanted:  ' + JSON.stringify(needle) + '\ngot:     ' + got);
  return sh;
}

/* =========================================================================
 * 1. The shell language
 * ======================================================================= */

section('Expansion and quoting');

outputs('a bare word', 'echo hello', 'hello');
outputs('double quotes expand variables', 'echo "I am $USER"', 'I am student');
outputs('single quotes do not', "echo 'I am $USER'", 'I am $USER');
outputs('brace expansion, a list', 'echo file{a,b,c}.txt', 'filea.txt fileb.txt filec.txt');
outputs('brace expansion, a range', 'echo item{1..4}', 'item1 item2 item3 item4');
outputs('brace expansion, zero padded', 'echo n{01..03}', 'n01 n02 n03');
outputs('nested braces', 'echo {a,b}{1,2}', 'a1 a2 b1 b2');
outputs('tilde is the home directory', 'echo ~', '/home/student');
outputs('tilde for another user', 'echo ~operator1', '/home/operator1');
outputs('command substitution', 'echo "user is $(whoami)"', 'user is student');
outputs('exit status of a success', 'true; echo $?', '0');
outputs('exit status of a failure', 'false; echo $?', '1');
outputs('&& runs only on success', 'true && echo yes', 'yes');
outputs('&& skips after failure', 'false && echo yes', '');
outputs('|| runs only on failure', 'false || echo fallback', 'fallback');
outputs('a backslash inside double quotes keeps the dollar literal',
  'echo "\\$HOME is your home"', '$HOME is your home');
outputs('an escaped dollar survives into awk',
  'echo "a b c" | awk "{print \\$NF}"', 'c');
outputs('a quoted glob is not expanded', 'cd ~/labs/files && echo "*.txt"', '*.txt');
outputs('escaping a space', 'echo one\\ two', 'one two');

section('Globbing');

outputs('star matches a suffix', 'cd ~/labs/files && echo *.php',
  'about.php contact.php index.php');
outputs('question mark matches one character', 'cd ~/labs/files && echo report?.txt',
  'report1.txt report2.txt report3.txt report4.txt report5.txt');
outputs('a bracket set', 'cd ~/labs/files && echo report[13].txt',
  'report1.txt report3.txt');
outputs('a negated bracket set', 'cd ~/labs/files && echo report[!123].txt',
  'report4.txt report5.txt');
outputs('a leading dot is not matched by *', 'cd ~/labs/files && echo *.txt | grep -c hidden', '0');
outputs('an unmatched pattern is passed through',
  'cd ~/labs/files && echo *.nothing', '*.nothing');

section('Redirection and pipes');

outputs('write then append', 'cd /tmp && echo one > t.txt && echo two >> t.txt && cat t.txt',
  'one\ntwo');
outputs('redirect truncates', 'cd /tmp && echo one > t2.txt && echo two > t2.txt && cat t2.txt',
  'two');
outputs('stderr goes to 2>', 'cd /tmp && ls /nope 2> e.txt; wc -l < e.txt', '1');
outputs('stdout and stderr both redirected',
  'cd /tmp && ls /etc /nope &> b.txt; grep -c "No such" b.txt', '1');
outputs('stderr merged into stdout', 'ls /nope 2>&1 | wc -l', '1');
outputs('a pipeline', 'cd ~/labs/text && cat employees.csv | wc -l', '13');
outputs('tee writes and passes through',
  'cd /tmp && echo saved | tee kept.txt | wc -l', '1');
outputs('input redirection', 'cd ~/labs/text && wc -l < employees.csv', '13');

/* =========================================================================
 * 2. The filesystem
 * ======================================================================= */

section('Files, directories and links');

outputs('mkdir -p builds the whole path',
  'cd /tmp && mkdir -p a/b/c && test -d a/b/c && echo built', 'built');
outputs('rmdir refuses a non-empty directory',
  'cd /tmp && mkdir -p full/inside && rmdir full 2>&1 | grep -c "not empty"', '1');
outputs('rm needs -r for a directory',
  'cd /tmp && mkdir -p rr && rm rr 2>&1 | grep -c "Is a directory"', '1');
outputs('touch creates an empty file',
  'cd /tmp && touch fresh.txt && wc -c < fresh.txt', '0');
outputs('cp copies content',
  'cd /tmp && echo body > src.txt && cp src.txt dst.txt && cat dst.txt', 'body');
outputs('mv renames',
  'cd /tmp && touch old.txt && mv old.txt new.txt && ls new.txt', 'new.txt');

(function () {
  const sh = shell();
  sh.run('cd ~/labs/links');
  const before = run(sh, "stat -c '%h' original.txt");
  ok('a hard link raises the link count', before === '2',
    'expected 2 links on the shipped file, got ' + before);
  sh.run('ln original.txt third.txt');
  const after = run(sh, "stat -c '%h' original.txt");
  ok('another hard link raises it again', after === '3', 'got ' + after);
  const inos = run(sh, "stat -c '%i' original.txt third.txt").split('\n');
  ok('hard links share one inode', inos[0] === inos[1], inos.join(' vs '));
  sh.run('rm original.txt');
  ok('removing one name leaves the content reachable',
    run(sh, 'cat third.txt').indexOf('one real file') !== -1,
    run(sh, 'cat third.txt'));
})();

outputs('a symbolic link resolves to its target',
  'cat ~/labs/links/softlink.txt', 'The one real file. Hard links share this content.');
outputs('a broken symbolic link reports no such file',
  'cat ~/labs/links/broken.txt 2>&1 | grep -c "No such file"', '1');
outputs('ln -s can point at a directory',
  'ls ~/labs/links/etc-shortcut/ | grep -c os-release', '1');
outputs('a hard link to a directory is refused',
  'cd /tmp && mkdir -p hd && ln hd hd2 2>&1 | grep -c "not allowed for directory"', '1');

section('Permissions');

outputs('octal and symbolic reach the same mode',
  "cd /tmp && touch m1 m2 && chmod 640 m1 && chmod u=rw,g=r,o= m2 && stat -c '%a' m1 m2",
  '640\n640');
outputs('chmod u+x adds one bit',
  "cd /tmp && touch x1 && chmod 644 x1 && chmod u+x x1 && stat -c '%a' x1", '744');
outputs('chmod -R reaches into subdirectories',
  "cd /tmp && mkdir -p rp/sub && touch rp/sub/f && chmod -R 700 rp && stat -c '%a' rp/sub/f",
  '700');
outputs('umask withholds bits from a new file',
  "cd /tmp && umask 022 && touch u1 && stat -c '%a' u1", '644');
outputs('a stricter umask withholds more',
  "cd /tmp && umask 077 && touch u2 && stat -c '%a' u2", '600');
outputs('a new directory starts from 777',
  "cd /tmp && umask 022 && mkdir ud && stat -c '%a' ud", '755');
outputs('you cannot change the mode of a file you do not own',
  'chmod 777 ~/labs/perms/secret.txt 2>&1 | grep -c "Operation not permitted"', '1');
outputs('you cannot read a file you have no permission on',
  'cat ~/labs/perms/secret.txt 2>&1 | grep -c "Permission denied"', '1');
outputs('root can read it',
  'sudo cat ~/labs/perms/secret.txt', 'Owned by root, readable by root only.');
outputs('only root may give a file away',
  'chown root ~/labs/perms/public.txt 2>&1 | grep -c "Operation not permitted"', '1');
outputs('the setgid bit shows as s in the group triple',
  "stat -c '%A' ~/labs/perms/shared", 'drwxrwsr-x');
outputs('the sticky bit shows as t in the other triple',
  "stat -c '%A' /tmp", 'drwxrwxrwt');
outputs('a directory needs x to be entered',
  'cd ~/labs/perms && chmod 600 locked && cd locked 2>&1 | grep -c "Permission denied"', '1');

/* =========================================================================
 * 3. Text processing
 * ======================================================================= */

section('Text tools');

outputs('grep counts matching lines',
  'grep -c Engineering ~/labs/text/employees.csv', '4');
outputs('grep -v inverts',
  'grep -vc Engineering ~/labs/text/employees.csv', '9');
outputs('grep -n prefixes the line number',
  'grep -n Fowler ~/labs/text/employees.csv | cut -d: -f1', '11');
outputs('grep -i ignores case',
  'grep -ic ENGINEERING ~/labs/text/employees.csv', '4');
outputs('grep -r searches a tree',
  'grep -rl WARN ~/labs/survey | wc -l', '1');
outputs('grep -E uses extended expressions',
  'grep -Ec "Engineer (I|II)$" ~/labs/text/employees.csv', '0');
outputs('cut selects a field',
  'cut -d, -f3 ~/labs/text/employees.csv | sort -u | tail -3',
  'Operations\nSupport\ndepartment');
outputs('sort -n orders numerically',
  'sort -n ~/labs/text/numbers.txt | head -1', '3');
outputs('sort -nr reverses it',
  'sort -nr ~/labs/text/numbers.txt | head -1', '1024');
outputs('sort -u drops duplicates',
  'sort -u ~/labs/text/fruit.txt | wc -l', '7');
outputs('uniq -c counts adjacent repeats',
  'sort ~/labs/text/fruit.txt | uniq -c | sort -rn | head -1 | tr -s " "', ' 3 cherry');
outputs('head takes the first lines',
  'head -2 ~/labs/text/numbers.txt', '42\n7');
outputs('tail takes the last',
  'tail -2 ~/labs/text/numbers.txt', '1024\n12');
outputs('tail -n +N starts from a line',
  'tail -n +11 ~/labs/text/numbers.txt', '1024\n12');
outputs('wc -l counts lines',
  'wc -l < ~/labs/text/employees.csv', '13');
outputs('tr translates characters',
  'echo abc | tr a-z A-Z', 'ABC');
outputs('tr -d deletes them',
  'echo a1b2c3 | tr -d 0-9', 'abc');

section('sed');

outputs('substitute the first match on each line',
  'echo "one one one" | sed "s/one/two/"', 'two one one');
outputs('substitute every match with g',
  'echo "one one one" | sed "s/one/two/g"', 'two two two');
outputs('print one line range with -n',
  'sed -n "2,3p" ~/labs/text/numbers.txt', '7\n115');
outputs('delete matching lines',
  'sed "/^7$/d" ~/labs/text/numbers.txt | wc -l', '10');
outputs('address a substitution to one line',
  'printf "a\\na\\n" | sed "2s/a/b/"', 'a\nb');
outputs('sed -i changes the file in place',
  'cd /tmp && echo hello > s.txt && sed -i "s/hello/goodbye/" s.txt && cat s.txt',
  'goodbye');
outputs('a backreference keeps part of the match',
  'echo "John Smith" | sed -E "s/(\\w+) (\\w+)/\\2, \\1/"', 'Smith, John');

section('awk');

outputs('print a field',
  'echo "a b c" | awk "{print \\$2}"', 'b');
outputs('a field separator',
  'awk -F, "NR==2 {print \\$2}" ~/labs/text/employees.csv', 'Marisol Vance');
outputs('NF is the field count',
  'echo "a b c d" | awk "{print NF}"', '4');
outputs('NR is the record number',
  'awk "END {print NR}" ~/labs/text/employees.csv', '13');
outputs('a numeric condition',
  'awk -F, "NR>1 && $6>85000 {print $2}" ~/labs/text/employees.csv',
  'Rafael Ibarra\nSimone Adeyemi');
outputs('accumulate in END',
  'awk -F, "NR>1 {t+=$6} END {print t}" ~/labs/text/employees.csv', '825500');
outputs('count into an array',
  'awk -F, "NR>1 {c[$3]++} END {print c[\\"Support\\"]}" ~/labs/text/employees.csv', '4');
outputs('BEGIN runs before the input',
  'awk "BEGIN {print \\"start\\"}" /dev/null', 'start');
outputs('printf formats',
  'echo 3 | awk "{printf \\"%05.1f\\\\n\\", \\$1}"', '003.0');

section('find');

outputs('find by name',
  'find ~/labs/survey -name "anomaly.log"',
  '/home/student/labs/survey/site-03/day-03/anomaly.log');
outputs('find by type',
  'find ~/labs -maxdepth 1 -type d | wc -l', '6');
outputs('find by size',
  'find ~/labs/files -type f -size +35c | wc -l', '4');
outputs('find by permission',
  'find ~/labs/perms -maxdepth 1 -perm 0600 | wc -l', '3');
outputs('find -exec runs per hit',
  'find ~/labs/text -name "numbers.txt" -exec wc -l {} \\;',
  '12 /home/student/labs/text/numbers.txt');
outputs('find -delete removes what it found',
  'cd /tmp && mkdir -p fd && touch fd/a.tmp fd/b.tmp fd/keep.txt && ' +
  'find fd -name "*.tmp" -delete && ls fd', 'keep.txt');

/* =========================================================================
 * 4. Accounts, software, services
 * ======================================================================= */

section('Users and groups');

outputs('id reports the primary and supplementary groups',
  'id -nG', 'student wheel techdocs');
outputs('an ordinary user cannot create an account',
  'useradd nope 2>&1 | grep -c "Permission denied"', '1');
outputs('useradd adds the /etc/passwd line',
  'sudo useradd -c "Test User" tuser && getent passwd tuser | cut -d: -f1,5',
  'tuser:Test User');
outputs('useradd creates a private group of the same name',
  'sudo useradd pguser && id -nG pguser', 'pguser');
outputs('useradd creates the home directory 700',
  "sudo useradd huser && stat -c '%a %U' /home/huser", '700 huser');
outputs('usermod -aG appends',
  'sudo useradd auser && sudo usermod -aG operators,techdocs auser && id -nG auser',
  'auser operators techdocs');
outputs('usermod -G without -a replaces the list',
  'sudo useradd ruser && sudo usermod -aG operators,techdocs ruser && ' +
  'sudo usermod -G operators ruser && id -nG ruser', 'ruser operators');
outputs('userdel -r takes the home directory too',
  'sudo useradd duser && sudo userdel -r duser && ls -d /home/duser 2>&1 | grep -c "No such"',
  '1');
outputs('a group cannot be deleted while it is someone\u2019s primary group',
  'sudo groupdel student 2>&1 | grep -c "primary group"', '1');
outputs('a locked account shows as locked',
  'sudo passwd -S operator3 | cut -d" " -f2', 'LK');
outputs('passwd -l locks one',
  'sudo passwd -l operator1 > /dev/null && sudo passwd -S operator1 | cut -d" " -f2', 'LK');
outputs('chage -M changes the maximum age',
  'sudo chage -M 30 operator1 && sudo chage -l operator1 | grep Maximum | ' +
  'awk "{print \\$NF}"', '30');
outputs('/etc/shadow is not readable by an ordinary user',
  'cat /etc/shadow 2>&1 | grep -c "Permission denied"', '1');
outputs('su - switches user and directory',
  'su - operator1 && pwd', '/home/operator1');
outputs('sudo runs one command as root',
  'sudo whoami', 'root');

section('Software');

outputs('rpm -q finds an installed package',
  'rpm -q vim-enhanced | cut -d- -f1,2', 'vim-enhanced');
outputs('rpm -q reports one that is not installed',
  'rpm -q httpd', 'package httpd is not installed');
outputs('rpm -qf names the owning package',
  'rpm -qf /usr/bin/awk | cut -d- -f1', 'gawk');
outputs('dnf install puts the command on the PATH',
  'sudo dnf install -y tree > /dev/null && which tree', '/usr/bin/tree');
outputs('and dnf remove takes it away again',
  'sudo dnf install -y tree > /dev/null && sudo dnf remove -y tree > /dev/null && ' +
  'tree 2>&1', 'bash: tree: command not found');
outputs('a package in a disabled repository cannot be installed',
  'sudo dnf install -y xsane 2>&1 | grep -c "Unable to find a match"', '1');
outputs('enabling the repository makes it installable',
  'sudo dnf config-manager --set-enabled lab-extras && ' +
  'sudo dnf install -y xsane > /dev/null && rpm -q xsane | cut -d- -f1', 'xsane');
outputs('an ordinary user cannot install',
  'dnf install -y tree 2>&1 | grep -c "superuser privileges"', '1');
outputs('flatpak lists what is installed',
  'flatpak list | grep -c Calculator', '1');

section('Processes and services');

outputs('a background job gets a job number',
  'sleep 100 & jobs | grep -c Running', '[1] 3000\n1');
outputs('kill %1 ends it',
  'sleep 100 & kill %1 2>/dev/null; jobs', '[1] 3000');
outputs('pgrep finds a running daemon',
  'pgrep -c sshd', '3');
outputs('is-active and is-enabled are different questions',
  'systemctl is-active atd; systemctl is-enabled atd', 'inactive\ndisabled');
outputs('starting a service does not enable it',
  'sudo systemctl start atd && systemctl is-active atd; systemctl is-enabled atd',
  'active\ndisabled');
outputs('enable --now does both',
  'sudo systemctl enable --now atd 2>/dev/null; systemctl is-active atd; ' +
  'systemctl is-enabled atd', 'active\nenabled');
outputs('an ordinary user cannot start a service',
  'systemctl start atd 2>&1 | grep -c "Access denied"', '1');

section('Storage and networking');

outputs('lsblk shows the removable disk',
  'lsblk | grep -c sdb1', '1');
outputs('the removable volume is not mounted to begin with',
  'df -h | grep -c sdb1', '0');
outputs('mounting it makes its files reachable',
  'sudo mkdir -p /mnt/field && sudo mount /dev/sdb1 /mnt/field && ls /mnt/field',
  'notes.txt\nphotos\nreadings.csv');
outputs('and unmounting takes them away',
  'sudo mkdir -p /mnt/field && sudo mount /dev/sdb1 /mnt/field && ' +
  'sudo umount /mnt/field && ls /mnt/field', '');
outputs('ip addr shows the address',
  'ip addr show ens3 | grep -c "172.25.250.10/24"', '1');
outputs('a host in /etc/hosts resolves',
  'getent hosts serverb | cut -d" " -f1', '172.25.250.11');
outputs('ssh-keygen writes a private key mode 600',
  "ssh-keygen -t ed25519 -f ~/.ssh/id_test -N '' > /dev/null && " +
  "stat -c '%a' ~/.ssh/id_test", '600');

/* =========================================================================
 * 5. Isolation -- the property the grader depends on
 * ======================================================================= */

section('Isolation');

(function () {
  const box = HarborBox.fromImage(IMAGE);
  const a = HarborShell.create(box.fork(), { interactive: false });
  const b = HarborShell.create(box.fork(), { interactive: false });
  a.run('rm -rf ~/labs');
  ok('one machine\u2019s rm -rf cannot reach another',
    run(b, 'ls ~/labs | wc -l') === '6', run(b, 'ls ~/labs'));

  const shared = HarborShell.create(box, { interactive: false });
  ok('nor the machine they were forked from',
    run(shared, 'ls ~/labs | wc -l') === '6', run(shared, 'ls ~/labs'));

  a.run('sudo useradd ghost');
  ok('an account created on one machine is absent on another',
    run(b, 'getent passwd ghost') === '', run(b, 'getent passwd ghost'));
})();

(function () {
  const box = HarborBox.fromImage(IMAGE);
  const sh = HarborShell.create(box, { interactive: false });
  sh.run('rm -rf ~/labs && sudo userdel -r operator1');
  box.reset();
  const after = HarborShell.create(box, { interactive: false });
  ok('reset restores the shipped image',
    run(after, 'ls ~/labs | wc -l') === '6' &&
    run(after, 'getent passwd operator1 | cut -d: -f1') === 'operator1',
    run(after, 'ls ~/labs') + ' / ' + run(after, 'getent passwd operator1'));
})();

/* =========================================================================
 * 6. The shell and the image agree with each other
 * ======================================================================= */

section('The image matches the implementation');

(function () {
  const sh = shell();
  const names = Object.keys(HarborShell.commands);

  // A command is allowed to be absent only when an uninstalled package would
  // supply it -- that is what makes `dnf install tree` a real exercise.
  function installable(name) {
    return sh.m.packages.available.some(function (p) {
      return (p.files || []).some(function (f) { return f.replace(/^.*\//, '') === name; });
    });
  }

  const missing = names.filter(function (n) { return !sh.onPath(n) && !installable(n); });
  ok('every implemented command is on the PATH, or installable',
    missing.length === 0,
    'neither present nor available from a repository: ' + missing.join(', '));

  const pending = names.filter(function (n) { return !sh.onPath(n) && installable(n); });
  ok('the install targets really are absent to begin with', pending.length > 0,
    'nothing is left to install, so the dnf exercises have no effect to show');

  const unowned = names.map(function (n) { return sh.onPath(n); })
    .filter(Boolean)
    .filter(function (p) { return !sh.m.ownerOfFile(p); });
  ok('every command file is owned by an installed package',
    unowned.length === 0,
    'no package owns: ' + unowned.slice(0, 20).join(', ') +
    (unowned.length > 20 ? ' (+' + (unowned.length - 20) + ' more)' : ''));
})();

/* =========================================================================
 * 7. The highlighter
 * ======================================================================= */

section('Syntax highlighting');

(function () {
  const samples = [
    'ls -l /etc',
    "grep -rn 'needle' ~/labs | wc -l",
    'echo "$USER lives in $HOME"',
    'find . -name "*.txt" -exec rm {} \\;',
    'sudo dnf install -y httpd && systemctl enable --now httpd',
    '<script>alert(1)</script>',
    'echo "a < b && c > d"'
  ];
  samples.forEach(function (s) {
    const html = ShellHL.highlight(s);
    ok('nothing raw reaches innerHTML: ' + JSON.stringify(s),
      html.indexOf('<script') === -1 &&
      !/<(?!\/?span\b)/.test(html.replace(/&lt;/g, '\u0001')),
      html);
    const text = html.replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    ok('highlighting drops no characters: ' + JSON.stringify(s), text === s,
      JSON.stringify(text) + ' !== ' + JSON.stringify(s));
  });
})();

/* =========================================================================
 * 8. Every shipped question
 * ======================================================================= */

/* =========================================================================
 * 7b. Exit codes on a usage error, against the real machine
 *
 * These are checked rather than assumed because there is no rule: `ls` exits
 * 2 on an unrecognised option while `cp` and `chmod` exit 1, and a student
 * writing `if [ $? -eq 1 ]` around a command is trusting us to be right.
 *
 * The full diff lives in tools/check_errors.js -- this locks down the
 * commands the course actually teaches, so they cannot drift back.
 * ======================================================================= */

section('Usage-error exit codes (real RHEL 9 values)');

(function () {
  const probePath = path.join(ROOT, 'tools', 'harvest', 'out', 'errors.json');
  if (!fs.existsSync(probePath)) {
    ok('harvested error probes are present', false,
       'run tools/harvest.py -- without it these values cannot be checked');
    return;
  }
  const probes = JSON.parse(fs.readFileSync(probePath, 'utf8'));

  // The commands the course teaches, where a wrong exit code would be taught
  // as fact. Probed as root, because the harvest container ran as root.
  const CORE = ['ls', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'touch', 'cat',
                'chmod', 'chown', 'chgrp', 'grep', 'sort', 'cut', 'head',
                'tail', 'wc', 'ln', 'diff', 'useradd', 'groupadd', 'tr'];

  CORE.forEach(function (cmd) {
    const want = probes[cmd] && probes[cmd]['bad-option'];
    if (!want) return;
    const sh = HarborShell.create(HarborBox.fromImage(IMAGE),
                                  { interactive: false, user: 'root' });
    const got = sh.run(cmd + ' --zzz-not-an-option');
    ok(cmd + ' exits ' + want.status + ' on an unrecognised option',
      got.status === want.status,
      'real RHEL 9 exits ' + want.status + ', we exit ' + got.status);
  });

  // And the wording, for the handful where it is most load-bearing.
  [['cp', 'no-args'], ['chmod', 'no-args'], ['rm', 'no-args']].forEach(function (pair) {
    const want = probes[pair[0]] && probes[pair[0]][pair[1]];
    if (!want) return;
    const sh = HarborShell.create(HarborBox.fromImage(IMAGE),
                                  { interactive: false, user: 'root' });
    const got = sh.run(pair[0]);
    ok(pair[0] + ' with no arguments exits ' + want.status,
      got.status === want.status,
      'real exits ' + want.status + ', we exit ' + got.status);
  });
})();

/* =========================================================================
 * 7c. --help
 *
 * The study guide calls `command --help` the first thing to try. It used to
 * answer "unrecognized option '--help'" -- while the error printed directly
 * above it said "Try 'ls --help' for more information". These lock the fix.
 * ======================================================================= */

section('--help answers with the real text');

(function () {
  if (!HarborShell.usage) {
    ok('the usage table is loaded', false, 'assets/shusage.js did not load');
    return;
  }
  ['ls', 'chmod', 'cp', 'grep', 'useradd', 'dnf'].forEach(function (cmd) {
    const doc = HarborShell.usage[cmd];
    if (!doc || !doc.help) {
      ok(cmd + ' --help has harvested text', false,
         'no help text for ' + cmd + ' -- re-run tools/harvest.py --stage probes');
      return;
    }
    const sh = shell();
    const res = sh.run(cmd + ' --help');
    ok(cmd + ' --help prints real help, not an option error',
      res.stdout.length > 40 && res.stderr.indexOf('unrecognized') === -1,
      'got exit ' + res.status + ', stderr ' + JSON.stringify(res.stderr.slice(0, 80)));
  });

  // --help must win over the argument parser, which is what used to reject it.
  const sh = shell();
  ok('--help beats the option parser',
    sh.run('ls --help').status === 0 && sh.run('ls --zzz').status === 2,
    'ls --help should exit 0 and ls --zzz should exit 2');
})();

section('Shipped shell questions');

(function () {
  const dataDir = path.join(ROOT, 'data');
  const files = fs.readdirSync(dataDir)
    .filter(function (f) { return /^itn170-.*\.json$/.test(f) && f !== 'itn170-box.json'; })
    .sort();

  if (!files.length) {
    ok('there is at least one ITN 170 quiz to check', false,
      'run tools/build_itn170.py first');
    return;
  }

  let checked = 0;
  const box = HarborBox.fromImage(IMAGE);

  files.forEach(function (file) {
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    } catch (err) {
      ok(file + ' is valid JSON', false, err.message);
      return;
    }
    (doc.sections || []).forEach(function (sec) {
      (sec.questions || []).forEach(function (q, i) {
        if (q.type !== 'shell') return;
        checked++;
        const label = file + ' [' + (q.category || sec.name) + '] ' +
          String(q.question).slice(0, 58).replace(/\s+/g, ' ');

        const opts = {
          orderMatters: !!q.orderMatters,
          mustContain: q.mustContain || null,
          exact: !!q.exact,
          cwd: q.cwd || null,
          setup: q.setup || null,
          user: q.user || 'student'
        };

        // The places a question points at have to exist.
        const probe = HarborShell.create(box.fork(), { interactive: false, user: opts.user });
        if (q.cwd) probe.setCwd(q.cwd);
        [].concat(q.setup || []).forEach(function (l) { probe.run(l); });
        (q.places || []).forEach(function (p) {
          let exists = true;
          try { probe.resolve(probe.expandTilde(String(p))); } catch (e) { exists = false; }
          ok(label + ' \u2014 place exists: ' + p, exists);
        });

        // The solution must actually run.
        const solRun = HarborShell.create(box.fork(), { interactive: false, user: opts.user });
        if (q.cwd) solRun.setCwd(q.cwd);
        [].concat(q.setup || []).forEach(function (l) { solRun.run(l); });
        const solResult = solRun.run(q.solution);
        // A question about capturing or discarding an error is asking for a
        // command that fails; it says so with "exitsNonZero": true.
        if (q.exitsNonZero) {
          ok(label + ' \u2014 solution fails, as the question intends',
            solResult.status !== 0 && solResult.stderr.indexOf('command not found') === -1,
            'expected a non-zero exit status, got ' + solResult.status + '\n' +
            (solResult.display || '(no output)'));
        } else {
          ok(label + ' \u2014 solution runs without error',
            solResult.status === 0 && solResult.stderr.indexOf('command not found') === -1,
            'status ' + solResult.status + '\n' + (solResult.display || '(no output)'));
        }

        // The solution must grade itself as correct.
        const self = q.verify
          ? HarborShell.checkEffect(box, q.solution, q.solution, q.verify, opts)
          : HarborShell.check(box, q.solution, q.solution, opts);
        ok(label + ' \u2014 solution grades as correct', self.ok,
          self.message + '\nsolution: ' + q.solution +
          (q.verify ? '\nverify:   ' + q.verify : ''));

        // A question whose answer is empty output cannot discriminate.
        if (!q.verify) {
          ok(label + ' \u2014 the solution produces output to compare',
            String(self.expected || '').trim() !== '',
            'the reference command printed nothing, so every wrong answer that ' +
            'also prints nothing would score');
        }

        // And a deliberately wrong answer must be rejected.
        const wrong = q.verify ? 'echo doing-nothing' : 'echo definitely-not-the-answer';
        const bad = q.verify
          ? HarborShell.checkEffect(box, wrong, q.solution, q.verify, opts)
          : HarborShell.check(box, wrong, q.solution, opts);
        ok(label + ' \u2014 a wrong answer is rejected', !bad.ok,
          'a wrong answer scored as correct; the check cannot tell them apart');
      });
    });
  });

  console.log('\n  (' + checked + ' shell questions checked across ' +
    files.length + ' quiz files)');
})();

/* ======================================================================= */

console.log('\n' + '='.repeat(72));
if (failures.length) {
  console.log(failures.length + ' failed, ' + passed + ' passed');
  process.exit(1);
}
console.log('all ' + passed + ' checks passed');
