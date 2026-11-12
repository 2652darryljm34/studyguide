#!/usr/bin/env python3
"""
Builds the ITD 140 step-through walkthroughs into data/itd140-walkthroughs.json (shown by walkthrough.html).

    python3 tools/build_itd140_walkthroughs.py

A walkthrough is {id, title, topic, blurb, steps[{title, text, visual}]}. `topic` must be the name of a guide
section. A visual is
  {"type": "flow",  "nodes": [...], "active": i}
  {"type": "table", "headers": [...], "rows": [[...]], "hl": [[row, col], ...]}
Validation here is the check: bad indexes or ragged tables fail the build.
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itd140-walkthroughs.json")
GUIDE = "data/itd140-supplemental-guide.json"
QUIZ = "data/itd140-supplemental-quiz.json"


def flow(nodes, active):
    return {"type": "flow", "nodes": nodes, "active": active}


def table(headers, rows, hl=()):
    return {"type": "table", "headers": headers, "rows": rows, "hl": [list(h) for h in hl]}


def step(title, text, visual):
    return {"title": title, "text": text, "visual": visual}


# ---- 1. The workflow -------------------------------------------------------------------------------------
STAGES = ["Load", "Explore", "Transform", "Split", "Create", "Train + test", "Tune", "Predict", "Monitor"]
STAGE_TEXT = [
    "Read the dataset into the program, for example a CSV file into a pandas table.",
    "Look at it with pandas and charts: its size, the columns, odd values, how the columns relate.",
    "scikit-learn needs numbers, so text columns are converted (encoding) and scales are aligned.",
    "Hold some rows back as a test set: x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2). With 150 rows that is 120 to train on and 30 to test.",
    "Pick an algorithm and make the model object. Nothing is learned yet.",
    "model.fit(x_train, y_train) learns from the training rows; then model.predict(x_test) is compared with y_test.",
    "Adjust the hyperparameters, re-test, and check the accuracy. Only the model is changed, not the test rows.",
    "Use the model on live data it has never seen. This is what it was built for.",
    "Watch the live model. If its results drift, tune, retrain or redeploy.",
]
WORKFLOW = [step("%d. %s" % (i + 1, n), STAGE_TEXT[i], flow(STAGES, i)) for i, n in enumerate(STAGES)]

# ---- 2. k-means ------------------------------------------------------------------------------------------
KM_H = ["Point", "Distance to c1", "Distance to c2", "Joins"]
KMEANS = [
    step("Start: two centroids",
         "Cluster six numbers into k = 2 groups. Pick two starting centroids at random from the data: c1 = 1 and c2 = 4. k-means is unsupervised: there are no labels.",
         table(KM_H, [["1", "", "", ""], ["2", "", "", ""], ["4", "", "", ""], ["10", "", "", ""], ["11", "", "", ""], ["13", "", "", ""]])),
    step("Assign every point to its nearest centroid",
         "Measure each point to both centroids (c1 = 1, c2 = 4) and join the closer one. The point 4 is distance 0 from c2, so it joins B. The point 2 is 1 from c1 and 2 from c2, so it joins A.",
         table(KM_H, [["1", "0", "3", "A"], ["2", "1", "2", "A"], ["4", "3", "0", "B"], ["10", "9", "6", "B"], ["11", "10", "7", "B"], ["13", "12", "9", "B"]],
               [(r, 3) for r in range(6)])),
    step("Move each centroid to the mean of its cluster",
         "A = {1, 2} has mean 1.5. B = {4, 10, 11, 13} has mean 38 / 4 = 9.5. The centroids move: c1 = 1.5, c2 = 9.5.",
         table(["Cluster", "Members", "New centroid"], [["A", "1, 2", "1.5"], ["B", "4, 10, 11, 13", "9.5"]], [(0, 2), (1, 2)])),
    step("Assign again, using the moved centroids",
         "With c1 = 1.5 and c2 = 9.5 the point 4 is 2.5 from c1 but 5.5 from c2, so it switches from B to A. Assignments can change when the centroids move.",
         table(KM_H, [["1", "0.5", "8.5", "A"], ["2", "0.5", "7.5", "A"], ["4", "2.5", "5.5", "A"], ["10", "8.5", "0.5", "B"], ["11", "9.5", "1.5", "B"], ["13", "11.5", "3.5", "B"]],
               [(2, 3)])),
    step("Move the centroids again",
         "A = {1, 2, 4} has mean 7 / 3 = 2.33. B = {10, 11, 13} has mean 34 / 3 = 11.33.",
         table(["Cluster", "Members", "New centroid"], [["A", "1, 2, 4", "2.33"], ["B", "10, 11, 13", "11.33"]], [(0, 2), (1, 2)])),
    step("Assign once more: nothing changes, so stop",
         "Every point picks the same cluster as before, so moving the centroids again would give the same result. The algorithm has converged. Different starting centroids can end in different clusters, which is why k-means is often run several times.",
         table(KM_H, [["1", "1.33", "10.33", "A"], ["2", "0.33", "9.33", "A"], ["4", "1.67", "7.33", "A"], ["10", "7.67", "1.33", "B"], ["11", "8.67", "0.33", "B"], ["13", "10.67", "1.67", "B"]],
               [(r, 3) for r in range(6)])),
]

# ---- 3. kNN ----------------------------------------------------------------------------------------------
KNN_H = ["Point", "Class", "Across", "Up", "Straight-line distance"]
KNN_SORTED = [("c (5, 8)", "Red", 0, 3, "3"), ("b (5, 1)", "Blue", 0, 4, "4"), ("a (8, 9)", "Blue", 3, 4, "5"),
              ("d (11, 5)", "Red", 6, 0, "6"), ("e (13, 10)", "Red", 8, 5, "9.43")]
KNN_MIXED = [KNN_SORTED[2], KNN_SORTED[4], KNN_SORTED[0], KNN_SORTED[3], KNN_SORTED[1]]


def knn_rows(rows, show_dist=True):
    return [[p, c, str(dx), str(dy), d if show_dist else ""] for p, c, dx, dy, d in rows]


KNN = [
    step("Start: a new point to classify",
         "Five labelled points, each Red or Blue, are known. A new, unlabelled point sits at (5, 5). kNN labels it by looking at its nearest neighbours.",
         table(KNN_H, knn_rows(KNN_MIXED, False))),
    step("Measure the distance to each known point",
         "Straight-line (Euclidean) distance = square root of (across^2 + up^2). For a (8, 9): across 3, up 4, so sqrt(9 + 16) = 5.",
         table(KNN_H, knn_rows(KNN_MIXED), [(r, 4) for r in range(5)])),
    step("Sort by distance, nearest first",
         "kNN has no training step beyond remembering the points. The work happens now, at prediction time.",
         table(KNN_H, knn_rows(KNN_SORTED))),
    step("Take the k = 3 nearest",
         "With k = 3 the neighbours are c (Red), b (Blue) and a (Blue).",
         table(KNN_H, knn_rows(KNN_SORTED), [(r, c) for r in range(3) for c in range(5)])),
    step("Majority vote",
         "Blue 2, Red 1, so the new point is classified Blue. An odd k means a two-class vote cannot tie.",
         table(["Class", "Votes among the 3 nearest"], [["Blue", "2"], ["Red", "1"]], [(0, 0), (0, 1)])),
    step("Change k and the answer can change",
         "k = 1 uses only c, so Red. k = 3 gives Blue. k = 5 uses all five points: Red 3, Blue 2, so Red. A small k follows noise; a large k blurs the boundary. k is a hyperparameter, chosen by you, not learned.",
         table(["k", "Neighbours used", "Votes", "Result"],
               [["1", "c", "Red 1", "Red"], ["3", "c, b, a", "Blue 2, Red 1", "Blue"], ["5", "all five", "Red 3, Blue 2", "Red"]], [(0, 3), (1, 3), (2, 3)])),
]

# ---- 4. k-fold cross-validation -------------------------------------------------------------------------
SCORES = ["0.82", "0.78", "0.85", "0.80", "0.80"]
FH = ["Round", "Fold 1", "Fold 2", "Fold 3", "Fold 4", "Fold 5", "Score"]


def fold_rows(done, current):
    rows = []
    for r in range(5):
        cells = ["Test" if c == r else "Train" for c in range(5)] if r <= current else [""] * 5
        rows.append(["Round %d" % (r + 1)] + cells + [SCORES[r] if r < done else ""])
    return rows


KFOLD = [step("Cut the data into k = 5 folds",
              "100 rows split into 5 folds of 100 / 5 = 20 rows each. Every row sits in exactly one fold.",
              table(FH, fold_rows(0, -1)))]
for r in range(5):
    extra = " Train on the other 4 folds (80 rows)." if r == 0 else ""
    KFOLD.append(step("Round %d: fold %d is the test fold" % (r + 1, r + 1),
                      "Fold %d (20 rows) is held out for testing.%s The model's score on it is %s." % (r + 1, extra, SCORES[r]),
                      table(FH, fold_rows(r + 1, r), [(r, r + 1), (r, 6)])))
KFOLD.append(step("Average the five scores",
                  "(0.82 + 0.78 + 0.85 + 0.80 + 0.80) / 5 = 4.05 / 5 = 0.81. Every row was used for testing exactly once and for training k - 1 = 4 times, so the estimate depends less on one lucky or unlucky split.",
                  table(FH, fold_rows(5, 4) + [["Mean", "", "", "", "", "", "0.81"]], [(5, 6)])))

# ---- 5. Scaling -------------------------------------------------------------------------------------------
SC_H = ["Value", "Min-max: (x - min) / (max - min)", "Standardized: (x - mean) / std dev"]
VALS = ["20", "30", "45", "50", "70"]
MM = ["0", "0.2", "0.5", "0.6", "1"]
ZZ = ["-1.34", "-0.76", "0.12", "0.41", "1.57"]
DEV = [["20", "-23", "529"], ["30", "-13", "169"], ["45", "2", "4"], ["50", "7", "49"], ["70", "27", "729"]]


def sc_rows(mm, z):
    return [[v, MM[i] if mm else "", ZZ[i] if z else ""] for i, v in enumerate(VALS)]


SCALING = [
    step("A column on its own scale",
         "A column of ages: 20, 30, 45, 50, 70. Another column might run 1 to 5, or 0 to 100000. Distance-based methods such as kNN would let the big-valued column dominate, so columns are scaled to comparable ranges.",
         table(SC_H, sc_rows(False, False))),
    step("Min-max: find the smallest and largest",
         "min = 20, max = 70, so max - min = 50.",
         table(SC_H, sc_rows(False, False), [(0, 0), (4, 0)])),
    step("Min-max: apply the formula to every value",
         "(30 - 20) / 50 = 0.2, (45 - 20) / 50 = 0.5, and so on. The smallest value always becomes 0 and the largest 1.",
         table(SC_H, sc_rows(True, False), [(r, 1) for r in range(5)])),
    step("Standardization: find the mean",
         "(20 + 30 + 45 + 50 + 70) / 5 = 215 / 5 = 43. Subtract it from every value.",
         table(["Value", "Value - mean (43)", "Squared"], DEV, [(r, 1) for r in range(5)])),
    step("Standardization: find the standard deviation",
         "Average the squares: (529 + 169 + 4 + 49 + 729) / 5 = 1480 / 5 = 296, and the square root is about 17.20. (This is the version scikit-learn's StandardScaler uses; dividing by 4 instead of 5 gives a slightly larger value.)",
         table(["Value", "Value - mean (43)", "Squared"], DEV, [(r, 2) for r in range(5)])),
    step("Standardization: apply the formula",
         "(20 - 43) / 17.20 = -1.34. The new column has mean 0 and standard deviation 1; values below the mean are negative.",
         table(SC_H, sc_rows(True, True), [(r, 2) for r in range(5)])),
    step("Which one to use",
         "Min-max gives 0 to 1 and suits data whose distribution is unknown or not bell-shaped, and kNN or neural nets. Standardization gives mean 0 and standard deviation 1 and suits algorithms that assume normally distributed data.",
         table(["", "Min-max", "Standardization"],
               [["Result", "0 to 1", "Mean 0, std dev 1"], ["Use when", "Distribution unknown or not Gaussian", "Algorithm assumes Gaussian data"]], [(1, 1), (1, 2)])),
]

# ---- 6. One-hot encoding ---------------------------------------------------------------------------------
ENC = [
    step("Text a model cannot use",
         "scikit-learn needs numbers. The colour column holds words, so it has to be converted.",
         table(["colour"], [["red"], ["green"], ["blue"], ["green"]])),
    step("Numbering the categories adds a fake order",
         "red = 0, green = 1, blue = 2 looks easy, but it tells the model that blue > green > red, and that green is between the other two. No such order exists.",
         table(["colour", "number"], [["red", "0"], ["green", "1"], ["blue", "2"], ["green", "1"]], [(r, 1) for r in range(4)])),
    step("One-hot: one binary column per category",
         "Make a column for each colour. Each row has a 1 in the column of its own colour and 0 elsewhere, so no category is bigger than another. In pandas: pd.get_dummies(df['colour']).",
         table(["colour", "is_red", "is_green", "is_blue"],
               [["red", "1", "0", "0"], ["green", "0", "1", "0"], ["blue", "0", "0", "1"], ["green", "0", "1", "0"]],
               [(0, 1), (1, 2), (2, 3), (3, 2)])),
    step("The cost: more columns",
         "3 categories became 3 columns, and 50 categories would become 50. That growth is why the guide also lists compact styles that write the category number in binary.",
         table(["Categories", "One-hot columns"], [["3", "3"], ["50", "50"]], [(0, 1), (1, 1)])),
]

# ---- 7. Foundations: training finds the rule ------------------------------------------------------------
MH = ["Miles", "Actual km", "Predicted km", "Error"]
FOUND = [
    step("Programming versus learning",
         "In traditional programming a person writes the rules and the computer turns data into answers. In machine learning you supply data and the answers, and the computer works out the rules. The rules it finds are called the model.",
         table(["", "Traditional programming", "Machine learning"],
               [["Goes in", "Data and rules", "Data and answers"], ["Comes out", "Answers", "The rules (the model)"]], [(0, 2), (1, 2)])),
    step("Examples with known answers",
         "Three (miles, km) pairs. Nobody tells the computer how to convert them. The model will be a line y = m*x + b, and m and b are the parameters training must find.",
         table(MH, [["5", "8", "", ""], ["10", "16", "", ""], ["20", "32", "", ""]])),
    step("Start with a guess: m = 1, b = 0",
         "Predicted km = 1 * miles + 0. Error = actual - predicted. The errors are 3, 6 and 12: a poor model.",
         table(MH, [["5", "8", "5", "3"], ["10", "16", "10", "6"], ["20", "32", "20", "12"]], [(r, 3) for r in range(3)])),
    step("Adjust the parameter: m = 1.5",
         "Predicted km = 1.5 * miles. The errors shrink to 0.5, 1 and 2. Training repeats this: change the parameters, check the errors, keep changes that help.",
         table(MH, [["5", "8", "7.5", "0.5"], ["10", "16", "15", "1"], ["20", "32", "30", "2"]], [(r, 3) for r in range(3)])),
    step("Adjust again: m = 1.6",
         "Every prediction now matches, so the errors are 0. Training has found the parameters m = 1.6 and b = 0. That line is the model.",
         table(MH, [["5", "8", "8", "0"], ["10", "16", "16", "0"], ["20", "32", "32", "0"]], [(r, 3) for r in range(3)])),
    step("Use the model on a new value",
         "A distance the model never saw: 50 miles. Predicted km = 1.6 * 50 + 0 = 80. Miles and km rise together in a straight line, a correlation near +1.",
         table(MH, [["5", "8", "8", "0"], ["10", "16", "16", "0"], ["20", "32", "32", "0"], ["50", "?", "80", "?"]], [(3, 2)])),
]

# ---- 8. Feature selection: RFE --------------------------------------------------------------------------
RH = ["Feature", "Round 1 score", "Round 2 score", "Result"]
RF = ["area", "rooms", "age", "street_number"]
R1 = ["0.50", "0.26", "0.16", "0.02"]
R2 = ["0.58", "0.27", "0.11", "-"]
BLANK = ["", "", "", ""]


def rfe(r1, r2, res, hl=()):
    return table(RH, [[RF[i], r1[i], r2[i], res[i]] for i in range(4)], hl)


FSEL = [
    step("Start: four inputs to predict a house price",
         "RFE (recursive feature elimination) is a wrapper method: it builds a model, drops the weakest feature, and repeats. Goal here: keep the best 2 of 4 features.",
         rfe(BLANK, BLANK, BLANK)),
    step("Round 1: train a model on all four",
         "The model scores how much each feature helps (illustrative numbers). street_number scores lowest.",
         rfe(R1, BLANK, BLANK, [(r, 1) for r in range(4)])),
    step("Drop the weakest: street_number",
         "It is eliminated first, so it is ranked last (4th).",
         rfe(R1, BLANK, ["kept", "kept", "kept", "dropped (rank 4)"], [(3, 3)])),
    step("Round 2: train again on the remaining three",
         "A new model is built without street_number, and the scores are recalculated. age is now the weakest.",
         rfe(R1, R2, ["kept", "kept", "kept", "dropped (rank 4)"], [(r, 2) for r in range(3)])),
    step("Drop the weakest: age",
         "age is eliminated second, so it is ranked 3rd.",
         rfe(R1, R2, ["kept", "kept", "dropped (rank 3)", "dropped (rank 4)"], [(2, 3)])),
    step("Stop at two features",
         "area and rooms are what is left, so they are the selected features. Features are ranked by the order they were eliminated; the survivors rank best.",
         rfe(R1, R2, ["kept", "kept", "dropped (rank 3)", "dropped (rank 4)"], [(0, 3), (1, 3)])),
    step("How RFE compares with the other families",
         "RFE trains many models, so it is slow but very effective. A filter only scores each feature by itself, with no model, so it is fast but less effective. LASSO is embedded: selection happens while one model is fitted.",
         table(["Family", "Uses a model?", "Speed", "Effectiveness"],
               [["Filter", "No", "Fast", "Less"], ["Wrapper (RFE)", "Yes, many times", "Slow", "Very"], ["Embedded (LASSO)", "Yes, fitted once", "Balanced", "Balanced"]], [(1, 0)])),
]

# ---- 9. Dimensionality reduction: PCA versus LDA --------------------------------------------------------
DH = ["Point", "Class", "x1", "x2"]
DPTS = [["p1", "Red", "1", "1"], ["p2", "Red", "5", "1"], ["p3", "Red", "9", "1"], ["p4", "Blue", "1", "3"], ["p5", "Blue", "5", "3"], ["p6", "Blue", "9", "3"]]
DIMRED = [
    step("Six points, two features, two classes",
         "Reducing dimensions means going from 2 inputs to 1 while keeping what matters. Red and Blue points differ, but which feature shows that?",
         table(DH, DPTS)),
    step("Measure the spread of each feature",
         "x1 runs 1 to 9, with a variance of 64 / 6 = 10.67. x2 only runs 1 to 3, with a variance of 1.",
         table(["Feature", "Mean", "Variance"], [["x1", "5", "10.67"], ["x2", "2", "1"]], [(0, 2)])),
    step("PCA (unsupervised): keep the axis with the most variance",
         "PCA ignores the class labels and picks the direction where the data is most spread out. Here that is x1. Reduce to that single axis and look at the classes.",
         table(["Point", "Class", "PC1 (= x1)"], [[r[0], r[1], r[2]] for r in DPTS], [(r, 2) for r in range(6)])),
    step("PCA's result: the classes are mixed",
         "On the PC1 axis both Red and Blue sit at 1, 5 and 9, so one dimension no longer tells the classes apart. A lot of spread is not the same as a useful split between classes.",
         table(["PC1 value", "Classes found there"], [["1", "Red, Blue"], ["5", "Red, Blue"], ["9", "Red, Blue"]], [(0, 1), (1, 1), (2, 1)])),
    step("LDA (supervised): keep the axis that separates the classes",
         "LDA uses the labels and looks for the direction that pulls the classes apart. Here that is x2: every Red is at 1 and every Blue at 3.",
         table(["Point", "Class", "LD1 (= x2)"], [[r[0], r[1], r[3]] for r in DPTS], [(r, 2) for r in range(6)])),
    step("Compare the two",
         "Dropping the other axis (LD2, which is x1) loses nothing for telling the classes apart. These numbers were chosen to make the contrast clear; real data is rarely this tidy.",
         table(["", "PCA", "LDA"],
               [["Type", "Unsupervised (no labels)", "Supervised (uses labels)"], ["Maximizes", "Variance (spread)", "Class separation"],
                ["On this data", "Classes mixed", "Classes cleanly separated"]], [(2, 1), (2, 2)])),
]

# ---- 10. Regularization ---------------------------------------------------------------------------------
RG = ["Feature", "No penalty", "L2 (Ridge)", "L1 (LASSO)"]
RGW = [["a", "9.0", "3.1", "4.0"], ["b", "-7.5", "-2.6", "-3.2"], ["c", "0.6", "0.3", "0"], ["d", "0.2", "0.1", "0"]]
REGU = [
    step("The symptom: a big gap between training and test",
         "A model scores 99% on the training data but 72% on the test data. It has memorized noise and outliers in the training rows, which is overfitting.",
         table(["", "Training accuracy", "Test accuracy"], [["No penalty", "99%", "72%"]], [(0, 1), (0, 2)])),
    step("Look at its weights",
         "To chase every wiggle in the training data the model uses large weights (coefficients). Features a and b have big values, and c and d are tiny but still counted.",
         table(RG, [[r[0], r[1], "", ""] for r in RGW], [(r, 1) for r in range(4)])),
    step("Add a penalty on large weights",
         "Regularization adds a cost for big weights to the error the model is trying to minimize, so it only keeps a large weight if that weight really helps. The penalty's strength is a hyperparameter that you choose.",
         table(["", "What training minimizes"], [["Before", "error"], ["After", "error + penalty on the weights"]], [(1, 1)])),
    step("L2 (Ridge): shrink every weight",
         "All the weights get smaller and the outlier-driven swings are smoothed out, but none reaches zero. Most or all features stay in the model.",
         table(RG, [[r[0], r[1], r[2], ""] for r in RGW], [(r, 2) for r in range(4)])),
    step("L1 (LASSO): shrink and zero out",
         "L1 can push weights to exactly zero. c and d drop out of the model, so LASSO also acts as embedded feature selection.",
         table(RG, RGW, [(2, 3), (3, 3)])),
    step("The result: a smaller gap",
         "The penalized model fits the training data a little less, but it does much better on the test data. (Example numbers.) More data, feature selection or a larger k for kNN can also help with overfitting.",
         table(["", "Training accuracy", "Test accuracy", "Gap"],
               [["No penalty", "99%", "72%", "27"], ["With penalty", "93%", "88%", "5"]], [(1, 2), (1, 3)])),
]

# In guide order, one or more per guide section (main() fails if a section has none).
WALKTHROUGHS = [
    ("foundations", "Foundations: training finds the rule", "1. Machine Learning Foundations",
     "Fit a line to miles-to-km examples and watch the errors shrink to zero.", FOUND),
    ("knn", "kNN: classify a new point by voting", "2. Supervised Learning and Its Algorithms",
     "Measure, sort, take the k nearest, vote, then see how k changes the answer.", KNN),
    ("kfold", "k-fold cross-validation", "3. Evaluating a Model",
     "Five rounds, each fold takes a turn as the test set.", KFOLD),
    ("kmeans", "k-means clustering, one round at a time", "4. Clustering and Distance",
     "Assign points, move centroids, repeat until nothing changes.", KMEANS),
    ("workflow", "The machine learning workflow, stage by stage", "5. The Machine Learning Workflow",
     "Nine stages from loading data to monitoring the live model.", WORKFLOW),
    ("rfe", "Feature selection with RFE", "6. Feature Selection",
     "Train, drop the weakest feature, repeat, and see how the families compare.", FSEL),
    ("pcalda", "PCA versus LDA", "7. Dimensionality Reduction",
     "The same six points reduced two ways: by spread, then by class separation.", DIMRED),
    ("onehot", "One-hot encoding", "8. Feature Encoding",
     "Why numbering categories misleads a model and what one-hot does instead.", ENC),
    ("scaling", "Scaling: min-max and standardization", "9. Scaling",
     "The same column scaled both ways, with every calculation shown.", SCALING),
    ("regularization", "Regularization: L1 versus L2", "10. Regularization",
     "How a penalty on weights narrows the gap between training and test scores.", REGU),
]


def validate(w_id, steps, problems):
    for i, s in enumerate(steps):
        v, where = s["visual"], "%s step %d" % (w_id, i + 1)
        if v["type"] == "flow":
            if not 0 <= v["active"] < len(v["nodes"]):
                problems.append(where + ": active node out of range")
            continue
        width = len(v["headers"])
        for r, row in enumerate(v["rows"]):
            if len(row) != width:
                problems.append("%s: row %d has %d cells, headers have %d" % (where, r, len(row), width))
        for r, c in v["hl"]:
            if not (0 <= r < len(v["rows"]) and 0 <= c < width):
                problems.append("%s: highlight (%d, %d) is outside the table" % (where, r, c))


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
    problems += ["no walkthrough for guide section %r" % n for n in sections if n not in [w[2] for w in WALKTHROUGHS]]
    if problems:
        print("\n".join(problems))
        return 1
    doc = {"title": "ITD 140 Walkthroughs", "guideFile": GUIDE, "quizFile": QUIZ, "walkthroughs": out}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("%d walkthroughs, %d steps -> data/itd140-walkthroughs.json" % (len(out), sum(len(w["steps"]) for w in out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
