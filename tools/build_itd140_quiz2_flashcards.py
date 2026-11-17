#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 2 flashcards -> data/itd140-quiz2-flashcards.json.

    python3 tools/build_itd140_quiz2_flashcards.py

One card per term, grouped into the same eleven topics as the quiz, guide and walkthroughs. Terms must be
unique (the deck remembers "known" cards by term), and the build refuses incomplete cards.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-quiz2-flashcards.json")
CARDS = []


def c(topic, term, definition, use, example):
    CARDS.append({"topic": topic, "term": term, "definition": definition, "useCase": use, "example": example})


T = "Features and Feature Types"
c(T, "Feature", "One measurable input column that describes each example.",
  "Choose features that carry information about the target.", "Floor area, bedrooms and age of a house")
c(T, "Continuous feature", "A quantitative feature that can take any value on a smooth scale, decimals included.",
  "Spot it by asking whether a value halfway between two others makes sense.", "Body temperature of 36.8")
c(T, "Discrete feature", "A feature with separate, countable values, usually whole numbers.",
  "Counts are discrete but still quantitative: you can add and average them.", "Number of siblings: 0, 1, 2, 3")
c(T, "Qualitative feature", "A feature that names a category or quality instead of measuring an amount.",
  "Needs encoding before a model can use it. Either ordinal or nominal.", "Eye colour, shirt size")
c(T, "Ordinal feature", "A qualitative feature whose categories have a meaningful order.",
  "The order can be kept when encoding; the gaps between levels are not measured.", "Poor, fair, good")
c(T, "Nominal feature", "A qualitative feature whose categories are names with no order.",
  "Encode it so that no category looks bigger than another, for example with one-hot.", "Country, blood type, postal code")

T = "Missing Data and Removal"
c(T, "NaN", "The pandas marker for a missing or undefined value ('not a number').",
  "Find it with df.isna().sum() before deciding how to handle it.", "A blank survey answer loaded as NaN")
c(T, "Drop rows (dropna)", "Remove every row that has a missing value in any column: df.dropna().",
  "Good when few rows have gaps and many complete rows remain.", "1,000 rows with 15 gaps: 985 rows left")
c(T, "Drop columns", "Remove a column that has missing values: df.dropna(axis=1) or drop it by name.",
  "Good when most of a column is empty and it adds little.", "A column that is 90% empty")
c(T, "Imputation", "Filling a missing value with an estimate instead of removing the row.",
  "Use it when removal would lose too much data or bias what is left.", "Replacing a missing age with the median age")

T = "Imputing Numerical Data"
c(T, "Mean fill", "Replace gaps with the column average.",
  "Simple, but outliers pull it. It leaves the mean unchanged and shrinks the spread.", "10, 12, 14, 40 and a gap: 19")
c(T, "Median fill", "Replace gaps with the middle value of the column.",
  "Prefer it when there are outliers or skew.", "10, 12, 14, 40 and a gap: 13")
c(T, "Mode fill", "Replace gaps with the most frequent value.",
  "Works for discrete numbers and for categories.", "3, 5, 5, 7, 5 and a gap: 5")
c(T, "Constant / random fill", "Replace gaps with a fixed value, or with a randomly picked existing value.",
  "Quick, but a constant such as 0 can pass for real data, so pair it with a missing indicator.", "Fill gaps with -1")
c(T, "Missing indicator", "A new 0/1 column that records which rows had a missing value.",
  "Keep it next to the filled column when the fact of being missing may predict the target.", "income_missing = 1 for a blank income")

T = "Imputing Categorical Data"
c(T, "Categorical mode fill", "Put the most common category into every gap.",
  "The default fill for a categorical column, since words have no mean or median.", "Fill a missing city with the most frequent city")
c(T, "Forward fill ('pad')", "Copy the previous row's value into the gap. 'pad' is the same as ffill.",
  "Use it only when the row order is meaningful, such as days in a row.", "Red, NaN, NaN, Blue -> Red, Red, Red, Blue")
c(T, "Backfill", "Copy the next row's value upward into the gap (bfill).",
  "Same condition as forward fill; it can fill what a forward fill leaves in the first row.", "Red, NaN, NaN, Blue -> Red, Blue, Blue, Blue")
c(T, "Categorical constant fill", "Fill gaps with one fixed label, or a randomly chosen existing category.",
  "A label such as 'Unknown' keeps the gap visible as its own category.", "payment = 'Unknown'")

T = "Binning Numerical Data"
c(T, "Discretization", "Turning a continuous numeric feature into a limited set of ranges or categories.",
  "Simplifies a feature and softens noise, at the cost of detail.", "Age 37 becomes the bin '30-40'")
c(T, "Binning", "Replace each value with the bin (range) it falls into. An example of discretization.",
  "Use it to turn numbers into ordered categories.", "10 to 70 in 3 bins: 10-30, 30-50, 50-70")
c(T, "Equal-width binning", "Bins that each cover the same size of range: (max - min) / number of bins.",
  "Easy to explain; an outlier can leave most rows in a few bins. pd.cut.", "Width 20: 45 falls in 30-50")
c(T, "Equal-frequency binning", "Bins that each hold about the same number of rows, cut at quantiles.",
  "Keeps the bins balanced even with outliers. pd.qcut.", "1,2,3,4,5,6,7,100 in 2 bins: 1-4 and 5-100")

c(T, "Binarization", "Binning with one threshold: values on one side become one group and the rest another.",
  "Use it when a single cut-off is meaningful; you choose the threshold.", "Views of 5,000 or more: popular, else unpopular")

T = "Encoding Categorical Data"
c(T, "Encoding", "Converting categories into numbers. All data must ultimately be numeric.",
  "Required before most models can use a categorical feature.", "Yes / no becomes 1 / 0")
c(T, "Binary encoding", "Map a two-value feature to 0 and 1.",
  "Use it for yes/no style features.", "subscribed: yes = 1, no = 0")
c(T, "One-hot encoding", "One 0/1 column per category, with a 1 in the row's own category.",
  "Use it for 3+ nominal categories: it adds no false order. pd.get_dummies.", "red, green, blue -> is_red, is_green, is_blue")
c(T, "Target encoding", "Replace each category with a statistic of the target for it, usually the mean.",
  "Use it for features with very many categories. Learn it from training data only, to avoid leakage.", "Targets 1, 0, 1, 1 for category A: 0.75")

T = "Scaling"
c(T, "Scaling", "Rescaling features to comparable ranges so large values do not dominate.",
  "Matters for distance-based models such as kNN; trees mostly do not need it.", "Age 0-100 next to salary 0-100000")
c(T, "Min-max scaling (normalization)", "(x - min) / (max - min): rescales values to run from 0 to 1.",
  "Use it when you need a fixed range; one outlier squeezes the rest.", "20, 30, 50, 60: 30 becomes 0.25")
c(T, "Standardization", "(x - mean) / standard deviation: rescales to mean 0 and standard deviation 1.",
  "No fixed range, so an outlier does not squeeze the rest, though it still shifts the mean and spread.", "Mean 50, sd 10: 70 becomes 2")
c(T, "Scaling and outliers or skew", "Min-max is squeezed by an outlier; neither method removes skew because both are linear.",
  "Use a log transform to reduce skew, and fit scalers on training data only.", "Salary with a few huge values")

c(T, "Choosing min-max or standardization", "Min-max for unknown or non-bell-shaped data, kNN and neural networks; standardization when the algorithm assumes normal data.",
  "Decide from the distribution and the algorithm.", "kNN on skewed data: min-max")

T = "Validation, Overfitting and Underfitting"
c(T, "Train-test split", "Divide the data into a training set to learn from and a test set held back.",
  "Generally 80% train and 20% test.", "250 rows: 200 train, 50 test")
c(T, "Generalization", "How well a model's performance carries over to unseen data.",
  "Judge it by comparing training and test accuracy.", "Train 91%, test 89%")
c(T, "Overfitting", "The model memorizes the training data: high training accuracy, much lower test accuracy.",
  "Fix with a simpler model, fewer features, more data or cross-validation.", "Train 98%, test 70%")
c(T, "Underfitting", "The model is too simple: low accuracy on both training and test data.",
  "Fix with a more flexible model or better features.", "Train 61%, test 59%")
c(T, "Confusion matrix", "A table of actual versus predicted classes: true and false positives and negatives.",
  "Accuracy is the diagonal over the total; a false negative is a missed positive.", "TP 30, FP 10, FN 20, TN 40: 70%")
c(T, "Cross-validation", "Split into k folds, use each as the test set once, and average the scores.",
  "Gives a steadier estimate than one split and helps tune settings.", "5 folds of 200 rows: 40 test, 160 train per round")

T = "Curse of Dimensionality"
c(T, "Curse of dimensionality", "Problems that grow as the number of features increases: sparse data, similar distances, cost.",
  "Explains why more features can hurt, especially for kNN.", "100 rows and 500 features")
c(T, "Sparse data", "With many features the same rows are spread thinly through a huge space.",
  "A reason a model can memorize noise instead of learning a pattern.", "Few neighbours near any point")
c(T, "Complexity and performance cost", "More features mean more training time, memory and a harder model to interpret.",
  "Cut the cost with feature selection or dimensionality reduction.", "A model on 5,000 columns")

T = "Feature Selection"
c(T, "Feature selection", "Keeping a useful subset of the original features and dropping the rest.",
  "Reduces dimensionality while the columns keep their meaning.", "Keep 12 of 40 columns")
c(T, "Filter method", "Scores features with simple criteria, such as correlation, before any model is trained.",
  "Cheapest approach; ignores how features work together.", "Drop features with near-zero correlation with the target")
c(T, "Wrapper method", "Trains a model on feature subsets repeatedly and uses an evaluation metric to choose.",
  "Tends to find a good subset for that model but is the most expensive.", "Recursive feature elimination (RFE)")
c(T, "Embedded method", "Uses the results of a model, such as coefficients or importances, to choose features.",
  "Cheaper than a wrapper; depends on the model used.", "Lasso coefficients shrunk to zero")
c(T, "Forward and backward selection", "Wrapper methods: forward adds one feature at a time, backward removes one at a time.",
  "Each step is scored by training a model, so they are effective but slow.", "Add the feature that raises the score most")
c(T, "Low-variance feature", "A feature whose values barely differ between rows.",
  "A filter can drop it, since it is unlikely to help predict the target.", "A column that is 99% the same value")
c(T, "Correlation coefficient", "A number from -1 to 1 for the straight-line link between two variables.",
  "Judge by size: -0.85 is as strong as +0.85. Near 0 means little linear link.", "0.02 with the target: candidate to drop")
c(T, "Cross-correlation of features", "A table of correlations between every pair of features.",
  "Two features near 1 are redundant, so keep one.", "0.97 between two columns")
c(T, "SelectKBest", "A univariate filter that scores each feature against the target and keeps the k highest.",
  "Quick selection; it misses features that only help in combination.", "SelectKBest(k=5)")

T = "Principal Component Analysis"
c(T, "PCA (principal component analysis)", "Builds fewer new, uncorrelated features that keep as much variance as possible.",
  "Dimensionality reduction by transformation. Unsupervised: it ignores the target.", "10 features reduced to 3 components")
c(T, "Principal component", "A new feature that is a weighted blend of the originals. The first points along the greatest variance.",
  "Components are perpendicular and ordered by the variance they explain.", "PC1 explains 60% of the variance")
c(T, "Explained variance ratio", "The share of the total variance that each component captures.",
  "Add them up until you reach a target such as 90% to pick how many to keep.", "60 + 25 + 10 = 95%: keep 3")
c(T, "PCA versus feature selection", "Selection keeps some original columns unchanged; PCA creates new columns from combinations.",
  "Choose selection for interpretability, PCA to compress strongly correlated features. Standardize before PCA.", "Keep 'age'; or use a blend of 'age' and 'income'")

if __name__ == "__main__":
    seen = set()
    for card in CARDS:
        assert all(card.values()), card
        assert card["term"] not in seen, card["term"]
        seen.add(card["term"])
    deck = {"title": "ITD 140 Quiz 2 Flashcards",
            "guideFile": "data/itd140-quiz2-guide.json", "quizFile": "data/itd140-quiz2.json", "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d cards in %d topics -> data/itd140-quiz2-flashcards.json" % (len(CARDS), len({x["topic"] for x in CARDS})))
