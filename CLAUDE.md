# Class Quiz Hub - notes for Claude

Read `README.md` for the site layout and `NEXT-SESSION.md` for project state. This file holds the
authoring rules that are easy to get wrong when writing quiz questions.

## Writing multiple-choice questions: the right answer must not be the longest

When writing `mc` questions it is natural to write the correct answer carefully and dash off the wrong
ones. The result is a quiz that can be passed by picking the longest, most specific option, without
knowing the material. This has already happened in this repo (the first drafts of both final exams had
the right answer longest in ~70% of questions) and had to be rewritten.

Rules for every `mc` question:

1. **Write the distractors first-class.** Each wrong answer should be as long, as specific and as
   grammatically parallel as the right one. Same structure, same level of detail, same kind of
   qualifiers ("because...", "which...", parenthetical examples).
2. **Make wrong answers plausible near-misses**, built from real concepts a student might confuse
   (the opposite behaviour, a neighbouring command, a related-but-different term). Not throwaways like
   "A database with no tables".
3. **Do not put the extra detail only in the right answer.** Parentheticals, "(case backwards)", a
   second clause that adds precision: if the right answer has one, give the wrong ones the same, or move
   the detail into `explanation`, which is shown after answering.
4. **Trim the right answer** rather than only padding the wrong ones. Put the full definition in the
   explanation.
5. **Vary which option is longest.** Aim for the right answer being the longest in roughly a quarter of
   questions, never a majority. The position of the right answer does not matter: the quiz page shuffles
   the options on every attempt (see below), so write them in whatever order reads naturally.
6. Do not reuse the same giveaway wording in distractors across questions ("always", "never", "only")
   unless it is also used in some right answers.

### Enforced by the build

`tools/qcheck.py` has `length_bias()`:

- fails a build if the right answer is the longest option in more than 40% of a quiz's `mc` questions
- fails if a single right answer is more than 1.4x the longest wrong one (options under 25 characters are exempt)

`build_itn170_final.py` and `build_itd256_final.py` treat this as an error. `build_itn170.py` and
`build_quiz.py` only print a one-line warning, because the older topic quizzes and midterm review predate
the rule and have not been rewritten (as of 2026-10-06 the right answer is longest in ~66% of the
comprehensive review and ~57% of the midterm review).

If you add a new quiz, call `length_bias()` from its build script and make it an error.

## Other conventions

- Questions are shuffled within a section, so no question may refer to "the example above" or the
  previous question (`qcheck.py` enforces this).
- `shell` questions need `places`; anything that changes the machine needs a `verify`. Run
  `node tools/test_shell.js` after touching them.
- `sql` questions run against `data/harborview.sql`; run `python tools/check_sql.py`.
- Study-material source files (PDFs, decks, docx) from classmates' courses are not committed to the repo.
  `.gitignore` the folder or leave it untracked; the owner has asked for them to stay out.

## Keep quiz content original

Write every review question from scratch, from the course's study guide and topic list. Do not reproduce
sample quizzes, past exam papers or other instructor-provided questions in this repo, whether verbatim or
lightly reworded. If such material is supplied, use it at most to see which concepts are emphasized, then
write new questions with different scenarios, numbers, variable and file names, and stem wording. Generic
templates ("What does np.arange(a, b, c) return?") are fine when the numbers and the answer differ.

- Keep everything written into the repo neutral about where ideas came from: code comments, docstrings,
  commit messages, quiz titles and descriptions should say what a quiz covers ("based on the study guide"),
  not recount what material the owner supplied.
- Before building on newly supplied instructor material, ask the owner whether and how it may be used,
  rather than assuming.
- Do not offer an instructor's loose-but-accepted phrasing as a wrong answer.
- To check overlap, compare new question stems against the supplied stems with `difflib` (keep that script
  and the supplied text outside the repo) and rewrite anything above about 0.8 similarity.

## Choosing how many questions (random sample) for long quizzes

A quiz JSON can set `"shortCount": N`. `assets/quiz.js` then shows a picker before it starts: a slider,
a number box and quick-pick buttons, from one question per topic up to every question, starting at N (the
suggested size) or the length the learner chose last time (kept in localStorage). A sample is drawn at random,
redrawn on every attempt, and spread evenly across the quiz's sections: every section gets floor(n / sections)
and the leftovers go to different random sections, so no two sections differ by more than one. Choosing the
full count runs every question in topic order. `?n=30`, `?mode=short` (N) and `?mode=full` skip the picker.
A quiz without `shortCount` behaves as before. All three final exams use it (the `build_*_final.py` scripts).
Run `node tools/test_quiz_length.js` after changing the quiz page or any quiz that sets it.

## Home page highlights and flashcards

- A guide, tool or quiz in `classes.json` with `"featured": true` is shown in the "Updated" banner at the top of
  the home page (in study order: guide, flashcards, quiz), listed first inside its class, and gets an "Updated"
  pill on the class header. `"badge"` changes the
  label and `"cta"` the banner link text. Remove the flag once the material is finished, so the banner only shows
  what is still being worked on.
- Flashcard decks are `{title, cards: [{topic, term, definition, useCase, example}]}` shown by `flashcards.html`.
  Terms must be unique in a deck (known cards are remembered by term). The ITN 170 final deck is built by
  `tools/build_itn170_flashcards.py`; keep definitions in your own words and the back of a card short.

## Every exam is built as a set: review guide, flashcards and quiz

When an exam comes up, build all three together and keep them in step, rather than the quiz alone:

1. **Review guide** (`review.html`, a `data/*-guide.json` with `quizFile`, `flashcardsFile` and, for Linux, `boxFile`).
2. **Flashcards** (`flashcards.html`, a deck with `guideFile` and `quizFile`).
3. **Quiz** (`quiz.html`, with `guideFile`), with the "how many questions" picker via `shortCount`.

They cover the same topics in the same order, in the same wording, and link to each other. Write each one
in original words (see "Keep quiz content original"), and give each its own build script in `tools/`.
Then:

- Register all three in `classes.json` and flag them `"featured": true` while the exam is upcoming.
- Add the set to `SETS` in `tools/check_study_sets.py` and run `python3 tools/check_study_sets.py`. It fails
  if a piece is missing, a link is broken, or the three no longer cover the same number of topics.
- When a topic changes in one piece (a corrected fact, a new command), change it in the other two as well,
  then rebuild all three and rerun the checker.
- When a class is over, set `"archived": true` on it in `classes.json` and remove its `featured` flags. It
  moves to the collapsed Archive section at the bottom of the home page and keeps all its material.

Current sets: ITN 170 final (`tools/build_itn170_final_guide.py`, `build_itn170_flashcards.py`,
`build_itn170_final.py`). ITD 145 and ITD 256 are archived; they have final quizzes but were finished before this
rule, so they have no matching final flashcards or guide.

## Option order is shuffled at run time

`assets/quiz.js` shows each multiple-choice question's options in a fresh random order on every attempt,
including retakes and random samples, so the position of the right answer can never be learned. The stored
order is only the author's. True/false stays True then False, and numbers are shuffled like anything
else (sorting them would pin the right answer to one slot). Exceptions, handled by `shuffleOptions()`:

- "None / All / Both of the above" stay at the bottom;
- `"keepOrder": true` on a question leaves it exactly as written.

So never write an option that points at another by position ("option B", "the first answer", "both A and C").
`qcheck.py` rejects those unless the question sets `keepOrder`. Run `node tools/test_option_shuffle.js` after
changing the quiz page or the option rules.
