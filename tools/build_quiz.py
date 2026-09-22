#!/usr/bin/env python3
"""
Merges tools/questions/*.json into data/itd256-midterm-review.json.

The question pool is large enough that keeping it in one file makes it painful
to edit, so each exam section lives in its own file and this stitches them
together in filename order. Edit the section files, then:

    python3 tools/build_quiz.py

It also validates as it goes, which catches the mistakes that are invisible
until a learner hits the question. Those checks live in tools/qcheck.py, shared
with the other classes' build scripts.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qcheck import check

# Windows consoles default to cp1252, which cannot print the em dashes and
# arrows that appear in the question text. Never let that crash a report.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SRC = os.path.join(HERE, "questions")
OUT = os.path.join(ROOT, "data", "itd256-midterm-review.json")

# Questions carrying "core": true make up the main quiz, sized to mirror the
# exam's own question counts doubled (see tools/mark_core.py). The rest ship as
# a separate, optional extra-practice quiz so nothing written is thrown away.
CORE = {
    "title": "ITD 256 Midterm Review",
    "description": "Database concepts, the relational model and keys, SQL you actually run, "
                   "ERD and Crow's Foot notation, and normalization.",
    "guideFile": "data/itd256-midterm-guide.json",
    "dbFile": "data/harborview.sql",
}
EXTRA = {
    "title": "ITD 256 Extra Practice",
    "description": "Everything outside the core review — broader coverage of the same "
                   "topics, for when you want more reps.",
    "guideFile": "data/itd256-midterm-guide.json",
    "dbFile": "data/harborview.sql",
}
OUT_EXTRA = os.path.join(ROOT, "data", "itd256-midterm-extra.json")

problems = []


def main():
    files = sorted(f for f in os.listdir(SRC) if f.endswith(".json"))
    if not files:
        print("no section files in %s" % SRC)
        return 1

    sections = []
    total = 0
    by_type = {}

    for name in files:
        with open(os.path.join(SRC, name), encoding="utf-8") as fh:
            try:
                doc = json.load(fh)
            except json.JSONDecodeError as exc:
                print("FAIL %s is not valid JSON: %s" % (name, exc))
                return 1

        qs = doc.get("questions", [])
        for i, q in enumerate(qs):
            check(q, "%s[%d]" % (name, i), problems)
            by_type[q.get("type")] = by_type.get(q.get("type"), 0) + 1
        total += len(qs)
        sections.append({"name": doc["name"], "questions": qs})
        print("%-24s %3d core of %3d  %s"
              % (name, sum(1 for q in qs if q.get("core")), len(qs), doc["name"]))

    if problems:
        print("\n%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    def emit(path, meta, want_core):
        """Write one quiz file, keeping section order and dropping the flag."""
        out = dict(meta)
        out["sections"] = []
        n = 0
        for s in sections:
            picked = [{k: v for k, v in q.items() if k != "core"}
                      for q in s["questions"] if bool(q.get("core")) == want_core]
            if picked:
                out["sections"].append({"name": s["name"], "questions": picked})
                n += len(picked)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(out, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        return n

    n_core = emit(OUT, CORE, True)
    n_extra = emit(OUT_EXTRA, EXTRA, False)

    if n_core == 0:
        print("\nNothing is marked core -- run tools/mark_core.py first.")
        return 1

    core_types = {}
    for s in sections:
        for q in s["questions"]:
            if q.get("core"):
                core_types[q["type"]] = core_types.get(q["type"], 0) + 1

    print("\n%3d core  -> %s" % (n_core, os.path.relpath(OUT, ROOT)))
    print("           " + "  ".join("%s=%d" % kv for kv in sorted(core_types.items())))
    print("%3d extra -> %s" % (n_extra, os.path.relpath(OUT_EXTRA, ROOT)))
    print("%3d in the pool" % total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
