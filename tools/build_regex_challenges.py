#!/usr/bin/env python3
"""
Builds the regex challenges (data/regex-challenges.json, shown by regex-challenges.html).

    python3 tools/build_regex_challenges.py

Every challenge carries a reference solution, and this script runs it through the same grader the page uses
(assets/regexrun.py, i.e. Python's own `re`). A challenge whose solution fails its own tests fails the build,
so the tests can never contradict the answer.

kinds
  validate  the pattern must re.fullmatch every `good` string and no `bad` string; `hidden_*` are extra tests
            whose text is only revealed if the learner's pattern fails them.
  extract   re.findall(pattern, text) must equal `expected`.
  sub       re.sub(pattern, repl, text) must equal `expected` (repl is fixed and shown).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "assets"))
import regexrun  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

OUT = os.path.join(HERE, "..", "data", "regex-challenges.json")
LEVELS = ["Baby steps", "Classes and counts", "Anchors and groups", "Lookaround and tricks", "Real-world patterns"]


def v(level, id_, title, task, hint, solution, good, bad, hidden_good=(), hidden_bad=(), flags=""):
    return {"level": level, "id": id_, "title": title, "task": task, "hint": hint, "solution": solution, "flags": flags,
            "spec": {"kind": "validate", "good": good, "bad": bad, "hidden_good": list(hidden_good), "hidden_bad": list(hidden_bad)}}


def x(level, id_, title, task, hint, solution, text, expected, flags=""):
    return {"level": level, "id": id_, "title": title, "task": task, "hint": hint, "solution": solution, "flags": flags,
            "spec": {"kind": "extract", "text": text, "expected": expected}}


def s(level, id_, title, task, hint, solution, text, repl, expected, flags=""):
    return {"level": level, "id": id_, "title": title, "task": task, "hint": hint, "solution": solution, "flags": flags,
            "spec": {"kind": "sub", "text": text, "repl": repl, "expected": expected}}


V = "The whole string must match (the page uses re.fullmatch)."
CHALLENGES = [
    # ---- 1 Baby steps
    v(0, "cat", "Match the word cat", "Write a pattern that matches the string cat and nothing else. " + V,
      "A pattern made only of letters matches exactly those letters.", r"cat",
      ["cat"], ["Cat", "cats", "dog", "ca"], hidden_bad=["cut"]),
    v(0, "three-digits", "A three-digit number", "Match strings made of exactly three digits, such as 007 or 123. " + V,
      r"\d matches one digit. Say how many with {n}.", r"\d{3}",
      ["007", "123", "999"], ["12", "1234", "abc", "12a"], hidden_bad=["1 2"]),
    v(0, "cat-or-dog", "Cat or dog", "Match either the string cat or the string dog. " + V,
      "The | symbol means or.", r"cat|dog",
      ["cat", "dog"], ["cow", "catdog", "Cat"]),
    v(0, "colour", "Colour, either spelling", "Match color and colour (American and British spelling). " + V,
      "? makes the character before it optional.", r"colou?r",
      ["color", "colour"], ["colr", "colouur", "colours"]),
    x(0, "numbers", "Pull out every number", "Write a pattern so that re.findall returns every whole number in the text, as strings.",
      r"One or more digits: \d with a + after it.", r"\d+",
      "Order 66 shipped on day 12 with 3 boxes at 450 grams.", ["66", "12", "3", "450"]),
    # ---- 2 Classes and counts
    v(1, "hex-colour", "A hex colour code", "Match a # followed by exactly six hex digits (0-9, a-f, A-F), like #1a2B3c. " + V,
      "Build a set with [0-9a-fA-F]. The # needs no escape.", r"#[0-9a-fA-F]{6}",
      ["#1a2b3c", "#FFFFFF", "#000000"], ["1a2b3c", "#12345", "#GGGGGG", "#1234567"], hidden_bad=["#12 456"]),
    x(1, "ing-words", "Words ending in -ing", "Make findall return every word that ends in ing (the word can have any letters before it).",
      r"\b marks a word edge, \w+ is a run of word characters.", r"\b\w+ing\b",
      "Running and jumping are fun, but sing, ring and king are short. Walking is slow.",
      ["Running", "jumping", "sing", "ring", "king", "Walking"]),
    v(1, "zip", "US ZIP code, with optional +4", "Match five digits, optionally followed by a hyphen and four more digits: 90210 or 90210-1234. " + V,
      "Put the hyphen-and-four-digits in a group, then make the whole group optional with ?.", r"\d{5}(-\d{4})?",
      ["90210", "90210-1234", "10001"], ["9021", "902101", "90210-12", "90210-", " 90210"], hidden_bad=["abcde"]),
    v(1, "username", "A username", "Match 3 to 16 characters: letters, digits or underscores, and the first one must be a letter. " + V,
      "One letter first, then {2,15} more word characters.", r"[A-Za-z]\w{2,15}",
      ["bob", "Alice_99", "x_y_z"], ["ab", "9lives", "has space", "this_name_is_way_too_long"], hidden_bad=["-dash"]),
    x(1, "quoted", "Text inside quotes", 'Make findall return what is inside each pair of double quotes, without the quote marks.',
      "A group around the middle makes findall return only the group. Add ? after the repeat so it stops at the first closing quote.", r'"(.*?)"',
      'She said "hello" and then "goodbye" before leaving.', ["hello", "goodbye"]),
    s(1, "collapse", "Collapse the spaces", r"Write a pattern so that re.sub(pattern, ' ', text) turns every run of spaces and tabs into one space.",
      r"\s matches any whitespace character; + means one or more.", r"\s+",
      "too    many     spaces\t\there", " ", "too many spaces here"),
    # ---- 3 Anchors and groups
    v(2, "time", "A 24-hour time", "Match HH:MM with two-digit hours 00-23 and minutes 00-59, like 09:45. " + V,
      "Hours are [01]\\d or 2[0-3]: put that alternation in a group. Minutes are [0-5]\\d.", r"([01]\d|2[0-3]):[0-5]\d",
      ["00:00", "09:45", "23:59", "12:30"], ["24:00", "12:60", "9:45", "12:5", "1230"], hidden_bad=["12:345"]),
    v(2, "date", "A date, YYYY-MM-DD", "Match a date with a four-digit year, a month 01-12 and a day 01-31. (It does not need to know which months are short.) " + V,
      "Month: 0[1-9] or 1[0-2]. Day: 0[1-9], [12]\\d or 3[01].", r"\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])",
      ["2024-02-29", "1999-12-31", "2000-01-01"], ["2024-13-01", "2024-00-10", "2024-05-32", "2024-5-09", "24-05-09", "2024/05/09"], hidden_bad=["2024-05-00"]),
    x(2, "date-parts", "Split dates into parts", "Make findall return, for every date in the text, a list of its [year, month, day].",
      "Put each part in its own group: with several groups findall returns a tuple per match.", r"(\d{4})-(\d{2})-(\d{2})",
      "Born 1990-04-12, hired 2015-09-01, left 2023-11-30.", [["1990", "04", "12"], ["2015", "09", "01"], ["2023", "11", "30"]]),
    x(2, "doubled", "Doubled words", "Make findall return each word that is accidentally repeated twice in a row, once per repeat.",
      r"Capture a word with (\w+), then refer back to it with \1. Add \b so you match whole words.", r"\b(\w+) \1\b",
      "This is is a test of the the system, not not a drill.", ["is", "the", "not"]),
    s(2, "swap", "Swap Last, First", r"Write a pattern so that re.sub(pattern, r'\2 \1', text) turns every Lovelace, Ada into Ada Lovelace.",
      r"Two groups, one for each name, with the comma and space between them.", r"(\w+), (\w+)",
      "Lovelace, Ada\nTuring, Alan", r"\2 \1", "Ada Lovelace\nAlan Turing"),
    # ---- 4 Lookaround and tricks
    v(3, "password", "A password rule", "Match any string of 8 or more characters that contains at least one digit and at least one uppercase letter. " + V,
      "Use two lookaheads at the start, each looking ahead for one requirement: (?=.*\\d) and (?=.*[A-Z]). Then match the characters with .{8,}.", r"(?=.*\d)(?=.*[A-Z]).{8,}",
      ["Passw0rdX", "Abcdefg1", "HELLO2you"], ["password1", "PASSWORD", "Ab1", "abcdefgh", "12345678"]),
    x(3, "prices", "Prices after a dollar sign", "Make findall return just the number of each price (not the $). Prices may have cents.",
      r"A lookbehind (?<=\$) checks for the $ without including it. Use (?:...) for any group you do not want findall to return.", r"(?<=\$)\d+(?:\.\d+)?",
      "Pens cost $4.50, notebooks $12, and a bag is $120.99 (not 15 percent).", ["4.50", "12", "120.99"]),
    v(3, "no-error", "Lines without the word error", "Match any line that does not contain the lowercase word error anywhere. " + V,
      "A negative lookahead (?!...) at the start can forbid something later in the string: (?!.*error).", r"(?!.*error).*",
      ["all good", "warning: low disk", "info ok"], ["error: disk full", "an error occurred", "fatal error"], hidden_bad=["error"]),
    x(3, "log-levels", "Severe log lines", "The text is a log with one entry per line. Make findall return the level (ERROR or WARN) of each entry that has one. The MULTILINE flag is already on, so ^ matches at the start of every line.",
      "Anchor with ^, skip the date and time with \\S+ \\S+, then capture (ERROR|WARN).", r"^\S+ \S+ (ERROR|WARN)",
      "2024-03-01 12:00:01 ERROR disk full\n2024-03-01 12:00:05 INFO ok\n2024-03-01 12:01:00 WARN low memory", ["ERROR", "WARN"], flags="m"),
    # ---- 5 Real-world
    v(4, "ipv4", "An IPv4 address", "Match four numbers from 0 to 255 separated by dots, with no leading zeros (so 192.168.1.1 but not 192.168.01.1). " + V,
      "One octet is 25[0-5] or 2[0-4]\\d or 1\\d\\d or [1-9]?\\d. Write it once, then repeat: (octet\\.){3} followed by one more octet. Use (?:...) groups.",
      r"(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)",
      ["192.168.1.1", "0.0.0.0", "255.255.255.255", "10.0.42.7"],
      ["256.1.1.1", "1.2.3", "1.2.3.4.5", "1.2.3.-4", "192.168.01.1", "300.1.1.1", "1.2.3.999"], hidden_bad=["1.2.3.04"]),
    v(4, "email", "An email address (good enough)", "Match a simple email address: a name (letters, digits, and . _ + -), an @, then a domain with at least one dot. " + V,
      r"[\w.+-]+ before the @; after it, a label then one or more (\.label). Remember to escape the dot.", r"[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+",
      ["ann@example.com", "j.smith+news@mail.co.uk", "a_b-c@sub.domain.org"],
      ["ann@", "@example.com", "ann@example", "ann example@x.com", "ann@@x.com", "ann@x..com"], hidden_bad=["ann@.com"]),
]


def main():
    problems, out = [], []
    ids = [c["id"] for c in CHALLENGES]
    if len(ids) != len(set(ids)):
        problems.append("duplicate challenge id")
    for c in CHALLENGES:
        r = json.loads(regexrun.check(c["solution"], c["flags"], c["spec"]))
        if r.get("error") or not r["ok"]:
            problems.append("%s: the reference solution fails its own tests: %s" % (c["id"], json.dumps(r)[:300]))
        if c["spec"]["kind"] == "sub" and "re.sub(pattern" not in c["task"]:
            problems.append("%s: a sub task must show the call" % c["id"])
        out.append(c)
    if problems:
        print("\n".join(problems))
        return 1
    doc = {"title": "Regex Challenges", "levels": LEVELS, "challenges": out}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("%d challenges in %d levels -> data/regex-challenges.json" % (len(out), len(LEVELS)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
