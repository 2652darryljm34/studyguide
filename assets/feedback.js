/* Non-intrusive feedback: a small "Feedback" tab on every page, plus QuizFeedback.open(context) so the
 * quiz can offer "Report this question". Writes one document to the Firestore `feedback` collection over
 * the REST API (no SDK). Does nothing until assets/firebase-config.js is filled in. */
(() => {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.projectId) return;
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/feedback?key=${cfg.apiKey}`;
  const KINDS = ['Question', 'Topic', 'This page', 'Something else'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const tab = document.createElement('button');
  tab.className = 'fb-tab';
  tab.textContent = 'Feedback';
  tab.addEventListener('click', () => open({}));
  document.body.appendChild(tab);

  function open(ctx) {
    close();
    const kind = ctx.kind || 'This page';
    const box = document.createElement('div');
    box.className = 'fb-box';
    box.setAttribute('role', 'dialog');
    box.innerHTML = `
      <div class="fb-head"><strong>Send feedback</strong><button class="fb-x" aria-label="Close">&times;</button></div>
      ${ctx.label ? `<p class="fb-ctx">About: ${esc(ctx.label)}</p>` : ''}
      <select class="fb-kind" aria-label="Feedback about">${KINDS.map(k => `<option${k === kind ? ' selected' : ''}>${k}</option>`).join('')}</select>
      <textarea class="fb-text" maxlength="1000" rows="4" placeholder="What's wrong or could be better? (no personal info please)"></textarea>
      <div class="fb-row"><span class="fb-msg" aria-live="polite"></span><button class="btn primary fb-send">Send</button></div>`;
    document.body.appendChild(box);
    const q = s => box.querySelector(s);
    q('.fb-x').addEventListener('click', close);
    q('.fb-text').focus();
    q('.fb-send').addEventListener('click', async () => {
      const text = q('.fb-text').value.trim();
      if (!text) { q('.fb-msg').textContent = 'Write a few words first.'; return; }
      q('.fb-send').disabled = true;
      const f = { text, kind: q('.fb-kind').value, page: location.pathname.split('/').pop() + location.search, label: ctx.label || '', topic: ctx.topic || '' };
      const body = { fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { stringValue: String(v).slice(0, 1000) }])) };
      body.fields.at = { timestampValue: new Date().toISOString() };
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(r.status);
        q('.fb-msg').textContent = 'Thanks, sent!';
        setTimeout(close, 1200);
      } catch (e) {
        q('.fb-msg').textContent = "Couldn't send. Try again later.";
        q('.fb-send').disabled = false;
      }
    });
  }
  function close() { document.querySelectorAll('.fb-box').forEach(b => b.remove()); }

  window.QuizFeedback = { open };
})();
