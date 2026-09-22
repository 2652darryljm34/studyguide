/* ===========================================================================
 * HarborBox -- the in-browser practice machine.
 *
 * Loads data/itn170-box.json (a RHEL 9 lab host: filesystem, accounts, RPM
 * database, systemd units, processes, network) and exposes it as a live object
 * that assets/shell.js drives. Nothing is downloaded from a CDN and nothing is
 * uploaded: unlike the SQL side, this engine cannot fail to arrive.
 *
 * The filesystem is modelled at the inode level -- modes, owner, group, link
 * counts -- because chapters 7, 10 and 11 all turn on those details. A hard
 * link really is a second name for one inode, and `ln` really does increment
 * nlink. Four files under /etc (passwd, shadow, group, gshadow) are *synthetic*:
 * their contents are rendered from the account database on every read, so
 * `useradd bob; tail -1 /etc/passwd` behaves the way the course says it does.
 *
 * Exposed as a global, matching the rest of assets/.
 * =========================================================================== */
const HarborBox = (function () {
  'use strict';

  const DEFAULT_IMAGE = 'data/itn170-box.json';
  const SYMLINK_HOPS = 40;

  let imagePromises = Object.create(null);

  /* ---------- loading ---------- */

  function imageJson(path) {
    if (!imagePromises[path]) {
      imagePromises[path] = fetch(path).then(function (res) {
        if (!res.ok) throw new Error('Could not read ' + path + ' (' + res.status + ')');
        return res.json();
      }).catch(function (err) {
        delete imagePromises[path];
        throw err;
      });
    }
    return imagePromises[path];
  }

  /* ---------- small helpers ---------- */

  function parseMode(str, fallback) {
    if (str === undefined || str === null) return fallback;
    return parseInt(String(str), 8);
  }

  /** A stable 32-bit hash -- used to give seeded files varied but repeatable dates. */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function parseStamp(str) {
    // "2025-09-15 14:32" in UTC, so every browser agrees on what `ls -l` prints.
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(str || ''));
    if (!m) return Date.UTC(2025, 8, 15, 14, 32);
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }

  /* =========================================================================
   * Inodes
   * ======================================================================= */

  /**
   * Freeze the repository catalogue, once, the first time a machine is built
   * from an image.
   *
   * Sharing it between forks is only safe while it stays read-only, and a
   * future `dnf` change that pushed to it would otherwise corrupt every other
   * fork silently. Frozen, that mistake throws in strict mode instead.
   */
  function freezeCatalogue(list) {
    if (!list || list.__frozen) return list;
    list.forEach(function (entry) { Object.freeze(entry); });
    Object.defineProperty(list, '__frozen', { value: true, enumerable: false });
    return Object.freeze(list);
  }

  function Machine(image) {
    this.image = image;
    this.hostname = image.hostname;
    this.shortHostname = image.shortHostname || String(image.hostname).split('.')[0];
    this.now = parseStamp(image.now);
    this.bootTime = parseStamp(image.bootTime);
    this.rootPassword = image.rootPassword || 'redhat';
    this.nextIno = 1;
    this.nextPid = 3000;

    this.users = image.users.map(function (u) {
      return {
        name: u.name, uid: u.uid, gid: u.gid, gecos: u.gecos || '',
        home: u.home, shell: u.shell,
        password: u.password, locked: !!u.locked,
        aging: Object.assign({}, u.aging)
      };
    });
    this.groups = image.groups.map(function (g) {
      return { name: g.name, gid: g.gid, members: (g.members || []).slice() };
    });
    this.sudoers = (image.sudoers || []).slice();

    this.packages = {
      repos: JSON.parse(JSON.stringify(image.packages.repos)),
      installed: JSON.parse(JSON.stringify(image.packages.installed)),
      // `available` is the repository catalogue: reference data, never written
      // to. `dnf install` copies an entry into `installed`; `dnf remove` drops
      // from `installed` and does not put anything back. So every fork shares
      // one frozen copy instead of deep-copying it.
      //
      // This matters more than it looks. Grading forks the machine two or three
      // times per question, and deep-copying a full 6,959-package catalogue
      // cost ~12ms a fork -- ten times the cost of the entire rest of the
      // machine put together. Sharing it makes a realistic catalogue free.
      available: freezeCatalogue(image.packages.available),
      groups: JSON.parse(JSON.stringify(image.packages.groups)),
      modules: JSON.parse(JSON.stringify(image.packages.modules)),
      history: JSON.parse(JSON.stringify(image.packages.history))
    };
    this.flatpak = JSON.parse(JSON.stringify(image.flatpak));
    this.services = JSON.parse(JSON.stringify(image.services));
    this.processes = JSON.parse(JSON.stringify(image.processes));
    this.network = JSON.parse(JSON.stringify(image.network));
    this.blockDevices = JSON.parse(JSON.stringify(image.blockDevices));
    this.mounts = JSON.parse(JSON.stringify(image.mounts));
    this.removable = JSON.parse(JSON.stringify(image.removable));
    this.journal = JSON.parse(JSON.stringify(image.journal));
    this.jobs = [];

    // A process for a package that is not installed would be a contradiction.
    const self = this;
    this.processes = this.processes.filter(function (p) {
      const m = /^\/usr\/sbin\/(\w+)/.exec(p.cmd);
      if (!m) return true;
      return self.services.some(function (s) { return s.name === m[1]; });
    });

    this.root = this.buildTree(image.fs, '', 0, 0);
    this.resolvePendingHardLinks();
  }

  /* ---------- building the tree from the image ---------- */

  Machine.prototype.newInode = function (props) {
    const node = Object.assign({
      ino: this.nextIno++,
      type: 'file',
      mode: 0o644,
      uid: 0,
      gid: 0,
      nlink: 1,
      content: '',
      target: null,
      entries: null,
      synth: null,
      mtime: this.now,
      atime: this.now,
      ctime: this.now
    }, props || {});
    return node;
  };

  Machine.prototype.uidOf = function (name) {
    const u = this.userByName(name);
    return u ? u.uid : 0;
  };

  Machine.prototype.gidOf = function (name) {
    const g = this.groupByName(name);
    if (g) return g.gid;
    const u = this.userByName(name);
    return u ? u.gid : 0;
  };

  /**
   * Turn one image node into an inode, recursively.
   *
   * Nodes that do not state an mtime get one derived from their path: spread
   * over the four months before the image date, stable across reloads, so
   * `ls -lt` and `find -mtime` have something real to sort and filter.
   */
  Machine.prototype.buildTree = function (spec, path, defUid, defGid) {
    const self = this;
    const uid = spec.user !== undefined ? this.uidOf(spec.user) : defUid;
    const gid = spec.group !== undefined ? this.gidOf(spec.group) : defGid;
    const when = spec.mtime ? parseStamp(spec.mtime)
      : this.now - (hash(path || '/') % 10368000) * 1000;   // up to 120 days back

    if (spec.type === 'symlink') {
      return this.newInode({ type: 'symlink', mode: 0o777, uid: uid, gid: gid,
                             target: spec.target, mtime: when, ctime: when });
    }

    if (spec.type === 'hardlink') {
      // The target may not be built yet; record it and fix up afterwards.
      const placeholder = this.newInode({ type: 'pending-link', target: spec.to });
      this._pendingLinks = this._pendingLinks || [];
      this._pendingLinks.push({ node: placeholder, path: path });
      return placeholder;
    }

    if (spec.type === 'synth') {
      return this.newInode({
        type: 'file', synth: spec.gen, mode: parseMode(spec.mode, 0o644),
        uid: uid, gid: gid, mtime: when, ctime: when
      });
    }

    if (spec.type === 'dir') {
      const node = this.newInode({
        type: 'dir', mode: parseMode(spec.mode, 0o755), uid: uid, gid: gid,
        entries: new Map(), nlink: 2, content: null, mtime: when, ctime: when
      });
      const names = Object.keys(spec.entries || {});
      names.forEach(function (name) {
        const childSpec = spec.entries[name];
        const childPath = path + '/' + name;
        // Home directories belong to their owner unless the image says otherwise.
        let cu = uid, cg = gid;
        if (path === '/home') {
          cu = self.uidOf(name);
          cg = self.gidOf(name);
        }
        const child = self.buildTree(childSpec, childPath, cu, cg);
        node.entries.set(name, child);
        if (child.type === 'dir') node.nlink += 1;
      });
      return node;
    }

    return this.newInode({
      type: 'file', mode: parseMode(spec.mode, 0o644), uid: uid, gid: gid,
      content: spec.text === undefined ? '' : spec.text, mtime: when, ctime: when
    });
  };

  /** Second pass: point every hard link at the inode it shares. */
  Machine.prototype.resolvePendingHardLinks = function () {
    const self = this;
    (this._pendingLinks || []).forEach(function (pending) {
      const target = self.lookupPath(pending.node.target);
      const parent = self.lookupPath(pending.path.replace(/\/[^/]*$/, '') || '/');
      const name = pending.path.replace(/^.*\//, '');
      if (target && parent && parent.entries) {
        parent.entries.set(name, target);
        target.nlink += 1;
      }
    });
    this._pendingLinks = [];
  };

  /** Raw lookup used during construction -- no permission checks, no symlinks. */
  Machine.prototype.lookupPath = function (path) {
    const parts = String(path).split('/').filter(Boolean);
    let node = this.root;
    for (let i = 0; i < parts.length; i++) {
      if (!node || node.type !== 'dir') return null;
      node = node.entries.get(parts[i]);
    }
    return node || null;
  };

  /* =========================================================================
   * Accounts
   * ======================================================================= */

  Machine.prototype.userByName = function (name) {
    return this.users.find(function (u) { return u.name === name; }) || null;
  };
  Machine.prototype.userByUid = function (uid) {
    return this.users.find(function (u) { return u.uid === uid; }) || null;
  };
  Machine.prototype.groupByName = function (name) {
    return this.groups.find(function (g) { return g.name === name; }) || null;
  };
  Machine.prototype.groupByGid = function (gid) {
    return this.groups.find(function (g) { return g.gid === gid; }) || null;
  };

  /** Every gid a user belongs to: the primary one first, then supplementary. */
  Machine.prototype.gidsFor = function (user) {
    if (!user) return [];
    const out = [user.gid];
    this.groups.forEach(function (g) {
      if (g.members.indexOf(user.name) !== -1 && out.indexOf(g.gid) === -1) out.push(g.gid);
    });
    return out;
  };

  Machine.prototype.groupNamesFor = function (user) {
    const self = this;
    return this.gidsFor(user).map(function (gid) {
      const g = self.groupByGid(gid);
      return g ? g.name : String(gid);
    });
  };

  /** The next free uid/gid in the regular range, the way useradd picks one. */
  Machine.prototype.nextUid = function () {
    let max = 999;
    this.users.forEach(function (u) { if (u.uid >= 1000 && u.uid < 60000 && u.uid > max) max = u.uid; });
    return max + 1;
  };
  Machine.prototype.nextGid = function () {
    let max = 999;
    this.groups.forEach(function (g) { if (g.gid >= 1000 && g.gid < 60000 && g.gid > max) max = g.gid; });
    return max + 1;
  };

  Machine.prototype.userName = function (uid) {
    const u = this.userByUid(uid);
    return u ? u.name : String(uid);
  };
  Machine.prototype.groupName = function (gid) {
    const g = this.groupByGid(gid);
    return g ? g.name : String(gid);
  };

  Machine.prototype.canSudo = function (user) {
    if (!user) return false;
    if (user.uid === 0) return true;
    if (this.sudoers.indexOf(user.name) !== -1) return true;
    return this.groupNamesFor(user).indexOf('wheel') !== -1;
  };

  /* =========================================================================
   * Synthetic files -- rendered from the account database on every read
   * ======================================================================= */

  Machine.prototype.renderSynth = function (which) {
    const self = this;
    if (which === 'passwd') {
      return this.users.map(function (u) {
        return [u.name, 'x', u.uid, u.gid, u.gecos, u.home, u.shell].join(':');
      }).join('\n') + '\n';
    }
    if (which === 'shadow') {
      return this.users.map(function (u) {
        const a = u.aging || {};
        const hashField = u.locked ? '!!' : (u.password === '!!' ? '!!' : '$6$' +
          ('00000000' + hash(u.name + ':' + u.password).toString(36)).slice(-8) +
          '$' + ('0000000000000000' + hash(u.password + u.name).toString(36)).slice(-16));
        return [u.name, hashField, a.lastChange, a.min, a.max, a.warn,
                a.inactive === undefined ? '' : a.inactive,
                a.expire === undefined ? '' : a.expire, ''].join(':');
      }).join('\n') + '\n';
    }
    if (which === 'group') {
      return this.groups.map(function (g) {
        return [g.name, 'x', g.gid, g.members.join(',')].join(':');
      }).join('\n') + '\n';
    }
    if (which === 'gshadow') {
      return this.groups.map(function (g) {
        return [g.name, '!', '', g.members.join(',')].join(':');
      }).join('\n') + '\n';
    }
    if (which === 'hosts') {
      return '# Loopback entries; do not change.\n' +
        this.network.hosts.map(function (h) {
          return h.ip + (h.ip.length < 8 ? '\t\t' : '\t') + h.names.join(' ');
        }).join('\n') + '\n';
    }
    if (which === 'resolv') {
      return '# Generated by NetworkManager\nsearch ' + this.network.search.join(' ') + '\n' +
        this.network.dns.map(function (s) { return 'nameserver ' + s; }).join('\n') + '\n';
    }
    if (which === 'mounts') {
      return this.mounts.map(function (m) {
        return m.source + ' ' + m.target + ' ' + m.fstype + ' rw,relatime 0 0';
      }).join('\n') + '\n';
    }
    return '';
  };

  /** The bytes a reader sees -- synthetic files render, ordinary files store. */
  Machine.prototype.read = function (node) {
    if (node.synth) return this.renderSynth(node.synth);
    return node.content;
  };

  Machine.prototype.sizeOf = function (node) {
    if (node.type === 'dir') return 4096;
    if (node.type === 'symlink') return node.target.length;
    return this.read(node).length;
  };

  /* =========================================================================
   * Permissions
   * ======================================================================= */

  /** Which of the three permission triples applies to `user` for `node`. */
  Machine.prototype.permBits = function (node, user) {
    if (!user) return node.mode & 0o7;
    if (user.uid === node.uid) return (node.mode >> 6) & 0o7;
    if (this.gidsFor(user).indexOf(node.gid) !== -1) return (node.mode >> 3) & 0o7;
    return node.mode & 0o7;
  };

  Machine.prototype.canRead = function (node, user) {
    if (user && user.uid === 0) return true;
    return (this.permBits(node, user) & 4) !== 0;
  };
  Machine.prototype.canWrite = function (node, user) {
    if (user && user.uid === 0) return true;
    return (this.permBits(node, user) & 2) !== 0;
  };
  Machine.prototype.canExec = function (node, user) {
    // root may execute anything carrying at least one execute bit, and may
    // always traverse a directory.
    if (user && user.uid === 0) return node.type === 'dir' || (node.mode & 0o111) !== 0;
    return (this.permBits(node, user) & 1) !== 0;
  };

  /**
   * The sticky bit on a world-writable directory (/tmp) means only the owner
   * of a file -- or of the directory -- may remove it.
   */
  Machine.prototype.canRemoveFrom = function (dir, node, user) {
    if (!this.canWrite(dir, user)) return false;
    if (!(dir.mode & 0o1000)) return true;
    if (!user || user.uid === 0) return true;
    return node.uid === user.uid || dir.uid === user.uid;
  };

  /* =========================================================================
   * Path resolution
   * ======================================================================= */

  function FsError(code, path, message) {
    this.code = code;
    this.path = path;
    this.message = message;
    this.isFsError = true;
  }

  Machine.prototype.err = function (code, path, message) {
    return new FsError(code, path, message);
  };

  function normalizeParts(parts) {
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p === '' || p === '.') continue;
      if (p === '..') { out.pop(); continue; }
      out.push(p);
    }
    return out;
  }

  /** Join a path against a working directory, resolving . and .. textually. */
  Machine.prototype.absolute = function (path, cwd) {
    const str = String(path === undefined || path === null ? '' : path);
    const base = str.charAt(0) === '/' ? [] : String(cwd || '/').split('/');
    return '/' + normalizeParts(base.concat(str.split('/'))).join('/');
  };

  /**
   * Walk a path to an inode.
   *
   * opts.follow  -- follow a trailing symlink (default true)
   * opts.user    -- whose permissions apply; omit for an unchecked walk
   *
   * Returns { node, parent, name, path } or throws an FsError, matching the
   * errors the real tools report: ENOENT, ENOTDIR, EACCES, ELOOP.
   */
  Machine.prototype.resolve = function (path, opts) {
    opts = opts || {};
    const follow = opts.follow !== false;
    const user = opts.user;
    const cwd = opts.cwd || '/';
    const shown = String(path);

    const abs = this.absolute(path, cwd);
    const parts = abs === '/' ? [] : abs.slice(1).split('/');

    let node = this.root;
    let parent = null;
    let name = '/';
    let hops = 0;

    for (let i = 0; i < parts.length; i++) {
      if (node.type === 'symlink') {
        if (++hops > SYMLINK_HOPS) throw this.err('ELOOP', shown, 'Too many levels of symbolic links');
        const via = this.resolveSymlink(node, parent, opts);
        if (!via) throw this.err('ENOENT', shown, 'No such file or directory');
        node = via;
      }
      if (node.type !== 'dir') throw this.err('ENOTDIR', shown, 'Not a directory');
      if (user && !this.canExec(node, user)) throw this.err('EACCES', shown, 'Permission denied');

      const child = node.entries.get(parts[i]);
      if (!child) {
        // The caller may be creating this name, so report the parent too.
        const e = this.err('ENOENT', shown, 'No such file or directory');
        e.parent = node;
        e.name = parts[i];
        e.missingLast = i === parts.length - 1;
        throw e;
      }
      parent = node;
      name = parts[i];
      node = child;
    }

    if (follow) {
      while (node.type === 'symlink') {
        if (++hops > SYMLINK_HOPS) throw this.err('ELOOP', shown, 'Too many levels of symbolic links');
        const via = this.resolveSymlink(node, parent, opts);
        if (!via) throw this.err('ENOENT', shown, 'No such file or directory');
        // Keep parent/name pointing at the link's own directory entry.
        node = via;
      }
    }

    return { node: node, parent: parent, name: name, path: abs };
  };

  Machine.prototype.resolveSymlink = function (link, parentDir, opts) {
    const base = this.pathOf(parentDir) || '/';
    try {
      return this.resolve(link.target, {
        cwd: base, user: opts && opts.user, follow: true
      }).node;
    } catch (e) {
      return null;
    }
  };

  /** Reverse lookup: the absolute path of an inode, by searching the tree. */
  Machine.prototype.pathOf = function (node) {
    if (!node) return null;
    if (node === this.root) return '/';
    let found = null;
    const walk = function (dir, prefix) {
      if (found || !dir.entries) return;
      dir.entries.forEach(function (child, name) {
        if (found) return;
        const p = prefix === '/' ? '/' + name : prefix + '/' + name;
        if (child === node) { found = p; return; }
        if (child.type === 'dir') walk(child, p);
      });
    };
    walk(this.root, '/');
    return found;
  };

  /** Resolve for the purpose of creating `name` inside a directory. */
  Machine.prototype.resolveParent = function (path, opts) {
    const abs = this.absolute(path, (opts && opts.cwd) || '/');
    if (abs === '/') throw this.err('EEXIST', path, 'File exists');
    const name = abs.replace(/^.*\//, '');
    const dirPath = abs.replace(/\/[^/]*$/, '') || '/';
    const found = this.resolve(dirPath, opts);
    if (found.node.type !== 'dir') throw this.err('ENOTDIR', path, 'Not a directory');
    return { dir: found.node, name: name, path: abs };
  };

  /* ---------- mutations ---------- */

  Machine.prototype.touchDir = function (dir) {
    dir.mtime = this.now;
    dir.ctime = this.now;
  };

  Machine.prototype.createFile = function (dir, name, user, mode, content) {
    const node = this.newInode({
      type: 'file', mode: mode, uid: user ? user.uid : 0, gid: user ? user.gid : 0,
      content: content === undefined ? '' : content
    });
    dir.entries.set(name, node);
    this.touchDir(dir);
    return node;
  };

  Machine.prototype.createDir = function (dir, name, user, mode) {
    const node = this.newInode({
      type: 'dir', mode: mode, uid: user ? user.uid : 0, gid: user ? user.gid : 0,
      entries: new Map(), nlink: 2, content: null
    });
    dir.entries.set(name, node);
    dir.nlink += 1;
    this.touchDir(dir);
    return node;
  };

  Machine.prototype.createSymlink = function (dir, name, user, target) {
    const node = this.newInode({
      type: 'symlink', mode: 0o777, uid: user ? user.uid : 0, gid: user ? user.gid : 0,
      target: target
    });
    dir.entries.set(name, node);
    this.touchDir(dir);
    return node;
  };

  Machine.prototype.unlink = function (dir, name) {
    const node = dir.entries.get(name);
    if (!node) return;
    dir.entries.delete(name);
    if (node.type === 'dir') dir.nlink -= 1;
    else node.nlink -= 1;
    this.touchDir(dir);
  };

  /** Recursively copy an inode (cp -r): a copy is a new inode, not a link. */
  Machine.prototype.copyNode = function (node, user, keepOwner) {
    const self = this;
    const copy = this.newInode({
      type: node.type,
      mode: node.mode,
      uid: keepOwner ? node.uid : (user ? user.uid : 0),
      gid: keepOwner ? node.gid : (user ? user.gid : 0),
      content: node.type === 'dir' ? null : this.read(node),
      target: node.target,
      entries: node.type === 'dir' ? new Map() : null,
      nlink: node.type === 'dir' ? 2 : 1,
      mtime: keepOwner ? node.mtime : this.now,
      ctime: this.now
    });
    if (node.type === 'dir') {
      node.entries.forEach(function (child, name) {
        const c = self.copyNode(child, user, keepOwner);
        copy.entries.set(name, c);
        if (c.type === 'dir') copy.nlink += 1;
      });
    }
    return copy;
  };

  /* =========================================================================
   * Packages, services, processes
   * ======================================================================= */

  Machine.prototype.findInstalled = function (name) {
    return this.packages.installed.filter(function (p) { return p.name === name; });
  };
  Machine.prototype.findAvailable = function (name) {
    return this.packages.available.filter(function (p) { return p.name === name; });
  };

  Machine.prototype.ownerOfFile = function (path) {
    const hit = this.packages.installed.find(function (p) {
      return (p.files || []).indexOf(path) !== -1;
    });
    return hit || null;
  };

  /**
   * Install a package: move it out of `available`, drop its files onto the
   * filesystem, and register any unit file it carries as a systemd service.
   */
  Machine.prototype.installPackage = function (pkg) {
    const self = this;
    const entry = Object.assign({}, pkg, {
      installDate: this.formatStamp(this.now),
      sourceRpm: pkg.name + '-' + pkg.version + '-' + pkg.release + '.src.rpm',
      vendor: 'Red Hat, Inc.',
      signature: 'RSA/SHA256, Key ID 199e2f91fd431d51'
    });
    this.packages.installed.push(entry);
    this.packages.available = this.packages.available.filter(function (p) {
      return !(p.name === pkg.name && p.version === pkg.version);
    });
    (pkg.files || []).forEach(function (path) {
      self.forceCreate(path, '(ELF 64-bit executable)\n', 0o755);
    });
    if (pkg.name === 'httpd') {
      this.services.push({ name: 'httpd', description: 'The Apache HTTP Server',
                           state: 'stopped', enabled: false, pid: null });
      this.forceCreate('/etc/httpd/conf/httpd.conf', 'ServerRoot "/etc/httpd"\nListen 80\n', 0o644);
      this.forceCreate('/usr/sbin/httpd', '(ELF 64-bit executable)\n', 0o755);
      this.forceDir('/var/log/httpd', 0o700);
    }
    return entry;
  };

  /**
   * The repository catalogue is shared between forks and frozen, so anything
   * that writes to it has to take a private copy first. Only `dnf remove` does,
   * and most machines never remove anything -- so the copy is made here, on
   * demand, rather than by every fork up front.
   */
  Machine.prototype.mutableAvailable = function () {
    if (this.packages.available.__frozen) {
      this.packages.available = this.packages.available.map(function (entry) {
        return Object.assign({}, entry);
      });
    }
    return this.packages.available;
  };

  Machine.prototype.removePackage = function (name) {
    const self = this;
    const gone = this.packages.installed.filter(function (p) { return p.name === name; });
    this.packages.installed = this.packages.installed.filter(function (p) { return p.name !== name; });
    const available = this.mutableAvailable();
    gone.forEach(function (p) {
      available.push({
        name: p.name, version: p.version, release: p.release, arch: p.arch,
        repo: p.repo, summary: p.summary, size: p.size, requires: p.requires,
        license: p.license, url: p.url, files: p.files, description: p.description
      });
      (p.files || []).forEach(function (path) { self.forceRemove(path); });
    });
    this.services = this.services.filter(function (s) { return s.name !== name; });
    this.processes = this.processes.filter(function (pr) {
      return pr.cmd.indexOf('/' + name) === -1;
    });
    return gone;
  };

  /** Create a path and every directory above it, ignoring permissions. */
  Machine.prototype.forceCreate = function (path, content, mode) {
    const parts = path.split('/').filter(Boolean);
    const file = parts.pop();
    let dir = this.root;
    for (let i = 0; i < parts.length; i++) {
      let next = dir.entries.get(parts[i]);
      if (!next || next.type !== 'dir') {
        next = this.newInode({ type: 'dir', mode: 0o755, entries: new Map(),
                               nlink: 2, content: null });
        dir.entries.set(parts[i], next);
        dir.nlink += 1;
      }
      dir = next;
    }
    if (dir.entries.has(file)) return dir.entries.get(file);
    const node = this.newInode({ type: 'file', mode: mode || 0o644, content: content || '' });
    dir.entries.set(file, node);
    return node;
  };

  Machine.prototype.forceDir = function (path, mode) {
    const parts = path.split('/').filter(Boolean);
    let dir = this.root;
    for (let i = 0; i < parts.length; i++) {
      let next = dir.entries.get(parts[i]);
      if (!next || next.type !== 'dir') {
        next = this.newInode({ type: 'dir', mode: mode || 0o755, entries: new Map(),
                               nlink: 2, content: null });
        dir.entries.set(parts[i], next);
        dir.nlink += 1;
      }
      dir = next;
    }
    return dir;
  };

  Machine.prototype.forceRemove = function (path) {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    let dir = this.root;
    for (let i = 0; i < parts.length; i++) {
      dir = dir.entries && dir.entries.get(parts[i]);
      if (!dir || dir.type !== 'dir') return;
    }
    if (dir.entries.has(name)) this.unlink(dir, name);
  };

  Machine.prototype.serviceByName = function (name) {
    const bare = String(name).replace(/\.service$/, '');
    return this.services.find(function (s) { return s.name === bare; }) || null;
  };

  Machine.prototype.spawn = function (user, cmd, tty) {
    const pid = this.nextPid++;
    const proc = {
      pid: pid, ppid: 2423, user: user ? user.name : 'root', tty: tty || 'pts/0',
      cmd: cmd, state: 'S', cpu: 0.0, mem: 0.1, rss: 2048,
      start: this.formatClock(this.now), time: '00:00:00'
    };
    this.processes.push(proc);
    return proc;
  };

  Machine.prototype.killPid = function (pid) {
    const before = this.processes.length;
    this.processes = this.processes.filter(function (p) { return p.pid !== pid; });
    this.jobs = this.jobs.filter(function (j) { return j.pid !== pid; });
    return this.processes.length !== before;
  };

  /* ---------- time formatting ---------- */

  Machine.prototype.formatStamp = function (ms) {
    const dt = new Date(ms);
    return MONTHS[dt.getUTCMonth()] + ' ' + pad2(dt.getUTCDate()) + ' ' +
      dt.getUTCFullYear() + ' ' + pad2(dt.getUTCHours()) + ':' + pad2(dt.getUTCMinutes());
  };

  /** The long form `stat` prints: 2025-09-15 14:32:00.000000000 -0400. */
  Machine.prototype.formatFullStamp = function (ms) {
    const dt = new Date(ms);
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate()) +
      ' ' + pad2(dt.getUTCHours()) + ':' + pad2(dt.getUTCMinutes()) + ':' +
      pad2(dt.getUTCSeconds()) + '.000000000 -0400';
  };

  Machine.prototype.formatClock = function (ms) {
    const dt = new Date(ms);
    return pad2(dt.getUTCHours()) + ':' + pad2(dt.getUTCMinutes());
  };

  /** The `ls -l` column: "Sep 14 09:12", or "Sep 14  2024" once six months old. */
  Machine.prototype.formatLsTime = function (ms) {
    const dt = new Date(ms);
    const sixMonths = 15552000000;
    const stamp = MONTHS[dt.getUTCMonth()] + ' ' + (dt.getUTCDate() < 10 ? ' ' : '') + dt.getUTCDate();
    if (this.now - ms > sixMonths || ms - this.now > 0) {
      return stamp + '  ' + dt.getUTCFullYear();
    }
    return stamp + ' ' + pad2(dt.getUTCHours()) + ':' + pad2(dt.getUTCMinutes());
  };

  /** Advance the virtual clock, so `touch a; touch b; ls -t` orders correctly. */
  Machine.prototype.tick = function (seconds) {
    this.now += (seconds || 1) * 1000;
  };

  /* =========================================================================
   * The public session object
   * ======================================================================= */

  function session(image) {
    let machine = new Machine(image);

    return {
      get machine() { return machine; },

      /** Throw away every change and rebuild from the shipped image. */
      reset: function () { machine = new Machine(image); },

      /** An independent machine from the same image -- used for grading. */
      fork: function () { return session(image); },

      hostname: function () { return machine.hostname; }
    };
  }

  /**
   * Build a fresh machine. Two callers get two machines, so an `rm -rf` typed
   * into the playground can never reach a graded question.
   */
  function create(imagePath) {
    const path = imagePath || DEFAULT_IMAGE;
    return imageJson(path).then(function (image) {
      return session(image);
    });
  }

  /** Synchronous construction, for Node-side tests that already hold the image. */
  function fromImage(image) { return session(image); }

  return {
    create: create,
    fromImage: fromImage,
    Machine: Machine,
    defaultImage: DEFAULT_IMAGE
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HarborBox;
