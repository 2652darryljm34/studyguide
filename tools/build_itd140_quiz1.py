#!/usr/bin/env python3
"""
Builds ITD 140 Quiz 1 (machine learning fundamentals)
from tools/itd140_quiz1_questions.py into data/itd140-quiz1.json.

    python3 tools/build_itd140_quiz1.py

"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qcheck import check, length_bias
from itd140_quiz1_questions import SECTIONS

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-quiz1.json")


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
        "title": "Quiz 1: Machine Learning Fundamentals",
        "description": "%d questions on AI versus machine learning, the three types of learning, classification and regression, "
                       "clustering with k-means, parameters and hyperparameters, accuracy and the confusion matrix, "
                       "overfitting, underfitting, bias and variance, and the steps of the machine learning process (with short-answer practice)." % total,
        "guideFile": "data/itd140-quiz1-guide.json",
        "shortCount": 40,
        "sections": [{"name": n, "questions": qs} for n, qs in SECTIONS],
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(quiz, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d questions in %d sections -> data/itd140-quiz1.json" % (total, len(SECTIONS)))
    print("  " + "  ".join("%s=%d" % kv for kv in sorted(by_type.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
