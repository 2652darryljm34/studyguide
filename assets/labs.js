/* ===========================================================================
 * The lab selection screen.
 *
 * Reads the same lab file a study guide would, and turns its sections into a
 * grid of labs. The section without a `lab` number is the introduction, which
 * is shown above the grid rather than as a card.
 * =========================================================================== */
(function () {
  'use strict';

  const { escapeHtml, renderBlocks } = GuideBlocks;

  const params = new URLSearchParams(window.location.search);
  const file = params.get('file') || 'data/itn170-labs.json';

  const rootEl = document.getElementById('labs-root');
  const subtitleEl = document.getElementById('labs-subtitle');

  function labHref(id) {
    return 'lab.html?file=' + encodeURIComponent(file) + '&lab=' + encodeURIComponent(id);
  }

  function card(section) {
    const tasks = section.tasks || 0;
    return `
      <a class="lab-card" href="${labHref(section.id)}">
        <span class="lab-card-num">Lab ${section.lab}</span>
        <span class="lab-card-title">${escapeHtml(section.title || section.name)}</span>
        <span class="lab-card-meta">${tasks} ${tasks === 1 ? 'task' : 'tasks'}</span>
      </a>
    `;
  }

  function render(data) {
    const sections = data.sections || [];
    const intro = sections.filter(s => !s.lab);
    const labs = sections.filter(s => s.lab).sort((a, b) => a.lab - b.lab);
    const totalTasks = labs.reduce((n, s) => n + (s.tasks || 0), 0);

    rootEl.innerHTML = `
      <div class="page-head">
        <h1>${escapeHtml(data.title || 'Lab Exercises')}</h1>
        ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ''}
      </div>

      <div class="lab-grid">
        ${labs.map(card).join('')}
      </div>

      <p class="lab-total">${labs.length} labs &middot; ${totalTasks} tasks &middot;
         every one worked on the practice machine, with <code>nano</code> available.</p>

      ${intro.map(section => `
        <div class="lab-intro">
          ${renderBlocks(section.blocks)}
        </div>
      `).join('')}
    `;
  }

  fetch(file)
    .then(res => {
      if (!res.ok) throw new Error('Lab file not found: ' + file);
      return res.json();
    })
    .then(data => {
      document.title = data.title || 'Lab Exercises';
      if (subtitleEl) subtitleEl.textContent = data.title || '';
      render(data);
    })
    .catch(err => {
      rootEl.innerHTML = '<div class="loading load-error">Couldn\'t load the labs. ' +
        escapeHtml(err.message) + '</div>';
    });
})();
