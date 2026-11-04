#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 1 study guide -> data/itd140-quiz1-guide.json.

    python3 tools/build_itd140_guide.py

One of a set of three built together: this guide, the flashcards (build_itd140_flashcards.py) and
the quiz (build_itd140_quiz1.py). All three follow the same seven topics in the same order and link
to each other. When a topic changes in one, change it in all three.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-quiz1-guide.json")
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


section("1. AI and Machine Learning",
    h("Two different words"),
    table(["Term", "Meaning"],
          ["**Artificial intelligence (AI)**", "The overall field or science of making machines perform tasks that need intelligence"],
          ["**Machine learning (ML)**", "One specific approach to AI: the system **learns rules from data** instead of being given them"]),
    p("Machine learning is a **subset** of AI. A program of hand-written if/else rules can be AI, but it is not ML, because nothing is learned."),
    sub("Vocabulary"),
    table(["Word", "Meaning"],
          ["Training data", "The examples the algorithm learns from"],
          ["Model", "What the training algorithm produces; used to make predictions"],
          ["Feature", "An **input** variable describing each example"],
          ["Target variable (label)", "The value the model is trained to **predict**"]),
    note("Remember:", "AI is the whole field; ML is one approach inside it. Not every AI system uses ML."))

section("2. Types of Machine Learning",
    table(["Type", "What drives the learning", "Example"],
          ["**Supervised**", "**Labels** (the 'answers') are given with the data", "Emails already marked spam or not spam"],
          ["**Unsupervised**", "**No labels**; the algorithm finds structure itself", "Grouping shoppers by buying habits"],
          ["**Reinforcement**", "**Feedback from the environment** (rewards and penalties)", "A program learning a game by its score"]),
    note("Remember:", "Ask what the data comes with. Labels means supervised, nothing means unsupervised, and a reward from the environment means reinforcement."))

section("3. Classification and Regression",
    p("Both are **supervised** learning. What separates them is the target variable."),
    table(["", "Classification", "Regression"],
          ["Target", "A **discrete**, fixed set of categories", "A **continuous** value with infinite possibilities"],
          ["Example", "Dog or not dog; spam or not spam", "House price; temperature; rainfall"],
          ["Algorithms", "kNN, decision tree, random forest, neural net, logistic regression", "Linear regression"]),
    note("Watch out:", "**Logistic regression** has 'regression' in its name but is almost always used for **binary classification**. Linear regression is the one that predicts continuous numbers."),
    p("**kNN** classifies a new example by the labels of its k closest training examples."))

section("4. Clustering and k-means",
    p("**Clustering** groups unlabelled examples so that similar ones end up together. It is **unsupervised** learning."),
    h("k-means"),
    ul("The hyperparameter **k** is the **number of clusters** you want the algorithm to find.",
       "It starts with **random positions** for each **centroid** (the centre of a cluster).",
       "It then repeats: assign each point to its nearest centroid, and move each centroid to the centre of its points, until they settle on the actual cluster centres."),
    note("Remember:", "Because the starting centroids are random, two runs can give different clusters. And k in k-means (clusters) is not the same as k in kNN (neighbours)."))

section("5. Parameters and Hyperparameters",
    table(["", "Parameters", "Hyperparameters"],
          ["What", "Variables **inside the model**", "**Configuration** of the training algorithm"],
          ["Set by", "The training algorithm, while it learns", "**Us**, before training"],
          ["Examples", "Centroid positions; the slope a regression learns", "k in k-means; neighbours in kNN"]),
    note("Remember:", "Parameters are trained. Hyperparameters are chosen."))

section("6. Accuracy and the Confusion Matrix",
    code("accuracy = number correct / total number of samples"),
    p("45 correct out of 60 samples gives 45 / 60 = **75%**. If you are told the number **wrong**, subtract first: 18 wrong out of 200 means 182 correct, so 91%."),
    h("Confusion matrix"),
    p("A grid comparing **actual** classes with **predicted** classes. Correct predictions sit on the **diagonal**; every other cell is a mistake, and shows which classes get confused with which."),
    table(["", "Predicted cat", "Predicted dog"],
          ["**Actual cat**", "40", "10"],
          ["**Actual dog**", "5", "45"]),
    p("Accuracy here is (40 + 45) / 100 = **85%**. The 10 is cats the model called dogs."))

section("7. Generalization, Bias and Variance",
    p("**Generalization** is how well a model works on **unseen** examples, those not in its training set. Training accuracy comes from the training data; **test accuracy** comes from data held back."),
    table(["", "Overfit", "Underfit"],
          ["What happens", "**Memorizes** the training set", "Too simple to capture the complexity of the data"],
          ["Bias / variance", "**High variance**, low bias", "**High bias**, low variance"],
          ["Training accuracy", "High", "Low"],
          ["Test accuracy", "Low", "Low (or high)"]),
    ul("High training accuracy, low test accuracy: **overfit**, variance too high.",
       "Low training accuracy: **underfit**, bias too high."),
    note("Watch out:", "High training accuracy proves nothing about new data. Always check the test accuracy."))

guide = {
    "title": "ITD 140 Quiz 1 Study Guide",
    "description": "AI and machine learning, the three types of learning, classification and regression, k-means, parameters and hyperparameters, accuracy and the confusion matrix, and generalization, in the same order as the quiz and flashcards.",
    "quizFile": "data/itd140-quiz1.json",
    "flashcardsFile": "data/itd140-quiz1-flashcards.json",
    "sections": SECTIONS,
}

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/itd140-quiz1-guide.json" % len(SECTIONS))
