/* Problem generators for the number drills (drills.html). Every call makes a fresh problem.
 *
 * A problem is { q, answer, steps[], unit?, choices? }:
 *   - numeric: answer is a number, checked within `tol`; `unit` ('%' or '') is shown beside the box.
 *   - choice: `choices` is a list of strings and `answer` is one of them.
 * Tested by tools/test_drills.js. Kept free of page code so Node can load it. */
const DrillGen = (() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const r2 = x => Math.round(x * 100) / 100;
  const PAIRS = [['cat', 'dog'], ['spam', 'ham'], ['fraud', 'genuine'], ['sick', 'healthy'], ['churn', 'stay']];

  const DRILLS = [
    { id: 'accuracy', title: 'Accuracy from counts', blurb: 'accuracy = correct / total',
      gen() {
        const n = pick([40, 50, 80, 100, 120, 200, 250, 400, 500]);
        const pct = rnd(11, 19) * 5;               // 55%..95% in steps of 5
        const right = n * pct / 100;
        return { q: `A model predicts ${right} of ${n} test examples correctly. What is its accuracy?`, answer: pct, unit: '%', tol: 0.05,
          steps: [`accuracy = correct / total = ${right} / ${n}`, `= ${r2(right / n)}, which is ${pct}%`] };
      } },
    { id: 'matrix', title: 'Accuracy from a confusion matrix', blurb: 'correct = TP + TN; total = all four cells',
      gen() {
        const [pos, neg] = pick(PAIRS);
        const total = pick([100, 200]);
        const tp = rnd(Math.round(total * .25), Math.round(total * .45));
        const tn = rnd(Math.round(total * .25), Math.round(total * .45));
        const fn = rnd(2, Math.round((total - tp - tn) * .6)); const fp = total - tp - tn - fn;
        const acc = (tp + tn) / total * 100;
        return { q: `Confusion matrix (rows actual, columns predicted):\n${pos} called ${pos}: ${tp}   ${pos} called ${neg}: ${fn}\n${neg} called ${pos}: ${fp}   ${neg} called ${neg}: ${tn}\nWhat is the accuracy?`,
          answer: acc, unit: '%', tol: 0.06,
          steps: [`correct = ${tp} + ${tn} = ${tp + tn}`, `total = ${tp} + ${fn} + ${fp} + ${tn} = ${total}`, `accuracy = ${tp + tn} / ${total} = ${acc}%`] };
      } },
    { id: 'confterm', title: 'TP, FP, FN, TN', blurb: 'positive/negative = what the model said; true/false = was it right',
      gen() {
        const [pos, neg] = pick(PAIRS);
        const actual = pick([pos, neg]), predicted = pick([pos, neg]);
        const term = (actual === predicted ? 'True ' : 'False ') + (predicted === pos ? 'positive' : 'negative');
        return { q: `Take "${pos}" as the positive class. An example that is actually ${actual} is predicted as ${predicted}. What is this outcome?`,
          choices: ['True positive', 'False positive', 'False negative', 'True negative'], answer: term[0] + term.slice(1).toLowerCase(), tol: 0,
          steps: [`The model said ${predicted}: that is the ${predicted === pos ? 'positive' : 'negative'} side.`, `The truth was ${actual}, so the prediction was ${actual === predicted ? 'right (true)' : 'wrong (false)'}.`, `So it is a ${term.toLowerCase()}.`] };
      } },
    { id: 'diagnose', title: 'Overfit, underfit or good fit', blurb: 'compare training and test accuracy',
      gen() {
        const kind = pick(['over', 'under', 'good']);
        let tr, te;
        if (kind === 'over') { tr = rnd(90, 100); te = rnd(55, tr - 18); }
        else if (kind === 'under') { tr = rnd(48, 68); te = rnd(Math.max(40, tr - 6), tr + 3); }
        else { tr = rnd(86, 96); te = tr - rnd(0, 4); }
        const ans = { over: 'Overfitting', under: 'Underfitting', good: 'Good fit' }[kind];
        const why = { over: 'High training accuracy but much lower test accuracy: it memorized the training set (high variance).',
          under: 'Low accuracy on both sets: the model is too simple (high bias).', good: 'High on both and close together: it generalizes.' }[kind];
        return { q: `A model scores ${tr}% on its training data and ${te}% on its test data. What is the diagnosis?`, choices: ['Overfitting', 'Underfitting', 'Good fit'], answer: ans, tol: 0,
          steps: [`Training ${tr}%, test ${te}%.`, why] };
      } },
    { id: 'minmax', title: 'Min-max scaling (normalization)', blurb: '(x - min) / (max - min)',
      gen() {
        const mn = rnd(0, 10) * 5, range = pick([20, 40, 50, 80, 100]), mx = mn + range, k = rnd(0, 5), x = mn + range * k / 5;
        return { q: `A column runs from ${mn} to ${mx}. What does min-max scaling turn the value ${x} into? (a number from 0 to 1)`, answer: k / 5, unit: '', tol: 0.005,
          steps: [`(x - min) / (max - min) = (${x} - ${mn}) / (${mx} - ${mn})`, `= ${x - mn} / ${range} = ${k / 5}`] };
      } },
    { id: 'zscore', title: 'Standardization (z-score)', blurb: '(x - mean) / standard deviation',
      gen() {
        const mean = rnd(8, 20) * 5, sd = pick([2, 4, 5, 10]), z = pick([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 3]), x = mean + sd * z;
        return { q: `A column has mean ${mean} and standard deviation ${sd}. What is the standardized value of ${x}?`, answer: z, unit: '', tol: 0.005,
          steps: [`(x - mean) / sd = (${x} - ${mean}) / ${sd}`, `= ${x - mean} / ${sd} = ${z}`] };
      } },
    { id: 'distance', title: 'Manhattan and Euclidean distance', blurb: 'Manhattan: add the steps. Euclidean: straight line (Pythagoras)',
      gen() {
        const [dx, dy] = pick([[3, 4], [5, 12], [6, 8], [8, 15], [9, 12], [7, 24]]);
        const a = [rnd(0, 10), rnd(0, 10)], b = [a[0] + dx, a[1] + dy];
        const euclid = pick([true, false]);
        return { q: `Point A is (${a[0]}, ${a[1]}) and point B is (${b[0]}, ${b[1]}). What is the ${euclid ? 'Euclidean' : 'Manhattan'} distance between them?`,
          answer: euclid ? Math.hypot(dx, dy) : dx + dy, unit: '', tol: 0.005,
          steps: [`Differences: ${b[0]} - ${a[0]} = ${dx} and ${b[1]} - ${a[1]} = ${dy}`,
            euclid ? `Euclidean = square root of (${dx}² + ${dy}²) = square root of ${dx * dx + dy * dy} = ${Math.hypot(dx, dy)}` : `Manhattan = ${dx} + ${dy} = ${dx + dy}`] };
      } },
    { id: 'split', title: 'Train/test split sizes', blurb: 'test rows = rows x test share; training = the rest',
      gen() {
        let n, share;
        do { n = pick([150, 200, 250, 400, 500, 800, 1000, 1200]); share = pick([20, 25, 30]); } while ((n * share) % 100 !== 0);
        const test = n * share / 100, train = n - test, ask = pick(['training', 'test']);
        return { q: `A dataset has ${n} labelled rows and ${share}% are held back for testing. How many rows are used for ${ask}?`, answer: ask === 'test' ? test : train, unit: '', tol: 0.005,
          steps: [`test rows = ${n} x ${share}% = ${test}`, `training rows = ${n} - ${test} = ${train}`] };
      } },
    { id: 'kfold', title: 'k-fold cross-validation', blurb: 'each fold = rows / k; train on the other k - 1 folds',
      gen() {
        const k = pick([4, 5, 10]), fold = pick([20, 25, 40, 50, 60, 100]), n = k * fold, ask = pick(['training', 'test']);
        return { q: `${k}-fold cross-validation is run on ${n} rows. In each round, how many rows are in the ${ask} part?`, answer: ask === 'test' ? fold : n - fold, unit: '', tol: 0.005,
          steps: [`Each fold holds ${n} / ${k} = ${fold} rows.`, `One fold is the test set: ${fold} rows. The other ${k - 1} folds train: ${n - fold} rows.`] };
      } },
    { id: 'knn', title: 'kNN majority vote', blurb: 'take the k nearest points and pick the most common class',
      gen() {
        const [c1, c2] = pick(PAIRS), k = pick([3, 5, 7]);
        let list;
        do { list = Array.from({ length: 7 }, () => pick([c1, c2])); } while (list.slice(0, k).filter(c => c === c1).length * 2 === k);
        let d = 0; const items = list.map(c => ({ c, d: (d += rnd(2, 9) / 10) }));
        const votes = items.slice(0, k).map(i => i.c), a = votes.filter(c => c === c1).length;
        const ans = a * 2 > k ? c1 : c2;
        const lines = items.map(i => `${i.c} (distance ${r2(i.d)})`).join(', ');
        return { q: `The 7 closest training points to a new example, nearest first: ${lines}.\nWith k = ${k}, what class does kNN predict?`, choices: [c1, c2], answer: ans, tol: 0,
          steps: [`Use only the ${k} nearest: ${votes.join(', ')}.`, `${c1}: ${a}, ${c2}: ${k - a}. The majority is ${ans}.`] };
      } },
    { id: 'binarize', title: 'Binarization with a threshold', blurb: 'at or above the threshold = 1; below = 0',
      gen() {
        const t = pick([1000, 2000, 5000, 10000]);
        const v = pick([t, t - 1, t + 1, rnd(1, t - 1), rnd(t + 1, t * 3)]);
        const hit = v >= t;
        return { q: `Videos with ${t.toLocaleString('en-US')} views or more are labelled "popular", the rest "unpopular". How is a video with ${v.toLocaleString('en-US')} views labelled?`,
          choices: ['popular', 'unpopular'], answer: hit ? 'popular' : 'unpopular', tol: 0,
          steps: [`Is ${v.toLocaleString('en-US')} >= ${t.toLocaleString('en-US')}? ${hit ? 'Yes' : 'No'}.`, `So it is ${hit ? 'popular' : 'unpopular'}.`] };
      } },
  ];

  /* Does the typed text match the problem's answer? Accepts "86", "86%", " 0.25 ", and "1/4"-free decimals. */
  function check(problem, text) {
    const t = String(text).trim().toLowerCase();
    if (problem.choices) return t === String(problem.answer).toLowerCase();
    const n = Number(t.replace(/%$/, '').replace(/,/g, '').trim());
    return t !== '' && Number.isFinite(n) && Math.abs(n - problem.answer) <= (problem.tol || 0);
  }

  return { DRILLS, check, rnd, pick };
})();
if (typeof module !== 'undefined') module.exports = DrillGen;
