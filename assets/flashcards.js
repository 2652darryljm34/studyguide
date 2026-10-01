// Flashcard deck. Loads ?file=<json> with {title, cards:[{topic, term, definition, useCase, example}]}.
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const file = new URLSearchParams(location.search).get('file') || 'data/itd145-exam2-flashcards.json';
  const storeKey = 'flashcards-known:' + file;

  let cards = [], topics = [], topic = 'All', deck = [], i = 0, known = new Set();
  try { known = new Set(JSON.parse(localStorage.getItem(storeKey) || '[]')); } catch (e) {}
  const save = () => { try { localStorage.setItem(storeKey, JSON.stringify([...known])); } catch (e) {} };

  function drawChips(){
    $('fc-chips').innerHTML = topics.map(t =>
      `<button class="fc-chip" aria-pressed="${t === topic}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  }
  function build(){
    deck = cards.filter(c => topic === 'All' || c.topic === topic);
    i = 0; render();
  }
  function render(){
    const c = deck[i];
    const looksLikeCode = /[(\[.=_]/.test(c.term) && !/ /.test(c.term.replace(/\(.*\)/, ''));
    const card = $('fc-card');
    card.classList.remove('flipped');
    card.innerHTML = `<div class="fc-inner">
      <div class="fc-face fc-front"><span class="fc-tag">${esc(c.topic)}</span>
        <p class="fc-term${looksLikeCode ? ' code' : ''}">${esc(c.term)}</p><span class="fc-hint">Tap to flip</span></div>
      <div class="fc-face fc-back"><span class="fc-tag">${esc(c.topic)} / ${esc(c.term)}</span>
        <div><p class="fc-lbl">Definition</p><p>${esc(c.definition)}</p></div>
        <div><p class="fc-lbl">Use case</p><p>${esc(c.useCase)}</p></div>
        <div><p class="fc-lbl">Example</p><pre>${esc(c.example)}</pre></div></div></div>`;
    $('fc-pos').textContent = `Card ${i + 1} of ${deck.length}`;
    const k = deck.filter(x => known.has(x.term)).length;
    $('fc-known').textContent = `${k} of ${deck.length} marked known`;
    $('fc-fill').style.width = deck.length ? (100 * k / deck.length) + '%' : '0';
    const on = known.has(c.term), m = $('fc-mark');
    m.setAttribute('aria-pressed', on); m.textContent = on ? 'Known' : 'Got it';
  }
  const go = d => { i = (i + d + deck.length) % deck.length; render(); };
  const flip = () => $('fc-card').classList.toggle('flipped');
  const mark = () => { const t = deck[i].term; known.has(t) ? known.delete(t) : known.add(t); save(); render(); };

  fetch(file).then(r => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.json(); }).then(d => {
    cards = d.cards;
    topics = ['All', ...new Set(cards.map(c => c.topic))];
    document.title = d.title + ' - QuizHub';
    $('fc-subtitle').textContent = d.title;
    $('loading').hidden = true; $('app').hidden = false;
    drawChips(); build();
  }).catch(err => { $('loading').textContent = "Couldn't load the flashcards. " + err.message; });

  $('fc-chips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b){ topic = b.dataset.t; drawChips(); build(); }
  });
  $('fc-card').addEventListener('click', flip);
  $('fc-prev').onclick = () => go(-1);
  $('fc-next').onclick = () => go(1);
  $('fc-mark').onclick = mark;
  $('fc-shuf').onclick = () => {
    for (let n = deck.length - 1; n > 0; n--){ const j = Math.floor(Math.random() * (n + 1)); [deck[n], deck[j]] = [deck[j], deck[n]]; }
    i = 0; render();
  };
  document.addEventListener('keydown', e => {
    if (!deck.length || (e.target.tagName === 'BUTTON' && e.key === ' ')) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === ' '){ e.preventDefault(); flip(); }
    else if (e.key.toLowerCase() === 'k') mark();
  });
})();
