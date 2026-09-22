#!/usr/bin/env python3
"""
Generates data/itn170-box.json -- the seed image for the practice RHEL 9 machine
used by the terminal playground and the auto-graded `shell` questions.

Deterministic: same seed in, same file out. Re-run after editing:

    python3 tools/build_box.py

The machine is modelled on the Red Hat Academy lab hosts (servera.lab.example.com,
logged in as `student`, root password `redhat`) so that what a learner types here
is what they would type in the real lab VM.

-----------------------------------------------------------------------------
The image format
-----------------------------------------------------------------------------
Everything assets/box.js needs to build the machine, and nothing else.

  hostname      fully qualified host name
  umask         the login shell's default umask, as an octal string
  users         [ {name, uid, gid, gecos, home, shell, password, locked,
                   aging:{lastChange,min,max,warn,inactive,expire}} ]
  groups        [ {name, gid, members:[...]} ]
  sudoers       user names allowed to run sudo (plus anyone in group `wheel`)
  packages      { repos:[...], installed:[...], available:[...], groups:[...],
                  modules:[...], history:[...] }
  flatpak       { remotes:[...], installed:[...], available:[...] }
  services      [ {name, description, state, enabled, pid} ]
  processes     [ {pid, ppid, user, tty, cmd, state, cpu, mem, rss, start, time} ]
  network       { interfaces:[...], routes:[...], dns:[...], connections:[...] }
  blockDevices  [ {name, size, type, fstype, label, uuid, mountpoint, children} ]
  mounts        [ {source, fstype, size, used, avail, usePct, target} ]
  journal       [ {time, host, unit, pid, message, priority} ]
  fs            the filesystem tree (see below)

A filesystem node is one of:

  {"type":"dir",     "mode":"0755", "user":"root", "group":"root",
                     "mtime":"2025-08-14 09:12", "entries":{name: node, ...}}
  {"type":"file",    ... , "text":"contents"}
  {"type":"symlink", "target":"../elsewhere"}
  {"type":"hardlink","to":"/absolute/path/of/the/first/link"}
  {"type":"synth",   "gen":"passwd"}     rendered from the user/group DB on read

`mode` defaults to 0755 for directories and 0644 for files; `user`/`group`
default to root, except under /home/<name>, which defaults to that user. Those
defaults keep the image readable -- only the interesting permissions are stated.
"""

import json
import os
import random

SEED = 170124
rng = random.Random(SEED)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itn170-box.json")

HOSTNAME = "servera.lab.example.com"
NOW = "2025-09-15 14:32"

# ---------------------------------------------------------------------------
# Users and groups
#
# student is the lab account and the only one in wheel. operator1..3 exist so
# that group membership and password-aging questions have something to act on
# without the learner having to create it first; contractor1..2 are deliberately
# absent from the image so `useradd` questions have room to work.
# ---------------------------------------------------------------------------

SYS_USERS = [
    ("root",     0,   0,   "root",                     "/root",            "/bin/bash"),
    ("bin",      1,   1,   "bin",                      "/bin",             "/sbin/nologin"),
    ("daemon",   2,   2,   "daemon",                   "/sbin",            "/sbin/nologin"),
    ("adm",      3,   4,   "adm",                      "/var/adm",         "/sbin/nologin"),
    ("lp",       4,   7,   "lp",                       "/var/spool/lpd",   "/sbin/nologin"),
    ("sync",     5,   0,   "sync",                     "/sbin",            "/bin/sync"),
    ("shutdown", 6,   0,   "shutdown",                 "/sbin",            "/sbin/shutdown"),
    ("halt",     7,   0,   "halt",                     "/sbin",            "/sbin/halt"),
    ("mail",     8,   12,  "mail",                     "/var/spool/mail",  "/sbin/nologin"),
    ("operator", 11,  0,   "operator",                 "/root",            "/sbin/nologin"),
    ("games",    12,  100, "games",                    "/usr/games",       "/sbin/nologin"),
    ("ftp",      14,  50,  "FTP User",                 "/var/ftp",         "/sbin/nologin"),
    ("nobody",   65534, 65534, "Kernel Overflow User",  "/",               "/sbin/nologin"),
    ("dbus",     81,  81,  "System message bus",       "/",                "/sbin/nologin"),
    ("systemd-coredump", 999, 997, "systemd Core Dumper", "/",             "/sbin/nologin"),
    ("polkitd",  998, 996, "User for polkitd",         "/",                "/sbin/nologin"),
    ("chrony",   995, 993, "",                         "/var/lib/chrony",  "/sbin/nologin"),
    ("sshd",     74,  74,  "Privilege-separated SSH",  "/usr/share/empty.sshd", "/sbin/nologin"),
    ("tss",      59,  59,  "Account used for TPM access", "/dev/null",     "/sbin/nologin"),
]

# (name, uid, gecos, shell, password, locked, aging) -- aging is
# (lastChange days since epoch, min, max, warn, inactive, expire)
REG_USERS = [
    ("student",   1000, "Student User",      "/bin/bash", "student", False, (20100, 0,  99999, 7, "", "")),
    ("operator1", 1001, "Site Operator One", "/bin/bash", "redhat",  False, (20050, 0,  60,    7, "", "")),
    ("operator2", 1002, "Site Operator Two", "/bin/bash", "redhat",  False, (20050, 1,  90,    7, 14, "")),
    ("operator3", 1003, "Site Operator Three", "/bin/bash", "redhat", True, (19980, 0,  99999, 7, "", "")),
    ("dbadmin",   1004, "Database Admin",    "/bin/bash", "redhat",  False, (20120, 0,  99999, 7, "", "")),
]

SYS_GROUPS = [
    ("root", 0, []), ("bin", 1, []), ("daemon", 2, []), ("sys", 3, []),
    ("adm", 4, []), ("tty", 5, []), ("disk", 6, []), ("lp", 7, []),
    ("mem", 8, []), ("kmem", 9, []), ("wheel", 10, ["student"]),
    ("cdrom", 11, []), ("mail", 12, []), ("man", 15, []), ("dialout", 18, []),
    ("floppy", 19, []), ("games", 20, []), ("utmp", 22, []), ("tape", 33, []),
    ("utempter", 35, []), ("video", 39, []), ("ftp", 50, []), ("lock", 54, []),
    ("audio", 63, []), ("users", 100, []), ("sshd", 74, []), ("dbus", 81, []),
    ("input", 104, []), ("kvm", 36, []), ("render", 105, []),
    ("systemd-journal", 190, []), ("chrony", 993, []), ("polkitd", 996, []),
    ("systemd-coredump", 997, []), ("nobody", 65534, []), ("tss", 59, []),
]

# Shared groups the permission and group-membership exercises act on.
EXTRA_GROUPS = [
    ("student",     1000, []),
    ("operator1",   1001, []),
    ("operator2",   1002, []),
    ("operator3",   1003, []),
    ("dbadmin",     1004, []),
    ("operators",  10001, ["operator1", "operator2"]),
    ("consultants", 10002, ["operator3"]),
    ("techdocs",   10003, ["student", "operator1"]),
]


def build_users():
    users = []
    for name, uid, gid, gecos, home, shell in SYS_USERS:
        users.append({
            "name": name, "uid": uid, "gid": gid, "gecos": gecos,
            "home": home, "shell": shell,
            "password": "!!" if uid else "redhat",
            "locked": uid != 0,
            "aging": {"lastChange": 19800, "min": 0, "max": 99999,
                      "warn": 7, "inactive": "", "expire": ""},
        })
    for name, uid, gecos, shell, pw, locked, aging in REG_USERS:
        last, mn, mx, warn, inact, exp = aging
        users.append({
            "name": name, "uid": uid, "gid": uid, "gecos": gecos,
            "home": "/home/" + name, "shell": shell,
            "password": pw, "locked": locked,
            "aging": {"lastChange": last, "min": mn, "max": mx,
                      "warn": warn, "inactive": inact, "expire": exp},
        })
    return users


def build_groups():
    return [{"name": n, "gid": g, "members": list(m)}
            for n, g, m in SYS_GROUPS + EXTRA_GROUPS]


# ---------------------------------------------------------------------------
# Software: repositories, installed RPMs, and what is available to install
#
# `files` drives `rpm -ql`, `rpm -qf` and `dnf provides`, so every command the
# shell implements needs to be owned by some package here -- tools/test_shell.js
# checks exactly that.
# ---------------------------------------------------------------------------

REPOS = [
    {"id": "rhel-9-for-x86_64-baseos-rpms",
     "name": "Red Hat Enterprise Linux 9 for x86_64 - BaseOS (RPMs)",
     "enabled": True, "packages": 4382},
    {"id": "rhel-9-for-x86_64-appstream-rpms",
     "name": "Red Hat Enterprise Linux 9 for x86_64 - AppStream (RPMs)",
     "enabled": True, "packages": 7431},
    {"id": "lab-extras",
     "name": "Classroom Extra Packages",
     "enabled": False, "packages": 128,
     "baseurl": "http://content.example.com/rhel9.0/x86_64/lab-extras"},
]

BASEOS = "rhel-9-for-x86_64-baseos-rpms"
APPSTREAM = "rhel-9-for-x86_64-appstream-rpms"

# (name, version, release, arch, repo, summary, license, url, size, files, requires)
INSTALLED = [
    ("bash", "5.1.8", "6.el9", "x86_64", BASEOS,
     "The GNU Bourne Again shell", "GPLv3+", "https://www.gnu.org/software/bash",
     7856432, ["/usr/bin/bash", "/usr/bin/sh", "/etc/bashrc", "/etc/profile.d/bash_completion.sh",
               "/usr/share/man/man1/bash.1.gz"], ["glibc", "ncurses-libs"]),
    ("coreutils", "8.32", "34.el9", "x86_64", BASEOS,
     "A set of basic GNU tools commonly used in shell scripts", "GPLv3+",
     "https://www.gnu.org/software/coreutils", 6104928,
     ["/usr/bin/cat", "/usr/bin/chgrp", "/usr/bin/chmod", "/usr/bin/chown", "/usr/bin/cp",
      "/usr/bin/cut", "/usr/bin/date", "/usr/bin/df", "/usr/bin/dirname", "/usr/bin/du",
      "/usr/bin/echo", "/usr/bin/head", "/usr/bin/basename", "/usr/bin/ln", "/usr/bin/ls",
      "/usr/bin/mkdir", "/usr/bin/mv", "/usr/bin/nl", "/usr/bin/printf", "/usr/bin/pwd",
      "/usr/bin/readlink", "/usr/bin/realpath", "/usr/bin/rm", "/usr/bin/rmdir",
      "/usr/bin/sleep", "/usr/bin/sort", "/usr/bin/split", "/usr/bin/stat", "/usr/bin/sum",
      "/usr/bin/tac", "/usr/bin/tail", "/usr/bin/tee", "/usr/bin/touch", "/usr/bin/tr",
      "/usr/bin/true", "/usr/bin/false", "/usr/bin/uname", "/usr/bin/uniq", "/usr/bin/wc",
      "/usr/bin/whoami", "/usr/bin/users", "/usr/bin/md5sum", "/usr/bin/sha256sum",
      "/usr/bin/nohup", "/usr/bin/nice", "/usr/bin/seq", "/usr/bin/yes", "/usr/bin/env",
      "/usr/bin/who", "/usr/bin/logname", "/usr/bin/paste", "/usr/bin/comm",
      "/usr/share/man/man1/ls.1.gz", "/usr/share/man/man1/cp.1.gz"], ["glibc"]),
    ("grep", "3.6", "5.el9", "x86_64", BASEOS,
     "Pattern matching utilities", "GPLv3+", "https://www.gnu.org/software/grep",
     831204, ["/usr/bin/grep", "/usr/bin/egrep", "/usr/bin/fgrep",
              "/usr/share/man/man1/grep.1.gz"], ["glibc", "pcre2"]),
    ("sed", "4.8", "9.el9", "x86_64", BASEOS,
     "A GNU stream text editor", "GPLv3+", "https://www.gnu.org/software/sed",
     754112, ["/usr/bin/sed", "/usr/share/man/man1/sed.1.gz"], ["glibc"]),
    ("gawk", "5.1.0", "6.el9", "x86_64", BASEOS,
     "The GNU version of the AWK text processing utility", "GPLv3+",
     "https://www.gnu.org/software/gawk", 2851328,
     ["/usr/bin/awk", "/usr/bin/gawk", "/usr/share/man/man1/awk.1.gz"], ["glibc"]),
    ("findutils", "4.8.0", "5.el9", "x86_64", BASEOS,
     "The GNU versions of find utilities (find and xargs)", "GPLv3+",
     "https://www.gnu.org/software/findutils", 1912736,
     ["/usr/bin/find", "/usr/bin/xargs", "/usr/share/man/man1/find.1.gz"], ["glibc"]),
    ("util-linux", "2.37.4", "10.el9", "x86_64", BASEOS,
     "Collection of basic system utilities", "GPLv2+",
     "https://www.kernel.org/pub/linux/utils/util-linux", 12583040,
     ["/usr/bin/kill", "/usr/bin/lsblk", "/usr/bin/more", "/usr/bin/mount", "/usr/bin/umount",
      "/usr/bin/findmnt", "/usr/bin/su", "/usr/bin/blkid", "/usr/bin/lscpu",
      "/usr/bin/renice", "/usr/bin/rev", "/usr/bin/whereis", "/usr/bin/hexdump",
      "/usr/bin/flock", "/usr/bin/logger", "/usr/bin/last", "/usr/bin/lastlog",
      "/usr/bin/mountpoint"], ["glibc", "pam"]),
    ("procps-ng", "3.3.17", "9.el9", "x86_64", BASEOS,
     "System and process monitoring utilities", "GPLv2+",
     "https://sourceforge.net/projects/procps-ng", 1048576,
     ["/usr/bin/ps", "/usr/bin/top", "/usr/bin/free", "/usr/bin/uptime", "/usr/bin/pgrep",
      "/usr/bin/pkill", "/usr/bin/pmap", "/usr/bin/w", "/usr/bin/watch",
      "/usr/bin/vmstat"], ["glibc", "ncurses-libs"]),
    ("psmisc", "23.4", "3.el9", "x86_64", BASEOS,
     "Utilities for managing processes on your system", "GPLv2+",
     "https://gitlab.com/psmisc/psmisc", 622592,
     ["/usr/bin/killall", "/usr/bin/pstree", "/usr/bin/fuser"], ["glibc"]),
    ("systemd", "250", "12.el9", "x86_64", BASEOS,
     "System and Service Manager", "LGPLv2+",
     "https://systemd.io", 15728640,
     ["/usr/bin/systemctl", "/usr/bin/journalctl", "/usr/bin/hostnamectl",
      "/usr/bin/timedatectl", "/usr/bin/loginctl", "/usr/lib/systemd/systemd",
      "/etc/systemd/system.conf"], ["glibc", "dbus"]),
    ("shadow-utils", "4.9", "6.el9", "x86_64", BASEOS,
     "Utilities for managing accounts and shadow password files", "BSD and GPLv2+",
     "https://github.com/shadow-maint/shadow", 4194304,
     ["/usr/sbin/useradd", "/usr/sbin/usermod", "/usr/sbin/userdel", "/usr/sbin/groupadd",
      "/usr/sbin/groupmod", "/usr/sbin/groupdel", "/usr/bin/chage", "/usr/bin/passwd",
      "/usr/bin/gpasswd", "/usr/bin/newgrp", "/usr/bin/id", "/usr/bin/groups",
      "/etc/login.defs", "/etc/default/useradd"], ["glibc", "libselinux", "pam"]),
    ("rpm", "4.16.1.3", "22.el9", "x86_64", BASEOS,
     "The RPM package management system", "GPLv2+", "https://rpm.org",
     3145728, ["/usr/bin/rpm", "/usr/bin/rpm2cpio", "/usr/bin/rpmkeys",
               "/var/lib/rpm"], ["glibc", "rpm-libs"]),
    ("dnf", "4.14.0", "5.el9", "noarch", BASEOS,
     "Package manager", "GPLv2+", "https://github.com/rpm-software-management/dnf",
     2097152, ["/usr/bin/dnf", "/usr/bin/dnf-3", "/usr/bin/yum",
               "/etc/dnf/dnf.conf", "/etc/yum.repos.d"], ["python3", "rpm", "python3-dnf"]),
    ("openssh-clients", "8.7p1", "24.el9", "x86_64", BASEOS,
     "An open source SSH client applications", "BSD",
     "https://www.openssh.com", 3670016,
     ["/usr/bin/ssh", "/usr/bin/scp", "/usr/bin/sftp", "/usr/bin/ssh-keygen",
      "/usr/bin/ssh-copy-id", "/usr/bin/ssh-agent", "/usr/bin/ssh-add",
      "/etc/ssh/ssh_config"], ["glibc", "openssl-libs"]),
    ("openssh-server", "8.7p1", "24.el9", "x86_64", BASEOS,
     "An open source SSH server daemon", "BSD",
     "https://www.openssh.com", 1835008,
     ["/usr/sbin/sshd", "/etc/ssh/sshd_config",
      "/usr/lib/systemd/system/sshd.service"], ["openssh", "pam"]),
    ("vim-enhanced", "8.2.2637", "20.el9", "x86_64", APPSTREAM,
     "A version of the VIM editor which includes recent enhancements", "Vim",
     "https://www.vim.org", 3512320,
     ["/usr/bin/vim", "/usr/bin/vimdiff", "/usr/share/man/man1/vim.1.gz"],
     ["vim-common", "vim-filesystem", "gpm-libs"]),
    ("vim-minimal", "8.2.2637", "20.el9", "x86_64", BASEOS,
     "A minimal version of the VIM editor", "Vim", "https://www.vim.org",
     1048576, ["/usr/bin/vi"], ["glibc"]),
    ("nano", "5.6.1", "5.el9", "x86_64", BASEOS,
     "A small text editor", "GPLv3+", "https://www.nano-editor.org",
     2621440, ["/usr/bin/nano", "/etc/nanorc"], ["glibc", "ncurses-libs"]),
    ("less", "590", "1.el9", "x86_64", BASEOS,
     "A text file browser similar to more, but better", "GPLv3+",
     "https://www.greenwoodsoftware.com/less", 398336,
     ["/usr/bin/less", "/usr/bin/lesspipe.sh"], ["glibc", "ncurses-libs"]),
    ("man-db", "2.9.3", "7.el9", "x86_64", BASEOS,
     "Tools for searching and reading man pages", "GPLv2+ and GPLv3+",
     "https://gitlab.com/man-db/man-db", 2883584,
     ["/usr/bin/man", "/usr/bin/apropos", "/usr/bin/whatis", "/usr/bin/mandb",
      "/etc/man_db.conf"], ["glibc", "groff-base"]),
    ("tar", "1.34", "6.el9", "x86_64", BASEOS,
     "A GNU file archiving program", "GPLv3+",
     "https://www.gnu.org/software/tar", 3014656,
     ["/usr/bin/tar", "/usr/bin/gtar"], ["glibc"]),
    ("gzip", "1.12", "1.el9", "x86_64", BASEOS,
     "The GNU data compression program", "GPLv3+",
     "https://www.gnu.org/software/gzip", 385024,
     ["/usr/bin/gzip", "/usr/bin/gunzip", "/usr/bin/zcat"], ["glibc"]),
    ("which", "2.21", "29.el9", "x86_64", BASEOS,
     "Displays where a particular program in your path is located", "GPLv3",
     "https://carlowood.github.io/which", 81920,
     ["/usr/bin/which"], ["glibc"]),
    ("diffutils", "3.7", "12.el9", "x86_64", BASEOS,
     "A GNU collection of diff utilities", "GPLv3+",
     "https://www.gnu.org/software/diffutils", 1572864,
     ["/usr/bin/diff", "/usr/bin/cmp", "/usr/bin/sdiff"], ["glibc"]),
    ("iproute", "5.18.0", "1.el9", "x86_64", BASEOS,
     "Advanced IP routing and network device configuration tools", "GPLv2+",
     "https://kernel.org/pub/linux/utils/net/iproute2", 2359296,
     ["/usr/sbin/ip", "/usr/sbin/ss", "/etc/iproute2/rt_tables"], ["glibc", "libbpf"]),
    ("iputils", "20210202", "8.el9", "x86_64", BASEOS,
     "Network monitoring tools including ping", "BSD and GPLv2+",
     "https://github.com/iputils/iputils", 655360,
     ["/usr/bin/ping", "/usr/bin/tracepath", "/usr/sbin/arping"], ["glibc"]),
    ("NetworkManager", "1.40.0", "1.el9", "x86_64", BASEOS,
     "Network connection manager and user applications", "GPLv2+",
     "https://networkmanager.dev", 19922944,
     ["/usr/bin/nmcli", "/usr/sbin/NetworkManager", "/etc/NetworkManager/NetworkManager.conf",
      "/usr/lib/systemd/system/NetworkManager.service"], ["glibc", "systemd"]),
    ("hostname", "3.23", "6.el9", "x86_64", BASEOS,
     "Utility to set/show the host name or domain name", "GPLv2+",
     "https://sourceforge.net/projects/net-tools", 61440,
     ["/usr/bin/hostname", "/usr/bin/domainname"], ["glibc"]),
    ("chrony", "4.2", "1.el9", "x86_64", BASEOS,
     "An NTP client/server", "GPLv2",
     "https://chrony.tuxfamily.org", 1310720,
     ["/usr/sbin/chronyd", "/usr/bin/chronyc", "/etc/chrony.conf",
      "/usr/lib/systemd/system/chronyd.service"], ["glibc", "libseccomp"]),
    ("firewalld", "1.1.1", "3.el9", "noarch", BASEOS,
     "A firewall daemon with D-Bus interface providing a dynamic firewall", "GPLv2+",
     "https://firewalld.org", 2621440,
     ["/usr/bin/firewall-cmd", "/usr/sbin/firewalld", "/etc/firewalld/firewalld.conf",
      "/usr/lib/systemd/system/firewalld.service"], ["python3", "nftables"]),
    ("cronie", "1.5.7", "8.el9", "x86_64", BASEOS,
     "Cron daemon for executing programs at set times", "MIT and BSD and ISC and GPLv2+",
     "https://github.com/cronie-crond/cronie", 262144,
     ["/usr/bin/crontab", "/usr/sbin/crond", "/etc/crontab",
      "/usr/lib/systemd/system/crond.service"], ["glibc", "pam"]),
    ("rsyslog", "8.2102.0", "111.el9", "x86_64", BASEOS,
     "Enhanced system logging and kernel message trapping daemon", "GPLv3+",
     "https://www.rsyslog.com", 3670016,
     ["/usr/sbin/rsyslogd", "/etc/rsyslog.conf",
      "/usr/lib/systemd/system/rsyslog.service"], ["glibc", "systemd"]),
    ("audit", "3.0.7", "103.el9", "x86_64", BASEOS,
     "User space tools for kernel auditing", "GPLv2+",
     "https://people.redhat.com/sgrubb/audit", 1048576,
     ["/usr/sbin/auditd", "/usr/sbin/ausearch", "/etc/audit/auditd.conf",
      "/usr/lib/systemd/system/auditd.service"], ["glibc"]),
    ("python3", "3.9.14", "1.el9", "x86_64", BASEOS,
     "Interpreter of the Python programming language", "Python-2.0",
     "https://www.python.org", 33554432,
     ["/usr/bin/python3", "/usr/bin/python3.9"], ["glibc", "python3-libs"]),
    ("kernel", "5.14.0", "70.13.1.el9_0", "x86_64", BASEOS,
     "The Linux kernel", "GPLv2 and Redistributable, no modification permitted",
     "https://www.kernel.org", 0,
     ["/boot/vmlinuz-5.14.0-70.13.1.el9_0.x86_64"], []),
    ("kernel", "5.14.0", "70.22.1.el9_0", "x86_64", BASEOS,
     "The Linux kernel", "GPLv2 and Redistributable, no modification permitted",
     "https://www.kernel.org", 0,
     ["/boot/vmlinuz-5.14.0-70.22.1.el9_0.x86_64"], []),
    ("redhat-release", "9.0", "2.5.el9", "x86_64", BASEOS,
     "Red Hat Enterprise Linux release file", "MIT",
     "https://www.redhat.com", 4096,
     ["/etc/redhat-release", "/etc/os-release", "/etc/system-release"], []),
    ("glibc", "2.34", "40.el9", "x86_64", BASEOS,
     "The GNU libc libraries", "LGPLv2+", "https://www.gnu.org/software/glibc",
     6291456, ["/usr/bin/ldd", "/usr/bin/getent", "/usr/bin/locale",
               "/usr/lib64/libc.so.6"], []),
    ("sudo", "1.9.5p2", "7.el9", "x86_64", BASEOS,
     "Allows restricted root access for specified users", "ISC",
     "https://www.sudo.ws", 6815744,
     ["/usr/bin/sudo", "/usr/sbin/visudo", "/etc/sudoers", "/etc/sudoers.d"],
     ["glibc", "pam"]),
    ("flatpak", "1.12.7", "1.el9", "x86_64", APPSTREAM,
     "Application deployment framework for desktop apps", "LGPLv2+",
     "https://flatpak.org", 7340032,
     ["/usr/bin/flatpak", "/etc/flatpak/remotes.d"], ["glibc", "bubblewrap"]),
    ("mlocate", "0.26", "31.el9", "x86_64", APPSTREAM,
     "An utility for finding files by name", "GPLv2",
     "https://pagure.io/mlocate", 393216,
     ["/usr/bin/locate", "/usr/bin/updatedb", "/etc/updatedb.conf",
      "/var/lib/mlocate/mlocate.db"], ["glibc"]),
    ("file", "5.39", "12.el9", "x86_64", BASEOS,
     "A utility for determining file types", "BSD",
     "https://www.darwinsys.com/file", 262144,
     ["/usr/bin/file", "/usr/share/man/man1/file.1.gz"], ["glibc", "file-libs"]),
    ("ncurses", "6.2", "8.el9", "x86_64", BASEOS,
     "Ncurses support utilities", "MIT",
     "https://invisible-island.net/ncurses", 991232,
     ["/usr/bin/clear", "/usr/bin/tput", "/usr/bin/reset", "/usr/bin/infocmp"],
     ["glibc", "ncurses-libs"]),
    ("lsof", "4.94.0", "3.el9", "x86_64", BASEOS,
     "A utility which lists open files on a Linux/UNIX system", "zlib and Sendmail",
     "https://github.com/lsof-org/lsof", 950272,
     ["/usr/bin/lsof"], ["glibc", "libtirpc"]),
    ("bzip2", "1.0.8", "8.el9", "x86_64", BASEOS,
     "A file compression utility", "BSD",
     "https://sourceware.org/bzip2", 102400,
     ["/usr/bin/bzip2", "/usr/bin/bunzip2", "/usr/bin/bzcat"], ["glibc", "bzip2-libs"]),
    ("subscription-manager", "1.29.26", "3.el9", "x86_64", BASEOS,
     "Tools and libraries for subscription and repository management", "GPLv2",
     "https://github.com/candlepin/subscription-manager", 4194304,
     ["/usr/sbin/subscription-manager", "/etc/rhsm/rhsm.conf"],
     ["python3", "dnf"]),
    ("bind-utils", "9.16.23", "1.el9", "x86_64", APPSTREAM,
     "Utilities for querying DNS name servers", "MPLv2.0",
     "https://www.isc.org/downloads/bind", 1310720,
     ["/usr/bin/dig", "/usr/bin/host", "/usr/bin/nslookup"], ["glibc", "bind-libs"]),
]

# (name, version, release, arch, repo, summary, size, requires)
AVAILABLE = [
    ("httpd", "2.4.53", "7.el9", "x86_64", APPSTREAM,
     "Apache HTTP Server", 4874240,
     ["apr", "apr-util", "httpd-core", "httpd-filesystem", "mod_http2"]),
    ("mariadb-server", "10.5.16", "2.el9", "x86_64", APPSTREAM,
     "The MariaDB server and related files", 27262976,
     ["mariadb", "mariadb-common", "perl-DBI"]),
    ("php", "8.0.20", "1.el9", "x86_64", APPSTREAM,
     "PHP scripting language for creating dynamic web sites", 4194304,
     ["php-common", "php-cli"]),
    ("nmap", "7.92", "1.el9", "x86_64", APPSTREAM,
     "Network exploration tool and security scanner", 25165824,
     ["nmap-ncat", "libpcap"]),
    ("wget", "1.21.1", "7.el9", "x86_64", APPSTREAM,
     "A utility for retrieving files using the HTTP or FTP protocols", 2883584,
     ["glibc", "openssl-libs"]),
    ("tree", "1.8.0", "10.el9", "x86_64", BASEOS,
     "File system tree viewer", 106496, ["glibc"]),
    ("git", "2.31.1", "3.el9", "x86_64", APPSTREAM,
     "Fast Version Control System", 5242880,
     ["git-core", "perl-Git"]),
    ("zsh", "5.8", "9.el9", "x86_64", BASEOS,
     "Powerful interactive shell", 7340032, ["glibc", "ncurses-libs"]),
    ("tcpdump", "4.99.0", "6.el9", "x86_64", APPSTREAM,
     "A network traffic monitoring tool", 1310720, ["libpcap"]),
    ("rsync", "3.2.3", "9.el9", "x86_64", BASEOS,
     "A program for synchronizing files over a network", 1048576, ["glibc", "zstd"]),
    ("tmux", "3.2a", "4.el9", "x86_64", BASEOS,
     "A terminal multiplexer", 983040, ["glibc", "ncurses-libs"]),
    ("unzip", "6.0", "56.el9", "x86_64", BASEOS,
     "A utility for unpacking zip files", 401408, ["glibc"]),
    ("zip", "3.0", "33.el9", "x86_64", BASEOS,
     "A file compression and packaging utility compatible with PKZIP", 704512,
     ["glibc"]),
    ("iotop", "0.6", "27.el9", "noarch", APPSTREAM,
     "Top like utility for I/O", 131072, ["python3"]),
    ("screen", "4.8.0", "6.el9", "x86_64", APPSTREAM,
     "A screen manager that supports multiple logins on one terminal", 1048576,
     ["glibc", "ncurses-libs"]),
    ("xsane", "0.999", "45.el9", "x86_64", "lab-extras",
     "An X Window System front-end for the SANE scanner interface", 5242880,
     ["sane-backends"]),
    ("lab-toolkit", "1.4", "2.el9", "noarch", "lab-extras",
     "Classroom convenience scripts", 65536, ["bash"]),
]

DNF_GROUPS = [
    {"id": "development", "name": "Development Tools", "installed": False,
     "packages": ["autoconf", "automake", "binutils", "gcc", "gdb", "git", "make", "patch"]},
    {"id": "container-management", "name": "Container Management", "installed": False,
     "packages": ["buildah", "containernetworking-plugins", "podman", "skopeo"]},
    {"id": "system-tools", "name": "System Tools", "installed": True,
     "packages": ["lsof", "rsync", "screen", "tmux"]},
    {"id": "headless-management", "name": "Headless Management", "installed": False,
     "packages": ["cockpit", "realmd"]},
]

DNF_MODULES = [
    {"name": "php", "stream": "8.0", "default": True, "enabled": False,
     "profiles": ["common", "devel", "minimal"], "summary": "PHP scripting language"},
    {"name": "nodejs", "stream": "16", "default": True, "enabled": False,
     "profiles": ["common", "development", "minimal", "s2i"], "summary": "Javascript runtime"},
    {"name": "postgresql", "stream": "13", "default": True, "enabled": False,
     "profiles": ["client", "server"], "summary": "PostgreSQL server and client module"},
]

DNF_HISTORY = [
    {"id": 4, "command": "install vim-enhanced", "date": "2025-08-28 09:14",
     "action": "Install", "altered": 4},
    {"id": 3, "command": "update", "date": "2025-08-14 22:02",
     "action": "Upgrade", "altered": 37},
    {"id": 2, "command": "install mlocate", "date": "2025-07-30 11:47",
     "action": "Install", "altered": 1},
    {"id": 1, "command": "install", "date": "2025-07-12 06:31",
     "action": "Install", "altered": 412},
]

FLATPAK = {
    "remotes": [
        {"name": "flathub", "title": "Flathub", "url": "https://dl.flathub.org/repo/",
         "system": True},
    ],
    "installed": [
        {"id": "org.gnome.Calculator", "name": "Calculator", "version": "42.2",
         "branch": "stable", "origin": "flathub", "size": "18.4 MB",
         "summary": "Perform arithmetic, scientific or financial calculations"},
    ],
    "available": [
        {"id": "org.gimp.GIMP", "name": "GNU Image Manipulation Program",
         "version": "2.10.32", "branch": "stable", "origin": "flathub", "size": "1.1 GB",
         "summary": "Create images and edit photographs"},
        {"id": "org.videolan.VLC", "name": "VLC", "version": "3.0.17",
         "branch": "stable", "origin": "flathub", "size": "216.0 MB",
         "summary": "Play movies and songs"},
        {"id": "org.inkscape.Inkscape", "name": "Inkscape", "version": "1.2",
         "branch": "stable", "origin": "flathub", "size": "504.0 MB",
         "summary": "Vector graphics editor"},
        {"id": "com.gitlab.newsflash", "name": "NewsFlash", "version": "1.5.0",
         "branch": "stable", "origin": "flathub", "size": "24.8 MB",
         "summary": "Follow your favorite blogs and news sites"},
    ],
}


def build_packages():
    installed = []
    for (name, ver, rel, arch, repo, summary, lic, url, size, files, req) in INSTALLED:
        installed.append({
            "name": name, "version": ver, "release": rel, "arch": arch,
            "repo": repo, "summary": summary, "license": lic, "url": url,
            "size": size, "files": files, "requires": req,
            "installDate": "Tue 12 Jul 2025 06:31:%02d AM EDT" % rng.randrange(60),
            "sourceRpm": "%s-%s-%s.src.rpm" % (name, ver, rel),
            "signature": "RSA/SHA256, Wed 22 Jun 2025 10:02:11 AM EDT, Key ID 199e2f91fd431d51",
            "vendor": "Red Hat, Inc.",
            "description": summary + ".\n\nThis package is part of Red Hat Enterprise Linux 9.",
        })
    available = []
    for (name, ver, rel, arch, repo, summary, size, req) in AVAILABLE:
        available.append({
            "name": name, "version": ver, "release": rel, "arch": arch,
            "repo": repo, "summary": summary, "size": size, "requires": req,
            "license": "ASL 2.0" if name == "httpd" else "GPLv2+",
            "url": "https://www.example.com/%s" % name,
            "files": ["/usr/bin/" + name] if name in (
                "nmap", "wget", "tree", "git", "zsh", "tcpdump", "lsof", "rsync",
                "tmux", "unzip", "zip", "bzip2", "iotop", "screen", "php") else [],
            "description": summary + ".",
        })
    return {"repos": REPOS, "installed": installed, "available": available,
            "groups": DNF_GROUPS, "modules": DNF_MODULES, "history": DNF_HISTORY}


# ---------------------------------------------------------------------------
# systemd units, processes, network, storage
# ---------------------------------------------------------------------------

SERVICES = [
    ("sshd", "OpenSSH server daemon", "running", True, 1184),
    ("chronyd", "NTP client/server", "running", True, 921),
    ("NetworkManager", "Network Manager", "running", True, 873),
    ("firewalld", "firewalld - dynamic firewall daemon", "running", True, 902),
    ("crond", "Command Scheduler", "running", True, 1141),
    ("rsyslog", "System Logging Service", "running", True, 1139),
    ("auditd", "Security Auditing Service", "running", True, 812),
    ("atd", "Deferred execution scheduler", "stopped", False, None),
    ("dbus-broker", "D-Bus System Message Bus", "running", True, 860),
    ("systemd-journald", "Journal Service", "running", True, 720),
    ("getty@tty1", "Getty on tty1", "running", True, 1190),
    ("kdump", "Crash recovery kernel arming", "stopped", True, None),
]

PROCESSES = [
    (1, 0, "root", "?", "/usr/lib/systemd/systemd --switched-root --system --deserialize 31",
     "Ss", 0.1, 0.8, 11284, "08:12", "00:00:04"),
    (2, 0, "root", "?", "[kthreadd]", "S", 0.0, 0.0, 0, "08:12", "00:00:00"),
    (10, 2, "root", "?", "[rcu_sched]", "I", 0.0, 0.0, 0, "08:12", "00:00:01"),
    (720, 1, "root", "?", "/usr/lib/systemd/systemd-journald", "Ss", 0.0, 1.1, 18452, "08:12", "00:00:02"),
    (812, 1, "root", "?", "/sbin/auditd", "S<sl", 0.0, 0.3, 5124, "08:12", "00:00:00"),
    (860, 81, "dbus", "?", "/usr/bin/dbus-broker-launch --scope system", "Ss", 0.0, 0.2, 4012, "08:12", "00:00:00"),
    (873, 1, "root", "?", "/usr/sbin/NetworkManager --no-daemon", "Ssl", 0.0, 1.4, 22008, "08:12", "00:00:03"),
    (902, 1, "root", "?", "/usr/libexec/platform-python -s /usr/sbin/firewalld --nofork --nopid", "Ss", 0.0, 2.2, 34120, "08:12", "00:00:02"),
    (921, 995, "chrony", "?", "/usr/sbin/chronyd -F 2", "S", 0.0, 0.1, 3204, "08:12", "00:00:00"),
    (1139, 1, "root", "?", "/usr/sbin/rsyslogd -n", "Ssl", 0.0, 0.5, 8104, "08:12", "00:00:01"),
    (1141, 1, "root", "?", "/usr/sbin/crond -n", "Ss", 0.0, 0.2, 3712, "08:12", "00:00:00"),
    (1184, 1, "root", "?", "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups", "Ss", 0.0, 0.4, 6320, "08:12", "00:00:00"),
    (1190, 1, "root", "tty1", "/sbin/agetty -o -p -- \\u --noclear - linux", "Ss+", 0.0, 0.1, 2216, "08:12", "00:00:00"),
    (2418, 1184, "root", "?", "sshd: student [priv]", "Ss", 0.0, 0.5, 9840, "14:28", "00:00:00"),
    (2422, 2418, "student", "?", "sshd: student@pts/0", "S", 0.0, 0.3, 6604, "14:28", "00:00:00"),
    (2423, 2422, "student", "pts/0", "-bash", "Ss", 0.0, 0.2, 4488, "14:28", "00:00:00"),
    (2510, 1, "root", "?", "/usr/sbin/httpd -DFOREGROUND", "Ss", 0.0, 1.0, 15200, "14:30", "00:00:00"),
]
# httpd is not installed yet -- that process is dropped at load time unless the
# package is there, so the image stays self-consistent after `dnf remove`.

NETWORK = {
    "interfaces": [
        {"name": "lo", "state": "UNKNOWN", "mac": "00:00:00:00:00:00", "mtu": 65536,
         "addrs": [{"family": "inet", "address": "127.0.0.1", "prefix": 8, "scope": "host"},
                   {"family": "inet6", "address": "::1", "prefix": 128, "scope": "host"}],
         "flags": "LOOPBACK,UP,LOWER_UP"},
        {"name": "ens3", "state": "UP", "mac": "52:54:00:00:fa:0a", "mtu": 1500,
         "addrs": [{"family": "inet", "address": "172.25.250.10", "prefix": 24, "scope": "global",
                    "broadcast": "172.25.250.255", "label": "ens3"},
                   {"family": "inet6", "address": "fe80::5054:ff:fe00:fa0a", "prefix": 64,
                    "scope": "link"}],
         "flags": "BROADCAST,MULTICAST,UP,LOWER_UP",
         "rx": {"bytes": 148238, "packets": 1204, "errors": 0, "dropped": 0},
         "tx": {"bytes": 96412, "packets": 842, "errors": 0, "dropped": 0}},
    ],
    "routes": [
        {"dest": "default", "via": "172.25.250.254", "dev": "ens3", "proto": "static", "metric": 100},
        {"dest": "172.25.250.0/24", "dev": "ens3", "proto": "kernel", "scope": "link",
         "src": "172.25.250.10", "metric": 100},
    ],
    "dns": ["172.25.250.254"],
    "search": ["lab.example.com", "example.com"],
    "connections": [
        {"name": "ens3", "uuid": "e6d2f1ac-4b3f-4d2a-9d54-1f8ba9c35b71",
         "type": "ethernet", "device": "ens3", "autoconnect": True, "active": True,
         "method": "manual", "address": "172.25.250.10/24", "gateway": "172.25.250.254",
         "dns": ["172.25.250.254"]},
    ],
    "listening": [
        {"proto": "tcp", "local": "0.0.0.0:22", "peer": "0.0.0.0:*", "process": 'users:(("sshd",pid=1184,fd=3))'},
        {"proto": "tcp", "local": "[::]:22", "peer": "[::]:*", "process": 'users:(("sshd",pid=1184,fd=4))'},
        {"proto": "udp", "local": "127.0.0.1:323", "peer": "0.0.0.0:*", "process": 'users:(("chronyd",pid=921,fd=5))'},
    ],
    "hosts": [
        {"ip": "127.0.0.1", "names": ["localhost", "localhost.localdomain"]},
        {"ip": "::1", "names": ["localhost", "localhost.localdomain"]},
        {"ip": "172.25.250.10", "names": ["servera.lab.example.com", "servera"]},
        {"ip": "172.25.250.11", "names": ["serverb.lab.example.com", "serverb"]},
        {"ip": "172.25.250.254", "names": ["classroom.example.com", "classroom"]},
    ],
    "reachable": ["172.25.250.10", "172.25.250.11", "172.25.250.254",
                  "servera", "servera.lab.example.com", "serverb",
                  "serverb.lab.example.com", "classroom.example.com", "localhost"],
}

BLOCK_DEVICES = [
    {"name": "sda", "size": "20G", "type": "disk", "rm": False, "ro": False,
     "children": [
         {"name": "sda1", "size": "1G", "type": "part", "fstype": "xfs",
          "label": "boot", "uuid": "b1f4f9e3-5b2a-4a8c-9f7d-2c1e8a6d4b30",
          "mountpoint": "/boot"},
         {"name": "sda2", "size": "19G", "type": "part", "fstype": "xfs",
          "label": "root", "uuid": "0c3f7a91-8e6b-4c25-b3a7-9d51e2f84c6a",
          "mountpoint": "/"},
     ]},
    {"name": "sdb", "size": "2G", "type": "disk", "rm": True, "ro": False,
     "children": [
         {"name": "sdb1", "size": "2G", "type": "part", "fstype": "vfat",
          "label": "FIELDDATA", "uuid": "A1B2-C3D4", "mountpoint": None},
     ]},
    {"name": "sr0", "size": "1024M", "type": "rom", "rm": True, "ro": True,
     "fstype": None, "label": None, "uuid": None, "mountpoint": None},
]

MOUNTS = [
    {"source": "/dev/sda2", "fstype": "xfs", "size": 19923452, "used": 4128816,
     "avail": 15794636, "target": "/"},
    {"source": "/dev/sda1", "fstype": "xfs", "size": 1038336, "used": 231424,
     "avail": 806912, "target": "/boot"},
    {"source": "devtmpfs", "fstype": "devtmpfs", "size": 4096, "used": 0,
     "avail": 4096, "target": "/dev"},
    {"source": "tmpfs", "fstype": "tmpfs", "size": 1918292, "used": 0,
     "avail": 1918292, "target": "/dev/shm"},
    {"source": "tmpfs", "fstype": "tmpfs", "size": 767320, "used": 9204,
     "avail": 758116, "target": "/run"},
    {"source": "tmpfs", "fstype": "tmpfs", "size": 383656, "used": 0,
     "avail": 383656, "target": "/run/user/1000"},
]

# Removable media lives here until the learner mounts it (chapter 14).
REMOVABLE_CONTENT = {
    "readings.csv": "station,date,depth_m,temp_c\nNR-01,2025-07-02,1.5,18.4\n"
                    "NR-01,2025-07-02,6.0,14.1\nNR-02,2025-07-03,1.5,19.2\n"
                    "NR-02,2025-07-03,6.0,13.8\nNR-03,2025-07-05,1.5,17.9\n",
    "notes.txt": "Field notes, Northreach survey\nSonde recalibrated 2025-07-03.\n"
                 "Station NR-03 buoy adrift; position approximate.\n",
    "photos": {"site-01.jpg": "(binary image data)\n",
               "site-02.jpg": "(binary image data)\n"},
}


# ---------------------------------------------------------------------------
# The filesystem
# ---------------------------------------------------------------------------

def d(entries=None, mode=None, user=None, group=None, mtime=None):
    node = {"type": "dir", "entries": entries or {}}
    if mode:
        node["mode"] = mode
    if user:
        node["user"] = user
    if group:
        node["group"] = group
    if mtime:
        node["mtime"] = mtime
    return node


def f(text, mode=None, user=None, group=None, mtime=None):
    node = {"type": "file", "text": text}
    if mode:
        node["mode"] = mode
    if user:
        node["user"] = user
    if group:
        node["group"] = group
    if mtime:
        node["mtime"] = mtime
    return node


def link(target):
    return {"type": "symlink", "target": target}


def hard(to):
    return {"type": "hardlink", "to": to}


def synth(gen, mode=None):
    node = {"type": "synth", "gen": gen}
    if mode:
        node["mode"] = mode
    return node


def bindir(names, mode="0755"):
    """A directory of executables -- one small stub file per command name."""
    return d({n: f("(ELF 64-bit executable)\n", mode=mode) for n in sorted(names)})


# Every command the shell implements has to exist on disk, or `which`, `ls
# /usr/bin` and `rpm -qf` would disagree with what actually runs.
USR_BIN = [
    "apropos", "awk", "basename", "bash", "blkid", "bunzip2", "bzcat", "bzip2",
    "cat", "chage", "chgrp", "chmod", "clear",
    "chown", "chronyc", "cmp", "comm", "cp", "crontab", "cut", "date", "df",
    "diff", "dig",
    "dirname", "dnf", "dnf-3", "domainname", "du", "echo", "egrep", "env", "false",
    "fgrep", "file", "find", "findmnt", "firewall-cmd", "flatpak", "flock", "free",
    "gpasswd",
    "fuser", "gawk", "getent", "grep", "groups", "gtar", "gunzip", "gzip", "head",
    "hexdump", "host", "hostname", "hostnamectl", "id", "infocmp", "journalctl",
    "kill", "killall", "last", "lastlog", "ldd", "less", "lesspipe.sh", "ln",
    "locale", "logname",
    "locate", "loginctl", "logger", "ls", "lsblk", "lscpu", "lsof", "man", "mandb",
    "md5sum", "mkdir", "more", "mount", "mv", "nano", "newgrp", "nice", "nl",
    "nmcli", "nohup", "nslookup", "passwd", "paste", "pgrep", "ping", "pkill",
    "pmap",
    "printf", "ps", "pstree", "pwd", "python3", "python3.9", "readlink", "realpath",
    "renice", "reset", "rev", "rm", "rmdir", "rpm", "rpm2cpio", "rpmkeys",
    "rsync", "scp",
    "sed", "seq", "sftp", "sh", "sha256sum", "sleep", "sort", "split", "ssh",
    "ssh-add", "ssh-agent", "ssh-copy-id", "ssh-keygen", "stat", "su", "sudo",
    "sum", "systemctl", "tac", "tail", "tar", "tee", "timedatectl", "top",
    "touch", "vmstat",
    "tput", "tr", "tracepath", "true", "umount", "uname", "uniq", "updatedb",
    "uptime", "users", "vi", "vim", "vimdiff", "w", "watch", "wc", "whatis",
    "whereis", "which", "who", "whoami", "xargs", "yes", "yum", "zcat",
]
USR_SBIN = [
    "NetworkManager", "arping", "auditd", "ausearch", "chronyd", "crond",
    "firewalld", "groupadd", "groupdel", "groupmod", "ip", "rsyslogd", "shutdown",
    "ss", "sshd", "subscription-manager", "useradd", "userdel", "usermod",
    "visudo",
]

OS_RELEASE = """NAME="Red Hat Enterprise Linux"
VERSION="9.0 (Plow)"
ID="rhel"
ID_LIKE="fedora"
VERSION_ID="9.0"
PLATFORM_ID="platform:el9"
PRETTY_NAME="Red Hat Enterprise Linux 9.0 (Plow)"
ANSI_COLOR="0;31"
LOGO="fedora-logo-icon"
CPE_NAME="cpe:/o:redhat:enterprise_linux:9::baseos"
HOME_URL="https://www.redhat.com/"
DOCUMENTATION_URL="https://access.redhat.com/documentation/red_hat_enterprise_linux/9/"
BUG_REPORT_URL="https://bugzilla.redhat.com/"

REDHAT_BUGZILLA_PRODUCT="Red Hat Enterprise Linux 9"
REDHAT_BUGZILLA_PRODUCT_VERSION=9.0
REDHAT_SUPPORT_PRODUCT="Red Hat Enterprise Linux"
REDHAT_SUPPORT_PRODUCT_VERSION="9.0"
"""

FSTAB = """
#
# /etc/fstab
# Created by anaconda on Tue Jul 12 06:22:41 2025
#
# Accessible filesystems, by reference, are maintained under '/dev/disk/'.
# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info.
#
UUID=0c3f7a91-8e6b-4c25-b3a7-9d51e2f84c6a /                       xfs     defaults        0 0
UUID=b1f4f9e3-5b2a-4a8c-9f7d-2c1e8a6d4b30 /boot                   xfs     defaults        0 0
"""

SSHD_CONFIG = """#	$OpenBSD: sshd_config,v 1.104 2021/07/02 05:11:21 dtucker Exp $

Port 22
#AddressFamily any
#ListenAddress 0.0.0.0

HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key

PermitRootLogin yes
#StrictModes yes
#MaxAuthTries 6

PubkeyAuthentication yes
AuthorizedKeysFile	.ssh/authorized_keys

PasswordAuthentication yes
PermitEmptyPasswords no

X11Forwarding yes
#PrintMotd yes

Subsystem	sftp	/usr/libexec/openssh/sftp-server
"""

SUDOERS = """## Allow root to run any commands anywhere
root	ALL=(ALL) 	ALL

## Allows people in group wheel to run all commands
%wheel	ALL=(ALL)	ALL

## Read drop-in files from /etc/sudoers.d
#includedir /etc/sudoers.d
"""

LOGIN_DEFS = """MAIL_DIR	/var/spool/mail

UMASK		022
HOME_MODE	0700

PASS_MAX_DAYS	99999
PASS_MIN_DAYS	0
PASS_MIN_LEN	5
PASS_WARN_AGE	7

UID_MIN                  1000
UID_MAX                 60000
SYS_UID_MIN               201
SYS_UID_MAX               999

GID_MIN                  1000
GID_MAX                 60000
SYS_GID_MIN               201
SYS_GID_MAX               999

CREATE_HOME	yes
USERGROUPS_ENAB yes
ENCRYPT_METHOD SHA512
"""

BASHRC_USER = """# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# User specific environment
if ! [[ "$PATH" =~ "$HOME/.local/bin:$HOME/bin:" ]]; then
	PATH="$HOME/.local/bin:$HOME/bin:$PATH"
fi
export PATH

# User specific aliases and functions
alias ll='ls -l'
alias la='ls -A'
alias l.='ls -d .*'
"""

# --- practice data -----------------------------------------------------------

EMPLOYEES_CSV = """id,name,department,title,hire_date,salary
1001,Marisol Vance,Operations,Site Lead,2016-03-14,78500
1002,Dev Okonjo,Operations,Technician,2017-01-09,61250
1003,Priya Raghavan,Engineering,Engineer II,2018-07-02,84300
1004,Tomas Kerrigan,Support,Analyst,2019-04-22,52750
1005,Nadia Belmonte,Engineering,Engineer I,2019-11-19,71900
1006,Owen Strand,Support,Analyst,2020-06-15,53400
1007,Hazel Quintero,Operations,Technician,2021-05-08,60100
1008,Rafael Ibarra,Engineering,Engineer II,2021-09-27,86250
1009,June Whitlock,Support,Lead Analyst,2023-01-23,67800
1010,Camden Fowler,Operations,Technician,2023-08-14,59750
1011,Simone Adeyemi,Engineering,Engineer III,2024-02-05,98200
1012,Bruno Castellanos,Support,Analyst,2024-10-21,51300
"""

INVENTORY_TXT = """PART      DESCRIPTION            QTY   UNIT    LOCATION
HX-1180   Hex bolt 10mm          420   each    A1
HX-1181   Hex bolt 12mm          315   each    A1
WS-2040   Washer set             180   pack    A2
NT-3310   Lock nut 10mm          610   each    A3
NT-3311   Lock nut 12mm          275   each    A3
PL-4102   Poly liner 2m          45    roll    B1
PL-4103   Poly liner 4m          22    roll    B1
SB-5501   Steel bracket L        96    each    B2
SB-5502   Steel bracket T        58    each    B2
GK-6600   Gasket kit             140   kit     C1
GK-6601   Gasket kit heavy       35    kit     C1
CB-7720   Cable tie 200mm        1250  bag     C2
"""

ACCESS_LOG_PATHS = ["/index.html", "/about.html", "/images/logo.png", "/api/status",
                    "/api/report", "/admin/login", "/docs/setup.pdf", "/favicon.ico",
                    "/contact.php", "/search.php"]
ACCESS_LOG_IPS = ["172.25.250.11", "172.25.250.14", "172.25.250.23", "10.0.2.15",
                  "192.168.4.72", "172.25.250.11", "172.25.250.44"]


def make_access_log(lines=60):
    out = []
    minute = 0
    for i in range(lines):
        ip = ACCESS_LOG_IPS[rng.randrange(len(ACCESS_LOG_IPS))]
        path = ACCESS_LOG_PATHS[rng.randrange(len(ACCESS_LOG_PATHS))]
        status = rng.choice([200, 200, 200, 200, 200, 301, 304, 404, 404, 500])
        size = rng.randrange(180, 48000)
        minute += rng.randrange(1, 6)
        hh, mm = 8 + minute // 60, minute % 60
        out.append('%s - - [14/Sep/2025:%02d:%02d:%02d -0400] "GET %s HTTP/1.1" %d %d'
                   % (ip, hh, mm, rng.randrange(60), path, status, size))
    return "\n".join(out) + "\n"


def make_secure_log():
    out = []
    users = ["student", "operator1", "admin", "oracle", "test", "root", "operator2"]
    minute = 0
    for i in range(40):
        minute += rng.randrange(1, 9)
        hh, mm = 8 + minute // 60, minute % 60
        stamp = "Sep 14 %02d:%02d:%02d servera" % (hh, mm, rng.randrange(60))
        who = users[rng.randrange(len(users))]
        ip = ACCESS_LOG_IPS[rng.randrange(len(ACCESS_LOG_IPS))]
        roll = rng.random()
        if roll < 0.45:
            out.append("%s sshd[%d]: Failed password for %s%s from %s port %d ssh2"
                       % (stamp, rng.randrange(2000, 3000),
                          "invalid user " if who in ("admin", "oracle", "test") else "",
                          who, ip, rng.randrange(40000, 60000)))
        elif roll < 0.7:
            out.append("%s sshd[%d]: Accepted password for %s from %s port %d ssh2"
                       % (stamp, rng.randrange(2000, 3000), who, ip, rng.randrange(40000, 60000)))
        elif roll < 0.85:
            out.append("%s sudo[%d]: %s : TTY=pts/0 ; PWD=/home/%s ; USER=root ; COMMAND=/usr/bin/%s"
                       % (stamp, rng.randrange(2000, 3000), who, who,
                          rng.choice(["systemctl status sshd", "dnf install tree",
                                      "useradd operator4", "cat /var/log/messages"])))
        else:
            out.append("%s sshd[%d]: Invalid user %s from %s port %d"
                       % (stamp, rng.randrange(2000, 3000), who, ip, rng.randrange(40000, 60000)))
    return "\n".join(out) + "\n"


def make_messages_log():
    out = []
    units = [("systemd", "Started Session %d of user student."),
             ("chronyd", "Selected source 172.25.250.254"),
             ("NetworkManager", "<info>  [16] device (ens3): state change: activated"),
             ("kernel", "SELinux:  Permission audit_read in class capability2 not defined"),
             ("systemd", "Starting dnf makecache..."),
             ("dnf", "Metadata cache created."),
             ("crond", "(CRON) INFO (running with inotify support)"),
             ("systemd", "Reached target Multi-User System.")]
    minute = 0
    for i in range(45):
        minute += rng.randrange(2, 14)
        hh, mm = 8 + minute // 60, minute % 60
        unit, msg = units[rng.randrange(len(units))]
        if "%d" in msg:
            msg = msg % rng.randrange(1, 40)
        out.append("Sep 14 %02d:%02d:%02d servera %s[%d]: %s"
                   % (hh, mm, rng.randrange(60), unit, rng.randrange(400, 2600), msg))
    return "\n".join(out) + "\n"


POEM = """the road was there before the map
and will be there when the map is gone
the map is a rumor the road repeats
the road is a rumor the walking confirms

count the steps if you like
the road does not count them
the road keeps no ledger
the walking is the ledger
"""

FRUIT = """apple
apple
banana
cherry
cherry
cherry
date
elderberry
fig
fig
grape
"""

NUMBERS = "42\n7\n115\n3\n88\n23\n9\n460\n56\n7\n1024\n12\n"

HOSTS_TXT = """servera.lab.example.com   172.25.250.10   web
serverb.lab.example.com   172.25.250.11   db
serverc.lab.example.com   172.25.250.12   web
serverd.lab.example.com   172.25.250.13   cache
workstation.lab.example.com 172.25.250.9  desktop
classroom.example.com     172.25.250.254  gateway
"""

SERVICES_TXT = """# service  port   protocol  owner
ssh        22     tcp       networking
http       80     tcp       webteam
https      443    tcp       webteam
mysql      3306   tcp       dbteam
postgres   5432   tcp       dbteam
ntp        123    udp       networking
dns        53     udp       networking
smtp       25     tcp       mailteam
"""

README_LAB = """Practice files for ITN 170
==========================

  files/   creating, copying, moving and removing -- and shell expansions
  text/    redirection, pipes, grep, sed, awk, sort, cut
  perms/   permissions, ownership and umask
  links/   hard links and symbolic links
  survey/  a small directory tree for find and du

Nothing here matters. Break it, then hit Reset.
"""

SURVEY_NOTE = "Depth sounding, Northreach basin. Sonde s/n 44-1182.\n"


def survey_tree():
    """A few levels deep, with varied sizes and dates, for find and du."""
    sites = {}
    for site in range(1, 5):
        days = {}
        for day in range(1, 4):
            files = {
                "sonde.csv": f("station,depth_m,temp_c\nNR-%02d,1.5,%.1f\nNR-%02d,6.0,%.1f\n"
                               % (site, 18 + rng.random() * 3, site, 12 + rng.random() * 3)),
                "notes.txt": f(SURVEY_NOTE),
            }
            if day == 2:
                files["photo.jpg"] = f("(binary image data)\n" * 40)
            if site == 3 and day == 3:
                files["anomaly.log"] = f("WARN buoy adrift\nWARN position approximate\n"
                                         "ERROR sonde timeout after 4 retries\n")
            days["day-%02d" % day] = d(files)
        sites["site-%02d" % site] = d(days)
    return d(sites)


def files_dir():
    """Deliberately shaped for globbing and brace expansion drills."""
    entries = {}
    for i in range(1, 6):
        entries["report%d.txt" % i] = f("Quarterly report, part %d.\n" % i)
    for name in ("index.php", "about.php", "contact.php"):
        entries[name] = f("<?php\n// %s\necho \"placeholder\";\n?>\n" % name)
    for name in ("notes.md", "notes.txt", "notes.bak"):
        entries[name] = f("Working notes.\n")
    for month in ("jan", "feb", "mar"):
        entries["log-2025-%s.txt" % month] = f("entries for %s\n" % month)
    entries["archive.tar"] = f("(tar archive)\n")
    entries["draft.odt"] = f("(document)\n")
    entries["image01.png"] = f("(binary image data)\n")
    entries["image02.png"] = f("(binary image data)\n")
    entries["script.sh"] = f("#!/bin/bash\necho \"hello from script.sh\"\n", mode="0755")
    entries["data.csv"] = f("a,b,c\n1,2,3\n4,5,6\n")
    entries[".hidden.txt"] = f("You found the hidden file.\n")
    entries["spaced name.txt"] = f("Quoting matters.\n")
    entries["old"] = d({"retired-2019.txt": f("archived\n"),
                        "retired-2020.txt": f("archived\n")})
    return d(entries)


def perms_dir():
    """Every mode the chapter 11 exercises need to read, set or fix."""
    return d({
        "public.txt": f("Anyone may read this.\n", mode="0644"),
        "team.txt": f("Group members may write this.\n", mode="0664", group="techdocs"),
        "private.txt": f("Only the owner may read this.\n", mode="0600"),
        "secret.txt": f("Owned by root, readable by root only.\n",
                        mode="0600", user="root", group="root"),
        "runme.sh": f("#!/bin/bash\necho \"it ran\"\n", mode="0700"),
        "noexec.sh": f("#!/bin/bash\necho \"this one is not executable yet\"\n", mode="0644"),
        "readonly.conf": f("mode = 0444\n", mode="0444"),
        "shared": d({"team-notes.txt": f("Shared working notes.\n", group="techdocs")},
                    mode="2775", group="techdocs"),
        "dropbox": d({}, mode="1777", user="root", group="root"),
        "locked": d({"inside.txt": f("You need +x on the directory to reach this.\n")},
                    mode="0600"),
    })


def links_dir():
    return d({
        "original.txt": f("The one real file. Hard links share this content.\n"),
        "hardlink.txt": hard("/home/student/labs/links/original.txt"),
        "softlink.txt": link("original.txt"),
        "broken.txt": link("gone.txt"),
        "etc-shortcut": link("/etc"),
    })


def text_dir():
    return d({
        "employees.csv": f(EMPLOYEES_CSV),
        "inventory.txt": f(INVENTORY_TXT),
        "access.log": f(make_access_log()),
        "poem.txt": f(POEM),
        "fruit.txt": f(FRUIT),
        "numbers.txt": f(NUMBERS),
        "hosts.txt": f(HOSTS_TXT),
        "services.txt": f(SERVICES_TXT),
        "empty.txt": f(""),
    })


def home_student():
    return d({
        ".bash_profile": f("# .bash_profile\n\nif [ -f ~/.bashrc ]; then\n\t. ~/.bashrc\nfi\n"),
        ".bashrc": f(BASHRC_USER),
        ".bash_logout": f("# ~/.bash_logout\n"),
        ".bash_history": f("ls -l\ncd /etc\ncat os-release\nexit\n", mode="0600"),
        ".ssh": d({"known_hosts": f("servera.lab.example.com ssh-ed25519 "
                                    "AAAAC3NzaC1lZDI1NTE5AAAAIL7qQ1xX8h0K3q2n9mQ4bV1tZ\n",
                                    mode="0644")}, mode="0700"),
        "Documents": d({
            "todo.txt": f("- finish chapter 11 lab\n- read man chmod\n- practice awk\n"),
            "meeting-notes.txt": f("Standup 2025-09-12\nAction: rotate the survey logs.\n"),
        }),
        "Downloads": d({}),
        "bin": d({}),
        "labs": d({
            "README": f(README_LAB),
            "files": files_dir(),
            "text": text_dir(),
            "perms": perms_dir(),
            "links": links_dir(),
            "survey": survey_tree(),
        }),
    }, mode="0700")


def build_fs():
    etc = {
        "passwd": synth("passwd"),
        "shadow": synth("shadow", mode="0000"),
        "group": synth("group"),
        "gshadow": synth("gshadow", mode="0000"),
        "hostname": f(HOSTNAME + "\n"),
        "hosts": synth("hosts"),
        "resolv.conf": synth("resolv"),
        "os-release": f(OS_RELEASE),
        "redhat-release": f("Red Hat Enterprise Linux release 9.0 (Plow)\n"),
        "system-release": link("redhat-release"),
        "fstab": f(FSTAB),
        "crontab": f("SHELL=/bin/bash\nPATH=/sbin:/bin:/usr/sbin:/usr/bin\nMAILTO=root\n"),
        "login.defs": f(LOGIN_DEFS),
        "shells": f("/bin/sh\n/bin/bash\n/usr/bin/sh\n/usr/bin/bash\n/bin/tcsh\n/bin/csh\n"),
        "sudoers": f(SUDOERS, mode="0440"),
        "sudoers.d": d({"student": f("student ALL=(ALL) ALL\n", mode="0440")}, mode="0750"),
        "bashrc": f("# /etc/bashrc\n\numask 022\n"),
        "profile": f("# /etc/profile\n\nexport PATH\nexport HISTSIZE=1000\n"),
        "profile.d": d({"bash_completion.sh": f("# bash completion\n"),
                        "lang.sh": f("export LANG=en_US.UTF-8\n")}),
        "motd": f(""),
        "issue": f("\\S\nKernel \\r on an \\m\n\n"),
        "skel": d({
            ".bash_profile": f("# .bash_profile\n\nif [ -f ~/.bashrc ]; then\n\t. ~/.bashrc\nfi\n"),
            ".bashrc": f("# .bashrc\n\nif [ -f /etc/bashrc ]; then\n\t. /etc/bashrc\nfi\n"),
            ".bash_logout": f("# ~/.bash_logout\n"),
        }),
        "default": d({"useradd": f("GROUP=100\nHOME=/home\nINACTIVE=-1\nEXPIRE=\n"
                                   "SHELL=/bin/bash\nSKEL=/etc/skel\nCREATE_MAIL_SPOOL=yes\n")}),
        "ssh": d({
            "sshd_config": f(SSHD_CONFIG, mode="0600"),
            "ssh_config": f("Host *\n\tGSSAPIAuthentication yes\n\tForwardX11Trusted yes\n"),
            "ssh_host_rsa_key": f("-----BEGIN OPENSSH PRIVATE KEY-----\n(redacted)\n"
                                  "-----END OPENSSH PRIVATE KEY-----\n", mode="0640", group="ssh_keys"),
            "ssh_host_rsa_key.pub": f("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC9r1 root@servera\n"),
            "ssh_host_ed25519_key": f("-----BEGIN OPENSSH PRIVATE KEY-----\n(redacted)\n"
                                      "-----END OPENSSH PRIVATE KEY-----\n", mode="0640", group="ssh_keys"),
            "ssh_host_ed25519_key.pub": f("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL7qQ1 root@servera\n"),
            "ssh_host_ecdsa_key.pub": f("ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAy root@servera\n"),
        }),
        "yum.repos.d": d({
            "redhat.repo": f("# Managed by subscription-manager. Do not edit by hand.\n"),
            "lab-extras.repo": f("[lab-extras]\nname=Classroom Extra Packages\n"
                                 "baseurl=http://content.example.com/rhel9.0/x86_64/lab-extras\n"
                                 "enabled=0\ngpgcheck=1\n"
                                 "gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-classroom\n"),
        }),
        "dnf": d({"dnf.conf": f("[main]\ngpgcheck=1\ninstallonly_limit=3\n"
                                "clean_requirements_on_remove=True\nbest=True\nskip_if_unavailable=False\n")}),
        "systemd": d({"system": d({}), "system.conf": f("# systemd system.conf\n")}),
        "selinux": d({"config": f("SELINUX=enforcing\nSELINUXTYPE=targeted\n")}),
        "chrony.conf": f("pool 2.rhel.pool.ntp.org iburst\ndriftfile /var/lib/chrony/drift\n"
                         "makestep 1.0 3\nrtcsync\nlogdir /var/log/chrony\n"),
        "rsyslog.conf": f("# rsyslog configuration file\n\n*.info;mail.none;authpriv.none;cron.none"
                          "                /var/log/messages\nauthpriv.*"
                          "                                              /var/log/secure\n"),
        "nanorc": f("# /etc/nanorc\nset autoindent\n"),
        "man_db.conf": f("# /etc/man_db.conf\nMANPATH_MAP /usr/bin /usr/share/man\n"),
        "updatedb.conf": f("PRUNE_BIND_MOUNTS = \"yes\"\nPRUNEFS = \"9p afs autofs\"\n"),
        "NetworkManager": d({"NetworkManager.conf": f("[main]\nplugins=ifcfg-rh\n"),
                             "system-connections": d({}, mode="0700")}),
        "firewalld": d({"firewalld.conf": f("DefaultZone=public\n")}),
        "audit": d({"auditd.conf": f("log_file = /var/log/audit/audit.log\n")}, mode="0750"),
        "iproute2": d({"rt_tables": f("255\tlocal\n254\tmain\n253\tdefault\n")}),
        "flatpak": d({"remotes.d": d({})}),
        "pki": d({"rpm-gpg": d({"RPM-GPG-KEY-redhat-release": f("(gpg public key)\n")})}),
    }

    var = {
        "log": d({
            "messages": f(make_messages_log(), mode="0600", user="root"),
            "secure": f(make_secure_log(), mode="0600", user="root"),
            "boot.log": f("[  OK  ] Started OpenSSH server daemon.\n"
                          "[  OK  ] Reached target Multi-User System.\n", mode="0600"),
            "dnf.log": f("2025-08-28T09:14:02-0400 INFO --- logging initialized ---\n"
                         "2025-08-28T09:14:05-0400 INFO Installed: vim-enhanced-8.2.2637-20.el9.x86_64\n"),
            "cron": f("Sep 14 08:01:01 servera CROND[2201]: (root) CMD (run-parts /etc/cron.hourly)\n",
                      mode="0600"),
            "lastlog": f("(binary accounting data)\n", mode="0644"),
            "wtmp": f("(binary accounting data)\n", mode="0664", group="utmp"),
            "audit": d({"audit.log": f("type=DAEMON_START msg=audit(1757851932.104:2262)\n",
                                       mode="0600")}, mode="0700"),
            "chrony": d({}, user="chrony", group="chrony"),
        }),
        "tmp": d({}, mode="1777"),
        "spool": d({"mail": d({"student": f("", mode="0660", user="student", group="mail")},
                              mode="0775", group="mail"),
                    "cron": d({}, mode="0700"),
                    "at": d({}, mode="0700")}),
        "lib": d({"rpm": d({"rpmdb.sqlite": f("(rpm database)\n")}),
                  "mlocate": d({"mlocate.db": f("(locate database)\n", mode="0640", group="slocate")}),
                  "chrony": d({"drift": f("0.0 0.0\n")}, user="chrony", group="chrony"),
                  "dnf": d({})}),
        "www": d({"html": d({"index.html": f("<html><body><h1>servera</h1></body></html>\n")})}),
        "cache": d({"dnf": d({})}),
        "adm": d({}),
        "empty": d({}, mode="0555"),
    }

    root_entries = {
        "bin": link("usr/bin"),
        "sbin": link("usr/sbin"),
        "lib": link("usr/lib"),
        "lib64": link("usr/lib64"),
        "boot": d({
            "vmlinuz-5.14.0-70.13.1.el9_0.x86_64": f("(kernel image)\n", mode="0600"),
            "vmlinuz-5.14.0-70.22.1.el9_0.x86_64": f("(kernel image)\n", mode="0600"),
            "initramfs-5.14.0-70.22.1.el9_0.x86_64.img": f("(initramfs)\n", mode="0600"),
            "grub2": d({"grub.cfg": f("# grub config\n", mode="0600")}),
        }),
        "dev": d({
            "null": f("", mode="0666"),
            "zero": f("", mode="0666"),
            "random": f("", mode="0666"),
            "urandom": f("", mode="0666"),
            "tty": f("", mode="0666", group="tty"),
            "sda": f("", mode="0660", group="disk"),
            "sda1": f("", mode="0660", group="disk"),
            "sda2": f("", mode="0660", group="disk"),
            "sdb": f("", mode="0660", group="disk"),
            "sdb1": f("", mode="0660", group="disk"),
            "sr0": f("", mode="0660", group="cdrom"),
            "shm": d({}, mode="1777"),
            "pts": d({}),
        }),
        "etc": d(etc),
        "home": d({"student": home_student()}),
        "media": d({}),
        "mnt": d({}),
        "opt": d({}),
        "proc": d({
            "cpuinfo": f("processor\t: 0\nvendor_id\t: GenuineIntel\n"
                         "model name\t: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz\n"
                         "cpu MHz\t\t: 2394.374\ncache size\t: 35840 KB\n"),
            "meminfo": f("MemTotal:        3836584 kB\nMemFree:         2418112 kB\n"
                         "MemAvailable:    2903648 kB\nSwapTotal:       2097148 kB\n"
                         "SwapFree:        2097148 kB\n"),
            "uptime": f("23184.42 91203.18\n"),
            "version": f("Linux version 5.14.0-70.22.1.el9_0.x86_64 "
                         "(mockbuild@x86-vm-09.build.eng.bos.redhat.com)\n"),
            "mounts": synth("mounts"),
        }),
        "root": d({
            ".bashrc": f("# .bashrc\nalias rm='rm -i'\nalias cp='cp -i'\nalias mv='mv -i'\n"),
            ".bash_profile": f("# .bash_profile\n"),
            "anaconda-ks.cfg": f("# Generated by Anaconda\nlang en_US.UTF-8\n", mode="0600"),
        }, mode="0550", user="root", group="root"),
        "run": d({"log": d({}), "user": d({"1000": d({}, mode="0700", user="student",
                                                     group="student")})}),
        "srv": d({}),
        "sys": d({"class": d({"net": d({})})}),
        "tmp": d({"lab-scratch.txt": f("scratch space\n", user="student", group="student")},
                 mode="1777"),
        "usr": d({
            "bin": bindir(USR_BIN),
            "sbin": bindir(USR_SBIN),
            "lib": d({"systemd": d({"system": d({}), "systemd": f("(ELF)\n", mode="0755")})}),
            "lib64": d({"libc.so.6": f("(ELF shared object)\n", mode="0755")}),
            "local": d({"bin": d({}), "sbin": d({}), "share": d({}), "lib": d({}),
                        "etc": d({}), "src": d({})}),
            "share": d({
                "doc": d({}),
                "man": d({"man1": d({}), "man5": d({}), "man8": d({})}),
                "info": d({}),
                "empty.sshd": d({}, mode="0711"),
            }),
            "games": d({}),
            "libexec": d({"openssh": d({"sftp-server": f("(ELF)\n", mode="0755")})}),
        }),
        "var": d(var),
    }

    return d(root_entries)


# ---------------------------------------------------------------------------
# Journal entries, for `journalctl`
# ---------------------------------------------------------------------------

JOURNAL = [
    {"time": "Sep 14 08:12:01", "unit": "systemd", "pid": 1, "priority": 6,
     "message": "Starting OpenSSH server daemon..."},
    {"time": "Sep 14 08:12:01", "unit": "sshd", "pid": 1184, "priority": 6,
     "message": "Server listening on 0.0.0.0 port 22."},
    {"time": "Sep 14 08:12:01", "unit": "systemd", "pid": 1, "priority": 6,
     "message": "Started OpenSSH server daemon."},
    {"time": "Sep 14 08:12:02", "unit": "chronyd", "pid": 921, "priority": 6,
     "message": "Selected source 172.25.250.254"},
    {"time": "Sep 14 08:12:03", "unit": "firewalld", "pid": 902, "priority": 6,
     "message": "Started firewalld - dynamic firewall daemon."},
    {"time": "Sep 14 08:14:22", "unit": "kernel", "pid": None, "priority": 4,
     "message": "usb 1-1: new high-speed USB device number 2 using ehci-pci"},
    {"time": "Sep 14 08:14:22", "unit": "kernel", "pid": None, "priority": 6,
     "message": "sd 3:0:0:0: [sdb] Attached SCSI removable disk"},
    {"time": "Sep 14 09:02:10", "unit": "sshd", "pid": 2418, "priority": 6,
     "message": "Accepted password for student from 172.25.250.9 port 50122 ssh2"},
    {"time": "Sep 14 09:41:55", "unit": "sshd", "pid": 2501, "priority": 4,
     "message": "Failed password for invalid user admin from 192.168.4.72 port 51904 ssh2"},
    {"time": "Sep 14 10:15:07", "unit": "crond", "pid": 1141, "priority": 6,
     "message": "(root) CMD (run-parts /etc/cron.hourly)"},
    {"time": "Sep 14 11:30:44", "unit": "auditd", "pid": 812, "priority": 3,
     "message": "Audit daemon rotating log files"},
]

# ---------------------------------------------------------------------------

image = {
    "hostname": HOSTNAME,
    "shortHostname": HOSTNAME.split(".")[0],
    "now": NOW,
    "umask": "0022",
    "bootTime": "2025-09-14 08:12",
    "rootPassword": "redhat",
    "users": build_users(),
    "groups": build_groups(),
    "sudoers": ["student"],
    "packages": build_packages(),
    "flatpak": FLATPAK,
    "services": [{"name": n, "description": desc, "state": st,
                  "enabled": en, "pid": pid}
                 for n, desc, st, en, pid in SERVICES],
    "processes": [{"pid": p, "ppid": pp, "user": u, "tty": t, "cmd": c, "state": s,
                   "cpu": cpu, "mem": mem, "rss": rss, "start": start, "time": tm}
                  for p, pp, u, t, c, s, cpu, mem, rss, start, tm in PROCESSES],
    "network": NETWORK,
    "blockDevices": BLOCK_DEVICES,
    "mounts": MOUNTS,
    "removable": {"device": "/dev/sdb1", "label": "FIELDDATA",
                  "fstype": "vfat", "content": REMOVABLE_CONTENT},
    "journal": JOURNAL,
    "fs": build_fs(),
}

with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(image, fh, indent=1, ensure_ascii=False, sort_keys=False)
    fh.write("\n")


def count(node):
    if node.get("type") != "dir":
        return 1
    return 1 + sum(count(c) for c in node["entries"].values())


print("wrote", os.path.relpath(OUT, os.path.join(HERE, "..")))
print("  users=%d groups=%d installed=%d available=%d services=%d nodes=%d"
      % (len(image["users"]), len(image["groups"]),
         len(image["packages"]["installed"]), len(image["packages"]["available"]),
         len(image["services"]), count(image["fs"])))
print("  size=%.1f KB" % (os.path.getsize(OUT) / 1024.0))
