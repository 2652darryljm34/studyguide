#!/usr/bin/env python3
"""
Builds the ITD 140 SUPPLEMENTAL full-course study guide -> data/itd140-supplemental-guide.json.

    python3 tools/build_itd140_full_guide.py

One of a set of three built together: this guide, the flashcards (build_itd140_full_flashcards.py) and
the quiz (build_itd140_full.py). All three follow the same fifteen topics in the same order and link to
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
    note("Final exam:", "This guide covers the whole course for the final. Earlier quiz guides cover their own topics in more depth."),
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
    p("Example: 3 blocks east and 4 north is Manhattan **7** and Euclidean **5**. Manhattan is the **L1** distance and Euclidean the **L2** distance."),
    ul("**k-means++** only changes the **starting centroids**: it spreads them out instead of picking them purely at random, so the final clusters are steadier.",
       "**Hierarchical clustering** is drawn as a **dendrogram**, a tree of merges. Cutting the tree at a chosen height gives a chosen number of clusters.",
       "**DBSCAN** finds groups of any shape and labels isolated points as **noise** (outliers) instead of forcing them into a cluster."))

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
    p("Example: if LD1 separates two classes cleanly and LD2 does not, drop LD2 and still get the same results."),
    sub("The curse of dimensionality"),
    p("Every feature added is another dimension, and the space grows far faster than the data. Examples spread **thin (sparse)**, **distances between points become similar** so neighbours stop meaning much, the model gets **more complex and slower**, and it **overfits** more easily unless the number of examples grows too."),
    p("Example: with 10 bins per feature, 1 feature has 10 cells, 3 features have 1,000 and 5 features have 100,000. Fixes: **feature selection** (filter, wrapper, embedded), **elimination** of correlated or low-variance columns, or **dimensionality reduction** such as PCA."))

section("8. Feature Encoding",
    table(["Encoding", "What it does", "Example"],
          ["**Binarization**", "Continuous value to **two classes** at a threshold", "Views of 5,000 or more = popular, otherwise unpopular"],
          ["**Binning**", "Continuous values grouped into **ranges (bins)**", "Ages into 20-30, 30-40, 40-50"],
          ["**One-hot**", "Text categories to **binary columns**, one per category", "red = [1,0,0], green = [0,1,0], blue = [0,0,1]"]),
    note("Why not 1, 2, 3?", "Numbering categories implies an **order** (blue > green > red) that does not exist. One-hot avoids that."),
    ul("**Binary encoding:** a two-valued feature becomes 0 and 1 (yes = 1, no = 0). The name is also used for writing a category number in binary digits, one column per bit.",
       "**Target encoding:** each category is replaced by the **average of the target** for that category. It keeps one column however many categories there are, but a rare category's average is noisy and the target can **leak** into the feature, so compute it from the training data only.",
       "In pandas: **pd.get_dummies(column)** one-hot encodes a column.",
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

section("11. Feature Types and Imputation",
    sub("What is a feature?"),
    p("A **feature** is one measurable input column that describes each example. The **target** (label) is the column the model must predict."),
    table(["Kind", "Meaning", "Example"],
          ["**Continuous** (quantitative)", "Any value on a scale, including fractions", "Height 172.4 cm"],
          ["**Discrete** (quantitative)", "Countable whole numbers", "Number of siblings"],
          ["**Nominal** (qualitative)", "Categories with **no order**", "Colour, city"],
          ["**Ordinal** (qualitative)", "Categories with a **meaningful order**", "Small, medium, large"]),
    sub("Imputation: filling in missing values"),
    p("Most algorithms cannot accept blanks. **Imputation** fills each gap with a stand-in value so the row can still be used."),
    table(["Method", "How it fills the gap", "Best for"],
          ["**Mean substitution**", "The average of the known values", "Numeric columns with no strong outliers"],
          ["**Mode substitution**", "The most common value", "Categorical columns"],
          ["**Forward fill**", "Copies the previous row's value down", "Ordered data such as time series"],
          ["**Back fill**", "Copies the next row's value up", "Ordered data such as time series"],
          ["**Arbitrary / random value**", "A fixed marker (such as -1) or a random draw", "Flagging that the value was missing"]),
    p("Worked example: the column 4, ?, 8, ?, 6 has known mean (4 + 8 + 6) / 3 = **6**, so both gaps become 6. The column 10, ?, ?, 14 becomes 10, 10, 10, 14 with a forward fill and 10, 14, 14, 14 with a back fill."),
    note("Remember:", "Work out the fill value from the **training** data only, then reuse it on the test data. An outlier drags the mean, so it can mislead mean substitution."))

section("12. Trees, Forests and Perceptrons",
    table(["Model", "How it decides", "Notes"],
          ["**Decision tree**", "A chain of yes/no questions about feature values ends in a class", "Easy to read; one deep tree **overfits**"],
          ["**Random forest**", "Many trees, each trained on a random sample of rows and features; the class with the **most votes** wins", "Less overfitting and less variance than one tree; harder to read"],
          ["**Perceptron**", "One artificial neuron: weighted sum of inputs plus a bias, then an activation", "Learns only **linearly separable** classes"]),
    sub("Inside a neuron"),
    ul("**Weight:** how much one input counts. Training adjusts the weights.",
       "**Bias:** a constant added to the sum, shifting the point at which the neuron switches on.",
       "**Activation function:** turns the sum into the output. Without one, stacked layers collapse into a single linear model."),
    table(["Activation", "Output", "Typical use"],
          ["**ReLU**", "0 if the sum is negative, otherwise the sum itself", "Hidden layers"],
          ["**Sigmoid**", "A smooth S-curve between 0 and 1", "Output of a yes/no (binary) classifier"]),
    p("Worked example: inputs (2, 3), weights (0.5, -1), bias 1. The sum is 1 - 3 + 1 = **-1**. ReLU gives **0**. Sigmoid gives about **0.27**."),
    note("Remember:", "A neural network is many of these neurons arranged in layers. A single perceptron cannot learn a pattern that no straight line can separate."))

section("13. Neural Networks in Detail",
    table(["Term", "Meaning"],
          ["**Neuron**", "One unit: weighted sum plus bias, then an activation"],
          ["**Parameters**", "The **weights and biases**, learned during training"],
          ["**Hyperparameters**", "Settings chosen **before** training: learning rate, number of layers and neurons, activation function, epochs"],
          ["**Loss function**", "A number measuring how wrong the predictions are (for example mean squared error); training tries to reduce it"],
          ["**Learning rate**", "How big a step each weight takes when it is updated"],
          ["**Epoch**", "One full pass over the training data"]),
    sub("Feed-forward (fully connected) network"),
    p("Data flows **one way**, input layer to hidden layer(s) to output layer, and **every neuron connects to every neuron in the next layer**. Traditional machine learning needs features chosen by hand; a deep network (2 or more hidden layers) builds its own features layer by layer."),
    sub("Training: backpropagation"),
    ul("**Forward pass:** run an example through the network to get a prediction.",
       "**Loss:** compare the prediction with the label.",
       "**Backpropagation:** work backwards from the output to find how much each weight contributed to the loss.",
       "**Update:** new weight = old weight - learning rate x gradient. Repeat every epoch so the loss goes down."),
    p("Worked example: weight 0.80, gradient 0.50, learning rate 0.1 gives 0.80 - 0.1 x 0.50 = **0.75**. A learning rate that is too large overshoots; one that is too small trains very slowly."),
    ul("Simulator to try: https://github.profammons.com/neural-network-simulator.html",
       "Visual tour: https://distill.pub/2020/grand-tour/"))

section("14. Hyperparameter Tuning",
    table(["", "Parameters", "Hyperparameters"],
          ["Set by", "The **training algorithm**", "**You**, before training"],
          ["Examples", "Regression coefficients; network weights and biases", "k in kNN; tree depth; learning rate; number of clusters"],
          ["Changed by", "Fitting to the data", "Trying settings and comparing validation scores"]),
    sub("Ways to search"),
    table(["Method", "How it works", "Trade-off"],
          ["**Grid search**", "Tries **every combination** of the listed values", "Thorough but the cost multiplies with each setting"],
          ["**Randomized search**", "Tries a fixed number of **randomly drawn** combinations", "Cheaper; often finds a near-best setting"],
          ["**Bayesian search**", "Uses past results to **choose the next** setting to try", "Fewer trials; each choice depends on the last"]),
    sub("Scoring each setting"),
    p("Each candidate is scored with **k-fold cross-validation** so one lucky split cannot decide the winner. The final test set is kept aside until the end."),
    p("Worked example: 3 values of k, 2 weighting options and 4 tree depths in a grid give 3 x 2 x 4 = **24** combinations. With 5-fold validation that is 24 x 5 = **120** fits. A randomized search of 10 draws needs only 10 x 5 = **50**."))

section("15. Fairness, Bias and Data Quality",
    p("**Responsible AI** means building models that are fair, explainable and accountable. A model learns whatever pattern is in its data, including unfair ones."),
    table(["Fairness", "Question it asks"],
          ["**Group fairness**", "Do **groups** (for example by age or gender) receive similar outcomes on average?"],
          ["**Individual fairness**", "Are **similar people** treated similarly, whatever group they belong to?"]),
    p("The two can conflict: equalizing outcomes across groups can mean treating two similar individuals differently."),
    sub("Kinds of bias"),
    table(["Bias", "What goes wrong"],
          ["**Sample bias**", "The data does not represent the population (too few of some group)"],
          ["**Selection bias**", "The way examples were chosen or who responded skews the data"],
          ["**Measurement bias**", "The tool or the way a value is recorded is inaccurate or inconsistent across groups"],
          ["**Confirmation bias**", "People collect or read results in a way that supports what they already believe"],
          ["**Historical bias**", "The world itself was unfair, so even perfectly collected data copies old inequality"]),
    note("Historical vs selection:", "Selection bias is a flaw in **how the data was gathered**. Historical bias remains even if the sampling is flawless, because the data accurately records an unfair past."),
    sub("High-quality data"),
    p("Accurate, complete, consistent, up to date, relevant to the question and **representative** of everyone the model will serve."),
    sub("Bias metrics"),
    table(["Metric", "Formula", "Reads as"],
          ["**Normalized class imbalance (CI)**", "(n_a - n_d) / (n_a + n_d)", "How uneven the group sizes are: 0 balanced, near 1 one group dominates"],
          ["**Difference in proportions of labels (DPL)**", "q_a - q_d", "Gap in the share of positive outcomes between the two groups: 0 means equal"]),
    p("Worked example: 200 applicants in group A, 120 approved (q = 0.60), and 100 in group B, 40 approved (q = 0.40). CI = (200 - 100) / 300 = **0.33** and DPL = 0.60 - 0.40 = **0.20**."))

guide = {
    "title": "ITD 140 Final: Full-Course Study Guide",
    "description": "Whole-course final exam review: foundations, supervised algorithms, evaluation, clustering, the workflow, feature selection, PCA and LDA, encoding, scaling, regularization, feature types and imputation, trees, forests and perceptrons, neural networks in detail, hyperparameter tuning, and fairness and bias.",
    "quizFile": "data/itd140-supplemental-quiz.json",
    "flashcardsFile": "data/itd140-supplemental-flashcards.json",
    "sections": SECTIONS,
}

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/itd140-supplemental-guide.json" % len(SECTIONS))
