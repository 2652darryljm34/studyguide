/* ===========================================================================
 * Software management -- chapters 12 and 13.
 *
 *   rpm  dnf (yum)  flatpak  subscription-manager
 *
 * Installing really does drop the package's files onto the filesystem and
 * register its systemd unit, and removing really does take them away -- so
 * `dnf remove tree` is followed by `tree: command not found`, and
 * `rpm -qf /usr/bin/awk` names the package that actually owns that path.
 * =========================================================================== */
(function () {
  'use strict';

  const S = typeof HarborShell !== 'undefined' ? HarborShell : require('./shell.js');
  const register = S.register;
  const parseArgs = S.parseArgs;

  function nevra(p) {
    return p.name + '-' + p.version + '-' + p.release + '.' + p.arch;
  }
  function nvr(p) {
    return p.version + '-' + p.release;
  }

  function humanBytes(n) {
    if (!n) return '0  ';
    const units = [' ', 'k', 'M', 'G'];
    let v = n, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return (v < 10 ? v.toFixed(1) : String(Math.round(v))) + ' ' + units[i];
  }

  function requireRoot(ctx, verb) {
    if (ctx.sh.user.uid === 0) return false;
    ctx.errln('Error: This command has to be run with superuser privileges ' +
      '(under the root user on most systems).');
    ctx.status = 1;
    return true;
  }

  /* =========================================================================
   * rpm
   * ======================================================================= */

  register('rpm', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const args = ctx.args.slice();
    const fl = {};
    const operands = [];

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.slice(0, 2) === '--') {
        const name = a.slice(2);
        if (name === 'query') fl.q = true;
        else if (name === 'all') fl.a = true;
        else if (name === 'info') fl.i = true;
        else if (name === 'list') fl.l = true;
        else if (name === 'file') fl.f = true;
        else if (name === 'whatprovides') fl.whatprovides = args[++i];
        else if (name === 'package') fl.p = true;
        else if (name === 'requires') fl.R = true;
        else if (name === 'scripts') fl.scripts = true;
        else if (name === 'changelog') fl.changelog = true;
        else if (name === 'configfiles') fl.c = true;
        else if (name === 'docfiles') fl.d = true;
        else if (name === 'verify') fl.V = true;
        else if (name === 'erase') fl.e = true;
        else if (name === 'install') fl.install = true;
        else if (name === 'import') fl.import = true;
        else if (name === 'nodeps' || name === 'test' || name === 'force') fl[name] = true;
        else if (name === 'queryformat') fl.qf = args[++i];
        continue;
      }
      if (a.charAt(0) === '-' && a.length > 1) {
        for (let k = 1; k < a.length; k++) fl[a[k]] = true;
        continue;
      }
      operands.push(a);
    }

    if (fl.import) return 0;

    if (fl.i && !fl.q && !fl.U) {
      // -i without -q is an install.
      if (requireRoot(ctx)) return 1;
      ctx.errln('error: open of ' + (operands[0] || '') +
        ' failed: No such file or directory');
      return 1;
    }

    if (fl.e) {
      if (requireRoot(ctx)) return 1;
      const gone = m.removePackage(operands[0]);
      if (!gone.length) {
        ctx.errln('error: package ' + operands[0] + ' is not installed');
        return 1;
      }
      return 0;
    }

    if (!fl.q && !fl.V) {
      ctx.errln('rpm: no arguments given for query');
      return 1;
    }

    /* --- work out which packages the query names --- */
    let selected = [];
    if (fl.a) {
      selected = m.packages.installed.slice();
    } else if (fl.f) {
      operands.forEach(function (p) {
        const abs = sh.abs(p);
        const owner = m.ownerOfFile(abs);
        if (owner) selected.push(owner);
        else {
          ctx.errln('error: file ' + abs + ': No such file or directory');
          ctx.status = 1;
        }
      });
    } else if (fl.whatprovides) {
      const owner = m.ownerOfFile(fl.whatprovides) ||
        m.findInstalled(fl.whatprovides)[0];
      if (owner) selected.push(owner);
      else { ctx.errln('no package provides ' + fl.whatprovides); return 1; }
    } else if (fl.p) {
      ctx.errln('error: open of ' + (operands[0] || '') +
        ' failed: No such file or directory');
      return 1;
    } else {
      if (!operands.length) {
        ctx.errln('rpm: no arguments given for query');
        return 1;
      }
      operands.forEach(function (name) {
        const hits = m.findInstalled(name);
        if (hits.length) hits.forEach(function (h) { selected.push(h); });
        else {
          ctx.outln('package ' + name + ' is not installed');
          ctx.status = 1;
        }
      });
    }

    if (fl.V) {
      return 0;                                  // nothing has been tampered with
    }

    /* --- render --- */
    selected.forEach(function (p) {
      if (fl.i) {
        ctx.outln('Name        : ' + p.name);
        ctx.outln('Version     : ' + p.version);
        ctx.outln('Release     : ' + p.release);
        ctx.outln('Architecture: ' + p.arch);
        ctx.outln('Install Date: ' + (p.installDate || 'not installed'));
        ctx.outln('Group       : Unspecified');
        ctx.outln('Size        : ' + p.size);
        ctx.outln('License     : ' + p.license);
        ctx.outln('Signature   : ' + (p.signature || '(none)'));
        ctx.outln('Source RPM  : ' + (p.sourceRpm || nevra(p) + '.src.rpm'));
        ctx.outln('Build Date  : Wed 22 Jun 2025 10:02:11 AM EDT');
        ctx.outln('Build Host  : x86-vm-09.build.eng.bos.redhat.com');
        ctx.outln('Packager    : Red Hat, Inc. <http://bugzilla.redhat.com/bugzilla>');
        ctx.outln('Vendor      : ' + (p.vendor || 'Red Hat, Inc.'));
        ctx.outln('URL         : ' + p.url);
        ctx.outln('Summary     : ' + p.summary);
        ctx.outln('Description :');
        ctx.outln(p.description || p.summary);
        return;
      }
      if (fl.l) {
        if (!p.files || !p.files.length) ctx.outln('(contains no files)');
        else p.files.forEach(function (f) { ctx.outln(f); });
        return;
      }
      if (fl.c) {
        (p.files || []).filter(function (f) { return f.indexOf('/etc/') === 0; })
          .forEach(function (f) { ctx.outln(f); });
        return;
      }
      if (fl.d) {
        (p.files || []).filter(function (f) { return f.indexOf('/usr/share/') === 0; })
          .forEach(function (f) { ctx.outln(f); });
        return;
      }
      if (fl.R) {
        (p.requires || []).forEach(function (r) { ctx.outln(r); });
        return;
      }
      if (fl.scripts) {
        ctx.outln('postinstall scriptlet (using /bin/sh):');
        ctx.outln('/sbin/ldconfig');
        return;
      }
      if (fl.changelog) {
        ctx.outln('* Wed Jun 22 2025 Red Hat Packaging <packaging@redhat.com> - ' + nvr(p));
        ctx.outln('- Rebuilt for Red Hat Enterprise Linux 9');
        return;
      }
      if (fl.qf) {
        ctx.out(String(fl.qf)
          .replace(/%\{NAME\}/gi, p.name)
          .replace(/%\{VERSION\}/gi, p.version)
          .replace(/%\{RELEASE\}/gi, p.release)
          .replace(/%\{ARCH\}/gi, p.arch)
          .replace(/%\{SUMMARY\}/gi, p.summary)
          .replace(/\\n/g, '\n'));
        return;
      }
      ctx.outln(nevra(p));
    });
    return ctx.status;
  });

  /* =========================================================================
   * dnf
   * ======================================================================= */

  const DNF_HEADER = 'Updating Subscription Management repositories.\n' +
    'Last metadata expiration check: 0:12:44 ago on ' ;

  function dnfHeader(ctx) {
    ctx.outln('Updating Subscription Management repositories.');
    ctx.outln('Last metadata expiration check: 0:12:44 ago on ' +
      ctx.m.formatStamp(ctx.m.now) + '.');
  }

  function enabledRepos(m) {
    return m.packages.repos.filter(function (r) { return r.enabled; });
  }

  /** Only packages from an enabled repository can be seen or installed. */
  function visibleAvailable(m) {
    const ok = enabledRepos(m).map(function (r) { return r.id; });
    return m.packages.available.filter(function (p) { return ok.indexOf(p.repo) !== -1; });
  }

  function transactionTable(ctx, title, rows, totalSize) {
    ctx.outln('Dependencies resolved.');
    ctx.outln('='.repeat(79));
    ctx.outln(' Package'.padEnd(26) + 'Architecture'.padEnd(14) + 'Version'.padEnd(20) +
      'Repository'.padEnd(13) + 'Size');
    ctx.outln('='.repeat(79));
    ctx.outln(title + ':');
    rows.forEach(function (p) {
      ctx.outln(' ' + p.name.padEnd(25) + String(p.arch).padEnd(14) +
        nvr(p).padEnd(20) + String(p.repo).slice(0, 12).padEnd(13) + humanBytes(p.size));
    });
    ctx.outln('');
    ctx.outln('Transaction Summary');
    ctx.outln('='.repeat(79));
    ctx.outln(title === 'Installing' ? 'Install  ' + rows.length + ' Package' +
      (rows.length === 1 ? '' : 's') : 'Remove  ' + rows.length + ' Package' +
      (rows.length === 1 ? '' : 's'));
    ctx.outln('');
    ctx.outln('Total ' + (title === 'Installing' ? 'download ' : '') + 'size: ' +
      humanBytes(totalSize));
  }

  register('dnf yum dnf-3', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const args = ctx.args.slice();
    const opts = {};
    const rest = [];

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-y' || a === '--assumeyes') { opts.yes = true; continue; }
      if (a === '-q' || a === '--quiet') { opts.quiet = true; continue; }
      if (a === '--enablerepo') { opts.enable = args[++i]; continue; }
      if (a === '--disablerepo') { opts.disable = args[++i]; continue; }
      if (a.indexOf('--enablerepo=') === 0) { opts.enable = a.split('=')[1]; continue; }
      if (a.indexOf('--disablerepo=') === 0) { opts.disable = a.split('=')[1]; continue; }
      if (a.indexOf('--set-enabled') === 0) { opts.setEnabled = true; continue; }
      if (a.indexOf('--set-disabled') === 0) { opts.setDisabled = true; continue; }
      if (a === '--add-repo') { opts.addRepo = args[++i]; continue; }
      if (a === '--installed') { opts.installedOnly = true; continue; }
      if (a === '--available') { opts.availableOnly = true; continue; }
      rest.push(a);
    }

    if (ctx.name === 'yum') {
      ctx.errln('Yum is deprecated and will be removed in a future release. ' +
        'Please use dnf instead.');
    }

    const sub = rest.shift();
    if (!sub) {
      ctx.outln('usage: dnf [options] COMMAND');
      ctx.outln('');
      ctx.outln('List of Main Commands:');
      ['check-update', 'group', 'history', 'info', 'install', 'list', 'provides',
       'reinstall', 'remove', 'repolist', 'repoquery', 'search', 'update',
       'upgrade'].forEach(function (c) { ctx.outln('  ' + c); });
      return 1;
    }

    switch (sub) {

      case 'install': case 'reinstall': case 'localinstall': {
        if (requireRoot(ctx)) return 1;
        if (!rest.length) return ctx.fail('Need an item to match', 1);
        dnfHeader(ctx);
        const pool = visibleAvailable(m);
        const toInstall = [];
        let failed = false;

        rest.forEach(function (name) {
          if (m.findInstalled(name).length) {
            ctx.outln('Package ' + nevra(m.findInstalled(name)[0]) +
              ' is already installed.');
            return;
          }
          const hit = pool.find(function (p) { return p.name === name; });
          if (!hit) {
            const hidden = m.packages.available.find(function (p) { return p.name === name; });
            ctx.errln('No match for argument: ' + name);
            if (hidden) {
              ctx.errln('(A package by that name exists in the ' + hidden.repo +
                ' repository, which is not enabled.)');
            }
            failed = true;
            return;
          }
          toInstall.push(hit);
        });

        if (failed) {
          ctx.errln('Error: Unable to find a match: ' + rest.join(' '));
          return 1;
        }
        if (!toInstall.length) {
          ctx.outln('Nothing to do.');
          ctx.outln('Complete!');
          return 0;
        }

        // Dependencies come along, as they do on a real system.
        const deps = [];
        toInstall.forEach(function (p) {
          (p.requires || []).forEach(function (d) {
            if (m.findInstalled(d).length) return;
            if (deps.some(function (x) { return x.name === d; })) return;
            const known = m.packages.available.find(function (x) { return x.name === d; });
            deps.push(known || {
              name: d, version: '1.0', release: '1.el9', arch: p.arch,
              repo: p.repo, summary: d, size: 131072, files: [], requires: []
            });
          });
        });

        const all = toInstall.concat(deps);
        transactionTable(ctx, 'Installing', toInstall, all.reduce(function (s, p) {
          return s + (p.size || 0);
        }, 0));
        if (deps.length) {
          ctx.outln('Installing dependencies:');
          deps.forEach(function (d) { ctx.outln(' ' + d.name); });
        }
        ctx.outln('');
        ctx.outln('Downloading Packages:');
        ctx.outln('Running transaction check');
        ctx.outln('Transaction check succeeded.');
        ctx.outln('Running transaction test');
        ctx.outln('Transaction test succeeded.');
        ctx.outln('Running transaction');
        all.forEach(function (p, i) {
          ctx.outln('  Installing       : ' + nevra(p).padEnd(52) + (i + 1) + '/' + all.length);
          m.installPackage(p);
        });
        ctx.outln('');
        ctx.outln('Installed:');
        all.forEach(function (p) { ctx.outln('  ' + nevra(p)); });
        ctx.outln('');
        ctx.outln('Complete!');

        m.packages.history.unshift({
          id: m.packages.history.length + 1,
          command: 'install ' + rest.join(' '),
          date: m.formatStamp(m.now), action: 'Install', altered: all.length
        });
        return 0;
      }

      case 'remove': case 'erase': {
        if (requireRoot(ctx)) return 1;
        if (!rest.length) return ctx.fail('Need an item to match', 1);
        dnfHeader(ctx);
        const removing = [];
        rest.forEach(function (name) {
          const hits = m.findInstalled(name);
          if (!hits.length) {
            ctx.errln('No match for argument: ' + name);
            ctx.status = 1;
            return;
          }
          hits.forEach(function (h) { removing.push(h); });
        });
        if (!removing.length) {
          ctx.errln('No packages marked for removal.');
          return 1;
        }
        transactionTable(ctx, 'Removing', removing, removing.reduce(function (s, p) {
          return s + (p.size || 0);
        }, 0));
        ctx.outln('');
        ctx.outln('Running transaction');
        removing.forEach(function (p, i) {
          ctx.outln('  Erasing          : ' + nevra(p).padEnd(52) + (i + 1) + '/' + removing.length);
          m.removePackage(p.name);
        });
        ctx.outln('');
        ctx.outln('Removed:');
        removing.forEach(function (p) { ctx.outln('  ' + nevra(p)); });
        ctx.outln('');
        ctx.outln('Complete!');
        return 0;
      }

      case 'update': case 'upgrade': {
        if (requireRoot(ctx)) return 1;
        dnfHeader(ctx);
        ctx.outln('Dependencies resolved.');
        ctx.outln('Nothing to do.');
        ctx.outln('Complete!');
        return 0;
      }

      case 'check-update': {
        dnfHeader(ctx);
        ctx.outln('');
        return 0;
      }

      case 'search': {
        dnfHeader(ctx);
        const term = rest.join(' ').toLowerCase();
        const all = m.packages.installed.concat(visibleAvailable(m));
        const exact = [], partial = [];
        all.forEach(function (p) {
          if (p.name.toLowerCase().indexOf(term) !== -1) exact.push(p);
          else if (String(p.summary).toLowerCase().indexOf(term) !== -1) partial.push(p);
        });
        const seen = new Set();
        if (exact.length) {
          ctx.outln('='.repeat(24) + ' Name Exactly Matched: ' + term + ' ' + '='.repeat(24));
          exact.forEach(function (p) {
            if (seen.has(p.name)) return;
            seen.add(p.name);
            ctx.outln(p.name + '.' + p.arch + ' : ' + p.summary);
          });
        }
        if (partial.length) {
          ctx.outln('='.repeat(22) + ' Summary Matched: ' + term + ' ' + '='.repeat(22));
          partial.forEach(function (p) {
            if (seen.has(p.name)) return;
            seen.add(p.name);
            ctx.outln(p.name + '.' + p.arch + ' : ' + p.summary);
          });
        }
        if (!exact.length && !partial.length) {
          ctx.errln('No matches found.');
          return 1;
        }
        return 0;
      }

      case 'info': {
        dnfHeader(ctx);
        if (!rest.length) return ctx.fail('Need an item to match', 1);
        let found = false;
        rest.forEach(function (name) {
          const inst = m.findInstalled(name);
          const avail = visibleAvailable(m).filter(function (p) { return p.name === name; });
          if (inst.length) {
            found = true;
            ctx.outln('Installed Packages');
            inst.forEach(function (p) { printInfo(ctx, p, 'installed'); });
          }
          if (avail.length) {
            found = true;
            ctx.outln('Available Packages');
            avail.forEach(function (p) { printInfo(ctx, p, p.repo); });
          }
        });
        if (!found) {
          ctx.errln('Error: No matching Packages to list');
          return 1;
        }
        return 0;
      }

      case 'list': {
        dnfHeader(ctx);
        const what = opts.installedOnly ? 'installed'
          : opts.availableOnly ? 'available'
          : (rest[0] === 'installed' || rest[0] === 'available' || rest[0] === 'all')
            ? rest.shift() : 'all';
        const filter = rest.length ? rest : null;
        const matches = function (p) {
          if (!filter) return true;
          return filter.some(function (f) {
            const re = new RegExp('^' + f.replace(/[.+^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            return re.test(p.name);
          });
        };
        const inst = m.packages.installed.filter(matches);
        const avail = visibleAvailable(m).filter(matches);
        if ((what === 'installed' || what === 'all') && inst.length) {
          ctx.outln('Installed Packages');
          inst.forEach(function (p) {
            ctx.outln((p.name + '.' + p.arch).padEnd(38) + nvr(p).padEnd(22) + '@' + p.repo);
          });
        }
        if ((what === 'available' || what === 'all') && avail.length) {
          ctx.outln('Available Packages');
          avail.forEach(function (p) {
            ctx.outln((p.name + '.' + p.arch).padEnd(38) + nvr(p).padEnd(22) + p.repo);
          });
        }
        if (!inst.length && !avail.length) {
          ctx.errln('Error: No matching Packages to list');
          return 1;
        }
        return 0;
      }

      case 'provides': case 'whatprovides': {
        dnfHeader(ctx);
        const query = rest[0] || '';
        const abs = query.charAt(0) === '/' ? query : null;
        let any = false;
        m.packages.installed.concat(visibleAvailable(m)).forEach(function (p) {
          const owns = (p.files || []).some(function (f) {
            if (abs) return f === abs;
            if (query.indexOf('*') !== -1) {
              const re = new RegExp('^' + query.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*') + '$');
              return re.test(f);
            }
            return f.replace(/^.*\//, '') === query;
          });
          if (!owns) return;
          any = true;
          const installed = m.findInstalled(p.name).length > 0;
          ctx.outln(nevra(p) + ' : ' + p.summary);
          ctx.outln('Repo        : ' + (installed ? '@System' : p.repo));
          ctx.outln('Matched from:');
          ctx.outln('Filename    : ' + (p.files || []).find(function (f) {
            return abs ? f === abs : f.replace(/^.*\//, '') === query;
          }));
          ctx.outln('');
        });
        if (!any) {
          ctx.errln('Error: No Matches found');
          return 1;
        }
        return 0;
      }

      case 'repolist': {
        dnfHeader(ctx);
        const showAll = rest[0] === '--all' || rest[0] === 'all' || opts.all;
        const list = showAll ? m.packages.repos : enabledRepos(m);
        ctx.outln('repo id'.padEnd(40) + 'repo name' + (showAll ? '' : ''));
        list.forEach(function (r) {
          ctx.outln(r.id.padEnd(40) + r.name + (showAll ? '  ' + (r.enabled ? 'enabled' : 'disabled') : ''));
        });
        return 0;
      }

      case 'repoquery': {
        dnfHeader(ctx);
        const name = rest[rest.length - 1];
        const hits = m.packages.installed.concat(visibleAvailable(m))
          .filter(function (p) { return p.name === name; });
        if (rest.indexOf('-l') !== -1 || rest.indexOf('--list') !== -1) {
          hits.forEach(function (p) {
            (p.files || []).forEach(function (f) { ctx.outln(f); });
          });
          return 0;
        }
        hits.forEach(function (p) { ctx.outln(nevra(p)); });
        return hits.length ? 0 : 1;
      }

      case 'group': case 'groups': {
        dnfHeader(ctx);
        const action = rest.shift() || 'list';
        if (action === 'list') {
          ctx.outln('Available Environment Groups:');
          ctx.outln('   Server');
          ctx.outln('   Minimal Install');
          ctx.outln('Installed Groups:');
          m.packages.groups.filter(function (g) { return g.installed; })
            .forEach(function (g) { ctx.outln('   ' + g.name); });
          ctx.outln('Available Groups:');
          m.packages.groups.filter(function (g) { return !g.installed; })
            .forEach(function (g) { ctx.outln('   ' + g.name); });
          return 0;
        }
        if (action === 'info') {
          const wanted = rest.join(' ').replace(/^"|"$/g, '');
          const g = m.packages.groups.find(function (x) {
            return x.name.toLowerCase() === wanted.toLowerCase() || x.id === wanted;
          });
          if (!g) { ctx.errln('Error: No group named ' + wanted + ' exists.'); return 1; }
          ctx.outln('Group: ' + g.name);
          ctx.outln(' Group-Id: ' + g.id);
          ctx.outln(' Mandatory Packages:');
          g.packages.forEach(function (p) { ctx.outln('   ' + p); });
          return 0;
        }
        if (action === 'install') {
          if (requireRoot(ctx)) return 1;
          const wanted = rest.join(' ').replace(/^"|"$/g, '');
          const g = m.packages.groups.find(function (x) {
            return x.name.toLowerCase() === wanted.toLowerCase() || x.id === wanted;
          });
          if (!g) { ctx.errln('Error: No group named ' + wanted + ' exists.'); return 1; }
          g.installed = true;
          ctx.outln('Installing Groups:');
          ctx.outln(' ' + g.name);
          ctx.outln('');
          ctx.outln('Complete!');
          return 0;
        }
        ctx.errln('Error: no such command: ' + action);
        return 1;
      }

      case 'history': {
        ctx.outln('ID     | Command line             | Date and time    | Action(s)      | Altered');
        ctx.outln('-'.repeat(79));
        m.packages.history.forEach(function (h) {
          ctx.outln(String(h.id).padStart(6) + ' | ' + String(h.command).slice(0, 24).padEnd(24) +
            ' | ' + String(h.date).padEnd(16) + ' | ' + String(h.action).padEnd(14) + ' | ' +
            String(h.altered).padStart(7));
        });
        return 0;
      }

      case 'module': {
        const action = rest.shift() || 'list';
        dnfHeader(ctx);
        if (action === 'list') {
          ctx.outln('Red Hat Enterprise Linux 9 for x86_64 - AppStream (RPMs)');
          ctx.outln('Name'.padEnd(18) + 'Stream'.padEnd(14) + 'Profiles'.padEnd(38) + 'Summary');
          m.packages.modules.forEach(function (mod) {
            ctx.outln(mod.name.padEnd(18) +
              (mod.stream + (mod.default ? ' [d]' : '') + (mod.enabled ? '[e]' : '')).padEnd(14) +
              mod.profiles.join(', ').slice(0, 36).padEnd(38) + mod.summary);
          });
          ctx.outln('');
          ctx.outln('Hint: [d]efault, [e]nabled, [x]disabled, [i]nstalled');
          return 0;
        }
        if (action === 'enable' || action === 'disable') {
          if (requireRoot(ctx)) return 1;
          const spec = rest[0] || '';
          const mod = m.packages.modules.find(function (x) {
            return x.name === spec.split(':')[0];
          });
          if (!mod) { ctx.errln('Error: Unable to resolve argument ' + spec); return 1; }
          mod.enabled = action === 'enable';
          ctx.outln('Complete!');
          return 0;
        }
        ctx.errln('Error: no such command: ' + action);
        return 1;
      }

      case 'config-manager': {
        if (requireRoot(ctx)) return 1;
        const target = rest[0];
        if (opts.addRepo) {
          m.packages.repos.push({
            id: String(opts.addRepo).replace(/^.*\//, '') || 'custom',
            name: 'Created by dnf config-manager from ' + opts.addRepo,
            enabled: true, packages: 0, baseurl: opts.addRepo
          });
          ctx.outln('Adding repo from: ' + opts.addRepo);
          return 0;
        }
        const repo = m.packages.repos.find(function (r) { return r.id === target; });
        if (!repo) { ctx.errln('Error: No matching repo to modify: ' + target + '.'); return 1; }
        if (opts.setEnabled) repo.enabled = true;
        if (opts.setDisabled) repo.enabled = false;
        return 0;
      }

      case 'clean': {
        ctx.outln('0 files removed');
        return 0;
      }

      case 'makecache': {
        dnfHeader(ctx);
        ctx.outln('Metadata cache created.');
        return 0;
      }

      default:
        ctx.errln('No such command: ' + sub + '. Please use /usr/bin/dnf --help');
        return 1;
    }
  });

  function printInfo(ctx, p, repo) {
    ctx.outln('Name         : ' + p.name);
    ctx.outln('Version      : ' + p.version);
    ctx.outln('Release      : ' + p.release);
    ctx.outln('Architecture : ' + p.arch);
    ctx.outln('Size         : ' + humanBytes(p.size));
    ctx.outln('Source       : ' + p.name + '-' + p.version + '-' + p.release + '.src.rpm');
    ctx.outln('Repository   : ' + (repo === 'installed' ? '@System' : repo));
    ctx.outln('Summary      : ' + p.summary);
    ctx.outln('URL          : ' + p.url);
    ctx.outln('License      : ' + p.license);
    ctx.outln('Description  : ' + (p.description || p.summary));
    ctx.outln('');
  }

  /* =========================================================================
   * flatpak (chapter 13)
   * ======================================================================= */

  register('flatpak', function (ctx) {
    const m = ctx.m;
    const args = ctx.args.filter(function (a) {
      return a !== '-y' && a !== '--assumeyes' && a !== '--system' && a !== '--user';
    });
    const sub = args.shift();
    const fp = m.flatpak;

    function findApp(list, ref) {
      return list.find(function (a) {
        return a.id === ref || a.id.toLowerCase() === String(ref).toLowerCase() ||
          a.name.toLowerCase() === String(ref).toLowerCase();
      });
    }

    switch (sub) {
      case 'remotes': case 'remote-list':
        ctx.outln('Name'.padEnd(12) + 'Options');
        fp.remotes.forEach(function (r) {
          ctx.outln(r.name.padEnd(12) + (r.system ? 'system' : 'user'));
        });
        return 0;

      case 'remote-add': {
        if (ctx.sh.user.uid !== 0) {
          ctx.errln('error: Changing system configuration requires root privileges');
          return 1;
        }
        const flags = args.filter(function (a) { return a.charAt(0) === '-'; });
        const positional = args.filter(function (a) { return a.charAt(0) !== '-'; });
        const name = positional[0], url = positional[1];
        if (fp.remotes.some(function (r) { return r.name === name; })) {
          if (flags.indexOf('--if-not-exists') !== -1) return 0;
          ctx.errln('error: Remote ' + name + ' already exists');
          return 1;
        }
        fp.remotes.push({ name: name, title: name, url: url, system: true });
        return 0;
      }

      case 'remote-delete':
        fp.remotes = fp.remotes.filter(function (r) { return r.name !== args[0]; });
        return 0;

      case 'search': {
        const term = String(args[0] || '').toLowerCase();
        const hits = fp.available.concat(fp.installed).filter(function (a) {
          return a.name.toLowerCase().indexOf(term) !== -1 ||
            a.id.toLowerCase().indexOf(term) !== -1 ||
            String(a.summary).toLowerCase().indexOf(term) !== -1;
        });
        if (!hits.length) { ctx.outln('No matches found'); return 1; }
        ctx.outln('Name'.padEnd(20) + 'Description'.padEnd(42) + 'Application ID'.padEnd(30) +
          'Version'.padEnd(10) + 'Branch'.padEnd(8) + 'Remotes');
        hits.forEach(function (a) {
          ctx.outln(a.name.slice(0, 19).padEnd(20) + String(a.summary).slice(0, 41).padEnd(42) +
            a.id.padEnd(30) + a.version.padEnd(10) + a.branch.padEnd(8) + a.origin);
        });
        return 0;
      }

      case 'install': {
        if (ctx.sh.user.uid !== 0) {
          ctx.errln('error: Changing system configuration requires root privileges');
          return 1;
        }
        const positional = args.filter(function (a) { return a.charAt(0) !== '-'; });
        const ref = positional.length > 1 ? positional[1] : positional[0];
        const app = findApp(fp.available, ref);
        if (!app) {
          ctx.errln('error: No remote refs found similar to ‘' + ref + '’');
          return 1;
        }
        fp.available = fp.available.filter(function (a) { return a.id !== app.id; });
        fp.installed.push(app);
        ctx.outln('Installing ' + app.origin + ' ' + app.id + '/x86_64/' + app.branch);
        ctx.outln('Installation complete.');
        return 0;
      }

      case 'uninstall': case 'remove': {
        if (ctx.sh.user.uid !== 0) {
          ctx.errln('error: Changing system configuration requires root privileges');
          return 1;
        }
        const app = findApp(fp.installed, args[0]);
        if (!app) {
          ctx.errln('error: ' + args[0] + '/x86_64/stable not installed');
          return 1;
        }
        fp.installed = fp.installed.filter(function (a) { return a.id !== app.id; });
        fp.available.push(app);
        ctx.outln('Uninstalling ' + app.id + '/x86_64/' + app.branch);
        ctx.outln('Uninstall complete.');
        return 0;
      }

      case 'list': {
        if (!fp.installed.length) return 0;
        ctx.outln('Name'.padEnd(20) + 'Application ID'.padEnd(30) + 'Version'.padEnd(10) +
          'Branch'.padEnd(8) + 'Installation');
        fp.installed.forEach(function (a) {
          ctx.outln(a.name.slice(0, 19).padEnd(20) + a.id.padEnd(30) + a.version.padEnd(10) +
            a.branch.padEnd(8) + 'system');
        });
        return 0;
      }

      case 'info': {
        const app = findApp(fp.installed, args[0]) || findApp(fp.available, args[0]);
        if (!app) { ctx.errln('error: ' + args[0] + ' not found'); return 1; }
        ctx.outln('');
        ctx.outln(app.name + ' - ' + app.summary);
        ctx.outln('');
        ctx.outln('          ID: ' + app.id);
        ctx.outln('         Ref: app/' + app.id + '/x86_64/' + app.branch);
        ctx.outln('        Arch: x86_64');
        ctx.outln('      Branch: ' + app.branch);
        ctx.outln('     Version: ' + app.version);
        ctx.outln('    Origin: ' + app.origin);
        ctx.outln('Installed: ' + app.size);
        return 0;
      }

      case 'update':
        ctx.outln('Looking for updates...');
        ctx.outln('Nothing to do.');
        return 0;

      case 'run':
        ctx.errln('error: this practice terminal has no graphical session, so a ' +
          'Flatpak application cannot be launched here');
        return 1;

      default:
        ctx.outln('Usage:');
        ctx.outln('  flatpak [OPTION…] COMMAND');
        ctx.outln('');
        ctx.outln('Commands: install, list, info, remotes, remote-add, run, search,');
        ctx.outln('          uninstall, update');
        return sub === undefined ? 1 : 1;
    }
  });

  /* =========================================================================
   * subscription-manager (chapter 4)
   * ======================================================================= */

  register('subscription-manager', function (ctx) {
    const sub = ctx.args[0];
    if (ctx.sh.user.uid !== 0 && sub !== 'version') {
      ctx.errln('You must run this command as root.');
      return 1;
    }
    switch (sub) {
      case 'register':
        ctx.outln('Registering to: subscription.rhsm.redhat.com:443/subscription');
        ctx.outln('The system has been registered with ID: ' +
          '9f3b1a24-7c58-4a1d-9b0e-5c2f1d8a63e7');
        ctx.outln('The registered system name is: ' + ctx.m.hostname);
        return 0;
      case 'status':
        ctx.outln('+-------------------------------------------+');
        ctx.outln('   System Status Details');
        ctx.outln('+-------------------------------------------+');
        ctx.outln('Overall Status: Current');
        ctx.outln('');
        ctx.outln('System Purpose Status: Matched');
        return 0;
      case 'list':
        ctx.outln('+-------------------------------------------+');
        ctx.outln('    Installed Product Status');
        ctx.outln('+-------------------------------------------+');
        ctx.outln('Product Name:   Red Hat Enterprise Linux for x86_64');
        ctx.outln('Product ID:     479');
        ctx.outln('Version:        9.0');
        ctx.outln('Arch:           x86_64');
        ctx.outln('Status:         Subscribed');
        return 0;
      case 'repos': {
        const m = ctx.m;
        if (ctx.args.indexOf('--list') !== -1) {
          m.packages.repos.forEach(function (r) {
            ctx.outln('Repo ID:   ' + r.id);
            ctx.outln('Repo Name: ' + r.name);
            ctx.outln('Enabled:   ' + (r.enabled ? '1' : '0'));
            ctx.outln('');
          });
          return 0;
        }
        const enable = ctx.args.find(function (a) { return a.indexOf('--enable=') === 0; });
        if (enable) {
          const id = enable.split('=')[1];
          const repo = m.packages.repos.find(function (r) { return r.id === id; });
          if (!repo) { ctx.errln('Error: ' + id + ' is not a valid repository ID'); return 1; }
          repo.enabled = true;
          ctx.outln("Repository '" + id + "' is enabled for this system.");
          return 0;
        }
        return 0;
      }
      case 'unregister':
        ctx.outln('System has been unregistered.');
        return 0;
      case 'version':
        ctx.outln('server type: Red Hat Subscription Management');
        ctx.outln('subscription management server: 4.0.20-1');
        ctx.outln('subscription-manager: 1.29.26-3.el9');
        return 0;
      default:
        ctx.errln('Usage: subscription-manager MODULE-NAME [MODULE-OPTIONS]');
        return 1;
    }
  });

})();
