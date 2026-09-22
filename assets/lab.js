/* ===========================================================================
 * One lab, with the practice machine beside it.
 *
 * The terminal itself is assets/term.js -- the same one the playground uses.
 * This file only fetches the lab, draws its tasks, and wires the navigation
 * between labs; term.js finds the markup it expects and takes over from there.
 * =========================================================================== */
(function () {
  'use strict';

  const { escapeHtml, renderBlocks } = GuideBlocks;

  const params = new URLSearchParams(window.location.search);
  const file = params.get('file') || 'data/itn170-labs.json';
  const wanted = params.get('lab');

  const headEl = document.getElementById('lab-head');
  const tasksEl = document.getElementById('lab-tasks');
  const navEl = document.getElementById('lab-nav');
  const subtitleEl = document.getElementById('lab-subtitle');
  const allLabsEl = document.getElementById('all-labs');

  function labsHref() { return 'labs.html?file=' + encodeURIComponent(file); }
  function labHref(id) { return 'lab.html?file=' + encodeURIComponent(file) + '&lab=' + encodeURIComponent(id); }

  function render(data) {
    const labs = (data.sections || []).filter(s => s.lab).sort((a, b) => a.lab - b.lab);
    const at = wanted
      ? labs.findIndex(s => s.id === wanted || String(s.lab) === wanted)
      : 0;

    if (at === -1) {
      tasksEl.innerHTML = '<div class="loading load-error">No lab called &ldquo;' +
        escapeHtml(wanted) + '&rdquo; in this file. <a href="' + labsHref() +
        '">Pick one from the list.</a></div>';
      return;
    }

    const lab = labs[at];
    const title = lab.title || lab.name;

    // The section's own heading becomes the page title, so it is not repeated
    // at the top of the task list.
    const blocks = (lab.blocks || []).slice();
    if (blocks.length && blocks[0].type === 'heading') blocks.shift();

    document.title = 'Lab ' + lab.lab + ' — ' + title;
    if (subtitleEl) subtitleEl.textContent = 'Lab ' + lab.lab + ' of ' + labs.length;
    if (allLabsEl) allLabsEl.setAttribute('href', labsHref());

    headEl.innerHTML =
      '<span class="guide-eyebrow">Lab ' + lab.lab + ' of ' + labs.length + '</span>' +
      '<h1>' + escapeHtml(title) + '</h1>' +
      (data.guideFile
        ? '<p class="lab-stuck">Stuck on a task? The ' +
          '<a href="review.html?file=' + encodeURIComponent(data.guideFile) + '">' +
          'study guide</a> has the command. Try the lab again afterwards without it.</p>'
        : '');

    tasksEl.innerHTML = renderBlocks(blocks);

    const prev = labs[at - 1];
    const next = labs[at + 1];
    navEl.innerHTML =
      (prev
        ? '<a class="lab-nav-link" href="' + labHref(prev.id) + '">&larr; Lab ' + prev.lab +
          ': ' + escapeHtml(prev.title || prev.name) + '</a>'
        : '<span></span>') +
      '<a class="lab-nav-all" href="' + labsHref() + '">All labs</a>' +
      (next
        ? '<a class="lab-nav-link" href="' + labHref(next.id) + '">Lab ' + next.lab + ': ' +
          escapeHtml(next.title || next.name) + ' &rarr;</a>'
        : '<span></span>');
  }

  fetch(file)
    .then(res => {
      if (!res.ok) throw new Error('Lab file not found: ' + file);
      return res.json();
    })
    .then(render)
    .catch(err => {
      tasksEl.innerHTML = '<div class="loading load-error">Couldn\'t load this lab. ' +
        escapeHtml(err.message) + '</div>';
    });
})();
