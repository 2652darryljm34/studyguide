"""Small stdlib-only SVG charts for ML quiz questions (original drawings, no image files).

Each function returns an SVG string for a question's "figure" field. Colours use CSS variables
with fallbacks so they follow the site's light/dark theme.
"""
import random

INK = "var(--ink, #222)"
SOFT = "var(--ink-soft, #777)"
ACC = "var(--accent, #2b6cb0)"
RED = "#c0392b"
GRN = "#2f855a"


def _svg(w, h, body, title):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" '
            'aria-label="%s" style="max-width:%dpx;width:100%%;height:auto;font-family:sans-serif">'
            '<title>%s</title>%s</svg>' % (w, h, title, w, title, body))


def _text(x, y, s, size=13, anchor="middle", weight="normal", fill=INK):
    return '<text x="%s" y="%s" font-size="%d" text-anchor="%s" font-weight="%s" fill="%s">%s</text>' % (
        x, y, size, anchor, weight, fill, s)


def _base(x):
    return 2.8 * (x - 0.4) ** 2 + 0.05


def _data(n=20, seed=3):
    """Points that follow a U shape plus noise, x in 0..1."""
    r = random.Random(seed)
    xs = [(i + 0.5) / n for i in range(n)]
    return [(x, _base(x) + r.uniform(-0.2, 0.2)) for x in xs]


def fit_panel(kind, ox, oy, w=200, h=150, label=""):
    pts = _data()
    sx = lambda x: ox + 10 + x * (w - 20)
    sy = lambda y: oy + h - 12 - (y / 1.15) * (h - 24)
    b = '<rect x="%d" y="%d" width="%d" height="%d" fill="none" stroke="%s" stroke-width="1"/>' % (ox, oy, w, h, SOFT)
    if kind == "under":  # least-squares straight line
        n = len(pts)
        mx = sum(p[0] for p in pts) / n
        my = sum(p[1] for p in pts) / n
        m = sum((p[0] - mx) * (p[1] - my) for p in pts) / sum((p[0] - mx) ** 2 for p in pts)
        c = my - m * mx
        path = "M%.1f %.1f L%.1f %.1f" % (sx(0), sy(c), sx(1), sy(m + c))
    elif kind == "good":  # the smooth U the data was drawn around
        path = "M" + " L".join("%.1f %.1f" % (sx(i / 40), sy(_base(i / 40))) for i in range(41))
    else:  # passes through every point
        path = "M" + " L".join("%.1f %.1f" % (sx(x), sy(y)) for x, y in pts)
    b += '<path d="%s" fill="none" stroke="%s" stroke-width="2"/>' % (path, ACC)
    b += "".join('<circle cx="%.1f" cy="%.1f" r="3.2" fill="%s"/>' % (sx(x), sy(y), INK) for x, y in pts)
    if label:
        b += _text(ox + w / 2, oy + h + 20, label, 14, weight="bold")
    return b


def three_fits(order=("under", "good", "over")):
    """Three panels labelled Plot A, B, C. `order` says which fit goes in which panel."""
    body = "".join(fit_panel(k, 10 + i * 215, 10, label="Plot " + "ABC"[i]) for i, k in enumerate(order))
    return _svg(660, 200, body, "Three scatter plots, each with a different curve fitted to the same points")


def one_fit(kind):
    t = {"under": "A scatter plot with a straight line fitted through U-shaped points",
         "over": "A scatter plot with a wiggly curve that passes through every point",
         "good": "A scatter plot with a smooth curve that follows the overall shape"}[kind]
    return _svg(230, 175, fit_panel(kind, 10, 10), t)


def confusion(tp, fn, fp, tn, a="Cat", b="Dog"):
    """Rows = actual class, columns = predicted class (the usual layout)."""
    x0, y0, cw, ch = 110, 60, 90, 60
    body = _text(x0 + cw, 22, "Predicted", 14, weight="bold")
    body += _text(x0 + cw / 2, 50, a, 13) + _text(x0 + cw * 1.5, 50, b, 13)
    body += _text(40, y0 + ch, "Actual", 14, weight="bold")
    for r, (name, vals) in enumerate(((a, (tp, fn)), (b, (fp, tn)))):
        body += _text(x0 - 10, y0 + r * ch + ch / 2 + 5, name, 13, anchor="end")
        for c, v in enumerate(vals):
            ok = r == c
            body += ('<rect x="%d" y="%d" width="%d" height="%d" fill="%s" fill-opacity="%s" stroke="%s"/>'
                     % (x0 + c * cw, y0 + r * ch, cw, ch, GRN if ok else RED, "0.18" if ok else "0.10", SOFT))
            body += _text(x0 + c * cw + cw / 2, y0 + r * ch + ch / 2 + 7, v, 20, weight="bold")
    return _svg(340, 200, body, "Confusion matrix of actual class against predicted class")


def clusters(k=3, seed=5):
    """Unlabelled points (one colour) in k groups, with an X at each group's centre."""
    r = random.Random(seed)
    centres = [(70, 60), (200, 120), (120, 150), (250, 50)][:k]
    body = '<rect x="5" y="5" width="300" height="190" fill="none" stroke="%s"/>' % SOFT
    for cx, cy in centres:
        for _ in range(14):
            body += '<circle cx="%.1f" cy="%.1f" r="3.5" fill="%s" fill-opacity="0.7"/>' % (
                cx + r.gauss(0, 14), cy + r.gauss(0, 12), SOFT)
        body += '<path d="M%d %d m-6 -6 l12 12 m0 -12 l-12 12" stroke="%s" stroke-width="3"/>' % (cx, cy, RED)
    return _svg(310, 200, body, "Scatter plot of unlabelled points in %d groups, with a red X at the centre of each group" % k)


def accuracy_bars(train, test):
    body = '<line x1="50" y1="150" x2="270" y2="150" stroke="%s"/>' % SOFT
    for i, (name, v) in enumerate((("Training", train), ("Test", test))):
        x = 80 + i * 100
        h = v * 1.3
        body += '<rect x="%d" y="%.1f" width="60" height="%.1f" fill="%s"/>' % (x, 150 - h, h, ACC if i == 0 else RED)
        body += _text(x + 30, 143 - h, "%d%%" % v, 14, weight="bold")
        body += _text(x + 30, 170, name, 13)
    body += _text(25, 22, "Accuracy", 12, anchor="start", fill=SOFT)
    return _svg(300, 185, body, "Bar chart of training accuracy next to test accuracy")


def class_vs_reg():
    """Left: points on a line (numeric target). Right: two coloured groups (category target)."""
    r = random.Random(8)
    body = '<rect x="5" y="5" width="190" height="150" fill="none" stroke="%s"/>' % SOFT
    for i in range(16):
        x = 20 + i * 10.5
        body += '<circle cx="%.1f" cy="%.1f" r="3.3" fill="%s"/>' % (x, 135 - i * 6.5 + r.uniform(-9, 9), INK)
    body += '<line x1="20" y1="135" x2="178" y2="38" stroke="%s" stroke-width="2"/>' % ACC
    body += _text(100, 177, "Plot A", 14, weight="bold")
    body += '<rect x="215" y="5" width="190" height="150" fill="none" stroke="%s"/>' % SOFT
    for i in range(10):
        body += '<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (240 + r.uniform(0, 50), 30 + r.uniform(0, 110), ACC)
        body += '<rect x="%.1f" y="%.1f" width="8" height="8" fill="%s"/>' % (340 + r.uniform(0, 45), 25 + r.uniform(0, 110), RED)
    body += '<line x1="313" y1="10" x2="313" y2="150" stroke="%s" stroke-dasharray="5 4" stroke-width="2"/>' % INK
    body += _text(310, 177, "Plot B", 14, weight="bold")
    return _svg(420, 190, body, "Plot A: points around a rising line. Plot B: two groups of points split by a dashed boundary")


def knn():
    """A star to classify, two rings around it (its 3 and its 7 nearest neighbours).

    Inside the small ring: 2 squares, 1 circle -> k=3 says square.
    Inside the big ring: 2 squares, 5 circles -> k=7 says circle.
    """
    q = (150, 100)
    sq = [(130, 90), (170, 115), (40, 40), (60, 160), (230, 50), (250, 150)]      # class "square"
    ci = [(155, 80), (100, 100), (190, 140), (150, 50), (110, 60), (260, 70), (40, 150)]  # class "circle"
    body = '<rect x="5" y="5" width="290" height="190" fill="none" stroke="%s"/>' % SOFT
    body += '<circle cx="%d" cy="%d" r="60" fill="none" stroke="%s" stroke-dasharray="6 4"/>' % (q + (SOFT,))
    body += '<circle cx="%d" cy="%d" r="30" fill="none" stroke="%s" stroke-width="1.6"/>' % (q + (INK,))
    body += "".join('<rect x="%d" y="%d" width="9" height="9" fill="%s"/>' % (x - 4, y - 4, RED) for x, y in sq)
    body += "".join('<circle cx="%d" cy="%d" r="5" fill="%s"/>' % (x, y, ACC) for x, y in ci)
    body += '<path d="M150 90 l3 7 l7 1 l-5 5 l2 8 l-7 -4 l-7 4 l2 -8 l-5 -5 l7 -1z" fill="#f6c90e" stroke="%s"/>' % INK
    body += _text(150, 190, "inner ring: 3 nearest  |  dashed ring: 7 nearest", 11, fill=SOFT)
    return _svg(300, 200, body, "Red squares and blue circles with a yellow star to classify. A solid ring holds its 3 nearest points and a dashed ring its 7 nearest")
