#!/usr/bin/env python3
"""
Turn the harvest into the shapes tools/build_box.py wants.

The harvest (tools/harvest/out/) is a faithful record of a real Rocky Linux 9
machine. This module is the one place that decides how much of it the practice
image actually carries, and where reality is deliberately adjusted.

Two adjustments, both on purpose:

  * **Repository names stay RHEL.** Rocky calls its repositories `baseos` and
    `appstream`; Red Hat calls them `rhel-9-for-x86_64-baseos-rpms` and
    `rhel-9-for-x86_64-appstream-rpms`. The course teaches the Red Hat names
    and an exam will ask for them, so Rocky stands in for package *contents*
    while the naming a student sees stays Red Hat's. Same for the vendor
    string.

  * **File lists are trimmed to /usr/bin, /usr/sbin and /etc.** The real
    machine owns 54,577 paths; 36,262 of them are under /usr/share (locale,
    documentation, icons). Carrying them all would add 4.5MB to an image that
    is deep-copied on every fork, to answer questions nobody asks. The 2,217
    that remain are what `rpm -qf`, `dnf provides`, `which` and `ls /usr/bin`
    are actually asked about.

If the harvest is missing, every function here returns None and build_box.py
falls back to its hand-written lists, so the build still works on a machine
with no Docker.
"""

import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

# Rocky's repository ids -> the Red Hat ones the course uses.
REPO_MAP = {
    "baseos": "rhel-9-for-x86_64-baseos-rpms",
    "appstream": "rhel-9-for-x86_64-appstream-rpms",
    "extras": "rhel-9-for-x86_64-appstream-rpms",
    "crb": "rhel-9-for-x86_64-appstream-rpms",
    "@System": "rhel-9-for-x86_64-baseos-rpms",
}
DEFAULT_REPO = "rhel-9-for-x86_64-baseos-rpms"

# Rocky stamps its rebuilds: `9.el9_8.rocky.0.1` where Red Hat ships
# `9.el9_8`. A student checking a version against Red Hat's errata would be
# confused by the suffix, so it comes off -- the same reasoning as the
# repository names.
ROCKY_SUFFIX = re.compile(r"\.rocky[\d.]*$")


def _release(value):
    return ROCKY_SUFFIX.sub("", value or "")

# The only path prefixes an image carries. See the module docstring.
KEEP_PREFIXES = ("/usr/bin/", "/usr/sbin/", "/etc/")

# The harvest container is deliberately over-provisioned: `tree`, `wget`, `git`
# and friends were installed *so that their man pages could be read*. The
# practice machine must not start with them, because installing them is the
# exercise -- a `dnf install tree` question grades on nothing if tree is
# already there.
#
# So these are demoted from installed to installable. They keep their real
# harvested version and summary, which is the point: the exercise is now
# against a package that genuinely exists at a version Red Hat really shipped.
INSTALL_TARGETS = {
    "httpd", "mariadb-server", "php", "nmap", "wget", "tree", "git", "zsh",
    "tcpdump", "rsync", "tmux", "unzip", "zip", "iotop", "screen",
}


def available_on_disk():
    """Is there a harvest to read?"""
    return os.path.isfile(os.path.join(OUT, "packages-installed.json"))


def _load(name):
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _repo_for(rocky_repo):
    return REPO_MAP.get((rocky_repo or "").lstrip("@"), DEFAULT_REPO)


def _files_by_package():
    """package -> sorted list of the paths we keep."""
    rows = _load("package-files.json") or []
    out = {}
    for row in rows:
        path = row.get("path", "")
        if not path.startswith(KEEP_PREFIXES):
            continue
        out.setdefault(row["package"], []).append(path)
    for paths in out.values():
        paths.sort()
    return out


def _requires_by_package():
    rows = _load("package-requires.json") or []
    out = {}
    for row in rows:
        dep = row.get("requires", "")
        # Versioned and capability requires (`libc.so.6(GLIBC_2.34)(64bit)`,
        # `config(bash)`) are noise for a course; keep plain package names.
        if not dep or "(" in dep or dep.startswith("/"):
            continue
        out.setdefault(row["package"], set()).add(dep)
    return {k: sorted(v) for k, v in out.items()}


def installed():
    """Every package on the real machine, in build_box.py's installed shape."""
    rows = _load("packages-installed.json")
    if rows is None:
        return None

    files = _files_by_package()
    requires = _requires_by_package()

    # Which repository each package came from, taken from the available
    # catalogue where it appears there.
    repo_of = {}
    for a in (_load("packages-available.json") or []):
        name = _split_nevra(a.get("nevra", ""))[0]
        if name and name not in repo_of:
            repo_of[name] = _repo_for(a.get("repo"))

    out = []
    for r in rows:
        name = r["name"]
        if name in INSTALL_TARGETS:
            continue                       # demoted -- see INSTALL_TARGETS
        try:
            size = int(r.get("size") or 0)
        except ValueError:
            size = 0
        out.append({
            "name": name,
            "version": r.get("version", ""),
            "release": _release(r.get("release", "")),
            "arch": r.get("arch", "x86_64"),
            "repo": repo_of.get(name, DEFAULT_REPO),
            "summary": r.get("summary", ""),
            "license": r.get("license", ""),
            "url": r.get("url", ""),
            "size": size,
            "files": files.get(name, []),
            "requires": requires.get(name, []),
        })
    out.sort(key=lambda p: p["name"])
    return out


def _split_nevra(nevra):
    """`tree.x86_64` or `tree-1.8.0-10.el9.x86_64` -> (name, arch)."""
    if not nevra:
        return "", "x86_64"
    if "." in nevra:
        base, _, arch = nevra.rpartition(".")
        return base, arch
    return nevra, "x86_64"


def catalogue():
    """
    The repository catalogue -- everything `dnf list available` can see.

    All 6,959 of them. This used to be unaffordable: assets/box.js deep-copied
    it on every fork and grading forks two or three times a question. It is
    now shared and frozen between forks, so the full catalogue costs nothing
    and `dnf search` can tell the truth.
    """
    rows = _load("packages-available.json")
    if rows is None:
        return None

    # `dnf list available` has no summary column, so they are harvested
    # separately with repoquery. Without them `dnf search` prints a package
    # name followed by an empty colon, which looks broken rather than terse.
    summaries = _load("summaries.json") or {}

    out = []
    seen = set()
    for r in rows:
        name, arch = _split_nevra(r.get("nevra", ""))
        if not name or name in seen:
            continue
        seen.add(name)
        version, _, release = (r.get("version") or "").partition("-")
        release = _release(release)
        out.append({
            "name": name,
            "version": version,
            "release": release,
            "arch": arch,
            "repo": _repo_for(r.get("repo")),
            "summary": summaries.get(name, ""),
            "size": 0,
            "requires": [],
        })
    # The demoted packages belong here instead, carrying the real version and
    # summary the harvest recorded for them.
    have = {p["name"] for p in out}
    for r in (_load("packages-installed.json") or []):
        name = r["name"]
        if name not in INSTALL_TARGETS or name in have:
            continue
        out.append({
            "name": name,
            "version": r.get("version", ""),
            "release": _release(r.get("release", "")),
            "arch": r.get("arch", "x86_64"),
            "repo": DEFAULT_REPO,
            "summary": r.get("summary", ""),
            "size": int(r.get("size") or 0) if str(r.get("size") or 0).isdigit() else 0,
            "requires": [],
        })

    out.sort(key=lambda p: p["name"])
    return out


def path_commands():
    """
    (usr_bin, usr_sbin) -- every command the real machine has on its PATH.

    The image carries all of them so `ls /usr/bin`, `which` and `rpm -qf`
    match a real system. The shell implements a fraction; the rest are present
    but refuse to run, which is the honest failure rather than pretending the
    file is not there.
    """
    rows = _load("package-files.json")
    if rows is None:
        return None, None
    usr_bin, usr_sbin = set(), set()
    for row in rows:
        path = row.get("path", "")
        if path.startswith("/usr/bin/") and path.count("/") == 3:
            usr_bin.add(path.rsplit("/", 1)[1])
        elif path.startswith("/usr/sbin/") and path.count("/") == 3:
            usr_sbin.add(path.rsplit("/", 1)[1])
    usr_bin.discard("")
    usr_sbin.discard("")
    return sorted(usr_bin), sorted(usr_sbin)


def summary():
    """One line per dataset, for build_box.py to print."""
    inst = installed() or []
    cat = catalogue() or []
    ub, us = path_commands()
    paths = sum(len(p["files"]) for p in inst)
    return ("harvest: %d packages (%d owned paths kept), %d in the catalogue, "
            "%d on the PATH" % (len(inst), paths, len(cat), len(ub or []) + len(us or [])))


if __name__ == "__main__":
    if not available_on_disk():
        print("No harvest in %s -- run tools/harvest.py" % OUT)
    else:
        print(summary())
