#!/usr/bin/env python3
"""
Builds the two regex study guides:
  data/regex-guide.json       step-by-step lessons, from a first literal match to complex patterns
  data/regex-cheatsheet.json  a compact one-page reference with examples

    python3 tools/build_regex_guide.py

Every Python example is EXECUTED here and its real output is written into the guide as comment lines, so an example
can never show output Python would not produce. Shown with review.html.
"""
import contextlib
import io
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")


def run(code):
    """A code block: the code, then what it printed as '# ...' lines (run for real)."""
    code = code.strip("\n")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(code, {})
    out = buf.getvalue().rstrip("\n")
    return {"type": "code", "text": code + ("\n" + "\n".join("# " + l for l in out.split("\n")) if out else "")}


def code(text):
    return {"type": "code", "text": text.strip("\n")}


def H(t): return {"type": "heading", "text": t}
def SH(t): return {"type": "subheading", "text": t}
def P(t): return {"type": "paragraph", "text": t}
def L(*items): return {"type": "list", "items": list(items)}
def T(headers, *rows): return {"type": "table", "headers": headers, "rows": [list(r) for r in rows]}
def N(label, t): return {"type": "note", "label": label, "text": t}


def ex(pattern, text, fn="findall"):
    """A cheat-sheet cell: the result of re.<fn>(pattern, text), computed."""
    f = getattr(re, fn)
    r = f(pattern, text)
    if hasattr(r, "group"):
        r = r.group()
    return "`%s` on `%s` gives `%r`" % (pattern, text, r)


S1 = "1. First steps: literal text"
S2 = "2. Character classes"
S3 = "3. Quantifiers"
S4 = "4. Anchors, boundaries and the match functions"
S5 = "5. Groups, alternation and backreferences"
S6 = "6. Lookaround and flags"
S7 = "7. The re module toolbox"
S8 = "8. Building complex patterns"

LESSONS = [
    (S1, [
        P("A **regular expression** (regex) is a pattern that describes a set of strings. You give Python a pattern and some text, and it finds where the pattern fits. In Python the tools live in the `re` module. Everything in this guide is real Python: the `# ...` lines under each example are what it printed."),
        N("Try it:", "Open the **Regex playground** from the class page and paste any example in as you read. It runs the same Python `re` module."),
        H("Your first match"),
        P("The simplest pattern is just the text you want. `re.search` looks for it anywhere in the string and returns a **match object** (or `None`)."),
        run('''
import re
m = re.search(r"cat", "The cat sat")
print(m)
print(m.group(), m.start(), m.end())
'''),
        P("`m.group()` is the text that matched, `m.start()` is where it began and `m.end()` is one past the last character."),
        H("No match gives None"),
        run('''
import re
print(re.search(r"dog", "The cat sat"))
if re.search(r"cat", "The cat sat"):
    print("found a cat")
'''),
        P("A match object is truthy and `None` is falsy, so `if re.search(...):` is the normal way to ask yes-or-no."),
        H("Always write patterns as raw strings"),
        P("Regex uses the backslash a lot (`\\d`, `\\b`). Python strings also use it (`\\n`). A raw string, written `r\"...\"`, tells Python to leave backslashes alone and hand them to `re` unchanged."),
        run('''
print(len("\\n"), len(r"\\n"))
'''),
        P("The normal string `\"\\n\"` is one character (a newline); the raw string `r\"\\n\"` is two (a backslash and an n). Get in the habit now: **every pattern starts with r**."),
        H("Finding every match"),
        run('''
import re
print(re.findall(r"an", "banana"))
'''),
        P("`re.findall` returns a list of every non-overlapping match, left to right."),
        H("Special characters"),
        P("Most letters and digits match themselves. A few characters have a special meaning: `. ^ $ * + ? { } [ ] \\ | ( )`. To match one of them literally, put a backslash in front."),
        run('''
import re
print(bool(re.search(r"3.14", "3x14")))
print(bool(re.search(r"3\\.14", "3x14")))
print(re.escape("3.14 (approx)"))
'''),
        P("The unescaped `.` matched the `x`, because a dot means *any character*. `re.escape` adds the backslashes for you when you have a string of plain text to find."),
        N("Case:", "Patterns are case sensitive: `cat` does not match `Cat`. The `re.IGNORECASE` flag (lesson 6) changes that."),
    ]),
    (S2, [
        P("A **character class** matches **one** character out of a set. This is the first real step beyond literal text."),
        H("The dot: any character"),
        run('''
import re
print(re.findall(r"c.t", "cat cut c t cart"))
'''),
        P("`.` matches any one character except a newline (the `re.DOTALL` flag changes that). It matched the space in `c t`."),
        H("Sets with square brackets"),
        T(["Pattern", "Matches one character that is..."],
          ["`[abc]`", "a, b or c"],
          ["`[a-z]`", "any lowercase letter (a **range**)"],
          ["`[A-Za-z0-9]`", "any letter or digit (ranges combine)"],
          ["`[^0-9]`", "anything that is **not** a digit (`^` first means *not*)"]),
        run('''
import re
print(re.findall(r"[aeiou]", "regular expressions"))
print(re.findall(r"[^aeiou\\s]", "hi you"))
'''),
        N("Inside brackets:", "most special characters are literal, so `[.+*]` matches a dot, a plus or a star. Put `-` first or last (or write `\\-`) to mean a hyphen, and `^` anywhere but first is just a caret."),
        H("Shorthand classes"),
        T(["Shorthand", "Matches", "Same as"],
          ["`\\d`", "a digit", "`[0-9]`"],
          ["`\\D`", "a non-digit", "`[^0-9]`"],
          ["`\\w`", "a word character: letter, digit or underscore", "`[A-Za-z0-9_]`"],
          ["`\\W`", "a non-word character", "`[^A-Za-z0-9_]`"],
          ["`\\s`", "whitespace: space, tab, newline...", "`[ \\t\\n\\r\\f\\v]`"],
          ["`\\S`", "a non-whitespace character", "`[^ \\t\\n\\r\\f\\v]`"]),
        run('''
import re
print(re.findall(r"\\d", "Room 4B, floor 12"))
print(re.findall(r"\\w", "a_b-c"))
'''),
        N("Unicode:", "for text (`str`) patterns, `\\d` and `\\w` also match digits and letters from other alphabets, such as `é`. Add `re.ASCII` if you want only the ASCII ones."),
    ]),
    (S3, [
        P("A **quantifier** says how many times the thing **just before it** may repeat. So far each element matched once; quantifiers let one element match many characters."),
        T(["Quantifier", "Means"],
          ["`*`", "zero or more"],
          ["`+`", "one or more"],
          ["`?`", "zero or one (optional)"],
          ["`{3}`", "exactly 3"],
          ["`{2,4}`", "between 2 and 4"],
          ["`{2,}`", "2 or more"]),
        run('''
import re
print(re.findall(r"\\d+", "a1 b22 c333"))
print(re.findall(r"colou?r", "color colour colouur"))
print(re.findall(r"\\d{3}-\\d{4}", "555-0199 and 55-0100"))
'''),
        H("A quantifier applies to one thing"),
        P("`ab+` means an `a` and then one or more `b`s. To repeat both letters, group them: `(ab)+`."),
        run('''
import re
print(re.search(r"ab+", "ababab").group())
print(re.search(r"(ab)+", "ababab").group())
'''),
        H("Greedy versus lazy"),
        P("Quantifiers are **greedy**: they match as much as they can. Add `?` after a quantifier to make it **lazy** (match as little as possible)."),
        run('''
import re
html = "<b>bold</b> and <i>it</i>"
print(re.findall(r"<.+>", html))
print(re.findall(r"<.+?>", html))
'''),
        T(["Greedy", "Lazy"],
          ["`*`", "`*?`"], ["`+`", "`+?`"], ["`?`", "`??`"], ["`{n,m}`", "`{n,m}?`"]),
        P("Often a more precise class beats laziness: `<[^>]+>` means a `<`, then characters that are not `>`, then `>`."),
        N("See it step by step:", "the **Greedy versus lazy** and **Finding phone numbers** walkthroughs show the engine's choices one at a time."),
    ]),
    (S4, [
        P("So far a pattern could match anywhere. **Anchors** pin the match to a position, and the choice of function decides how much of the string must be matched."),
        H("Anchors and boundaries"),
        T(["Pattern", "Matches the position..."],
          ["`^`", "at the start of the string (of each line with `re.MULTILINE`)"],
          ["`$`", "at the end of the string, or just before a final newline (of each line with `re.MULTILINE`)"],
          ["`\\A` and `\\Z`", "the very start and the very end of the string, always"],
          ["`\\b`", "a **word boundary**: between a word character and a non-word character (or an edge)"],
          ["`\\B`", "anywhere that is **not** a word boundary"]),
        run('''
import re
print(re.findall(r"\\bcat\\b", "cat concatenate cat's"))
print(re.findall(r"cat", "cat concatenate cat's"))
'''),
        P("`\\b` takes up no characters: it only checks the position. It stops `cat` from matching inside `concatenate`."),
        H("search, match and fullmatch"),
        T(["Function", "Question it answers"],
          ["`re.search(p, s)`", "Is the pattern **anywhere** in the string?"],
          ["`re.match(p, s)`", "Does the pattern match **at the start**?"],
          ["`re.fullmatch(p, s)`", "Does the pattern match the **whole** string?"]),
        run('''
import re
for s in ["123", "12345", "a123b"]:
    print(s, re.search(r"\\d{3}", s), re.match(r"\\d{3}", s), re.fullmatch(r"\\d{3}", s))
'''),
        N("Validating?", "To check that a whole value is valid, use `re.fullmatch` (or anchor with `^...$`). Using `re.search` for validation is the most common beginner bug: `a123b` contains three digits, so it passes."),
        H("The trailing newline trap"),
        run('''
import re
print(bool(re.search(r"^\\d{3}$", "123\\n")))
print(bool(re.search(r"^\\d{3}\\Z", "123\\n")))
print(bool(re.fullmatch(r"\\d{3}", "123\\n")))
'''),
        P("`$` also matches before a final newline, so `^\\d{3}$` accepts `\"123\\n\"`. `\\Z` and `re.fullmatch` do not."),
    ]),
    (S5, [
        P("Parentheses do three jobs: they **group** parts of a pattern, they **capture** the matched text so you can use it, and (with `|`) they limit an **or**."),
        H("Alternation: or"),
        run('''
import re
print(re.findall(r"cat|dog", "a cat and a dog and a cow"))
print(re.findall(r"gr(?:a|e)y", "gray grey groy"))
'''),
        N("Precedence:", "`|` has the lowest priority. `^cat|dog$` means (starts with cat) OR (ends with dog). To say *the whole string is cat or dog*, write `^(cat|dog)$`."),
        H("Capturing groups"),
        P("Each `(...)` is a numbered group, counted by its opening parenthesis from the left. Group 0 is the whole match."),
        run('''
import re
m = re.search(r"(\\d{4})-(\\d{2})-(\\d{2})", "Due 2024-03-15.")
print(m.group(0))
print(m.group(1), m.group(2), m.group(3))
print(m.groups())
'''),
        H("findall and groups"),
        P("When a pattern has groups, `re.findall` returns **the groups**, not the whole match: one group gives a list of strings, several groups give a list of tuples."),
        run('''
import re
text = "2024-03-15 and 2025-12-01"
print(re.findall(r"\\d{4}-\\d{2}-\\d{2}", text))
print(re.findall(r"(\\d{4})-\\d{2}-\\d{2}", text))
print(re.findall(r"(\\d{4})-(\\d{2})-(\\d{2})", text))
'''),
        H("Non-capturing groups"),
        P("When you only need grouping, use `(?:...)`. It groups without making a numbered group, which keeps `findall` returning whole matches."),
        run('''
import re
print(re.findall(r"(?:\\d{1,3}\\.){3}\\d{1,3}", "hosts 10.0.0.1 and 192.168.1.20"))
'''),
        H("Named groups"),
        P("`(?P<name>...)` names a group. Note the **P**: that is Python's spelling."),
        run('''
import re
m = re.search(r"(?P<user>\\w+)@(?P<host>[\\w.]+)", "mail ann@example.com now")
print(m.group("user"), m.group("host"))
print(m.groupdict())
'''),
        H("Backreferences"),
        P("`\\1` inside a pattern means *the same text group 1 matched*. It finds repeats. (A named group is repeated with `(?P=name)`.)"),
        run('''
import re
print(re.findall(r"\\b(\\w+) \\1\\b", "This is is a test of the the system"))
'''),
    ]),
    (S6, [
        P("**Lookarounds** check what is next to the current position without including it in the match. **Flags** change how the whole pattern behaves."),
        H("Lookahead and lookbehind"),
        T(["Syntax", "Name", "Passes when..."],
          ["`(?=...)`", "positive lookahead", "the text **after** this point matches `...`"],
          ["`(?!...)`", "negative lookahead", "the text after this point does **not** match `...`"],
          ["`(?<=...)`", "positive lookbehind", "the text **before** this point matches `...`"],
          ["`(?<!...)`", "negative lookbehind", "the text before this point does **not** match `...`"]),
        run('''
import re
prices = "Pens $4.50, bags $120, 15 percent off."
print(re.findall(r"(?<=\\$)\\d+(?:\\.\\d+)?", prices))
print(re.findall(r"\\d+(?= percent)", prices))
print(re.findall(r"\\b(?!the\\b)\\w+", "the cat and the dog"))
'''),
        N("Python limit:", "a lookbehind must be a **fixed width**: `(?<=\\$)` is fine, `(?<=a+)` is an error."),
        H("Lookahead as an AND"),
        P("Because a lookahead consumes nothing, several of them in a row each check the same text from the same place. That makes them a clean way to say *this AND that*. This password rule needs 8+ characters, a digit and an uppercase letter:"),
        run('''
import re
rule = r"(?=.*\\d)(?=.*[A-Z]).{8,}"
for pw in ["Passw0rdX", "password1", "Ab1"]:
    print(pw, bool(re.fullmatch(rule, pw)))
'''),
        H("Flags"),
        T(["Flag", "Inline", "Effect"],
          ["`re.IGNORECASE` / `re.I`", "`(?i)`", "ignore upper and lower case"],
          ["`re.MULTILINE` / `re.M`", "`(?m)`", "`^` and `$` match at every line, not just the string ends"],
          ["`re.DOTALL` / `re.S`", "`(?s)`", "`.` also matches a newline"],
          ["`re.VERBOSE` / `re.X`", "`(?x)`", "ignore spaces and allow `#` comments inside the pattern"],
          ["`re.ASCII` / `re.A`", "`(?a)`", "`\\w`, `\\d`, `\\s`, `\\b` use ASCII only"]),
        run('''
import re
print(re.findall(r"cat", "Cat CAT cat", re.I))
print(re.findall(r"^\\w+", "one two\\nthree four", re.M))
print(re.findall(r"^\\w+", "one two\\nthree four"))
print(re.findall(r"a.b", "a\\nb", re.S))
print(re.findall(r"cat", "Cat CAT cat", re.I | re.M))
'''),
        P("Combine flags with `|`."),
        H("Verbose patterns"),
        P("Long patterns become readable with `re.VERBOSE`: whitespace is ignored and `#` starts a comment. Use `\\ ` or `[ ]` if you need a literal space."),
        run('''
import re
phone = re.compile(r"""
    \\(?(\\d{3})\\)?   # area code, optional parentheses
    [-. ]?          # optional separator
    (\\d{3})         # exchange
    [-. ]?
    (\\d{4})         # line number
""", re.X)
print(phone.search("Call (555) 010-0199").groups())
'''),
    ]),
    (S7, [
        P("Everything so far used `re.search` and `re.findall`. Here is the whole toolbox."),
        T(["Function", "Returns", "Use it to..."],
          ["`re.search(p, s)`", "match or `None`", "find the first match anywhere"],
          ["`re.match(p, s)`", "match or `None`", "match at the start"],
          ["`re.fullmatch(p, s)`", "match or `None`", "check the whole string"],
          ["`re.findall(p, s)`", "list of strings (or tuples)", "get all matches"],
          ["`re.finditer(p, s)`", "iterator of match objects", "get all matches with positions and groups"],
          ["`re.sub(p, repl, s)`", "new string", "replace matches"],
          ["`re.subn(p, repl, s)`", "(new string, count)", "replace and count"],
          ["`re.split(p, s)`", "list of strings", "split on a pattern"],
          ["`re.compile(p)`", "pattern object", "reuse a pattern (has the same methods)"],
          ["`re.escape(s)`", "string", "make plain text safe to use in a pattern"]),
        H("The match object"),
        T(["Method", "Gives"],
          ["`m.group()` / `m.group(0)`", "the whole matched text"],
          ["`m.group(1)`, `m.group('name')`", "one group's text (`None` if it did not take part)"],
          ["`m.groups()`", "tuple of all groups"],
          ["`m.groupdict()`", "dict of the named groups"],
          ["`m.start()`, `m.end()`, `m.span()`", "positions in the string"]),
        run('''
import re
for m in re.finditer(r"\\d+", "a1 b22 c333"):
    print(m.group(), m.span())
'''),
        H("Replacing with sub"),
        P("In the replacement, `\\1` or `\\g<1>` (or `\\g<name>`) insert a group. You can also pass a **function**, which receives each match object."),
        run('''
import re
print(re.sub(r"\\s+", " ", "too    many   spaces"))
print(re.sub(r"(\\w+), (\\w+)", r"\\2 \\1", "Lovelace, Ada"))
print(re.sub(r"\\d+", lambda m: str(int(m.group()) * 2), "3 apples and 10 pears"))
print(re.subn(r"a", "A", "banana"))
'''),
        H("Splitting"),
        run('''
import re
print(re.split(r"[,;]\\s*", "a, b;c,  d"))
'''),
        H("compile"),
        P("`re.compile` builds the pattern once so you can reuse it (and keep flags with it). Python also caches recent patterns, so compile is mostly about readability."),
        run('''
import re
word = re.compile(r"\\b[a-z]+\\b", re.I)
print(word.findall("Hello big World"))
print(word.sub("*", "Hello big World"))
'''),
    ]),
    (S8, [
        P("Complex patterns are not written in one go. Build them in small stages and test each stage on strings that **should** match and strings that **should not**."),
        H("A method that works"),
        L("Write down 3 or more **valid** examples and 3 or more **invalid** ones first.",
          "Start with the simplest pattern that matches the valid ones.",
          "Run it against the invalid ones, and tighten it only where a wrong one slips through.",
          "Decide whether you are **validating** (use `re.fullmatch`) or **extracting** (use `findall` or `finditer`).",
          "Name groups and use `re.VERBOSE` with comments once it gets long."),
        H("Worked example: an IPv4 address"),
        P("Four numbers from 0 to 255 separated by dots. First try, just the shape:"),
        run('''
import re
shape = r"\\d{1,3}(?:\\.\\d{1,3}){3}"
for ip in ["192.168.1.1", "256.1.1.1", "1.2.3"]:
    print(ip, bool(re.fullmatch(shape, ip)))
'''),
        P("`256.1.1.1` slips through. Each number must be 0-255, which is: `25[0-5]` or `2[0-4]\\d` or `1\\d\\d` or `[1-9]?\\d`."),
        run('''
import re
octet = r"(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)"
ip = re.compile(rf"{octet}(?:\\.{octet}){{3}}")
for s in ["192.168.1.1", "256.1.1.1", "1.2.3", "192.168.01.1"]:
    print(s, bool(ip.fullmatch(s)))
'''),
        P("Building the pattern from a Python variable keeps it readable. `rf\"...\"` is a raw f-string; `{{3}}` writes a literal `{3}`."),
        H("Worked example: log lines with named groups"),
        run('''
import re
line_re = re.compile(r"""
    ^(?P<date>\\d{4}-\\d{2}-\\d{2})\\s+
    (?P<time>\\d{2}:\\d{2}:\\d{2})\\s+
    (?P<level>ERROR|WARN|INFO)\\s+
    (?P<msg>.*)$
""", re.X | re.M)
log = "2024-03-01 12:00:01 ERROR disk full\\n2024-03-01 12:00:05 INFO ok"
for m in line_re.finditer(log):
    print(m.group("level"), "|", m.group("msg"))
'''),
        H("Patterns that are good enough"),
        T(["For", "Pattern"],
          ["Hex colour", "`#[0-9a-fA-F]{6}`"],
          ["US ZIP (+4 optional)", "`\\d{5}(?:-\\d{4})?`"],
          ["24-hour time", "`(?:[01]\\d|2[0-3]):[0-5]\\d`"],
          ["Date shape YYYY-MM-DD", "`\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])`"],
          ["Username, 3-16 chars", "`[A-Za-z]\\w{2,15}`"],
          ["Simple email", "`[\\w.+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+`"]),
        N("Be honest about limits:", "the date pattern accepts `2023-02-31`, and no email pattern proves a mailbox exists. A regex checks **shape**. For real validation, parse with `datetime` or send a confirmation email."),
        H("When not to use a regex"),
        L("**Nested structures** such as HTML, JSON or balanced parentheses. Use a parser (`html.parser`, `json`).",
          "**Simple fixed text**: `\"abc\" in s`, `s.startswith(...)`, `s.split(\",\")` are clearer and faster.",
          "**Dates and numbers**: parse with `datetime` or `int()` once the shape is checked."),
        H("Catastrophic backtracking"),
        P("A quantifier inside a group that is itself repeated, like `(a+)+$`, can make Python try an exponential number of ways to split the text when the match fails, and the program appears to hang. Avoid nested quantifiers on input you do not control. The **Catastrophic backtracking** walkthrough shows why."),
    ]),
]

LESSON_GUIDE = {
    "title": "Regex in Python: Step-by-Step Guide",
    "description": "Baby steps to complex patterns: literals, character classes, quantifiers, anchors, groups, lookaround, flags, the re module, and building and testing real-world patterns.",
    "sections": [{"name": n, "blocks": b} for n, b in LESSONS],
}

# ---- cheat sheet -------------------------------------------------------------------------------------------------
SHEET = [
    ("Characters and classes", [
        T(["Pattern", "Matches", "Example"],
          ["`abc`", "the literal text", ex("abc", "xabcx")],
          ["`.`", "any character except newline", ex("c.t", "cat c-t ct")],
          ["`[abc]`", "one of a, b, c", ex("[abc]", "cabbage")],
          ["`[a-z]`", "a range", ex("[a-c]", "abcdef")],
          ["`[^abc]`", "anything but a, b, c", ex("[^abc]", "abcxyz")],
          ["`\\d` `\\D`", "digit / non-digit", ex(r"\d", "a1b2")],
          ["`\\w` `\\W`", "word char / non-word char", ex(r"\w+", "hi there!")],
          ["`\\s` `\\S`", "whitespace / non-whitespace", ex(r"\S+", "a  b c")],
          ["`\\.` `\\\\` `\\(`", "a literal special character", ex(r"\.", "a.b.c")]),
    ]),
    ("Quantifiers", [
        T(["Pattern", "Meaning", "Example"],
          ["`x*`", "0 or more", ex("ab*", "a ab abb")],
          ["`x+`", "1 or more", ex(r"\d+", "a1 b22")],
          ["`x?`", "0 or 1", ex("colou?r", "color colour")],
          ["`x{3}`", "exactly 3", ex(r"\d{3}", "1234567")],
          ["`x{2,4}`", "2 to 4", ex(r"\d{2,4}", "1 22 333 4444 55555")],
          ["`x*?` `x+?` `x??`", "lazy: as few as possible", ex("<.+?>", "<a><b>")],
          ["`x+` (greedy)", "as many as possible", ex("<.+>", "<a><b>")]),
    ]),
    ("Anchors and boundaries", [
        T(["Pattern", "Meaning", "Example"],
          ["`^`", "start of string (line with `re.M`)", ex(r"^\w+", "one two")],
          ["`$`", "end of string (or before a final newline)", ex(r"\w+$", "one two")],
          ["`\\A` `\\Z`", "very start / very end", ex(r"\Aone", "one one")],
          ["`\\b`", "word boundary", ex(r"\bcat\b", "cat concat cat")],
          ["`\\B`", "not a word boundary", ex(r"\Bcat", "cat concat")]),
    ]),
    ("Groups and alternation", [
        T(["Pattern", "Meaning", "Example"],
          ["`a|b`", "a or b", ex("cat|dog", "a cat, a dog")],
          ["`(...)`", "capturing group", ex(r"(\d+)-(\d+)", "10-20")],
          ["`(?:...)`", "grouping only, no capture", ex(r"(?:ab)+", "ababab")],
          ["`(?P<n>...)`", "named group", "`m.group('n')`, `m.groupdict()`"],
          ["`\\1`", "repeat group 1's text", ex(r"(\w)\1", "hello bookkeeper")],
          ["`(?P=n)`", "repeat named group n's text", "`(?P<c>\\w)(?P=c)` is the same as `(\\w)\\1`"]),
    ]),
    ("Lookaround", [
        T(["Pattern", "Passes when", "Example"],
          ["`(?=x)`", "x is next", ex(r"\w+(?=!)", "hi! yo")],
          ["`(?!x)`", "x is not next", ex(r"\d+(?!\d|px)", "10px 20em")],
          ["`(?<=x)`", "x is just before", ex(r"(?<=\$)\d+", "$5 and 6")],
          ["`(?<!x)`", "x is not just before", ex(r"(?<!\$)\b\d+", "$5 and 6")]),
    ]),
    ("Flags", [
        T(["Flag", "Inline", "Effect"],
          ["`re.I`", "`(?i)`", "ignore case"],
          ["`re.M`", "`(?m)`", "`^` `$` at each line"],
          ["`re.S`", "`(?s)`", "`.` matches newline"],
          ["`re.X`", "`(?x)`", "verbose: spaces ignored, `#` comments"],
          ["`re.A`", "`(?a)`", "ASCII-only `\\w` `\\d` `\\s` `\\b`"]),
        P("Combine with `|`: `re.compile(r\"...\", re.I | re.M)`."),
    ]),
    ("Functions", [
        T(["Call", "Returns"],
          ["`re.search(p, s)`", "first match anywhere, or `None`"],
          ["`re.match(p, s)`", "match at the start, or `None`"],
          ["`re.fullmatch(p, s)`", "match of the whole string, or `None`"],
          ["`re.findall(p, s)`", "list of matches (the groups, if the pattern has any)"],
          ["`re.finditer(p, s)`", "iterator of match objects"],
          ["`re.sub(p, repl, s)`", "string with matches replaced (`\\1`, `\\g<name>`, or a function)"],
          ["`re.split(p, s)`", "list of the pieces between matches"],
          ["`re.compile(p, flags)`", "reusable pattern object"],
          ["`re.escape(s)`", "s with special characters escaped"]),
        T(["Match object", "Gives"],
          ["`m.group()`", "whole match"], ["`m.group(1)` `m.group('n')`", "one group"], ["`m.groups()`", "all groups"],
          ["`m.groupdict()`", "named groups as a dict"], ["`m.span()` `m.start()` `m.end()`", "position"]),
    ]),
    ("Ready-made patterns (shape checks, use with re.fullmatch)", [
        T(["For", "Pattern"],
          ["Digits only", "`\\d+`"],
          ["Hex colour", "`#[0-9a-fA-F]{6}`"],
          ["US ZIP, +4 optional", "`\\d{5}(?:-\\d{4})?`"],
          ["Time 24h", "`(?:[01]\\d|2[0-3]):[0-5]\\d`"],
          ["Date YYYY-MM-DD", "`\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])`"],
          ["IPv4", "`(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)`"],
          ["Simple email", "`[\\w.+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+`"],
          ["Collapse whitespace", "`re.sub(r\"\\s+\", \" \", s)`"]),
    ]),
    ("Common mistakes", [
        L("**Forgetting the r:** write `r\"\\d+\"`, not `\"\\d+\"`.",
          "**search when you meant fullmatch:** `re.search(r\"\\d{3}\", \"a123b\")` is a match. To validate a whole value use `re.fullmatch`.",
          "**Unescaped dot:** `3.14` also matches `3x14`. Write `3\\.14`.",
          "**Greedy `.*`:** it runs to the last possible match. Use `.*?` or a negated class such as `[^\"]*`.",
          "**findall with groups:** it returns the groups, not the whole match. Use `(?:...)` or `finditer`.",
          "**`|` without a group:** `^cat|dog$` is not the whole-string check you meant. Write `^(?:cat|dog)$`.",
          "**`[a-Z]`:** ranges go by character code and this one is an error. Write `[a-zA-Z]`.",
          "**`[abc|def]`:** inside brackets `|` is a literal character. Use `(?:abc|def)`.",
          "**Nested quantifiers:** `(a+)+` can hang on a failing match.",
          "**Parsing HTML or JSON with a regex:** use a real parser.")]),
]

CHEATSHEET = {
    "title": "Regex in Python: Cheat Sheet",
    "description": "A one-page reference for Python's re module, with an example computed by Python for every row. Use the step-by-step guide to learn it, the playground to try it.",
    "sections": [{"name": n, "blocks": b} for n, b in SHEET],
}


def main():
    problems = []
    for doc in (LESSON_GUIDE, CHEATSHEET):
        for sec in doc["sections"]:
            if not sec["blocks"]:
                problems.append("%s: empty section %s" % (doc["title"], sec["name"]))
    # Every pattern shown in the "ready-made" table must really compile.
    for sec in CHEATSHEET["sections"]:
        if sec["name"].startswith("Ready-made"):
            for row in sec["blocks"][0]["rows"][:-1]:
                pat = row[1].strip("`").replace("\\\\", "\\")
                try:
                    re.compile(pat)
                except re.error as exc:
                    problems.append("ready-made pattern %r does not compile: %s" % (pat, exc))
    if problems:
        print("\n".join(problems))
        return 1
    for name, doc in (("regex-guide.json", LESSON_GUIDE), ("regex-cheatsheet.json", CHEATSHEET)):
        with open(os.path.join(DATA, name), "w", encoding="utf-8", newline="\n") as fh:
            json.dump(doc, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
    print("guide: %d sections | cheat sheet: %d sections -> data/regex-guide.json, data/regex-cheatsheet.json"
          % (len(LESSON_GUIDE["sections"]), len(CHEATSHEET["sections"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
