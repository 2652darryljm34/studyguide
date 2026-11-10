#!/usr/bin/env python3
"""
Builds the ITD 140 Quiz 1 flashcards -> data/itd140-quiz1-flashcards.json.

    python3 tools/build_itd140_flashcards.py

One card per term, grouped into the same eight topics as the quiz and guide. Terms must be unique
(the deck remembers "known" cards by term), and the build refuses incomplete cards.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd140-quiz1-flashcards.json")
CARDS = []


def c(topic, term, definition, use, example):
    CARDS.append({"topic": topic, "term": term, "definition": definition, "useCase": use, "example": example})


T = "AI and Machine Learning"
c(T, "Artificial intelligence (AI)", "The overall field of making machines perform tasks that need intelligence.",
  "Use it for the whole field; machine learning is one approach within it.",
  "A hand-written rule engine and a learned model are both AI")
c(T, "Machine learning (ML)", "An approach to AI in which a system learns rules from data instead of being given them.",
  "Use it when the rules are too many or too hard to write by hand.",
  "Learning to spot spam from labelled emails")
c(T, "Training data", "The collection of examples an algorithm learns from.",
  "Fit the model to it; keep a separate test set aside.",
  "10,000 emails marked spam or not spam")
c(T, "Model", "What a training algorithm produces: the learned relationship used to make predictions.",
  "Apply it to new inputs to get predictions.",
  "A trained line that maps floor area to price")
c(T, "Feature", "An input variable that describes each example.",
  "Choose features that carry information about the target.",
  "Floor area, bedrooms, age of a house")
c(T, "Target variable (label)", "The value the model is trained to predict. Also called the label or the 'answer'.",
  "It is what supervised learning is given and tries to reproduce.",
  "The sale price of the house")

Y = "Types of Machine Learning"
c(Y, "Supervised learning", "Learning from data whose labels (the answers) are given.",
  "Use it when you have examples with known outcomes.",
  "Emails marked spam or not spam")
c(Y, "Unsupervised learning", "Learning from data with no labels; the algorithm looks for structure by itself.",
  "Use it to find groups or patterns you did not name in advance.",
  "Finding natural groups of shoppers")
c(Y, "Reinforcement learning", "Learning from feedback (rewards and penalties) that an environment gives in response to actions.",
  "Use it for sequential decisions such as games and robots.",
  "A program rewarded with points for scoring")
c(Y, "Label", "The known answer attached to a training example.",
  "Its presence is what makes learning supervised.",
  "A photo tagged 'cat'")

C = "Classification and Regression"
c(C, "Classification", "Supervised learning where the target is a category from a discrete, fixed set.",
  "Use it when the answer is a class such as yes or no.",
  "Dog or not dog; spam or not spam")
c(C, "Regression", "Supervised learning where the target is a continuous value with infinitely many possibilities.",
  "Use it when the answer is a number on a scale.",
  "A house price; tomorrow's temperature")
c(C, "kNN (k-nearest neighbours)", "A classifier that labels a new example by looking at the labels of its k closest training examples.",
  "A simple supervised method for classification.",
  "Classify a fruit by its 5 nearest neighbours")
c(C, "Decision tree / random forest", "Supervised models that classify by following a series of questions; a random forest combines many trees.",
  "Classification when you want an easy-to-read set of rules.",
  "Is the age over 30? -> Is the income over 50k? -> ...")
c(C, "Choosing k in kNN", "k is a hyperparameter: a tiny k follows noise (overfits), a huge k smooths too much (underfits).",
  "Try several values of k and compare test accuracy.",
  "k = 1 matches every training point; k = 7 votes among seven neighbours")
c(C, "Decision node", "A point in a decision tree that tests one feature and sends the example down a branch.",
  "Follow the nodes from the top until a leaf gives the class.",
  "Is the commute under 30 minutes? yes -> next question, no -> leaf")
c(C, "Linear regression", "A regression method that fits a line to predict a continuous value.",
  "Predict numbers such as prices.",
  "price = slope x area + intercept")
c(C, "Logistic regression", "Despite the name, almost always used for binary classification, giving a probability of one class.",
  "Yes or no predictions such as fraud or not.",
  "Probability that a customer will cancel")

K = "Clustering and k-means"
c(K, "Clustering", "Grouping unlabelled examples so that similar ones are together. An unsupervised task.",
  "Find natural groups when none are named.",
  "Customer segments")
c(K, "k-means", "A clustering algorithm that places k centroids at random, then repeatedly assigns points to the nearest centroid and moves each centroid to the centre of its points.",
  "Cluster data into a chosen number of groups.",
  "k = 4 gives four customer segments")
c(K, "k (in k-means)", "The hyperparameter for the number of clusters you want the algorithm to find.",
  "You choose it before training.",
  "k = 3")
c(K, "Centroid", "The centre of a cluster. k-means starts them at random positions and moves them to fit the data.",
  "It represents a cluster; its position is learned.",
  "Centre of the 'big spenders' group")

H = "Parameters and Hyperparameters"
c(H, "Parameter", "A variable inside the model that the training algorithm sets while learning from data.",
  "Learned, not chosen.",
  "Slope and intercept of a fitted line")
c(H, "Hyperparameter", "A configuration of the training algorithm that we set ourselves, before training.",
  "Chosen by us, then tuned.",
  "k in k-means; neighbours in kNN")

M = "Accuracy and the Confusion Matrix"
c(M, "Accuracy", "The number of correct predictions divided by the total number of samples.",
  "A one-number summary of how often the model is right.",
  "45 correct of 60 -> 45 / 60 = 75%")
c(M, "Confusion matrix", "A grid comparing actual classes with predicted classes. Correct predictions lie on the diagonal.",
  "See which classes get mistaken for which.",
  "40 cats right, 10 cats called dogs, 5 dogs called cats, 45 dogs right")

G = "Generalization, Bias and Variance"
c(G, "Generalization", "How well a model performs on unseen examples that were not in its training set.",
  "It is what we really care about; measure it on test data.",
  "Test accuracy")
c(G, "Training accuracy", "Accuracy measured on the data the model was trained with.",
  "Compare it with test accuracy.",
  "99% on training data")
c(G, "Test accuracy", "Accuracy measured on data held back from training.",
  "Shows how well the model generalizes.",
  "62% on test data")
c(G, "Overfitting", "The model memorizes the training set. It has high variance and low bias, with high training accuracy and low test accuracy.",
  "Spot it by a large gap between training and test accuracy.",
  "Train 99%, test 62%")
c(G, "Underfitting", "The model is too simple to capture the complexity of the data. It has high bias and low variance, with low training accuracy.",
  "Spot it by poor accuracy on the training data too.",
  "Train 55%, test 54%")
c(G, "Bias", "Error from a model that is too simple. High bias goes with underfitting.",
  "Too much means the model misses the pattern.",
  "A straight line through curved data")
c(G, "Variance", "Error from a model that is too sensitive to the particular training examples. High variance goes with overfitting.",
  "Too much means the model does not carry over to new data.",
  "A model that changes a lot with each training set")

P = "The Machine Learning Process"
c(P, "ML process (the steps)", "Gather data, identify features and target, split into training and test sets, fit the model, test it.",
  "Use it to answer 'what are the steps to train a model'.",
  "Prepare the data -> train -> evaluate")
c(P, "Gather the data", "Collect the examples (rows) the model will learn from.",
  "The first step; everything else depends on it.",
  "A table of 5,000 past house sales")
c(P, "Identify features and target", "Choose the input variables (features) and the single variable to predict (target).",
  "Do it before fitting so the algorithm knows what to use and what to predict.",
  "Features: area, bedrooms. Target: price")
c(P, "Train/test split", "Dividing the data into a training set to learn from and a test set held back to check the result.",
  "Typically 70-80% trains and 20-30% tests; done before training so the test examples stay unseen.",
  "80% to train, 20% to test")
c(P, "Fit (train) the model", "Run the training algorithm on the training set so it learns the model's parameters.",
  "The step where the model learns; hyperparameters are chosen before it.",
  "model.fit(training features, training targets)")
c(P, "Test the model", "Score the fitted model on the test set and compute its accuracy.",
  "Shows how well it generalizes; compare with training accuracy.",
  "Train 96%, test 71% -> overfitting")

if __name__ == "__main__":
    seen = set()
    for card in CARDS:
        assert all(card.values()), card
        assert card["term"] not in seen, card["term"]
        seen.add(card["term"])
    deck = {"title": "ITD 140 Quiz 1 Flashcards",
            "guideFile": "data/itd140-quiz1-guide.json", "quizFile": "data/itd140-quiz1.json", "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d cards in %d topics -> data/itd140-quiz1-flashcards.json" % (len(CARDS), len({x["topic"] for x in CARDS})))
