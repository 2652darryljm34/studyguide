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
  * the set is listed on the home page in classes.json, with a mastery loop link (and, for ITD 140, number drills)
  * sets in NEEDS_WALKTHROUGHS also have a walkthroughs file, linked from the home page and from guide topics

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
    ("ITD 132 quiz 1", "itd132",
     "data/itd132-quiz1-guide.json", "data/itd132-quiz1-flashcards.json", "data/itd132-quiz1.json"),
    ("ITD 140 quiz 1", "itd140",
     "data/itd140-quiz1-guide.json", "data/itd140-quiz1-flashcards.json", "data/itd140-quiz1.json"),
    ("ITD 140 supplemental full course", "itd140",
     "data/itd140-supplemental-guide.json", "data/itd140-supplemental-flashcards.json", "data/itd140-supplemental-quiz.json"),
]

# Sets whose course has number drills (drills.html is ITD 140 only); every set needs a mastery loop.
NEEDS_DRILLS = ("ITD 140 quiz 1", "ITD 140 supplemental full course")

# Sets that also need step-through walkthroughs (walkthrough.html). New sets go here; earlier ones are exempt.
# name -> walkthrough file
NEEDS_WALKTHROUGHS = {"ITD 140 supplemental full course": "data/itd140-walkthroughs.json"}

EXTRA_GUIDE_SECTIONS =("Common Mix-ups",)


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

        cls = next((c for c in registry["classes"] if c["id"] == class_id), {})
        hrefs = [t.get("href", "") for t in cls.get("tools", [])]
        expect(any(quiz_f.replace("/", "%2F") in h and "mode=mastery" in h for h in hrefs),
               "no mastery loop link for %s in classes.json" % quiz_f)
        if name in NEEDS_DRILLS:
            expect(any(h.startswith("drills.html") for h in hrefs), "no number drills link under %s" % class_id)

        if name in NEEDS_WALKTHROUGHS:
            wt_f = NEEDS_WALKTHROUGHS[name]
            wt = load(wt_f, problems, name)
            expect(any(wt_f.replace("/", "%2F") in h for h in hrefs), "no walkthroughs link for %s in classes.json" % wt_f)
            if wt:
                names = [s["name"] for s in guide["sections"]]
                expect(wt.get("guideFile") == guide_f and wt.get("quizFile") == quiz_f, "the walkthroughs do not link to this guide and quiz")
                expect(wt["walkthroughs"], "the walkthroughs file is empty")
                covered = {w["topic"] for w in wt["walkthroughs"]}
                for n in names:
                    expect(n in covered, "no walkthrough for guide section %r" % n)
                for w in wt["walkthroughs"]:
                    expect(w["topic"] in names, "walkthrough %r names a topic that is not a guide section" % w["id"])
                    expect(len(w["steps"]) >= 3, "walkthrough %r has fewer than 3 steps" % w["id"])

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
