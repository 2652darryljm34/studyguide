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

    // Finished classes ("archived": true in classes.json) move to a collapsed section
    // at the bottom; everything else, including the "Updated" banner, is the live classes.
    const live = classes.filter(c => !c.archived);
    const archived = classes.filter(c => c.archived);
    renderFeatured(live);
    listEl.innerHTML = live.map((cls, i) => renderClass(cls, i)).join('');
    renderArchive(archived);
  }catch(err){
    listEl.innerHTML = `<div class="load-error">Couldn't load classes.json. ${escapeHtml(err.message)}</div>`;
  }
}

// A quiz or tool marked "featured": true in classes.json is pulled out to the banner
// at the top of the page and listed first, highlighted, inside its own class.
// "badge" overrides the default label and "cta" the link text on the banner card.
const isFeatured = q => !!q.featured;
const badgeFor = q => (typeof q.badge === 'string' && q.badge) || 'Updated';

// Everything a class has flagged as featured, in study order: guides, then tools
// (flashcards and so on), then quizzes.
function featuredItems(cls){
  const guides = (cls.guides || []).filter(isFeatured).map(g => ({
    q: g, href: 'review.html?file=' + encodeURIComponent(g.file), cta: g.cta || 'Read the guide', go: 'Read'
  }));
  const tools = (cls.tools || []).filter(isFeatured).map(t => ({
    q: t, href: t.href, cta: t.cta || 'Open', go: 'Open'
  }));
  const quizzes = (cls.quizzes || []).filter(isFeatured).map(q => ({
    q, href: 'quiz.html?file=' + encodeURIComponent(q.file), cta: q.cta || 'Start the review', go: 'Start'
  }));
  return guides.concat(tools, quizzes);
}

function renderFeatured(classes){
  const section = document.getElementById('featured');
  const list = document.getElementById('featured-list');
  if(!section || !list) return;
  const cards = [];
  classes.forEach(cls => {
    featuredItems(cls).forEach(({ q, href, cta }) => {
      cards.push(`
        <a class="featured-card" href="${escapeHtml(href)}">
          <div class="featured-card-top">
            <span class="featured-class">${escapeHtml(cls.name)}${cls.fullName ? ` <span>${escapeHtml(cls.fullName)}</span>` : ''}</span>
            <span class="new-pill">${escapeHtml(badgeFor(q))}</span>
          </div>
          <div class="featured-card-title">${escapeHtml(q.title)}</div>
          ${q.description ? `<div class="featured-card-desc">${escapeHtml(q.description)}</div>` : ''}
          <div class="featured-card-go">${escapeHtml(cta)} &rarr;</div>
        </a>`);
    });
  });
  if(!cards.length) return;
  list.innerHTML = cards.join('');
  section.hidden = false;
}

function renderArchive(archived){
  const box = document.getElementById('archive');
  const list = document.getElementById('archive-list');
  if(!box || !list || !archived.length) return;
  list.innerHTML = archived.map((cls, i) => renderClass(cls, i)).join('');
  const sub = document.getElementById('archive-sub');
  if(sub) sub.textContent = archived.length === 1 ? '1 finished class' : archived.length + ' finished classes';
  box.hidden = false;
}

function renderClass(cls, index){
  const guides = cls.guides || [];
  const allQuizzes = cls.quizzes || [];
  const featured = featuredItems(cls);
  const quizzes = allQuizzes.filter(q => !isFeatured(q));
  const count = allQuizzes.length;
  const countLabel = count === 1 ? '1 quiz' : `${count} quizzes`;

  const guideRows = guides.filter(g => !isFeatured(g)).map(g => `
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
  const toolRows = (cls.tools || []).filter(t => !isFeatured(t)).map(t => `
    <a class="quiz-row tool-row" href="${escapeHtml(t.href)}">
      <div>
        <div class="quiz-row-title"><span class="guide-badge tool-badge">Interactive</span>${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="quiz-row-desc">${escapeHtml(t.description)}</div>` : ''}
      </div>
      <div class="quiz-row-go">Open &rarr;</div>
    </a>
  `).join('');

  const featuredRows = featured.map(({ q, href, go }) => `
    <a class="quiz-row featured-row" href="${escapeHtml(href)}">
      <div>
        <div class="quiz-row-title"><span class="new-pill">${escapeHtml(badgeFor(q))}</span>${escapeHtml(q.title)}</div>
        ${q.description ? `<div class="quiz-row-desc">${escapeHtml(q.description)}</div>` : ''}
      </div>
      <div class="quiz-row-go">${go} &rarr;</div>
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
          <span class="class-code">${escapeHtml(cls.name)}${featured.length ? ` <span class="new-pill">${escapeHtml(badgeFor(featured[0].q))}</span>` : ''}</span>
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
