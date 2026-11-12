"""Python side of the regex playground and challenges. It runs in the browser under Pyodide (see regexworker.js),
and the same file is imported by the build scripts and tools/test_regexrun.py, so what the page does and what the
authoring checks verify is one piece of code: Python's own `re` module.

Every function returns a JSON string. Positions are UTF-16 offsets, so JavaScript can slice the text with them.
"""
import json
import re

FLAGS = {"i": re.IGNORECASE, "m": re.MULTILINE, "s": re.DOTALL, "x": re.VERBOSE, "a": re.ASCII}
MAX_MATCHES = 500
MAX_TEXT = 20000


def _flags(letters):
    out = 0
    for ch in letters or "":
        out |= FLAGS[ch]
    return out


def _u16(text, i):
    return len(text[:i].encode("utf-16-le", "surrogatepass")) // 2


def _compile(pattern, flags):
    try:
        return re.compile(pattern, _flags(flags)), None
    except re.error as exc:
        return None, {"msg": exc.msg, "pos": None if exc.pos is None else _u16(pattern, exc.pos)}
    except (RecursionError, OverflowError) as exc:
        return None, {"msg": "pattern too complex (%s)" % type(exc).__name__, "pos": None}


def _plain(value):
    """findall results as JSON-friendly lists (tuples become lists)."""
    return [list(v) if isinstance(v, tuple) else v for v in value]


def run(pattern, flags, text, mode="all", repl=None):
    """Find matches. mode: all (finditer), search, match or fullmatch. repl: also run re.subn(pattern, repl, text)."""
    text = text[:MAX_TEXT]
    p, err = _compile(pattern, flags)
    if err:
        return json.dumps({"error": err})
    names = {v: k for k, v in p.groupindex.items()}

    def info(m):
        groups = []
        for i in range(1, p.groups + 1):
            s = m.start(i)
            groups.append({"n": i, "name": names.get(i), "text": m.group(i),
                           "start": None if s < 0 else _u16(text, s), "end": None if s < 0 else _u16(text, m.end(i))})
        return {"start": _u16(text, m.start()), "end": _u16(text, m.end()), "text": m.group(), "groups": groups}

    if mode == "all":
        matches = []
        for m in p.finditer(text):
            matches.append(info(m))
            if len(matches) >= MAX_MATCHES:
                break
    else:
        m = getattr(p, mode)(text)
        matches = [info(m)] if m else []
    out = {"matches": matches, "ngroups": p.groups, "truncated": len(matches) >= MAX_MATCHES}
    if mode == "all":
        out["findall"] = repr(p.findall(text))[:2000]
    if repl is not None:
        try:
            new, n = p.subn(repl, text)
            out["sub"] = {"text": new[:MAX_TEXT], "count": n}
        except Exception as exc:  # bad group reference, bad escape in the replacement
            out["sub"] = {"error": str(exc)}
    return json.dumps(out)


def check(pattern, flags, spec):
    """Grade a challenge. spec (a dict) has kind validate | extract | sub, see data/regex-challenges.json."""
    p, err = _compile(pattern, flags)
    if err:
        return json.dumps({"error": err})
    kind = spec["kind"]
    results = []
    if kind == "validate":
        for key, want in (("good", True), ("bad", False), ("hidden_good", True), ("hidden_bad", False)):
            for s in spec.get(key, []):
                got = p.fullmatch(s) is not None
                results.append({"text": s, "want": want, "got": got, "ok": got == want, "hidden": key.startswith("hidden")})
    elif kind == "extract":
        got = _plain(p.findall(spec["text"]))
        results.append({"want": spec["expected"], "got": got, "ok": got == spec["expected"]})
    elif kind == "sub":
        got = p.sub(spec["repl"], spec["text"])
        results.append({"want": spec["expected"], "got": got, "ok": got == spec["expected"]})
    else:
        raise ValueError("unknown challenge kind %r" % kind)
    return json.dumps({"results": results, "ok": all(r["ok"] for r in results)})


def check_json(pattern, flags, spec_json):
    """check() for callers that pass the spec as a JSON string (the worker)."""
    return check(pattern, flags, json.loads(spec_json))
