/* ===========================================================================
 * ShellView -- the bits of terminal presentation the quiz page and the
 * playground both need: rendering a transcript, and rendering the parts of the
 * machine a question points at.
 *
 * The counterpart to SqlView. Pure string building, no state.
 * =========================================================================== */
const ShellView = (function () {
  'use strict';

  const MAX_LINES = 400;

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (s) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
    });
  }

  /** One prompt-and-output block, the way it would appear on a real terminal. */
  function entry(prompt, command, output, opts) {
    opts = opts || {};
    let html = '<div class="term-entry">';
    if (prompt !== null) {
      html += '<div class="term-line"><span class="term-prompt">' + esc(prompt) + '</span>' +
        '<span class="term-cmd">' +
        (typeof ShellHL !== 'undefined' ? ShellHL.highlight(command) : esc(command)) +
        '</span></div>';
    }
    if (output !== undefined && output !== null && output !== '') {
      html += '<pre class="term-out' + (opts.error ? ' term-err' : '') + '">' +
        clamp(output) + '</pre>';
    }
    return html + '</div>';
  }

  /** A very long output would bury the prompt, so cut it the way a pager would. */
  function clamp(text) {
    const lines = String(text).replace(/\n$/, '').split('\n');
    if (lines.length <= MAX_LINES) return esc(lines.join('\n'));
    return esc(lines.slice(0, MAX_LINES).join('\n')) +
      '\n<span class="term-note">… ' + (lines.length - MAX_LINES) +
      ' more lines. Narrow it with head, tail or grep.</span>';
  }

  /* =========================================================================
   * The machine panel -- what the SQL side's schema browser is for
   * ======================================================================= */

  function modeOf(m, node) {
    return typeof HarborShell !== 'undefined' ? HarborShell.modeString(m, node) : '';
  }

  /**
   * Render a long listing of each named directory (or file), with the owner,
   * group and mode spelled out -- the detail chapters 7, 10 and 11 turn on.
   */
  function placesHtml(shell, paths) {
    const m = shell.m;
    const list = (paths && paths.length) ? paths : [shell.user.home];

    return list.map(function (p) {
      let found;
      try {
        found = shell.resolve(shell.expandTilde(String(p)));
      } catch (err) {
        return '<div class="schema-table"><div class="schema-table-name">' + esc(p) +
          '</div><ul class="schema-cols"><li class="term-note">' +
          esc(err.isFsError ? err.message : String(err.message)) + '</li></ul></div>';
      }

      const node = found.node;
      const abs = m.pathOf(node) || shell.abs(p);

      if (node.type !== 'dir') {
        return '<div class="schema-table">' +
          '<div class="schema-table-name">' + esc(abs) + '</div>' +
          '<ul class="schema-cols"><li>' + fileRow(m, node, abs.replace(/^.*\//, '')) +
          '</li></ul></div>';
      }

      if (!m.canRead(node, shell.user)) {
        return '<div class="schema-table">' +
          '<div class="schema-table-name">' + esc(abs) +
          ' <span class="schema-count">not readable by you</span></div></div>';
      }

      const names = Array.from(node.entries.keys()).sort();
      const rows = names.map(function (name) {
        return '<li>' + fileRow(m, node.entries.get(name), name) + '</li>';
      }).join('');

      return '<div class="schema-table">' +
        '<div class="schema-table-name">' + esc(abs) +
        ' <span class="schema-count">' + names.length +
        (names.length === 1 ? ' entry' : ' entries') + '</span></div>' +
        '<ul class="schema-cols">' + (rows || '<li class="term-note">empty</li>') + '</ul></div>';
    }).join('');
  }

  function fileRow(m, node, name) {
    const kind = node.type === 'dir' ? 'dir' : node.type === 'symlink' ? 'link' : 'file';
    const shown = kind === 'dir' ? name + '/' : name;
    return '<span class="mode-tag ' + kind + '">' + esc(modeOf(m, node)) + '</span>' +
      '<span class="fs-owner">' + esc(m.userName(node.uid)) + ':' +
      esc(m.groupName(node.gid)) + '</span> ' +
      '<span class="fs-name ' + kind + '">' + esc(shown) + '</span>' +
      (node.type === 'symlink'
        ? ' <span class="fk-ref">&rarr; ' + esc(node.target) + '</span>' : '') +
      (kind === 'file' ? ' <span class="col-type">' + m.sizeOf(node) + 'B</span>' : '');
  }

  /**
   * A short briefing on the machine: who you are, what you may do, and the few
   * facts a learner otherwise has to go hunting for.
   */
  function factsHtml(shell) {
    const m = shell.m;
    const groups = m.groupNamesFor(shell.user).join(', ');
    const rows = [
      ['Host', m.hostname],
      ['You are', shell.user.name + ' (uid ' + shell.user.uid + ')'],
      ['Your groups', groups],
      ['Superuser', m.canSudo(shell.user)
        ? 'sudo works; su - switches to root'
        : 'not permitted'],
      ['Passwords', 'student / student, root / ' + m.rootPassword],
      ['Release', 'Red Hat Enterprise Linux 9.0'],
      ['Practice files', '~/labs — files, text, perms, links, survey']
    ];
    return '<dl class="box-facts">' + rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
    }).join('') + '</dl>';
  }

  /** Users and groups, for the chapter 10 exercises. */
  function accountsHtml(shell) {
    const m = shell.m;
    const people = m.users.filter(function (u) { return u.uid === 0 || u.uid >= 1000; });
    const shared = m.groups.filter(function (g) { return g.gid >= 10000; });

    return '<div class="schema-table">' +
      '<div class="schema-table-name">Login accounts ' +
      '<span class="schema-count">' + people.length + '</span></div>' +
      '<ul class="schema-cols">' + people.map(function (u) {
        return '<li><span class="fs-name">' + esc(u.name) + '</span> ' +
          '<span class="col-type">uid ' + u.uid + '</span> ' +
          '<span class="fs-owner">' + esc(m.groupNamesFor(u).join(',')) + '</span>' +
          (u.locked ? ' <span class="key-tag fk">locked</span>' : '') + '</li>';
      }).join('') + '</ul></div>' +
      '<div class="schema-table">' +
      '<div class="schema-table-name">Shared groups</div>' +
      '<ul class="schema-cols">' + shared.map(function (g) {
        return '<li><span class="fs-name">' + esc(g.name) + '</span> ' +
          '<span class="col-type">gid ' + g.gid + '</span> ' +
          '<span class="fs-owner">' + esc(g.members.join(', ') || 'no members') +
          '</span></li>';
      }).join('') + '</ul></div>';
  }

  /** What is installed, and what is one `dnf install` away. */
  function softwareHtml(shell) {
    const m = shell.m;
    const avail = m.packages.available.slice(0, 14);
    return '<div class="schema-table">' +
      '<div class="schema-table-name">Installed ' +
      '<span class="schema-count">' + m.packages.installed.length + ' packages</span></div>' +
      '<ul class="schema-cols">' + m.packages.installed.slice(0, 12).map(function (p) {
        return '<li><span class="fs-name">' + esc(p.name) + '</span> ' +
          '<span class="col-type">' + esc(p.version) + '</span></li>';
      }).join('') + '<li class="term-note">…' +
      Math.max(0, m.packages.installed.length - 12) + ' more; try rpm -qa</li></ul></div>' +
      '<div class="schema-table">' +
      '<div class="schema-table-name">Available to install</div>' +
      '<ul class="schema-cols">' + avail.map(function (p) {
        const repo = m.packages.repos.find(function (r) { return r.id === p.repo; });
        return '<li><span class="fs-name">' + esc(p.name) + '</span> ' +
          '<span class="col-type">' + esc(p.version) + '</span>' +
          (repo && !repo.enabled
            ? ' <span class="key-tag fk">repo disabled</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
  }

  /** Units, for chapter 16. */
  function servicesHtml(shell) {
    const m = shell.m;
    return '<div class="schema-table">' +
      '<div class="schema-table-name">Services</div>' +
      '<ul class="schema-cols">' + m.services.map(function (s) {
        return '<li><span class="key-tag ' + (s.state === 'running' ? 'pk' : 'fk') + '">' +
          (s.state === 'running' ? 'active' : 'dead') + '</span>' +
          '<span class="fs-name">' + esc(s.name) + '</span> ' +
          '<span class="col-type">' + (s.enabled ? 'enabled' : 'disabled') + '</span></li>';
      }).join('') + '</ul></div>';
  }

  return {
    esc: esc,
    entry: entry,
    placesHtml: placesHtml,
    factsHtml: factsHtml,
    accountsHtml: accountsHtml,
    softwareHtml: softwareHtml,
    servicesHtml: servicesHtml
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ShellView;
