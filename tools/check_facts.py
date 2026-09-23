#!/usr/bin/env python3
"""
Check the teaching material against the machine it teaches.

    python3 tools/check_facts.py

The quizzes and the study guide are prose. Nothing verifies them -- the shell
questions are graded by running them, but a multiple-choice question claiming
"openssh-server 8.7p1" is just a sentence, and it stays wrong quietly.

Now that the emulator is built from a harvested RHEL 9 machine, a lot of that
prose *can* be checked: package names, versions, file paths and command names
all have a source of truth. This reports where the two disagree.

It is a report, not a gate. Some hits will be deliberate -- a question about a
command we do not implement, or a version quoted as a worked example. Read it
and judge.
"""

import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.join(ROOT, "data")
BOX = os.path.join(DATA, "itn170-box.json")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

# nnn.nnn-nnn.el9 -- an RPM version-release as it appears in prose.
#
# The release stops at el9 (plus the _N/.N a z-stream adds) rather than running
# on greedily: in a full filename like `tree-1.8.0-10.el9.x86_64.rpm` a greedy
# match swallowed `.x86_64.rpm` into the release and then reported a mismatch
# against itself.
VERSION = re.compile(
    r"\b([a-z][a-z0-9_+-]{2,})[- ](\d[\w.]*?)-(\d[\w.]*?\.el9(?:_\d+)?(?:\.\d+)?)"
    r"(?![\w.-])")

# Words that stand in for a real name in an example -- `rpm -qd name`,
# `dnf provides /usr/bin/thecommand`. They are meant to be typed over.
PLACEHOLDERS = {"name", "thecommand", "package", "pkg", "file", "command",
                "something", "foo", "bar"}
# A package named next to rpm/dnf, e.g. "rpm -q vim-enhanced".
PKG_CMD = re.compile(r"\b(?:rpm\s+-q\w*|dnf\s+(?:install|remove|info)(?:\s+-y)?)\s+"
                     r"([a-z][a-z0-9_+-]{2,})")
ABS_PATH = re.compile(r"(?<![\w/])(/(?:usr|etc|var|bin|sbin)/[\w./-]{2,})")


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# Commands and packages are written in backticks throughout the guide and the
# questions. Restricting the search to code spans is what separates a real
# claim from the word "and" happening to follow "dnf install" in a sentence.
CODE_SPAN = re.compile(r"`([^`]+)`")


def code_spans(text):
    return CODE_SPAN.findall(text)


def strings(obj, path="root"):
    """Every string in a nested structure, with a breadcrumb."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from strings(v, "%s.%s" % (path, k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from strings(v, "%s[%d]" % (path, i))
    elif isinstance(obj, str):
        yield path, obj


def implemented_commands():
    probe = subprocess.run(
        ["node", "-e", """
const path=require('path');const ROOT=process.argv[1];
const S=require(path.join(ROOT,'assets','shell.js'));global.HarborShell=S;
['shtext','shadmin','shpkg','shsys'].forEach(f=>require(path.join(ROOT,'assets',f+'.js')));
console.log(Object.keys(S.commands).concat(Object.keys(S.builtins)).join('\\n'));
""", os.path.abspath(ROOT)], capture_output=True, text=True)
    return {c for c in probe.stdout.split() if c}


def main():
    if not os.path.exists(BOX):
        print("No box image. Run: python3 tools/build_box.py")
        return 1

    box = load(BOX)
    installed = {p["name"]: p for p in box["packages"]["installed"]}
    available = {p["name"]: p for p in box["packages"]["available"]}
    every_pkg = dict(available)
    every_pkg.update(installed)

    # Every path the image actually has, from the package file lists.
    owned = set()
    for p in box["packages"]["installed"]:
        owned.update(p.get("files") or [])

    # Only material a person wrote. itn170-man.json is harvested man page
    # text -- checking it would report the real machine against itself.
    GENERATED = {"itn170-box.json", "itn170-man.json"}
    files = sorted(f for f in os.listdir(DATA)
                   if f.startswith("itn170-") and f.endswith(".json")
                   and f not in GENERATED)

    wrong_version, unknown_pkg, missing_path = [], [], []

    for name in files:
        doc = load(os.path.join(DATA, name))
        for where, whole in strings(doc):
            # Versions are checked in the whole string, prose included: a
            # sentence saying "openssh-server 8.7p1-24.el9" is exactly the
            # claim that goes stale, and `pkg-1.2-3.el9` is distinctive enough
            # not to fire on ordinary writing.
            for pkg, ver, rel in VERSION.findall(whole):
                real = every_pkg.get(pkg)
                if real and (real["version"], real["release"]) != (ver, rel):
                    wrong_version.append(
                        (name, pkg, "%s-%s" % (ver, rel),
                         "%s-%s" % (real["version"], real["release"])))

            # Package and path *names* only inside backticks, where the author
            # meant a literal command. Otherwise "dnf install and ..." in a
            # sentence reports the word "and" as a missing package.
            text = " ".join(code_spans(whole))
            if not text:
                continue
            for pkg, ver, rel in VERSION.findall(text):
                real = every_pkg.get(pkg)
                if not real:
                    continue
                if (real["version"], real["release"]) != (ver, rel):
                    wrong_version.append(
                        (name, pkg, "%s-%s" % (ver, rel),
                         "%s-%s" % (real["version"], real["release"])))

            for pkg in PKG_CMD.findall(text):
                if pkg not in every_pkg and pkg not in PLACEHOLDERS:
                    unknown_pkg.append((name, pkg, where))

            for path in ABS_PATH.findall(text):
                clean = path.rstrip(".,;:)")
                if clean.count("/") < 2 or clean.endswith("/"):
                    continue
                # Only check the directories whose contents we model exactly.
                if not clean.startswith(("/usr/bin/", "/usr/sbin/")):
                    continue
                if clean.rsplit("/", 1)[1] in PLACEHOLDERS:
                    continue
                if clean not in owned:
                    missing_path.append((name, clean))

    print("Teaching material vs the harvested machine")
    print("-" * 66)

    def report(title, rows, fmt):
        print("\n%s: %d" % (title, len(rows)))
        seen = set()
        for row in rows:
            key = row[1:]
            if key in seen:
                continue
            seen.add(key)
            print("   " + fmt(row))

    report("Package versions quoted in prose that no longer match",
           wrong_version,
           lambda r: "%-34s %s: says %s, image has %s" % (r[0], r[1], r[2], r[3]))
    report("Packages named in rpm/dnf examples that do not exist",
           unknown_pkg,
           lambda r: "%-34s %s" % (r[0], r[1]))
    report("Paths under /usr/bin or /usr/sbin that no package owns",
           missing_path,
           lambda r: "%-34s %s" % (r[0], r[1]))

    total = len(set(wrong_version)) + len(set(unknown_pkg)) + len(set(missing_path))
    print("\n%d distinct disagreements." % total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
