/* Number drills: endless fresh problems with worked answers and a streak to mastery.
 * Problem generators live in drillgen.js. Progress is kept in this browser (localStorage). */
const GOAL = 5;                       // correct in a row to mark a drill mastered
const STORE = 'quizhub-drills-itd140';
const appEl = document.getElementById('app');
const { DRILLS, check } = DrillGen;
const byId = Object.fromEntries(DRILLS.map(d => [d.id, d]));

let progress = {};
try { progress = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { progress = {}; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) { /* private mode: progress lasts this visit only */ } };
const prog = id => (progress[id] = progress[id] || { streak: 0, best: 0, mastered: false, tried: 0, right: 0 });

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');

function menu() {
  const done = DRILLS.filter(d => prog(d.id).mastered).length;
  appEl.innerHTML = `
    <div class="page-head"><h1>Number drills</h1></div>
    <p class="dr-lead">Short calculation problems with new numbers every time. Get <strong>${GOAL} right in a row</strong> to master a drill; a miss resets the streak and shows the worked steps. Mastered: <strong>${done} of ${DRILLS.length}</strong>.</p>
    <div class="dr-actions">
      <button class="btn primary" id="dr-mixed">Mixed practice (all drills)</button>
      <button class="btn ghost" id="dr-reset">Reset my progress</button>
    </div>
    <div class="dr-grid">${DRILLS.map(d => {
      const p = prog(d.id);
      return `<button class="dr-tile" data-id="${d.id}">
        <span class="dr-title">${esc(d.title)}</span>
        <span class="dr-blurb">${esc(d.blurb)}</span>
        <span class="dr-status ${p.mastered ? 'dr-done' : ''}">${p.mastered ? 'Mastered ✓' : `Streak ${p.streak} / ${GOAL}`}${p.tried ? ` &middot; ${p.right}/${p.tried} right` : ''}</span>
      </button>`;
    }).join('')}</div>`;
  document.getElementById('dr-mixed').addEventListener('click', () => run(null));
  document.getElementById('dr-reset').addEventListener('click', () => { if (confirm('Reset all drill progress in this browser?')) { progress = {}; save(); menu(); } });
  appEl.querySelectorAll('.dr-tile').forEach(b => b.addEventListener('click', () => run(b.dataset.id)));
}

let mixedRun = 0;
function run(id) {
  mixedRun = 0;
  next(id);
}

function next(id) {
  const drill = id ? byId[id] : DRILLS[Math.floor(Math.random() * DRILLS.length)];
  const problem = drill.gen();
  const p = prog(drill.id);
  const dots = Array.from({ length: GOAL }, (_, i) => `<i class="${i < (id ? p.streak : Math.min(mixedRun, GOAL)) ? 'on' : ''}"></i>`).join('');
  const input = problem.choices
    ? `<div class="dr-choices">${problem.choices.map(c => `<button class="btn ghost dr-choice" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>`
    : `<div class="dr-answer"><input id="dr-input" class="fb-input dr-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Your answer">${problem.unit ? `<span class="dr-unit">${esc(problem.unit)}</span>` : ''}<button class="btn primary" id="dr-check">Check</button></div>`;

  appEl.innerHTML = `
    <div class="page-head"><h1>${id ? esc(drill.title) : 'Mixed practice'}</h1><button class="btn ghost" id="dr-back">All drills</button></div>
    <div class="dr-streak" aria-label="Streak"><span>${id ? 'Streak' : 'Correct in a row'}</span><div class="dr-dots">${dots}</div></div>
    <div class="q-card">
      ${id ? '' : `<span class="cat-badge">${esc(drill.title)}</span>`}
      <p class="q-prompt">${nl(problem.q)}</p>
      ${input}
      <div id="dr-feedback"></div>
    </div>`;
  document.getElementById('dr-back').addEventListener('click', menu);

  let answered = false;
  const grade = text => {
    if (answered) return;
    answered = true;
    const good = check(problem, text);
    p.tried++; if (good) { p.right++; p.streak++; p.best = Math.max(p.best, p.streak); } else { p.streak = 0; }
    mixedRun = good ? mixedRun + 1 : 0;
    const justMastered = good && p.streak >= GOAL && !p.mastered;
    if (justMastered) p.mastered = true;
    save();
    const shown = problem.choices ? problem.answer : `${problem.answer}${problem.unit || ''}`;
    document.getElementById('dr-feedback').innerHTML = `
      <div class="feedback ${good ? 'good' : 'bad'}"><strong>${good ? 'Correct.' : `Not quite. The answer is ${esc(shown)}.`}</strong>
        ${problem.steps.map(s => `<div class="dr-step">${esc(s)}</div>`).join('')}
        ${justMastered ? `<div class="dr-step"><strong>${GOAL} in a row: drill mastered!</strong> You can keep going or pick another drill.</div>` : ''}
      </div>
      <div class="q-actions q-next"><button class="btn primary" id="dr-next">Next problem</button></div>`;
    const nb = document.getElementById('dr-next');
    nb.focus();
    nb.addEventListener('click', () => next(id));
    appEl.querySelectorAll('.dr-choice').forEach(b => { b.disabled = true; if (b.dataset.v === problem.answer) b.classList.add('dr-right'); });
    const inp = document.getElementById('dr-input'); if (inp) inp.disabled = true;
    const chk = document.getElementById('dr-check'); if (chk) chk.disabled = true;
  };
  appEl.querySelectorAll('.dr-choice').forEach(b => b.addEventListener('click', () => grade(b.dataset.v)));
  const inp = document.getElementById('dr-input');
  if (inp) {
    inp.focus();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') grade(inp.value); });
    document.getElementById('dr-check').addEventListener('click', () => grade(inp.value));
  }
}

document.getElementById('loading').hidden = true;
menu();
