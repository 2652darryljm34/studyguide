#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 2 study guide -> data/itd140-quiz2-guide.json.

    python3 tools/build_itd140_quiz2_guide.py

One of a set built together: this guide, the flashcards (build_itd140_quiz2_flashcards.py), the quiz
(build_itd140_quiz2.py) and the walkthroughs (build_itd140_quiz2_walkthroughs.py). All follow the same
eleven topics in the same order and link to each other. When a topic changes in one, change it in all.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-quiz2-guide.json")
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


section("1. Features and Feature Types",
    p("A **feature** is one measurable input column that describes each example. The **target** is the column being predicted. Features come in types, and the type decides how you prepare them."),
    table(["Type", "Meaning", "Example"],
          ["**Continuous** (quantitative)", "Any value on a smooth scale, decimals included", "Height, temperature, price"],
          ["**Discrete** (quantitative)", "Countable, separate values, usually whole numbers", "Number of siblings, items bought"],
          ["**Ordinal** (qualitative)", "Named categories with a **meaningful order**", "Small / medium / large; poor / fair / good"],
          ["**Nominal** (qualitative)", "Named categories with **no order**", "Eye colour, country, blood type"]),
    p("**Quantitative** features are measured amounts you can do arithmetic on. **Qualitative** (categorical) features are categories, either ordinal or nominal."),
    note("Watch out:", "A number used as a label is still a category. Postal codes and jersey numbers are **nominal**: adding two of them, or calling one 'bigger', means nothing."))

section("2. Missing Data and Removal",
    p("Missing values appear in pandas as **NaN** (not a number). Find them before choosing what to do."),
    code("df.isna().sum()      # missing values per column"),
    h("Removal methods (throwing it out)"),
    table(["Method", "Code", "What it does"],
          ["Drop rows", "`df.dropna()`", "Removes every row with a missing value in **any** column"],
          ["Drop columns", "`df.dropna(axis=1)`", "Removes every column that has a missing value"]),
    ul("**Drop rows** when only a small share of rows have gaps and plenty of complete rows remain.",
       "**Drop a column** when most of it is empty and it can add little.",
       "A row is lost if **any** of its columns is missing, so scattered gaps can remove far more rows than any one column's percentage suggests."),
    note("Watch out:", "If the gaps are not random (for example, high earners skip the income question), removing them **biases** the data that is left."))

section("3. Imputing Numerical Data",
    p("**Imputation** fills each gap with an estimate so the row can be kept."),
    table(["Method", "Fills with", "Notes"],
          ["**Mean fill**", "The column average", "Pulled by outliers; leaves the mean unchanged but **shrinks the spread**"],
          ["**Median fill**", "The middle value", "Safer when there are outliers or skew"],
          ["**Mode fill**", "The most frequent value", "Useful for discrete columns"],
          ["**Constant / random fill**", "A fixed value (0, -1) or a random existing value", "Easy, but a constant can look like real data"],
          ["**Missing indicator**", "A new **0/1 column** marking the rows that were missing", "Kept alongside a fill; the fact of missingness can be informative"]),
    p("Example: 10, 12, 14, 40 and a gap. Mean fill gives 76 / 4 = **19**. Median fill gives (12 + 14) / 2 = **13**. The 40 drags the mean up and not the median."),
    note("Remember:", "Add a missing indicator when the reason a value is missing might itself predict the target."))

section("4. Imputing Categorical Data",
    p("Words have no mean or median, so categorical columns use these methods."),
    table(["Method", "Fills with", "Example: Red, NaN, NaN, Blue"],
          ["**Mode fill**", "The most common category", "The most frequent colour in the whole column"],
          ["**Forward fill** ('pad', ffill)", "The **previous** row's value", "Red, Red, Red, Blue"],
          ["**Backfill** (bfill)", "The **next** row's value", "Red, Blue, Blue, Blue"],
          ["**Constant / random fill**", "A fixed label such as 'Unknown', or a random existing category", "Red, Unknown, Unknown, Blue"],
          ["**Missing indicator**", "A 0/1 column flagging the gaps", "A new column: 0, 1, 1, 0"]),
    ul("Forward fill and backfill only make sense when the **row order is meaningful** (for example days in a row). In shuffled data the neighbour is an arbitrary guess.",
       "A forward fill cannot fill a gap in the **first** row, and a backfill cannot fill one in the **last** row."),
    note("Remember:", "'pad' means forward fill."))

section("5. Binning Numerical Data",
    p("**Binning** replaces a continuous value with the range (bin) it falls in. Turning continuous values into a few categories is called **discretization**, so binning is an example of it."),
    table(["", "Equal-width", "Equal-frequency"],
          ["Bins are chosen so that", "Each covers the **same range**", "Each holds about the **same number of rows**"],
          ["Width of a bin", "(max - min) / number of bins", "Varies"],
          ["With an outlier", "Most rows crowd into a few bins", "Stays balanced"],
          ["pandas", "`pd.cut`", "`pd.qcut`"]),
    p("Example: a feature runs from 10 to 70 in 3 equal-width bins. Width = 60 / 3 = 20, so the bins are 10-30, 30-50 and 50-70, and 45 lands in 30-50."),
    p("**Binarization** is binning with one chosen threshold: 5,000 views or more is 'popular', under that is 'unpopular'. You pick the threshold; it gives two groups."),
    note("Remember:", "Binning trades **detail for simplicity**: values inside a bin become identical."))

section("6. Encoding Categorical Data",
    p("Models do arithmetic, so **all data must ultimately be numeric**. Categories must be encoded."),
    table(["Encoding", "How", "Use for"],
          ["**Binary**", "Two values become 0 and 1", "A two-value feature (yes / no)"],
          ["**One-hot**", "One 0/1 column per category", "**3+ nominal** categories; `pd.get_dummies`"],
          ["**Target**", "Replace each category with a statistic (usually the mean) of the **target** for that category", "Features with very many categories"]),
    ul("Numbering nominal categories (red = 1, green = 2, blue = 3) invents an **order and distances** that do not exist. One-hot avoids this.",
       "A feature with 12 categories gives 12 one-hot columns, so a column with hundreds of categories makes the table very wide.",
       "Target encoding example: category A has training targets 1, 0, 1, 1, so A becomes 3 / 4 = **0.75**."),
    note("Watch out:", "Target encoding uses the answer column, so it can **leak** the target. Learn it from the **training data only**."))

section("7. Scaling",
    p("Features on very different scales let the big numbers dominate distance-based models such as kNN. Scaling puts them on comparable ranges."),
    table(["", "Min-max (normalization)", "Standardization"],
          ["Formula", "(x - min) / (max - min)", "(x - mean) / standard deviation"],
          ["Result", "Values from **0 to 1**", "**Mean 0, standard deviation 1**"],
          ["Range", "Fixed", "Not fixed; can be negative"],
          ["With an outlier", "The outlier sets the scale, so the other values are **squeezed** into a narrow band", "No fixed range, so the rest is not squeezed, but the mean and spread still shift"]),
    ul("20, 30, 50, 60: min-max for 30 is (30 - 20) / 40 = **0.25**.",
       "Mean 50, standard deviation 10: the value 70 standardizes to (70 - 50) / 10 = **2**.",
       "Neither method fixes **skew**: both are straight-line changes, so the shape stays. A log transform reduces skew.",
       "Fit the scaler on the **training set only**, then apply the same numbers to the test set."),
    table(["Use", "When"],
          ["**Min-max**", "Distribution unknown or not bell-shaped; kNN and neural networks"],
          ["**Standardization**", "The algorithm assumes normally distributed data"]),
    note("Remember:", "Distance-based models (kNN) need scaling. Decision trees compare one feature at a time and mostly do not."))

section("8. Validation, Overfitting and Underfitting",
    p("A model must be judged on data it has not seen. Hold some data back."),
    ul("**Train-test split:** generally **80% train / 20% test**. With 250 rows that is 200 and 50.",
       "**Train vs test accuracy** show generalization: how well the result carries over to unseen data."),
    table(["Training accuracy", "Test accuracy", "Diagnosis"],
          ["High (98%)", "Much lower (70%)", "**Overfitting**: memorized the training set"],
          ["Low (61%)", "Low (59%)", "**Underfitting**: too simple"],
          ["High (91%)", "About the same (89%)", "Good generalization"]),
    h("Confusion matrix"),
    table(["", "Predicted positive", "Predicted negative"],
          ["**Actual positive**", "True positive (30)", "False negative (20)"],
          ["**Actual negative**", "False positive (10)", "True negative (40)"]),
    p("Accuracy = correct / total = (30 + 40) / 100 = **70%**. A **false negative** is a positive the model missed."),
    h("k-fold cross-validation"),
    p("Split the data into **k folds**. Each fold is the test set once while the other k - 1 train, and the k scores are **averaged**. With 200 rows and k = 5, each round tests on 40 rows and trains on 160. The score depends less on one lucky or unlucky split."),
    note("Watch out:", "Do not tune against the test set. Its score then becomes optimistic."))

section("9. Curse of Dimensionality",
    p("**Dimensions** are features. As the number of features grows, problems grow with it."),
    ul("**Sparse data:** the same rows spread through a vastly bigger space.",
       "**Distances become similar:** every point is about as far from every other, so kNN's 'nearest neighbours' lose meaning.",
       "**More data needed:** the amount grows very fast (roughly exponentially) to cover the space.",
       "**Overfitting:** more features give the model more ways to fit noise. 100 rows and 500 features is a danger sign.",
       "**Cost and complexity:** more training time, memory and a harder model to interpret."),
    note("Remember:", "More features do not always help. The remedy is feature selection or dimensionality reduction. Note that one-hot encoding a column with many categories adds dimensions."))

section("10. Feature Selection",
    p("**Feature selection** keeps a useful subset of the **original** columns. Three approaches:"),
    table(["Approach", "How it decides", "Example", "Cost"],
          ["**Filter**", "Simple criteria, **before** any model", "Correlation with the target; SelectKBest", "Cheapest"],
          ["**Wrapper**", "Trains a model on subsets, **iteratively**, using an evaluation metric", "Recursive feature elimination (RFE)", "Most expensive"],
          ["**Embedded**", "Uses the **results of a model** fitted once", "Lasso coefficients shrunk to zero; tree importances", "In between"]),
    ul("**Filter** uses no ML algorithm, is cheap and is good for a quick screen. Low-variance features (values barely differ) tend to contribute little.",
       "**Wrapper** methods: **forward selection** (add one feature at a time), **backward elimination** (remove one at a time) and **exhaustive search** (try every combination). Very effective but very slow.",
       "**Embedded** fits the model **once** and reads its feature importances: faster than a wrapper, more effective than a filter."),
    h("Correlation"),
    ul("**Feature versus target:** a coefficient near 0 means little straight-line link, so the feature is a candidate to drop. The **size** matters, not the sign: -0.85 is as strong as +0.85.",
       "**Feature versus feature (cross-correlation):** two features with 0.97 are nearly redundant, so keep one."),
    h("SelectKBest"),
    p("`SelectKBest(k=5)` scores each feature **on its own** against the target (a **univariate** test) and keeps the five highest. It can miss features that only help in combination."),
    note("Remember:", "Selection keeps original columns unchanged. PCA, next, builds new ones."))

section("11. Principal Component Analysis",
    p("**PCA** turns the original features into a smaller set of new, **uncorrelated** features called **principal components**, keeping as much variance as possible. It is **dimensionality reduction**."),
    ul("**Component 1** points along the direction of greatest variance. Each later component captures the most of what remains, at right angles to the earlier ones.",
       "PCA is **unsupervised**: it ignores the target.",
       "**Standardize first**, or the largest-scale feature will dominate the variance.",
       "Choose how many components to keep from the **explained variance ratio**: with 60%, 25%, 10% and 5%, you need **3** components to reach at least 90% (60 + 25 + 10 = 95%).",
       "10 features reduced to 3 components give a table with **3** columns."),
    table(["", "Feature selection", "PCA"],
          ["Result", "A **subset** of the original features", "**New** features built from combinations"],
          ["Interpretable?", "Yes: the columns keep their meaning", "Less so: each component blends many features"]),
    note("Remember:", "Benefit: fewer dimensions, faster, less overfitting. Cost: lost interpretability and the variance in the dropped components."))

guide = {
    "title": "ITD 140 Quiz 2 Study Guide",
    "description": "Features and feature types, missing data and imputation, binning, encoding, scaling, validation, the curse of dimensionality, feature selection and PCA, in the same order as the quiz, flashcards and walkthroughs.",
    "quizFile": "data/itd140-quiz2.json",
    "flashcardsFile": "data/itd140-quiz2-flashcards.json",
    "sections": SECTIONS,
}

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/itd140-quiz2-guide.json" % len(SECTIONS))
