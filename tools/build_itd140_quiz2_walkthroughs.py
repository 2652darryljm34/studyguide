#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 2 step-through walkthroughs -> data/itd140-quiz2-walkthroughs.json
(shown by walkthrough.html). One walkthrough per guide section; the numbers are computed here, not typed.

    python3 tools/build_itd140_quiz2_walkthroughs.py

Reuses the visual helpers and validation of build_itd140_walkthroughs.py.
"""
import json
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_itd140_walkthroughs import flow, table, step, validate  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itd140-quiz2-walkthroughs.json")
GUIDE = "data/itd140-quiz2-guide.json"
QUIZ = "data/itd140-quiz2.json"
W = []


def add(w_id, title, topic, blurb, steps):
    W.append((w_id, title, topic, blurb, steps))


def g(x):
    return ("%.2f" % x).rstrip("0").rstrip(".")


# 1 ---- feature types
FT_H = ["Column", "Example values", "Type"]
FT_ROWS = [["temperature", "36.8, 37.2", ""], ["siblings", "0, 1, 3", ""], ["size", "small, large", ""],
           ["colour", "red, blue", ""], ["postal_code", "90210, 10001", ""]]
ans = ["Continuous", "Discrete", "Ordinal", "Nominal", "Nominal"]
add("feature-types", "Naming the type of each feature", "1. Features and Feature Types",
    "Sort five columns into continuous, discrete, ordinal and nominal.", [
    step("Five columns to classify", "A feature is one input column. Its type decides how it is prepared. First ask: is it a measured amount (quantitative) or a category (qualitative)?",
         table(FT_H, FT_ROWS)),
    step("Quantitative: continuous or discrete?", "Temperature can take any value on a scale, decimals included, so it is continuous. Siblings are counted in whole steps, so it is discrete.",
         table(FT_H, [r[:2] + [ans[i] if i < 2 else ""] for i, r in enumerate(FT_ROWS)], [(0, 2), (1, 2)])),
    step("Qualitative: ordinal or nominal?", "Small to large has an order, so size is ordinal. Colour is only a name, so it is nominal.",
         table(FT_H, [r[:2] + [ans[i] if i < 4 else ""] for i, r in enumerate(FT_ROWS)], [(2, 2), (3, 2)])),
    step("A number can still be a category", "Postal codes are numbers, but adding two of them or calling one bigger means nothing. They name places, so they are nominal.",
         table(FT_H, [r[:2] + [ans[i]] for i, r in enumerate(FT_ROWS)], [(4, 2)])),
])

# 2 ---- missing data and removal
MD = [["A", "34", "52000"], ["B", "NaN", "61000"], ["C", "29", "NaN"], ["D", "41", "58000"], ["E", "NaN", "NaN"]]
MH = ["Row", "age", "income"]
add("missing-removal", "Finding gaps and dropping them", "2. Missing Data and Removal",
    "Count the NaN values, then see what dropna() keeps.", [
    step("Find the gaps", "df.isna().sum() counts the missing cells in each column: age has 2, income has 2.", table(MH, MD, [(1, 1), (4, 1), (2, 2), (4, 2)])),
    step("Drop rows: dropna()", "A row is removed if any column is missing. Rows B, C and E go; only A and D remain. Two gaps per column cost three rows.",
         table(MH, [MD[0], MD[3]], [(0, 0), (1, 0)])),
    step("Drop columns: dropna(axis=1)", "This removes any column that has a gap. Both age and income have gaps, so both would go and no features would remain. Dropping columns is for a column that is mostly empty, not this one.",
         table(["Method", "Rows left", "Columns left"], [["dropna()", "2 of 5", "2"], ["dropna(axis=1)", "5 of 5", "0"]], [(0, 1), (1, 2)])),
    step("So when is removal fine?", "When few rows have gaps and plenty remain, and the gaps are not tied to the outcome. Otherwise fill the values instead (next walkthroughs).",
         table(["Situation", "Choice"], [["Few scattered gaps, lots of data", "Drop the rows"], ["Column is mostly empty", "Drop the column"], ["Many gaps or not random", "Impute"]], [(0, 1), (1, 1), (2, 1)])),
])

# 3 ---- numerical imputation
vals = [10, 12, 14, 40]
mean, med = statistics.mean(vals), statistics.median(vals)
IH = ["Row", "value", "mean fill", "median fill", "missing flag"]


def irows(mf, mdf, fl):
    r = [[str(i + 1), str(v), "", "", ""] for i, v in enumerate(vals)] + [["5", "NaN", "", "", ""]]
    if mf: r[4][2] = g(mean)
    if mdf: r[4][3] = g(med)
    if fl:
        for i in range(5): r[i][4] = "1" if i == 4 else "0"
    return r


add("numeric-imputation", "Filling a numeric gap four ways", "3. Imputing Numerical Data",
    "Mean, median, constant and missing indicator on one small column.", [
    step("A column with one gap and one outlier", "Values 10, 12, 14 and 40, plus a NaN. The 40 is an outlier.", table(IH, irows(0, 0, 0), [(3, 1), (4, 1)])),
    step("Mean fill", "(10 + 12 + 14 + 40) / 4 = %s. The outlier drags the mean above three of the four values." % g(mean), table(IH, irows(1, 0, 0), [(4, 2)])),
    step("Median fill", "In order the values are 10, 12, 14, 40. The middle two are 12 and 14, so the median is %s. The outlier barely matters." % g(med), table(IH, irows(1, 1, 0), [(4, 3)])),
    step("Constant fill and mode fill", "A constant (say -1) is easy but can look like real data. A mode fill needs a repeated value; this column has none, so every value ties. Both work better on columns with repeats.",
         table(["Method", "Gap becomes"], [["Mean", g(mean)], ["Median", g(med)], ["Constant", "-1"], ["Mode", "no single mode here"]])),
    step("Add a missing indicator", "A 0/1 column marks the row that was filled, so the model can still learn from the fact that the value was missing.", table(IH, irows(1, 1, 1), [(r, 4) for r in range(5)])),
])

# 4 ---- categorical imputation
CAT = ["Red", "NaN", "NaN", "Blue", "Red", "NaN"]
ff, last = [], None
for v in CAT:
    last = v if v != "NaN" else last
    ff.append(last)
bf, nxt = [None] * len(CAT), None
for i in range(len(CAT) - 1, -1, -1):
    nxt = CAT[i] if CAT[i] != "NaN" else nxt
    bf[i] = nxt
mode = max(set(v for v in CAT if v != "NaN"), key=[v for v in CAT if v != "NaN"].count)
CH = ["Row", "original", "forward fill", "backfill", "mode fill"]


def crows(f, b, m):
    return [[str(i + 1), CAT[i], ff[i] if f else "", bf[i] if b else "", mode if m else ""] for i in range(len(CAT))]


add("categorical-imputation", "Forward fill, backfill and mode fill", "4. Imputing Categorical Data",
    "Fill the same gaps three ways and see where each method breaks.", [
    step("A column of colours with gaps", "Six rows in order. Rows 2, 3 and 6 are missing. A mean or median makes no sense for words.", table(CH, crows(0, 0, 0), [(1, 1), (2, 1), (5, 1)])),
    step("Forward fill ('pad')", "Copy the previous row's value down: rows 2 and 3 become Red, row 6 becomes Red. It only makes sense when the rows are in a meaningful order.", table(CH, crows(1, 0, 0), [(1, 2), (2, 2), (5, 2)])),
    step("Backfill", "Copy the next row's value up: rows 2 and 3 become Blue. Row 6 has nothing after it, so it stays NaN. (A forward fill has the same problem in row 1.)", table(CH, crows(1, 1, 0), [(1, 3), (2, 3), (5, 3)])),
    step("Mode fill", "The most common colour is %s (2 of the 3 known values), so every gap gets %s, whatever the row order. A constant label such as 'Unknown' is the other common choice." % (mode, mode), table(CH, crows(1, 1, 1), [(1, 4), (2, 4), (5, 4)])),
])

# 5 ---- binning
data = [1, 2, 3, 4, 5, 6, 7, 100]
lo, hi, k = min(data), max(data), 2
wd = (hi - lo) / k
ew = ["low" if v < lo + wd else "high" for v in data]
ef = ["low" if i < 4 else "high" for i in range(8)]
BH = ["Value", "equal-width bin", "equal-frequency bin"]


def brows(a, b):
    return [[str(v), ew[i] if a else "", ef[i] if b else ""] for i, v in enumerate(data)]


add("binning", "Equal-width versus equal-frequency bins", "5. Binning Numerical Data",
    "Cut the same eight values into two bins both ways.", [
    step("Eight values and an outlier", "1, 2, 3, 4, 5, 6, 7 and 100. Binning turns numbers into ranges (discretization).", table(BH, brows(0, 0), [(7, 0)])),
    step("Equal-width: find the width", "Width = (max - min) / bins = (%d - %d) / %d = %s, so the cut sits at %s: the bins are %s to %s and %s to %s." % (hi, lo, k, g(wd), g(lo + wd), lo, g(lo + wd), g(lo + wd), hi),
         table(["Bin", "Range"], [["low", "%s to %s" % (lo, g(lo + wd))], ["high", "%s to %s" % (g(lo + wd), hi)]])),
    step("Equal-width: count what lands where", "Seven values crowd into the low bin and only the outlier is in the high bin. The outlier stretched the range.", table(BH, brows(1, 0), [(r, 1) for r in range(8)])),
    step("Equal-frequency: 4 values each", "Sort the values and cut so each bin has 8 / 2 = 4 values: 1 to 4 are low and 5, 6, 7 and 100 are high. The bins are balanced, but the high bin now spans 5 to 100.", table(BH, brows(1, 1), [(r, 2) for r in range(8)])),
    step("Binarization: one threshold", "A special case: one cut-off you choose, here 5, gives just two groups.", table(["Value", "Binarized (cut-off 5)"], [[str(v), "high" if v >= 5 else "low"] for v in data], [(r, 1) for r in range(8)])),
])

# 6 ---- encoding
COL = ["red", "green", "blue", "green"]
tg = [1, 0, 1, 0, 0, 1]
cats = ["A", "B", "A", "A", "B", "A"]
am = statistics.mean([t for t, c in zip(tg, cats) if c == "A"])
bm = statistics.mean([t for t, c in zip(tg, cats) if c == "B"])
add("encoding", "One-hot versus target encoding", "6. Encoding Categorical Data",
    "Encode a colour column one-hot, then a category column by its target mean.", [
    step("Models need numbers", "Text categories cannot be fed to a model. Two-value features simply become 0 and 1; features with 3+ values need more care.", table(["colour"], [[c] for c in COL])),
    step("Numbering the colours is a trap", "red = 1, green = 2, blue = 3 says blue is greater than red and twice as far from it. None of that is true of colours.", table(["colour", "number"], [[c, str(["red", "green", "blue"].index(c) + 1)] for c in COL], [(r, 1) for r in range(4)])),
    step("One-hot: one column per category", "Each row gets a 1 in the column of its own colour and 0 elsewhere. pd.get_dummies(df['colour']). Three categories, three columns.",
         table(["colour", "is_red", "is_green", "is_blue"], [[c] + ["1" if c == x else "0" for x in ("red", "green", "blue")] for c in COL], [(i, 1 + ["red", "green", "blue"].index(c)) for i, c in enumerate(COL)])),
    step("Target encoding: the mean target per category", "Six training rows with a target of 0 or 1. Category A appears in four rows with targets 1, 1, 0, 1 and B in two rows with targets 0, 0. Replace each category with its mean target: A = 3 / 4 and B = 0. Compute this on training data only, or the target leaks into the feature.",
         table(["Category", "Targets in training", "Encoded value"],
               [["A", ", ".join(str(t) for t, c in zip(tg, cats) if c == "A"), g(am)], ["B", ", ".join(str(t) for t, c in zip(tg, cats) if c == "B"), g(bm)]], [(0, 2), (1, 2)])),
])

# 7 ---- scaling
sv = [20, 30, 50, 60, 200]
mn, mx = min(sv), max(sv)
mu = statistics.mean(sv)
sd = statistics.pstdev(sv)
SH = ["Value", "Min-max", "Standardized"]


def srows(a, b):
    return [[str(v), g((v - mn) / (mx - mn)) if a else "", g((v - mu) / sd) if b else ""] for v in sv]


add("scaling", "Min-max and standardization with an outlier", "7. Scaling",
    "Scale one column both ways and watch what the outlier does.", [
    step("A column with an outlier", "Values 20, 30, 50, 60 and 200. The 200 is an outlier. A model comparing this with a column that runs 0 to 1 would be dominated by it.", table(SH, srows(0, 0), [(4, 0)])),
    step("Min-max: (x - min) / (max - min)", "min = %d and max = %d, so the range is %d. Every value is divided over that range, so the column runs from 0 to 1." % (mn, mx, mx - mn), table(SH, srows(1, 0), [(r, 1) for r in range(5)])),
    step("The outlier squeezed the rest", "Four of the five values are now between 0 and %s. One extreme value set the scale for everyone." % g((60 - mn) / (mx - mn)), table(SH, srows(1, 0), [(0, 1), (1, 1), (2, 1), (3, 1)])),
    step("Standardization: (x - mean) / standard deviation", "mean = %s, standard deviation = %s. The result has mean 0 and standard deviation 1, with no fixed range." % (g(mu), g(sd)), table(SH, srows(1, 1), [(r, 2) for r in range(5)])),
    step("Reading the comparison", "Neither method removes the skew: the 200 is still far from the rest. Standardization lets the outlier be big (a large z-score) instead of forcing the rest into a corner, but it still pulls the mean and spread. Fit on the training set only.",
         table(["", "Min-max", "Standardization"], [["Range", "0 to 1", "Not fixed"], ["Outlier", "Squeezes the rest", "Shifts mean and spread"], ["Skew", "Unchanged", "Unchanged"]], [(1, 1), (1, 2)])),
    step("Which one to use", "Choose by the data and the algorithm. Min-max suits an unknown or non-bell-shaped distribution and kNN or neural networks. Standardization suits algorithms that assume normally distributed data.",
         table(["", "Min-max", "Standardization"], [["Use when", "Distribution unknown or not Gaussian; kNN, neural nets", "Algorithm assumes normal data"]], [(0, 1), (0, 2)])),
])

# 8 ---- validation
TP, FP, FN, TN = 30, 10, 20, 40
tot = TP + FP + FN + TN
add("validation", "Split, score, confusion matrix, cross-validation", "8. Validation, Overfitting and Underfitting",
    "From an 80/20 split to a confusion matrix and a 5-fold average.", [
    step("Split the data 80/20", "250 rows: 250 x 0.8 = 200 to train, 250 x 0.2 = 50 to test. The test rows are never used for learning.", table(["Set", "Rows", "Share"], [["Train", "200", "80%"], ["Test", "50", "20%"]], [(0, 1), (1, 1)])),
    step("Compare train and test accuracy", "Generalization is how well the result carries over. A big gap with training higher means overfitting; low on both means underfitting.",
         table(["Train", "Test", "Diagnosis"], [["98%", "70%", "Overfitting"], ["61%", "59%", "Underfitting"], ["91%", "89%", "Generalizes well"]], [(0, 2), (1, 2), (2, 2)])),
    step("Build the confusion matrix", "On %d test predictions: %d true positives, %d false negatives (missed positives), %d false positives and %d true negatives." % (tot, TP, FN, FP, TN),
         table(["", "Predicted +", "Predicted -"], [["Actual +", str(TP), str(FN)], ["Actual -", str(FP), str(TN)]], [(0, 1), (1, 2)])),
    step("Accuracy from the diagonal", "Correct = %d + %d = %d out of %d, so accuracy = %d%%." % (TP, TN, TP + TN, tot, 100 * (TP + TN) // tot), table(["", "Predicted +", "Predicted -"], [["Actual +", str(TP), str(FN)], ["Actual -", str(FP), str(TN)]], [(0, 1), (1, 2)])),
    step("Cross-validation: 5 folds of 200 rows", "200 rows / 5 folds = 40 rows per fold. Each round tests on one fold (40 rows) and trains on the other four (160 rows). The five scores are averaged.",
         table(["Round", "Test fold", "Train rows", "Test rows"], [[str(r), "Fold %d" % r, "160", "40"] for r in range(1, 6)], [(0, 1)])),
])

# 9 ---- curse of dimensionality
add("dimensionality", "Why more features can hurt", "9. Curse of Dimensionality",
    "Watch the space grow while the number of rows stays put.", [
    step("Cut each feature into 10 ranges", "With 1 feature there are 10 regions to cover, with 2 there are 10 x 10 = 100, with 3 there are 1,000. The regions multiply with each feature.",
         table(["Features", "Regions"], [[str(d), "{:,}".format(10 ** d)] for d in (1, 2, 3, 5)], [(0, 1), (3, 1)])),
    step("100 rows go thin", "100 rows fill the 10 regions of 1 feature (10 rows each). With 3 features there are 1,000 regions, so on average 0.1 rows each. Most regions hold no data at all: the data is sparse.",
         table(["Features", "Regions", "Rows per region (100 rows)"], [[str(d), "{:,}".format(10 ** d), g(100 / 10 ** d)] for d in (1, 2, 3, 5)], [(2, 2), (3, 2)])),
    step("Consequences", "Distances between points become similar, so kNN's nearest neighbours mean less. The model has more ways to fit noise, so overfitting rises. Training time and memory grow. A table with 100 rows and 500 features is in trouble.",
         table(["Effect", "Result"], [["Sparse data", "Few rows near any point"], ["Distances", "All points about equally far"], ["Overfitting", "More ways to fit noise"], ["Cost", "More time and memory"]])),
    step("The remedies", "Remove features (feature selection) or combine them into fewer new ones (dimensionality reduction such as PCA). One-hot encoding a column with hundreds of categories does the opposite, adding hundreds of dimensions.",
         flow(["Many features", "Select or reduce", "Fewer features", "Denser data"], 1)),
])

# 10 ---- feature selection
CORR = [["age", "0.62", "0.30"], ["income", "0.58", "0.95"], ["height", "0.03", "0.10"], ["debt", "-0.81", "0.22"]]
CRH = ["Feature", "Correlation with target", "Max correlation with another feature"]
add("feature-selection", "Choosing features with correlations", "10. Feature Selection",
    "A filter pass over four features, then the wrapper and embedded alternatives.", [
    step("Correlations for four features", "The target link and the largest link to any other feature. All numbers run from -1 to 1.", table(CRH, CORR)),
    step("Drop the weak link to the target", "height has a correlation of 0.03 with the target: almost no straight-line link, so it is a candidate to drop.", table(CRH, CORR, [(2, 1)])),
    step("Keep a strong negative", "debt is -0.81. The sign only says the two move in opposite directions; the size, 0.81, is strong. Keep it.", table(CRH, CORR, [(3, 1)])),
    step("Spot the redundant pair", "income has a 0.95 link to another feature: they carry nearly the same information, so keep one of the pair. Filter methods like this are cheap because no model is trained.", table(CRH, CORR, [(1, 2)])),
    step("The other two approaches", "A wrapper (such as RFE) repeatedly trains a model on subsets and scores each. An embedded method reads a fitted model's results, for example coefficients that Lasso shrinks to zero. SelectKBest is a filter: it scores each feature alone against the target and keeps the top k. Wrapper variants: forward selection adds one feature at a time, backward elimination removes one at a time, exhaustive search tries every combination. An embedded method fits the model only once.",
         table(["Approach", "Decides using", "Cost"], [["Filter", "Simple statistics", "Cheapest"], ["Wrapper", "Model score on subsets", "Highest"], ["Embedded", "One model's results", "In between"]], [(0, 1), (1, 1), (2, 1)])),
])

# 11 ---- PCA
ratios = [0.60, 0.25, 0.10, 0.05]
cum, run = [], 0
for r in ratios:
    run += r
    cum.append(run)
need = next(i for i, c in enumerate(cum) if c >= 0.9 - 1e-9) + 1
PH = ["Component", "Explained variance", "Running total"]


def prow(n):
    return [["PC%d" % (i + 1), "%d%%" % round(100 * ratios[i]), ("%d%%" % round(100 * cum[i])) if i < n else ""] for i in range(4)]


add("pca", "Choosing how many components to keep", "11. Principal Component Analysis",
    "Read the explained variance and pick the number of components.", [
    step("Standardize, then run PCA", "PCA chases variance, which depends on units, so features are standardized first. PCA ignores the target (unsupervised) and builds new features, the principal components, that are uncorrelated. PC1 points along the greatest variance.",
         flow(["Standardize", "Fit PCA", "Read the variance", "Keep k components"], 0)),
    step("Explained variance of each component", "Four components shared out 100% of the variance, in descending order: 60%, 25%, 10% and 5%.", table(PH, prow(0), [(r, 1) for r in range(4)])),
    step("Add them up", "60 + 25 = %d%%, short of 90%%. Adding PC3 gives %d%%." % (round(100 * cum[1]), round(100 * cum[2])), table(PH, prow(3), [(1, 2), (2, 2)])),
    step("Keep %d components" % need, "%d components keep at least 90%% of the variance. The data now has %d columns instead of 4. The cost: each component blends the original features, so it is harder to interpret, and the dropped variance is lost." % (need, need),
         table(["Kept", "Variance kept", "Columns"], [[str(i + 1), "%d%%" % round(100 * cum[i]), str(i + 1)] for i in range(4)], [(need - 1, 1), (need - 1, 2)])),
])


def main():
    problems, out = [], []
    with open(os.path.join(HERE, "..", GUIDE), encoding="utf-8") as fh:
        sections = [s["name"] for s in json.load(fh)["sections"]]
    for w_id, title, topic, blurb, steps in W:
        if topic not in sections:
            problems.append("%s: topic %r is not a guide section" % (w_id, topic))
        validate(w_id, steps, problems)
        out.append({"id": w_id, "title": title, "topic": topic, "blurb": blurb, "steps": steps})
    problems += ["no walkthrough for guide section %r" % n for n in sections if n not in [w[2] for w in W]]
    if problems:
        print("\n".join(problems))
        return 1
    doc = {"title": "ITD 140 Quiz 2 Walkthroughs", "guideFile": GUIDE, "quizFile": QUIZ, "walkthroughs": out}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("%d walkthroughs, %d steps -> data/itd140-quiz2-walkthroughs.json" % (len(out), sum(len(w[4]) for w in W)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
