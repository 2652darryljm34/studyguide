# Class Quiz Hub

A tiny static site for sharing self-study quizzes with classmates via GitHub Pages.

**Live structure:**
- `index.html` — home page, lists every class, its study guides, and its quizzes (reads `classes.json`)
- `quiz.html` — the actual quiz-taking screen (works for *any* quiz — it just reads whichever file is passed in the URL, e.g. `quiz.html?file=data/itd256-midterm-review.json`)
- `review.html` — the study guide screen (works for *any* guide — same pattern, e.g. `review.html?file=data/itd256-midterm-guide.json`)
- `classes.json` — the registry of classes, guides, and quizzes. **This is the only file you edit to add or reorganize content.**
- `data/*.json` — one file per quiz or guide
- `assets/` — shared CSS/JS, not something you need to touch

## Briefing an AI assistant to build a new quiz or guide

If you start a **new chat** with an AI model to generate a quiz or study guide, that model has no memory of this project — it needs everything below to produce something that fits.

**1. Point it at this repo's conventions.** Tell it to read this README for the JSON schema, and to look at one existing pair of files as a working example of the house style:
- `data/itd256-midterm-review.json` (a quiz)
- `data/itd256-midterm-guide.json` (a study guide)

**2. Give it the actual source material** — don't make it guess at course content:
- The syllabus or exam study guide (part breakdown, question types, point weights, closed/open book, time limit — anything that shapes what's actually tested)
- The lecture slides/PowerPoint, and whether specific parts are **highlighted** — that's usually the professor's own signal of what's testable
- Textbook excerpts, if the course uses one
- Any real example questions or formats the professor has shared — these often reveal exact conventions worth copying (for instance, this class's own ERD exam questions use a specific lettered notation legend, which is why the ITD 256 guide/quiz reference it directly instead of inventing generic ERD questions)

**3. Tell it what to produce:**
- Which class this belongs to (existing, or brand new — see below), and the file names to use, e.g. `data/<class>-<topic>-review.json` / `data/<class>-<topic>-guide.json`
- Quiz, guide, or both — and whether they should cross-link (`guideFile` on the quiz, `quizFile` on the guide)
- Roughly how many questions / how much depth you want (there's no hard limit — for a study tool, more coverage is generally better than matching the exam's exact question count)

**4. Conventions worth calling out explicitly**, since they're easy to get wrong without this context:
- Every `short_answer` question needs a `rubric` array of 2-4 concrete grading criteria — that's what makes self-grading give partial credit instead of a vague binary guess.
- `matching` pairs need unique `right`-side values; two identical-looking right answers make a pair ungradeable.
- `fill_blank` answers are matched case-insensitively with `.,;:'"` stripped out before comparing — avoid answers where stripping punctuation breaks the meaning (e.g. `"1:1"` normalizes to `"11"`); use `mc` instead for anything like that.
- Don't invent facts, terminology, or examples beyond what's in the material you gave it — a confidently wrong "fact" in a study tool is worse than a missing one.
- Ask it to validate the JSON (`python3 -m json.tool data/yourfile.json`) and, ideally, actually load it locally (see [Local preview](#local-preview)) to confirm every question renders and grades correctly before calling it done.

## Adding a new quiz to an existing class

1. Create a new file in `data/`, e.g. `data/itd256-final-review.json`. Quizzes are organized into **sections** (e.g. to mirror an exam's structure), and each question has a `type`. Supported types:

   | type | fields | notes |
   |---|---|---|
   | `mc` | `options` (array), `correct` (index) | standard multiple choice |
   | `tf` | `correct` (`true`/`false`) | rendered as a True/False choice |
   | `fill_blank` | `answers` (array of acceptable strings) | case-insensitive, punctuation-insensitive match against any accepted answer |
   | `matching` | `pairs` (array of `{left, right}`) | learner matches each left item to a right item via dropdown; right side is shuffled |
   | `short_answer` | `modelAnswer` (string), `rubric` (array of strings) | self-graded: reveals the model answer, learner checks off which rubric criteria their own answer met, and gets partial credit for that fraction (use for SQL to write or dependency sets, which can't be auto-checked). Without a `rubric`, falls back to a plain "I had this right" / "I need to review this" toggle |

   Every question can also include `category` (a short label shown as a badge, e.g. `"Multiple Choice"`, `"SQL Writing"`) and `explanation` (shown after answering and in the final review).

```json
{
  "title": "ITD 256 Final Review",
  "description": "Optional one-line description shown under the title.",
  "sections": [
    {
      "name": "Theory & SQL",
      "questions": [
        {
          "type": "mc",
          "category": "Multiple Choice",
          "question": "What does SQL stand for?",
          "options": ["Structured Query Language", "Simple Query Logic", "Standard Query Language", "System Query Language"],
          "correct": 0,
          "explanation": "SQL = Structured Query Language."
        },
        {
          "type": "short_answer",
          "category": "SQL Writing",
          "question": "Write a query to select all columns from the film table.",
          "modelAnswer": "SELECT * FROM film;",
          "rubric": ["Used SELECT * to return every column", "Named the correct table: film"],
          "explanation": "SELECT * returns every column."
        }
      ]
    }
  ]
}
```

Questions are shuffled within each section, but sections always run in the order you list them — handy for matching an exam's structure (e.g. Theory & SQL, then ERD, then Normalization).

2. Open `classes.json` and add an entry to that class's `quizzes` array:

```json
{
  "id": "final-review",
  "title": "Final Review",
  "description": "Cumulative review for the final exam.",
  "file": "data/itd256-final-review.json"
}
```

That's it — the quiz shows up on the home page automatically.

## Adding a study guide

A study guide is long-form reference notes (definitions, tables, syntax, worked examples) rather than question-and-answer — meant to be read before taking the quiz.

1. Create a new file in `data/`, e.g. `data/itd256-final-guide.json`. Guides are organized into **sections** (matching the quiz's sections works well), and each section has a list of `blocks`. Supported block types:

   | type | fields | notes |
   |---|---|---|
   | `heading` | `text` | shown as a heading, and listed in that section's "jump to" nav |
   | `subheading` | `text` | a smaller heading, not listed in the jump nav |
   | `paragraph` | `text` | plain text |
   | `list` | `items` (array), optional `ordered: true` | bullet list, or numbered if `ordered` is set |
   | `table` | `headers` (array), `rows` (array of arrays) | a reference table |
   | `code` | `text` | monospace block, for SQL syntax or worked examples |
   | `note` | `text`, optional `label` | a callout box for tips/warnings |

   Any `text` field supports light markup: `**bold**` and `` `code` ``.

   Top-level fields: `title`, `description`, and optionally `quizFile` (path to the matching quiz — adds a "Take the quiz" button at the top of the guide). The matching quiz file can point back with a top-level `guideFile` field, which adds a "Review the study guide" link at the top of the quiz.

```json
{
  "title": "ITD 256 Final Study Guide",
  "description": "Optional one-line description shown under the title.",
  "quizFile": "data/itd256-final-review.json",
  "sections": [
    {
      "name": "Theory & SQL",
      "blocks": [
        { "type": "heading", "text": "Keys" },
        { "type": "table", "headers": ["Term", "Definition"], "rows": [
          ["Primary key", "Uniquely identifies a row."]
        ]},
        { "type": "note", "label": "Tip:", "text": "A **candidate key** is a minimal superkey." }
      ]
    }
  ]
}
```

2. Open `classes.json` and add an entry to that class's `guides` array:

```json
{
  "id": "final-guide",
  "title": "Final Study Guide",
  "description": "Reference notes for the final exam.",
  "file": "data/itd256-final-guide.json"
}
```

## Adding a whole new class

Add a new object to the `classes` array in `classes.json`:

```json
{
  "id": "cs201",
  "name": "CS 201",
  "fullName": "Data Structures",
  "quizzes": []
}
```

Then add quizzes to its `quizzes` array the same way as above. Classes with no quizzes yet still show up (with "No quizzes yet.").

## Publishing on GitHub Pages

1. Push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages**, set the source to your default branch (root folder).
3. Share the resulting `https://<username>.github.io/<repo>/` link — that's your home page.

No build step, no dependencies — just static files.

## Local preview

Because the pages `fetch()` JSON files, opening `index.html` directly from disk (`file://`) will fail in most browsers. Serve it locally instead:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```
