/* Block rendering is shared with the lab pages -- see assets/blocks.js. */
const { escapeHtml, slugify, renderBlocks, chevronSvg } = GuideBlocks;

const params = new URLSearchParams(window.location.search);
const file = params.get('file');

const appEl = document.getElementById('app');
const loadingEl = document.getElementById('loading');
const subtitleEl = document.getElementById('guide-subtitle');

async function init(){
  if(!file){
    loadingEl.textContent = 'No study guide specified.';
    loadingEl.classList.add('load-error');
    return;
  }
  try{
    const res = await fetch(file);
    if(!res.ok) throw new Error('Study guide file not found: ' + file);
    const data = await res.json();

    const sections = data.sections || [];
    if(sections.length === 0){
      throw new Error('This study guide has no content yet.');
    }

    document.title = data.title || 'Study Guide';
    subtitleEl.textContent = data.title || '';
    loadingEl.hidden = true;
    render(data);
  }catch(err){
    loadingEl.textContent = "Couldn't load this study guide. " + err.message;
    loadingEl.classList.add('load-error');
  }
}

function render(data){
  const total = data.sections.length;

  const sectionsHtml = data.sections.map((section, i) => {
    const headingBlocks = (section.blocks || []).filter(b => b.type === 'heading');
    const jumpNav = headingBlocks.length ? `
      <div class="guide-jumpnav">
        ${headingBlocks.map(b => `<a href="#${slugify(b.text)}">${escapeHtml(b.text)}</a>`).join('')}
      </div>
    ` : '';

    return `
      <details class="guide-section-card" open>
        <summary>
          <div class="guide-section-heading">
            <span class="guide-eyebrow">Section ${i + 1} of ${total}</span>
            <span class="guide-section-name">${escapeHtml(section.name)}</span>
          </div>
          ${chevronSvg}
        </summary>
        <div class="guide-section-body">
          ${jumpNav}
          ${renderBlocks(section.blocks)}
        </div>
      </details>
    `;
  }).join('');

  appEl.innerHTML = `
    <div class="page-head" style="padding-top:20px;">
      <h1>${escapeHtml(data.title || 'Study Guide')}</h1>
      ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ''}
      ${data.quizFile ? `<div class="q-actions" style="justify-content:flex-start; margin-top:14px;"><a class="btn primary" href="quiz.html?file=${encodeURIComponent(data.quizFile)}">Take the quiz &rarr;</a></div>` : ''}
    </div>

    <div class="guide-sections">
      ${sectionsHtml}
    </div>
  `;
}

init();
