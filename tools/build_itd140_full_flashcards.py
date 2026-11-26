#!/usr/bin/env python3
"""
Builds the ITD 140 SUPPLEMENTAL full-course flashcards -> data/itd140-supplemental-flashcards.json.

    python3 tools/build_itd140_full_flashcards.py

One card per term, grouped into the same fifteen topics as the supplemental quiz and guide. Terms must be
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

# ---- final-exam additions: extra cards inside earlier topics ----
c(C, "k-means++", "A k-means start-up rule that spreads the first centroids apart instead of choosing them purely at random.",
  "Use it to get steadier clusters from run to run.",
  "Starting centroids far apart, not two inside one blob")
c(C, "Dendrogram", "The tree diagram of hierarchical clustering that shows which clusters merged and at what distance.",
  "Cut it at a height to get a chosen number of clusters.",
  "Cutting a tall tree at the second level leaves 3 clusters")
c(C, "Manhattan (L1) and Euclidean (L2) distance", "L1 adds the horizontal and vertical steps; L2 is the straight-line distance.",
  "Pick the distance a clustering or kNN algorithm measures with.",
  "3 east and 4 north: L1 = 7, L2 = 5")
c(D, "Curse of dimensionality", "As features are added, data becomes sparse, distances look alike and models get slower and overfit more.",
  "Reduce features, or gather far more examples.",
  "10 bins: 1 feature = 10 cells, 5 features = 100,000 cells")
c(N, "Binary encoding", "Turning a two-valued feature into 0 and 1.",
  "Use it for yes/no features.",
  "smoker = yes becomes 1")
c(N, "Target encoding", "Replacing each category with the average target value for that category.",
  "Use it when a category has too many values for one-hot. Build it from training data only.",
  "City 'Dover' becomes 0.62 = its share of positive labels")

# ---- final-exam additions: new topics ----
T = "Feature Types and Imputation"
c(T, "Feature", "One measurable input column that describes each example.",
  "Choose and prepare features before training.",
  "Age, income and city for a loan model")
c(T, "Continuous vs discrete feature", "Continuous values can be any number on a scale; discrete values are countable whole numbers.",
  "Both are quantitative; check which one a column is before choosing a method.",
  "Height 172.4 cm versus 3 siblings")
c(T, "Nominal vs ordinal feature", "Both are categories; ordinal ones have a meaningful order, nominal ones do not.",
  "Ordinal categories can be numbered in order; nominal ones should be one-hot encoded.",
  "Small < medium < large versus red, green, blue")
c(T, "Imputation", "Filling in missing values with a stand-in so the row can still be used.",
  "Use it because most algorithms cannot accept blanks.",
  "Blank age replaced by the average age")
c(T, "Mean and mode substitution", "Fill gaps with the average (numbers) or the most common value (categories).",
  "Mean for numeric columns, mode for categorical ones.",
  "4, ?, 8, ?, 6: both gaps become 6")
c(T, "Forward and back fill", "Copy the previous value down (forward) or the next value up (back) into a gap.",
  "Use them for ordered data such as readings over time.",
  "10, ?, ?, 14 forward-fills to 10, 10, 10, 14")
c(T, "Arbitrary value imputation", "Fill gaps with a fixed marker or random value, such as -1.",
  "Use it when you want the model to know the value was missing.",
  "Missing income set to -1")

K = "Trees, Forests and Perceptrons"
c(K, "Decision tree", "A chain of yes/no questions about feature values that ends in a class.",
  "Use it when you need a model you can read.",
  "Is salary above 50k? Is the commute under 30 minutes?")
c(K, "Random forest", "Many decision trees trained on random samples; the class with the most votes wins.",
  "Use it to cut the overfitting of a single deep tree.",
  "100 trees vote: 71 say spam")
c(K, "Perceptron", "One artificial neuron that applies an activation to a weighted sum of inputs plus a bias.",
  "It can only learn classes that a straight line separates.",
  "Two inputs, two weights, one bias")
c(K, "Weight and bias", "A weight sets how much an input counts; a bias shifts when the neuron switches on.",
  "Both are parameters that training adjusts.",
  "sum = 0.5*x1 - 1*x2 + 1")
c(K, "ReLU", "An activation that outputs 0 for negative sums and the sum itself otherwise.",
  "Common in hidden layers.",
  "-1 becomes 0; 3 stays 3")
c(K, "Sigmoid", "An activation that squeezes any sum into a smooth value between 0 and 1.",
  "Use it at the output of a yes/no classifier.",
  "Sum -1 gives about 0.27")

U = "Neural Networks in Detail"
c(U, "Parameters vs hyperparameters (network)", "Weights and biases are learned parameters; learning rate, layers and epochs are chosen before training.",
  "Tune hyperparameters yourself and let training fit the parameters.",
  "Learning rate 0.01 is chosen; weights are learned")
c(U, "Loss function", "A number that measures how wrong the network's predictions are.",
  "Training tries to make it smaller each epoch.",
  "Mean squared error")
c(U, "Learning rate", "The size of the step each weight takes during an update.",
  "Too large overshoots; too small trains slowly.",
  "0.1 x gradient 0.5 moves a weight by 0.05")
c(U, "Feed-forward (fully connected) network", "A network where data flows one way and every neuron connects to every neuron in the next layer.",
  "The standard layout for tabular data.",
  "Input, two hidden layers, output")
c(U, "Backpropagation", "Working backwards from the loss to find how much each weight contributed, then updating the weights.",
  "It runs every epoch so the loss goes down.",
  "0.80 - 0.1 x 0.50 = 0.75")
c(U, "Epoch", "One full pass of the training data through the network.",
  "Training usually takes many epochs.",
  "20 epochs over 1,000 rows")
c(U, "Traditional vs deep learning", "Traditional ML needs hand-picked features; deep learning stacks 2 or more hidden layers that build features themselves.",
  "Use deep learning when features are hard to design, as with images.",
  "Hand-picked salary and commute versus raw pixels")

H = "Hyperparameter Tuning"
c(H, "Hyperparameter vs parameter", "A hyperparameter is set by you before training; a parameter is learned from the data.",
  "Tune the first, never set the second by hand.",
  "k in kNN versus coefficients in regression")
c(H, "Grid search", "Trying every combination of the listed hyperparameter values.",
  "Use it when there are few settings and few values.",
  "3 x 2 x 4 = 24 combinations")
c(H, "Randomized search", "Trying a fixed number of randomly drawn hyperparameter combinations.",
  "Use it when a full grid would take too long.",
  "10 random draws instead of 24 combinations")
c(H, "Bayesian search", "Using the results so far to choose which hyperparameters to try next.",
  "Use it when every trial is expensive.",
  "A good score at depth 6 steers the next try near 6")
c(H, "Cross-validation in tuning", "Each candidate setting is scored by k-fold cross-validation rather than one split.",
  "Stops one lucky split from picking the winner.",
  "24 combinations x 5 folds = 120 fits")

B = "Fairness, Bias and Data Quality"
c(B, "Responsible AI", "Building models that are fair, explainable and accountable.",
  "Check data and results for harm to groups and individuals.",
  "Auditing a loan model's approvals")
c(B, "Group vs individual fairness", "Group fairness compares outcomes between groups; individual fairness asks that similar people be treated alike.",
  "They can conflict, so state which one you measure.",
  "Equal approval rates by gender versus equal treatment of two similar applicants")
c(B, "Sample bias", "The data does not represent the population the model will serve.",
  "Check who is missing from the data.",
  "Training photos taken almost only of adults")
c(B, "Selection bias", "The way examples were chosen skews the data.",
  "Check how the data was gathered.",
  "Surveying only people who answer phone calls")
c(B, "Measurement bias", "A tool or recording method is less accurate or inconsistent for some cases.",
  "Check how each value was measured.",
  "A sensor that reads low for darker skin")
c(B, "Confirmation bias", "Collecting or reading results in a way that backs a belief already held.",
  "Look for evidence that could prove you wrong.",
  "Keeping only the runs that agree with your idea")
c(B, "Historical bias", "Unfairness from the past that stays in accurate data, even with flawless sampling.",
  "Do not treat past decisions as neutral labels.",
  "Past hiring records that favoured one group")
c(B, "Normalized class imbalance", "(n_a - n_d) / (n_a + n_d): how uneven the sizes of two groups are.",
  "0 means balanced; near 1 means one group dominates.",
  "200 versus 100: (200 - 100) / 300 = 0.33")
c(B, "Difference in proportions of labels", "The gap between two groups in the share of positive outcomes: q_a - q_d.",
  "0 means equal outcome rates.",
  "0.60 approved versus 0.40 approved: 0.20")
c(B, "High-quality data", "Data that is accurate, complete, consistent, current, relevant and representative.",
  "Check these before trusting a model's results.",
  "No gaps, no duplicates, every group present")

ORDER = [F, S, E, C, W, X, D, N, Z, R, T, K, U, H, B]
CARDS.sort(key=lambda x: ORDER.index(x["topic"]))

if __name__ == "__main__":
    seen = set()
    for card in CARDS:
        assert all(card.values()), card
        assert card["term"] not in seen, card["term"]
        seen.add(card["term"])
    deck = {"title": "ITD 140 Final: Full-Course Flashcards",
            "guideFile": "data/itd140-supplemental-guide.json", "quizFile": "data/itd140-supplemental-quiz.json", "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d cards in %d topics -> data/itd140-supplemental-flashcards.json" % (len(CARDS), len({x["topic"] for x in CARDS})))
