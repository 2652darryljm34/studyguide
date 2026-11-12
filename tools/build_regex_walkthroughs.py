#!/usr/bin/env python3
"""
Builds the regex walkthroughs into data/regex-walkthroughs.json (shown by walkthrough.html).

    python3 tools/build_regex_walkthroughs.py      (run build_regex_guide.py first: topics are checked against it)

Every highlighted span and every pass/fail cell is computed with Python's own `re`, never typed by hand, so the
walkthroughs cannot disagree with the engine. Visuals are the "match" and "table" types (see walkthrough.js).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_itd140_walkthroughs import step, table, validate  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

OUT = os.path.join(HERE, "..", "data", "regex-walkthroughs.json")
GUIDE = "data/regex-guide.json"


def spans(pattern, text, flags=0):
    return [[m.start(), m.end(), 0] for m in re.finditer(pattern, text, flags) if m.end() > m.start()]


def gspans(pattern, text, flags=0):
    """Whole matches (group 0) plus each capture group (1, 2, ...), for colouring."""
    out = []
    for m in re.finditer(pattern, text, flags):
        out.append([m.start(), m.end(), 0])
        out += [[m.start(i), m.end(i), i] for i in range(1, (m.re.groups or 0) + 1) if m.start(i) >= 0]
    return out


def match(pattern, lines, fn=spans, flags=""):
    """lines: [(text, note)]; spans come from the real engine."""
    for t, _ in lines:
        assert t.isascii() and "\n" not in t, t
    return {"type": "match", "pattern": pattern, "flags": flags,
            "lines": [{"text": t, "spans": fn(pattern, t), "note": n} for t, n in lines]}


def cases_table(pattern, cases):
    """Rows of [string, should match, result]; the cells where the result is wrong are highlighted."""
    rows, hl = [], []
    for i, (s, want) in enumerate(cases):
        got = re.fullmatch(pattern, s) is not None
        rows.append([s, "yes" if want else "no", "match" if got else "no match"])
        if got != want:
            hl.append((i, 2))
    return table(["String", "Should match?", "This pattern"], rows, hl)


def show(v):
    return repr(v)


# ---- 1. phone numbers -----------------------------------------------------------------------------------
PHONE = [("Call 555-0199 today", ""), ("Fax: 555-0123 or 555-0177", ""), ("Room 5550 is closed", ""), ("Part 1555-0199 is back-ordered", "")]
W_PHONE = [
    step("Start with the literal text",
         "The simplest pattern is the text itself. 555 finds every 555, including the ones inside Room 5550 and Part 1555-0199, which are not phone numbers.",
         match("555", PHONE)),
    step("Say what the shape is",
         "A phone number is three digits, a hyphen, four digits. \\d is one digit and {3} means exactly three of them. The room number is no longer matched, but 555-0199 inside Part 1555-0199 still is.",
         match(r"\d{3}-\d{4}", PHONE)),
    step("Add word boundaries",
         "\\b is a position between a word character and a non-word character. Putting it at both ends means the digits cannot be part of a longer run, so Part 1555-0199 is rejected.",
         match(r"\b\d{3}-\d{4}\b", PHONE)),
    step("Group the two halves",
         "Parentheses capture parts of the match so the code can use them separately. Colours show whole match (orange), group 1 (green) and group 2 (blue).",
         match(r"\b(\d{3})-(\d{4})\b", PHONE, gspans)),
]

# ---- 2. greedy versus lazy ------------------------------------------------------------------------------
HTML = "<b>bold</b> and <i>it</i>"
W_GREEDY = [
    step("A greedy pattern grabs too much",
         "The goal is to find each tag. <.+> reads as: a <, then one or more of any character, then a >. The match is the whole string.",
         match(r"<.+>", [(HTML, "1 match")])),
    step("Why: + takes as much as it can",
         "Quantifiers are greedy. The engine lets .+ swallow everything first, then gives characters back one at a time until the rest of the pattern (a >) can match. The first character it gives back is the final > of the string, so one huge match results.",
         table(["Attempt", "What .+ has taken", "Can > come next?"],
               [["1", "everything to the end of the string", "no: nothing is left to match >"],
                ["2", "all but the last character", "the last character is >: yes, the match ends there"]], [(1, 2)])),
    step("A lazy pattern takes as little as it can",
         "Adding ? after the + makes it lazy: .+? takes one character, tries the rest of the pattern, and only takes more if that fails. Now each tag is its own match.",
         match(r"<.+?>", [(HTML, "4 matches")])),
    step("Often better: say what you mean",
         "[^>]+ means one or more characters that are not >. It cannot run past the end of a tag, so no laziness is needed and it is faster for the engine.",
         match(r"<[^>]+>", [(HTML, "4 matches")])),
]
# ---- 3. groups --------------------------------------------------------------------------------------------
DATES = "Due 2024-03-15 and 2025-12-01"
DATE_P = r"(\d{4})-(\d{2})-(\d{2})"
first = re.search(r"(?P<y>\d{4})-(?P<m>\d{2})-(?P<d>\d{2})", DATES)
W_GROUPS = [
    step("Without groups: just the whole match",
         "This finds both dates, but they come back as plain strings.",
         match(r"\d{4}-\d{2}-\d{2}", [(DATES, "")])),
    step("Parentheses capture parts",
         "Each (...) is a numbered group, counted by its opening parenthesis from the left. Orange is the whole match, green the year, blue the month, purple the day.",
         match(DATE_P, [(DATES, "")], gspans)),
    step("findall now returns the groups",
         "With groups in the pattern, re.findall returns a tuple of the groups for each match and no longer returns the whole match. This surprises everyone once.",
         table(["Call", "Returns"], [["re.findall(r'\\d{4}-\\d{2}-\\d{2}', text)", show(re.findall(r"\d{4}-\d{2}-\d{2}", DATES))],
                                     ["re.findall(r'(\\d{4})-(\\d{2})-(\\d{2})', text)", show(re.findall(DATE_P, DATES))]], [(1, 1)])),
    step("Name the groups",
         "(?P<name>...) gives a group a name as well as a number, so code reads m.group('y') instead of m.group(1).",
         table(["Expression", "Value"],
               [["m.group('y')", show(first.group("y"))], ["m.group('m')", show(first.group("m"))], ["m.groupdict()", show(first.groupdict())]], [(2, 1)])),
    step("Use groups to rearrange text",
         "In re.sub, \\1, \\2, \\3 in the replacement stand for the groups. Here the order is reversed to day/month/year.",
         table(["Before", "After re.sub(pattern, r'\\3/\\2/\\1', text)"], [[DATES, re.sub(DATE_P, r"\3/\2/\1", DATES)]], [(0, 1)])),
]

# ---- 4. anchors and the match functions --------------------------------------------------------------------
TRY = ["123", "12345", "a123b"]


def fn_cells(p):
    def cell(f, s):
        m = f(p, s)
        return show(m.group()) if m else "None"
    return [[show(s), cell(re.search, s), cell(re.match, s), cell(re.fullmatch, s)] for s in TRY]


W_ANCHORS = [
    step("Searching finds it anywhere",
         "re.search looks for the pattern anywhere in the string. \\d{3} finds three digits inside 12345 and inside a123b, which is fine for finding but wrong for checking a whole value.",
         match(r"\d{3}", [(s, "") for s in TRY])),
    step("Three functions, three questions",
         "re.search: is it anywhere? re.match: does it match at the start? re.fullmatch: does the whole string match? For validation you almost always want fullmatch.",
         table(["String", "re.search", "re.match", "re.fullmatch"], fn_cells(r"\d{3}"), [(0, 3), (1, 3), (2, 3)])),
    step("Or anchor the pattern",
         "^ matches only at the start and $ only at the end. ^\\d{3}$ with re.search behaves like fullmatch for these strings.",
         match(r"^\d{3}$", [(s, "") for s in TRY])),
    step("The trailing-newline trap",
         "$ also matches just before a final newline, so ^\\d{3}$ accepts '123\\n'. \\Z means the very end of the string, and re.fullmatch has no such trap.",
         table(["String", r"re.search(r'^\d{3}$')", r"re.search(r'^\d{3}\Z')", r"re.fullmatch(r'\d{3}')"],
               [[show(s)] + [show(f(p, s).group()) if f(p, s) else "None" for f, p in ((re.search, r"^\d{3}$"), (re.search, r"^\d{3}\Z"), (re.fullmatch, r"\d{3}"))]
                for s in ("123", "123\n", "1234")], [(1, 1)])),
]

# ---- 5. growing an email pattern -----------------------------------------------------------------------------
EMAILS = [("ann@example.com", True), ("j.smith+news@mail.co.uk", True), ("a_b-c@sub.domain.org", True), ("me@my-site.com", True),
          ("ann@", False), ("@example.com", False), ("ann@example", False), ("ann example@x.com", False), ("ann@@x.com", False), ("ann@x..com", False)]
E1 = r"\w+@\w+\.\w+"
E2 = r"[\w.+-]+@\w+\.\w+"
E3 = r"[\w.+-]+@\w+(?:\.\w+)+"
E4 = r"[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+"
W_EMAIL = [
    step("Stage 1: the obvious shape",
         "words, @, words, a dot, words: " + E1 + ". It accepts the simplest address but rejects three real ones (highlighted): dots, + and - in names, a domain with several parts, and a hyphen in the domain.",
         cases_table(E1, EMAILS)),
    step("Stage 2: allow more in the name",
         "Replace \\w+ before the @ with [\\w.+-]+, a set of word characters plus . + and -. Inside [] those three are literal. j.smith+news now works.",
         cases_table(E2, EMAILS)),
    step("Stage 3: any number of domain parts",
         "(?:\\.\\w+)+ means: a dot and a word, repeated one or more times. The (?:...) group is non-capturing: it groups without creating a numbered group. mail.co.uk and sub.domain.org now pass, but my-site.com does not.",
         cases_table(E3, EMAILS)),
    step("Stage 4: hyphens in domain parts",
         "Domain labels may contain letters, digits and hyphens but not underscores, so \\w is replaced by [A-Za-z0-9-]. Every good address passes and every bad one is rejected.",
         cases_table(E4, EMAILS)),
    step("Good enough, but not perfect",
         "Real email rules are much looser than this, and a pattern can only check the shape, never that the mailbox exists. For sign-ups, use a simple pattern like this one and then send a confirmation email.",
         table(["Stage", "Pattern"], [["1", E1], ["2", E2], ["3", E3], ["4", E4]], [(3, 1)])),
]

# ---- 6. password lookaheads -----------------------------------------------------------------------------------
PWS = [("Passw0rdX", True), ("Abcdefg1", True), ("password1", False), ("PASSWORD", False), ("Ab1", False), ("abcdefgh", False)]
P1 = r".{8,}"
P2 = r"(?=.*\d).{8,}"
P3 = r"(?=.*\d)(?=.*[A-Z]).{8,}"
W_PASSWORD = [
    step("Rule 1: at least 8 characters",
         "Start with length: .{8,} means any character, 8 or more times. Highlighted cells are wrong answers: it also accepts PASSWORD, password1 and abcdefgh.",
         cases_table(P1, PWS)),
    step("Rule 2: it needs a digit (lookahead)",
         "(?=.*\\d) is a lookahead: a check at the current position that looks ahead for 'anything, then a digit' and then consumes nothing. If the check passes, matching continues from the same place with .{8,}.",
         cases_table(P2, PWS)),
    step("Rule 3: it needs an uppercase letter",
         "A second lookahead, (?=.*[A-Z]), is added in front. Lookaheads do not consume characters, so all of them check the whole string from the start. Every row is now right.",
         cases_table(P3, PWS)),
    step("Reading the finished pattern",
         "Each requirement is its own lookahead, so adding a rule is just adding a (?=...) and the order of the rules does not matter.",
         table(["Part", "Meaning"], [["(?=.*\\d)", "somewhere ahead there is a digit"], ["(?=.*[A-Z])", "somewhere ahead there is an uppercase letter"],
                                     [".{8,}", "then match 8 or more characters (this is the part that consumes the string)"]], [(2, 1)])),
]

# ---- 7. catastrophic backtracking ----------------------------------------------------------------------------
W_CATA = [
    step("A harmless-looking pattern",
         "(a+)+$ means: one or more groups of a's, then the end of the string. On aaaa it matches at once. The trouble comes when the match must fail, such as aaaa followed by b.",
         table(["String", "re.search(r'(a+)+$')"], [["'aaaa'", show(re.search(r"(a+)+$", "aaaa").group())], ["'aaaab'", show(re.search(r"(a+)+$", "aaaab"))]], [(1, 1)])),
    step("Many ways to split the same run",
         "A run of n a's can be divided into groups in 2^(n-1) ways: aaaa could be a|a|a|a, aa|aa, a|aaa and so on. When the match fails, the engine backtracks and tries every split before giving up, so the work roughly doubles with every extra a.",
         table(["a's before the b", "Ways to split them"], [[str(n), "{:,}".format(2 ** (n - 1))] for n in (4, 10, 20, 30)], [(3, 1)])),
    step("The fix: remove the nesting",
         "a+$ matches the same strings but cannot split the run, so a failure is found in a single pass. The rule of thumb: be suspicious of a quantifier inside a group that itself has a quantifier.",
         table(["Pattern", "Behaviour on 30 a's then b"], [["(a+)+$", "effectively never finishes"], ["a+$", "fails instantly"]], [(1, 1)])),
    step("Try it safely",
         "In the regex playground, enter (a+)+$ with the text aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab. It stops the pattern after 3 seconds and explains what happened. Your own programs have no such safety net, so avoid nested quantifiers on text you do not control.",
         table(["Where", "What happens"], [["Playground", "stopped after 3 seconds"], ["Your Python script", "the program hangs"]], [(1, 1)])),
]

WALKTHROUGHS = [
    ("phone", "Finding phone numbers, one refinement at a time", "3. Quantifiers", "From the literal 555 to a pattern with boundaries and groups.", W_PHONE),
    ("greedy", "Greedy versus lazy", "3. Quantifiers", "Why <.+> swallows the whole line and how to fix it.", W_GREEDY),
    ("anchors", "search, match, fullmatch and anchors", "4. Anchors, boundaries and the match functions", "Which function answers which question, and the trailing-newline trap.", W_ANCHORS),
    ("groups", "Groups: capture, name and rearrange", "5. Groups, alternation and backreferences", "Pull a date apart, name the pieces, and put them back in a new order.", W_GROUPS),
    ("password", "A password rule, one lookahead at a time", "6. Lookaround and flags", "Each requirement is one lookahead; watch the wrong answers disappear.", W_PASSWORD),
    ("email", "Growing an email pattern", "8. Building complex patterns", "Four stages, each fixing the failures of the one before.", W_EMAIL),
    ("backtracking", "Catastrophic backtracking", "8. Building complex patterns", "Why (a+)+$ can hang a program, and the fix.", W_CATA),
]


def main():
    problems = []
    with open(os.path.join(HERE, "..", GUIDE), encoding="utf-8") as fh:
        sections = [s["name"] for s in json.load(fh)["sections"]]
    out = []
    for w_id, title, topic, blurb, steps in WALKTHROUGHS:
        if topic not in sections:
            problems.append("%s: topic %r is not a guide section" % (w_id, topic))
        validate(w_id, steps, problems)
        out.append({"id": w_id, "title": title, "topic": topic, "blurb": blurb, "steps": steps})
    if problems:
        print("\n".join(problems))
        return 1
    doc = {"title": "Regex Walkthroughs", "guideFile": GUIDE,
           "links": [{"href": "regex.html", "text": "Playground"}, {"href": "regex-challenges.html", "text": "Challenges"},
                     {"href": "review.html?file=data%2Fregex-cheatsheet.json", "text": "Cheat sheet"}],
           "walkthroughs": out}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("%d walkthroughs, %d steps -> data/regex-walkthroughs.json" % (len(out), sum(len(w["steps"]) for w in out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
