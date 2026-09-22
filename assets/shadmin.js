/* ===========================================================================
 * Identity, superuser access, accounts and permissions -- chapters 10 and 11.
 *
 *   whoami id groups who w users last logname
 *   su sudo
 *   useradd usermod userdel passwd chage groupadd groupmod groupdel gpasswd getent
 *   chmod chown chgrp
 *
 * Accounts live in the machine's user/group tables, and /etc/passwd, /etc/shadow
 * and /etc/group render from those tables on every read -- so `useradd` really
 * does add the line that `tail -1 /etc/passwd` then shows, and `usermod -aG`
 * really does change what `id` reports.
 * =========================================================================== */
(function () {
  'use strict';

  const S = typeof HarborShell !== 'undefined' ? HarborShell : require('./shell.js');
  const register = S.register;
  const parseArgs = S.parseArgs;

  /* =========================================================================
   * Who am I
   * ======================================================================= */

  register('whoami', function (ctx) {
    ctx.outln(ctx.sh.user.name);
    return 0;
  });

  register('logname', function (ctx) {
    ctx.outln(ctx.sh.userStack.length ? ctx.sh.userStack[0].user.name : ctx.sh.user.name);
    return 0;
  });

  register('id', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'u g G n r',
                                    long: { '--user': 'u', '--group': 'g', '--groups': 'G',
                                            '--name': 'n', '--real': 'r' } });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const name = parsed.operands[0];
    const user = name ? m.userByName(name) : ctx.sh.user;
    if (!user) return ctx.fail(name + ': no such user');

    const fl = parsed.flags;
    const gids = m.gidsFor(user);

    if (fl.u) { ctx.outln(fl.n ? user.name : String(user.uid)); return 0; }
    if (fl.g) { ctx.outln(fl.n ? m.groupName(user.gid) : String(user.gid)); return 0; }
    if (fl.G) {
      ctx.outln(gids.map(function (g) { return fl.n ? m.groupName(g) : String(g); }).join(' '));
      return 0;
    }

    ctx.outln('uid=' + user.uid + '(' + user.name + ') gid=' + user.gid + '(' +
      m.groupName(user.gid) + ') groups=' +
      gids.map(function (g) { return g + '(' + m.groupName(g) + ')'; }).join(','));
    return 0;
  });

  register('groups', function (ctx) {
    const m = ctx.m;
    const names = ctx.args.length ? ctx.args : [ctx.sh.user.name];
    names.forEach(function (n) {
      const user = m.userByName(n);
      if (!user) { ctx.errln('groups: ' + n + ': no such user'); ctx.status = 1; return; }
      const line = m.groupNamesFor(user).join(' ');
      ctx.outln(ctx.args.length > 1 || (ctx.args.length && n !== ctx.sh.user.name)
        ? n + ' : ' + line : line);
    });
    return ctx.status;
  });

  register('who', function (ctx) {
    const m = ctx.m;
    ctx.outln(ctx.sh.userStack.length ? ctx.sh.userStack[0].user.name : ctx.sh.user.name +
      '   pts/0        ' + m.formatStamp(m.bootTime).replace(/ \d{4} /, ' ') +
      ' (172.25.250.9)');
    return 0;
  });

  register('users', function (ctx) {
    ctx.outln(ctx.sh.userStack.length ? ctx.sh.userStack[0].user.name : ctx.sh.user.name);
    return 0;
  });

  register('w', function (ctx) {
    const m = ctx.m;
    ctx.outln(' ' + m.formatClock(m.now) + ':00 up  6:20,  1 user,  load average: 0.00, 0.01, 0.05');
    ctx.outln('USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT');
    ctx.outln((ctx.sh.user.name + '        ').slice(0, 9) +
      'pts/0    172.25.250.9     09:02    0.00s  0.05s  0.00s w');
    return 0;
  });

  register('last', function (ctx) {
    const m = ctx.m;
    ctx.outln('student  pts/0        172.25.250.9     Sun Sep 14 09:02   still logged in');
    ctx.outln('reboot   system boot  5.14.0-70.22.1.e Sun Sep 14 08:12   still running');
    ctx.outln('student  pts/0        172.25.250.9     Sat Sep 13 14:40 - 17:12  (02:32)');
    ctx.outln('');
    ctx.outln('wtmp begins Fri Jul 11 06:22:41 2025');
    return 0;
  });

  register('lastlog', function (ctx) {
    const m = ctx.m;
    ctx.outln('Username         Port     From             Latest');
    m.users.forEach(function (u) {
      if (u.uid !== 0 && u.uid < 1000) return;
      ctx.outln(u.name.padEnd(17) +
        (u.name === 'student' ? 'pts/0    172.25.250.9     Sun Sep 14 09:02:11 -0400 2025'
                              : '                           **Never logged in**'));
    });
    return 0;
  });

  /* =========================================================================
   * Superuser access
   * ======================================================================= */

  /** The password a user would actually have to type. */
  function passwordOf(m, user) {
    if (user.uid === 0) return m.rootPassword;
    return user.password;
  }

  register('su', function (ctx) {
    const sh = ctx.sh, m = ctx.m;
    const args = ctx.args.slice();
    let login = false;
    let command = null;

    while (args.length && args[0].charAt(0) === '-') {
      const a = args.shift();
      if (a === '-' || a === '-l' || a === '--login') { login = true; continue; }
      if (a === '-c') { command = args.shift(); continue; }
      if (a === '-m' || a === '-p') continue;
      if (a === '--') break;
    }

    const targetName = args.shift() || 'root';
    const target = m.userByName(targetName);
    if (!target) {
      ctx.errln('su: user ' + targetName + ' does not exist');
      return 1;
    }

    function become() {
      sh.userStack.push({ user: sh.user, cwd: sh.cwd, env: sh.env });
      sh.user = target;
      sh.env = Object.assign({}, sh.env, {
        USER: target.name, LOGNAME: target.name, HOME: target.home, SHELL: target.shell
      });
      if (login) {
        sh.cwd = target.home;
        sh.env.PWD = target.home;
        sh.env.PATH = target.uid === 0
          ? '/root/.local/bin:/root/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin'
          : '/home/' + target.name + '/.local/bin:/home/' + target.name +
            '/bin:/usr/local/bin:/usr/bin';
      }
      ctx.user = target;
      if (command) {
        const r = sh.run(command);
        ctx.out(r.stdout);
        if (r.stderr) ctx.errln(r.stderr.replace(/\n$/, ''));
        const prev = sh.userStack.pop();
        sh.user = prev.user;
        sh.cwd = prev.cwd;
        sh.env = prev.env;
        return r.status;
      }
      return 0;
    }

    // root never has to authenticate; anyone else does.
    if (sh.user.uid === 0) return become();

    if (!sh.interactive) {
      // Grading runs have no keyboard, so treat the documented password as typed.
      return become();
    }

    return sh.ask(ctx, 'Password: ', true, function (c, typed) {
      if (typed === passwordOf(m, target)) return become();
      c.errln('su: Authentication failure');
      return 1;
    });
  });

  register('sudo', function (ctx) {
    const sh = ctx.sh, m = ctx.m;
    const args = ctx.args.slice();
    let asUser = 'root';
    let loginShell = false;

    while (args.length && args[0].charAt(0) === '-') {
      const a = args.shift();
      if (a === '-u' || a === '--user') { asUser = args.shift(); continue; }
      if (a === '-i' || a === '-s') { loginShell = true; continue; }
      if (a === '-l') {
        ctx.outln('Matching Defaults entries for ' + sh.user.name + ' on servera:');
        ctx.outln('    !visiblepw, always_set_home, match_group_by_gid, env_reset');
        ctx.outln('');
        ctx.outln('User ' + sh.user.name + ' may run the following commands on servera:');
        ctx.outln('    (ALL) ALL');
        return 0;
      }
      if (a === '-k' || a === '-K') { sh.sudoAuthed = false; return 0; }
      if (a === '--') break;
    }

    if (!m.canSudo(sh.user)) {
      ctx.errln(sh.user.name + ' is not in the sudoers file. This incident will be reported.');
      return 1;
    }

    const target = m.userByName(asUser);
    if (!target) return ctx.fail('unknown user ' + asUser);

    function runIt() {
      if (!args.length) {
        if (loginShell) {
          sh.userStack.push({ user: sh.user, cwd: sh.cwd, env: sh.env });
          sh.user = target;
          sh.env = Object.assign({}, sh.env, {
            USER: target.name, LOGNAME: target.name, HOME: target.home
          });
          if (loginShell) { sh.cwd = target.home; sh.env.PWD = target.home; }
          ctx.user = target;
          return 0;
        }
        ctx.errln('usage: sudo [-u user] command');
        return 1;
      }
      const saved = sh.user;
      sh.user = target;
      let r;
      try {
        r = sh.run(args.map(quoteIfNeeded).join(' '));
      } finally {
        sh.user = saved;
      }
      ctx.out(r.stdout);
      if (r.stderr) ctx.err = true, ctx.errln(r.stderr.replace(/\n$/, ''));
      return r.status;
    }

    // Real sudo asks once per session, then remembers. Grading has no keyboard,
    // so it takes the credential as already given.
    if (sh.sudoAuthed || !sh.interactive || sh.user.uid === 0) return runIt();

    return sh.ask(ctx, '[sudo] password for ' + sh.user.name + ': ', true, function (c, typed) {
      if (typed !== passwordOf(m, sh.user)) {
        c.errln('Sorry, try again.');
        c.errln('sudo: 1 incorrect password attempt');
        return 1;
      }
      sh.sudoAuthed = true;
      return runIt();
    });
  });

  function quoteIfNeeded(a) {
    return /[\s'"$*?[\]|&;<>()]/.test(a) ? "'" + String(a).replace(/'/g, "'\\''") + "'" : a;
  }

  /* =========================================================================
   * Managing accounts
   * ======================================================================= */

  function needRoot(ctx, what) {
    if (ctx.sh.user.uid === 0) return false;
    ctx.errln(ctx.name + ': ' + (what || 'Permission denied.'));
    ctx.status = 1;
    return true;
  }

  register('useradd', function (ctx) {
    if (needRoot(ctx, 'Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.')) {
      return 1;
    }
    const parsed = parseArgs(ctx, {
      bool: 'm M r N D',
      value: 'u g G d s c e f k p',
      long: { '--uid': 'u', '--gid': 'g', '--groups': 'G', '--home-dir': 'd',
              '--shell': 's', '--comment': 'c', '--create-home': 'm',
              '--no-create-home': 'M', '--system': 'r', '--expiredate': 'e',
              '--inactive': 'f', '--no-user-group': 'N' }
    });
    if (!parsed) return ctx.status;
    const m = ctx.m, sh = ctx.sh;
    const name = parsed.operands[0];
    if (!name) return ctx.usage('usage: useradd [options] LOGIN');
    if (m.userByName(name)) return ctx.fail("user '" + name + "' already exists", 9);

    const fl = parsed.flags;
    const uid = fl.u !== undefined ? parseInt(fl.u, 10) : (fl.r ? nextSystemUid(m) : m.nextUid());
    if (m.userByUid(uid)) return ctx.fail('UID ' + uid + ' is not unique', 4);

    // Red Hat's default is a user private group of the same name.
    let gid;
    if (fl.g !== undefined) {
      const g = /^\d+$/.test(fl.g) ? m.groupByGid(parseInt(fl.g, 10)) : m.groupByName(fl.g);
      if (!g) return ctx.fail("group '" + fl.g + "' does not exist", 6);
      gid = g.gid;
    } else if (fl.N) {
      gid = 100;
    } else {
      gid = m.groupByName(name) ? m.groupByName(name).gid : (fl.u !== undefined ? uid : m.nextGid());
      if (!m.groupByName(name)) m.groups.push({ name: name, gid: gid, members: [] });
    }

    const home = fl.d !== undefined ? fl.d : '/home/' + name;
    const shell = fl.s !== undefined ? fl.s : '/bin/bash';

    const user = {
      name: name, uid: uid, gid: gid, gecos: fl.c === undefined ? '' : fl.c,
      home: home, shell: shell, password: '!!', locked: true,
      aging: { lastChange: Math.floor(m.now / 86400000), min: 0, max: 99999,
               warn: 7, inactive: fl.f === undefined ? '' : fl.f,
               expire: fl.e === undefined ? '' : fl.e }
    };
    m.users.push(user);

    if (fl.G !== undefined) {
      String(fl.G).split(',').forEach(function (gname) {
        const g = m.groupByName(gname.trim());
        if (!g) {
          ctx.errln("useradd: group '" + gname.trim() + "' does not exist");
          ctx.status = 6;
          return;
        }
        if (g.members.indexOf(name) === -1) g.members.push(name);
      });
    }

    // A home directory is created unless told otherwise, seeded from /etc/skel.
    if (!fl.M && shell !== '/sbin/nologin' || fl.m) {
      if (!fl.M) {
        const dir = m.forceDir(home, 0o700);
        dir.uid = uid;
        dir.gid = gid;
        dir.mode = 0o700;
        try {
          const skel = m.resolve('/etc/skel').node;
          skel.entries.forEach(function (child, cname) {
            const copy = m.copyNode(child, user, false);
            copy.uid = uid;
            copy.gid = gid;
            dir.entries.set(cname, copy);
          });
        } catch (e) { /* no skeleton, no problem */ }
      }
    }
    return 0;
  });

  function nextSystemUid(m) {
    let max = 200;
    m.users.forEach(function (u) { if (u.uid >= 201 && u.uid < 1000 && u.uid > max) max = u.uid; });
    return max + 1;
  }

  register('usermod', function (ctx) {
    if (needRoot(ctx, 'Permission denied.')) return 1;
    const parsed = parseArgs(ctx, {
      bool: 'a L U m',
      value: 'u g G d s c e f l',
      long: { '--append': 'a', '--groups': 'G', '--gid': 'g', '--uid': 'u',
              '--home': 'd', '--shell': 's', '--comment': 'c', '--lock': 'L',
              '--unlock': 'U', '--login': 'l', '--expiredate': 'e',
              '--inactive': 'f', '--move-home': 'm' }
    });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const name = parsed.operands[0];
    if (!name) return ctx.usage('usage: usermod [options] LOGIN');
    const user = m.userByName(name);
    if (!user) return ctx.fail("user '" + name + "' does not exist", 6);
    const fl = parsed.flags;

    if (fl.a && fl.G === undefined) {
      return ctx.fail('-a flag is only allowed with the -G flag', 3);
    }

    if (fl.c !== undefined) user.gecos = fl.c;
    if (fl.s !== undefined) user.shell = fl.s;
    if (fl.u !== undefined) user.uid = parseInt(fl.u, 10);
    if (fl.d !== undefined) user.home = fl.d;
    if (fl.e !== undefined) user.aging.expire = fl.e;
    if (fl.f !== undefined) user.aging.inactive = fl.f;
    if (fl.L) user.locked = true;
    if (fl.U) user.locked = false;

    if (fl.g !== undefined) {
      const g = /^\d+$/.test(fl.g) ? m.groupByGid(parseInt(fl.g, 10)) : m.groupByName(fl.g);
      if (!g) return ctx.fail("group '" + fl.g + "' does not exist", 6);
      user.gid = g.gid;
    }

    if (fl.G !== undefined) {
      const wanted = String(fl.G).split(',').map(function (s) { return s.trim(); })
        .filter(Boolean);
      for (let i = 0; i < wanted.length; i++) {
        if (!m.groupByName(wanted[i])) {
          return ctx.fail("group '" + wanted[i] + "' does not exist", 6);
        }
      }
      if (!fl.a) {
        // Without -a, the supplementary list is replaced -- the classic trap.
        m.groups.forEach(function (g) {
          if (g.gid === user.gid) return;
          g.members = g.members.filter(function (n) { return n !== name; });
        });
      }
      wanted.forEach(function (gname) {
        const g = m.groupByName(gname);
        if (g.members.indexOf(name) === -1) g.members.push(name);
      });
    }

    if (fl.l !== undefined) {
      const old = user.name;
      user.name = fl.l;
      m.groups.forEach(function (g) {
        g.members = g.members.map(function (n) { return n === old ? fl.l : n; });
      });
    }
    return 0;
  });

  register('userdel', function (ctx) {
    if (needRoot(ctx, 'Permission denied.')) return 1;
    const parsed = parseArgs(ctx, { bool: 'r f', long: { '--remove': 'r', '--force': 'f' } });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const name = parsed.operands[0];
    if (!name) return ctx.usage('usage: userdel [options] LOGIN');
    const user = m.userByName(name);
    if (!user) return ctx.fail("user '" + name + "' does not exist", 6);

    m.users = m.users.filter(function (u) { return u.name !== name; });
    m.groups.forEach(function (g) {
      g.members = g.members.filter(function (n) { return n !== name; });
    });
    // The user private group goes too, if nothing else is in it.
    const priv = m.groupByName(name);
    if (priv && priv.gid === user.gid && !priv.members.length) {
      m.groups = m.groups.filter(function (g) { return g.name !== name; });
    }
    if (parsed.flags.r) m.forceRemove(user.home);
    return 0;
  });

  register('groupadd', function (ctx) {
    if (needRoot(ctx, 'Permission denied.')) return 1;
    const parsed = parseArgs(ctx, { bool: 'r f', value: 'g',
                                    long: { '--gid': 'g', '--system': 'r', '--force': 'f' } });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const name = parsed.operands[0];
    if (!name) return ctx.usage('usage: groupadd [options] GROUP');
    if (m.groupByName(name)) {
      if (parsed.flags.f) return 0;
      return ctx.fail("group '" + name + "' already exists", 9);
    }
    const gid = parsed.flags.g !== undefined ? parseInt(parsed.flags.g, 10)
      : (parsed.flags.r ? nextSystemGid(m) : m.nextGid());
    if (m.groupByGid(gid) && !parsed.flags.f) {
      return ctx.fail('GID ' + gid + ' is not unique', 4);
    }
    m.groups.push({ name: name, gid: gid, members: [] });
    return 0;
  });

  function nextSystemGid(m) {
    let max = 200;
    m.groups.forEach(function (g) { if (g.gid >= 201 && g.gid < 1000 && g.gid > max) max = g.gid; });
    return max + 1;
  }

  register('groupmod', function (ctx) {
    if (needRoot(ctx, 'Permission denied.')) return 1;
    const parsed = parseArgs(ctx, { value: 'g n', long: { '--gid': 'g', '--new-name': 'n' } });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const name = parsed.operands[0];
    const group = m.groupByName(name);
    if (!group) return ctx.fail("group '" + name + "' does not exist", 6);
    if (parsed.flags.g !== undefined) group.gid = parseInt(parsed.flags.g, 10);
    if (parsed.flags.n !== undefined) group.name = parsed.flags.n;
    return 0;
  });

  register('groupdel', function (ctx) {
    if (needRoot(ctx, 'Permission denied.')) return 1;
    const m = ctx.m;
    const name = ctx.args[0];
    const group = m.groupByName(name);
    if (!group) return ctx.fail("group '" + name + "' does not exist", 6);
    const primaryFor = m.users.find(function (u) { return u.gid === group.gid; });
    if (primaryFor) {
      return ctx.fail('cannot remove the primary group of user \'' + primaryFor.name + "'", 8);
    }
    m.groups = m.groups.filter(function (g) { return g.name !== name; });
    return 0;
  });

  register('gpasswd', function (ctx) {
    if (needRoot(ctx, 'Permission denied.')) return 1;
    const parsed = parseArgs(ctx, { value: 'a d M A' });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const gname = parsed.operands[0];
    const group = m.groupByName(gname);
    if (!group) return ctx.fail('group ' + gname + ' does not exist');
    if (parsed.flags.a) {
      if (group.members.indexOf(parsed.flags.a) === -1) group.members.push(parsed.flags.a);
      ctx.outln('Adding user ' + parsed.flags.a + ' to group ' + gname);
    }
    if (parsed.flags.d) {
      group.members = group.members.filter(function (n) { return n !== parsed.flags.d; });
      ctx.outln('Removing user ' + parsed.flags.d + ' from group ' + gname);
    }
    if (parsed.flags.M !== undefined) {
      group.members = String(parsed.flags.M).split(',').map(function (s) { return s.trim(); });
    }
    return 0;
  });

  register('passwd', function (ctx) {
    const sh = ctx.sh, m = ctx.m;
    const parsed = parseArgs(ctx, { bool: 'l u d e S', value: 'n x w i',
                                    long: { '--lock': 'l', '--unlock': 'u', '--delete': 'd',
                                            '--expire': 'e', '--status': 'S' } });
    if (!parsed) return ctx.status;
    const fl = parsed.flags;
    const targetName = parsed.operands[0] || sh.user.name;
    const target = m.userByName(targetName);
    if (!target) return ctx.fail('user \'' + targetName + '\' does not exist');

    if (targetName !== sh.user.name && sh.user.uid !== 0) {
      ctx.errln('passwd: You may not view or modify password information for ' + targetName + '.');
      return 1;
    }

    if (fl.S) {
      const a = target.aging;
      ctx.outln(target.name + ' ' + (target.locked ? 'LK' : 'PS') + ' ' +
        daysToDate(m, a.lastChange) + ' ' + a.min + ' ' + a.max + ' ' + a.warn + ' ' +
        (a.inactive === '' ? '-1' : a.inactive) + ' (' +
        (target.locked ? 'Password locked.' : 'Password set, SHA512 crypt.') + ')');
      return 0;
    }

    if (fl.l || fl.u || fl.d || fl.e || fl.n !== undefined || fl.x !== undefined ||
        fl.w !== undefined || fl.i !== undefined) {
      if (sh.user.uid !== 0) {
        ctx.errln('passwd: Only root can do that.');
        return 1;
      }
      if (fl.l) { target.locked = true; ctx.outln('Locking password for user ' + target.name + '.'); }
      if (fl.u) { target.locked = false; ctx.outln('Unlocking password for user ' + target.name + '.'); }
      if (fl.d) { target.password = ''; target.locked = false; ctx.outln('Removing password for user ' + target.name + '.'); }
      if (fl.e) { target.aging.lastChange = 0; ctx.outln('Expiring password for user ' + target.name + '.'); }
      if (fl.n !== undefined) target.aging.min = parseInt(fl.n, 10);
      if (fl.x !== undefined) target.aging.max = parseInt(fl.x, 10);
      if (fl.w !== undefined) target.aging.warn = parseInt(fl.w, 10);
      if (fl.i !== undefined) target.aging.inactive = parseInt(fl.i, 10);
      ctx.outln('passwd: Success');
      return 0;
    }

    if (!sh.interactive) {
      target.password = 'redhat';
      target.locked = false;
      target.aging.lastChange = Math.floor(m.now / 86400000);
      ctx.outln('Changing password for user ' + target.name + '.');
      ctx.outln('passwd: all authentication tokens updated successfully.');
      return 0;
    }

    ctx.outln('Changing password for user ' + target.name + '.');
    return sh.ask(ctx, 'New password: ', true, function (c, first) {
      if (String(first).length < 8) {
        c.errln('BAD PASSWORD: The password is shorter than 8 characters');
      }
      return sh.ask(c, 'Retype new password: ', true, function (c2, second) {
        if (first !== second) {
          c2.errln('Sorry, passwords do not match.');
          c2.errln('passwd: Authentication token manipulation error');
          return 1;
        }
        target.password = first;
        target.locked = false;
        target.aging.lastChange = Math.floor(m.now / 86400000);
        c2.outln('passwd: all authentication tokens updated successfully.');
        return 0;
      });
    });
  });

  function daysToDate(m, days) {
    if (days === '' || days === undefined || days === null) return 'never';
    const dt = new Date(days * 86400000);
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return MON[dt.getUTCMonth()] + ' ' + String(dt.getUTCDate()).padStart(2, '0') + ', ' +
      dt.getUTCFullYear();
  }

  register('chage', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'l', value: 'd m M W I E',
                                    long: { '--list': 'l', '--lastday': 'd', '--mindays': 'm',
                                            '--maxdays': 'M', '--warndays': 'W',
                                            '--inactive': 'I', '--expiredate': 'E' } });
    if (!parsed) return ctx.status;
    const m = ctx.m, sh = ctx.sh;
    const name = parsed.operands[0];
    if (!name) return ctx.usage('usage: chage [options] LOGIN');
    const user = m.userByName(name);
    if (!user) return ctx.fail('user \'' + name + '\' does not exist');
    const a = user.aging;
    const fl = parsed.flags;

    if (fl.l) {
      if (name !== sh.user.name && sh.user.uid !== 0) {
        ctx.errln('chage: Permission denied.');
        return 1;
      }
      ctx.outln('Last password change\t\t\t\t\t: ' +
        (a.lastChange === 0 ? 'password must be changed' : daysToDate(m, a.lastChange)));
      ctx.outln('Password expires\t\t\t\t\t: ' +
        (a.max >= 99999 ? 'never' : daysToDate(m, +a.lastChange + +a.max)));
      ctx.outln('Password inactive\t\t\t\t\t: ' +
        (a.inactive === '' ? 'never' : daysToDate(m, +a.lastChange + +a.max + +a.inactive)));
      ctx.outln('Account expires\t\t\t\t\t\t: ' +
        (a.expire === '' ? 'never' : a.expire));
      ctx.outln('Minimum number of days between password change\t\t: ' + a.min);
      ctx.outln('Maximum number of days between password change\t\t: ' + a.max);
      ctx.outln('Number of days of warning before password expires\t: ' + a.warn);
      return 0;
    }

    if (needRoot(ctx, 'Permission denied.')) return 1;
    if (fl.d !== undefined) {
      a.lastChange = /^\d+$/.test(fl.d) ? parseInt(fl.d, 10)
        : Math.floor(Date.parse(fl.d + 'T00:00:00Z') / 86400000);
    }
    if (fl.m !== undefined) a.min = parseInt(fl.m, 10);
    if (fl.M !== undefined) a.max = parseInt(fl.M, 10);
    if (fl.W !== undefined) a.warn = parseInt(fl.W, 10);
    if (fl.I !== undefined) a.inactive = parseInt(fl.I, 10);
    if (fl.E !== undefined) a.expire = fl.E;
    return 0;
  });

  register('getent', function (ctx) {
    const m = ctx.m;
    const db = ctx.args[0];
    const key = ctx.args[1];

    function emitUser(u) {
      ctx.outln([u.name, 'x', u.uid, u.gid, u.gecos, u.home, u.shell].join(':'));
    }
    function emitGroup(g) {
      ctx.outln([g.name, 'x', g.gid, g.members.join(',')].join(':'));
    }

    if (db === 'passwd') {
      if (!key) { m.users.forEach(emitUser); return 0; }
      const u = /^\d+$/.test(key) ? m.userByUid(parseInt(key, 10)) : m.userByName(key);
      if (!u) return 2;
      emitUser(u);
      return 0;
    }
    if (db === 'group') {
      if (!key) { m.groups.forEach(emitGroup); return 0; }
      const g = /^\d+$/.test(key) ? m.groupByGid(parseInt(key, 10)) : m.groupByName(key);
      if (!g) return 2;
      emitGroup(g);
      return 0;
    }
    if (db === 'shadow') {
      if (ctx.sh.user.uid !== 0) return 2;
      ctx.out(m.renderSynth('shadow'));
      return 0;
    }
    if (db === 'hosts') {
      const hits = m.network.hosts.filter(function (h) {
        return !key || h.ip === key || h.names.indexOf(key) !== -1;
      });
      hits.forEach(function (h) { ctx.outln(h.ip + '      ' + h.names.join(' ')); });
      return hits.length ? 0 : 2;
    }
    ctx.errln('Unknown database: ' + db);
    return 1;
  });

  register('newgrp', function (ctx) {
    ctx.errln('newgrp: cannot start a sub-shell in this practice terminal');
    return 1;
  });

  /* =========================================================================
   * Permissions and ownership (chapter 11)
   * ======================================================================= */

  /** Walk the targets a chmod/chown applies to, honouring -R. */
  function eachTarget(ctx, paths, recursive, fn) {
    const sh = ctx.sh, m = ctx.m;
    paths.forEach(function (p) {
      let found;
      try {
        found = sh.resolve(p, { follow: true });
      } catch (err) {
        ctx.errln(ctx.name + ": cannot access '" + p + "': " +
          (err.isFsError ? err.message : err.message));
        ctx.status = 1;
        return;
      }
      (function visit(node, label) {
        fn(node, label);
        if (recursive && node.type === 'dir') {
          Array.from(node.entries.keys()).sort().forEach(function (name) {
            visit(node.entries.get(name), label + '/' + name);
          });
        }
      })(found.node, p);
    });
  }

  register('chmod', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'R v c f',
                                    long: { '--recursive': 'R', '--verbose': 'v',
                                            '--changes': 'c', '--silent': 'f' } });
    if (!parsed) return ctx.status;
    const ops = parsed.operands;
    if (ops.length < 2) return ctx.usage('missing operand');
    const spec = ops[0];
    const sh = ctx.sh, m = ctx.m;

    // A mode has to be valid before anything is touched.
    if (!/^[0-7]{1,4}$/.test(spec) &&
        !/^[ugoa]*[-+=][rwxXst]*(,[ugoa]*[-+=][rwxXst]*)*$/.test(spec)) {
      return ctx.fail("invalid mode: '" + spec + "'");
    }

    eachTarget(ctx, ops.slice(1), !!parsed.flags.R, function (node, label) {
      if (sh.user.uid !== 0 && node.uid !== sh.user.uid) {
        ctx.errln("chmod: changing permissions of '" + label +
          "': Operation not permitted");
        ctx.status = 1;
        return;
      }
      const before = node.mode;
      const next = S.parseSymbolicMode(spec, node.mode, node.type === 'dir');
      if (next === null) {
        ctx.errln("chmod: invalid mode: '" + spec + "'");
        ctx.status = 1;
        return;
      }
      node.mode = next;
      node.ctime = m.now;
      if (parsed.flags.v || (parsed.flags.c && before !== next)) {
        ctx.outln("mode of '" + label + "' changed from " +
          (before & 0o7777).toString(8).padStart(4, '0') + ' (' +
          S.modeString(m, { type: node.type, mode: before }) .slice(1) + ') to ' +
          (next & 0o7777).toString(8).padStart(4, '0') + ' (' +
          S.modeString(m, node).slice(1) + ')');
      }
    });
    return ctx.status;
  });

  register('chown', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'R v c h',
                                    long: { '--recursive': 'R', '--verbose': 'v' } });
    if (!parsed) return ctx.status;
    const ops = parsed.operands;
    if (ops.length < 2) return ctx.usage('missing operand');
    const m = ctx.m, sh = ctx.sh;

    if (sh.user.uid !== 0) {
      ctx.errln("chown: changing ownership of '" + ops[1] + "': Operation not permitted");
      return 1;
    }

    const spec = ops[0];
    const parts = spec.split(':');
    const userPart = parts[0];
    const groupPart = parts.length > 1 ? parts[1] : null;

    let uid = null, gid = null;
    if (userPart) {
      const u = /^\d+$/.test(userPart) ? m.userByUid(parseInt(userPart, 10))
                                       : m.userByName(userPart);
      if (!u) return ctx.fail("invalid user: '" + spec + "'");
      uid = u.uid;
      // `chown user:` means "and that user's login group".
      if (groupPart === '') gid = u.gid;
    }
    if (groupPart) {
      const g = /^\d+$/.test(groupPart) ? m.groupByGid(parseInt(groupPart, 10))
                                        : m.groupByName(groupPart);
      if (!g) return ctx.fail("invalid group: '" + spec + "'");
      gid = g.gid;
    }

    eachTarget(ctx, ops.slice(1), !!parsed.flags.R, function (node, label) {
      if (uid !== null) node.uid = uid;
      if (gid !== null) node.gid = gid;
      node.ctime = m.now;
      if (parsed.flags.v) {
        ctx.outln("changed ownership of '" + label + "' to " + spec);
      }
    });
    return ctx.status;
  });

  register('chgrp', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'R v', long: { '--recursive': 'R', '--verbose': 'v' } });
    if (!parsed) return ctx.status;
    const ops = parsed.operands;
    if (ops.length < 2) return ctx.usage('missing operand');
    const m = ctx.m, sh = ctx.sh;

    const g = /^\d+$/.test(ops[0]) ? m.groupByGid(parseInt(ops[0], 10)) : m.groupByName(ops[0]);
    if (!g) return ctx.fail("invalid group: '" + ops[0] + "'");

    eachTarget(ctx, ops.slice(1), !!parsed.flags.R, function (node, label) {
      // You may hand a file to a group you belong to, if you own the file.
      const mayChange = sh.user.uid === 0 ||
        (node.uid === sh.user.uid && m.gidsFor(sh.user).indexOf(g.gid) !== -1);
      if (!mayChange) {
        ctx.errln("chgrp: changing group of '" + label + "': Operation not permitted");
        ctx.status = 1;
        return;
      }
      node.gid = g.gid;
      node.ctime = m.now;
      if (parsed.flags.v) ctx.outln("changed group of '" + label + "' to " + ops[0]);
    });
    return ctx.status;
  });

})();
