#!/usr/bin/env python3
"""
Builds the ITD 140 SUPPLEMENTAL full-course review quiz -> data/itd140-supplemental-quiz.json.

    python3 tools/build_itd140_full.py

One of a set of three (guide: build_itd140_full_guide.py, flashcards: build_itd140_full_flashcards.py).
All three follow the same ten topics in the same order. Labelled "Supplemental" everywhere so it is not
mistaken for Quiz 1 material. The answer-length rule is an error here, as it is for the final exams.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qcheck import check, length_bias
from itd140_full_questions import SECTIONS

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-supplemental-quiz.json")


def main():
    problems, total, allq = [], 0, []
    for name, qs in SECTIONS:
        for i, q in enumerate(qs):
            check(q, "%s[%d]" % (name, i), problems)
            total += 1
            allq.append(q)
    problems += length_bias(allq, "answer length")
    if problems:
        print("%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    quiz = {
        "title": "ITD 140 Final: Full-Course Review",
        "description": "%d questions across fifteen topics of the whole course for the final exam: foundations, supervised algorithms, evaluation, clustering, the workflow, feature selection, PCA, encoding, scaling, regularization, imputation, trees, forests and perceptrons, neural networks, hyperparameter tuning, and fairness and bias." % total,
        "guideFile": "data/itd140-supplemental-guide.json",
        "shortCount": 40,
        "sections": [{"name": n, "questions": qs} for n, qs in SECTIONS],
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(quiz, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d questions in %d sections -> data/itd140-supplemental-quiz.json" % (total, len(SECTIONS)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
