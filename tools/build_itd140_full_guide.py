#!/usr/bin/env python3
"""
Builds the ITD 140 SUPPLEMENTAL full-course study guide -> data/itd140-supplemental-guide.json.

    python3 tools/build_itd140_full_guide.py

One of a set of three built together: this guide, the flashcards (build_itd140_full_flashcards.py) and
the quiz (build_itd140_full.py). All three follow the same ten topics in the same order and link to
each other. When a topic changes in one, change it in all three.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-supplemental-guide.json")
SECTIONS = []


def section(name, *blocks):
    SECTIONS.append({"name": name, "blocks": list(blocks)})


def h(t): return {"type": "heading", "text": t}
def sub(t): return {"type": "subheading", "text": t}
def p(t): return {"type": "paragraph", "text": t}
def ul(*i): return {"type": "list", "items": list(i)}
def table(headers, *rows): return {"type": "table", "headers": headers, "rows": [list(r) for r in rows]}
def code(t): return {"type": "code", "text": t}
def note(label, t): return {"type": "note", "label": label, "text": t}


section("1. Machine Learning Foundations",
    note("SUPPLEMENTAL:", "This guide covers the whole course and is **not** the Quiz 1 guide. For the upcoming quiz, use the Quiz 1 Study Guide."),
    h("Programming versus learning"),
    table(["", "Traditional programming", "Machine learning"],
          ["Goes in", "Data **and rules** written by a person", "Data **and answers** (examples)"],
          ["Comes out", "Answers", "The **rules**, called the **model**"]),
    p("Example: converting miles to kilometres. A programmer would type the rule. A learning algorithm is shown many (miles, km) pairs and finds the rule itself, a line **y = m*x + b** with m close to 1.6 and b close to 0. m and b are the **parameters** that training finds."),
    sub("Correlation"),
    table(["Value", "Meaning"],
          ["Near **+1**", "Strong positive relationship: both rise together"],
          ["Near **-1**", "Strong negative (inverse) relationship: one rises as the other falls"],
          ["Near **0**", "No relationship"]),
    sub("Regression models"),
    ul("**Linear regression:** one input, y = mx + b; a simple form of predictive analytics.",
       "**Multivariate regression:** two or more inputs, each with its own coefficient; training finds the best coefficients.",
       "**Logistic regression:** produces a probability that is compared with a threshold (such as 0.5); used for **binary classification**."),
    sub("Deep learning"),
    p("Machine learning with **neural networks that have 2 or more hidden layers**. The output of one layer is the input of the next."))

section("2. Supervised Learning and Its Algorithms",
    p("Supervised learning learns a mapping from inputs to **labels** (the correct answers). The data is split into a **training set (about 70-80%)** and a **test set (about 20-30%)**. Both must contain inputs and correct labels. The trained model is then used on **new** data."),
    table(["Algorithm", "How it works", "Notes"],
          ["**kNN**", "Vote among the labels of the k nearest training points", "k is a hyperparameter; small k overfits, large k underfits"],
          ["**Decision tree**", "Questions about feature values lead down the tree to a class", "Traditional ML needed hand-picked features (salary, commute...)"],
          ["**SVM**", "Finds a boundary between classes using the **support vectors**", "Good in high dimensions; memory efficient; kernel functions; no direct probabilities"]),
    sub("Linear separability"),
    p("Classes are **linearly separable** when a straight line (or flat plane) can split one from the other."),
    sub("Datasets used in class"),
    ul("**Iris:** 150 flowers, 3 labels (setosa, versicolor, virginica), 4 features in cm (sepal length and width, petal length and width).",
       "**Spam:** 57 input columns (word and character frequencies, capital-letter run lengths) and a 58th column, the label: 1 = spam, 0 = not spam."),
    note("Remember:", "Classification has a discrete target; regression has a continuous one. Logistic regression is classification despite its name."))

section("3. Evaluating a Model",
    table(["Idea", "Detail"],
          ["**Accuracy**", "correct predictions / total test examples"],
          ["**Confusion matrix**", "Grid of actual versus predicted classes: **TP**, **FP**, **FN**, **TN**. It holds as many items as the test set."],
          ["**Cross-validation**", "Split the data into k folds; each fold is the test set once; k models are scored. With 5 folds, each round is 80% train / 20% test."],
          ["**Generalization**", "How well the model does on examples it never saw"]),
    sub("Overfitting and underfitting"),
    table(["", "Overfit", "Underfit"],
          ["Training accuracy", "High", "Low"],
          ["Test accuracy", "Low", "Low (or not high)"],
          ["Problem", "Memorizes the training set (and its noise)", "Too simple for the data"],
          ["Bias / variance", "Low bias, **high variance**", "**High bias**, low variance"]),
    note("Remember:", "Positive and negative refer to the class being counted: a **false negative** is an actual positive that the model called negative."))

section("4. Clustering and Distance",
    p("**Clustering** groups similar items without labels. It is **unsupervised**: it does not use a labelled training set. (**Data association** is another unsupervised solution.)"),
    table(["Family", "Example", "Idea"],
          ["**Centroid-based**", "k-means", "Distance to moving cluster centres (centroids)"],
          ["**Connectivity-based**", "Hierarchical", "Connect points step by step into a tree of clusters"],
          ["**Density-based**", "DBSCAN (density-based spatial clustering of applications with noise)", "Group points that are densely packed"]),
    sub("Distance between points"),
    table(["Measure", "Formula", "Notes"],
          ["**Euclidean**", "square root of (a1-b1)^2 + (a2-b2)^2", "Straight-line distance, the hypotenuse; more precise"],
          ["**Manhattan**", "|a1-b1| + |a2-b2|", "Sum of horizontal and vertical steps, like walking a city grid; cheaper to compute but less precise"]),
    p("Example: 3 blocks east and 4 north is Manhattan **7** and Euclidean **5**."))

section("5. The Machine Learning Workflow",
    table(["#", "Step"],
          ["1", "**Load** the dataset"],
          ["2", "**Explore** it with pandas and visualizations"],
          ["3", "**Transform** it: scikit-learn needs numbers, so non-numeric data is converted"],
          ["4", "**Split** into training and test sets"],
          ["5", "**Create** the model"],
          ["6", "**Train** then **test** it"],
          ["7", "**Tune** the model and evaluate accuracy"],
          ["8", "**Predict** on live data the model has not seen"],
          ["9", "**Monitor** the live model; tune, retrain or redeploy if needed"]),
    sub("The scikit-learn pattern"),
    code("x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2)\nmodel.fit(x_train, y_train)          # train\npredictions = model.predict(x_test)  # predict\naccuracy_score(y_test, predictions)  # compare with the real labels"),
    p("With 150 rows and test_size=0.2, that is 120 training rows and 30 test rows."))

section("6. Feature Selection",
    p("Feature engineering covers selecting and reducing features, encoding, scaling and regularization. **Feature selection** removes inputs that do not help, which saves time and memory and often improves results."),
    table(["Method", "How it works", "Cost"],
          ["**Filter**", "Scores features by their own characteristics, no model (variance, correlation, SelectKBest)", "Fast; less effective"],
          ["**Wrapper**", "Trains a model on feature subsets and scores them (forward selection, backward elimination, exhaustive search, **RFE**)", "Slow; very effective"],
          ["**Embedded**", "Selection happens while the model is built (**LASSO**); the model is fitted only once", "Balanced"]),
    ul("**Univariate filter:** a feature with very **low variance** adds little to predicting the target.",
       "**Multivariate filter:** pairwise correlations between features (a correlation heatmap).",
       "**SelectKBest:** keeps the K highest-scoring features (a filter).",
       "**RFE:** repeatedly builds models and drops the weakest feature; features are ranked by the order they were eliminated."))

section("7. Dimensionality Reduction",
    p("**Dimensions = features = inputs.** Reducing them cuts processing time and RAM and can show which features matter. A column that has no effect on the output can simply be dropped."),
    table(["", "PCA", "LDA"],
          ["Full name", "Principal component analysis", "Linear discriminant analysis"],
          ["Type", "**Unsupervised** (no labels)", "**Supervised** (uses labels)"],
          ["Goal", "Axes that **maximize variance** (spread)", "Axes that **maximize class separation**"]),
    p("Example: if LD1 separates two classes cleanly and LD2 does not, drop LD2 and still get the same results."))

section("8. Feature Encoding",
    table(["Encoding", "What it does", "Example"],
          ["**Binarization**", "Continuous value to **two classes** at a threshold", "Views of 5,000 or more = popular, otherwise unpopular"],
          ["**Binning**", "Continuous values grouped into **ranges (bins)**", "Ages into 20-30, 30-40, 40-50"],
          ["**One-hot**", "Text categories to **binary columns**, one per category", "red = [1,0,0], green = [0,1,0], blue = [0,0,1]"]),
    note("Why not 1, 2, 3?", "Numbering categories implies an **order** (blue > green > red) that does not exist. One-hot avoids that."),
    ul("In pandas: **pd.get_dummies(column)** one-hot encodes a column.",
       "The course slides name scikit-learn's LabelEncoder here. Be aware that it maps categories to integer codes; OneHotEncoder is the class that produces binary columns.",
       "The slides also show a 'multiple-hot' style that writes each category's number in binary and uses one column per bit, which needs fewer columns than one-hot. (Elsewhere, 'multi-hot' can mean a row with several 1s. Use your instructor's wording.)"))

section("9. Scaling",
    p("Attributes may use different scales (a 1-5 rating next to a 1-10 rating). Aligning them improves many ML operations, especially **distance-based** ones such as kNN, where a large-valued feature would dominate."),
    table(["", "Normalization (min-max)", "Standardization"],
          ["Result", "Values in the range **0 to 1**", "**Mean 0, standard deviation 1**"],
          ["Formula", "(x - min) / (max - min)", "(x - mean) / standard deviation"],
          ["Use when", "Distribution unknown or **not Gaussian**; kNN, neural nets", "The algorithm **assumes normally distributed** data"]),
    p("Worked example: min 10, max 110, value 35 gives (35-10)/100 = **0.25**. Mean 60, std dev 5, value 70 gives (70-60)/5 = **2**."))

section("10. Regularization",
    p("An overfit model tries too hard to capture **noise** and outliers. **Regularization** punishes large weights (coefficients), balancing bias and variance."),
    table(["", "L1 - LASSO", "L2 - Ridge"],
          ["Effect", "Can push coefficients to **exactly zero**, eliminating features", "Shrinks weights but **keeps most or all** features"],
          ["Bonus", "Also acts as embedded feature selection", "Smooths out the effect of outliers"]),
    note("Remember:", "LASSO = L1. If a model scores 99% on training and 72% on test, regularization, feature selection, more data or a larger k (for kNN) can all help."))

guide = {
    "title": "SUPPLEMENTAL: Full-Course Study Guide (not for Quiz 1)",
    "description": "Supplemental, whole-course material: foundations, supervised algorithms, evaluation, clustering and distance, the workflow, feature selection, PCA and LDA, encoding, scaling and regularization. This is NOT the Quiz 1 guide.",
    "quizFile": "data/itd140-supplemental-quiz.json",
    "flashcardsFile": "data/itd140-supplemental-flashcards.json",
    "sections": SECTIONS,
}

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/itd140-supplemental-guide.json" % len(SECTIONS))
