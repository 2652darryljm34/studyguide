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
   questions, never a majority. Also vary the position of the right answer (the build scripts do not
   shuffle options).
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
