#!/usr/bin/env python3
"""
Harvest the real RHEL 9 surface into tools/harvest/out/.

The practice emulator impersonates Red Hat Enterprise Linux 9. Rather than
impersonating it from memory, this runs the real thing in a container and
writes down what it actually says: package versions and file lists, man page
text, --help output, error messages and exit codes.

    python3 tools/harvest.py                # needs Docker running
    python3 tools/harvest.py --image quay.io/centos/centos:stream9
    python3 tools/harvest.py --report       # summarise what is already there

Rocky Linux 9 is the default because it is a RHEL 9 rebuild, so its package
versions line up with what the course runs. The container is disposable and
nothing it does touches your machine.

The output is committed on purpose: it is the reference the emulator is
checked against, and re-running it should be a deliberate act, not something
a build script does behind your back.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
HARVEST = os.path.join(HERE, "harvest")
OUT = os.path.join(HARVEST, "out")
SCRIPT = os.path.join(HARVEST, "collect.sh")

DEFAULT_IMAGE = "rockylinux:9"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass


def docker_ready():
    """Docker is installed *and* its daemon is up -- two different failures."""
    if not shutil.which("docker"):
        return False, "docker is not on the PATH."
    probe = subprocess.run(["docker", "info", "--format", "{{.ServerVersion}}"],
                           capture_output=True, text=True)
    if probe.returncode != 0:
        return False, ("the Docker daemon is not running. Start Docker Desktop "
                       "and try again.")
    return True, probe.stdout.strip()


def run(image, keep, stages=""):
    ok, detail = docker_ready()
    if not ok:
        print("Cannot harvest: %s" % detail)
        return 1
    print("Docker %s, image %s" % (detail, image))

    os.makedirs(OUT, exist_ok=True)

    # Docker on Windows wants forward slashes and a drive-letter path it can
    # translate; abspath gives us that, and the daemon handles the rest.
    def mount(path):
        return os.path.abspath(path).replace("\\", "/")

    # The script is copied into the container before it runs, not executed from
    # the bind mount. bash reads a script incrementally by byte offset, so
    # editing collect.sh on the host while a harvest is in flight shifts every
    # offset under the running interpreter and it mis-parses something hundreds
    # of lines later. Copying makes the running job immune to host edits.
    argv = [
        "docker", "run", "--rm",
        "-v", "%s:/out" % mount(OUT),
        "-v", "%s:/mnt/collect.sh:ro" % mount(SCRIPT),
        image, "bash", "-c",
        "cp /mnt/collect.sh /tmp/collect.sh && bash /tmp/collect.sh %s" % stages,
    ]
    print("  " + " ".join(argv))
    print("  this takes several minutes -- most of it is man pages\n")

    result = subprocess.run(argv)
    if result.returncode != 0:
        print("\nThe harvest container exited %d. Anything it did write is in %s"
              % (result.returncode, os.path.relpath(OUT, ROOT)))
        return result.returncode

    return report()


def report():
    """Say what was harvested, in the terms the emulator cares about."""
    if not os.path.isdir(OUT):
        print("Nothing harvested yet. Run: python3 tools/harvest.py")
        return 1

    def load(name):
        path = os.path.join(OUT, name)
        if not os.path.exists(path):
            return None
        with open(path, encoding="utf-8") as fh:
            try:
                return json.load(fh)
            except json.JSONDecodeError as exc:
                print("  %s is not valid JSON: %s" % (name, exc))
                return None

    print("\nHarvested into %s" % os.path.relpath(OUT, ROOT))
    print("-" * 60)

    rows = [
        ("packages-installed.json", "installed packages", len),
        ("package-files.json", "owned file paths", len),
        ("package-requires.json", "dependency edges", len),
        ("packages-available.json", "available packages", len),
        ("repos.json", "repositories", len),
        ("manpages.json", "man pages", len),
        ("help.json", "--help texts", len),
        ("errors.json", "commands with error probes", len),
    ]
    total_bytes = 0
    for name, label, count in rows:
        path = os.path.join(OUT, name)
        data = load(name)
        if data is None:
            print("  %-28s (missing)" % label)
            continue
        size = os.path.getsize(path)
        total_bytes += size
        print("  %-28s %7d   %6.1f KB" % (label, count(data), size / 1024.0))

    cmds = os.path.join(OUT, "commands.txt")
    if os.path.exists(cmds):
        with open(cmds, encoding="utf-8") as fh:
            n = len([l for l in fh if l.strip()])
        print("  %-28s %7d" % ("commands on the PATH", n))

    print("-" * 60)
    print("  %-28s %13.1f KB" % ("total", total_bytes / 1024.0))

    # The number that actually matters: how much of the real machine we cover.
    manpages = load("manpages.json") or {}
    if manpages:
        sys.path.insert(0, HERE)
        try:
            implemented = implemented_commands()
        except Exception as exc:
            print("\n(could not read the emulator's command list: %s)" % exc)
            return 0
        have = sorted(c for c in implemented if c in manpages)
        missing = sorted(c for c in implemented if c not in manpages)
        print("\nAgainst the emulator's %d commands:" % len(implemented))
        print("  %d have a real man page here" % len(have))
        if missing:
            print("  %d do not: %s" % (len(missing), " ".join(missing[:20]) +
                                       (" ..." if len(missing) > 20 else "")))
    return 0


def implemented_commands():
    """Ask the shell itself what it implements, rather than keeping a list."""
    probe = subprocess.run(
        ["node", "-e", """
const path=require('path');
const ROOT=process.argv[1];
const HarborShell=require(path.join(ROOT,'assets','shell.js'));
global.HarborShell=HarborShell;
['shtext','shadmin','shpkg','shsys'].forEach(f=>require(path.join(ROOT,'assets',f+'.js')));
console.log(Object.keys(HarborShell.commands).join('\\n'));
""", os.path.abspath(ROOT)],
        capture_output=True, text=True)
    if probe.returncode != 0:
        raise RuntimeError(probe.stderr.strip().split("\n")[0])
    return [c for c in probe.stdout.split() if c]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", default=DEFAULT_IMAGE,
                    help="container image to harvest from (default: %s)" % DEFAULT_IMAGE)
    ap.add_argument("--report", action="store_true",
                    help="summarise the existing harvest without re-running it")
    ap.add_argument("--keep", action="store_true",
                    help="keep the container after it exits, for poking at")
    ap.add_argument("--stage", default="",
                    help="run only these stages, space separated: "
                         "packages commands man probes facts. Preparing the "
                         "container always runs, because every stage needs it.")
    args = ap.parse_args()

    if args.report:
        return report()
    return run(args.image, args.keep, args.stage)


if __name__ == "__main__":
    sys.exit(main())
