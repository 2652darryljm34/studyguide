#!/usr/bin/env python3
"""
Builds the ITD 145 Exam 2 study guide and quizzes.

    python3 tools/build_itd145.py

Content lives in itd145_guide.py and itd145_questions.py. Questions marked core
form the main review; the rest ship as Extra Practice. Validation is shared
with the other classes (see qcheck.py) and the build refuses to write on any
problem.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from qcheck import check
from itd145_guide import GUIDE
from itd145_questions import SECTIONS

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

DATA = os.path.join(HERE, "..", "data")
GUIDE_FILE = "data/itd145-exam2-guide.json"
REVIEW_FILE = "data/itd145-exam2-review.json"
EXTRA_FILE = "data/itd145-exam2-extra.json"

problems = []


def strip(q):
    return {k: v for k, v in q.items() if k != "core"}


def quiz(title, description, pick, other_file):
    sections = []
    for name, qs in SECTIONS:
        chosen = [strip(q) for q in qs if pick(q)]
        if chosen:
            sections.append({"name": name, "questions": chosen})
    return {"title": title, "description": description, "guideFile": GUIDE_FILE, "sections": sections}


review = quiz(
    "ITD 145 Exam 2 Review",
    "%d questions on NumPy, calculations and statistics, pandas Series and DataFrames, manipulating data, indexes, "
    "cleaning and imputation, reshaping and grouping, and plotting - mostly multiple choice, weighted toward definitions and comparisons.",
    lambda q: q["core"], EXTRA_FILE)
extra = quiz(
    "ITD 145 Exam 2 Extra Practice",
    "%d more questions on the same topics, for when you want more reps than the main review gives you.",
    lambda q: not q["core"], REVIEW_FILE)

for label, qz in (("review", review), ("extra", extra)):
    n = sum(len(s["questions"]) for s in qz["sections"])
    qz["description"] = qz["description"] % n
    for s in qz["sections"]:
        seen = set()
        for i, q in enumerate(s["questions"]):
            check(q, "%s/%s[%d]" % (label, s["name"], i), problems)
            if q["question"] in seen:
                problems.append("%s/%s: duplicate question %r" % (label, s["name"], q["question"]))
            seen.add(q["question"])
    print("%-7s %3d questions" % (label, n))
    for s in qz["sections"]:
        kinds = {}
        for q in s["questions"]:
            kinds[q["type"]] = kinds.get(q["type"], 0) + 1
        print("   %-34s %3d  %s" % (s["name"], len(s["questions"]), kinds))

# Table rows must match their header count.
for sec in GUIDE["sections"]:
    for b in sec["blocks"]:
        if b["type"] == "table":
            for r in b["rows"]:
                if len(r) != len(b["headers"]):
                    problems.append("guide/%s: row %r has %d cells, header has %d" % (sec["name"], r[0], len(r), len(b["headers"])))

if problems:
    print("\nNOT WRITTEN - %d problem(s):" % len(problems))
    for p in problems:
        print("  -", p)
    sys.exit(1)

for name, obj in (("itd145-exam2-guide.json", GUIDE), ("itd145-exam2-review.json", review), ("itd145-exam2-extra.json", extra)):
    with open(os.path.join(DATA, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote data/" + name)

print("""
classes.json entry:
  {"id": "itd145", "name": "ITD 145", "fullName": "...", "guides": [...], "quizzes": [...]}""")
