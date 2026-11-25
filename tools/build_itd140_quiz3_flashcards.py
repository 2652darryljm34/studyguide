#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 3 flashcards -> data/itd140-quiz3-flashcards.json.

    python3 tools/build_itd140_quiz3_flashcards.py

One card per term, grouped into the same fourteen topics as the quiz, guide and walkthroughs. Terms must be
unique (the deck remembers "known" cards by term), and the build refuses incomplete cards.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-quiz3-flashcards.json")
CARDS = []


def c(topic, term, definition, use, example):
    CARDS.append({"topic": topic, "term": term, "definition": definition, "useCase": use, "example": example})


T = "Supervised Learning Basics"
c(T, "Supervised learning", "Learning a mapping from inputs to a known target using labeled examples.",
  "Needs a label on every training row, so data with no target column cannot be used.", "Emails labeled spam or not spam")
c(T, "Target (label)", "The column holding the known answer that the model learns to predict.",
  "Everything else in the table is a candidate feature.", "'Churned' in a customer table")
c(T, "Classification", "Supervised learning where the target is a category.",
  "Scored with accuracy, precision, recall and F1.", "Benign or malignant tumor")
c(T, "Regression", "Supervised learning where the target is a number on a continuous scale.",
  "Scored with MSE and R-squared.", "Price of a used car")
c(T, "Training set", "The labeled rows (about 70-80%) the model learns from.",
  "Fit the model on these rows only.", "480 of 600 rows")
c(T, "Test set", "Labeled rows (about 20-30%) held back to judge the model on unseen data.",
  "Never learn from them, or the score is not fair.", "120 of 600 rows")

T = "Evaluation Metrics"
c(T, "Confusion matrix", "A count of predictions by actual and predicted class: TP, FP, FN, TN.",
  "Every classification metric is computed from these four numbers.", "TP 40, FP 10, FN 20, TN 130")
c(T, "False positive", "A negative row that the model wrongly calls positive: a false alarm.",
  "Precision drops as false positives rise.", "A genuine purchase blocked as fraud")
c(T, "False negative", "A positive row that the model wrongly calls negative: a miss.",
  "Recall drops as false negatives rise.", "A sick patient cleared as healthy")
c(T, "Accuracy", "(TP + TN) / all rows: the share of predictions that were right.",
  "Misleading when one class is rare.", "170 / 200 = 0.85")
c(T, "Precision", "TP / (TP + FP): of the rows flagged positive, the share that really were.",
  "Prioritize it when a false alarm is costly.", "40 / 50 = 0.80")
c(T, "Recall (sensitivity)", "TP / (TP + FN): of the truly positive rows, the share that were found.",
  "Prioritize it when a miss is costly.", "40 / 60 = 0.67")
c(T, "F1-score", "2 x precision x recall / (precision + recall), the harmonic mean of the two.",
  "One number when both kinds of error matter; low if either is low.", "P 0.60, R 0.30: F1 = 0.40")
c(T, "Imbalanced classes", "A dataset where one class is far rarer than the other.",
  "Accuracy can look high while the rare class is never found; check recall and F1.", "9,700 normal and 300 fraud rows")
c(T, "MSE (mean squared error)", "The average of the squared gaps between actual and predicted values.",
  "Lower is better; large misses count heavily. RMSE is its square root.", "Errors 1, 2, 3: (1 + 4 + 9) / 3 = 4.67")
c(T, "R-squared (R2)", "The share of the target's variance a model explains: 1 is perfect, 0 equals predicting the mean.",
  "Can be negative on test data for a model worse than the mean.", "R2 = 0.8: 80% of the variance explained")

T = "Cross-Validation, Overfitting and Underfitting"
c(T, "Generalization", "How well a model performs on new data it has not seen.",
  "The aim of every evaluation step.", "Test score close to training score")
c(T, "Overfitting", "High training score but much lower test score: noise has been memorized.",
  "Fix with a simpler model, more data, pruning or regularization.", "99% train, 71% test")
c(T, "Underfitting", "Low scores on both training and test data: the model is too simple.",
  "Fix with a more flexible model or better features.", "58% train, 57% test")
c(T, "Bias and variance", "Bias: error from over-simple assumptions. Variance: sensitivity to the particular training sample.",
  "Underfitting is high bias; overfitting is high variance.", "A straight line on a curve: high bias")
c(T, "k-fold cross-validation", "Split into k folds and train k models, each validating on a different fold; average the scores.",
  "A steadier estimate than one split, and every row is validated once.", "5 folds of 100 rows: 5 models")
c(T, "Stratified k-fold", "k-fold where every fold keeps the class proportions of the full data.",
  "Use when classes are imbalanced.", "10% fraud in every fold")
c(T, "Leave-one-out", "k-fold with k equal to the number of rows: one row validates, the rest train.",
  "Only for very small datasets; one model per row.", "100 rows: 100 models")
c(T, "Time-series split", "Validation that always trains on the past and tests on the future, without shuffling.",
  "For data ordered in time, so the model never learns from the future.", "Train Jan-Jun, test Jul")

T = "K-Nearest Neighbors"
c(T, "KNN", "Predicts from the k closest training points: a majority vote for classes, an average for numbers.",
  "Simple, no training step; needs scaled features.", "k = 5: three neighbors are class A, so A")
c(T, "Lazy learner", "An algorithm that builds no model in training and defers the work to prediction.",
  "That makes prediction slow on large datasets.", "KNN stores the rows and measures distances later")
c(T, "Euclidean distance", "Straight-line distance: the square root of the sum of squared gaps.",
  "The usual default distance.", "(1,2) to (4,6): 5")
c(T, "Manhattan distance", "The sum of the absolute gaps along each axis, like street-grid blocks.",
  "Cheaper to compute: no squares or square root.", "(2,7) to (6,4): 7")
c(T, "Choosing k", "Small k follows noise (overfit); large k blurs groups toward the majority class (underfit).",
  "Pick k by cross-validation; use an odd k for two classes.", "Try 1, 3, 5, 7, 9 and keep the best CV score")
c(T, "Feature scaling for KNN", "Rescaling features so that none dominates the distance.",
  "Do it before KNN, K-Means and other distance-based methods.", "Income (tens of thousands) versus age")

T = "Decision Trees"
c(T, "Decision tree", "A model that asks a chain of feature tests and ends in a prediction at a leaf.",
  "Readable as rules; needs no scaling.", "If income > 50k and age < 30, then class A")
c(T, "Root, internal node and leaf", "Root: the first test. Internal node: a test on one feature. Leaf: the final prediction.",
  "Rows are routed down branches until they reach a leaf.", "Root asks 'income > 50k?'")
c(T, "Gini impurity", "1 minus the sum of squared class shares: 0 for a pure node, 0.5 for an even two-class mix.",
  "The tree picks the split with the lowest weighted Gini.", "6 A and 2 B: 0.375")
c(T, "Entropy", "A measure of mixing: minus the sum of p x log2(p). 0 for a pure node, 1 bit for an even two-class mix.",
  "An alternative to Gini for choosing splits.", "50/50 node: 1 bit")
c(T, "Information gain", "The drop in entropy from a parent node to its weighted children.",
  "The split with the largest gain wins.", "Parent 1.0, children 0.4: gain 0.6")
c(T, "Pruning and depth limits", "Cutting branches or capping depth so a tree cannot memorize the training rows.",
  "The main defense against decision-tree overfitting.", "max_depth=4, min_samples_leaf=5")

T = "Random Forests"
c(T, "Ensemble learning", "Combining many models so that the joint prediction beats any single one.",
  "A random forest is an ensemble of decision trees.", "100 trees vote")
c(T, "Random forest", "Many decision trees, each trained on a bootstrap sample with random feature subsets, combined by vote or average.",
  "More accurate and stable than one tree, but harder to read.", "RandomForestClassifier(n_estimators=100)")
c(T, "Bootstrap sample", "Rows drawn at random with replacement to train one tree.",
  "Makes each tree see a different version of the data.", "Row 7 appears twice, row 9 not at all")
c(T, "Random feature subset", "At each split a tree may consider only some of the features.",
  "Keeps the trees different so their errors cancel.", "3 of 10 features per split")
c(T, "Out-of-bag rows", "Rows left out of a tree's bootstrap sample (about one third).",
  "Provide a free validation estimate for that tree.", "Score each tree on its unseen rows")

T = "Linear and Logistic Regression"
c(T, "Multiple linear regression", "Predicts a number as an intercept plus a weighted sum of several features.",
  "Assumes a straight-line relationship, independent errors with constant spread, and little multicollinearity.", "y = 12 + 3x1 + 2x2")
c(T, "Coefficient", "The change in the prediction for a one-unit rise in one feature, holding the others constant.",
  "An association within the model, not proof of cause.", "-35 per km from the center: rent falls by 35")
c(T, "Intercept", "The predicted value when every feature is 0.",
  "The starting point of the equation.", "12 in y = 12 + 3x1 + 2x2")
c(T, "Residual", "The actual value minus the predicted value.",
  "Residuals should be centered on zero with no pattern and constant spread.", "Actual 50, predicted 46: residual 4")
c(T, "Multicollinearity", "Two or more features strongly correlated with each other.",
  "Makes coefficients unstable, with sizes swinging and signs flipping; drop or combine features.", "square_feet and square_meters")
c(T, "VIF (variance inflation factor)", "A score showing how well a feature is predicted by the other features.",
  "Values above roughly 5-10 signal multicollinearity.", "VIF of 25 for one feature")
c(T, "Adjusted R-squared", "R-squared that is penalized for each extra feature.",
  "Plain R2 never falls on the training data when a feature is added.", "Adding a random column lowers it")
c(T, "Logistic regression", "A classifier that outputs a probability from 0 to 1, then applies a threshold.",
  "Despite the name, it predicts categories, not numbers.", "0.83 > 0.5: predict spam")

T = "Unsupervised Learning Basics"
c(T, "Unsupervised learning", "Learning from data with no target labels, looking for structure in the features.",
  "Cannot be checked against an answer key.", "Customer segments from purchase data")
c(T, "Clustering", "Grouping rows so that members resemble each other more than members of other groups.",
  "The most common unsupervised task.", "Three kinds of shoppers")
c(T, "Dimensionality reduction", "Describing the data with fewer features while keeping as much information as possible.",
  "Unsupervised, along with clustering. PCA is the standard example.", "60 survey columns to 5")
c(T, "Hard versus soft clustering", "Hard: each point in exactly one cluster. Soft (fuzzy): a degree of membership in several.",
  "Soft clustering suits points that sit between groups.", "70% sports, 30% politics")
c(T, "Three clustering families", "Centroid-based (K-Means), connectivity-based (hierarchical), density-based (DBSCAN).",
  "Choose by cluster shape and by whether you know k.", "K-Means, agglomerative, DBSCAN")

T = "K-Means Clustering"
c(T, "K-Means", "Forms k clusters by assigning points to the nearest centroid and moving centroids to their means until stable.",
  "You choose k first; it assumes round, similar-sized clusters.", "k = 3 customer groups")
c(T, "Centroid", "The mean position of the points in a cluster.",
  "Moves each iteration until assignments stop changing.", "(1,2), (3,4), (5,9) give (3,5)")
c(T, "Inertia", "The sum of squared distances from each point to its own centroid.",
  "Lower means tighter clusters, but it always falls as k grows.", "Inertia 120 at k = 3")
c(T, "Elbow plot", "A plot of inertia against k; the best k sits at the bend where the drop levels off.",
  "A visual way to choose k.", "Sharp drop to k = 4, then flat: choose 4")
c(T, "k-means++ and n_init", "A smarter start for the centroids, and reruns from different starts keeping the lowest inertia.",
  "K-Means can settle in a poor local optimum depending on its start.", "KMeans(n_clusters=3, n_init=10)")
c(T, "K-Means and outliers", "A centroid is a mean, so an extreme point drags it off the cluster's center.",
  "Remove outliers or use a method such as DBSCAN; also scale features first.", "One huge value skews a cluster")

T = "Hierarchical Clustering"
c(T, "Agglomerative clustering", "Bottom-up: every point starts as a cluster and the two closest are merged, repeatedly.",
  "No need to choose k in advance.", "Merge 1 and 2 first, then the next closest")
c(T, "Divisive clustering", "Top-down: start with one cluster and split it repeatedly.",
  "The reverse of agglomerative.", "One cluster splits into two, then four")
c(T, "Dendrogram", "A tree of merges; the height of each join is the distance at which the merge happened.",
  "Cut it with a horizontal line: the lines crossed are the clusters.", "A cut across 4 lines gives 4 clusters")
c(T, "Single and complete linkage", "Single: distance between the closest pair of points. Complete: between the farthest pair.",
  "Single tends to chain; complete gives compact clusters.", "Chained, stringy clusters (single)")
c(T, "Average and Ward linkage", "Average: mean distance over all pairs. Ward: merge the pair that raises within-cluster variance least.",
  "Ward gives compact, K-Means-like clusters.", "linkage='ward'")

T = "DBSCAN"
c(T, "DBSCAN", "Density-based clustering: clusters are dense regions separated by sparse ones; sparse points are noise.",
  "No k needed; finds any shape and flags outliers.", "Two concentric rings")
c(T, "eps", "The radius of the neighborhood around a point.",
  "Too small leaves much noise; too large merges clusters.", "eps = 0.5")
c(T, "min_samples", "How many points must lie within eps for a point to count as a core point.",
  "A higher value is stricter and creates more noise.", "min_samples = 5")
c(T, "Core, border and noise points", "Core: dense. Border: within eps of a core but not dense. Noise: reachable from no core.",
  "Noise is labeled -1 and left unassigned.", "A lone point far from everything")
c(T, "DBSCAN weaknesses", "Struggles when clusters differ greatly in density, and is sensitive to eps.",
  "Use a k-distance plot to choose eps, and scale the features.", "A tight cluster beside a loose one")

T = "Principal Component Analysis"
c(T, "PCA", "Builds fewer new, uncorrelated features (components) that keep as much variance as possible.",
  "Unsupervised dimensionality reduction; it ignores the target.", "30 features to 4 components")
c(T, "Principal component", "A weighted blend of all the original features. The first points along the greatest variance.",
  "Components are perpendicular and ordered by variance.", "PC1 explains 50% of the variance")
c(T, "Explained variance ratio", "The share of the total variance that each component holds.",
  "Add them up until you reach a goal such as 90-95% to choose how many to keep.", "50 + 20 + 15 + 10 = 95%: keep 4")
c(T, "Scree plot", "A plot of the explained variance of each component in order.",
  "Stop where the curve flattens.", "Steep to PC3, then level")
c(T, "Standardize before PCA", "PCA chases variance, so features in large units would dominate unless scaled.",
  "Standardize first, then fit PCA.", "StandardScaler then PCA(n_components=0.95)")
c(T, "PCA versus LDA", "PCA is unsupervised and maximizes variance. LDA uses the labels to maximize class separation.",
  "Both reduce dimensions; only LDA needs the target.", "PCA to compress, LDA to separate known classes")

T = "Neural Network Basics"
c(T, "Perceptron", "A neuron that computes an activation of the weighted sum of inputs plus a bias.",
  "One perceptron can only draw a straight-line boundary, so it cannot learn XOR.", "output = activation(w1x1 + w2x2 + b)")
c(T, "Weight", "A learned number that scales how strongly one input influences a neuron.",
  "A weight near 0 means that input has almost no influence.", "w = 0.02: negligible input")
c(T, "Bias", "A learned constant added to the weighted sum that shifts where a neuron activates.",
  "Weights and biases are the parameters that training changes.", "b = -2 delays activation")
c(T, "Activation function", "A non-linear function applied to a neuron's sum so the network can learn curves.",
  "Without it, stacked layers collapse into one linear transformation.", "ReLU, sigmoid, tanh, softmax")
c(T, "ReLU, sigmoid, tanh, softmax", "ReLU: max(0, x). Sigmoid: 0 to 1. Tanh: -1 to 1. Softmax: probabilities summing to 1.",
  "ReLU for hidden layers; sigmoid for two classes; softmax for many classes.", "ReLU(-3) = 0")
c(T, "Layers (input, hidden, output)", "Data enters the input layer, passes through hidden layers, and the prediction leaves the output layer.",
  "Input neurons = number of features. Deep learning means two or more hidden layers.", "8 features: 8 input neurons")
c(T, "Parameters versus hyperparameters", "Parameters (weights, biases) are learned. Layers, neurons and learning rate are set beforehand.",
  "Count a dense layer's parameters as inputs x neurons + neurons.", "4-5-3 network: 43 parameters")

T = "Training: Gradient Descent and Backpropagation"
c(T, "Loss function", "A score of how far the predictions are from the true targets.",
  "Training tries to make it small. MSE for regression, cross-entropy for classification.", "MSE of 4.0")
c(T, "Forward pass", "Pushing inputs through the layers to get a prediction.",
  "The first step of each training iteration.", "Inputs to hidden to output")
c(T, "Backpropagation", "Finds the gradient of the loss for every weight and bias by working backward with the chain rule.",
  "It supplies the gradients; gradient descent uses them.", "Output error flows back to earlier layers")
c(T, "Gradient descent", "Repeatedly nudges each weight against its gradient to reduce the loss.",
  "w_new = w_old - learning rate x gradient.", "5 - 0.1 x 2 = 4.8")
c(T, "Learning rate", "The step size that scales each gradient descent update.",
  "Too large overshoots and the loss bounces; too small is very slow.", "0.01 versus 5.0")
c(T, "Epoch, batch and mini-batch", "Epoch: one pass over all training data. Batch: all rows per update. Mini-batch: a small group per update.",
  "Mini-batch is the usual compromise between one row and all rows.", "Updates after every 32 rows")

if __name__ == "__main__":
    seen = set()
    for card in CARDS:
        assert all(card.values()), card
        assert card["term"] not in seen, card["term"]
        seen.add(card["term"])
    deck = {"title": "ITD 140 Quiz 3 Flashcards",
            "guideFile": "data/itd140-quiz3-guide.json", "quizFile": "data/itd140-quiz3.json", "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d cards in %d topics -> data/itd140-quiz3-flashcards.json" % (len(CARDS), len({x["topic"] for x in CARDS})))
