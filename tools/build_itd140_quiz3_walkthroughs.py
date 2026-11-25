#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 3 step-through walkthroughs -> data/itd140-quiz3-walkthroughs.json
(shown by walkthrough.html). One walkthrough per guide section; every number is computed here, not typed.

    python3 tools/build_itd140_quiz3_walkthroughs.py

Reuses the visual helpers and validation of build_itd140_walkthroughs.py.
"""
import itertools
import json
import math
import os
import random
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_itd140_walkthroughs import flow, table, step, validate  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itd140-quiz3-walkthroughs.json")
GUIDE = "data/itd140-quiz3-guide.json"
QUIZ = "data/itd140-quiz3.json"
W = []


def add(w_id, title, topic, blurb, steps):
    W.append((w_id, title, topic, blurb, steps))


def lst(xs):
    return ", ".join(str(x) for x in xs)


def votes_text(d):
    return ", ".join("%d %s" % (n, c) for c, n in d.items())


def g(x, d=2):
    return ("%.*f" % (d, x)).rstrip("0").rstrip(".")


# 1 ---- supervised basics
N_ROWS, TEST = 200, 0.2
n_test = round(N_ROWS * TEST)
n_train = N_ROWS - n_test
actual = ["spam", "ham", "ham", "spam", "ham", "spam", "ham", "ham"]
pred = ["spam", "ham", "spam", "spam", "ham", "ham", "ham", "ham"]
right = [a == p for a, p in zip(actual, pred)]
PH = ["Test row", "Actual (label)", "Predicted", "Correct?"]
prow = lambda show: [[str(i + 1), actual[i], pred[i] if show else "", ("yes" if right[i] else "no") if show == 2 else ""] for i in range(8)]
add("supervised-basics", "From labeled data to a test score", "1. Supervised Learning Basics",
    "Split labeled rows, fit, predict and compare with the known answers.", [
    step("Labeled data and the target", "Each of the %d emails has features and a known label (spam or ham). The label is the target: the answer the model learns to predict. With a category target this is classification." % N_ROWS,
         table(["Part", "Role"], [["Feature columns", "Inputs the model reads"], ["Label column", "The target to predict"]], [(1, 1)])),
    step("Split the rows: test_size = %s" % g(TEST), "%d x %s = %d rows are held back as the test set and %d rows train the model. The test rows are never used for learning." % (N_ROWS, g(TEST), n_test, n_train),
         table(["Set", "Rows", "Share"], [["Train", str(n_train), "%d%%" % round(100 * n_train / N_ROWS)], ["Test", str(n_test), "%d%%" % round(100 * n_test / N_ROWS)]], [(0, 1), (1, 1)])),
    step("Fit, then predict", "model.fit(x_train, y_train) learns from the training rows. model.predict(x_test) then returns a predicted label for every test row, without being shown the answers.",
         flow(["Split", "fit(train)", "predict(test)", "Compare"], 2)),
    step("Compare with the known labels", "Here are the first 8 test rows. The predictions are lined up against the true labels.", table(PH, prow(1))),
    step("Score it", "%d of %d are right, so accuracy = %d / %d = %s. The score is honest because the model never saw these rows." % (sum(right), len(right), sum(right), len(right), g(sum(right) / len(right))),
         table(PH, prow(2), [(i, 3) for i in range(8)])),
])

# 2 ---- metrics
TP, FP, FN, TN = 40, 10, 20, 130
tot = TP + FP + FN + TN
prec, rec = TP / (TP + FP), TP / (TP + FN)
f1 = 2 * prec * rec / (prec + rec)
CM = [["Actual positive", str(TP), str(FN)], ["Actual negative", str(FP), str(TN)]]
CMH = ["", "Predicted positive", "Predicted negative"]
errs = [2, -3, 1, 4]
mse = sum(e * e for e in errs) / len(errs)
act = [10, 12, 14, 20]
mean_a = statistics.mean(act)
pr = [a - e for a, e in zip(act, errs)]
r2 = 1 - sum(e * e for e in errs) / sum((a - mean_a) ** 2 for a in act)
add("metrics", "Accuracy, precision, recall, F1, MSE and R-squared", "2. Evaluation Metrics",
    "Compute every metric from one confusion matrix, then see why accuracy can mislead.", [
    step("The confusion matrix", "%d test rows sorted by actual and predicted class: %d true positives, %d false negatives (misses), %d false positives (false alarms) and %d true negatives." % (tot, TP, FN, FP, TN), table(CMH, CM)),
    step("Accuracy", "(TP + TN) / all = (%d + %d) / %d = %s." % (TP, TN, tot, g(( TP + TN) / tot)), table(CMH, CM, [(0, 1), (1, 2)])),
    step("Precision", "Of the %d rows flagged positive, %d really were: TP / (TP + FP) = %d / %d = %s." % (TP + FP, TP, TP, TP + FP, g(prec)), table(CMH, CM, [(0, 1), (1, 1)])),
    step("Recall", "Of the %d rows that really were positive, %d were found: TP / (TP + FN) = %d / %d = %s." % (TP + FN, TP, TP, TP + FN, g(rec)), table(CMH, CM, [(0, 1), (0, 2)])),
    step("F1-score", "2 x P x R / (P + R) = 2 x %s x %s / (%s + %s) = %s. The harmonic mean is never above the plain average and is pulled toward the lower of the two, so a model cannot hide a weak recall behind a strong precision." % (g(prec), g(rec, 3), g(prec), g(rec, 3), g(f1)),
         table(["Metric", "Value"], [["Precision", g(prec)], ["Recall", g(rec)], ["F1", g(f1)]], [(2, 1)])),
    step("When accuracy lies", "1,000 parts: 990 normal and 10 defective. A model that says 'normal' every time is right %d%% of the time and finds %d%% of the defects (recall 0 / 10)." % (round(100 * 990 / 1000), 0),
         table(["", "Predicted defect", "Predicted normal"], [["Actual defect", "0", "10"], ["Actual normal", "0", "990"]], [(0, 2)])),
    step("Regression: MSE and R-squared", "Actual values %s, errors (actual - predicted) %s. MSE = (%s) / %d = %s. The mean of the actuals is %s; R2 = 1 - SSres / SStot = 1 - %s / %s = %s."
         % (lst(act), lst(errs), " + ".join(str(e * e) for e in errs), len(errs), g(mse), g(mean_a), g(sum(e * e for e in errs)), g(sum((a - mean_a) ** 2 for a in act)), g(r2)),
         table(["Actual", "Predicted", "Error", "Squared error"], [[str(a), str(p), str(e), str(e * e)] for a, p, e in zip(act, pr, errs)])),
])

# 3 ---- cross-validation, overfitting
ROWS_CV, K_CV = 100, 5
fold = ROWS_CV // K_CV
scores = [0.82, 0.78, 0.85, 0.80, 0.75]
avg = statistics.mean(scores)
add("cross-validation", "5-fold cross-validation and spotting overfitting", "3. Cross-Validation, Overfitting and Underfitting",
    "Rotate the validation fold, average the scores, and read train versus test.", [
    step("Cut the data into %d folds" % K_CV, "%d rows / %d folds = %d rows per fold. Each fold takes one turn as the validation set." % (ROWS_CV, K_CV, fold),
         table(["Fold", "Rows"], [["Fold %d" % i, "%d" % fold] for i in range(1, K_CV + 1)])),
    step("Train %d models, rotating the validation fold" % K_CV, "Each round validates on one fold (%d rows) and trains on the other %d (%d rows). Every row is validated exactly once." % (fold, K_CV - 1, ROWS_CV - fold),
         table(["Round", "Validate on", "Train on", "Score"], [[str(r + 1), "Fold %d" % (r + 1), "the other %d folds" % (K_CV - 1), g(scores[r])] for r in range(K_CV)], [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)])),
    step("Average the scores", "(%s) / %d = %s. One split could have landed on an easy or a hard test set; the average is steadier." % (" + ".join(g(s) for s in scores), K_CV, g(avg)),
         table(["Round", "Score"], [[str(r + 1), g(scores[r])] for r in range(K_CV)] + [["Average", g(avg)]], [(K_CV, 1)])),
    step("Read train versus test", "A big gap with training higher is overfitting (high variance). Low on both is underfitting (high bias).",
         table(["Train", "Test", "Diagnosis"], [["99%", "71%", "Overfitting"], ["58%", "57%", "Underfitting"], ["90%", "88%", "Generalizes well"]], [(0, 2), (1, 2), (2, 2)])),
    step("Pick the right splitter", "Stratified k-fold keeps class proportions, leave-one-out uses k = number of rows, and a time-series split trains on the past and tests on the future.",
         table(["Situation", "Technique"], [["A rare class", "Stratified k-fold"], ["Very few rows", "Leave-one-out"], ["Rows ordered in time", "Time-series split"], ["Plenty of data, a quick check", "Hold-out"]], [(0, 1), (1, 1), (2, 1), (3, 1)])),
])

# 4 ---- KNN
pts = [((1, 1), "A"), ((2, 2), "A"), ((2, 4.2), "A"), ((4, 4.5), "B"), ((5, 3), "B"), ((3, 3.5), "B"), ((6, 6), "B")]
new = (3, 3)
d_eu = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])
d_ma = lambda a, b: abs(a[0] - b[0]) + abs(a[1] - b[1])
ranked = sorted(pts, key=lambda t: d_eu(t[0], new))


def vote(k):
    labs = [c for _, c in ranked[:k]]
    return max(set(labs), key=labs.count), {c: labs.count(c) for c in sorted(set(labs))}


KH = ["Training point", "Class", "Euclidean distance", "Rank"]
krows = [[str(p), c, g(d_eu(p, new)), str(1 + [q for q, _ in ranked].index(p))] for p, c in pts]
v1, v3, v5 = vote(1), vote(3), vote(5)
add("knn", "Classifying a point with KNN", "4. K-Nearest Neighbors",
    "Measure distances, rank the neighbors, and vote with different values of k.", [
    step("A new point to classify", "Training points have two features and a class (A or B). The new point is %s. KNN is a lazy learner: nothing was fitted, so all the work happens now." % (new,),
         table(["Training point", "Class"], [[str(p), c] for p, c in pts])),
    step("Measure the distance to every point", "Euclidean distance = sqrt((x1 - x2)^2 + (y1 - y2)^2). For %s to %s: sqrt(%s) = %s. (Manhattan would give %s.)" % (pts[0][0], new, g((pts[0][0][0] - 3) ** 2 + (pts[0][0][1] - 3) ** 2), g(d_eu(pts[0][0], new)), g(d_ma(pts[0][0], new))),
         table(KH[:3], [r[:3] for r in krows], [(0, 2)])),
    step("Rank the neighbors", "Sort by distance. The nearest is %s (%s), then %s (%s), then %s (%s)." % (ranked[0][0], ranked[0][1], ranked[1][0], ranked[1][1], ranked[2][0], ranked[2][1]),
         table(["Rank", "Point", "Class", "Distance"], [[str(i + 1), str(p), c, g(d_eu(p, new))] for i, (p, c) in enumerate(ranked)], [(0, 0), (1, 0), (2, 0)])),
    step("k = 1: follow the single nearest", "The nearest point is class %s, so k = 1 predicts %s. One noisy point could decide everything: overfitting." % (v1[0], v1[0]),
         table(["k", "Neighbors' classes", "Prediction"], [["1", votes_text(v1[1]), v1[0]]], [(0, 2)])),
    step("k = 3 and k = 5: let more neighbors vote", "k = 3 gives %s, so %s wins. k = 5 gives %s, so %s wins. The answer changed with k. Raising k smooths the boundary, and a very large k drifts toward the majority class (underfitting)." % (votes_text(v3[1]), v3[0], votes_text(v5[1]), v5[0]),
         table(["k", "Neighbors' classes", "Prediction"], [["1", votes_text(v1[1]), v1[0]], ["3", votes_text(v3[1]), v3[0]], ["5", votes_text(v5[1]), v5[0]]], [(1, 2), (2, 2)])),
    step("Scale first, then choose k by cross-validation", "Distances treat every feature alike, so a feature with huge numbers would drown the rest. Rescale, then compare cross-validated scores for several k (an odd k avoids ties between two classes).",
         flow(["Scale features", "Try k = 1, 3, 5, 7", "Cross-validate", "Keep best k"], 2)),
])

# 5 ---- decision trees
parent = (5, 5)
SPLITS = {"Split A": ((4, 1), (1, 4)), "Split B": ((3, 2), (2, 3))}
gini = lambda c: 1 - sum((x / sum(c)) ** 2 for x in c)
ent = lambda c: -sum((x / sum(c)) * math.log2(x / sum(c)) for x in c if x)
wg = {k: sum(sum(ch) / 10 * gini(ch) for ch in v) for k, v in SPLITS.items()}
best = min(wg, key=wg.get)
we = {k: sum(sum(ch) / 10 * ent(ch) for ch in v) for k, v in SPLITS.items()}
add("decision-trees", "Choosing a split with Gini impurity", "5. Decision Trees",
    "Score two candidate splits and pick the purer one.", [
    step("A node to split", "A node holds %d yes and %d no rows (10 in all). Gini impurity = 1 - sum of p^2 = 1 - (0.5^2 + 0.5^2) = %s, the most mixed a two-class node can be. Entropy = %s bit." % (parent[0], parent[1], g(gini(parent)), g(ent(parent))),
         table(["Yes", "No", "Gini", "Entropy"], [[str(parent[0]), str(parent[1]), g(gini(parent)), g(ent(parent))]], [(0, 2)])),
    step("Two candidate splits", "The tree tries splitting on different features. Each gives a left and a right child.",
         table(["Split", "Left (yes / no)", "Right (yes / no)"], [[k, "%d / %d" % v[0], "%d / %d" % v[1]] for k, v in SPLITS.items()])),
    step("Gini of each child", "Gini = 1 - sum of p^2. For a child with 4 yes and 1 no: 1 - (0.8^2 + 0.2^2) = %s." % g(gini((4, 1))),
         table(["Split", "Left Gini", "Right Gini"], [[k, g(gini(v[0])), g(gini(v[1]))] for k, v in SPLITS.items()], [(0, 1), (0, 2)])),
    step("Weight by child size", "Each child has 5 of the 10 rows, so each counts for half. Weighted Gini = 0.5 x left + 0.5 x right.",
         table(["Split", "Weighted Gini"], [[k, g(wg[k], 3)] for k in SPLITS], [(0, 1), (1, 1)])),
    step("Pick the purer split: %s" % best, "%s has the lower weighted Gini (%s versus %s), so it makes the children purest and the tree uses it. Using entropy instead gives the same choice: %s versus %s bits remain, so information gain is larger for %s."
         % (best, g(wg[best], 3), g(max(wg.values()), 3), g(we[best], 2), g(max(we.values()), 2), best),
         table(["Split", "Weighted Gini", "Weighted entropy"], [[k, g(wg[k], 3), g(we[k], 2)] for k in SPLITS], [(0, 1), (0, 2)])),
    step("Stop growing before it memorizes", "The tree repeats on each child until leaves are pure, which risks memorizing the training rows. max_depth, min_samples_leaf and pruning limit that overfitting.",
         flow(["Split the node", "Children purer?", "Repeat on children", "Stop: depth or size limit"], 3)),
])

# 6 ---- random forest
rng = random.Random(4)
ids = list(range(1, 9))
boot = [[rng.choice(ids) for _ in ids] for _ in range(3)]
votes = ["spam", "ham", "spam", "spam", "ham"]
winner = max(set(votes), key=votes.count)
add("random-forest", "How a forest builds and votes", "6. Random Forests",
    "Draw bootstrap samples, see what each tree misses, then combine the votes.", [
    step("A bootstrap sample for each tree", "Each tree trains on 8 rows drawn at random with replacement from the 8 training rows, so some repeat and some are missing.",
         table(["Tree", "Rows drawn (ids)"], [["Tree %d" % (i + 1), ", ".join(map(str, sorted(b)))] for i, b in enumerate(boot)])),
    step("Out-of-bag rows", "The rows a tree never drew are out-of-bag, about one third of them. They can check that tree for free.",
         table(["Tree", "Distinct rows used", "Out-of-bag rows"], [["Tree %d" % (i + 1), str(len(set(b))), ", ".join(str(r) for r in ids if r not in b) or "none"] for i, b in enumerate(boot)], [(0, 2), (1, 2), (2, 2)])),
    step("Random features at each split", "Besides different rows, each split only considers a random subset of the features (say 2 of 5). Trees therefore differ, so their mistakes differ.",
         table(["Tree", "Features offered at its first split"], [["Tree 1", "f1, f3"], ["Tree 2", "f2, f5"], ["Tree 3", "f1, f4"]])),
    step("Combine by majority vote", "Five trees predict %s. The class with the most votes wins: %d %s versus %d %s, so the forest predicts %s." % (lst(votes), votes.count(winner), winner, len(votes) - votes.count(winner), [v for v in votes if v != winner][0], winner),
         table(["Tree", "Vote"], [[str(i + 1), v] for i, v in enumerate(votes)] + [["Forest", winner]], [(len(votes), 1)])),
    step("Regression: average instead", "For a numeric target the forest averages its trees. Trees predicting 10, 14 and 12 give (10 + 14 + 12) / 3 = %s. Because errors cancel, the forest has lower variance than one deep tree." % g((10 + 14 + 12) / 3),
         table(["Tree", "Prediction"], [["1", "10"], ["2", "14"], ["3", "12"], ["Forest (average)", g((10 + 14 + 12) / 3)]], [(3, 1)])),
])

# 7 ---- regression
b0, b1, b2 = 12, 3, 2
rows = [(4, 5, 36), (1, 2, 20), (2, 6, 31), (5, 1, 27)]
preds = [b0 + b1 * x1 + b2 * x2 for x1, x2, _ in rows]
res = [y - p for (_, _, y), p in zip(rows, preds)]
ym = statistics.mean(y for *_, y in rows)
sst = sum((y - ym) ** 2 for *_, y in rows)
ssr = sum(r * r for r in res)
xa = [1, 2, 3, 4, 5, 6]
xb = [2.1, 3.9, 6.2, 7.8, 10.1, 12.0]
xc = [3, 1, 4, 1, 5, 2]
corr_ab = statistics.correlation(xa, xb)
corr_ac = statistics.correlation(xa, xc)
add("regression", "Predictions, residuals, R-squared and multicollinearity", "7. Linear and Logistic Regression",
    "Use a fitted equation, measure its errors, then see what correlated features do.", [
    step("A fitted model", "y = %d + %d x1 + %d x2. The intercept %d is the prediction when both features are 0. The coefficient %d means: with x2 held constant, each extra unit of x1 raises the prediction by %d." % (b0, b1, b2, b0, b1, b1),
         table(["Part", "Value"], [["Intercept", str(b0)], ["Coefficient of x1", str(b1)], ["Coefficient of x2", str(b2)]])),
    step("Predict each row", "Plug the features in: row 1 is %d + %d(%d) + %d(%d) = %d." % (b0, b1, rows[0][0], b2, rows[0][1], preds[0]),
         table(["x1", "x2", "Actual y", "Predicted"], [[str(a), str(b), str(y), str(p)] for (a, b, y), p in zip(rows, preds)], [(i, 3) for i in range(4)])),
    step("Residuals", "Residual = actual - predicted. They should be centered near zero with no pattern.",
         table(["Actual y", "Predicted", "Residual", "Squared"], [[str(y), str(p), str(r), str(r * r)] for (_, _, y), p, r in zip(rows, preds, res)], [(i, 2) for i in range(4)])),
    step("MSE and R-squared", "MSE = %s / %d = %s. The mean of y is %s, so SStot = %s. R2 = 1 - %s / %s = %s: the model explains about %d%% of the variance. Predicting the mean every time would give R2 = 0."
         % (ssr, len(rows), g(ssr / len(rows)), g(ym), g(sst), g(ssr), g(sst), g(1 - ssr / sst, 3), round(100 * (1 - ssr / sst))),
         table(["Measure", "Value"], [["SSres", g(ssr)], ["SStot", g(sst)], ["MSE", g(ssr / len(rows))], ["R2", g(1 - ssr / sst, 3)]], [(2, 1), (3, 1)])),
    step("Spot multicollinearity", "Correlation between features: x1 and a second feature that is almost a copy of it correlates at %s, while x1 and an unrelated feature correlate at %s. Two features that move together give the model no way to share the credit, so coefficients swing or flip sign when one is added or dropped." % (g(corr_ab, 3), g(corr_ac, 2)),
         table(["Feature pair", "Correlation"], [["x1 and near-copy", g(corr_ab, 3)], ["x1 and unrelated", g(corr_ac, 2)]], [(0, 1)])),
    step("Handle it, and logistic regression", "Drop or combine the redundant feature, use PCA, or regularize (Ridge). Logistic regression is different: it outputs a probability, for example 0.83, and a 0.5 threshold turns it into a class.",
         table(["Probability", "Threshold 0.5", "Class"], [["0.83", "above", "positive"], ["0.31", "below", "negative"]], [(0, 2), (1, 2)])),
])

# 8 ---- unsupervised basics
add("unsupervised-basics", "Supervised or unsupervised?", "8. Unsupervised Learning Basics",
    "Sort tasks by whether they have a target, then read hard versus soft membership.", [
    step("The test: is there a target column?", "If every row carries a known answer, learning is supervised. If there are only features, it is unsupervised and the model looks for structure.",
         table(["Task", "Has a target?", "Kind"], [["Predict a price", "yes", "Supervised"], ["Group customers by behavior", "no", "Unsupervised"]], [(0, 2), (1, 2)])),
    step("Sort six tasks", "Classification and regression are supervised. Clustering, dimensionality reduction and association are unsupervised.",
         table(["Task", "Kind"], [["Spam or not", "Supervised (classification)"], ["Estimate rainfall", "Supervised (regression)"], ["Customer segments", "Unsupervised (clustering)"], ["60 columns to 5", "Unsupervised (dimensionality reduction)"], ["Products bought together", "Unsupervised (association)"]], [(2, 1), (3, 1), (4, 1)])),
    step("Hard versus soft clustering", "Hard clustering commits each point to one cluster. Soft clustering gives a degree of membership in several; the shares add up to 1.",
         table(["Article", "Sports", "Politics", "Total", "Hard label"], [["1", "0.70", "0.30", g(0.7 + 0.3), "Sports"], ["2", "0.10", "0.90", g(0.1 + 0.9), "Politics"], ["3", "0.50", "0.50", g(0.5 + 0.5), "tie"]], [(0, 1), (0, 2)])),
    step("Three clustering families", "Each family defines a cluster differently.",
         table(["Family", "Example", "Cluster means"], [["Centroid-based", "K-Means", "Points near a mean"], ["Connectivity-based", "Hierarchical", "Points linked by merges"], ["Density-based", "DBSCAN", "A crowded region"]], [(0, 1), (1, 1), (2, 1)])),
    step("No answer key, so judge by structure", "A good clustering has tight clusters that are far from one another. Measures such as inertia or a silhouette score help, because there are no labels to compare against.",
         flow(["Unlabeled data", "Cluster", "Check tightness", "Interpret groups"], 2)),
])

# 9 ---- k-means
KP = [1, 2, 3, 10, 11, 12, 20, 21, 22]


def assign(cs):
    return [min(range(len(cs)), key=lambda i: abs(p - cs[i])) for p in KP]


def centers(lab, k):
    return [statistics.mean([p for p, l in zip(KP, lab) if l == i]) for i in range(k)]


def inertia(lab, cs):
    return sum((p - cs[l]) ** 2 for p, l in zip(KP, lab))


cs = [1.0, 2.0, 3.0]
hist = []
for it in range(10):
    lab = assign(cs)
    new_cs = centers(lab, 3) if all(i in lab for i in range(3)) else cs
    hist.append((list(cs), lab, new_cs, inertia(lab, cs)))
    if new_cs == cs:
        break
    cs = new_cs


def best_inertia(k):
    b = None
    for init in itertools.combinations(KP, k):
        c = [float(x) for x in init]
        for _ in range(20):
            lab = assign(c)
            if not all(i in lab for i in range(k)):
                break
            nc = centers(lab, k)
            if nc == c:
                break
            c = nc
        else:
            pass
        lab = assign(c)
        if all(i in lab for i in range(k)):
            v = inertia(lab, c)
            b = v if b is None or v < b else b
    return b


elbow = [(k, best_inertia(k)) for k in range(1, 6)]
h0, hl_ = hist[0], hist[-1]
add("kmeans", "Two K-Means iterations and an elbow plot", "9. K-Means Clustering",
    "Assign and update by hand on nine numbers, then read inertia against k.", [
    step("Nine points and k = 3", "Points on a line: %s. Start with three centroids at %s, a poor start on purpose." % (lst(KP), lst(g(c) for c in h0[0])),
         table(["Point"] + [str(p) for p in KP], [["Cluster", "?"] + ["?"] * (len(KP) - 1)])),
    step("Iteration 1: assign each point to the nearest centroid", "Distance is |point - centroid|. With centroids %s every point from 3 up joins the third centroid." % lst(g(c) for c in h0[0]),
         table(["Point", "Nearest centroid", "Cluster"], [[str(p), g(h0[0][l]), str(l + 1)] for p, l in zip(KP, h0[1])])),
    step("Iteration 1: move each centroid to its mean", "Cluster means become %s. The third centroid jumps toward the middle of its many points." % lst(g(c) for c in h0[2]),
         table(["Cluster", "Points", "New centroid"], [[str(i + 1), ", ".join(str(p) for p, l in zip(KP, h0[1]) if l == i) or "none", g(h0[2][i])] for i in range(3)], [(i, 2) for i in range(3)])),
    step("Repeat until the assignments stop changing", "It took %d iterations and stopped at centroids %s because no point changed cluster. But the inertia is %s, far from the best possible (%s, shown in the last step). This bad start got stuck in a local optimum, which is why scikit-learn reruns K-Means (n_init) and keeps the lowest inertia." % (len(hist), lst(g(c) for c in hl_[2]), g(hl_[3]), g(dict(elbow)[3])),
         table(["Iteration", "Centroids at the start", "Inertia"], [[str(i + 1), lst(g(c) for c in h[0]), g(h[3])] for i, h in enumerate(hist)], [(len(hist) - 1, 2)])),
    step("Inertia: tightness of the clusters", "Inertia = sum of squared distances from each point to its centroid, here %s. Lower means tighter clusters." % g(hl_[3]),
         table(["Point", "Centroid", "Squared distance"], [[str(p), g(hl_[2][l]), g((p - hl_[2][l]) ** 2)] for p, l in zip(KP, hl_[1])])),
    step("The elbow plot", "The best inertia for each k (trying every possible start): it always falls as k grows, drops by a lot until k = 3, then barely. The elbow at k = 3 matches the three natural groups, and k = 3 can reach an inertia of %s from a good start." % g(dict(elbow)[3]),
         table(["k", "Inertia"], [[str(k), g(v)] for k, v in elbow], [(2, 1)])),
])

# 10 ---- hierarchical
HP = [1, 2, 6, 7, 15]


def agglo(link):
    cl = [[p] for p in HP]
    out = []
    while len(cl) > 1:
        best = None
        for i in range(len(cl)):
            for j in range(i + 1, len(cl)):
                ds = [abs(a - b) for a in cl[i] for b in cl[j]]
                d = min(ds) if link == "single" else max(ds)
                if best is None or d < best[0]:
                    best = (d, i, j)
        d, i, j = best
        out.append((list(cl[i]), list(cl[j]), d))
        cl[i] = cl[i] + cl[j]
        del cl[j]
    return out


sing, comp = agglo("single"), agglo("complete")
cut_h = 3
n_cl = len(HP) - sum(1 for *_, d in sing if d <= cut_h)
add("hierarchical", "Agglomerative merges and cutting a dendrogram", "10. Hierarchical Clustering",
    "Merge the closest clusters step by step, then cut the tree to get clusters.", [
    step("Every point starts alone", "Five points on a number line: %s. Agglomerative clustering begins with five clusters, one per point." % lst(HP),
         table(["Cluster"] + ["P%d" % (i + 1) for i in range(5)], [["Contents"] + [str(p) for p in HP]])),
    step("Merge the closest pair (single linkage)", "Single linkage measures cluster distance by the closest pair of points. Each row is one merge, and the distance is the height on the dendrogram.",
         table(["Merge", "Joined", "Height"], [[str(i + 1), "%s + %s" % (lst(a), lst(b)), g(d)] for i, (a, b, d) in enumerate(sing)], [(i, 2) for i in range(len(sing))])),
    step("Complete linkage gives different heights", "Complete linkage uses the farthest pair, so merges happen at larger heights.",
         table(["Merge", "Single height", "Complete height"], [[str(i + 1), g(sing[i][2]), g(comp[i][2])] for i in range(len(sing))], [(i, 2) for i in range(len(comp))])),
    step("Cut the dendrogram at height %d" % cut_h, "Keep only the merges at or below height %d: the cut crosses %d vertical lines, so there are %d clusters. A long gap in heights (here from %s to %s) marks a natural place to cut." % (cut_h, n_cl, n_cl, g(sing[-2][2]), g(sing[-1][2])),
         table(["Merge", "Height", "Below the cut?"], [[str(i + 1), g(d), "yes" if d <= cut_h else "no"] for i, (_, _, d) in enumerate(sing)], [(i, 2) for i in range(len(sing))])),
    step("Costs and benefits", "You need not choose k first, and the tree shows every level. But it works from all pairwise distances (slow on big data) and a merge can never be undone.",
         table(["Benefit", "Cost"], [["No k needed up front", "Slow on large datasets"], ["Dendrogram shows the structure", "Merges are permanent"]])),
])

# 11 ---- DBSCAN
DP = [(1, 1), (1, 2), (2, 1), (2, 2), (3, 2), (8, 8), (8, 9), (9, 8), (9, 9), (5, 14)]
EPS, MINS = 1.1, 3
nbr = [[j for j, q in enumerate(DP) if math.dist(p, q) <= EPS] for p in DP]
core = [len(n) >= MINS for n in nbr]
kind = []
for i in range(len(DP)):
    if core[i]:
        kind.append("core")
    elif any(core[j] for j in nbr[i]):
        kind.append("border")
    else:
        kind.append("noise")
cl_id = [-1] * len(DP)
cid = 0
for i in range(len(DP)):
    if core[i] and cl_id[i] == -1:
        stack = [i]
        cl_id[i] = cid
        while stack:
            u = stack.pop()
            if core[u]:
                for v in nbr[u]:
                    if cl_id[v] == -1:
                        cl_id[v] = cid
                        stack.append(v)
        cid += 1
DH = ["Point", "Neighbors within eps (incl. itself)", "Type"]
add("dbscan", "Core, border and noise points", "11. DBSCAN",
    "Count neighbors within eps, label each point, and grow the clusters.", [
    step("Two settings", "eps = %s is the neighborhood radius and min_samples = %d is how many points (the point included) must fall inside it for a point to count as dense. There are %d points." % (EPS, MINS, len(DP)),
         table(["Point"], [[str(p)] for p in DP])),
    step("Count the neighbors of each point", "Distance uses the straight line. Point %s has neighbors %s, so %d points." % (DP[0], [DP[j] for j in nbr[0]], len(nbr[0])),
         table(DH[:2], [[str(p), str(len(n))] for p, n in zip(DP, nbr)], [(0, 1)])),
    step("Core points", "A point with at least %d points inside eps is a core point (dense)." % MINS,
         table(DH, [[str(p), str(len(n)), "core" if c else "?"] for p, n, c in zip(DP, nbr, core)], [(i, 2) for i, c in enumerate(core) if c])),
    step("Border points and noise", "A non-core point within eps of a core point is a border point. A point reachable from no core point is noise, labeled -1.",
         table(DH, [[str(p), str(len(n)), k] for p, n, k in zip(DP, nbr, kind)], [(i, 2) for i, k in enumerate(kind) if k != "core"])),
    step("Grow the clusters", "Clusters grow by chaining outward from core points. DBSCAN found %d clusters without being told how many, and left %d point(s) as noise." % (cid, cl_id.count(-1)),
         table(["Point", "Type", "Cluster label"], [[str(p), k, str(c)] for p, k, c in zip(DP, kind, cl_id)], [(i, 2) for i in range(len(DP))])),
    step("What the settings do", "A larger eps merges clusters and creates less noise. A larger min_samples is stricter, so more points become noise. Both depend on the scale of the data, so scale first.",
         table(["Change", "Effect"], [["eps up", "Clusters merge, less noise"], ["eps down", "Clusters split, more noise"], ["min_samples up", "Stricter, more noise"]], [(0, 1), (1, 1), (2, 1)])),
])

# 12 ---- PCA
Xp = [(2.5, 2.4), (0.5, 0.7), (2.2, 2.9), (1.9, 2.2), (3.1, 3.0), (2.3, 2.7), (2.0, 1.6), (1.0, 1.1)]
xs, ys = [p[0] for p in Xp], [p[1] for p in Xp]
sxx, syy, sxy = statistics.variance(xs), statistics.variance(ys), statistics.covariance(xs, ys)
tr, det = sxx + syy, sxx * syy - sxy ** 2
l1 = tr / 2 + math.sqrt(tr * tr / 4 - det)
l2 = tr / 2 - math.sqrt(tr * tr / 4 - det)
rat = [0.50, 0.20, 0.15, 0.10, 0.05]
cum = list(itertools.accumulate(rat))
need = next(i for i, c in enumerate(cum) if c >= 0.9 - 1e-9) + 1
add("pca", "How much variance each component keeps", "12. Principal Component Analysis",
    "Find the variance along each component, then choose how many to keep.", [
    step("Two correlated features", "Eight rows with two features that rise together. PCA is unsupervised: the target, if any, is ignored. Features are standardized first in practice; here both share a scale so the idea shows directly.",
         table(["x", "y"], [[g(a, 1), g(b, 1)] for a, b in Xp])),
    step("Variance and covariance", "var(x) = %s, var(y) = %s and cov(x, y) = %s. The large positive covariance says the two features carry overlapping information." % (g(sxx, 3), g(syy, 3), g(sxy, 3)),
         table(["", "x", "y"], [["x", g(sxx, 3), g(sxy, 3)], ["y", g(sxy, 3), g(syy, 3)]], [(0, 2), (1, 1)])),
    step("Variance along each component", "The eigenvalues of that matrix are the variances along the components: %s for PC1 (the direction of greatest variance) and %s for PC2, at right angles to it. The total, %s, is unchanged." % (g(l1, 3), g(l2, 3), g(l1 + l2, 3)),
         table(["Component", "Variance"], [["PC1", g(l1, 3)], ["PC2", g(l2, 3)], ["Total", g(l1 + l2, 3)]], [(0, 1)])),
    step("Explained variance ratio", "PC1 holds %s / %s = %s%% of the variance and PC2 the remaining %s%%. Keeping only PC1 turns two columns into one while keeping most of the information." % (g(l1, 3), g(l1 + l2, 3), g(100 * l1 / (l1 + l2), 1), g(100 * l2 / (l1 + l2), 1)),
         table(["Component", "Share"], [["PC1", "%s%%" % g(100 * l1 / (l1 + l2), 1)], ["PC2", "%s%%" % g(100 * l2 / (l1 + l2), 1)]], [(0, 1)])),
    step("Choose how many components to keep", "For a dataset with five components the ratios are %s. Running totals: %s. Reaching at least 90%% needs %d components." % (lst(str(int(100 * r)) + "%" for r in rat), lst(str(round(100 * c)) + "%" for c in cum), need),
         table(["Component", "Share", "Running total"], [["PC%d" % (i + 1), "%d%%" % round(100 * rat[i]), "%d%%" % round(100 * cum[i])] for i in range(5)], [(need - 1, 2)])),
    step("The trade-off", "Fewer columns means faster, simpler models and 2-D plots. But each component blends every original feature, so it has no ready-made name, and the dropped variance is lost.",
         table(["Benefit", "Cost"], [["Fewer dimensions", "Components are hard to interpret"], ["Removes redundancy", "Dropped variance is lost"]])),
])

# 13 ---- NN basics
xin, win, bias = [2, 3], [0.5, -1], 1
zsum = sum(a * b for a, b in zip(xin, win)) + bias
relu = max(0, zsum)
sig = 1 / (1 + math.exp(-zsum))
layers = [4, 5, 3]
params = [(layers[i] * layers[i + 1], layers[i + 1]) for i in range(len(layers) - 1)]
add("neural-basics", "One neuron's forward calculation and counting parameters", "13. Neural Network Basics",
    "Weighted sum, bias, activation, then count the weights and biases in a small network.", [
    step("One neuron", "Inputs x = (%s), weights w = (%s) and bias b = %d. A neuron computes activation(w1x1 + w2x2 + b). Weights scale each input; the bias shifts where the neuron activates." % (lst(xin), lst(win), bias),
         table(["Input", "Weight"], [[str(a), str(b)] for a, b in zip(xin, win)] + [["bias", str(bias)]])),
    step("Weighted sum plus bias", "%s x %s + %s x %s + %s = %s + %s + %s = %s." % (xin[0], win[0], xin[1], win[1], bias, g(xin[0] * win[0]), g(xin[1] * win[1]), bias, g(zsum)),
         table(["Term", "Value"], [["w1 x x1", g(xin[0] * win[0])], ["w2 x x2", g(xin[1] * win[1])], ["bias", str(bias)], ["Sum", g(zsum)]], [(3, 1)])),
    step("Apply an activation function", "The same sum %s gives different outputs: ReLU = max(0, %s) = %s, sigmoid = %s (between 0 and 1), tanh = %s (between -1 and 1)." % (g(zsum), g(zsum), g(relu), g(sig, 3), g(math.tanh(zsum), 3)),
         table(["Activation", "Output"], [["ReLU", g(relu)], ["Sigmoid", g(sig, 3)], ["Tanh", g(math.tanh(zsum), 3)]], [(0, 1), (1, 1), (2, 1)])),
    step("Why a non-linear activation", "Without one, each layer is just a weighted sum, and a stack of weighted sums is still one weighted sum. The non-linearity lets a network learn curved boundaries (and XOR, which one perceptron cannot).",
         flow(["Input layer", "Hidden layers (non-linear)", "Output layer", "Prediction"], 1)),
    step("Layers and architecture", "A network with %d inputs, %d hidden neurons and %d outputs. The input layer has one neuron per feature. Two or more hidden layers count as deep learning." % tuple(layers),
         table(["Layer", "Neurons"], [["Input", str(layers[0])], ["Hidden", str(layers[1])], ["Output", str(layers[2])]])),
    step("Count the parameters", "A dense layer has inputs x neurons weights plus one bias per neuron. Total = %d. Weights and biases are what training changes; the layer sizes are hyperparameters." % sum(a + b for a, b in params),
         table(["Layer", "Weights", "Biases", "Total"], [["%d to %d" % (layers[i], layers[i + 1]), str(params[i][0]), str(params[i][1]), str(sum(params[i]))] for i in range(2)] + [["All", str(sum(p[0] for p in params)), str(sum(p[1] for p in params)), str(sum(a + b for a, b in params))]], [(2, 3)])),
])

# 14 ---- gradient descent
w0, target, lr = 0.0, 3.0, 0.3
grad = lambda w: 2 * (w - target)
loss = lambda w: (w - target) ** 2
traj, w = [], w0
for it in range(6):
    gd = grad(w)
    traj.append((it + 1, w, loss(w), gd, w - lr * gd))
    w = w - lr * gd
big, wb = [], w0
for it in range(4):
    gd = grad(wb)
    big.append((it + 1, wb, loss(wb), gd, wb - 1.1 * gd))
    wb = wb - 1.1 * gd
tiny, wt = [], w0
for it in range(3):
    gd = grad(wt)
    tiny.append((it + 1, wt, loss(wt), gd, wt - 0.01 * gd))
    wt = wt - 0.01 * gd
GH = ["Step", "Weight", "Loss", "Gradient", "New weight"]
add("gradient-descent", "Gradient descent on a one-weight loss", "14. Training: Gradient Descent and Backpropagation",
    "Take downhill steps on a loss, then see what a bad learning rate does.", [
    step("A loss to minimize", "Take one weight w and the loss (w - %s)^2, which is smallest at w = %s. Start at w = %s, so the loss is %s. The gradient is 2(w - %s) = %s: the loss is falling as w increases, so w should move up." % (g(target), g(target), g(w0), g(loss(w0)), g(target), g(grad(w0))),
         table(["Weight", "Loss", "Gradient"], [[g(w0), g(loss(w0)), g(grad(w0))]], [(0, 2)])),
    step("The update rule", "new w = old w - learning rate x gradient. With learning rate %s: %s - %s x %s = %s. The minus sign moves against the gradient." % (g(lr), g(w0), g(lr), g(grad(w0)), g(traj[0][4])),
         table(GH, [[str(traj[0][0]), g(traj[0][1]), g(traj[0][2]), g(traj[0][3]), g(traj[0][4])]], [(0, 4)])),
    step("Keep stepping", "Each step uses the new weight's gradient. The loss falls every time and the steps shrink as the slope flattens near the minimum.",
         table(GH, [[str(i), g(a), g(b, 3), g(c), g(d)] for i, a, b, c, d in traj], [(i, 2) for i in range(len(traj))])),
    step("Learning rate too large", "With a rate of 1.1 each step overshoots the minimum on the other side by more than it started, so the loss grows instead of shrinking.",
         table(GH, [[str(i), g(a), g(b, 2), g(c), g(d)] for i, a, b, c, d in big], [(i, 2) for i in range(len(big))])),
    step("Learning rate too small", "With a rate of 0.01 the loss does fall, but only by tiny amounts, so training is very slow.",
         table(GH, [[str(i), g(a, 3), g(b, 3), g(c, 3), g(d, 3)] for i, a, b, c, d in tiny], [(i, 2) for i in range(len(tiny))])),
    step("Where backpropagation fits", "In a network there are thousands of weights. Backpropagation uses the chain rule to get the gradient for each one, working back from the output. Gradient descent then applies this update to all of them. One pass over all the training data is an epoch.",
         flow(["Forward pass", "Loss", "Backpropagation (gradients)", "Gradient descent update"], 2)),
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
    doc = {"title": "ITD 140 Quiz 3 Walkthroughs", "guideFile": GUIDE, "quizFile": QUIZ, "walkthroughs": out}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("%d walkthroughs, %d steps -> data/itd140-quiz3-walkthroughs.json" % (len(out), sum(len(w[4]) for w in W)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
