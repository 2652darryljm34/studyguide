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

  const head = `
    <div class="page-head" style="padding-top:20px;">
      <h1>${escapeHtml(data.title || 'Study Guide')}</h1>
      ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ''}
      ${data.quizFile ? `<div class="q-actions" style="justify-content:flex-start; margin-top:14px;"><a class="btn primary" href="quiz.html?file=${encodeURIComponent(data.quizFile)}">Take the quiz &rarr;</a></div>` : ''}
    </div>
  `;

  // A guide with a machine attached reads on the left and lets you try the
  // command on the right, without leaving the page. Guides without `boxFile`
  // -- the SQL one, say -- render exactly as before and never load the shell.
  if(data.boxFile){
    document.getElementById('guide-wrap')?.classList.add('wide');
    appEl.innerHTML = `
      ${head}
      <div class="guide-layout">
        <div class="guide-column">
          <div class="guide-sections">${sectionsHtml}</div>
        </div>
        <aside class="guide-term">${terminalHtml()}</aside>
      </div>
    `;
    startMachine(data.boxFile);
    return;
  }

  appEl.innerHTML = `
    ${head}
    <div class="guide-sections">
      ${sectionsHtml}
    </div>
  `;
}

/* The markup assets/term.js expects to find. Same shape as a lab page. */
function terminalHtml(){
  return `
    <div class="guide-term-inner">
      <div class="guide-term-head">Try it here</div>
      <div class="term-shell" id="term-shell">
        <div class="term-scroll" id="term-scroll"></div>
        <div class="term-inputline" id="term-inputline">
          <span class="term-prompt" id="term-prompt"></span>
          <input type="text" id="term-input" class="term-input" spellcheck="false"
            autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="Command line">
        </div>
      </div>
      <div class="sql-toolbar">
        <button class="btn ghost" id="reset">Reset machine</button>
        <button class="btn ghost" id="clear">Clear screen</button>
        <span class="sql-status" id="status"></span>
      </div>
      <details class="lab-files">
        <summary>The machine</summary>
        <div id="facts"></div>
        <div class="side-tabs" id="side-tabs">
          <button class="side-tab is-on" data-panel="files">Files</button>
          <button class="side-tab" data-panel="accounts">Accounts</button>
          <button class="side-tab" data-panel="software">Software</button>
          <button class="side-tab" data-panel="services">Services</button>
        </div>
        <div class="sql-side-note" id="side-note"></div>
        <div id="side-body" class="schema-body"></div>
      </details>
    </div>
  `;
}

/*
 * The machine is a few hundred kilobytes of JavaScript, so it is fetched only
 * when a guide actually asks for one -- and only after its markup exists,
 * because term.js starts as soon as it loads.
 */
function startMachine(boxFile){
  window.HARBOR_BOX = boxFile;
  const files = [
    'assets/box.js', 'assets/shell.js', 'assets/shtext.js', 'assets/shadmin.js',
    'assets/shpkg.js', 'assets/shsys.js', 'assets/shusage.js', 'assets/shellview.js',
    'assets/nano.js',
    'assets/man.js', 'assets/term.js'
  ];
  const statusEl = document.getElementById('status');
  if(statusEl) statusEl.textContent = 'Starting the machine…';

  files.reduce((chain, src) => chain.then(() => new Promise((ok, fail) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.onload = ok;
    tag.onerror = () => fail(new Error(src));
    document.body.appendChild(tag);
  })), Promise.resolve()).catch(err => {
    const shell = document.getElementById('term-shell');
    if(shell){
      shell.innerHTML = '<pre class="term-out term-err">The practice machine ' +
        "didn't load (" + escapeHtml(err.message) + '). The guide still works.</pre>';
    }
  });
}

init();
