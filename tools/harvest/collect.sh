#!/bin/bash
# ===========================================================================
# Runs INSIDE a Rocky Linux 9 container and writes the real machine's
# observable surface to /out as JSON.
#
# Everything the practice emulator claims about RHEL 9 -- package versions,
# file lists, man pages, --help text, error messages, exit codes -- should
# come from here rather than from anyone's memory. Run it once, commit the
# result, and the emulator has a source of truth it can be checked against.
#
#     docker run --rm -v "$PWD/tools/harvest/out:/out" \
#            -v "$PWD/tools/harvest/collect.sh:/collect.sh" \
#            rockylinux:9 bash /collect.sh
#
# It is deliberately chatty on stderr: this takes a few minutes and you want
# to know which stage is slow.
# ===========================================================================
set -uo pipefail

OUT=/out
mkdir -p "$OUT"
US=$'\x1f'          # unit separator -- safe inside summaries and paths

say() { printf '\n== %s\n' "$*" >&2; }

# Stages can be run selectively -- `bash collect.sh facts` redoes just the
# system facts without re-harvesting 790 man pages. Preparing the container
# always runs, because every other stage depends on what it installs.
STAGES="${*:-packages commands man probes facts}"
want() { case " $STAGES " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

# ---------------------------------------------------------------------------
# 0. Make the container look like an install, not a container
#
# Container images set tsflags=nodocs and ship no man pages at all, so the
# documentation has to be put back before any of it can be read.
# ---------------------------------------------------------------------------
say 'Preparing the container (removing nodocs, installing the course toolset)'
sed -i '/^tsflags=nodocs/d' /etc/dnf/dnf.conf

# The container ships `coreutils-single`: one multi-call binary standing in for
# GNU coreutils to keep the image small, so /usr/bin/ls is a 50-byte shim rather
# than a 140KB program. It conflicts with the real package, which is why this
# needs --allowerasing. Without the swap every file size, every package owner
# and every `rpm -qf` answer we harvest for a coreutils command would be wrong.
say 'Swapping coreutils-single for the real GNU coreutils'
dnf -y --allowerasing install coreutils >/dev/null 2>&1 || {
  echo "FATAL: could not install GNU coreutils -- no network from the container?" >&2
  exit 1
}

# A container image is not a machine, so the package set needs broadening. The
# obvious move -- `dnf group install "Minimal Install"` -- is a trap: it pulls
# 835MB, most of it the kernel and linux-firmware, which between them ship not
# one man page. We want userland, so the userland is named explicitly.
#
# Kernel and firmware are excluded rather than merely not requested, because
# plenty of these packages would drag them back in as dependencies.
USERLAND="bash-completion bc binutils cpio curl diffutils dosfstools e2fsprogs
          ed file gettext git groff-base iproute iputils iptables jq kbd
          logrotate lsof lvm2 net-tools nfs-utils openldap-clients parted patch
          pciutils policycoreutils quota strace sysstat tcpdump telnet time
          traceroute unzip usbutils vim-enhanced wget xfsprogs xz zip zsh
          audit ca-certificates dbus grubby kmod libselinux-utils openssl
          selinux-policy sos tuned setup initscripts crypto-policies"

say 'Installing a broad userland (no kernel, no firmware -- they have no man pages)'
NOFIRMWARE="--exclude=kernel* --exclude=linux-firmware* --exclude=*-firmware"
# One transaction, not sixty: each dnf invocation reloads metadata, so a loop
# costs minutes in startup alone. strict=0 skips names this rebuild does not
# have instead of failing the lot.
dnf -y $NOFIRMWARE --setopt=strict=0 --skip-broken --allowerasing \
    install $USERLAND >/dev/null 2>&1 \
  || echo '  (some userland packages were skipped)' >&2

# The course toolset. CORE must succeed; EXTRA is best-effort because package
# names drift between RHEL rebuilds and one missing name would otherwise fail
# the whole transaction several minutes in.
CORE="man-db man-pages util-linux procps-ng shadow-utils findutils
      grep sed gawk diffutils file less tar gzip which systemd rpm"
EXTRA="psmisc bzip2 nano vim-minimal openssh-clients openssh-server iproute
       iputils bind-utils dnf-plugins-core cronie rsyslog chrony firewalld
       NetworkManager sudo passwd acl attr lsof tree hostname info rsync
       mlocate plocate flatpak"

say 'Installing the course toolset'
dnf -y --allowerasing install $CORE >/dev/null 2>&1 || {
  echo "FATAL: could not install the core toolset." >&2
  exit 1
}
dnf -y --setopt=strict=0 --skip-broken install $EXTRA >/dev/null 2>&1   || echo '  (some of the course toolset was skipped)' >&2

# Everything installed above arrived after tsflags=nodocs was removed, so it
# has its documentation. Packages from the original image do not -- reinstall
# the ones that own something on the PATH, since those are the man pages we
# came for. Chunked so one bad package does not lose the rest.
# Only the man stage needs this, and it is slow -- skip it for a facts-only or
# packages-only run.
if want man; then
say 'Restoring documentation for packages that came with the image'
OWNERS=$(rpm -qf $(ls /usr/bin/* /usr/sbin/* 2>/dev/null) 2>/dev/null \
         | grep -v 'not owned' | sort -u)

# Two passes, and the order matters. `dnf reinstall` needs the *exact* installed
# version to still be in a repo; a base-image package that has been superseded
# fails with "Installed package X not available" and the docs never arrive. That
# is how `man dnf` went missing: the image ships dnf-4.14.0-8 while the repo
# carries -34. Upgrading first replaces those with a current build that brings
# its documentation along; reinstall then covers whatever was already current.
echo "$OWNERS" | xargs -n 40 sh -c 'dnf -y upgrade   "$@" >/dev/null 2>&1' _ || true
echo "$OWNERS" | xargs -n 40 sh -c 'dnf -y reinstall "$@" >/dev/null 2>&1' _ || true
mandb -q 2>/dev/null
fi

# ---------------------------------------------------------------------------
# JSON helpers -- python3 is present once dnf has run, and is far safer than
# hand-rolling quoting for man page text full of quotes and backslashes.
# ---------------------------------------------------------------------------
json_from_tsv() {            # json_from_tsv <keys...>  < tsv-on-stdin
  python3 -c '
import sys, json
keys = sys.argv[1:]
rows = []
for line in sys.stdin.read().split("\n"):
    if not line.strip():
        continue
    parts = line.split("\x1f")
    parts += [""] * (len(keys) - len(parts))
    rows.append(dict(zip(keys, parts[:len(keys)])))
json.dump(rows, sys.stdout, indent=1, ensure_ascii=False)
' "$@"
}

# ---------------------------------------------------------------------------
# 1. Installed packages
# ---------------------------------------------------------------------------
if want packages; then
say 'Installed packages'
rpm -qa --qf "%{NAME}${US}%{VERSION}${US}%{RELEASE}${US}%{ARCH}${US}%{SIZE}${US}%{LICENSE}${US}%{URL}${US}%{SUMMARY}\n" \
  | sort \
  | json_from_tsv name version release arch size license url summary \
  > "$OUT/packages-installed.json"

say 'Package file lists'
# %{=NAME}, not %{NAME}: inside an array iterator, mixing a scalar tag with an
# array one fails outright with "array iterator used with different sized
# arrays". The = prefix repeats the scalar for each element, which is what we
# want -- one row per (package, path) pair.
rpm -qa --qf "[%{=NAME}${US}%{FILENAMES}\n]" \
  | sort -u \
  | json_from_tsv package path \
  > "$OUT/package-files.json"

say 'Package dependencies'
rpm -qa --qf "[%{=NAME}${US}%{REQUIRENAME}\n]" \
  | grep -v "${US}rpmlib(" \
  | sort -u \
  | json_from_tsv package requires \
  > "$OUT/package-requires.json"
fi

# ---------------------------------------------------------------------------
# 2. What could be installed
# ---------------------------------------------------------------------------
if want packages; then
say 'Available packages (this one needs the network)'
dnf -q list --available 2>/dev/null \
  | tail -n +2 \
  | awk 'NF==3 {print $1 "\x1f" $2 "\x1f" $3}' \
  | json_from_tsv nevra version repo \
  > "$OUT/packages-available.json"

dnf -q repolist --all 2>/dev/null \
  | tail -n +2 \
  | awk '{ id=$1; status=$NF; $1=""; $NF=""; sub(/^ +/,""); sub(/ +$/,"");
           print id "\x1f" $0 "\x1f" status }' \
  | json_from_tsv id name status \
  > "$OUT/repos.json"

# `dnf list available` has no summary column; repoquery does. Without this,
# `dnf search` in the emulator prints a bare name and an empty colon.
say 'Package summaries'
dnf -q repoquery --available --qf "%{name}${US}%{summary}" 2>/dev/null   | sort -u   | python3 -c '
import sys, json
rows = {}
for line in sys.stdin:
    line = line.rstrip("
")
    if "" not in line:
        continue
    name, summary = line.split("", 1)
    if name and summary and name not in rows:
        rows[name] = summary
json.dump(rows, sys.stdout, indent=1, ensure_ascii=False)
' > "$OUT/summaries.json"

dnf -q group list -v 2>/dev/null > "$OUT/groups.txt"
dnf -q module list 2>/dev/null > "$OUT/modules.txt"
fi

# ---------------------------------------------------------------------------
# 3. Every command on the PATH
# ---------------------------------------------------------------------------
if want commands; then
say 'Enumerating commands on the PATH'
# -type l as well as -type f: a great many commands on RHEL are symlinks --
# awk -> gawk, dnf and yum -> dnf-3, apropos and whatis -> man, vi -> vim.
# Filtering to regular files silently loses them, `man` included.
for d in /usr/bin /usr/sbin /bin /sbin; do
  [ -d "$d" ] && find "$d" -maxdepth 1 \( -type f -o -type l \) -executable -printf '%f\n'
done | sort -u > "$OUT/commands.txt"
wc -l < "$OUT/commands.txt" >&2
fi

# ---------------------------------------------------------------------------
# 4. Man pages -- the real text, wrapped at 80 columns the way a terminal
#    would show it
# ---------------------------------------------------------------------------
if want man; then
say 'Man pages (slow)'
export MANWIDTH=80 MAN_KEEP_FORMATTING=
python3 - "$OUT" <<'PY'
import json, os, subprocess, sys
out = sys.argv[1]
names = open(os.path.join(out, 'commands.txt')).read().split()
pages = {}
for i, name in enumerate(names):
    if i % 100 == 0:
        print('  man %d/%d' % (i, len(names)), file=sys.stderr)
    try:
        r = subprocess.run(['man', '--no-hyphenation', '--no-justification', name],
                           capture_output=True, text=True, timeout=20,
                           env=dict(os.environ, MANWIDTH='80', MANPAGER='cat', PAGER='cat'))
    except Exception:
        continue
    if r.returncode != 0 or not r.stdout.strip():
        continue
    text = subprocess.run(['col', '-bx'], input=r.stdout, capture_output=True,
                          text=True).stdout
    # The section number is in the header line: "LS(1)  User Commands  LS(1)"
    first = text.split('\n', 1)[0]
    section = ''
    if '(' in first and ')' in first:
        section = first[first.index('(') + 1:first.index(')')]
    pages[name] = {'section': section, 'text': text.rstrip() + '\n'}
json.dump(pages, open(os.path.join(out, 'manpages.json'), 'w'),
          indent=1, ensure_ascii=False)
print('  man pages captured: %d' % len(pages), file=sys.stderr)
PY

# dnf and yum need one more nudge. Their pages live in the `dnf` package, whose
# installed version in the image is too old to reinstall and which the bulk
# upgrade pass does not reliably catch -- upgrading dnf while dnf is midway
# through its own transaction is the awkward case. Doing it on its own
# afterwards works, and these two matter: the course has a chapter on them.
say 'Topping up the dnf and yum man pages'
dnf -y -q upgrade dnf yum dnf-data python3-dnf >/dev/null 2>&1
mandb -q 2>/dev/null
python3 - "$OUT" <<'PY'
import json, os, subprocess, sys
out = sys.argv[1]
path = os.path.join(out, 'manpages.json')
pages = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
added = []
for name in ('dnf', 'yum', 'dnf.conf'):
    if name in pages:
        continue
    r = subprocess.run(['man', '--no-hyphenation', '--no-justification', name],
                       capture_output=True, text=True, timeout=30,
                       env=dict(os.environ, MANWIDTH='80', MANPAGER='cat', PAGER='cat'))
    if r.returncode != 0 or not r.stdout.strip():
        continue
    text = subprocess.run(['col', '-bx'], input=r.stdout,
                          capture_output=True, text=True).stdout
    first = text.split('\n', 1)[0]
    section = first[first.index('(') + 1:first.index(')')] \
        if '(' in first and ')' in first else ''
    pages[name] = {'section': section, 'text': text.rstrip() + '\n'}
    added.append(name)
json.dump(pages, open(path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('  topped up: %s (total %d)' % (' '.join(added) or '(none needed)', len(pages)),
      file=sys.stderr)
PY
fi

# ---------------------------------------------------------------------------
# 5. --help text and real error messages
#
# Probing runs commands with deliberately wrong input, so it is kept to an
# allowlist: a container is disposable, but a command that reboots it or
# blocks forever wastes the whole run.
# ---------------------------------------------------------------------------
if want probes; then
say 'Help text and error probes'
cat > /tmp/allow.txt <<'EOF'
awk basename blkid cat chage chgrp chmod chown chronyc cmp column comm cp
cut date df diff dig dirname dnf du env expand expr factor file find findmnt
fmt fold free getent gpasswd grep groupadd groupdel groupmod groups gunzip
gzip head hostname hostnamectl id install ip join last lastlog less ln locate
logname ls lsblk lscpu lsof man mkdir mktemp more mount mv nano nice nl
nproc numfmt od passwd paste pgrep ping pr printenv printf ps pstree ptx
pwd readlink realpath rev rm rmdir rpm rsync scp sed seq sha256sum shuf sleep
sort split ss stat stdbuf su sudo sum systemctl tac tail tar tee test timeout
touch tr tree truncate tsort tty umask uname unexpand uniq uptime useradd
userdel usermod users vdir vim w wc whatis whereis which who whoami xargs yes
apropos bzip2 clear crontab firewall-cmd flatpak gawk host journalctl kill
killall logger mandb md5sum newgrp nmcli nslookup pkill pmap renice sftp ssh
ssh-add ssh-agent ssh-copy-id ssh-keygen timedatectl top tracepath umount
updatedb vi vmstat watch yum zcat egrep fgrep dnf-3 domainname
EOF

python3 - "$OUT" <<'PY'
import json, os, subprocess, sys
out = sys.argv[1]
allow = open('/tmp/allow.txt').read().split()
have = set(open(os.path.join(out, 'commands.txt')).read().split())
allow = [c for c in allow if c in have]

def run(argv):
    try:
        # 25s, not 8: dnf and yum take several seconds merely to start, and
        # their --help was being lost to the shorter timeout without a word.
        r = subprocess.run(argv, capture_output=True, text=True, timeout=25,
                           stdin=subprocess.DEVNULL)
        return {'stdout': r.stdout, 'stderr': r.stderr, 'status': r.returncode}
    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None

help_text, errors = {}, {}
for i, cmd in enumerate(allow):
    if i % 40 == 0:
        print('  probe %d/%d' % (i, len(allow)), file=sys.stderr)

    h = run([cmd, '--help'])
    if h and (h['stdout'] or h['stderr']):
        help_text[cmd] = {'text': (h['stdout'] or h['stderr']), 'status': h['status']}

    probes = {}
    for label, argv in (
        ('bad-option',  [cmd, '--zzz-not-an-option']),
        ('missing-file', [cmd, '/nonexistent/zzz-no-such-path']),
        ('no-args',     [cmd]),
    ):
        # `no-args` on a filter would block on stdin; DEVNULL handles it.
        r = run(argv)
        if r and (r['stderr'] or r['status'] != 0):
            probes[label] = {'stderr': r['stderr'], 'status': r['status']}
    if probes:
        errors[cmd] = probes

json.dump(help_text, open(os.path.join(out, 'help.json'), 'w'), indent=1, ensure_ascii=False)
json.dump(errors, open(os.path.join(out, 'errors.json'), 'w'), indent=1, ensure_ascii=False)
print('  help: %d, error probes: %d' % (len(help_text), len(errors)), file=sys.stderr)
PY
fi

# ---------------------------------------------------------------------------
# 6. System facts
# ---------------------------------------------------------------------------
if want facts; then
say 'System facts'
python3 - "$OUT" <<'PY'
import json, os, subprocess, sys
out = sys.argv[1]
def cap(argv, shell=False):
    try:
        r = subprocess.run(argv, capture_output=True, text=True, timeout=20, shell=shell)
        return r.stdout
    except Exception:
        return ''
def read(p):
    try:
        return open(p).read()
    except Exception:
        return ''
json.dump({
    'os-release': read('/etc/os-release'),
    'passwd': read('/etc/passwd'),
    'group': read('/etc/group'),
    'shells': read('/etc/shells'),
    'login.defs': read('/etc/login.defs'),
    'fstab': read('/etc/fstab'),
    'services': read('/etc/services')[:200000],
    'nsswitch': read('/etc/nsswitch.conf'),
    'bashrc': read('/etc/bashrc'),
    'profile': read('/etc/profile'),
    'skel': cap(['ls', '-la', '/etc/skel']),
    'usr-bin': cap(['ls', '/usr/bin']),
    'usr-sbin': cap(['ls', '/usr/sbin']),
    'rpm-version': cap(['rpm', '--version']),
    'dnf-version': cap(['dnf', '--version']),
    'bash-version': cap(['bash', '--version']),
    'uname': cap(['uname', '-a']),
    'units': cap(['systemctl', 'list-unit-files', '--no-pager']),
}, open(os.path.join(out, 'facts.json'), 'w'), indent=1, ensure_ascii=False)
PY
fi

say 'Done'
ls -la "$OUT" >&2
