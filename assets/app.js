const chevronSvg = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

async function loadClasses(){
  const listEl = document.getElementById('class-list');
  const emptyEl = document.getElementById('empty');
  try{
    const res = await fetch('classes.json');
    if(!res.ok) throw new Error('Could not load classes.json');
    const data = await res.json();
    const classes = data.classes || [];

    if(classes.length === 0){
      emptyEl.hidden = false;
      return;
    }

    renderFeatured(classes);
    listEl.innerHTML = classes.map((cls, i) => renderClass(cls, i)).join('');
  }catch(err){
    listEl.innerHTML = `<div class="load-error">Couldn't load classes.json. ${escapeHtml(err.message)}</div>`;
  }
}

// A quiz marked "featured": true in classes.json is pulled out to the banner at
// the top of the page and listed first, highlighted, inside its own class.
// "badge" overrides the default label.
const isFeatured = q => !!q.featured;
const badgeFor = q => (typeof q.badge === 'string' && q.badge) || 'Updated';

function renderFeatured(classes){
  const section = document.getElementById('featured');
  const list = document.getElementById('featured-list');
  if(!section || !list) return;
  const cards = [];
  classes.forEach(cls => {
    (cls.quizzes || []).filter(isFeatured).forEach(q => {
      cards.push(`
        <a class="featured-card" href="quiz.html?file=${encodeURIComponent(q.file)}">
          <div class="featured-card-top">
            <span class="featured-class">${escapeHtml(cls.name)}${cls.fullName ? ` <span>${escapeHtml(cls.fullName)}</span>` : ''}</span>
            <span class="new-pill">${escapeHtml(badgeFor(q))}</span>
          </div>
          <div class="featured-card-title">${escapeHtml(q.title)}</div>
          ${q.description ? `<div class="featured-card-desc">${escapeHtml(q.description)}</div>` : ''}
          <div class="featured-card-go">Start the review &rarr;</div>
        </a>`);
    });
  });
  if(!cards.length) return;
  list.innerHTML = cards.join('');
  section.hidden = false;
}

function renderClass(cls, index){
  const guides = cls.guides || [];
  const allQuizzes = cls.quizzes || [];
  const featured = allQuizzes.filter(isFeatured);
  const quizzes = allQuizzes.filter(q => !isFeatured(q));
  const count = allQuizzes.length;
  const countLabel = count === 1 ? '1 quiz' : `${count} quizzes`;

  const guideRows = guides.map(g => `
    <a class="quiz-row guide-row" href="review.html?file=${encodeURIComponent(g.file)}">
      <div>
        <div class="quiz-row-title"><span class="guide-badge">Study guide</span>${escapeHtml(g.title)}</div>
        ${g.description ? `<div class="quiz-row-desc">${escapeHtml(g.description)}</div>` : ''}
      </div>
      <div class="quiz-row-go">Read &rarr;</div>
    </a>
  `).join('');

  // Practice you do rather than read: lab sheets of tasks, with no answers.
  // `href` points at a page of its own (the lab index); `file` falls back to
  // the guide renderer, for a class whose exercises are only a document.
  const exerciseRows = (cls.exercises || []).map(e => `
    <a class="quiz-row exercise-row" href="${e.href ? escapeHtml(e.href) : 'review.html?file=' + encodeURIComponent(e.file)}">
      <div>
        <div class="quiz-row-title"><span class="guide-badge exercise-badge">Exercises</span>${escapeHtml(e.title)}</div>
        ${e.description ? `<div class="quiz-row-desc">${escapeHtml(e.description)}</div>` : ''}
      </div>
      <div class="quiz-row-go">Start &rarr;</div>
    </a>
  `).join('');

  // Interactive extras (the SQL playground, say) -- anything with its own page.
  const toolRows = (cls.tools || []).map(t => `
    <a class="quiz-row tool-row" href="${escapeHtml(t.href)}">
      <div>
        <div class="quiz-row-title"><span class="guide-badge tool-badge">Interactive</span>${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="quiz-row-desc">${escapeHtml(t.description)}</div>` : ''}
      </div>
      <div class="quiz-row-go">Open &rarr;</div>
    </a>
  `).join('');

  const featuredRows = featured.map(q => `
    <a class="quiz-row featured-row" href="quiz.html?file=${encodeURIComponent(q.file)}">
      <div>
        <div class="quiz-row-title"><span class="new-pill">${escapeHtml(badgeFor(q))}</span>${escapeHtml(q.title)}</div>
        ${q.description ? `<div class="quiz-row-desc">${escapeHtml(q.description)}</div>` : ''}
      </div>
      <div class="quiz-row-go">Start &rarr;</div>
    </a>
  `).join('');

  const rows = quizzes.map(q => `
    <a class="quiz-row" href="quiz.html?file=${encodeURIComponent(q.file)}">
      <div>
        <div class="quiz-row-title">${escapeHtml(q.title)}</div>
        ${q.description ? `<div class="quiz-row-desc">${escapeHtml(q.description)}</div>` : ''}
      </div>
      <div class="quiz-row-go">Start &rarr;</div>
    </a>
  `).join('');

  return `
    <details class="class-card" >
      <summary>
        <div class="class-heading">
          <span class="class-code">${escapeHtml(cls.name)}${featured.length ? ` <span class="new-pill">${escapeHtml(badgeFor(featured[0]))}</span>` : ''}</span>
          ${cls.fullName ? `<span class="class-full">${escapeHtml(cls.fullName)}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="class-count">${countLabel}</span>
          ${chevronSvg}
        </div>
      </summary>
      <div class="quiz-rows">
        ${featuredRows}
        ${guideRows}
        ${exerciseRows}
        ${toolRows}
        ${rows || '<div class="quiz-row"><span class="quiz-row-desc">No quizzes yet.</span></div>'}
      </div>
    </details>
  `;
}

loadClasses();
