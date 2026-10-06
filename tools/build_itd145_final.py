#!/usr/bin/env python3
"""
Builds the ITD 145 final exam review from tools/itd145_final_questions.py.

    python3 tools/build_itd145_final.py

The content follows the instructor's final exam study guide (descriptive
statistics, distributions, inferential statistics, outliers, NumPy, pandas,
cleaning, reshaping, regression and plotting). The build refuses to write on any
validation problem, including answer-length bias (see CLAUDE.md).
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from qcheck import check, length_bias
from itd145_final_questions import SECTIONS

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

OUT = os.path.join(HERE, "..", "data", "itd145-final-exam.json")


def main():
    problems = []
    all_q = []
    by_type = {}
    for name, qs in SECTIONS:
        for i, q in enumerate(qs):
            check(q, "%s[%d]" % (name, i), problems)
            by_type[q["type"]] = by_type.get(q["type"], 0) + 1
            all_q.append(q)

    problems += length_bias(all_q, "answer length")

    if problems:
        print("%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    quiz = {
        "title": "ITD 145 Final Exam Review",
        "description": "Built from the final exam study guide: descriptive statistics, distributions, "
                       "inferential statistics, outliers, NumPy, pandas, cleaning, reshaping, "
                       "linear regression and plotting.",
        # The quiz page offers a short mode: this many questions drawn at random each
        # attempt, spread evenly across the sections (see pickEvenly in assets/quiz.js).
        "shortCount": 40,
        "sections": [{"name": name, "questions": qs} for name, qs in SECTIONS],
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(quiz, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print("%d questions in %d sections -> data/itd145-final-exam.json" % (len(all_q), len(SECTIONS)))
    print("  " + "  ".join("%s=%d" % kv for kv in sorted(by_type.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
