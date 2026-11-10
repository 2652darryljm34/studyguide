#!/usr/bin/env python3
"""
Builds the ITD 140 SUPPLEMENTAL full-course flashcards -> data/itd140-supplemental-flashcards.json.

    python3 tools/build_itd140_full_flashcards.py

One card per term, grouped into the same ten topics as the supplemental quiz and guide. Terms must be
unique (the deck remembers "known" cards by term), and the build refuses incomplete cards.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-supplemental-flashcards.json")
CARDS = []


def c(topic, term, definition, use, example):
    CARDS.append({"topic": topic, "term": term, "definition": definition, "useCase": use, "example": example})


F = "Machine Learning Foundations"
c(F, "Traditional programming vs ML", "Traditional: data plus rules give answers. ML: data plus answers give the rules (the model).",
  "Use ML when the rules are too many or too hard to write by hand.",
  "A learned miles-to-km line instead of a typed formula")
c(F, "Correlation", "A number from -1 to +1 showing how two variables move together.",
  "Check it to see whether one variable could help predict another.",
  "+0.9 strong positive; -0.9 strong inverse; 0 none")
c(F, "Multivariate regression", "Regression that predicts a value from two or more inputs, each with its own coefficient.",
  "Use it when one input is not enough to predict a number.",
  "Price from area, age and bedrooms")
c(F, "Logistic regression", "A model that outputs a probability compared with a threshold; used for binary classification.",
  "Use it for yes/no predictions.",
  "Probability 0.7 > 0.5, so predict 'will break down'")
c(F, "Deep learning", "Machine learning with neural networks that have 2 or more hidden layers.",
  "Use it when features are hard to hand-pick, as with images.",
  "Each layer's output feeds the next layer")

S = "Supervised Learning and Its Algorithms"
c(S, "Training and test sets", "Labelled data split into a training set (about 70-80%) and a test set (about 20-30%).",
  "Train on the first, check accuracy on the second.",
  "150 rows: 120 train, 30 test")
c(S, "Support vector machine (SVM)", "A classifier that finds a boundary between classes using the points nearest it, the support vectors.",
  "Good in high-dimensional data; kernels allow curved boundaries.",
  "Separating two flower species")
c(S, "Support vectors", "The training points that define the SVM boundary.",
  "Only these points are kept in the decision function, so SVMs are memory efficient.",
  "The points closest to the dividing line")
c(S, "Linear separability", "Classes are linearly separable when a straight line or plane can split them.",
  "Tells you whether a linear model can work.",
  "Two blobs on opposite sides of a line")
c(S, "Iris dataset", "A classic dataset: 150 flowers, 3 species (labels), 4 measurements in cm (features).",
  "Practice for classification and clustering.",
  "Features: sepal and petal length and width")

E = "Evaluating a Model"
c(E, "True/false positives and negatives", "TP and TN are correct predictions; FP is a negative called positive; FN is a positive called negative.",
  "Read them from the confusion matrix.",
  "Spam called ham = false negative")
c(E, "Cross-validation", "Splitting the data into k folds, using each as the test set once, and scoring k models.",
  "Gives a steadier accuracy estimate than a single split.",
  "5 folds on 500 rows: 400 train, 100 test each round")
c(E, "Generalization", "How well a model performs on examples it did not see in training.",
  "Measured by test accuracy.",
  "Train 97%, test 70%: poor generalization")
c(E, "Overfitting (high variance)", "The model memorizes the training set and its noise: high training accuracy, low test accuracy.",
  "Fix with regularization, fewer features or more data.",
  "Train 99%, test 70%")
c(E, "Underfitting (high bias)", "The model is too simple to capture the pattern: low accuracy on training and test sets.",
  "Fix with a more flexible model or better features.",
  "Straight line through curved data")

C = "Clustering and Distance"
c(C, "Centroid-based clustering", "Clustering by distance to cluster centres that are moved to fit the data. Example: k-means.",
  "Use it when you know roughly how many groups you want.",
  "k-means with k = 3")
c(C, "Hierarchical clustering", "Connectivity-based clustering that joins points step by step into a tree of clusters.",
  "Use it when you want to see how groups nest.",
  "Merging the two closest points, then groups")
c(C, "DBSCAN", "Density-based spatial clustering of applications with noise: groups points that are densely packed.",
  "Use it for odd-shaped clusters and to flag noise points.",
  "A dense ring of points becomes one cluster")
c(C, "Euclidean distance", "The straight-line distance between two points: the square root of the squared differences added up.",
  "The usual distance for clustering and kNN.",
  "(0,0) to (3,4) is 5")
c(C, "Manhattan distance", "The sum of the horizontal and vertical differences, like walking a street grid.",
  "Cheaper to compute but less precise than Euclidean.",
  "(0,0) to (3,4) is 7")

W = "The Machine Learning Workflow"
c(W, "ML project steps", "Load, explore, transform, split, create, train and test, tune, predict on live data, monitor.",
  "Follow in order; the split comes before training.",
  "Load CSV -> explore -> encode -> split -> fit")
c(W, "Transform the data", "Convert non-numeric data into numbers, because scikit-learn requires numeric input.",
  "Do it before splitting and fitting.",
  "One-hot encode a text column")
c(W, "fit / predict / accuracy_score", "fit trains the model, predict returns labels for new inputs, accuracy_score compares them with the real labels.",
  "The three calls of the scikit-learn pattern.",
  "classifier.predict(x_test)")
c(W, "train_test_split", "A scikit-learn function that splits data into training and test sets.",
  "Set test_size to the share held back.",
  "test_size=0.2 on 150 rows: 30 test")
c(W, "Monitor the live model", "Periodically evaluate the deployed model and tune, retrain or redeploy if needed.",
  "Do it because real-world data changes.",
  "Accuracy slowly drops after a year")

X = "Feature Selection"
c(X, "Feature selection", "Removing inputs that do not help the model.",
  "Saves time and memory and often improves results.",
  "Dropping a column that never changes")
c(X, "Filter method", "Scores features by their own characteristics, without training a model.",
  "A quick screen for irrelevant features.",
  "Low-variance filter; correlation; SelectKBest")
c(X, "Wrapper method", "Trains a model on feature subsets and scores them: very effective but computationally intensive.",
  "Use it when accuracy matters more than speed.",
  "Forward selection; RFE")
c(X, "Embedded method", "Feature selection built into model training; fits the model once.",
  "A balance between filter and wrapper.",
  "LASSO")
c(X, "RFE (recursive feature elimination)", "A wrapper that repeatedly builds models, drops the weakest feature, and ranks features by elimination order.",
  "Use it for a thorough ranking.",
  "Eliminate one feature per round")

D = "Dimensionality Reduction"
c(D, "Dimensionality reduction", "Cutting the number of features (dimensions) while keeping the useful information.",
  "Reduces processing time and memory.",
  "Dropping LD2 when LD1 separates the classes")
c(D, "PCA", "Principal component analysis: an unsupervised method that maps features onto fewer dimensions with maximum variance.",
  "Use it to compress features without labels.",
  "Ten measurements reduced to two components")
c(D, "LDA", "Linear discriminant analysis: a supervised method that finds the axes that best separate classes.",
  "Use it when labels are available.",
  "Axes LD1 and LD2")
c(D, "Dimension", "Another word for a feature or input.",
  "Remember: dimensions = features = inputs.",
  "A dataset with 57 columns has 57 dimensions")

N = "Feature Encoding"
c(N, "Binarization", "Converting a continuous value into two classes at a threshold.",
  "Use it when only above-or-below matters.",
  "5,000 views or more = popular")
c(N, "Binning", "Grouping continuous values into ranges (bins).",
  "Use it to turn a number into a few categories.",
  "Ages into 20-30, 30-40, 40-50")
c(N, "One-hot encoding", "Turning each category into its own 0/1 column.",
  "Use it for text categories so no false order is implied.",
  "green = [0, 1, 0]")
c(N, "Why not 1, 2, 3 for categories", "Numbering categories implies an order that does not exist.",
  "Avoid ordinal numbers for unordered categories.",
  "Blue = 3 looks 'greater' than red = 1")
c(N, "pd.get_dummies", "The pandas function that one-hot encodes a column.",
  "Call it on the categorical column.",
  "pd.get_dummies(df['colour'])")

Z = "Scaling"
c(Z, "Scaling", "Putting attributes on comparable scales.",
  "Do it for distance-based algorithms such as kNN.",
  "Rating 1-5 next to rating 1-10")
c(Z, "Normalization (min-max)", "Rescaling values into the range 0 to 1: (x - min) / (max - min).",
  "Use it when the distribution is unknown or not Gaussian.",
  "Min 10, max 110: 35 becomes 0.25")
c(Z, "Standardization", "Rescaling to mean 0 and standard deviation 1: (x - mean) / standard deviation.",
  "Use it when the algorithm assumes normal data.",
  "Mean 60, std 5: 70 becomes 2")
c(Z, "Normalization vs standardization", "Normalization gives a 0-1 range; standardization centres on 0 with variance 1.",
  "Choose by the algorithm and the data's distribution.",
  "kNN: normalization; assumes normal: standardization")

R = "Regularization"
c(R, "Regularization", "Penalizing large weights so a model stops fitting noise, balancing bias and variance.",
  "Use it to reduce overfitting.",
  "Train 99%, test 72%")
c(R, "L1 (LASSO)", "Regularization that can push coefficients to exactly zero, removing features.",
  "Use it for feature selection as well as regularization.",
  "A feature's weight shrinks to 0")
c(R, "L2 (Ridge)", "Regularization that shrinks weights but keeps most or all features.",
  "Use it to smooth out outliers without dropping features.",
  "Many small weights, none exactly zero")

if __name__ == "__main__":
    seen = set()
    for card in CARDS:
        assert all(card.values()), card
        assert card["term"] not in seen, card["term"]
        seen.add(card["term"])
    deck = {"title": "SUPPLEMENTAL: Full-Course Flashcards (not for Quiz 1)",
            "guideFile": "data/itd140-supplemental-guide.json", "quizFile": "data/itd140-supplemental-quiz.json", "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d cards in %d topics -> data/itd140-supplemental-flashcards.json" % (len(CARDS), len({x["topic"] for x in CARDS})))
