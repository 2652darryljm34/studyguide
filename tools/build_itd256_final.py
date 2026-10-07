#!/usr/bin/env python3
"""
Builds the ITD 256 final exam review from tools/questions-itd256-final/.

The content follows the highlighted portions of the instructor's course review
deck. It is written to data/itd256-final-exam.json as a single quiz.

    python3 tools/build_itd256_final.py

The SQL questions are graded against data/harborview.sql; tools/check_sql.py
runs every reference solution (it picks up every data/*.json file).
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qcheck import check, length_bias

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "questions-itd256-final", "final-exam.json")
OUT = os.path.join(HERE, "..", "data", "itd256-final-exam.json")


def main():
    with open(SRC, encoding="utf-8") as fh:
        doc = json.load(fh)

    problems = []
    total = 0
    by_type = {}
    for sec in doc["sections"]:
        for i, q in enumerate(sec["questions"]):
            check(q, "%s[%d]" % (sec["name"], i), problems)
            by_type[q["type"]] = by_type.get(q["type"], 0) + 1
            total += 1

    problems += length_bias([q for sec in doc["sections"] for q in sec["questions"]], "answer length")

    if problems:
        print("%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    quiz = {
        "title": doc["title"],
        "description": doc["description"],
        "guideFile": "data/itd256-midterm-guide.json",
        "dbFile": "data/harborview.sql",
        # Lets the quiz page offer "how many questions?"; this is the suggested size
        # (see renderLengthChoice in assets/quiz.js).
        "shortCount": 40,
        "sections": doc["sections"],
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(quiz, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print("%d questions in %d sections -> data/itd256-final-exam.json" % (total, len(doc["sections"])))
    print("  " + "  ".join("%s=%d" % kv for kv in sorted(by_type.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
