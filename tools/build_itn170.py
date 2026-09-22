#!/usr/bin/env python3
"""
Merges tools/questions-itn170/*.json into the ITN 170 quiz files.

ITN 170 is a commands course, drilled a topic at a time rather than sat once,
so the pool is packaged differently from ITD 256: each source file becomes its
own quiz, and the questions marked "core": true are gathered into one
cumulative review that mirrors RH124's chapter 20.

    python3 tools/build_itn170.py

Validation is shared with the other classes -- see tools/qcheck.py. The stronger
check on the live `shell` questions is tools/test_shell.js, which actually runs
every shipped solution against the practice machine.
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
SRC = os.path.join(HERE, "questions-itn170")
DATA = os.path.join(ROOT, "data")

GUIDE = "data/itn170-commands-guide.json"
BOX = "data/itn170-box.json"

REVIEW_ID = "comprehensive-review"
REVIEW = {
    "title": "ITN 170 Comprehensive Review",
    "description": "One pass over everything: the command line, the filesystem, "
                   "redirection and pipes, users and groups, permissions, software, "
                   "storage, processes and services, networking and SSH.",
    "guideFile": GUIDE,
    "boxFile": BOX,
}

problems = []


def out_path(quiz_id):
    return os.path.join(DATA, "itn170-%s.json" % quiz_id)


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def write(path, doc):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def main():
    if not os.path.isdir(SRC):
        print("no question directory at %s" % SRC)
        return 1

    files = sorted(f for f in os.listdir(SRC) if f.endswith(".json"))
    if not files:
        print("no section files in %s" % SRC)
        return 1

    topics = []
    by_type = {}
    total = 0

    for name in files:
        with open(os.path.join(SRC, name), encoding="utf-8") as fh:
            try:
                doc = json.load(fh)
            except json.JSONDecodeError as exc:
                print("FAIL %s is not valid JSON: %s" % (name, exc))
                return 1

        for field in ("id", "name", "title"):
            if not doc.get(field):
                problems.append("%s: the file needs a %r" % (name, field))

        questions = doc.get("questions", [])
        for i, q in enumerate(questions):
            check(q, "%s[%d]" % (name, i), problems)
            by_type[q.get("type")] = by_type.get(q.get("type"), 0) + 1
        total += len(questions)
        topics.append({"file": name, "doc": doc, "questions": questions})

    ids = [t["doc"].get("id") for t in topics]
    if len(set(ids)) != len(ids):
        problems.append("two source files share an id: %s" % sorted(ids))

    if problems:
        print("\n%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    # ---- one quiz per topic ----
    written = []
    for topic in topics:
        doc = topic["doc"]
        quiz = {
            "title": doc["title"],
            "description": doc.get("description", ""),
            "guideFile": GUIDE,
            "boxFile": BOX,
            "sections": [{
                "name": doc["name"],
                "questions": [strip(q) for q in topic["questions"]],
            }],
        }
        path = out_path(doc["id"])
        write(path, quiz)
        written.append((doc["id"], doc["title"], len(topic["questions"])))
        print("%-32s %3d core of %3d  -> %s"
              % (topic["file"],
                 sum(1 for q in topic["questions"] if q.get("core")),
                 len(topic["questions"]),
                 rel(path)))

    # ---- the cumulative review ----
    review = dict(REVIEW)
    review["sections"] = []
    core_total = 0
    for topic in topics:
        picked = [strip(q) for q in topic["questions"] if q.get("core")]
        if picked:
            review["sections"].append({"name": topic["doc"]["name"], "questions": picked})
            core_total += len(picked)

    if core_total == 0:
        print("\nNothing is marked core, so the comprehensive review would be empty.")
        return 1

    write(out_path(REVIEW_ID), review)
    written.append((REVIEW_ID, REVIEW["title"], core_total))
    print("%-32s %3d               -> %s"
          % ("(cumulative)", core_total, rel(out_path(REVIEW_ID))))

    print("\n%d questions in the pool, %d of them core" % (total, core_total))
    print("  " + "  ".join("%s=%d" % kv for kv in sorted(by_type.items())))

    check_registry(written)
    return 0


def strip(q):
    """The `core` flag is a build-time marker; the quiz file has no use for it."""
    return {k: v for k, v in q.items() if k != "core"}


def check_registry(written):
    """
    classes.json is hand-edited on purpose -- it is what decides how the site is
    organized. So don't rewrite it; just say plainly when it has drifted.
    """
    path = os.path.join(ROOT, "classes.json")
    with open(path, encoding="utf-8") as fh:
        registry = json.load(fh)

    cls = next((c for c in registry.get("classes", []) if c.get("id") == "itn170"), None)
    if cls is None:
        print("\nclasses.json has no itn170 class yet. Add one, with these quizzes:")
        for quiz_id, title, n in written:
            print('    { "id": "%s", "title": "%s", "file": "data/itn170-%s.json" },'
                  % (quiz_id, title, quiz_id))
        return

    listed = {q.get("file") for q in cls.get("quizzes", [])}
    missing = [(i, t, n) for i, t, n in written
               if "data/itn170-%s.json" % i not in listed]
    stale = [f for f in listed
             if not os.path.exists(os.path.join(ROOT, f.replace("/", os.sep)))]

    if missing:
        print("\nclasses.json does not list %d generated quiz(zes):" % len(missing))
        for quiz_id, title, n in missing:
            print('    { "id": "%s", "title": "%s", "description": "%d questions.",'
                  ' "file": "data/itn170-%s.json" },' % (quiz_id, title, n, quiz_id))
    if stale:
        print("\nclasses.json points at %d file(s) that do not exist:" % len(stale))
        for f in stale:
            print("    " + f)
    if not missing and not stale:
        print("classes.json lists every generated quiz.")


if __name__ == "__main__":
    sys.exit(main())
