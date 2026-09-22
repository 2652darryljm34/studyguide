/* ===========================================================================
 * Block rendering, shared by every page that shows authored content: the
 * study guide, the lab selection screen and a single lab page.
 *
 * A "block" is one authored unit -- a heading, a paragraph, a table, a code
 * sample. Keeping the renderer here means a lab sheet and a study guide can
 * never drift apart in how they look, because they are the same code.
 * =========================================================================== */
(function (global) {
  'use strict';

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  /* Minimal inline markup: **bold** and `code`, applied after escaping so raw text stays safe */
  function formatInline(str){
    return escapeHtml(str)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  function nl2br(str){
    return formatInline(str).replace(/\n/g, '<br>');
  }

  function slugify(str){
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function renderBlock(block){
    switch(block.type){
      case 'heading':
        return `<h3 id="${slugify(block.text)}" class="guide-h3">${formatInline(block.text)}</h3>`;
      case 'subheading':
        return `<h4 class="guide-h4">${formatInline(block.text)}</h4>`;
      case 'paragraph':
        return `<p class="guide-p">${nl2br(block.text)}</p>`;
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        const items = (block.items || []).map(i => `<li>${formatInline(i)}</li>`).join('');
        return `<${tag} class="guide-list">${items}</${tag}>`;
      }
      case 'table': {
        const head = (block.headers || []).map(h => `<th>${formatInline(h)}</th>`).join('');
        const rows = (block.rows || []).map(row => `<tr>${row.map(c => `<td>${nl2br(c)}</td>`).join('')}</tr>`).join('');
        return `<div class="guide-table-wrap"><table class="guide-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      case 'code':
        // Only blocks that declare a language get tokenized -- the guide also uses
        // code blocks for ASCII diagrams, dependency sets and terminal transcripts,
        // none of which are source in any language.
        if(block.lang === 'sql' && typeof SqlHL !== 'undefined'){
          return `<pre class="model-answer guide-code sql-hl"><code>${SqlHL.highlight(block.text)}</code></pre>`;
        }
        if(block.lang === 'shell' && typeof ShellHL !== 'undefined'){
          return `<pre class="model-answer guide-code shell-hl"><code>${ShellHL.highlight(block.text)}</code></pre>`;
        }
        return `<pre class="model-answer guide-code">${escapeHtml(block.text)}</pre>`;
      case 'note':
        return `<div class="guide-note"><strong>${escapeHtml(block.label || 'Note')}</strong> ${nl2br(block.text)}</div>`;
      default:
        return '';
    }
  }

  const chevronSvg = '<svg class="chev" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  global.GuideBlocks = {
    escapeHtml: escapeHtml,
    formatInline: formatInline,
    nl2br: nl2br,
    slugify: slugify,
    renderBlock: renderBlock,
    renderBlocks: function (blocks) {
      return (blocks || []).map(renderBlock).join('');
    },
    chevronSvg: chevronSvg
  };
})(typeof window !== 'undefined' ? window : globalThis);
