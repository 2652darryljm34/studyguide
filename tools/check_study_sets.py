#!/usr/bin/env python3
"""
Checks that each exam is built as a SET: a review guide, flashcards and a quiz, built together
and linked to each other.

    python3 tools/check_study_sets.py

For every set listed in SETS below it checks that
  * all three files exist and are valid JSON
  * each one links to the others (guide -> quiz and flashcards, flashcards -> guide and quiz,
    quiz -> guide), and every link points at a file that exists
  * the three cover the same topics: the quiz's sections and the flashcards' topics are the same
    count, and the guide has one section per topic (it may add a closing "Common Mix-ups"
    section)
  * the set is listed on the home page in classes.json

When you build a new exam, add its set here (see CLAUDE.md). Exits 1 on any problem.
"""

import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

# name, class id in classes.json, guide, flashcards, quiz
SETS = [
    ("ITN 170 final", "itn170",
     "data/itn170-final-guide.json", "data/itn170-final-flashcards.json", "data/itn170-final-exam.json"),
]

EXTRA_GUIDE_SECTIONS = ("Common Mix-ups",)


def load(rel, problems, label):
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        problems.append("%s: %s does not exist" % (label, rel))
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        problems.append("%s: %s is not valid JSON (%s)" % (label, rel, exc))
        return None


def listed(registry, class_id, rel):
    cls = next((c for c in registry["classes"] if c["id"] == class_id), None)
    if not cls:
        return False
    for key in ("guides", "quizzes"):
        if any(x.get("file") == rel for x in cls.get(key, [])):
            return True
    return any(rel.replace("/", "%2F") in x.get("href", "") for x in cls.get("tools", []))


def main():
    problems = []
    with open(os.path.join(ROOT, "classes.json"), encoding="utf-8") as fh:
        registry = json.load(fh)

    for name, class_id, guide_f, cards_f, quiz_f in SETS:
        guide = load(guide_f, problems, name)
        cards = load(cards_f, problems, name)
        quiz = load(quiz_f, problems, name)
        if not (guide and cards and quiz):
            continue

        def expect(cond, msg):
            if not cond:
                problems.append("%s: %s" % (name, msg))

        expect(guide.get("quizFile") == quiz_f, "the guide's quizFile is %r, expected %s" % (guide.get("quizFile"), quiz_f))
        expect(guide.get("flashcardsFile") == cards_f, "the guide's flashcardsFile is %r, expected %s" % (guide.get("flashcardsFile"), cards_f))
        expect(cards.get("guideFile") == guide_f, "the flashcards' guideFile is %r, expected %s" % (cards.get("guideFile"), guide_f))
        expect(cards.get("quizFile") == quiz_f, "the flashcards' quizFile is %r, expected %s" % (cards.get("quizFile"), quiz_f))
        expect(quiz.get("guideFile") == guide_f, "the quiz's guideFile is %r, expected %s" % (quiz.get("guideFile"), guide_f))

        topics = []
        for card in cards["cards"]:
            if card["topic"] not in topics:
                topics.append(card["topic"])
        quiz_sections = [s for s in quiz["sections"] if s.get("questions")]
        guide_sections = [s for s in guide["sections"] if not any(x in s["name"] for x in EXTRA_GUIDE_SECTIONS)]
        expect(len(topics) == len(quiz_sections),
               "the flashcards cover %d topics but the quiz has %d sections" % (len(topics), len(quiz_sections)))
        expect(len(guide_sections) == len(quiz_sections),
               "the guide has %d topic sections but the quiz has %d" % (len(guide_sections), len(quiz_sections)))

        for rel in (guide_f, cards_f, quiz_f):
            expect(listed(registry, class_id, rel), "%s is not listed under %s in classes.json" % (rel, class_id))

        print("%-16s guide %2d sections | flashcards %3d cards in %2d topics | quiz %3d questions in %2d sections"
              % (name, len(guide["sections"]), len(cards["cards"]), len(topics),
                 sum(len(s["questions"]) for s in quiz_sections), len(quiz_sections)))

    if problems:
        print("\n%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1
    print("all study sets are complete and linked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
