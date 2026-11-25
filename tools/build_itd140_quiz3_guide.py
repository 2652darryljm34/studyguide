#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 3 study guide -> data/itd140-quiz3-guide.json.

    python3 tools/build_itd140_quiz3_guide.py

One of a set built together: this guide, the flashcards (build_itd140_quiz3_flashcards.py), the quiz
(build_itd140_quiz3.py) and the walkthroughs (build_itd140_quiz3_walkthroughs.py). All follow the same
fourteen topics in the same order and link to each other. When a topic changes in one, change it in all.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-quiz3-guide.json")
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


section("1. Supervised Learning Basics",
    p("**Supervised learning** trains a model on **labeled** data: every example has input features and the known correct answer (the **target** or **label**). The model learns a mapping from inputs to the target, then predicts the target for new rows."),
    table(["Problem type", "Target", "Examples"],
          ["**Classification**", "A **category** (discrete)", "Spam or not, tumor benign or malignant, iris species"],
          ["**Regression**", "A **number** (continuous)", "House price, days until a machine fails, exam score"]),
    h("Training and test data"),
    ul("Split the labeled data: about **70-80% to train** and **20-30% to test**.",
       "The model learns from the training rows only. The **test set** is held back to estimate how it does on data it has **never seen**.",
       "Accuracy on rows the model already memorized is not a fair measure, so it is never the final score."),
    code("x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2)\nmodel.fit(x_train, y_train)        # learn\npred = model.predict(x_test)       # predict\naccuracy_score(y_test, pred)       # compare with the known answers"),
    note("Watch out:", "A dataset with features but **no target column** cannot train a supervised model: there are no known answers to learn from. That is a job for unsupervised learning (topic 8)."))

section("2. Evaluation Metrics",
    p("A **confusion matrix** counts predictions for a two-class problem. Call the class you care about **positive**."),
    table(["", "Predicted positive", "Predicted negative"],
          ["**Actual positive**", "True positive (TP)", "False negative (FN): a miss"],
          ["**Actual negative**", "False positive (FP): a false alarm", "True negative (TN)"]),
    table(["Metric", "Formula", "Asks"],
          ["**Accuracy**", "(TP + TN) / all rows", "What share of all predictions were right?"],
          ["**Precision**", "TP / (TP + FP)", "Of the rows flagged positive, how many really were?"],
          ["**Recall** (sensitivity)", "TP / (TP + FN)", "Of the rows that really were positive, how many were found?"],
          ["**F1-score**", "2 x P x R / (P + R)", "One number that balances precision and recall (their harmonic mean)"]),
    ul("**Imbalanced data:** 9,700 legitimate and 300 fraud rows, and a model that always says 'legitimate', scores **97% accuracy** yet finds **0%** of the fraud. Accuracy can look good while the model is useless.",
       "Choose **recall** when a miss is costly (screening for a disease). Choose **precision** when a false alarm is costly (a spam filter hiding real mail). **F1** when both matter.",
       "Example: TP 40, FP 10, FN 20, TN 130. Accuracy = 170 / 200 = **0.85**. Precision = 40 / 50 = **0.80**. Recall = 40 / 60 = **0.67**. F1 = **0.73**."),
    h("Regression metrics"),
    table(["Metric", "Meaning"],
          ["**MSE** (mean squared error)", "The average of the squared errors (actual minus predicted). Lower is better; big misses are punished heavily. **RMSE** is its square root, in the target's own units."],
          ["**R-squared** (R2)", "The share of the target's variance the model explains: 1 is perfect, **0 means no better than predicting the mean** every time, and it can go **negative** on test data for a model worse than that."]),
    note("Remember:", "Accuracy, precision, recall and F1 score **classifiers**. MSE and R2 score **regressors**."))

section("3. Cross-Validation, Overfitting and Underfitting",
    p("**Generalization** is how well a model does on new data. Two failures:"),
    table(["", "Overfitting", "Underfitting"],
          ["Pattern", "**High** training score, **much lower** test score", "**Low** on both training and test"],
          ["Cause", "Model memorizes noise (too complex, too little data)", "Model too simple to capture the pattern"],
          ["Error type", "High **variance**", "High **bias**"],
          ["Remedy", "Simpler model, more data, regularization, pruning", "More features, a more flexible model"]),
    h("Cross-validation"),
    p("A single split's score depends on which rows landed in the test set. **k-fold cross-validation** splits the data into k folds, then trains **k models**: each uses a **different fold for validation** and the other k-1 folds for training. The k scores are **averaged**, and every row is validated exactly once."),
    table(["Technique", "How it works", "Use it when"],
          ["**Hold-out**", "One train/test split", "Plenty of data, a quick check"],
          ["**k-fold**", "k folds, each used once for validation (commonly k = 5 or 10)", "The default choice"],
          ["**Stratified k-fold**", "Each fold keeps the **class proportions** of the full data", "Classes are imbalanced"],
          ["**Leave-one-out**", "k = number of rows: one row validates, the rest train", "Very small datasets (costly: one model per row)"],
          ["**Time-series split**", "Always train on the **past**, validate on the **future**; no shuffling", "Rows are ordered in time"]),
    ul("Cross-validation is also how you **compare models** and **tune hyperparameters** (such as k in kNN) without touching the test set.",
       "It does **not** remove overfitting; it gives a more honest estimate of it."))

section("4. K-Nearest Neighbors",
    p("**KNN** classifies a new point by looking at the **k closest training points** and letting them vote."),
    ul("**1.** Pick k.  **2.** Measure the distance from the new point to every training point.  **3.** Take the k nearest.  **4.** Classification: assign the **majority class** among them. Regression: **average** their target values."),
    table(["Distance", "Formula (2 features)", "Notes"],
          ["**Euclidean**", "sqrt( (a1 - b1)^2 + (a2 - b2)^2 )", "Straight-line distance, the usual default"],
          ["**Manhattan**", "|a1 - b1| + |a2 - b2|", "Sum along each axis, like city blocks; cheaper to compute"]),
    h("Choosing k"),
    table(["", "Small k (e.g. 1)", "Large k"],
          ["Boundary", "Jagged, follows every point", "Smooth, blurs small groups"],
          ["Risk", "**Overfitting** (high variance), sensitive to noise", "**Underfitting** (high bias), the majority class swamps small ones"]),
    ul("Choose k with **cross-validation**. For two classes use an **odd** k to avoid tied votes. k is a **hyperparameter**: you set it before training.",
       "**Scale the features first.** Distances are dominated by whichever feature has the biggest numbers (income in the tens of thousands drowns years of education)."),
    table(["Strengths", "Weaknesses"],
          ["Simple to understand", "Slow at prediction: compares against every stored row"],
          ["Makes no assumption about the shape of the boundary", "Needs scaling; irrelevant features hurt"],
          ["No training step", "Memory heavy; weak in many dimensions (curse of dimensionality)"]),
    note("Remember:", "KNN is a **lazy learner**: no model is built in training. It stores the data and does all the work at prediction time."))

section("5. Decision Trees",
    p("A **decision tree** asks a chain of yes/no questions about the features. The **root** is the first question, each **internal node** is a **test on one feature** that routes a row down a branch, and each **leaf** holds the final prediction."),
    h("Splitting criteria"),
    p("At each node the tree picks the split that makes the child nodes **purer**, meaning each holds mostly one class."),
    table(["Measure", "Formula", "Pure node", "Most mixed (2 classes)"],
          ["**Gini impurity**", "1 - sum of p^2", "**0**", "**0.5**"],
          ["**Entropy**", "- sum of p x log2(p)", "**0**", "**1** bit"]),
    ul("Example: a node with 6 of one class and 2 of another has p = 0.75 and 0.25. Gini = 1 - (0.5625 + 0.0625) = **0.375**.",
       "**Information gain** = the parent's entropy minus the weighted average entropy of its children. The split with the biggest gain wins.",
       "The tree keeps splitting until the leaves are pure or a limit is hit."),
    table(["Strengths", "Weaknesses"],
          ["Easy to read as rules", "A deep tree **overfits** by memorizing the training data"],
          ["No scaling needed", "Small changes in the data can produce a very different tree"],
          ["Handles non-linear patterns", "Single trees are less accurate than ensembles"]),
    note("Remember:", "Limit overfitting with **max_depth**, **min_samples_leaf** or **pruning**."))

section("6. Random Forests",
    p("A **random forest** is an **ensemble**: many decision trees whose predictions are combined. Combining many different, imperfect models beats one."),
    ul("Each tree is trained on a **bootstrap sample**: rows drawn **with replacement** from the training data, so each tree sees a different version of it.",
       "At **each split** a tree may consider only a **random subset of the features**, so the trees differ from one another.",
       "Prediction: **majority vote** of the trees (classification) or the **average** (regression).",
       "Because the trees make different errors, many of them **cancel out**: the forest has **lower variance** than a single tree and overfits less."),
    ul("About **one third** of the rows are left out of each bootstrap sample. These **out-of-bag** rows give a free validation estimate.",
       "**n_estimators** is the number of trees. More trees steady the result but cost time.",
       "A forest reports **feature importances**, but it is harder to read than one tree."),
    table(["", "Single tree", "Random forest"],
          ["Accuracy", "Lower, unstable", "Higher, stable"],
          ["Overfitting", "Prone", "Much less"],
          ["Readability", "Easy to follow", "Hard to follow"],
          ["Speed", "Fast", "Slower (many trees)"]),
    note("Remember:", "A forest does **not** pick one best tree and discard the rest. It **combines all of them**."))

section("7. Linear and Logistic Regression",
    p("**Multiple linear regression** predicts a number from several features: **y = b0 + b1x1 + b2x2 + ...**. Training finds the coefficients that make the squared errors smallest."),
    ul("The **intercept** b0 is the prediction when every feature is 0.",
       "A **coefficient** is the change in the predicted target for a **one-unit increase in that feature, holding the other features constant**. It describes association in the model, not proof of cause.",
       "A **residual** is actual minus predicted. Good residuals are centered on zero with no pattern."),
    h("Assumptions"),
    ul("**Linearity:** the target relates to the features in a straight-line way.",
       "**Independent errors:** one row's error says nothing about another's.",
       "**Constant variance** of the residuals (homoscedasticity) and roughly **normal** residuals.",
       "**No severe multicollinearity** among the features."),
    h("Multicollinearity and feature selection"),
    p("**Multicollinearity** means two or more features are highly correlated with **each other**. The model cannot tell which one deserves the credit, so coefficients become **unstable**: they swing in size, or flip sign, when a feature is added or dropped, even though predictions may stay fine."),
    ul("Detect it with a **correlation matrix** or the **VIF** (variance inflation factor; above about 5-10 is a worry).",
       "Fix it by **dropping or combining** the redundant features, using **PCA**, or **regularization** (Ridge, Lasso).",
       "Select features that correlate with the target but **not with each other**."),
    table(["Metric", "Notes"],
          ["**MSE / RMSE**", "Average squared error (RMSE in target units). Lower is better."],
          ["**R2**", "Share of variance explained, 0 to 1. On training data it **never goes down** when you add a feature, so **adjusted R2** penalizes useless ones."]),
    h("Logistic regression"),
    p("Despite the name it is a **classifier**. It passes a weighted sum through the **sigmoid** to output a **probability between 0 and 1**, then compares it with a **threshold** (commonly 0.5) to pick the class."))

section("8. Unsupervised Learning Basics",
    p("**Unsupervised learning** works on data with **no target labels**. It looks for **structure in the features themselves**, with no known right answers to check against."),
    table(["Task", "Goal", "Example"],
          ["**Clustering**", "Group rows so members resemble each other more than other groups", "Customer segments"],
          ["**Dimensionality reduction**", "Fewer features while keeping as much information as possible", "PCA"],
          ["**Association**", "Find items that occur together", "Products bought together"]),
    ul("Clustering and dimensionality reduction are the two unsupervised tasks to know. **Classification and regression are supervised.**",
       "**Hard** clustering puts each point in exactly one cluster. **Soft (fuzzy)** clustering gives a **degree of membership** in several.",
       "Three families of clustering: **centroid-based** (K-Means), **connectivity-based** (hierarchical) and **density-based** (DBSCAN).",
       "Judging a clustering is harder without labels. Tools include **inertia** and the **silhouette score**."),
    table(["", "Supervised", "Unsupervised"],
          ["Labels", "Required", "None"],
          ["Goal", "Predict the target", "Discover structure"],
          ["Examples", "KNN, trees, regression", "K-Means, DBSCAN, PCA"]))

section("9. K-Means Clustering",
    p("**K-Means** is **centroid-based**: it forms k clusters, each represented by its **centroid** (the mean of its points). **You choose k in advance.**"),
    ul("**1. Initialize:** place k centroids (random points, or smarter with k-means++).",
       "**2. Assign:** each point joins the **nearest** centroid (Euclidean distance).",
       "**3. Update:** move each centroid to the **mean** of the points assigned to it.",
       "**4. Repeat** steps 2 and 3 until the assignments **stop changing**."),
    h("Inertia and the elbow plot"),
    p("**Inertia** is the **sum of squared distances** from each point to its own centroid. Lower means tighter clusters."),
    ul("Inertia **always falls as k grows** (with k = the number of rows it is 0), so the minimum is not the best k.",
       "Plot inertia against k and look for the **elbow**: the bend after which extra clusters add little. Pick k there."),
    table(["Strengths", "Weaknesses"],
          ["Simple and fast on large data", "Must choose k first"],
          ["Tight, compact clusters", "Assumes roughly round clusters of similar size"],
          ["Easy to interpret centroids", "Sensitive to **outliers** (they drag a mean) and to the starting centroids; **scale first**"]),
    note("Remember:", "Different starting centroids can give different answers, so scikit-learn reruns it (n_init) and keeps the lowest inertia."))

section("10. Hierarchical Clustering",
    p("**Hierarchical** clustering is **connectivity-based**: it builds a nested family of clusters and you decide afterwards how many to keep."),
    ul("**Agglomerative (bottom-up):** every point starts as its **own cluster**, then the **two closest clusters are merged**, again and again, until one remains.",
       "**Divisive (top-down)** does the reverse: start with one cluster and split."),
    h("Dendrograms"),
    p("A **dendrogram** is the tree of merges. The leaves are the points, and the **height** of each join is the **distance at which the merge happened**. **Cut it with a horizontal line**: the number of vertical lines the cut crosses is the number of clusters. Long vertical gaps suggest natural cut points."),
    h("Linkage criteria: how to measure the distance between two clusters"),
    table(["Linkage", "Distance between clusters is...", "Tends to give"],
          ["**Single**", "The **closest** pair of points", "Long, stringy 'chained' clusters"],
          ["**Complete**", "The **farthest** pair of points", "Compact, similar-sized clusters"],
          ["**Average**", "The **average** over all pairs", "A middle ground"],
          ["**Ward**", "Merge whichever pair **raises the within-cluster variance least**", "Compact, K-Means-like clusters"]),
    ul("**No need to choose k up front** and the dendrogram shows the structure at every level.",
       "It is **slow on big data** (it works on all pairwise distances) and a **merge cannot be undone**."))

section("11. DBSCAN",
    p("**DBSCAN** is **density-based**: clusters are crowded regions separated by sparse ones. It needs two settings:"),
    table(["Setting", "Meaning"],
          ["**eps**", "The **radius** of the neighborhood around a point"],
          ["**min_samples**", "How many points must lie inside that radius for the point to count as dense (a core point)"]),
    table(["Point type", "Definition"],
          ["**Core point**", "Has at least min_samples points within eps"],
          ["**Border point**", "Within eps of a core point, but not dense enough to be core itself"],
          ["**Noise**", "Neither: it is left **unassigned** and labeled -1 instead of being forced into a cluster"]),
    ul("A cluster grows by chaining outward from core points to their neighbors.",
       "You do **not** choose the number of clusters, and clusters can be **any shape**: it handles **two concentric rings** where K-Means fails.",
       "It **finds outliers** as noise. It struggles when clusters have **very different densities**, is sensitive to **eps**, and needs scaled features."),
    table(["", "K-Means", "DBSCAN"],
          ["Choose k?", "Yes", "No (choose eps and min_samples)"],
          ["Cluster shape", "Round blobs", "Any shape"],
          ["Outliers", "Pulled into clusters", "Labeled as noise"]))

section("12. Principal Component Analysis",
    p("**PCA** is **dimensionality reduction**. It builds **new** features, the **principal components**, each a **weighted combination of all the original features**, ordered by how much of the data's **variance** each captures. Components are **uncorrelated** (perpendicular)."),
    ul("PCA is **unsupervised**: it ignores the target.",
       "**Standardize first**, or the feature with the biggest numbers dominates the variance.",
       "**Explained variance ratio** is the share of the total variance each component holds. Add them up (the **cumulative** ratio) and keep enough components to reach a goal such as **90-95%**.",
       "Example: ratios of 50%, 20%, 15%, 10% and 5% add up to 50, 70, 85 and 95 percent, so you need **4** components to keep at least 90%.",
       "A **scree plot** of the ratios shows where they flatten out."),
    table(["Uses", "Costs"],
          ["Fewer columns: faster models, less overfitting", "Components have **no ready-made name**: each blends every original feature"],
          ["2-D or 3-D plots of high-dimensional data", "Variance in the dropped components is lost"],
          ["Removes multicollinearity, reduces noise", "Interpretation means studying which features carry large weights"]),
    note("Remember:", "50 features reduced to 5 components give 5 **new** columns, not 5 of the original ones."))

section("13. Neural Network Basics",
    p("A **neural network** is layers of simple units (**neurons**) joined by weighted connections. The simplest unit is the **perceptron**: it multiplies each input by a **weight**, adds them up with a **bias**, and passes the sum through an **activation function**."),
    code("output = activation( w1*x1 + w2*x2 + ... + b )"),
    ul("**Weights** set how strongly each input influences the neuron. A weight near **0** means that input has almost no influence.",
       "The **bias** is a learned constant added to the weighted sum. It **shifts the point at which the neuron activates**.",
       "Weights and biases are the **parameters**: the values that **change during training**. The number of layers, neurons and the learning rate are **hyperparameters** you set before.",
       "A single perceptron can only separate classes with a **straight line** (linearly separable), so it cannot learn XOR."),
    h("Activation functions"),
    table(["Function", "Output", "Common use"],
          ["**Step**", "0 or 1", "The original perceptron"],
          ["**Sigmoid**", "0 to 1", "Binary output (a probability)"],
          ["**Tanh**", "-1 to 1", "Hidden layers, centered on zero"],
          ["**ReLU**", "max(0, x)", "The usual choice for hidden layers"],
          ["**Softmax**", "Probabilities that **sum to 1**", "Output layer for many classes"]),
    p("Without a **non-linear** activation, any number of stacked layers collapses into **one linear transformation**, so depth would add nothing. The activation is what lets a network learn curved boundaries."),
    h("Architecture"),
    ul("Data enters the **input layer** (one neuron per feature), passes through one or more **hidden layers**, and the prediction leaves the **output layer**.",
       "**Deep learning** means a network with **two or more hidden layers**.",
       "More layers and neurons can represent **more complex patterns**, but the network is **more prone to overfitting** and costs more to train.",
       "Output layer: 1 neuron for regression or two classes; one neuron **per class** with softmax for many classes.",
       "**Parameter count** of a dense layer = inputs x neurons + neurons (the biases). A 4-5-3 network has (4x5 + 5) + (5x3 + 3) = **43** parameters."))

section("14. Training: Gradient Descent and Backpropagation",
    p("Training adjusts the weights and biases so that predictions get closer to the targets. One pass over all the training data is an **epoch**."),
    ul("**1. Forward pass:** push the inputs through the layers to get a prediction.",
       "**2. Loss:** a **loss function** scores the error (MSE for regression, cross-entropy for classification).",
       "**3. Backpropagation:** work **backwards** from the output, using the **chain rule**, to find the **gradient**: how much the loss changes with each weight and bias.",
       "**4. Gradient descent update:** nudge every weight **against its gradient**, in the direction that **reduces the loss**."),
    code("w_new = w_old - learning_rate * gradient"),
    table(["Learning rate", "Effect"],
          ["**Too large**", "Steps overshoot the minimum, so the loss bounces or blows up"],
          ["**Too small**", "Steps are tiny, so training is very slow"],
          ["**About right**", "The loss falls steadily"]),
    ul("Example: w = 3, gradient = 4, learning rate 0.1 gives w = 3 - 0.4 = **2.6**.",
       "**Backpropagation** computes the gradients. **Gradient descent** uses them to update the weights. They are partners, not the same thing.",
       "**Batch** gradient descent uses all rows per update, **stochastic** uses one row, **mini-batch** uses a small group (the usual choice).",
       "Gradient descent does **not** try every combination of weights, and it does not add layers: it takes many small downhill steps on the loss."),
    note("Remember:", "Overfitting is controlled with more data, early stopping (halt when validation loss stops improving), regularization or dropout."))

guide = {
    "title": "ITD 140 Quiz 3 Study Guide",
    "description": "Supervised learning, evaluation metrics, cross-validation, KNN, decision trees, random forests, regression, unsupervised learning, K-Means, hierarchical clustering, DBSCAN, PCA and neural networks, in the same order as the quiz, flashcards and walkthroughs.",
    "quizFile": "data/itd140-quiz3.json",
    "flashcardsFile": "data/itd140-quiz3-flashcards.json",
    "sections": SECTIONS,
}

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/itd140-quiz3-guide.json" % len(SECTIONS))
