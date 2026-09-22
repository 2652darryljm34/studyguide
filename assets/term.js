/* ===========================================================================
 * The terminal playground: a scratchpad on the practice RHEL 9 machine.
 *
 * Everything runs in the browser through assets/box.js and assets/shell.js, so
 * this works on GitHub Pages with no server and no account. The machine is
 * per-tab and in memory -- reloading, or hitting Reset, restores it.
 * =========================================================================== */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const imageFile = params.get('box') || 'data/itn170-box.json';

  const loadingEl = document.getElementById('loading');
  const appEl = document.getElementById('app');
  const scrollEl = document.getElementById('term-scroll');
  const inputEl = document.getElementById('term-input');
  const promptEl = document.getElementById('term-prompt');
  const statusEl = document.getElementById('status');
  const factsEl = document.getElementById('facts');
  const sideBodyEl = document.getElementById('side-body');
  const sideNoteEl = document.getElementById('side-note');
  const recipesEl = document.getElementById('recipes');

  let box = null;
  let sh = null;
  let history = [];
  let historyAt = 0;
  let draft = '';
  let awaiting = null;          // an interactive password prompt
  let heredoc = null;           // { end, lines, first }
  let sidePanel = 'files';

  /* Warm-ups, in the order the course introduces them. Each is a starting
   * point to edit, not an answer to copy. */
  const RECIPES = [
    ['Command line', [
      ['Who and where am I', 'whoami; hostname; pwd'],
      ['What kind of machine', 'cat /etc/os-release'],
      ['A command has a name, options and arguments', 'ls -l /etc/hosts'],
      ['Replay what you typed', 'history']
    ]],
    ['Getting help', [
      ['Read a manual page', 'man chmod'],
      ['The file, not the command', 'man 5 passwd'],
      ['One-line summary', 'whatis useradd'],
      ['Search by what it does', 'man -k permission']
    ]],
    ['Navigating', [
      ['Absolute and relative paths', 'cd /etc; pwd; cd ..; pwd'],
      ['Home, here, and up', 'cd ~; ls; ls .; ls ..'],
      ['Look without moving', 'ls -l /var/log'],
      ['Long listing, newest first', 'ls -lt ~/labs/files']
    ]],
    ['Managing files', [
      ['Make several at once', 'cd ~/labs/files; touch draft{1,2,3}.txt; ls draft*'],
      ['Brace expansion with a range', 'touch chapter{01..05}.md; ls chapter*'],
      ['Copy, then rename', 'cp notes.txt notes-backup.txt; mv notes-backup.txt old/'],
      ['Nested directories in one go', 'mkdir -p project/src/lib; ls -R project'],
      ['Wildcards: any, one, a set', 'ls *.php; ls report?.txt; ls report[13].txt'],
      ['A hard link and a soft link', 'cd ~/labs/links; ls -li'],
      ['Remove a directory and its contents', 'rm -r ~/labs/files/project']
    ]],
    ['Redirection and pipes', [
      ['Overwrite, then append', 'cd ~; echo one > list.txt; echo two >> list.txt; cat list.txt'],
      ['Send an error somewhere else', 'ls /nope 2> errors.txt; cat errors.txt'],
      ['Both streams to one file', 'ls /etc /nope &> both.txt; tail -3 both.txt'],
      ['Feed one command into the next', 'ls /etc | wc -l'],
      ['Save and show at the same time', 'ls /etc | tee etc-list.txt | head -3']
    ]],
    ['Searching text', [
      ['Lines that match', 'grep Engineering ~/labs/text/employees.csv'],
      ['Count instead of listing', 'grep -c Support ~/labs/text/employees.csv'],
      ['Lines that do not match', 'grep -v Operations ~/labs/text/employees.csv'],
      ['Search a whole tree', 'grep -r WARN ~/labs/survey'],
      ['Pick columns out', 'cut -d, -f2,3 ~/labs/text/employees.csv'],
      ['Sort by a numeric column', 'sort -t, -k6 -nr ~/labs/text/employees.csv | head -3'],
      ['Count the repeats', 'cut -d, -f3 ~/labs/text/employees.csv | sort | uniq -c'],
      ['Substitute with sed', 'sed "s/Operations/Ops/g" ~/labs/text/employees.csv | head -3'],
      ['Fields with awk', 'awk -F, \'$6 > 80000 {print $2, $6}\' ~/labs/text/employees.csv'],
      ['Which page was hit most', "awk '{print $7}' ~/labs/text/access.log | sort | uniq -c | sort -rn | head -5"]
    ]],
    ['Users and groups', [
      ['Who am I, really', 'id; groups'],
      ['The account database', 'tail -5 /etc/passwd'],
      ['Become root', 'su -'],
      ['Run one command as root', 'sudo tail -3 /var/log/secure'],
      ['Create an account', 'sudo useradd -c "Field Tech" fieldtech; id fieldtech'],
      ['Add a supplementary group', 'sudo usermod -aG operators fieldtech; id fieldtech'],
      ['Password aging', 'sudo chage -l operator2']
    ]],
    ['Permissions', [
      ['Read a long listing', 'ls -l ~/labs/perms'],
      ['Octal and symbolic do the same thing', 'cd ~/labs/perms; chmod 640 public.txt; ls -l public.txt'],
      ['Make a script runnable', 'chmod u+x noexec.sh; ./noexec.sh'],
      ['What the umask withholds', 'umask; umask -S; touch fresh.txt; ls -l fresh.txt'],
      ['Special bits', 'ls -ld shared dropbox'],
      ['A file you may not read', 'cat secret.txt; sudo cat secret.txt']
    ]],
    ['Software', [
      ['Is it installed?', 'rpm -q vim-enhanced'],
      ['Who owns this file?', 'rpm -qf /usr/bin/awk'],
      ['What is in the package?', 'rpm -ql which'],
      ['Search the repositories', 'dnf search archiving'],
      ['Install something', 'sudo dnf install -y tree; tree -L 1 ~/labs'],
      ['Take it away again', 'sudo dnf remove -y tree; tree'],
      ['Which repositories are on', 'dnf repolist'],
      ['Flatpak applications', 'flatpak list; flatpak search vlc']
    ]],
    ['Finding files and storage', [
      ['By name', 'find ~/labs -name "*.csv"'],
      ['By type and size', 'find ~/labs -type f -size +35c'],
      ['By owner and permission', 'find ~/labs/perms -perm 0600'],
      ['Run something on each hit', 'find ~/labs -name "*.log" -exec wc -l {} \\;'],
      ['The indexed search', 'sudo updatedb; locate employees.csv'],
      ['Disks and filesystems', 'lsblk -f; df -h'],
      ['Mount the removable volume', 'sudo mkdir -p /mnt/field; sudo mount /dev/sdb1 /mnt/field; ls /mnt/field'],
      ['Space used by a tree', 'du -sh ~/labs/*']
    ]],
    ['Processes and services', [
      ['A snapshot of everything', 'ps aux | head -8'],
      ['The same in UNIX syntax', 'ps -ef | head -8'],
      ['Start a background job', 'sleep 600 & jobs'],
      ['Signal it by job number', 'kill %1; jobs'],
      ['Find a process by name', 'pgrep -l sshd'],
      ['Is the service up, and will it come back?', 'systemctl is-active sshd; systemctl is-enabled sshd'],
      ['Full status', 'systemctl status chronyd'],
      ['Start and enable one', 'sudo systemctl enable --now atd; systemctl status atd'],
      ['Read the journal', 'journalctl -u sshd -n 5']
    ]],
    ['Networking and SSH', [
      ['Addresses on the interfaces', 'ip addr show ens3'],
      ['The routing table', 'ip route'],
      ['NetworkManager devices and profiles', 'nmcli dev status; nmcli con show'],
      ['One profile in detail', 'nmcli con show ens3'],
      ['Can I reach it?', 'ping -c 3 serverb'],
      ['Name resolution', 'getent hosts serverb; cat /etc/resolv.conf'],
      ['Listening sockets', 'ss -tlnp'],
      ['Make a key pair', 'ssh-keygen -t ed25519 -f ~/.ssh/id_lab -N ""; ls -l ~/.ssh']
    ]]
  ];

  /* ---------- transcript ---------- */

  function write(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    while (div.firstChild) scrollEl.appendChild(div.firstChild);
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function banner() {
    write('<pre class="term-out term-banner">' + ShellView.esc(
      'Red Hat Enterprise Linux 9.0 (Plow)\n' +
      'Kernel 5.14.0-70.22.1.el9_0.x86_64 on an x86_64\n\n' +
      'Last login: Sun Sep 14 09:02:11 2025 from 172.25.250.9\n' +
      'This is a practice machine. Type `help` for shell builtins, or pick a warm-up below.\n'
    ) + '</pre>');
  }

  function setPrompt() {
    promptEl.textContent = awaiting ? awaiting.prompt : sh.prompt();
    inputEl.type = awaiting && awaiting.hidden ? 'password' : 'text';
  }

  /* ---------- running ---------- */

  function submit() {
    const text = inputEl.value;
    inputEl.value = '';

    // A password prompt swallows the line instead of running it.
    if (awaiting) {
      write(ShellView.entry(awaiting.prompt, '', null));
      const res = sh.provide(text);
      awaiting = res.awaiting || null;
      if (res.display) write('<pre class="term-out">' + ShellView.esc(res.display) + '</pre>');
      afterCommand();
      return;
    }

    // A heredoc keeps collecting lines until its terminator.
    if (heredoc) {
      write(ShellView.entry('> ', text, null));
      if (text === heredoc.end) {
        const full = heredoc.first + '\n' + heredoc.lines.join('\n');
        heredoc = null;
        runHeredoc(full);
        return;
      }
      heredoc.lines.push(text);
      setPrompt();
      return;
    }

    if (text.trim() === '') {
      write(ShellView.entry(sh.prompt(), '', null));
      return;
    }

    history.push(text);
    historyAt = history.length;

    const pending = HarborShell.pendingHeredoc(text);
    if (pending) {
      write(ShellView.entry(sh.prompt(), text, null));
      heredoc = { end: pending, lines: [], first: text };
      promptEl.textContent = '> ';
      setStatus('Type the heredoc body, then ' + pending + ' on a line of its own.');
      return;
    }

    write(ShellView.entry(sh.prompt(), text, null));
    run(text);
  }

  function run(line) {
    let res;
    try {
      res = sh.run(line);
    } catch (err) {
      write('<pre class="term-out term-err">' + ShellView.esc(String(err && err.message || err)) +
        '</pre>');
      afterCommand();
      return;
    }

    if (res.continuation) {
      write('<pre class="term-out term-err">' + ShellView.esc(
        'bash: unexpected EOF while looking for matching `' + res.continuation + "'") + '</pre>');
      afterCommand();
      return;
    }

    if (res.exited) {
      write('<pre class="term-out term-note">logout — reload the page, or hit Reset, ' +
        'to log back in.</pre>');
    }

    if (res.display) {
      write('<pre class="term-out">' + ShellView.esc(res.display) + '</pre>');
    }

    awaiting = res.awaiting || null;
    afterCommand();
  }

  /** A heredoc arrives as one string; feed it through as a here-string. */
  function runHeredoc(full) {
    const lines = full.split('\n');
    const first = lines.shift();
    const body = lines.join('\n') + (lines.length ? '\n' : '');
    const stripped = first.replace(/<<-?\s*(['"]?)[A-Za-z_][A-Za-z0-9_]*\1/, '');

    // `cat > file` with a body is the one shape that matters here.
    const saved = sh._heredocBody;
    sh._heredocBody = body;
    const tokens = stripped.trim();
    const res = runWithStdin(tokens, body);
    sh._heredocBody = saved;
    if (res) write('<pre class="term-out">' + ShellView.esc(res) + '</pre>');
    afterCommand();
  }

  function runWithStdin(line, stdin) {
    // Feed the text through `echo`-free: run the command with the body piped in.
    const encoded = stdin.replace(/'/g, "'\\''");
    const res = sh.run("printf '%s' '" + encoded + "' | " + line);
    return res.display;
  }

  function afterCommand() {
    setPrompt();
    refreshSide();
    setStatus('');
    inputEl.focus();
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function setStatus(msg) { statusEl.textContent = msg || ''; }

  /* ---------- the side panel ---------- */

  function refreshSide() {
    if (!sh) return;
    if (sidePanel === 'files') {
      sideNoteEl.innerHTML = 'Showing <code>' + ShellView.esc(sh.cwd) +
        '</code>. It follows you as you <code>cd</code>.';
      sideBodyEl.innerHTML = ShellView.placesHtml(sh, [sh.cwd]);
    } else if (sidePanel === 'accounts') {
      sideNoteEl.innerHTML = 'From <code>/etc/passwd</code> and <code>/etc/group</code>, ' +
        'live — create an account and it appears here.';
      sideBodyEl.innerHTML = ShellView.accountsHtml(sh);
    } else if (sidePanel === 'software') {
      sideNoteEl.innerHTML = 'The RPM database and the enabled repositories.';
      sideBodyEl.innerHTML = ShellView.softwareHtml(sh);
    } else {
      sideNoteEl.innerHTML = '<strong>active</strong> is running now; ' +
        '<strong>enabled</strong> starts at boot.';
      sideBodyEl.innerHTML = ShellView.servicesHtml(sh);
    }
    factsEl.innerHTML = ShellView.factsHtml(sh);
  }

  /* ---------- completion ---------- */

  function complete() {
    const value = inputEl.value;
    const caret = inputEl.selectionStart;
    const before = value.slice(0, caret);
    const wordMatch = /(\S*)$/.exec(before);
    const word = wordMatch[1];
    const start = caret - word.length;
    const atCommand = /(^|[|;&]\s*)\S*$/.test(before) && word.indexOf('/') === -1;

    let options = [];
    if (atCommand) {
      options = Object.keys(HarborShell.commands)
        .concat(Object.keys(HarborShell.builtins))
        .filter(function (n) { return n.indexOf(word) === 0; });
    } else {
      const slash = word.lastIndexOf('/');
      const dirPart = slash === -1 ? '.' : (word.slice(0, slash) || '/');
      const namePart = word.slice(slash + 1);
      try {
        const found = sh.resolve(dirPart);
        if (found.node.type === 'dir') {
          options = Array.from(found.node.entries.keys())
            .filter(function (n) {
              return n.indexOf(namePart) === 0 &&
                (namePart.charAt(0) === '.' || n.charAt(0) !== '.');
            })
            .map(function (n) {
              const child = found.node.entries.get(n);
              return (slash === -1 ? '' : word.slice(0, slash + 1)) + n +
                (child.type === 'dir' ? '/' : '');
            });
        }
      } catch (err) { /* nothing to complete against */ }
    }

    options = Array.from(new Set(options)).sort();
    if (!options.length) return;

    if (options.length === 1) {
      const filled = options[0] + (atCommand ? ' ' : '');
      inputEl.value = value.slice(0, start) + filled + value.slice(caret);
      inputEl.selectionStart = inputEl.selectionEnd = start + filled.length;
      return;
    }

    // Fill in as far as every candidate agrees, then show the choices.
    let prefix = options[0];
    options.forEach(function (o) {
      while (o.indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
    });
    const insert = atCommand ? prefix : prefix;
    if (insert.length > word.length) {
      inputEl.value = value.slice(0, start) + insert + value.slice(caret);
      inputEl.selectionStart = inputEl.selectionEnd = start + insert.length;
    }
    write(ShellView.entry(sh.prompt(), value, null));
    write('<pre class="term-out term-note">' +
      ShellView.esc(options.slice(0, 60).join('   ')) +
      (options.length > 60 ? '\n… ' + (options.length - 60) + ' more' : '') + '</pre>');
  }

  /* ---------- warm-ups ---------- */

  function buildRecipes() {
    recipesEl.innerHTML = '';
    RECIPES.forEach(function (group) {
      const heading = document.createElement('div');
      heading.className = 'recipe-group';
      heading.textContent = group[0];
      recipesEl.appendChild(heading);

      const list = document.createElement('div');
      list.className = 'recipe-list';
      group[1].forEach(function (r) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'recipe';
        b.textContent = r[0];
        b.title = r[1];
        b.addEventListener('click', function () {
          inputEl.value = r[1];
          inputEl.focus();
          document.getElementById('term-shell').scrollIntoView({
            behavior: 'smooth', block: 'start'
          });
        });
        list.appendChild(b);
      });
      recipesEl.appendChild(list);
    });
  }

  /* ---------- start ---------- */

  HarborBox.create(imageFile).then(function (b) {
    box = b;
    sh = HarborShell.create(box, { interactive: true, user: 'student' });

    loadingEl.hidden = true;
    appEl.hidden = false;

    banner();
    setPrompt();
    refreshSide();
    buildRecipes();
    inputEl.focus();

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
      if (e.key === 'Tab') { e.preventDefault(); complete(); return; }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!history.length) return;
        if (historyAt === history.length) draft = inputEl.value;
        historyAt = Math.max(0, historyAt - 1);
        inputEl.value = history[historyAt];
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyAt >= history.length) return;
        historyAt += 1;
        inputEl.value = historyAt === history.length ? draft : history[historyAt];
        return;
      }
      if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); scrollEl.innerHTML = ''; return; }
      if (e.key === 'c' && e.ctrlKey && inputEl.selectionStart === inputEl.selectionEnd) {
        e.preventDefault();
        write(ShellView.entry(promptEl.textContent, inputEl.value + '^C', null));
        inputEl.value = '';
        heredoc = null;
        awaiting = null;
        sh.pending = null;
        setPrompt();
        return;
      }
    });

    document.getElementById('term-shell').addEventListener('click', function (e) {
      if (window.getSelection().toString() === '') inputEl.focus();
    });

    document.getElementById('reset').addEventListener('click', function () {
      box.reset();
      sh = HarborShell.create(box, { interactive: true, user: 'student' });
      history = [];
      historyAt = 0;
      awaiting = null;
      heredoc = null;
      scrollEl.innerHTML = '';
      banner();
      write('<pre class="term-out term-note">Machine reset to the shipped image.</pre>');
      setPrompt();
      refreshSide();
      inputEl.focus();
    });

    document.getElementById('clear').addEventListener('click', function () {
      scrollEl.innerHTML = '';
      inputEl.focus();
    });

    document.getElementById('side-tabs').addEventListener('click', function (e) {
      const btn = e.target.closest('.side-tab');
      if (!btn) return;
      sidePanel = btn.dataset.panel;
      Array.prototype.forEach.call(this.querySelectorAll('.side-tab'), function (b) {
        b.classList.toggle('is-on', b === btn);
      });
      refreshSide();
    });

  }).catch(function (err) {
    loadingEl.classList.add('load-error');
    loadingEl.textContent = "Couldn't start the machine. " + err.message;
  });
})();
