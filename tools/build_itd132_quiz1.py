#!/usr/bin/env python3
"""
Builds ITD 132 Quiz 1 (relational database concepts, SQL basics and MySQL data types)
from tools/itd132_quiz1_questions.py into data/itd132-quiz1.json.

    python3 tools/build_itd132_quiz1.py

The SQL questions are graded against data/harborview.sql; tools/check_sql.py runs every
reference solution.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qcheck import check, length_bias
from itd132_quiz1_questions import SECTIONS

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd132-quiz1.json")


def main():
    problems, total, by_type, allq = [], 0, {}, []
    for name, qs in SECTIONS:
        for i, q in enumerate(qs):
            check(q, "%s[%d]" % (name, i), problems)
            by_type[q["type"]] = by_type.get(q["type"], 0) + 1
            total += 1
            allq.append(q)
    problems += length_bias(allq, "answer length")
    if problems:
        print("%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    quiz = {
        "title": "Quiz 1: Relational Databases, SQL and MySQL Data Types",
        "description": "%d questions on tables, rows and columns, primary and foreign keys, indexes, views and "
                       "routines, basic SELECT and JOIN queries, the system catalog, and choosing MySQL data types." % total,
        "guideFile": "data/itd132-quiz1-guide.json",
        "dbFile": "data/harborview.sql",
        "sections": [{"name": n, "questions": qs} for n, qs in SECTIONS],
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(quiz, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d questions in %d sections -> data/itd132-quiz1.json" % (total, len(SECTIONS)))
    print("  " + "  ".join("%s=%d" % kv for kv in sorted(by_type.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
