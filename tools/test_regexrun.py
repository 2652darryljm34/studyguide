#!/usr/bin/env python3
"""Tests assets/regexrun.py (the Python the regex playground runs): python3 tools/test_regexrun.py"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets"))
import regexrun as R

failures = 0


def ok(label, cond):
    global failures
    if not cond:
        failures += 1
        print("  FAIL", label)


r = json.loads(R.run(r"(\d+)-(?P<b>\d+)", "", "a 12-34 b 5-6", "all", r"\2-\1"))
ok("two matches", len(r["matches"]) == 2 and r["matches"][0]["text"] == "12-34")
ok("group names", r["matches"][0]["groups"][1]["name"] == "b" and r["matches"][0]["groups"][0]["start"] == 2)
ok("findall tuples", r["findall"] == "[('12', '34'), ('5', '6')]")
ok("sub", r["sub"] == {"text": "a 34-12 b 6-5", "count": 2})

r = json.loads(R.run("a", "", "😀a", "all"))
ok("utf-16 offsets", r["matches"][0]["start"] == 2 and r["matches"][0]["end"] == 3)

r = json.loads(R.run("(", "", "x"))
ok("syntax error reported", "error" in r and r["error"]["msg"] and r["error"]["pos"] == 0)
ok("bad flag-free modes", json.loads(R.run("a", "", "ba", "match"))["matches"] == [])
ok("fullmatch", len(json.loads(R.run(r"\d+", "", "123", "fullmatch"))["matches"]) == 1)
ok("flags", len(json.loads(R.run("a", "i", "A", "search"))["matches"]) == 1)
ok("bad replacement", "error" in json.loads(R.run("a", "", "a", "all", r"\9"))["sub"])
ok("empty matches stop", len(json.loads(R.run("x*", "", "ab", "all"))["matches"]) == 3)

spec = {"kind": "validate", "good": ["ab"], "bad": ["abc"], "hidden_bad": ["a"]}
ok("validate pass", json.loads(R.check("ab", "", spec))["ok"])
ok("validate fail", not json.loads(R.check("a.*", "", spec))["ok"])
ok("extract", json.loads(R.check(r"(\d)(\d)", "", {"kind": "extract", "text": "1234", "expected": [["1", "2"], ["3", "4"]]}))["ok"])
ok("sub kind", json.loads(R.check(r"\s+", "", {"kind": "sub", "text": "a  b", "repl": " ", "expected": "a b"}))["ok"])
ok("check_json", json.loads(R.check_json("ab", "", json.dumps(spec)))["ok"])
print("%d failure(s)" % failures if failures else "regexrun: all checks passed")
sys.exit(1 if failures else 0)
