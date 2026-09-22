#!/usr/bin/env python3
"""
The question validator, shared by every class's build script.

It catches the mistakes that are invisible until a learner hits the question:

  * an `mc` whose `correct` index is out of range, or with duplicate options
  * a `matching` with duplicate right-hand values (which makes a pair ungradeable)
  * a `fill_blank` whose answer normalizes to something unmatchable
  * a `short_answer` with no rubric, or fewer than two criteria
  * a `sql` with no solution, DML without `verify`, or `orderMatters` on a
    solution with no ORDER BY
  * a `shell` with no solution, a state-changing command without `verify`, or a
    prompt that asks for a sorted answer without setting `orderMatters`
  * a question that refers to "the example above" or "the previous question" --
    questions are shuffled within a section, so nothing may depend on its
    neighbours

Import it; don't run it:

    from qcheck import check, problems_for
"""

import re

# Questions are shuffled inside a section, so a question that leans on its
# neighbour will make no sense when it comes up first.
# Deliberately narrow: "above 75" and "below the dividing line" are fine, while
# "the example above" and "same rules as above" are not.
DANGLING = re.compile(
    r"(?:\b(?:the|shown|listed|given|described|as|see)\s+(?:above|below)\b"
    r"|\b(?:above|below)\s*[:,.]"
    r"|\bprevious question\b"
    r"|\bpreceding\b"
    r"|\bas noted earlier\b"
    r"|\bsame (?:business )?rules as\b"
    r"|\bin the (?:example|scenario|question) above\b"
    # Wording that reads as a continuation of the question before it.
    r"|\bthat same\b"
    r"|\bcontinuing (?:with|from)\b"
    r"|\bfinish the job\b"
    r"|\bin the [A-Za-z_/]+ example\b"
    r"|\bearlier (?:example|question|table)\b)",
    re.I,
)

# A shell command that changes the machine rather than printing something has
# to be graded on its effect, which means the question needs a `verify`.
MUTATING = re.compile(
    r"^\s*(?:sudo\s+(?:-\w+\s+)*)?"
    r"(touch|mkdir|rmdir|rm|cp|mv|ln|chmod|chown|chgrp|umask"
    r"|useradd|usermod|userdel|groupadd|groupmod|groupdel|gpasswd|passwd|chage"
    r"|dnf|yum|rpm|flatpak|subscription-manager"
    r"|systemctl|mount|umount|ssh-keygen|updatedb|hostnamectl|nmcli"
    r"|kill|killall|pkill|gzip|gunzip|tar)\b",
    re.I,
)

# ... unless what it actually does is report. `dnf search`, `systemctl status`
# and `rpm -q` all match the list above but change nothing.
READ_ONLY = re.compile(
    r"^\s*(?:sudo\s+(?:-\w+\s+)*)?(?:"
    r"rpm\s+-[a-zA-Z]*q"
    r"|dnf\s+(?:search|info|list|provides|whatprovides|repolist|repoquery|history|check-update)"
    r"|dnf\s+(?:group|module)\s+(?:list|info)"
    r"|yum\s+(?:search|info|list|provides|repolist|history)"
    r"|flatpak\s+(?:list|search|info|remotes|remote-list)"
    r"|systemctl\s+(?:status|is-active|is-enabled|list-units|list-unit-files|show|cat"
    r"|list-dependencies)"
    r"|subscription-manager\s+(?:list|status|version)"
    r"|nmcli\s+(?:\S+\s+)?(?:show|status)"
    r"|tar\s+-?[a-zA-Z]*t[a-zA-Z]*f"
    r"|hostnamectl\s*(?:status)?\s*(?:\||$)"
    r"|chage\s+-l"
    r"|passwd\s+-S"
    r"|umask\s*$"
    r"|mount\s*(?:\||$)"
    r"|ln\s+-s\s+.*\|"       # a listing pipeline that merely mentions ln
    r")",
    re.I,
)

# A prompt that asks for a particular order has to grade on that order.
ORDERED_PROMPT = re.compile(
    r"\b(?:sorted|in order|alphabetical(?:ly)?|ascending|descending"
    r"|largest first|smallest first|newest first|oldest first"
    r"|highest first|lowest first|most to least|least to most"
    r"|in that order|ranked)\b",
    re.I,
)

# Redirection that sends *stdout* to a file, which is what makes a solution
# ungradeable on its output. `2>` only moves the errors, so it is not a
# problem; `&>` moves both, so it is.
STDOUT_REDIR = re.compile(r"(?:^|[^0-9>&])>(?![>|&])|&>")

SQL_STARTERS = {"select", "insert", "update", "delete", "create", "drop",
                "alter", "with", "--"}


def unquoted(s):
    """Blank out single-quoted spans so `awk 'NR>1'` is not read as a redirect."""
    return re.sub(r"'[^']*'", "''", str(s))


def normalize(s):
    """Mirror of normalizeAnswer() in assets/quiz.js."""
    s = str(s).lower().strip()
    s = re.sub(r"[.,;:'\"]", "", s)
    return re.sub(r"\s+", " ", s)


def check(q, where, problems):
    """Append a message to `problems` for every fault found in question `q`."""
    kind = q.get("type")
    prompt = q.get("question", "")

    def fault(msg):
        problems.append("%s: %s" % (where, msg))

    if not prompt:
        fault("no question text")

    # "above" is fine when the question carries its own legend inline.
    hit = DANGLING.search(prompt)
    if hit and "legend" not in prompt.lower() and "layout" not in prompt.lower():
        fault("refers to %r, but questions are shuffled" % hit.group(0))

    if kind == "mc":
        opts = q.get("options") or []
        if len(opts) < 2:
            fault("fewer than two options")
        if not isinstance(q.get("correct"), int) or not (0 <= q["correct"] < len(opts)):
            fault("correct index %r is out of range" % q.get("correct"))
        if len(set(opts)) != len(opts):
            fault("duplicate options")

    elif kind == "tf":
        if not isinstance(q.get("correct"), bool):
            fault("tf needs a boolean `correct`")

    elif kind == "fill_blank":
        answers = q.get("answers") or []
        if not answers:
            fault("no accepted answers")
        for a in answers:
            if not normalize(a):
                fault("answer %r normalizes to nothing" % a)
            if re.fullmatch(r"[\d:.]+", str(a)):
                fault("answer %r loses meaning once punctuation is stripped; "
                      "use mc instead" % a)

    elif kind == "matching":
        pairs = q.get("pairs") or []
        if len(pairs) < 2:
            fault("fewer than two pairs")
        rights = [p["right"] for p in pairs]
        if len(set(rights)) != len(rights):
            fault("duplicate right-hand values make a pair ungradeable")
        lefts = [p["left"] for p in pairs]
        if len(set(lefts)) != len(lefts):
            fault("duplicate left-hand values")

    elif kind == "short_answer":
        if not q.get("modelAnswer"):
            fault("no model answer")
        lang = q.get("answerLang")
        if lang == "sql":
            first = (q.get("modelAnswer") or "").strip().split(None, 1)[:1]
            if first and first[0].lower() not in SQL_STARTERS:
                fault("answerLang is 'sql' but the model answer starts with "
                      "%r, so it looks like prose" % first[0])
        elif lang == "shell":
            model = (q.get("modelAnswer") or "").strip()
            if model and not re.match(r"^[#$]?\s*[a-z./~]", model):
                fault("answerLang is 'shell' but the model answer starts with "
                      "%r, so it looks like prose" % model.split(None, 1)[0])
        elif lang:
            fault("unknown answerLang %r" % lang)
        if not q.get("rubric"):
            fault("no rubric, so it can only be self-graded pass/fail")
        elif len(q["rubric"]) < 2:
            fault("a rubric needs at least two criteria to give partial credit")

    elif kind == "sql":
        if not q.get("solution"):
            fault("no reference solution")
        if not q.get("tables"):
            fault("no `tables` list, so the schema panel shows everything")
        sol = q.get("solution", "")
        is_dml = re.match(r"\s*(insert|update|delete)\b", sol, re.I)
        if is_dml and not q.get("verify"):
            fault("an INSERT/UPDATE/DELETE needs a `verify` SELECT to be gradeable")
        if not is_dml and q.get("verify"):
            fault("`verify` is only for INSERT/UPDATE/DELETE")
        if q.get("orderMatters") and not re.search(r"order\s+by", sol, re.I):
            fault("orderMatters is set but the solution has no ORDER BY")
        if not q.get("orderMatters") and re.search(r"order\s+by", sol, re.I) and not is_dml:
            fault("solution has ORDER BY but orderMatters is not set "
                  "(harmless, but the prompt probably asked for a sort)")

    elif kind == "shell":
        sol = (q.get("solution") or "").strip()
        if not sol:
            fault("no reference solution")
        if not q.get("places"):
            fault("no `places` list, so the machine panel has nothing to show")

        # Grading on output only works when the command produces output; a
        # command that changes the machine has to be read back with `verify`.
        first = sol.split("|")[0].split("&&")[0].split(";")[0]
        if MUTATING.match(first) and not READ_ONLY.match(first) and not q.get("verify"):
            fault("the solution starts with a command that changes the machine "
                  "(%r) but there is no `verify` to read the result back"
                  % first.strip().split()[0])
        if STDOUT_REDIR.search(unquoted(sol)) and not q.get("verify") \
                and not re.search(r"\|\s*tee", sol):
            fault("the solution redirects to a file, so its output goes to the "
                  "file rather than the screen; grade it with `verify`")

        if ORDERED_PROMPT.search(prompt) and not q.get("orderMatters"):
            fault("the prompt asks for a particular order, so set "
                  "\"orderMatters\": true or the check accepts any order")

        for field in ("verify", "cwd", "hint"):
            if field in q and not isinstance(q[field], str):
                fault("`%s` must be a string" % field)
        if "exitsNonZero" in q and not isinstance(q["exitsNonZero"], bool):
            fault("`exitsNonZero` must be true or false")
        if "setup" in q and not isinstance(q["setup"], (str, list)):
            fault("`setup` must be a string or a list of strings")

    else:
        fault("unknown type %r" % kind)


def problems_for(questions, label):
    """Convenience: validate a list and return the messages."""
    found = []
    for i, q in enumerate(questions):
        check(q, "%s[%d]" % (label, i), found)
    return found
