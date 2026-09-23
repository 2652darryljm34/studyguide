#!/usr/bin/env python3
"""
Build data/itn170-man.json -- the real man pages, for the commands the shell
actually implements.

    python3 tools/build_man.py

The harvest holds 1,008 pages (10.7MB). Shipping all of them would cost every
visitor 2.7MB gzipped to read documentation for commands this machine cannot
run, so only the implemented ones are carried. The rest stay in
tools/harvest/out/manpages.json as the record.

The bundle is fetched in the background once the terminal is up, not as part of
the page load -- see assets/man.js. Until it arrives, `man` answers from the
hand-written table in assets/shsys.js, which covers the commands the course
leans on hardest. Nobody waits for a man page.

**Attribution.** Man pages are the work of their authors and carry real
licences -- GPLv3+, GFDL, BSD. Each page here records the package it came from
and that package's licence, and `man` prints them in a footer. Redistribution
is permitted; passing it off as ours would not be.
"""

import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
HARVEST = os.path.join(HERE, "harvest", "out")
OUT = os.path.join(ROOT, "data", "itn170-man.json")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

MAN_PATH = re.compile(r"^/usr/share/man/man(\w+)/(.+?)\.(\w+)(?:\.gz)?$")


def load(name):
    path = os.path.join(HARVEST, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def implemented():
    """Ask the shell what it implements rather than keeping a second list."""
    probe = subprocess.run(
        ["node", "-e", """
const path=require('path');
const ROOT=process.argv[1];
const S=require(path.join(ROOT,'assets','shell.js'));
global.HarborShell=S;
['shtext','shadmin','shpkg','shsys'].forEach(f=>require(path.join(ROOT,'assets',f+'.js')));
console.log(Object.keys(S.commands).concat(Object.keys(S.builtins)).join('\\n'));
""", os.path.abspath(ROOT)],
        capture_output=True, text=True)
    if probe.returncode != 0:
        raise SystemExit("could not read the command list: " +
                         probe.stderr.strip().split("\n")[0])
    return {c for c in probe.stdout.split() if c}


def owners():
    """command name -> (package, licence), from who owns its man page."""
    files = load("package-files.json") or []
    packages = {p["name"]: p for p in (load("packages-installed.json") or [])}
    out = {}
    for row in files:
        hit = MAN_PATH.match(row.get("path", ""))
        if not hit:
            continue
        name = hit.group(2)
        pkg = row["package"]
        if name in out:
            continue
        out[name] = (pkg, (packages.get(pkg) or {}).get("license", ""))
    return out


def main():
    pages = load("manpages.json")
    if pages is None:
        print("No harvest to build from. Run: python3 tools/harvest.py")
        return 1

    want = implemented()
    owner = owners()

    bundle = {}
    unattributed = []
    for name, page in pages.items():
        if name not in want:
            continue
        pkg, lic = owner.get(name, ("", ""))
        if not pkg:
            unattributed.append(name)
        bundle[name] = {
            "section": page.get("section", ""),
            "text": page["text"],
            "package": pkg,
            "license": lic,
        }

    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(bundle, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    size = os.path.getsize(OUT)
    print("wrote %s" % os.path.relpath(OUT, ROOT))
    print("  %d pages of %d harvested, for %d implemented commands"
          % (len(bundle), len(pages), len(want)))
    print("  %.1f KB" % (size / 1024.0))

    missing = sorted(c for c in want if c not in bundle)
    if missing:
        print("  %d implemented commands have no page: %s"
              % (len(missing), " ".join(missing[:14]) +
                 (" ..." if len(missing) > 14 else "")))
    if unattributed:
        print("  %d pages with no owning package: %s"
              % (len(unattributed), " ".join(sorted(unattributed)[:10])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
