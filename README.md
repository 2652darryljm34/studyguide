# Class Quiz Hub

A tiny static site for sharing self-study quizzes with classmates via GitHub Pages.

**Live structure:**
- `index.html` — home page, lists every class and its quizzes (reads `classes.json`)
- `quiz.html` — the actual quiz-taking screen (works for *any* quiz — it just reads whichever file is passed in the URL, e.g. `quiz.html?file=data/itd256-midterm-review.json`)
- `classes.json` — the registry of classes and quizzes. **This is the only file you edit to add or reorganize content.**
- `data/*.json` — one file per quiz, containing the questions
- `assets/` — shared CSS/JS, not something you need to touch

## Adding a new quiz to an existing class

1. Create a new file in `data/`, e.g. `data/itd256-final-review.json`. Quizzes are organized into **sections** (e.g. to mirror an exam's structure), and each question has a `type`. Supported types:

   | type | fields | notes |
   |---|---|---|
   | `mc` | `options` (array), `correct` (index) | standard multiple choice |
   | `tf` | `correct` (`true`/`false`) | rendered as a True/False choice |
   | `fill_blank` | `answers` (array of acceptable strings) | case-insensitive, punctuation-insensitive match against any accepted answer |
   | `matching` | `pairs` (array of `{left, right}`) | learner matches each left item to a right item via dropdown; right side is shuffled |
   | `short_answer` | `modelAnswer` (string) | self-graded: reveals the model answer, learner clicks "I had this right" / "I need to review this" (use for SQL to write or dependency sets, which can't be auto-checked) |

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
